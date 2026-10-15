import RAPIER from '@dimforge/rapier3d-compat'
import type { SceneDefinition, Vec3 } from '../scene/types'
import { DIFF_DRIVE_DISTANCE_RANGE, DIFF_DRIVE_MAX_SPEED, DIFF_DRIVE_WHEEL_BASE } from '../robots/diff-drive'
import { getCapability } from '../robots'
import { DEG_TO_RAD, headingFromYaw, yawFromQuaternion, yawQuaternion } from './geometry'

export const PHYSICS_STEP_SEC = 1 / 60

const BORDER_HEIGHT = 0.08
const BORDER_THICKNESS = 0.04

let initialising: Promise<void> | null = null

/** Loads Rapier's WASM once per page. The compat build inlines it, so no extra request is made. */
export function initPhysics(): Promise<void> {
  initialising ??= RAPIER.init()
  return initialising
}

export interface RobotPose {
  x: number
  z: number
  /** Degrees, (-180, 180]. */
  heading: number
}

export interface BodyTransform {
  position: Vec3
  rotation: { x: number; y: number; z: number; w: number }
}

/**
 * The Rapier world for one run. Headless: it knows nothing about rendering, so it runs the same
 * in tests as in the browser. Create a new one per run; `dispose` frees the WASM memory.
 */
export class PhysicsWorld {
  private readonly world: RAPIER.World
  private readonly events = new RAPIER.EventQueue(true)
  private readonly robotBody: RAPIER.RigidBody
  private readonly robotCollider: RAPIER.Collider
  private readonly robotHalfLength: number
  private readonly robotHeight: number
  private readonly props = new Map<string, RAPIER.RigidBody>()
  /** Colliders the robot can bump into, mapped to a name for the run summary. */
  private readonly obstacleNames = new Map<number, string>()
  private wheels = { left: 0, right: 0 }
  private collisions: { name: string }[] = []

  constructor(scene: SceneDefinition) {
    const capability = getCapability(scene.robot.type)
    if (!capability) throw new Error(`Unknown robot type "${scene.robot.type}"`)

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.world.timestep = PHYSICS_STEP_SEC

    const { width, depth } = scene.arena
    const floor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0))
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2 + 0.5, 0.05, depth / 2 + 0.5).setFriction(0.8), floor)

    // A low border keeps the robot and props inside the arena.
    const borders = [
      { x: 0, z: -depth / 2 - BORDER_THICKNESS / 2, hx: width / 2 + BORDER_THICKNESS, hz: BORDER_THICKNESS / 2 },
      { x: 0, z: depth / 2 + BORDER_THICKNESS / 2, hx: width / 2 + BORDER_THICKNESS, hz: BORDER_THICKNESS / 2 },
      { x: -width / 2 - BORDER_THICKNESS / 2, z: 0, hx: BORDER_THICKNESS / 2, hz: depth / 2 },
      { x: width / 2 + BORDER_THICKNESS / 2, z: 0, hx: BORDER_THICKNESS / 2, hz: depth / 2 },
    ]
    for (const border of borders) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(border.x, BORDER_HEIGHT / 2, border.z))
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(border.hx, BORDER_HEIGHT / 2, border.hz), body)
      this.obstacleNames.set(collider.handle, 'the arena edge')
    }

    for (const wall of scene.walls) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(wall.x, wall.height / 2, wall.z)
          .setRotation(yawQuaternion(wall.rotationDeg * DEG_TO_RAD)),
      )
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(wall.length / 2, wall.height / 2, wall.thickness / 2),
        body,
      )
      this.obstacleNames.set(collider.handle, `wall ${wall.id}`)
    }

    for (const prop of scene.props) {
      const halfHeight = prop.shape === 'sphere' ? prop.size.x : prop.size.y / 2
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(prop.x, halfHeight, prop.z).setLinearDamping(0.5).setAngularDamping(0.5),
      )
      const desc =
        prop.shape === 'box'
          ? RAPIER.ColliderDesc.cuboid(prop.size.x / 2, prop.size.y / 2, prop.size.z / 2)
          : prop.shape === 'sphere'
            ? RAPIER.ColliderDesc.ball(prop.size.x)
            : RAPIER.ColliderDesc.cylinder(prop.size.y / 2, prop.size.x)
      const collider = this.world.createCollider(desc.setMass(prop.mass).setFriction(0.6), body)
      this.props.set(prop.id, body)
      this.obstacleNames.set(collider.handle, `prop ${prop.id}`)
    }

    const { width: robotWidth, length, height } = capability.size
    this.robotHalfLength = length / 2
    this.robotHeight = height
    const start = scene.robot.start
    this.robotBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(start.x, height / 2 + 0.002, start.z)
        .setRotation(yawQuaternion(start.headingDeg * DEG_TO_RAD))
        // The robot only ever turns about Y: no tipping over, however hard it hits a wall.
        .enabledRotations(false, true, false)
        .setCcdEnabled(true),
    )
    this.robotCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(length / 2, height / 2, robotWidth / 2)
        .setMass(1)
        // The robot's velocity is set directly each step, so it needs no friction - and floor
        // friction would eat most of a slow final approach, stopping it short of its target.
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.robotBody,
    )

    // Ray casts only see colliders once the world has stepped. Step once with the robot at rest,
    // so a program that reads its sensors before moving gets real readings.
    this.world.step()
  }

  /** Wheel speeds as a fraction of top speed, -1 to 1. */
  setWheels(left: number, right: number): void {
    this.wheels = { left, right }
  }

  getWheels(): { left: number; right: number } {
    return { ...this.wheels }
  }

  step(): void {
    // Differential drive: wheel speeds set the robot's forward and turning speed directly, which
    // is all a beginner's robot needs. Walls and props still stop it, because the body is dynamic.
    const left = this.wheels.left * DIFF_DRIVE_MAX_SPEED
    const right = this.wheels.right * DIFF_DRIVE_MAX_SPEED
    const forward = (left + right) / 2
    const turnRate = (right - left) / DIFF_DRIVE_WHEEL_BASE
    const yaw = yawFromQuaternion(this.robotBody.rotation())
    const current = this.robotBody.linvel()
    this.robotBody.setLinvel({ x: Math.cos(yaw) * forward, y: current.y, z: -Math.sin(yaw) * forward }, true)
    this.robotBody.setAngvel({ x: 0, y: turnRate, z: 0 }, true)

    this.world.step(this.events)

    this.events.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return
      const other = handle1 === this.robotCollider.handle ? handle2 : handle2 === this.robotCollider.handle ? handle1 : null
      if (other === null) return
      const name = this.obstacleNames.get(other)
      if (name) this.collisions.push({ name })
    })
  }

  /** Collisions since the last call. */
  drainCollisions(): { name: string }[] {
    const drained = this.collisions
    this.collisions = []
    return drained
  }

  robotPose(): RobotPose {
    const t = this.robotBody.translation()
    return { x: t.x, z: t.z, heading: headingFromYaw(yawFromQuaternion(this.robotBody.rotation())) }
  }

  robotTransform(): BodyTransform {
    return { position: { ...this.robotBody.translation() }, rotation: { ...this.robotBody.rotation() } }
  }

  propTransforms(): Map<string, BodyTransform> {
    const result = new Map<string, BodyTransform>()
    for (const [id, body] of this.props) {
      result.set(id, { position: { ...body.translation() }, rotation: { ...body.rotation() } })
    }
    return result
  }

  /** Distance from the front of the robot to the nearest obstacle ahead, capped at the sensor range. */
  frontDistance(): number {
    const pose = this.robotPose()
    const yaw = pose.heading * DEG_TO_RAD
    const dir = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
    const origin = {
      x: pose.x + dir.x * this.robotHalfLength,
      y: this.robotHeight / 2,
      z: pose.z + dir.z * this.robotHalfLength,
    }
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, dir),
      DIFF_DRIVE_DISTANCE_RANGE,
      true,
      undefined,
      undefined,
      this.robotCollider,
      this.robotBody,
    )
    return hit ? hit.timeOfImpact : DIFF_DRIVE_DISTANCE_RANGE
  }

  dispose(): void {
    this.events.free()
    this.world.free()
  }
}
