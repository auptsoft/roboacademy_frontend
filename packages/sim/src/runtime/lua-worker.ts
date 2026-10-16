/// <reference lib="webworker" />
import { LuaFactory } from 'wasmoon'
import wasmUrl from 'wasmoon/dist/glue.wasm?url'
import { LuaSession } from './lua-session'
import type { HostToWorker } from './protocol'

/**
 * The Lua program worker. wasmoon's WebAssembly module is bundled as an asset of the app, so no
 * CDN is involved, and it is small enough (about 270 KB) to load per run without a warm worker.
 */
const scope = self as unknown as DedicatedWorkerGlobalScope
const factory = new LuaFactory(wasmUrl)
const session = new LuaSession((message) => scope.postMessage(message), () => factory.createEngine())
scope.onmessage = (event: MessageEvent<HostToWorker>) => session.receive(event.data)
