import type { RobotApi } from '../../robots/types'
import { penEntries, withStart, type ApiEntry } from '../javascript/api'

/** The `robot` objects Python programs use (defined in runner.ts), for autocomplete. */
const WHEELED_PY_API: ApiEntry[] = [
  { name: 'move', signature: 'move(cm, speed=50)', info: 'Drive forwards (or backwards with a negative distance) and stop.', apply: 'move(20)' },
  { name: 'turn_left', signature: 'turn_left(degrees, speed=50)', info: 'Turn left on the spot.', apply: 'turn_left(90)' },
  { name: 'turn_right', signature: 'turn_right(degrees, speed=50)', info: 'Turn right on the spot.', apply: 'turn_right(90)' },
  { name: 'drive', signature: 'drive(speed=50, seconds=None)', info: 'Drive at a speed (-100 to 100). Without seconds it keeps going while the program continues.', apply: 'drive(50)' },
  { name: 'set_wheels', signature: 'set_wheels(left, right)', info: 'Set each wheel\'s speed (-100 to 100). Different speeds make the robot curve.', apply: 'set_wheels(50, 30)' },
  { name: 'stop', signature: 'stop()', info: 'Stop both wheels.', apply: 'stop()' },
  { name: 'wait', signature: 'wait(seconds)', info: 'Wait. The robot keeps doing what it was doing.', apply: 'wait(1)' },
  { name: 'front_distance', signature: 'front_distance()', info: 'Distance to the nearest thing ahead, in cm.', apply: 'front_distance()' },
  { name: 'line_left', signature: 'line_left()', info: 'True when the left line sensor is over a line.', apply: 'line_left()' },
  { name: 'line_right', signature: 'line_right()', info: 'True when the right line sensor is over a line.', apply: 'line_right()' },
  { name: 'x', signature: 'x()', info: 'The robot\'s x position, in cm.', apply: 'x()' },
  { name: 'z', signature: 'z()', info: 'The robot\'s z position, in cm.', apply: 'z()' },
  { name: 'heading', signature: 'heading()', info: 'Which way the robot faces, in degrees. 0 is along +x; turning left increases it.', apply: 'heading()' },
]

const ARM_PY_API: ApiEntry[] = [
  { name: 'set_base', signature: 'set_base(degrees, speed=50)', info: 'Turn the base to an angle (-180 to 180). Positive turns left.', apply: 'set_base(90)' },
  { name: 'set_shoulder', signature: 'set_shoulder(degrees, speed=50)', info: 'Set the shoulder: 0 is along the floor, 90 straight up.', apply: 'set_shoulder(90)' },
  { name: 'set_elbow', signature: 'set_elbow(degrees, speed=50)', info: 'Set the elbow, from the upper arm: 0 is straight, negative bends down.', apply: 'set_elbow(-90)' },
  { name: 'set_wrist', signature: 'set_wrist(degrees, speed=50)', info: 'Set the wrist, from the forearm: 0 is straight, negative bends down.', apply: 'set_wrist(-90)' },
  { name: 'reach', signature: 'reach(cm, height_cm, speed=50)', info: 'Put the fingertips, pointing down, this far in front of the base and this high above the floor.', apply: 'reach(20, 5)' },
  { name: 'open_gripper', signature: 'open_gripper()', info: 'Open the gripper, letting go of anything it holds.', apply: 'open_gripper()' },
  { name: 'close_gripper', signature: 'close_gripper()', info: 'Close the gripper. It holds a prop if one is between the fingers.', apply: 'close_gripper()' },
  { name: 'stop', signature: 'stop()', info: 'Stop the arm.', apply: 'stop()' },
  { name: 'wait', signature: 'wait(seconds)', info: 'Wait.', apply: 'wait(1)' },
  { name: 'base_angle', signature: 'base_angle()', info: 'The base angle, in degrees.', apply: 'base_angle()' },
  { name: 'shoulder_angle', signature: 'shoulder_angle()', info: 'The shoulder angle, in degrees.', apply: 'shoulder_angle()' },
  { name: 'elbow_angle', signature: 'elbow_angle()', info: 'The elbow angle, in degrees.', apply: 'elbow_angle()' },
  { name: 'wrist_angle', signature: 'wrist_angle()', info: 'The wrist angle, in degrees.', apply: 'wrist_angle()' },
  { name: 'holding', signature: 'holding()', info: 'True while the gripper holds something.', apply: 'holding()' },
  { name: 'gripper_distance', signature: 'gripper_distance()', info: 'Distance from the fingertips to whatever they point at, in cm.', apply: 'gripper_distance()' },
  { name: 'gripper_x', signature: 'gripper_x()', info: 'The fingertips\' x position, in cm.', apply: 'gripper_x()' },
  { name: 'gripper_z', signature: 'gripper_z()', info: 'The fingertips\' z position, in cm.', apply: 'gripper_z()' },
  { name: 'gripper_height', signature: 'gripper_height()', info: 'The fingertips\' height above the floor, in cm.', apply: 'gripper_height()' },
]

const PY_PEN = penEntries({ down: 'pen_down', up: 'pen_up', color: 'pen_color' }, '"')

export const ROBOT_PY_API: Record<RobotApi, ApiEntry[]> = {
  wheeled: withStart([...WHEELED_PY_API, ...PY_PEN], ['move', 'turn_left', 'turn_right', 'drive', 'set_wheels', 'stop'], 'wait_until_done', 'move(20)'),
  arm: withStart([...ARM_PY_API, ...PY_PEN], ['set_base', 'set_shoulder', 'set_elbow', 'set_wrist', 'reach', 'open_gripper', 'close_gripper', 'stop'], 'wait_until_done', 'reach(20, 5)'),
}
