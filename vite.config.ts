import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fayzVite } from '@fayz-ai/sdk/vite'

export default defineConfig(fayzVite({ sdkDir: '../../fayz-sdk-qa', port: 5301, strictPort: true, plugins: [react()] }))
