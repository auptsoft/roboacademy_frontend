import * as Blockly from 'blockly/core'
import 'blockly/blocks'
import { javascriptGenerator, Order } from 'blockly/javascript'
import * as En from 'blockly/msg/en'
import { RUNTIME_GLOBALS } from '../runtime/protocol'
import { PEN_COLORS } from '../robots/pen'
import type { RobotApi, RobotCapability } from '../robots/types'

/**
 * Blocks for the wheeled robots and the robot arm, and the JavaScript generator settings the
 * program runtime relies on. Blocks speak learner units (centimetres, seconds); the generated code
 * converts to the robot API's units. Generated code calls the robot's commands by name, so each
 * toolbox only offers blocks for its own robot API family.
 */

const MOTION_HUE = 210
const ARM_HUE = 260
const SENSOR_HUE = 160
const ROBOTS_HUE = 20
const PEN_HUE = 330

/** A robot block programs can address. */
export interface BlockRobot {
  id: string
  capability: RobotCapability
}

/** Sensors the sensor blocks offer, per scene: hidden sensors are left out. */
let availableSensors: string[] = []
/** The scene's robots, for the "with robot" dropdown. */
let sceneRobotIds: string[] = ['robot']

export function setAvailableSensors(capability: RobotCapability, hidden: string[]): void {
  setSceneRobots([{ id: 'robot', capability }], hidden)
}

/** Points the blocks at a scene's robots: sensors any of them has, and their names. */
export function setSceneRobots(robots: BlockRobot[], hidden: string[]): void {
  availableSensors = [...new Set(robots.flatMap((robot) => robot.capability.sensors.map((s) => s.name)))].filter((name) => !hidden.includes(name))
  sceneRobotIds = robots.map((robot) => robot.id)
}

const NUMBER_SENSORS: [string, string, string][] = [
  // [label, sensor, generated expression]
  ['front distance (cm)', 'distance_front', `(${RUNTIME_GLOBALS.readSensor}('distance_front') * 100)`],
  ['position x (cm)', 'pos_x', `(${RUNTIME_GLOBALS.readSensor}('pos_x') * 100)`],
  ['position z (cm)', 'pos_z', `(${RUNTIME_GLOBALS.readSensor}('pos_z') * 100)`],
  ['heading (°)', 'heading', `${RUNTIME_GLOBALS.readSensor}('heading')`],
  ['base angle (°)', 'base_angle', `${RUNTIME_GLOBALS.readSensor}('base_angle')`],
  ['shoulder angle (°)', 'shoulder_angle', `${RUNTIME_GLOBALS.readSensor}('shoulder_angle')`],
  ['elbow angle (°)', 'elbow_angle', `${RUNTIME_GLOBALS.readSensor}('elbow_angle')`],
  ['wrist angle (°)', 'wrist_angle', `${RUNTIME_GLOBALS.readSensor}('wrist_angle')`],
  ['gripper distance (cm)', 'gripper_distance', `(${RUNTIME_GLOBALS.readSensor}('gripper_distance') * 100)`],
  ['gripper x (cm)', 'gripper_x', `(${RUNTIME_GLOBALS.readSensor}('gripper_x') * 100)`],
  ['gripper z (cm)', 'gripper_z', `(${RUNTIME_GLOBALS.readSensor}('gripper_z') * 100)`],
  ['gripper height (cm)', 'gripper_height', `(${RUNTIME_GLOBALS.readSensor}('gripper_height') * 100)`],
]

const ARM_JOINTS: [string, string][] = [
  ['base', 'setBase'],
  ['shoulder', 'setShoulder'],
  ['elbow', 'setElbow'],
  ['wrist', 'setWrist'],
]

/** Robot commands generated code calls by name, so learners' variables can't shadow them. */
const COMMAND_NAMES = [
  'move', 'turn', 'drive', 'setWheels', 'stop', 'wait', 'reach', 'openGripper', 'closeGripper', 'penDown', 'penUp', 'penColor',
  ...ARM_JOINTS.map(([, command]) => command),
]

const LINE_SENSORS: [string, string][] = [
  ['left', 'line_left'],
  ['right', 'line_right'],
]

let registered = false

/** Registers the robot blocks and configures the generator. Safe to call more than once. */
export function registerRobotBlocks(): void {
  if (registered) return
  registered = true

  Blockly.setLocale(En as unknown as Record<string, string>)

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'robot_move',
      message0: 'move %1 cm at speed %2 %%',
      args0: [
        { type: 'input_value', name: 'DISTANCE', check: 'Number' },
        { type: 'input_value', name: 'SPEED', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MOTION_HUE,
      tooltip: 'Drive forwards (or backwards, with a negative distance) and stop.',
    },
    {
      type: 'robot_turn',
      message0: 'turn %1 by %2 ° at speed %3 %%',
      args0: [
        { type: 'field_dropdown', name: 'DIRECTION', options: [['left', 'LEFT'], ['right', 'RIGHT']] },
        { type: 'input_value', name: 'DEGREES', check: 'Number' },
        { type: 'input_value', name: 'SPEED', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MOTION_HUE,
      tooltip: 'Turn on the spot.',
    },
    {
      type: 'robot_drive',
      message0: 'drive at speed %1 %%',
      args0: [{ type: 'input_value', name: 'SPEED', check: 'Number' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MOTION_HUE,
      tooltip: 'Start driving and keep going while the next blocks run. Negative speeds drive backwards.',
    },
    {
      type: 'robot_drive_for',
      message0: 'drive at speed %1 %% for %2 seconds',
      args0: [
        { type: 'input_value', name: 'SPEED', check: 'Number' },
        { type: 'input_value', name: 'SECONDS', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MOTION_HUE,
      tooltip: 'Drive for a while, then stop.',
    },
    {
      type: 'robot_set_wheels',
      message0: 'set wheels left %1 %% right %2 %%',
      args0: [
        { type: 'input_value', name: 'LEFT', check: 'Number' },
        { type: 'input_value', name: 'RIGHT', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MOTION_HUE,
      tooltip: 'Set each wheel\'s speed. Different speeds make the robot curve.',
    },
    {
      type: 'robot_stop',
      message0: 'stop',
      previousStatement: null,
      nextStatement: null,
      colour: MOTION_HUE,
      tooltip: 'Stop both wheels.',
    },
    {
      type: 'robot_wait',
      message0: 'wait %1 seconds',
      args0: [{ type: 'input_value', name: 'SECONDS', check: 'Number' }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: MOTION_HUE,
      tooltip: 'Wait. The robot keeps doing what it was doing.',
    },
    {
      type: 'robot_line_sensor',
      message0: '%1 line sensor sees a line',
      args0: [{ type: 'field_dropdown', name: 'SENSOR', options: LINE_SENSORS }],
      output: 'Boolean',
      colour: SENSOR_HUE,
      tooltip: 'True when the sensor is over a line on the floor.',
    },
    {
      type: 'robot_arm_joint',
      message0: 'set %1 to %2 ° at speed %3 %%',
      args0: [
        { type: 'field_dropdown', name: 'JOINT', options: ARM_JOINTS.map(([label, command]) => [label, command]) },
        { type: 'input_value', name: 'DEGREES', check: 'Number' },
        { type: 'input_value', name: 'SPEED', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: ARM_HUE,
      tooltip: 'Turn one joint to an angle. Base: positive turns left. Shoulder: 0 is along the floor, 90 is straight up. Elbow and wrist: 0 is straight, negative bends down.',
    },
    {
      type: 'robot_arm_reach',
      message0: 'reach %1 cm out, %2 cm high at speed %3 %%',
      args0: [
        { type: 'input_value', name: 'DISTANCE', check: 'Number' },
        { type: 'input_value', name: 'HEIGHT', check: 'Number' },
        { type: 'input_value', name: 'SPEED', check: 'Number' },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: ARM_HUE,
      tooltip: 'Put the fingertips, pointing down, this far in front of the base and this high above the floor.',
    },
    {
      type: 'robot_arm_gripper',
      message0: '%1 gripper',
      args0: [{ type: 'field_dropdown', name: 'ACTION', options: [['close', 'CLOSE'], ['open', 'OPEN']] }],
      previousStatement: null,
      nextStatement: null,
      colour: ARM_HUE,
      tooltip: 'Closing holds a prop if one is between the fingers. Opening lets go.',
    },
    {
      type: 'robot_arm_stop',
      message0: 'stop',
      previousStatement: null,
      nextStatement: null,
      colour: ARM_HUE,
      tooltip: 'Stop the arm.',
    },
    {
      type: 'robot_arm_holding',
      message0: 'gripper is holding something',
      output: 'Boolean',
      colour: SENSOR_HUE,
      tooltip: 'True while the gripper holds a prop.',
    },
    {
      type: 'robot_pen',
      message0: 'pen %1',
      args0: [{ type: 'field_dropdown', name: 'STATE', options: [['down', 'DOWN'], ['up', 'UP']] }],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Pen down draws on the floor as the robot moves; pen up stops drawing.',
    },
    {
      type: 'robot_pen_color',
      message0: 'set pen colour to %1',
      args0: [{ type: 'field_dropdown', name: 'COLOR', options: PEN_COLORS.map((color, i) => [color.name, String(i)]) }],
      previousStatement: null,
      nextStatement: null,
      colour: PEN_HUE,
      tooltip: 'Draw in another colour from now on.',
    },
    {
      type: 'robot_together',
      message0: 'at the same time %1 %2',
      args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: ROBOTS_HUE,
      tooltip: 'Robot blocks inside start without waiting for each other, so different robots move together. Afterwards, waits until every robot is done.',
    },
  ])

  // The robot dropdown lists the scene's robots, so it's defined in code like the number sensor.
  Blockly.Blocks['robot_use'] = {
    init(this: Blockly.Block) {
      const options = (): [string, string][] => sceneRobotIds.map((id) => [id, id])
      this.appendDummyInput().appendField('with robot').appendField(new Blockly.FieldDropdown(options), 'ROBOT')
      this.appendStatementInput('DO')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(ROBOTS_HUE)
      this.setTooltip('Robot blocks inside control this robot, and sensor blocks read its sensors.')
    },
  }

  // The number sensor's options depend on the scene (some sensors can be hidden), so it is
  // defined in code with a dropdown that reads the current list.
  Blockly.Blocks['robot_number_sensor'] = {
    init(this: Blockly.Block) {
      const options = (): [string, string][] => {
        const visible = NUMBER_SENSORS.filter(([, sensor]) => availableSensors.includes(sensor))
        return (visible.length ? visible : NUMBER_SENSORS.slice(0, 1)).map(([label, sensor]) => [label, sensor])
      }
      this.appendDummyInput().appendField(new Blockly.FieldDropdown(options), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(SENSOR_HUE)
      this.setTooltip('A sensor reading.')
    },
  }

  const gen = javascriptGenerator
  const num = (block: Blockly.Block, name: string, fallback: string) => gen.valueToCode(block, name, Order.NONE) || fallback

  gen.forBlock['robot_move'] = (block) => `move(${num(block, 'DISTANCE', '0')}, ${num(block, 'SPEED', '50')});\n`
  gen.forBlock['robot_turn'] = (block) => {
    const sign = block.getFieldValue('DIRECTION') === 'RIGHT' ? '-' : ''
    return `turn(${sign}(${num(block, 'DEGREES', '90')}), ${num(block, 'SPEED', '50')});\n`
  }
  gen.forBlock['robot_drive'] = (block) => `drive(${num(block, 'SPEED', '50')}, 0);\n`
  gen.forBlock['robot_drive_for'] = (block) =>
    `drive(${num(block, 'SPEED', '50')}, (${num(block, 'SECONDS', '1')}) * 1000);\n`
  gen.forBlock['robot_set_wheels'] = (block) => `setWheels(${num(block, 'LEFT', '0')}, ${num(block, 'RIGHT', '0')});\n`
  gen.forBlock['robot_stop'] = () => 'stop();\n'
  gen.forBlock['robot_wait'] = (block) => `wait((${num(block, 'SECONDS', '1')}) * 1000);\n`
  gen.forBlock['robot_line_sensor'] = (block) => [
    `${RUNTIME_GLOBALS.readSensor}('${block.getFieldValue('SENSOR') === 'line_right' ? 'line_right' : 'line_left'}')`,
    Order.FUNCTION_CALL,
  ]
  gen.forBlock['robot_arm_joint'] = (block) => {
    const command = ARM_JOINTS.find(([, name]) => name === block.getFieldValue('JOINT'))?.[1] ?? 'setBase'
    return `${command}(${num(block, 'DEGREES', '0')}, ${num(block, 'SPEED', '50')});\n`
  }
  gen.forBlock['robot_arm_reach'] = (block) =>
    `reach(${num(block, 'DISTANCE', '20')}, ${num(block, 'HEIGHT', '5')}, ${num(block, 'SPEED', '50')});\n`
  gen.forBlock['robot_arm_gripper'] = (block) => (block.getFieldValue('ACTION') === 'OPEN' ? 'openGripper();\n' : 'closeGripper();\n')
  gen.forBlock['robot_arm_stop'] = () => 'stop();\n'
  gen.forBlock['robot_pen'] = (block) => (block.getFieldValue('STATE') === 'UP' ? 'penUp();\n' : 'penDown();\n')
  gen.forBlock['robot_pen_color'] = (block) => {
    const index = Number(block.getFieldValue('COLOR'))
    return `penColor(${Number.isInteger(index) && PEN_COLORS[index] ? index : 0});\n`
  }
  gen.forBlock['robot_arm_holding'] = () => [`${RUNTIME_GLOBALS.readSensor}('holding')`, Order.FUNCTION_CALL]
  // Each sets a runtime switch and puts it back afterwards, even if the blocks inside fail, so
  // these blocks nest.
  const scoped = (block: Blockly.Block, set: string, value: string, after = '') => {
    const previous = gen.nameDB_!.getDistinctName('previous', Blockly.Names.NameType.VARIABLE)
    const body = gen.statementToCode(block, 'DO')
    return `var ${previous} = ${set}(${value});\ntry {\n${body}} finally {\n${gen.INDENT}${set}(${previous});\n}\n${after}`
  }
  gen.forBlock['robot_use'] = (block) => {
    const id = String(block.getFieldValue('ROBOT') ?? 'robot').replace(/[^a-z0-9_]/g, '')
    return scoped(block, RUNTIME_GLOBALS.useRobot, `'${id}'`)
  }
  gen.forBlock['robot_together'] = (block) =>
    scoped(block, RUNTIME_GLOBALS.together, 'true', `${RUNTIME_GLOBALS.robotIdle}('');\n`)
  gen.forBlock['robot_number_sensor'] = (block) => {
    const entry = NUMBER_SENSORS.find(([, sensor]) => sensor === block.getFieldValue('SENSOR')) ?? NUMBER_SENSORS[0]!
    return [entry[2], Order.FUNCTION_CALL]
  }
  // `print` goes to the run's output panel, not window.alert.
  gen.forBlock['text_print'] = (block) => `${RUNTIME_GLOBALS.print}(${gen.valueToCode(block, 'TEXT', Order.NONE) || "''"});\n`

  // Every statement reports itself, so the editor can highlight the running block and errors can
  // point at the block that caused them.
  gen.STATEMENT_PREFIX = `${RUNTIME_GLOBALS.highlight}(%1);\n`
  // Every loop iteration waits for the next physics step. Loops then advance simulated time
  // instead of spinning, and "wait until the sensor sees a line" works as learners expect.
  gen.INFINITE_LOOP_TRAP = `${RUNTIME_GLOBALS.tick}();\n`
  gen.addReservedWords([...Object.values(RUNTIME_GLOBALS), ...COMMAND_NAMES].join(','))
}

/** Generates runnable code from a workspace. */
export function generateCode(workspace: Blockly.Workspace): string {
  registerRobotBlocks()
  return javascriptGenerator.workspaceToCode(workspace)
}

const shadowNumber = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } })

const WHEELED_CATEGORIES = [
  {
    kind: 'category',
    name: 'Motion',
    colour: String(MOTION_HUE),
    contents: [
      { kind: 'block', type: 'robot_move', inputs: { DISTANCE: shadowNumber(20), SPEED: shadowNumber(50) } },
      { kind: 'block', type: 'robot_turn', inputs: { DEGREES: shadowNumber(90), SPEED: shadowNumber(50) } },
      { kind: 'block', type: 'robot_drive', inputs: { SPEED: shadowNumber(50) } },
      { kind: 'block', type: 'robot_drive_for', inputs: { SPEED: shadowNumber(50), SECONDS: shadowNumber(1) } },
      { kind: 'block', type: 'robot_set_wheels', inputs: { LEFT: shadowNumber(50), RIGHT: shadowNumber(30) } },
      { kind: 'block', type: 'robot_stop' },
      { kind: 'block', type: 'robot_wait', inputs: { SECONDS: shadowNumber(1) } },
    ],
  },
  {
    kind: 'category',
    name: 'Sensors',
    colour: String(SENSOR_HUE),
    contents: [
      { kind: 'block', type: 'robot_number_sensor' },
      { kind: 'block', type: 'robot_line_sensor' },
    ],
  },
]

const ARM_CATEGORIES = [
  {
    kind: 'category',
    // The same name as the wheeled robots' category, so lesson toolboxes can leave it out alike.
    name: 'Motion',
    colour: String(ARM_HUE),
    contents: [
      { kind: 'block', type: 'robot_arm_reach', inputs: { DISTANCE: shadowNumber(20), HEIGHT: shadowNumber(5), SPEED: shadowNumber(50) } },
      { kind: 'block', type: 'robot_arm_joint', inputs: { DEGREES: shadowNumber(90), SPEED: shadowNumber(50) } },
      { kind: 'block', type: 'robot_arm_gripper' },
      { kind: 'block', type: 'robot_arm_stop' },
      { kind: 'block', type: 'robot_wait', inputs: { SECONDS: shadowNumber(1) } },
    ],
  },
  {
    kind: 'category',
    name: 'Sensors',
    colour: String(SENSOR_HUE),
    contents: [
      { kind: 'block', type: 'robot_number_sensor' },
      { kind: 'block', type: 'robot_arm_holding' },
    ],
  },
]

const PEN_CATEGORY = {
  kind: 'category',
  name: 'Pen',
  colour: String(PEN_HUE),
  contents: [
    { kind: 'block', type: 'robot_pen', fields: { STATE: 'DOWN' } },
    { kind: 'block', type: 'robot_pen', fields: { STATE: 'UP' } },
    { kind: 'block', type: 'robot_pen_color' },
  ],
}

const ROBOTS_CATEGORY = {
  kind: 'category',
  name: 'Robots',
  colour: String(ROBOTS_HUE),
  contents: [
    { kind: 'block', type: 'robot_use' },
    { kind: 'block', type: 'robot_together' },
  ],
}

/**
 * The blocks toolbox for a scene's robots: the motion blocks of each API family present, one set
 * of sensor blocks, and - with more than one robot - the blocks that choose and combine them.
 */
export function robotToolbox(apis: RobotApi | RobotApi[] = 'wheeled', multiRobot = false): Blockly.utils.toolbox.ToolboxDefinition {
  const families = new Set(Array.isArray(apis) ? apis : [apis])
  const both = families.has('wheeled') && families.has('arm')
  const motion = [
    ...(families.has('wheeled') ? [both ? { ...WHEELED_CATEGORIES[0]!, name: 'Driving' } : WHEELED_CATEGORIES[0]!] : []),
    ...(families.has('arm') ? [both ? { ...ARM_CATEGORIES[0]!, name: 'Arm' } : ARM_CATEGORIES[0]!] : []),
  ]
  const sensorBlocks = [
    { kind: 'block', type: 'robot_number_sensor' },
    ...(families.has('wheeled') ? [{ kind: 'block', type: 'robot_line_sensor' }] : []),
    ...(families.has('arm') ? [{ kind: 'block', type: 'robot_arm_holding' }] : []),
  ]
  return {
    kind: 'categoryToolbox',
    contents: [
      ...motion,
      { kind: 'category', name: 'Sensors', colour: String(SENSOR_HUE), contents: sensorBlocks },
      PEN_CATEGORY,
      ...(multiRobot ? [ROBOTS_CATEGORY] : []),
      {
        kind: 'category',
        name: 'Logic',
        categorystyle: 'logic_category',
        contents: [
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_negate' },
          { kind: 'block', type: 'logic_boolean' },
        ],
      },
      {
        kind: 'category',
        name: 'Loops',
        categorystyle: 'loop_category',
        contents: [
          { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadowNumber(4) } },
          { kind: 'block', type: 'controls_whileUntil' },
          {
            kind: 'block',
            type: 'controls_for',
            inputs: { FROM: shadowNumber(1), TO: shadowNumber(10), BY: shadowNumber(1) },
          },
          { kind: 'block', type: 'controls_flow_statements' },
        ],
      },
      {
        kind: 'category',
        name: 'Math',
        categorystyle: 'math_category',
        contents: [
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'math_arithmetic' },
          { kind: 'block', type: 'math_single' },
          { kind: 'block', type: 'math_round' },
          { kind: 'block', type: 'math_modulo' },
          { kind: 'block', type: 'math_random_int', inputs: { FROM: shadowNumber(1), TO: shadowNumber(100) } },
        ],
      },
      {
        kind: 'category',
        name: 'Output',
        categorystyle: 'text_category',
        contents: [
          { kind: 'block', type: 'text_print', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'hello' } } } } },
          { kind: 'block', type: 'text' },
        ],
      },
      { kind: 'category', name: 'Variables', categorystyle: 'variable_category', custom: 'VARIABLE' },
      { kind: 'category', name: 'Functions', categorystyle: 'procedure_category', custom: 'PROCEDURE' },
    ],
  }
}
