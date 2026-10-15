import type { WorkerLike } from './run-controller'

/** Starts a program worker. Vite bundles `worker.ts` as a separate module worker. */
export function createProgramWorker(): WorkerLike {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'robot-program' })
}
