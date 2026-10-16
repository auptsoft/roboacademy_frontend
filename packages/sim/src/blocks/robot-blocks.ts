import * as Blockly from 'blockly/core'
import 'blockly/blocks'
import { javascriptGenerator, Order } from 'blockly/javascript'
import * as En from 'blockly/msg/en'
import { RUNTIME_GLOBALS } from '../runtime/protocol'
import type { RobotCapability } from '../robots/types'

/**
 * Blocks for the two-wheel robot, and the JavaScript generator settings the program runtime
 * relies on. Blocks speak learner units (centimetres, seconds); the generated code converts to
 * the robot API's units.
 */

const MOTION_HUE = 210
const SENSOR_HUE = 160

/** Sensors the sensor blocks offer, per scene: hidden sensors are left out. */
let availableSensors: string[] = []

export function setAvailableSensors(capability: RobotCapability, hidden: string[]): void {
  availableSensors = capability.sensors.map((s) => s.name).filter((name) => !hidden.includes(name))
}

const NUMBER_SENSORS: [string, string, string][] = [
  // [label, sensor, generated expression]
  ['front distance (cm)', 'distance_front', `(${RUNTIME_GLOBALS.readSensor}('distance_front') * 100)`],
  ['position x (cm)', 'pos_x', `(${RUNTIME_GLOBALS.readSensor}('pos_x') * 100)`],
  ['position z (cm)', 'pos_z', `(${RUNTIME_GLOBALS.readSensor}('pos_z') * 100)`],
  ['heading (°)', 'heading', `${RUNTIME_GLOBALS.readSensor}('heading')`],
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
  ])

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
  gen.addReservedWords(
    [...Object.values(RUNTIME_GLOBALS), 'move', 'turn', 'drive', 'setWheels', 'stop', 'wait'].join(','),
  )
}

/** Generates runnable code from a workspace. */
export function generateCode(workspace: Blockly.Workspace): string {
  registerRobotBlocks()
  return javascriptGenerator.workspaceToCode(workspace)
}

const shadowNumber = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } })

/** The blocks toolbox for the two-wheel robot. */
export function robotToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: 'categoryToolbox',
    contents: [
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
