import type { Config } from 'tailwindcss'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saasPreset } = require('@fayz/saas-core/config')

export default {
  presets: [saasPreset as Config],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../saas-core/src/**/*.{ts,tsx}',
    './node_modules/@fayz/saas-core/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  plugins: [],
} satisfies Config
