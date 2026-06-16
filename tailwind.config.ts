import type { Config } from 'tailwindcss'
import { fayzUiPreset } from '../../fayz-sdk/packages/ui/src/theme/preset'

export default {
  presets: [fayzUiPreset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Native SDK shell + UI + plugins (Tailwind must see their class names).
    '../../fayz-sdk/packages/ui/src/**/*.{ts,tsx}',
    '../../fayz-sdk/packages/saas/src/**/*.{ts,tsx}',
    '../../fayz-sdk/plugins/*/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  plugins: [],
} satisfies Config
