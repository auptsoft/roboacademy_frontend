import type RAPIER from '@dimforge/rapier3d-compat'
import type { RobotCapability } from '../../robots'
import type { RobotPlacement, SceneDefinition, Vec2 } from '../../scene/types'
import type { CommandMotion } from '../commands'
import type { BodyTransform, RobotPose } from '../physics'

/**
 * The engine side of a robot type: its bodies in the physics world, how its commands move them
 * and how its sensors read them. The capability file (robots/) says what a robot can do; a driver
 * says how. Rendering lives in models.ts, so the headless engine never loads three.js.
 */
export interface RobotDriver {
  type: string
  create(context: RobotContext): RobotInstance
}

export interface RobotContext {
  world: RAPIER.World
  scene: SceneDefinition
  /** Where this robot starts. A scene can hold several robots, so not always `scene.robot`. */
  placement: RobotPlacement
  capability: RobotCapability
  /** The scene's props by id, for robots that can pick them up. */
  props: ReadonlyMap<string, RAPIER.RigidBody>
}

/** What the renderer needs to draw a robot: where its base is and how its joints are set. */
export interface RobotState {
  transform: BodyTransform
  /** Joint name → degrees. Empty for robots without joints. */
  joints: Record<string, number>
  /** Gap between the gripper's fingers, in metres, for robots with one. */
  gripper?: number
}

/** One robot in one run. Created after the arena, so it can see walls and props from the start. */
export interface RobotInstance {
  /** Colliders that belong to the robot: hits on them count as the robot's collisions. */
  readonly colliders: readonly RAPIER.Collider[]
  /**
   * Starts a command, with arguments already checked against the capability. Returns the motion
   * to step until it finishes, or null when the command took effect at once.
   */
  command(name: string, args: Record<string, number>): CommandMotion | null
  /** Stops every actuator, e.g. when a command is blocked or the run is stopped. */
  halt(): void
  /** Reads a sensor the capability declares. Hidden sensors are refused before this is called. */
  sensor(name: string): number | boolean
  /** Pushes actuator targets into the physics bodies. Called just before each world step. */
  beforeStep(): void
  /** Where the robot is on the floor, for the run summary and distance travelled. */
  pose(): RobotPose
  state(): RobotState
  /** Id of the prop the robot is holding, if it can hold one. */
  heldProp(): string | null
  /** Where the robot would draw its path on the floor right now, or null while it isn't touching it. */
  penPoint(): Vec2 | null
}
