import type { RobotApi } from '../../robots/types'
import { penEntries, withStart, type ApiEntry } from '../javascript/api'
import { ROBOT_PY_API } from '../python/api'

/** The `robot` tables Lua programs use (defined in prelude.ts), for autocomplete. */
const WHEELED_LUA_API: ApiEntry[] = [
  { name: 'move', signature: 'move(cm, speed)', info: 'Drive forwards (or backwards with a negative distance) and stop. Speed defaults to 50.', apply: 'move(20)' },
  { name: 'turn_left', signature: 'turn_left(degrees, speed)', info: 'Turn left on the spot.', apply: 'turn_left(90)' },
  { name: 'turn_right', signature: 'turn_right(degrees, speed)', info: 'Turn right on the spot.', apply: 'turn_right(90)' },
  { name: 'drive', signature: 'drive(speed, seconds)', info: 'Drive at a speed (-100 to 100). Without seconds it keeps going while the program continues.', apply: 'drive(50)' },
  { name: 'set_wheels', signature: 'set_wheels(left, right)', info: 'Set each wheel\'s speed (-100 to 100). Different speeds make the robot curve.', apply: 'set_wheels(50, 30)' },
  { name: 'stop', signature: 'stop()', info: 'Stop both wheels.', apply: 'stop()' },
  { name: 'wait', signature: 'wait(seconds)', info: 'Wait. The robot keeps doing what it was doing.', apply: 'wait(1)' },
  { name: 'front_distance', signature: 'front_distance()', info: 'Distance to the nearest thing ahead, in cm.', apply: 'front_distance()' },
  { name: 'line_left', signature: 'line_left()', info: 'true when the left line sensor is over a line.', apply: 'line_left()' },
  { name: 'line_right', signature: 'line_right()', info: 'true when the right line sensor is over a line.', apply: 'line_right()' },
  { name: 'x', signature: 'x()', info: 'The robot\'s x position, in cm.', apply: 'x()' },
  { name: 'z', signature: 'z()', info: 'The robot\'s z position, in cm.', apply: 'z()' },
  { name: 'heading', signature: 'heading()', info: 'Which way the robot faces, in degrees. 0 is along +x; turning left increases it.', apply: 'heading()' },
]

/** The arm's Lua names match Python's; only the optional arguments read differently. */
const ARM_LUA_API: ApiEntry[] = ROBOT_PY_API.arm.map((entry) => ({
  ...entry,
  signature: entry.signature.replace(/=\d+/g, '').replace('height_cm', 'height'),
  info: entry.info.replace(/^True/, 'true'),
}))

export const ROBOT_LUA_API: Record<RobotApi, ApiEntry[]> = {
  wheeled: withStart([...WHEELED_LUA_API, ...penEntries({ down: 'pen_down', up: 'pen_up', color: 'pen_color' }, '"')], ['move', 'turn_left', 'turn_right', 'drive', 'set_wheels', 'stop'], 'wait_until_done', 'move(20)'),
  // Derived from Python's, which already has `start` and `wait_until_done`.
  arm: ARM_LUA_API,
}
