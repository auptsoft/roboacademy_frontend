import RAPIER from '@dimforge/rapier3d-compat'
import type { RobotCapability } from '../../robots'
import { diffDrive, diffDriveWheels, type WheeledSpec } from '../../robots/diff-drive'
import { rover, roverWheels } from '../../robots/rover'
import type { SceneDefinition, Vec2 } from '../../scene/types'
import { CommandError, motionTimeout, timedMotion, type CommandMotion } from '../commands'
import { DEG_TO_RAD, distanceToPolyline, headingFromYaw, normaliseDegrees, yawFromQuaternion, yawQuaternion } from '../geometry'
import { PHYSICS_STEP_SEC, type RobotPose } from '../physics'
import type { RobotContext, RobotDriver, RobotInstance, RobotState } from './types'

function wheeledDriver(capability: RobotCapability, spec: WheeledSpec): RobotDriver {
  return { type: capability.type, create: (context) => new WheeledRobot(context, spec) }
}

export const diffDriveDriver = wheeledDriver(diffDrive, diffDriveWheels)
export const roverDriver = wheeledDriver(rover, roverWheels)

/**
 * A robot steered by its left and right wheel speeds: one dynamic body whose velocity the wheel
 * speeds set directly. The spec sets its speed, turning and sensor geometry.
 */
class WheeledRobot implements RobotInstance {
  readonly colliders: RAPIER.Collider[]
  private readonly world: RAPIER.World
  private readonly scene: SceneDefinition
  private readonly spec: WheeledSpec
  private readonly body: RAPIER.RigidBody
  private readonly collider: RAPIER.Collider
  private readonly halfLength: number
  private readonly height: number
  /** Wheel speeds as a fraction of top speed, -1 to 1. */
  private wheels = { left: 0, right: 0 }

  constructor({ world, scene, placement, capability }: RobotContext, spec: WheeledSpec) {
    this.world = world
    this.scene = scene
    this.spec = spec
    const { width, length, height } = capability.size
    this.halfLength = length / 2
    this.height = height
    const start = placement.start
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(start.x, height / 2 + 0.002, start.z)
        .setRotation(yawQuaternion(start.headingDeg * DEG_TO_RAD))
        // The robot only ever turns about Y: no tipping over, however hard it hits a wall.
        .enabledRotations(false, true, false)
        .setCcdEnabled(true),
    )
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(length / 2, height / 2, width / 2)
        .setMass(1)
        // The robot's velocity is set directly each step, so it needs no friction - and floor
        // friction would eat most of a slow final approach, stopping it short of its target.
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    )
    this.colliders = [this.collider]
  }

  command(name: string, args: Record<string, number>): CommandMotion | null {
    switch (name) {
      case 'stop':
        this.setWheels(0, 0)
        return null
      case 'setWheels':
        this.setWheels(args.left! / 100, args.right! / 100)
        return null
      case 'drive': {
        const speed = args.speed! / 100
        this.setWheels(speed, speed)
        const durationMs = args.durationMs!
        if (durationMs <= 0) return null
        return timedMotion(durationMs, () => this.setWheels(0, 0))
      }
      case 'wait':
        return timedMotion(args.ms!)
      case 'move':
        return this.move(args.distanceCm! / 100, args.speed! / 100)
      case 'turn':
        return this.turn(args.degrees!, args.speed! / 100)
      default:
        throw new CommandError(`Unknown command "${name}".`, 'invalid')
    }
  }

  halt(): void {
    this.setWheels(0, 0)
  }

  sensor(name: string): number | boolean {
    const pose = this.pose()
    switch (name) {
      case 'distance_front':
        return round(this.frontDistance(pose), 3)
      case 'line_left':
        return this.onLine(pose, 1)
      case 'line_right':
        return this.onLine(pose, -1)
      case 'pos_x':
        return round(pose.x, 3)
      case 'pos_z':
        return round(pose.z, 3)
      case 'heading':
        return round(pose.heading, 1)
      default:
        throw new CommandError(`Unknown sensor "${name}".`, 'invalid')
    }
  }

  beforeStep(): void {
    // Differential drive: wheel speeds set the robot's forward and turning speed directly, which
    // is all a beginner's robot needs. Walls and props still stop it, because the body is dynamic.
    const left = this.wheels.left * this.spec.maxSpeed
    const right = this.wheels.right * this.spec.maxSpeed
    const forward = (left + right) / 2
    const turnRate = (right - left) / this.spec.wheelBase
    const yaw = yawFromQuaternion(this.body.rotation())
    const current = this.body.linvel()
    this.body.setLinvel({ x: Math.cos(yaw) * forward, y: current.y, z: -Math.sin(yaw) * forward }, true)
    this.body.setAngvel({ x: 0, y: turnRate, z: 0 }, true)
  }

  pose(): RobotPose {
    const t = this.body.translation()
    return { x: t.x, z: t.z, heading: headingFromYaw(yawFromQuaternion(this.body.rotation())) }
  }

  state(): RobotState {
    return { transform: { position: { ...this.body.translation() }, rotation: { ...this.body.rotation() } }, joints: {} }
  }

  heldProp(): string | null {
    return null
  }

  /** Midway between the wheels, like a turtle's pen. */
  penPoint(): Vec2 {
    const { x, z } = this.pose()
    return { x, z }
  }

  private setWheels(left: number, right: number): void {
    this.wheels = { left, right }
  }

  private move(distance: number, speed: number): CommandMotion | null {
    const target = Math.abs(distance)
    if (target < 0.001) return null
    const startPose = this.pose()
    const direction = Math.sign(distance)
    const heading = startPose.heading * DEG_TO_RAD
    const forward = { x: Math.cos(heading), z: -Math.sin(heading) }
    const stepDistance = speed * this.spec.maxSpeed * PHYSICS_STEP_SEC

    const expectedMs = (target / (speed * this.spec.maxSpeed)) * 1000
    return {
      timeoutMs: motionTimeout(expectedMs),
      blockedMessage: "The robot couldn't finish moving. Is something in the way?",
      update: () => {
        const pose = this.pose()
        // Progress is measured along the starting heading, so a robot nudged sideways by a prop
        // still stops at the right distance.
        const travelled = ((pose.x - startPose.x) * forward.x + (pose.z - startPose.z) * forward.z) * direction
        const remaining = target - travelled
        if (remaining <= 0.0005) {
          this.setWheels(0, 0)
          return true
        }
        // Slow down over the last few steps so the robot stops close to the target, not a step past it.
        const scale = Math.max(0.05, Math.min(1, remaining / (stepDistance * 3)))
        const wheel = direction * speed * scale
        this.setWheels(wheel, wheel)
        return false
      },
    }
  }

  private turn(degrees: number, speed: number): CommandMotion | null {
    const target = Math.abs(degrees)
    if (target < 0.05) return null
    const direction = Math.sign(degrees)
    const degreesPerStep = ((2 * speed * this.spec.maxSpeed) / this.spec.wheelBase) * PHYSICS_STEP_SEC * (180 / Math.PI)
    let turned = 0
    let previous = this.pose().heading

    const expectedMs = (target / degreesPerStep) * PHYSICS_STEP_SEC * 1000
    return {
      timeoutMs: motionTimeout(expectedMs),
      blockedMessage: "The robot couldn't finish turning. Is something in the way?",
      update: () => {
        const pose = this.pose()
        // Accumulate step by step, so turns of more than 180° are measured correctly.
        turned += normaliseDegrees(pose.heading - previous) * direction
        previous = pose.heading
        const remaining = target - turned
        if (remaining <= 0.05) {
          this.setWheels(0, 0)
          return true
        }
        const scale = Math.max(0.05, Math.min(1, remaining / (degreesPerStep * 3)))
        const wheel = speed * scale
        // Positive is counter-clockwise: right wheel forward, left wheel back.
        this.setWheels(-direction * wheel, direction * wheel)
        return false
      },
    }
  }

  /** Distance from the front of the robot to the nearest obstacle ahead, capped at the sensor range. */
  private frontDistance(pose: RobotPose): number {
    const yaw = pose.heading * DEG_TO_RAD
    const dir = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
    const origin = {
      x: pose.x + dir.x * this.halfLength,
      y: this.height / 2,
      z: pose.z + dir.z * this.halfLength,
    }
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, dir),
      this.spec.distanceRange,
      true,
      undefined,
      undefined,
      this.collider,
      this.body,
    )
    return hit ? hit.timeOfImpact : this.spec.distanceRange
  }

  /** Whether a line sensor (side 1 = left, -1 = right) is over a line. */
  private onLine(pose: RobotPose, side: 1 | -1): boolean {
    const yaw = pose.heading * DEG_TO_RAD
    const forward = { x: Math.cos(yaw), z: -Math.sin(yaw) }
    // Left of forward, seen from above, with +Z down the screen.
    const left = { x: -Math.sin(yaw), z: -Math.cos(yaw) }
    const { forward: ahead, side: across } = this.spec.lineSensorOffset
    const point = {
      x: pose.x + forward.x * ahead + left.x * across * side,
      z: pose.z + forward.z * ahead + left.z * across * side,
    }
    return this.scene.lines.some((line) => distanceToPolyline(point, line.points) <= line.width / 2)
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
