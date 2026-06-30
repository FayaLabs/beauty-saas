import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Requires the updated Fayz SDK export map with "./vite".
// If Vite reports "Missing './vite' specifier in '@fayz-ai/sdk'", update/link the
// matching fayz-sdk branch before reviewing this BeautySaaS PR.
import { fayzVite } from '@fayz-ai/sdk/vite'

export default defineConfig(fayzVite({ port: 5180, plugins: [react()] }))
