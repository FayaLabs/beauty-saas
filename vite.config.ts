import { defineConfig, mergeConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fayzVite } from '@fayz-ai/sdk/vite'

export default defineConfig(
  mergeConfig(
    fayzVite({ port: 5180, plugins: [react()] }),
    {
      resolve: {
        dedupe: ['react', 'react-dom', 'react-router-dom'],
      },
    }
  )
)
