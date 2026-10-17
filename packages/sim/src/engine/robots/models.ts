import type * as THREE from 'three'
import { arm } from '../../robots/arm'
import { diffDrive } from '../../robots/diff-drive'
import { rover } from '../../robots/rover'
import { buildArmModel } from './arm-model'
import { buildDiffDriveModel, buildRoverModel } from './wheeled-model'
import type { RobotState } from './types'

/**
 * How a robot type looks. The renderer places `object` at the robot's base transform each frame;
 * `update` poses anything that moves relative to the base, such as an arm's joints.
 */
export interface RobotModel {
  object: THREE.Object3D
  /** Height of the base's origin above the floor, for placing it before the first frame. */
  restHeight: number
  /** Its main colour, which its path is drawn in. */
  color: string
  update(state: RobotState): void
}

/** Options a scene sets per robot. */
export interface RobotLook {
  /** Body colour, overriding the type's own. */
  color?: string
}

const builders: Record<string, (look: RobotLook) => RobotModel> = {
  [diffDrive.type]: buildDiffDriveModel,
  [rover.type]: buildRoverModel,
  [arm.type]: buildArmModel,
}

export function buildRobotModel(type: string, look: RobotLook = {}): RobotModel {
  const build = builders[type]
  if (!build) throw new Error(`Unknown robot type "${type}"`)
  return build(look)
}
