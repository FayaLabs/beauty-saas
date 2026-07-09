import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fayzVite } from '@fayz-ai/sdk/vite'

const base = fayzVite({ port: 5180, plugins: [react()] })

const fayzPackages = [
  '@fayz-ai/saas',
  '@fayz-ai/ui',
  '@fayz-ai/sdk',
  '@fayz-ai/plugin-agenda',
  '@fayz-ai/plugin-crm',
  '@fayz-ai/plugin-dashboard',
  '@fayz-ai/plugin-financial',
  '@fayz-ai/plugin-forms',
  '@fayz-ai/plugin-inventory',
  '@fayz-ai/plugin-marketing',
  '@fayz-ai/plugin-reports',
  '@fayz-ai/plugin-tasks',
]

export default defineConfig({
  ...base,
  resolve: {
    ...(base.resolve ?? {}),
    dedupe: [
      ...((base.resolve as any)?.dedupe ?? []),
      'react',
      'react-dom',
      'react-router-dom',
      ...fayzPackages,
    ],
  },
  optimizeDeps: {
    ...(base.optimizeDeps ?? {}),
    exclude: [
      ...((base.optimizeDeps as any)?.exclude ?? []),
      ...fayzPackages,
    ],
  },
})
