import type { WorkerLike } from './run-controller'

/**
 * Keeps one Python worker loading in the background, so pressing Run doesn't wait for Pyodide.
 * A run takes the warm worker (or starts one if there isn't one); the player warms the next one
 * after the run ends, not during it, so two Pyodide instances don't compete with the simulation.
 */
let warm: WorkerLike | null = null

function spawn(): WorkerLike {
  return new Worker(new URL('./python-worker.ts', import.meta.url), { type: 'module', name: 'robot-python' })
}

export function prewarmPythonWorker(): void {
  warm ??= spawn()
}

export function createPythonWorker(): WorkerLike {
  const worker = warm ?? spawn()
  warm = null
  return worker
}

/** Frees the warm worker, e.g. when leaving a Python lesson. */
export function releasePythonWorker(): void {
  warm?.terminate()
  warm = null
}
