/// <reference lib="webworker" />
import { loadPyodide } from 'pyodide'
import { PythonSession } from './python-session'
import type { HostToWorker } from './protocol'

/**
 * The Python program worker. Loads Pyodide from the app's own `/pyodide/` folder (served by the
 * pyodideAssets Vite plugin), as soon as it is created, so a warm worker is ready before Run.
 * Isolation and the kill switch are the same as the JavaScript worker's.
 */
const scope = self as unknown as DedicatedWorkerGlobalScope
const indexURL = new URL(`${import.meta.env.BASE_URL}pyodide/`, scope.location.origin).href
const session = new PythonSession((message) => scope.postMessage(message), () => loadPyodide({ indexURL }))
scope.onmessage = (event: MessageEvent<HostToWorker>) => session.receive(event.data)
