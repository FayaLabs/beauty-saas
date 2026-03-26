import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Use local saas-core source for dev when available, otherwise use installed package
const localCore = resolve(__dirname, '../saas-core')
const useLocalCore = existsSync(resolve(localCore, 'src/index.ts'))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      ...(useLocalCore ? { '@fayz/saas-core': resolve(localCore, 'src') } : {}),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: useLocalCore ? ['@fayz/saas-core'] : [],
  },
  server: {
    port: 5180,
  },
})
