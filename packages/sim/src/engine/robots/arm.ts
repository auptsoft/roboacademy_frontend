import RAPIER from '@dimforge/rapier3d-compat'
import { ARM_GEOMETRY as G, arm } from '../../robots/arm'
import type { PropDef, SceneDefinition, Vec2, Vec3 } from '../../scene/types'
import { CommandError, motionTimeout, timedMotion, type CommandMotion } from '../commands'
import {
  DEG_TO_RAD,
  RAD_TO_DEG,
  conjugateQuaternion,
  multiplyQuaternions,
  normaliseDegrees,
  pitchQuaternion,
  rotateVector,
  yawQuaternion,
  type Quaternion,
} from '../geometry'
import type { RobotPose } from '../physics'
import type { RobotContext, RobotDriver, RobotInstance, RobotState } from './types'

export const armDriver: RobotDriver = {
  type: arm.type,
  create: (context) => new ArmRobot(context),
}

type JointName = 'base' | 'shoulder' | 'elbow' | 'wrist'
type Angles = Record<JointName, number>

const JOINT_COMMANDS: Record<string, JointName> = {
  setBase: 'base',
  setShoulder: 'shoulder',
  setElbow: 'elbow',
  setWrist: 'wrist',
}

const BLOCKED_MESSAGE = "The arm couldn't finish moving. Is something in the way?"
/** Query shapes are this much smaller than the parts, so grazing contact doesn't count as blocked. */
const CLEARANCE = 0.002
const TURRET_HALF = 0.035
const PALM_LENGTH = G.hand - G.fingerLength
/** The fingertips draw on the floor while they're this close to it. */
const PEN_HEIGHT = 0.01

interface PartPose {
  position: Vec3
  rotation: Quaternion
}

type PartName = 'turret' | 'upperArm' | 'forearm' | 'palm' | 'fingerLeft' | 'fingerRight'
const PART_NAMES: PartName[] = ['turret', 'upperArm', 'forearm', 'palm', 'fingerLeft', 'fingerRight']

interface ArmPose {
  parts: Record<PartName, PartPose>
  /** The hand's frame: at the wrist hinge, its +X pointing from the wrist to the fingertips. */
  hand: PartPose
  /** The point between the fingertips, where `reach` aims and the gripper sensors read. */
  tip: Vec3
}

interface Held {
  id: string
  body: RAPIER.RigidBody
  /** The prop's pose in the hand's frame. */
  offset: PartPose
  /** For blocking checks: the prop's shape, a little smaller. */
  queryShape: RAPIER.Shape
}

/**
 * The robot arm. Its base is fixed to the floor; the moving parts are kinematic bodies posed from
 * the joint angles every step, so they push props aside but nothing pushes them back. Instead, a
 * motion that would drive a part (or a held prop) into a wall or the floor stops and reports the
 * arm as blocked. A held prop becomes kinematic too, and rides along with the hand.
 */
class ArmRobot implements RobotInstance {
  readonly colliders: RAPIER.Collider[]
  private readonly world: RAPIER.World
  private readonly scene: SceneDefinition
  private readonly props: ReadonlyMap<string, RAPIER.RigidBody>
  private readonly origin: Vec3
  private readonly headingDeg: number
  private readonly bodies: Record<PartName, RAPIER.RigidBody>
  private readonly shapes: Record<PartName, RAPIER.Shape>
  /** Full-size finger shape, for feeling a prop between the fingers. */
  private readonly fingerShape: RAPIER.Shape
  private readonly own = new Set<number>()
  private angles: Angles
  /** Gap between the fingers, in metres. */
  private gap = G.gripperOpen
  private held: Held | null = null

  constructor({ world, scene, placement, capability, props }: RobotContext) {
    this.world = world
    this.scene = scene
    this.props = props
    const start = placement.start
    this.origin = { x: start.x, y: 0, z: start.z }
    this.headingDeg = start.headingDeg
    const rest = (name: JointName) => capability.joints?.find((joint) => joint.name === name)?.rest ?? 0
    this.angles = { base: rest('base'), shoulder: rest('shoulder'), elbow: rest('elbow'), wrist: rest('wrist') }

    const base = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(start.x, G.baseHeight / 2, start.z))
    const baseCollider = world.createCollider(
      RAPIER.ColliderDesc.cylinder(G.baseHeight / 2, G.baseRadius).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      base,
    )

    const fingerHalf = { x: G.fingerLength / 2, y: (G.link * 0.8) / 2, z: G.finger / 2 }
    const halves: Record<PartName, Vec3> = {
      turret: { x: TURRET_HALF, y: (G.shoulderHeight - G.baseHeight) / 2, z: TURRET_HALF },
      upperArm: { x: G.upperArm / 2, y: G.link / 2, z: G.link / 2 },
      forearm: { x: G.forearm / 2, y: G.link / 2, z: G.link / 2 },
      palm: { x: PALM_LENGTH / 2, y: G.link / 2, z: G.gripperOpen / 2 + G.finger },
      fingerLeft: fingerHalf,
      fingerRight: fingerHalf,
    }
    const pose = this.poseFor(this.angles, this.gap)
    const bodies = {} as Record<PartName, RAPIER.RigidBody>
    const shapes = {} as Record<PartName, RAPIER.Shape>
    this.colliders = [baseCollider]
    for (const name of PART_NAMES) {
      const half = halves[name]
      const part = pose.parts[name]
      bodies[name] = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(part.position.x, part.position.y, part.position.z).setRotation(part.rotation),
      )
      this.colliders.push(
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
          bodies[name],
        ),
      )
      shapes[name] = new RAPIER.Cuboid(half.x - CLEARANCE, half.y - CLEARANCE, half.z - CLEARANCE)
    }
    this.bodies = bodies
    this.shapes = shapes
    this.fingerShape = new RAPIER.Cuboid(fingerHalf.x, fingerHalf.y, fingerHalf.z)
    for (const collider of this.colliders) this.own.add(collider.handle)
  }

  command(name: string, args: Record<string, number>): CommandMotion | null {
    const joint = JOINT_COMMANDS[name]
    if (joint) return this.moveJoints({ [joint]: args.degrees! }, args.speed! / 100)
    switch (name) {
      case 'reach':
        return this.moveJoints(this.solveReach(args.distanceCm! / 100, args.heightCm! / 100), args.speed! / 100)
      case 'openGripper':
        this.release()
        return this.moveGripper(G.gripperOpen)
      case 'closeGripper':
        return this.held ? null : this.moveGripper(G.gripperClosed)
      case 'stop':
        return null
      case 'wait':
        return timedMotion(args.ms!)
      default:
        throw new CommandError(`Unknown command "${name}".`, 'invalid')
    }
  }

  /** Joints and the gripper only move inside a command's motion, so dropping it stops them. */
  halt(): void {}

  sensor(name: string): number | boolean {
    switch (name) {
      case 'base_angle':
        return round(this.angles.base, 1)
      case 'shoulder_angle':
        return round(this.angles.shoulder, 1)
      case 'elbow_angle':
        return round(this.angles.elbow, 1)
      case 'wrist_angle':
        return round(this.angles.wrist, 1)
      case 'holding':
        return this.held !== null
      case 'gripper_distance':
        return round(this.gripperDistance(), 3)
      case 'gripper_x':
        return round(this.poseFor(this.angles, this.gap).tip.x, 3)
      case 'gripper_z':
        return round(this.poseFor(this.angles, this.gap).tip.z, 3)
      case 'gripper_height':
        return round(this.poseFor(this.angles, this.gap).tip.y, 3)
      default:
        throw new CommandError(`Unknown sensor "${name}".`, 'invalid')
    }
  }

  beforeStep(): void {
    const pose = this.poseFor(this.angles, this.gap)
    for (const name of PART_NAMES) {
      this.bodies[name].setNextKinematicTranslation(pose.parts[name].position)
      this.bodies[name].setNextKinematicRotation(pose.parts[name].rotation)
    }
    if (this.held) {
      const carried = this.heldPose(pose.hand, this.held)
      this.held.body.setNextKinematicTranslation(carried.position)
      this.held.body.setNextKinematicRotation(carried.rotation)
    }
  }

  pose(): RobotPose {
    return { x: this.origin.x, z: this.origin.z, heading: normaliseDegrees(this.headingDeg + this.angles.base) }
  }

  state(): RobotState {
    return {
      transform: { position: { ...this.origin }, rotation: yawQuaternion(this.headingDeg * DEG_TO_RAD) },
      joints: { ...this.angles },
      gripper: this.gap,
    }
  }

  heldProp(): string | null {
    return this.held?.id ?? null
  }

  penPoint(): Vec2 | null {
    const { tip } = this.poseFor(this.angles, this.gap)
    return tip.y <= PEN_HEIGHT ? { x: tip.x, z: tip.z } : null
  }

  /** Moves joints together in a straight line through joint space, all arriving at once. */
  private moveJoints(targets: Partial<Angles>, speed: number): CommandMotion | null {
    const start = { ...this.angles }
    const delta: Angles = { base: 0, shoulder: 0, elbow: 0, wrist: 0 }
    for (const [joint, target] of Object.entries(targets) as [JointName, number][]) delta[joint] = target - start[joint]
    const largest = Math.max(...Object.values(delta).map(Math.abs))
    if (largest < 0.05) return null

    const durationMs = (largest / (speed * G.maxJointSpeed)) * 1000
    let elapsedMs = 0
    return {
      timeoutMs: motionTimeout(durationMs),
      blockedMessage: BLOCKED_MESSAGE,
      update: (dtMs) => {
        const t = Math.min(1, (elapsedMs + dtMs) / durationMs)
        const next = {} as Angles
        for (const joint of Object.keys(start) as JointName[]) next[joint] = start[joint] + delta[joint] * t
        if (this.wouldHit(next, this.gap)) return 'blocked'
        this.angles = next
        elapsedMs += dtMs
        return t >= 1
      },
    }
  }

  /** Opens or closes the gripper. Closing stops, holding the prop, once both fingers touch one. */
  private moveGripper(target: number): CommandMotion | null {
    if (Math.abs(target - this.gap) < 0.0005) return null
    const direction = Math.sign(target - this.gap)
    const stepGap = (dtMs: number) => G.gripperSpeed * (dtMs / 1000)
    return {
      timeoutMs: motionTimeout((Math.abs(target - this.gap) / G.gripperSpeed) * 1000),
      blockedMessage: "The gripper couldn't finish moving. Is something in the way?",
      update: (dtMs) => {
        const next = direction < 0 ? Math.max(target, this.gap - stepGap(dtMs)) : Math.min(target, this.gap + stepGap(dtMs))
        if (direction < 0) {
          const gripped = this.propBetweenFingers(next)
          if (gripped) {
            this.grasp(gripped)
            return true
          }
        } else if (this.wouldHit(this.angles, next)) {
          return 'blocked'
        }
        this.gap = next
        return this.gap === target
      },
    }
  }

  /**
   * Joint angles that put the fingertips at a distance in front of the base and a height above the
   * floor, with the hand pointing straight down. Elbow up, like a desk lamp.
   */
  private solveReach(distance: number, height: number): Angles {
    const dx = distance
    const dy = height + G.hand - G.shoulderHeight
    const d = Math.hypot(dx, dy)
    const [l1, l2] = [G.upperArm, G.forearm]
    if (d > l1 + l2 || d < Math.abs(l1 - l2)) throw new CommandError("The arm can't reach that far.", 'invalid')
    const bend = Math.acos(Math.min(1, Math.max(-1, (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2))))
    const shoulder = (Math.atan2(dy, dx) + Math.atan2(l2 * Math.sin(bend), l1 + l2 * Math.cos(bend))) * RAD_TO_DEG
    const elbow = -bend * RAD_TO_DEG
    const wrist = normaliseDegrees(-90 - shoulder - elbow)
    const angles = { base: this.angles.base, shoulder, elbow, wrist }
    for (const joint of arm.joints!) {
      const value = angles[joint.name as JointName]
      if (value < joint.min - 0.01 || value > joint.max + 0.01) throw new CommandError("The arm can't reach that.", 'invalid')
    }
    return angles
  }

  /** Where every moving part is for a set of joint angles and a finger gap. */
  private poseFor(angles: Angles, gap: number): ArmPose {
    const yaw = yawQuaternion((this.headingDeg + angles.base) * DEG_TO_RAD)
    // In the arm's vertical plane: `along` is forward from the base, `up` is height above the floor.
    const at = (along: number, up: number, across = 0): Vec3 => {
      const local = rotateVector(yaw, { x: along, y: 0, z: across })
      return { x: this.origin.x + local.x, y: up, z: this.origin.z + local.z }
    }
    const a1 = angles.shoulder * DEG_TO_RAD
    const a2 = a1 + angles.elbow * DEG_TO_RAD
    const a3 = a2 + angles.wrist * DEG_TO_RAD
    const elbow = { along: G.upperArm * Math.cos(a1), up: G.shoulderHeight + G.upperArm * Math.sin(a1) }
    const wrist = { along: elbow.along + G.forearm * Math.cos(a2), up: elbow.up + G.forearm * Math.sin(a2) }
    const onHand = (distance: number) => ({ along: wrist.along + distance * Math.cos(a3), up: wrist.up + distance * Math.sin(a3) })
    const palm = onHand(PALM_LENGTH / 2)
    const fingers = onHand(G.hand - G.fingerLength / 2)
    const fingerOffset = gap / 2 + G.finger / 2
    const handRotation = multiplyQuaternions(yaw, pitchQuaternion(a3))

    return {
      parts: {
        turret: { position: at(0, (G.baseHeight + G.shoulderHeight) / 2), rotation: yaw },
        upperArm: { position: at(elbow.along / 2, (G.shoulderHeight + elbow.up) / 2), rotation: multiplyQuaternions(yaw, pitchQuaternion(a1)) },
        forearm: { position: at((elbow.along + wrist.along) / 2, (elbow.up + wrist.up) / 2), rotation: multiplyQuaternions(yaw, pitchQuaternion(a2)) },
        palm: { position: at(palm.along, palm.up), rotation: handRotation },
        fingerLeft: { position: at(fingers.along, fingers.up, -fingerOffset), rotation: handRotation },
        fingerRight: { position: at(fingers.along, fingers.up, fingerOffset), rotation: handRotation },
      },
      hand: { position: at(wrist.along, wrist.up), rotation: handRotation },
      tip: at(onHand(G.hand).along, onHand(G.hand).up),
    }
  }

  /**
   * Whether moving to these angles would push a part, or the held prop, into something fixed that
   * it isn't already touching. Already-touching contacts are let through, so a part that starts
   * against a wall can still move away from it.
   */
  private wouldHit(angles: Angles, gap: number): boolean {
    const current = this.fixedContacts(this.poseFor(this.angles, this.gap))
    for (const contact of this.fixedContacts(this.poseFor(angles, gap))) {
      if (!current.has(contact)) return true
    }
    return false
  }

  private fixedContacts(pose: ArmPose): Set<string> {
    const contacts = new Set<string>()
    const check = (key: string, part: PartPose, shape: RAPIER.Shape) => {
      this.world.intersectionsWithShape(
        part.position,
        part.rotation,
        shape,
        (collider) => {
          contacts.add(`${key}:${collider.handle}`)
          return true
        },
        RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,
        undefined,
        undefined,
        undefined,
        (collider) => !this.own.has(collider.handle),
      )
    }
    for (const name of PART_NAMES) check(name, pose.parts[name], this.shapes[name])
    if (this.held) check('held', this.heldPose(pose.hand, this.held), this.held.queryShape)
    return contacts
  }

  /** A prop both fingers would touch at this gap, if there is one. */
  private propBetweenFingers(gap: number): string | null {
    const pose = this.poseFor(this.angles, gap)
    const touched = (part: 'fingerLeft' | 'fingerRight') => {
      const found = new Set<string>()
      this.world.intersectionsWithShape(
        pose.parts[part].position,
        pose.parts[part].rotation,
        this.fingerShape,
        (collider) => {
          const id = this.propIdOf(collider)
          if (id) found.add(id)
          return true
        },
        RAPIER.QueryFilterFlags.EXCLUDE_FIXED | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,
      )
      return found
    }
    const right = touched('fingerRight')
    for (const id of touched('fingerLeft')) if (right.has(id)) return id
    return null
  }

  private grasp(id: string): void {
    const body = this.props.get(id)!
    const prop = this.scene.props.find((p) => p.id === id)!
    const hand = this.poseFor(this.angles, this.gap).hand
    const inverse = conjugateQuaternion(hand.rotation)
    const position = body.translation()
    const offset = {
      position: rotateVector(inverse, { x: position.x - hand.position.x, y: position.y - hand.position.y, z: position.z - hand.position.z }),
      rotation: multiplyQuaternions(inverse, body.rotation()),
    }
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true)
    this.held = { id, body, offset, queryShape: shrunkPropShape(prop) }
  }

  private release(): void {
    if (!this.held) return
    const { body } = this.held
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.held = null
  }

  private heldPose(hand: PartPose, held: Held): PartPose {
    const offset = rotateVector(hand.rotation, held.offset.position)
    return {
      position: { x: hand.position.x + offset.x, y: hand.position.y + offset.y, z: hand.position.z + offset.z },
      rotation: multiplyQuaternions(hand.rotation, held.offset.rotation),
    }
  }

  /** Distance from the fingertips to whatever the hand points at, capped at the sensor range. */
  private gripperDistance(): number {
    const { hand } = this.poseFor(this.angles, this.gap)
    const dir = rotateVector(hand.rotation, { x: 1, y: 0, z: 0 })
    const origin = {
      x: hand.position.x + dir.x * G.hand,
      y: hand.position.y + dir.y * G.hand,
      z: hand.position.z + dir.z * G.hand,
    }
    const heldHandle = this.held?.body.collider(0).handle
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, dir),
      G.distanceRange,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (collider) => !this.own.has(collider.handle) && collider.handle !== heldHandle,
    )
    return hit ? hit.timeOfImpact : G.distanceRange
  }

  private propIdOf(collider: RAPIER.Collider): string | null {
    const body = collider.parent()
    if (!body) return null
    for (const [id, prop] of this.props) if (prop.handle === body.handle) return id
    return null
  }
}

function shrunkPropShape(prop: PropDef): RAPIER.Shape {
  const shrink = (value: number) => Math.max(0.001, value - CLEARANCE)
  switch (prop.shape) {
    case 'box':
      return new RAPIER.Cuboid(shrink(prop.size.x / 2), shrink(prop.size.y / 2), shrink(prop.size.z / 2))
    case 'sphere':
      return new RAPIER.Ball(shrink(prop.size.x))
    case 'cylinder':
      return new RAPIER.Cylinder(shrink(prop.size.y / 2), shrink(prop.size.x))
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
