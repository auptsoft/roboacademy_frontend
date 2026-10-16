import type { ApiEntry } from '../javascript/api'

/** The `robot` object Python programs use (defined in runner.ts), for autocomplete. */
export const ROBOT_PY_API: ApiEntry[] = [
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
