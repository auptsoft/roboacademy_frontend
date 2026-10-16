import * as Blockly from 'blockly/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateCode, registerRobotBlocks } from '../blocks/robot-blocks'
import { ProgramSession } from './program-session'
import type { HostToWorker, WorkerToHost } from './protocol'
import type { WorkerLike } from './run-controller'
import { runForOutput } from './run-output'

beforeAll(() => registerRobotBlocks())

/** The program worker, in-process (as in the compiler's tests). */
function fakeWorker(): WorkerLike {
  let terminated = false
  const worker: WorkerLike = {
    onmessage: null,
    postMessage(message: HostToWorker) {
      if (!terminated) setTimeout(() => !terminated && session.receive(message), 0)
    },
    terminate() {
      terminated = true
    },
  }
  const session = new ProgramSession((message: WorkerToHost) => {
    setTimeout(() => !terminated && worker.onmessage?.({ data: message } as MessageEvent<WorkerToHost>), 0)
  })
  return worker
}

const num = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } })

function blocksCode(state: object): string {
  const workspace = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(state, workspace)
  const code = generateCode(workspace)
  workspace.dispose()
  return code
}

describe('runForOutput', () => {
  it('runs JavaScript, prelude and all, and collects console.log output', async () => {
    const run = await runForOutput('javascript', 'for (let i = 1; i <= 3; i++) {\n  console.log(i)\n}\n', fakeWorker)

    expect(run).toEqual({ ok: true, output: '1\n2\n3' })
  })

  it('tells a JavaScript program that tries to drive that there is no robot', async () => {
    const run = await runForOutput('javascript', 'robot.move(10)\n', fakeWorker)

    expect(run.ok).toBe(false)
    expect(run.ok ? '' : run.error).toContain('no robot')
  })

  it('reports JavaScript syntax errors with their line', async () => {
    const run = await runForOutput('javascript', 'console.log(1)\nlet = ;\n', fakeWorker)

    expect(run).toMatchObject({ ok: false, line: 2 })
  })

  it('runs code generated from blocks: a loop that prints', async () => {
    const code = blocksCode({
      blocks: {
        blocks: [{
          type: 'controls_repeat_ext',
          id: 'r1',
          inputs: {
            TIMES: num(2),
            DO: { block: { type: 'text_print', id: 'p1', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'beep' } } } } } },
          },
        }],
      },
    })

    const run = await runForOutput('blocks', code, fakeWorker)

    expect(run).toEqual({ ok: true, output: 'beep\nbeep' })
  })
})
