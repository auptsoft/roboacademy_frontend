import type * as Blockly from 'blockly/core'
import { robotToolbox } from '../../blocks/robot-blocks'

/** The robot toolbox without the robot: logic, loops, maths, text (with print) and variables. */
export function lessonToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  const toolbox = robotToolbox() as Blockly.utils.toolbox.ToolboxInfo
  return {
    ...toolbox,
    contents: toolbox.contents.filter(item => !('name' in item) || !['Motion', 'Sensors', 'Pen'].includes(String(item.name))),
  } as Blockly.utils.toolbox.ToolboxDefinition
}
