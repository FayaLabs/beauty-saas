import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fayzVite } from '@fayz-ai/sdk/vite'

const base = fayzVite({ port: 5180, plugins: [react()] })

export default defineConfig({
  ...base,
  resolve: {
    ...(base.resolve ?? {}),
    dedupe: [
      ...((base.resolve as any)?.dedupe ?? []),
      'react',
      'react-dom',
      'react-router-dom',
      '@fayz-ai/saas',
      '@fayz-ai/ui',
    ],
  },
})
