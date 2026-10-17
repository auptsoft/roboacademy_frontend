import type { RobotApi } from '../../robots/types'
import { PEN_COLORS } from '../../robots/pen'
import { RUNTIME_GLOBALS } from '../../runtime/protocol'

/**
 * The `robot` object JavaScript programs use: the same robot as the blocks, in the same units
 * (centimetres, degrees, seconds, % speed). It is a thin layer over the raw robot API the runtime
 * exposes (the capability files in packages/sim/src/robots), written in ES5 because it runs inside
 * the interpreter. Each robot API family has its own.
 */

export interface ApiEntry {
  /** As typed after `robot.`, e.g. `move`. */
  name: string
  /** Shown in autocomplete, e.g. `move(cm, speed?)`. */
  signature: string
  info: string
  /** Inserted on completion. */
  apply: string
  /** A command that can also be given through `start`, without waiting for it. */
  startable?: boolean
}

/** Marks a robot's startable commands, and adds `start` and its wait-until-done method. */
export function withStart(entries: ApiEntry[], startable: string[], waitName: string, startExample: string): ApiEntry[] {
  return [
    ...entries.map((entry) => (startable.includes(entry.name) ? { ...entry, startable: true } : entry)),
    {
      name: 'start',
      signature: 'start',
      info: `The same commands, without waiting for them to finish: robot.start.${startExample} lets the program carry on - with another robot, say - while this one moves.`,
      apply: 'start.',
    },
    { name: waitName, signature: `${waitName}()`, info: 'Wait until this robot has finished every command it was given.', apply: `${waitName}()` },
  ]
}

const WHEELED_JS_API: ApiEntry[] = [
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

const ARM_JS_API: ApiEntry[] = [
  { name: 'setBase', signature: 'setBase(degrees, speed?)', info: 'Turn the base to an angle (-180 to 180). Positive turns left.', apply: 'setBase(90)' },
  { name: 'setShoulder', signature: 'setShoulder(degrees, speed?)', info: 'Set the shoulder: 0 is along the floor, 90 straight up.', apply: 'setShoulder(90)' },
  { name: 'setElbow', signature: 'setElbow(degrees, speed?)', info: 'Set the elbow, from the upper arm: 0 is straight, negative bends down.', apply: 'setElbow(-90)' },
  { name: 'setWrist', signature: 'setWrist(degrees, speed?)', info: 'Set the wrist, from the forearm: 0 is straight, negative bends down.', apply: 'setWrist(-90)' },
  { name: 'reach', signature: 'reach(cm, heightCm, speed?)', info: 'Put the fingertips, pointing down, this far in front of the base and this high above the floor.', apply: 'reach(20, 5)' },
  { name: 'openGripper', signature: 'openGripper()', info: 'Open the gripper, letting go of anything it holds.', apply: 'openGripper()' },
  { name: 'closeGripper', signature: 'closeGripper()', info: 'Close the gripper. It holds a prop if one is between the fingers.', apply: 'closeGripper()' },
  { name: 'stop', signature: 'stop()', info: 'Stop the arm.', apply: 'stop()' },
  { name: 'wait', signature: 'wait(seconds)', info: 'Wait.', apply: 'wait(1)' },
  { name: 'baseAngle', signature: 'baseAngle()', info: 'The base angle, in degrees.', apply: 'baseAngle()' },
  { name: 'shoulderAngle', signature: 'shoulderAngle()', info: 'The shoulder angle, in degrees.', apply: 'shoulderAngle()' },
  { name: 'elbowAngle', signature: 'elbowAngle()', info: 'The elbow angle, in degrees.', apply: 'elbowAngle()' },
  { name: 'wristAngle', signature: 'wristAngle()', info: 'The wrist angle, in degrees.', apply: 'wristAngle()' },
  { name: 'holding', signature: 'holding()', info: 'True while the gripper holds something.', apply: 'holding()' },
  { name: 'gripperDistance', signature: 'gripperDistance()', info: 'Distance from the fingertips to whatever they point at, in cm.', apply: 'gripperDistance()' },
  { name: 'gripperX', signature: 'gripperX()', info: 'The fingertips\' x position, in cm.', apply: 'gripperX()' },
  { name: 'gripperZ', signature: 'gripperZ()', info: 'The fingertips\' z position, in cm.', apply: 'gripperZ()' },
  { name: 'gripperHeight', signature: 'gripperHeight()', info: 'The fingertips\' height above the floor, in cm.', apply: 'gripperHeight()' },
]

/** Every robot's pen, in a language's names; `penColor` lists the palette. */
export function penEntries(names: { down: string; up: string; color: string }, quote: string): ApiEntry[] {
  const colors = PEN_COLORS.map((color) => color.name).join(', ')
  return [
    { name: names.down, signature: `${names.down}()`, info: 'Put the pen down: the robot draws on the floor as it moves.', apply: `${names.down}()`, startable: true },
    { name: names.up, signature: `${names.up}()`, info: 'Lift the pen, to move without drawing.', apply: `${names.up}()`, startable: true },
    { name: names.color, signature: `${names.color}(color)`, info: `Change the pen's colour: ${colors}.`, apply: `${names.color}(${quote}red${quote})`, startable: true },
  ]
}

const JS_PEN = penEntries({ down: 'penDown', up: 'penUp', color: 'penColor' }, "'")

export const ROBOT_JS_API: Record<RobotApi, ApiEntry[]> = {
  wheeled: withStart([...WHEELED_JS_API, ...JS_PEN], ['move', 'turnLeft', 'turnRight', 'drive', 'setWheels', 'stop'], 'waitUntilDone', 'move(20)'),
  arm: withStart([...ARM_JS_API, ...JS_PEN], ['setBase', 'setShoulder', 'setElbow', 'setWrist', 'reach', 'openGripper', 'closeGripper', 'stop'], 'waitUntilDone', 'reach(20, 5)'),
}

/*
 * The prelude builds one object per robot from the raw robot functions, captured as arguments so
 * a learner who names their own function `move` can't break `robot.move`. Every robot object has
 * `start`, the same commands without waiting for them to finish, and `waitUntilDone()`. Sensor
 * readings are rounded to 0.1, so learners don't see floating-point noise like 27.500000000000004.
 */

const PEN_COLOR_NAMES = PEN_COLORS.map((color) => color.name)

const ROBOT_FACTORIES = `function speedOr(value) { return value === undefined ? 50 : value; }
  var PEN_COLORS = ${JSON.stringify(PEN_COLOR_NAMES)};
  function addPen(api, run) {
    api.penDown = function () { run('penDown'); };
    api.penUp = function () { run('penUp'); };
    api.penColor = function (color) {
      var index = PEN_COLORS.indexOf(String(color).toLowerCase());
      if (index < 0) throw new Error('There is no pen colour "' + color + '". Try ' + PEN_COLORS.join(', ') + '.');
      run('penColor', index);
    };
    return api;
  }
  function sensorOf(id) {
    return {
      read: function (name) { return readSensor(id, name); },
      cm: function (name) { return Math.round(readSensor(id, name) * 1000) / 10; }
    };
  }
  function withStart(id, commands) {
    var robot = commands(true);
    robot.start = commands(false);
    robot.waitUntilDone = function () { idle(id); };
    return robot;
  }
  function wheeled(id) {
    var s = sensorOf(id);
    var robot = withStart(id, function (wait) {
      function run(name, a, b, c) { command(id, wait, name, a, b, c); }
      var api = {
        move: function (distance, speed) { run('move', distance, speedOr(speed)); },
        turnLeft: function (degrees, speed) { run('turn', degrees, speedOr(speed)); },
        turnRight: function (degrees, speed) { run('turn', -degrees, speedOr(speed)); },
        drive: function (speed, seconds) { run('drive', speedOr(speed), seconds === undefined ? 0 : seconds * 1000); },
        setWheels: function (left, right) { run('setWheels', left, right); },
        stop: function () { run('stop'); }
      };
      if (wait) api.wait = function (seconds) { run('wait', seconds * 1000); };
      return addPen(api, run);
    });
    robot.frontDistance = function () { return s.cm('distance_front'); };
    robot.lineLeft = function () { return s.read('line_left'); };
    robot.lineRight = function () { return s.read('line_right'); };
    robot.x = function () { return s.cm('pos_x'); };
    robot.z = function () { return s.cm('pos_z'); };
    robot.heading = function () { return s.read('heading'); };
    return robot;
  }
  function arm(id) {
    var s = sensorOf(id);
    var robot = withStart(id, function (wait) {
      function run(name, a, b, c) { command(id, wait, name, a, b, c); }
      var api = {
        setBase: function (degrees, speed) { run('setBase', degrees, speedOr(speed)); },
        setShoulder: function (degrees, speed) { run('setShoulder', degrees, speedOr(speed)); },
        setElbow: function (degrees, speed) { run('setElbow', degrees, speedOr(speed)); },
        setWrist: function (degrees, speed) { run('setWrist', degrees, speedOr(speed)); },
        reach: function (distance, height, speed) { run('reach', distance, height, speedOr(speed)); },
        openGripper: function () { run('openGripper'); },
        closeGripper: function () { run('closeGripper'); },
        stop: function () { run('stop'); }
      };
      if (wait) api.wait = function (seconds) { run('wait', seconds * 1000); };
      return addPen(api, run);
    });
    robot.baseAngle = function () { return s.read('base_angle'); };
    robot.shoulderAngle = function () { return s.read('shoulder_angle'); };
    robot.elbowAngle = function () { return s.read('elbow_angle'); };
    robot.wristAngle = function () { return s.read('wrist_angle'); };
    robot.holding = function () { return s.read('holding'); };
    robot.gripperDistance = function () { return s.cm('gripper_distance'); };
    robot.gripperX = function () { return s.cm('gripper_x'); };
    robot.gripperZ = function () { return s.cm('gripper_z'); };
    robot.gripperHeight = function () { return s.cm('gripper_height'); };
    return robot;
  }`

/** A robot as the preludes need it. */
export interface PreludeRobot {
  id: string
  api: RobotApi
}

/** A scene with just the main robot, a two-wheeler. */
export const DEFAULT_PRELUDE_ROBOTS: PreludeRobot[] = [{ id: 'robot', api: 'wheeled' }]

function robotsPrelude(robots: PreludeRobot[]): string {
  // Robot ids are validated identifiers, so they can go straight into the code.
  const entries = robots.map(({ id, api }) => `${id}: ${api === 'arm' ? 'arm' : 'wheeled'}('${id}')`).join(', ')
  return `var robots = (function (command, readSensor, idle) {
  ${ROBOT_FACTORIES}
  return { ${entries} };
})(${RUNTIME_GLOBALS.robotCommand}, ${RUNTIME_GLOBALS.robotSensor}, ${RUNTIME_GLOBALS.robotIdle});
var robot = robots['${robots[0]?.id ?? 'robot'}'];
var waitForAll = (function (idle) { return function () { idle(''); }; })(${RUNTIME_GLOBALS.robotIdle});
`
}

const CONSOLE_PRELUDE = `var console = (function (print) {
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

/** Defines `robots` (one object per scene robot), `robot` (the main one), `waitForAll` and `console`. */
export function jsPrelude(robots: PreludeRobot[] = DEFAULT_PRELUDE_ROBOTS): string {
  return robotsPrelude(robots) + CONSOLE_PRELUDE
}
