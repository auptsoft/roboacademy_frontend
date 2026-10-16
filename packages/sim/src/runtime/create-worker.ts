import type { WorkerLike } from './run-controller'

/** Starts a program worker. Vite bundles `worker.ts` as a separate module worker. */
export function createProgramWorker(): WorkerLike {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'robot-program' })
}

/** Starts a Lua program worker (wasmoon). */
export function createLuaWorker(): WorkerLike {
  return new Worker(new URL('./lua-worker.ts', import.meta.url), { type: 'module', name: 'robot-lua' })
}
