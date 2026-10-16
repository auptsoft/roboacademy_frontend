import type { Plugin } from 'vite'

/** Serves Pyodide's runtime files under `/pyodide/` in dev and copies them into the build. */
export declare function pyodideAssets(): Plugin
