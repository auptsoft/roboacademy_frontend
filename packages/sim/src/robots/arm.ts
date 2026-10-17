import { PEN_COMMANDS } from './pen'
import type { RobotCapability } from './types'

/**
 * A single robot arm on a fixed base: a turning base, three hinged joints in a vertical plane and
 * a two-finger gripper. Seen from the side, with the arm pointing forward: the shoulder is 0°
 * along the floor and 90° straight up; the elbow and wrist are measured from the link before
 * them, 0° straight on and negative bending down.
 */
export const ARM_GEOMETRY = {
  /** Height of the shoulder hinge above the floor, in metres. */
  shoulderHeight: 0.1,
  upperArm: 0.16,
  forearm: 0.14,
  /** Wrist hinge to fingertips. */
  hand: 0.1,
  fingerLength: 0.045,
  /** Thickness of each finger, across the gap. */
  finger: 0.012,
  /** Gap between the fingers, in metres. */
  gripperOpen: 0.07,
  gripperClosed: 0.004,
  /** Thickness of the arm's links. */
  link: 0.03,
  baseRadius: 0.07,
  baseHeight: 0.06,
  /** Joint speed at 100 %, in degrees per second. */
  maxJointSpeed: 90,
  /** Gripper opening and closing speed, in metres per second. */
  gripperSpeed: 0.1,
  /** Range of the gripper's distance sensor, which looks out past the fingertips. */
  distanceRange: 1,
}

const speed = { name: 'speed', label: 'speed', unit: '%', min: 1, max: 100, default: 50 }

export const arm: RobotCapability = {
  type: 'arm',
  label: 'Robot arm',
  api: 'arm',
  size: { width: 0.14, length: 0.14, height: 0.06 },
  gripper: true,
  joints: [
    { name: 'base', label: 'base', min: -180, max: 180, rest: 0 },
    { name: 'shoulder', label: 'shoulder', min: 0, max: 180, rest: 90 },
    { name: 'elbow', label: 'elbow', min: -150, max: 150, rest: -90 },
    { name: 'wrist', label: 'wrist', min: -120, max: 120, rest: -90 },
  ],
  commands: [
    { name: 'setBase', label: 'turn base to', params: [{ name: 'degrees', label: 'angle', unit: '°', min: -180, max: 180, default: 0 }, speed] },
    { name: 'setShoulder', label: 'set shoulder to', params: [{ name: 'degrees', label: 'angle', unit: '°', min: 0, max: 180, default: 90 }, speed] },
    { name: 'setElbow', label: 'set elbow to', params: [{ name: 'degrees', label: 'angle', unit: '°', min: -150, max: 150, default: -90 }, speed] },
    { name: 'setWrist', label: 'set wrist to', params: [{ name: 'degrees', label: 'angle', unit: '°', min: -120, max: 120, default: -90 }, speed] },
    {
      // Puts the fingertips, pointing straight down, at a distance in front of the base and a
      // height above the floor - the arm works out the joint angles.
      name: 'reach',
      label: 'reach',
      params: [
        { name: 'distanceCm', label: 'distance', unit: 'cm', min: 0, max: 50, default: 20 },
        { name: 'heightCm', label: 'height', unit: 'cm', min: 0, max: 50, default: 5 },
        speed,
      ],
    },
    { name: 'openGripper', label: 'open gripper', params: [] },
    { name: 'closeGripper', label: 'close gripper', params: [] },
    { name: 'stop', label: 'stop', params: [] },
    {
      name: 'wait',
      label: 'wait',
      params: [{ name: 'ms', label: 'for', unit: 'ms', min: 0, max: 60_000, default: 1000 }],
    },
    ...PEN_COMMANDS,
  ],
  sensors: [
    { name: 'base_angle', label: 'base angle', kind: 'number', unit: '°' },
    { name: 'shoulder_angle', label: 'shoulder angle', kind: 'number', unit: '°' },
    { name: 'elbow_angle', label: 'elbow angle', kind: 'number', unit: '°' },
    { name: 'wrist_angle', label: 'wrist angle', kind: 'number', unit: '°' },
    { name: 'holding', label: 'holding something', kind: 'boolean' },
    { name: 'gripper_distance', label: 'gripper distance', kind: 'number', unit: 'm' },
    { name: 'gripper_x', label: 'gripper x', kind: 'number', unit: 'm', hideable: true },
    { name: 'gripper_z', label: 'gripper z', kind: 'number', unit: 'm', hideable: true },
    { name: 'gripper_height', label: 'gripper height', kind: 'number', unit: 'm', hideable: true },
  ],
}
