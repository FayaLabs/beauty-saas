import type { Config } from 'tailwindcss'
// Pure preset from the published package — resolves in both the fayz container
// (npm) and local dev. Never the relative ../../fayz-sdk path (absent in prod).
import { fayzUiPreset } from '@fayz-ai/ui/preset'

export default {
  presets: [fayzUiPreset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // SDK shell + UI + plugins — Tailwind must see their class names.
    // Production: SDK installed in node_modules (packages ship src/).
    './node_modules/@fayz-ai/ui/src/**/*.{ts,tsx}',
    './node_modules/@fayz-ai/saas/src/**/*.{ts,tsx}',
    './node_modules/@fayz-ai/plugin-*/src/**/*.{ts,tsx}',
    // Local dev: SDK as a sibling checkout (matches nothing in production).
    '../../fayz-sdk/packages/ui/src/**/*.{ts,tsx}',
    '../../fayz-sdk/packages/saas/src/**/*.{ts,tsx}',
    '../../fayz-sdk/plugins/*/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  plugins: [],
} satisfies Config
