/**
 * The `robot` object JavaScript programs use: the same robot as the blocks, in the same units
 * (centimetres, seconds, % speed). It is a thin layer over the raw robot API the runtime exposes
 * (packages/sim/src/robots/diff-drive.ts), written in ES5 because it runs inside the interpreter.
 */

export interface ApiEntry {
  /** As typed after `robot.`, e.g. `move`. */
  name: string
  /** Shown in autocomplete, e.g. `move(cm, speed?)`. */
  signature: string
  info: string
  /** Inserted on completion. */
  apply: string
}

export const ROBOT_JS_API: ApiEntry[] = [
  { name: 'move', signature: 'move(cm, speed?)', info: 'Drive forwards (or backwards with a negative distance) and stop.', apply: 'move(20)' },
  { name: 'turnLeft', signature: 'turnLeft(degrees, speed?)', info: 'Turn left on the spot.', apply: 'turnLeft(90)' },
  { name: 'turnRight', signature: 'turnRight(degrees, speed?)', info: 'Turn right on the spot.', apply: 'turnRight(90)' },
  { name: 'drive', signature: 'drive(speed, seconds?)', info: 'Drive at a speed (-100 to 100). Without seconds it keeps going while the program continues.', apply: 'drive(50)' },
  { name: 'setWheels', signature: 'setWheels(left, right)', info: 'Set each wheel\'s speed (-100 to 100). Different speeds make the robot curve.', apply: 'setWheels(50, 30)' },
  { name: 'stop', signature: 'stop()', info: 'Stop both wheels.', apply: 'stop()' },
  { name: 'wait', signature: 'wait(seconds)', info: 'Wait. The robot keeps doing what it was doing.', apply: 'wait(1)' },
  { name: 'frontDistance', signature: 'frontDistance()', info: 'Distance to the nearest thing ahead, in cm.', apply: 'frontDistance()' },
  { name: 'lineLeft', signature: 'lineLeft()', info: 'True when the left line sensor is over a line.', apply: 'lineLeft()' },
  { name: 'lineRight', signature: 'lineRight()', info: 'True when the right line sensor is over a line.', apply: 'lineRight()' },
  { name: 'x', signature: 'x()', info: 'The robot\'s x position, in cm.', apply: 'x()' },
  { name: 'z', signature: 'z()', info: 'The robot\'s z position, in cm.', apply: 'z()' },
  { name: 'heading', signature: 'heading()', info: 'Which way the robot faces, in degrees. 0 is along +x; turning left increases it.', apply: 'heading()' },
]

/**
 * Defines `robot` and `console`. The raw functions are captured as arguments, so a learner who
 * names their own function `move` can't break `robot.move`. Sensor readings are rounded to 0.1,
 * so learners don't see floating-point noise like 27.500000000000004.
 */
export const JS_PRELUDE = `var robot = (function (move, turn, drive, setWheels, stop, wait, readSensor) {
  function speedOr(value) { return value === undefined ? 50 : value; }
  function cm(sensor) { return Math.round(readSensor(sensor) * 1000) / 10; }
  return {
    move: function (distance, speed) { move(distance, speedOr(speed)); },
    turnLeft: function (degrees, speed) { turn(degrees, speedOr(speed)); },
    turnRight: function (degrees, speed) { turn(-degrees, speedOr(speed)); },
    drive: function (speed, seconds) { drive(speedOr(speed), seconds === undefined ? 0 : seconds * 1000); },
    setWheels: function (left, right) { setWheels(left, right); },
    stop: function () { stop(); },
    wait: function (seconds) { wait(seconds * 1000); },
    frontDistance: function () { return cm('distance_front'); },
    lineLeft: function () { return readSensor('line_left'); },
    lineRight: function () { return readSensor('line_right'); },
    x: function () { return cm('pos_x'); },
    z: function () { return cm('pos_z'); },
    heading: function () { return readSensor('heading'); }
  };
})(move, turn, drive, setWheels, stop, wait, readSensor);
var console = (function (print) {
  function show(value) {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  function log() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) parts.push(show(arguments[i]));
    print(parts.join(' '));
  }
  return { log: log, info: log, warn: log, error: log };
})(print);
`
