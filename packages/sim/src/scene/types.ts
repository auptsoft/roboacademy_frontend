/**
 * Scene definition, version 1.
 *
 * Coordinates: metres, Y up, the arena floor at y = 0 and centred on the origin. Seen from above,
 * +X points right and +Z points down the screen. Headings are degrees, 0 facing +X, positive
 * counter-clockwise seen from above - so `turn(90)` is a left turn.
 */

import { DEFAULT_ROBOT_ID } from '../grading/types'

export interface Vec2 {
  x: number
  z: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface WallDef {
  id: string
  /** Centre of the wall on the floor. */
  x: number
  z: number
  length: number
  thickness: number
  height: number
  /** Rotation about Y, degrees, same convention as headings. 0 runs along X. */
  rotationDeg: number
}

export interface ZoneDef {
  id: string
  label?: string
  /** Axis-aligned rectangle on the floor. */
  center: Vec2
  size: Vec2
  color: string
}

export interface LineDef {
  id: string
  points: Vec2[]
  /** Line width in metres. */
  width: number
  color: string
}

export type PropShape = 'box' | 'sphere' | 'cylinder'

export interface PropDef {
  id: string
  shape: PropShape
  x: number
  z: number
  /** box: x/y/z extents; sphere: x is the radius; cylinder: x radius, y height. */
  size: Vec3
  color: string
  /** Kilograms. */
  mass: number
}

export interface RobotPlacement {
  type: string
  start: Vec2 & { headingDeg: number }
  /** Body colour, so robots of the same type can be told apart. Defaults to the type's own. */
  color?: string
}

/** A robot besides the scene's main one. Programs reach it as `robots.<id>`. */
export interface SceneRobot extends RobotPlacement {
  id: string
}

export interface SceneDefinition {
  version: 1
  arena: { width: number; depth: number; floorColor: string }
  /** The main robot: `robot` in programs, and `robots.robot`. */
  robot: RobotPlacement
  /** More robots, each programmed through its id. */
  robots?: SceneRobot[]
  walls: WallDef[]
  zones: ZoneDef[]
  lines: LineDef[]
  props: PropDef[]
  /** Sensor names the program may not read in this scene (only `hideable` ones). */
  hiddenSensors: string[]
  /** Run time limit in simulated seconds. */
  timeLimitSec: number
}

export const DEFAULT_TIME_LIMIT_SEC = 120

/** Every robot in a scene, the main one first, with the id `robot`. */
export function sceneRobots(scene: SceneDefinition): SceneRobot[] {
  return [{ id: DEFAULT_ROBOT_ID, ...scene.robot }, ...(scene.robots ?? [])]
}

export function emptyScene(robotType = 'diff-drive'): SceneDefinition {
  return {
    version: 1,
    arena: { width: 3, depth: 2, floorColor: '#e8edf2' },
    robot: { type: robotType, start: { x: -1, z: 0, headingDeg: 0 } },
    walls: [],
    zones: [],
    lines: [],
    props: [],
    hiddenSensors: [],
    timeLimitSec: DEFAULT_TIME_LIMIT_SEC,
  }
}
