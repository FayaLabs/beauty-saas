import { defineConfig } from 'vite'
import { fayzVite } from '@fayz-ai/sdk/vite'

export default defineConfig(fayzVite({ port: 5180 }))
