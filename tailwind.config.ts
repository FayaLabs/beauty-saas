import type { Config } from 'tailwindcss'
import saasPreset from '../saas-core/src/config/tailwind-preset'

export default {
  presets: [saasPreset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../saas-core/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  plugins: [],
} satisfies Config
