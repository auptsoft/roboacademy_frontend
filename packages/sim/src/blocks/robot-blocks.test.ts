import * as Blockly from 'blockly/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateCode, registerRobotBlocks } from './robot-blocks'

beforeAll(() => registerRobotBlocks())

function codeFor(state: object): string {
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state, workspace)
  const code = generateCode(workspace)
  workspace.dispose()
  return code
}

const num = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } })

describe('robot blocks', () => {
  it('generates robot API calls in robot units, with highlighting', () => {
    const code = codeFor({
      blocks: {
        blocks: [
          {
            type: 'robot_move',
            id: 'm1',
            inputs: { DISTANCE: num(30), SPEED: num(60) },
            next: {
              block: {
                type: 'robot_turn',
                id: 't1',
                fields: { DIRECTION: 'RIGHT' },
                inputs: { DEGREES: num(90), SPEED: num(40) },
                next: { block: { type: 'robot_wait', id: 'w1', inputs: { SECONDS: num(1.5) } } },
              },
            },
          },
        ],
      },
    })
    expect(code).toContain("highlightBlock('m1');\nmove(30, 60);")
    expect(code).toContain('turn(-(90), 40);')
    expect(code).toContain('wait((1.5) * 1000);')
  })

  it('puts a tick in every loop iteration and reads sensors in centimetres', () => {
    const code = codeFor({
      blocks: {
        blocks: [
          {
            type: 'controls_whileUntil',
            id: 'loop',
            fields: { MODE: 'WHILE' },
            inputs: {
              BOOL: {
                block: {
                  type: 'logic_compare',
                  fields: { OP: 'GT' },
                  inputs: {
                    A: { block: { type: 'robot_number_sensor', fields: { SENSOR: 'distance_front' } } },
                    B: { block: { type: 'math_number', fields: { NUM: 10 } } },
                  },
                },
              },
            },
          },
        ],
      },
    })
    expect(code).toMatch(/while \(\(readSensor\('distance_front'\) \* 100\) > 10\) \{\n\s+__tick\(\);/)
  })
})
