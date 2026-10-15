/// <reference lib="webworker" />
import { ProgramSession } from './program-session'
import type { HostToWorker } from './protocol'

/**
 * The program worker. Isolates learner programs from the page: no DOM, no access to the
 * learner's tokens (kept in localStorage, which workers can't read), and a kill switch - the
 * host stops a program, including an infinite loop, by terminating the worker.
 */
const scope = self as unknown as DedicatedWorkerGlobalScope
const session = new ProgramSession((message) => scope.postMessage(message))
scope.onmessage = (event: MessageEvent<HostToWorker>) => session.receive(event.data)
