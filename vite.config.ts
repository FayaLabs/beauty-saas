import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fayzVite } from '@fayz-ai/sdk/vite'

export default defineConfig(fayzVite({ port: 5301, strictPort: true, plugins: [react()] }))
