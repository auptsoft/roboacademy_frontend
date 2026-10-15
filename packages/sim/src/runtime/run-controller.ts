import type { GradingResult } from '../grading/types'
import { CommandError } from '../engine/commands'
import { PHYSICS_STEP_SEC } from '../engine/physics'
import type { RunOutcome, RunSummary, Simulation } from '../engine/simulation'
import type { HostToWorker, WorkerToHost } from './protocol'

const STEP_MS = PHYSICS_STEP_SEC * 1000
/** Steps allowed per call to `advance`, so a slow frame doesn't turn into a burst. */
const MAX_STEPS_PER_ADVANCE = 8
/** Simulated time the world keeps running after the program ends, so things come to rest. */
const SETTLE_MS = 500
/** Real time a program may compute without waiting on the robot before it is stopped. */
const COMPUTE_LIMIT_MS = 3000

export interface WorkerLike {
  postMessage(message: HostToWorker): void
  terminate(): void
  onmessage: ((event: MessageEvent<WorkerToHost>) => void) | null
}

export interface RunResult {
  outcome: RunOutcome
  grading: GradingResult | null
  summary: RunSummary
}

export interface RunCallbacks {
  onHighlight?: (blockId: string) => void
  onPrint?: (text: string) => void
  onEnd: (result: RunResult) => void
}

type ProgramState = 'computing' | 'waiting' | 'finished'

/**
 * Runs a program against a simulation, in lockstep: simulated time only advances while the
 * program is waiting on the robot (a command, `wait`, or a loop iteration's tick), never while it
 * computes. A run therefore plays out the same way however fast the device or the worker is.
 *
 * Drive it by calling `advance` with real elapsed time, e.g. once per animation frame.
 */
export class RunController {
  private worker: WorkerLike | null = null
  private program: ProgramState = 'computing'
  private ended = false
  private accumulatorMs = 0
  private settleRemainingMs = SETTLE_MS
  private computingSinceMs = 0
  private lastBlockId: string | null = null

  private readonly sim: Simulation
  private readonly createWorker: () => WorkerLike
  private readonly callbacks: RunCallbacks
  private readonly now: () => number

  constructor(
    sim: Simulation,
    createWorker: () => WorkerLike,
    callbacks: RunCallbacks,
    now: () => number = () => performance.now(),
  ) {
    this.sim = sim
    this.createWorker = createWorker
    this.callbacks = callbacks
    this.now = now
  }

  get isEnded(): boolean {
    return this.ended
  }

  start(code: string): void {
    const worker = this.createWorker()
    this.worker = worker
    worker.onmessage = (event) => this.onWorkerMessage(event.data)
    this.program = 'computing'
    this.computingSinceMs = this.now()
    worker.postMessage({
      type: 'start',
      code,
      commands: this.sim.capability.commands.map((c) => ({ name: c.name, params: c.params.map((p) => p.name) })),
    })
  }

  /** Advances simulated time by up to `realMs` (times `speed`), as far as the program allows. */
  advance(realMs: number, speed = 1): void {
    if (this.ended) return

    if (this.program === 'computing') {
      // Don't let real time pile up while the program computes, or the world would jump ahead
      // once it resumes.
      this.accumulatorMs = 0
      if (this.now() - this.computingSinceMs > COMPUTE_LIMIT_MS) {
        this.end('runtime_error', {
          message: 'Your program ran for a long time without the robot doing anything. Is there a loop that never ends?',
          blockId: this.lastBlockId,
        })
      }
      return
    }

    this.accumulatorMs = Math.min(this.accumulatorMs + realMs * speed, STEP_MS * MAX_STEPS_PER_ADVANCE)
    while (this.accumulatorMs >= STEP_MS && !this.ended) {
      this.accumulatorMs -= STEP_MS
      this.sim.step()

      if (this.sim.allObjectivesMet()) {
        this.end('objectives_met')
        return
      }
      if (this.sim.elapsedMs >= this.sim.timeLimitMs) {
        this.end('timeout')
        return
      }

      if (this.program === 'finished') {
        this.settleRemainingMs -= STEP_MS
        if (this.settleRemainingMs <= 0) {
          this.endAfterProgram()
          return
        }
      } else if (!this.sim.waitingOnTime) {
        // The command or tick the program was waiting on has finished: it resumes now, and
        // simulated time stops until it next waits.
        this.setComputing()
        return
      }
    }
  }

  /** Stops the run at the learner's request. */
  stop(): void {
    if (!this.ended) this.end('stopped')
  }

  dispose(): void {
    this.terminateWorker()
    this.ended = true
  }

  private setComputing(): void {
    this.program = 'computing'
    this.computingSinceMs = this.now()
  }

  private onWorkerMessage(message: WorkerToHost): void {
    if (this.ended) return
    switch (message.type) {
      case 'call':
        this.onCall(message.id, message.kind, message.name, message.args)
        break
      case 'highlight':
        this.lastBlockId = message.blockId
        this.callbacks.onHighlight?.(message.blockId)
        break
      case 'print':
        this.callbacks.onPrint?.(message.text)
        break
      case 'done':
        this.program = 'finished'
        this.terminateWorker()
        this.sim.halt()
        break
      case 'error':
        this.end('runtime_error', { message: message.message, blockId: this.lastBlockId })
        break
    }
  }

  private onCall(id: number, kind: 'command' | 'sensor' | 'tick', name: string, args: Record<string, unknown>): void {
    const reply = (message: HostToWorker) => this.worker?.postMessage(message)
    const replyError = (error: unknown) =>
      reply({ type: 'reply', id, ok: false, message: error instanceof Error ? error.message : String(error) })

    if (kind === 'sensor') {
      // Sensors read the current simulated instant; no time passes.
      try {
        reply({ type: 'reply', id, ok: true, value: this.sim.sensor(name) })
      } catch (error) {
        replyError(error)
      }
      return
    }

    const promise = kind === 'tick' ? this.sim.tick() : this.sim.command(name, args)
    // Commands that finish instantly (stop, setWheels, drive without a duration) leave nothing
    // waiting on time; the program keeps computing, and its compute clock keeps running. When a
    // wait does end, `advance` switches back to computing at that exact step.
    if (this.sim.waitingOnTime) this.program = 'waiting'
    promise.then(
      () => reply({ type: 'reply', id, ok: true }),
      (error: unknown) => {
        if (error instanceof CommandError || error instanceof Error) replyError(error)
        else replyError(String(error))
      },
    )
  }

  private endAfterProgram(): void {
    const grading = this.sim.grading()
    if (!grading) this.end('completed')
    else this.end(grading.passed ? 'objectives_met' : 'objectives_failed')
  }

  private end(outcome: RunOutcome, error: RunSummary['error'] = null): void {
    if (this.ended) return
    this.ended = true
    this.terminateWorker()
    this.sim.halt()
    this.callbacks.onEnd({ outcome, grading: this.sim.grading(), summary: this.sim.summary(outcome, error) })
  }

  private terminateWorker(): void {
    this.worker?.terminate()
    this.worker = null
  }
}
