import { PEN_COMMANDS } from './pen'
import type { RobotCapability } from './types'

/**
 * Drive and sensor geometry for a wheeled robot steered by its left and right wheel speeds. The
 * two-wheel robot and the rover share commands and sensors and differ only in these numbers.
 */
export interface WheeledSpec {
  /** Top wheel speed at 100 %, in metres per second. */
  maxSpeed: number
  /** Distance between the left and right wheels, in metres. Sets how fast opposite wheel speeds turn the robot. */
  wheelBase: number
  /** Range of the front distance sensor, in metres. Readings beyond it report this value. */
  distanceRange: number
  /** How far ahead of the robot's centre the two line sensors sit, and how far apart, in metres. */
  lineSensorOffset: { forward: number; side: number }
}

export const diffDriveWheels: WheeledSpec = {
  maxSpeed: 0.4,
  wheelBase: 0.16,
  distanceRange: 2,
  lineSensorOffset: { forward: 0.09, side: 0.03 },
}

export const diffDrive: RobotCapability = {
  type: 'diff-drive',
  label: 'Two-wheel robot',
  api: 'wheeled',
  size: { width: 0.18, length: 0.2, height: 0.1 },
  commands: [
    {
      name: 'move',
      label: 'move',
      params: [
        { name: 'distanceCm', label: 'distance', unit: 'cm', min: -500, max: 500, default: 20 },
        { name: 'speed', label: 'speed', unit: '%', min: 1, max: 100, default: 50 },
      ],
    },
    {
      name: 'turn',
      label: 'turn',
      params: [
        { name: 'degrees', label: 'angle', unit: '°', min: -360, max: 360, default: 90 },
        { name: 'speed', label: 'speed', unit: '%', min: 1, max: 100, default: 50 },
      ],
    },
    {
      name: 'drive',
      label: 'drive',
      params: [
        { name: 'speed', label: 'speed', unit: '%', min: -100, max: 100, default: 50 },
        // 0 means "keep driving until the next command".
        { name: 'durationMs', label: 'for', unit: 'ms', min: 0, max: 60_000, default: 0 },
      ],
    },
    {
      name: 'setWheels',
      label: 'set wheels',
      params: [
        { name: 'left', label: 'left', unit: '%', min: -100, max: 100, default: 50 },
        { name: 'right', label: 'right', unit: '%', min: -100, max: 100, default: 50 },
      ],
    },
    { name: 'stop', label: 'stop', params: [] },
    {
      name: 'wait',
      label: 'wait',
      params: [{ name: 'ms', label: 'for', unit: 'ms', min: 0, max: 60_000, default: 1000 }],
    },
    ...PEN_COMMANDS,
  ],
  sensors: [
    { name: 'distance_front', label: 'front distance', kind: 'number', unit: 'm' },
    { name: 'line_left', label: 'left line sensor', kind: 'boolean' },
    { name: 'line_right', label: 'right line sensor', kind: 'boolean' },
    { name: 'pos_x', label: 'position x', kind: 'number', unit: 'm', hideable: true },
    { name: 'pos_z', label: 'position z', kind: 'number', unit: 'm', hideable: true },
    { name: 'heading', label: 'heading', kind: 'number', unit: '°', hideable: true },
  ],
}
