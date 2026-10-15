import path from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5175,
    strictPort: true,
    fs: { allow: ['../..'] },
  },
  optimizeDeps: {
    exclude: ['@roboacademy/ui', '@roboacademy/sim'],
    // Reached only from the simulator's worker or lazily, so the dependency scan can miss them.
    include: ['js-interpreter', 'blockly/core', 'blockly/blocks', 'blockly/javascript', 'blockly/msg/en', 'three', '@dimforge/rapier3d-compat'],
  },
  worker: {
    // The simulator's program worker is a module worker (packages/sim/src/runtime/create-worker.ts).
    format: 'es',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  }
})
