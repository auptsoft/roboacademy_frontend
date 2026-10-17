import RAPIER from '@dimforge/rapier3d-compat'
import type { RobotPlacement, SceneDefinition, Vec3 } from '../scene/types'
import type { RobotCapability } from '../robots'
import { DEG_TO_RAD, yawQuaternion } from './geometry'
import type { RobotDriver, RobotInstance } from './robots'

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

/** A robot to put in the world. */
export interface RobotSetup {
  id: string
  placement: RobotPlacement
  capability: RobotCapability
  driver: RobotDriver
}

/** Something a robot bumped into: an obstacle, a prop, or another robot. */
export interface Collision {
  robot: string
  name: string
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
  /** The scene's robots by id, in scene order. */
  readonly robots = new Map<string, RobotInstance>()
  /** Robot colliders, mapped to the robot they belong to. */
  private readonly robotColliders = new Map<number, string>()
  private readonly props = new Map<string, RAPIER.RigidBody>()
  /** Colliders the robot can bump into, mapped to a name for the run summary. */
  private readonly obstacleNames = new Map<number, string>()
  private collisions: Collision[] = []

  constructor(scene: SceneDefinition, robots: RobotSetup[]) {
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
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(prop.x, halfHeight, prop.z)
          .setLinearDamping(0.5)
          .setAngularDamping(0.5)
          // A fast robot arm could otherwise sweep straight through a small prop in one step.
          .setCcdEnabled(true),
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

    for (const { id, placement, capability, driver } of robots) {
      const robot = driver.create({ world: this.world, scene, placement, capability, props: this.props })
      this.robots.set(id, robot)
      for (const collider of robot.colliders) this.robotColliders.set(collider.handle, id)
    }

    // Ray casts only see colliders once the world has stepped. Step once with the robot at rest,
    // so a program that reads its sensors before moving gets real readings.
    this.world.step()
  }

  step(): void {
    for (const robot of this.robots.values()) robot.beforeStep()
    this.world.step(this.events)

    this.events.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return
      const robot1 = this.robotColliders.get(handle1)
      const robot2 = this.robotColliders.get(handle2)
      if (robot1 && robot2) {
        // Two robots meeting is one collision, counted against the first.
        if (robot1 !== robot2) this.collisions.push({ robot: robot1, name: `robot ${robot2}` })
        return
      }
      const robot = robot1 ?? robot2
      const name = this.obstacleNames.get(robot1 ? handle2 : handle1)
      if (robot && name) this.collisions.push({ robot, name })
    })
  }

  /** Collisions since the last call. */
  drainCollisions(): Collision[] {
    const drained = this.collisions
    this.collisions = []
    return drained
  }

  propTransforms(): Map<string, BodyTransform> {
    const result = new Map<string, BodyTransform>()
    for (const [id, body] of this.props) {
      result.set(id, { position: { ...body.translation() }, rotation: { ...body.rotation() } })
    }
    return result
  }

  dispose(): void {
    this.events.free()
    this.world.free()
  }
}
