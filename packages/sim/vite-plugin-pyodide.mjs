// @ts-check
import { createReadStream, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

/**
 * Serves Pyodide's runtime files from the app's own origin under `/pyodide/`, so Python lessons
 * don't depend on a CDN: from node_modules in dev, and copied into the build output otherwise.
 * The Python worker (src/runtime/python-worker.ts) loads them from there.
 */
const FILES = {
  'pyodide.asm.mjs': 'text/javascript',
  'pyodide.asm.wasm': 'application/wasm',
  'python_stdlib.zip': 'application/zip',
  'pyodide-lock.json': 'application/json',
}

/** @returns {import('vite').Plugin} */
export function pyodideAssets() {
  const require = createRequire(import.meta.url)
  const dir = path.dirname(require.resolve('pyodide/package.json'))
  let base = '/'

  return {
    name: 'roboacademy-pyodide-assets',
    configResolved(config) {
      base = config.base
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const prefix = `${base}pyodide/`
        if (!req.url?.startsWith(prefix)) return next()
        const file = req.url.slice(prefix.length).split('?')[0] ?? ''
        const type = FILES[/** @type {keyof typeof FILES} */ (file)]
        if (!type) return next()
        res.setHeader('Content-Type', type)
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(path.join(dir, file)).pipe(res)
      })
    },
    generateBundle() {
      for (const file of Object.keys(FILES)) {
        this.emitFile({ type: 'asset', fileName: `pyodide/${file}`, source: readFileSync(path.join(dir, file)) })
      }
    },
  }
}
