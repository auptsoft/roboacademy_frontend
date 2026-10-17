import { diffDrive, type WheeledSpec } from './diff-drive'
import type { RobotCapability } from './types'

/**
 * A bigger, slower four-wheel robot. It takes the same commands and has the same sensors as the
 * two-wheel robot, so every lesson language and block works with it unchanged; it turns more
 * slowly, needs more room, and its distance sensor sees further.
 */
export const roverWheels: WheeledSpec = {
  maxSpeed: 0.3,
  wheelBase: 0.22,
  distanceRange: 3,
  lineSensorOffset: { forward: 0.13, side: 0.04 },
}

export const rover: RobotCapability = {
  type: 'rover',
  label: 'Four-wheel rover',
  api: 'wheeled',
  size: { width: 0.26, length: 0.3, height: 0.12 },
  commands: diffDrive.commands,
  sensors: diffDrive.sensors,
}
