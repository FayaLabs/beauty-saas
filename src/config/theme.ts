import type { SaasTheme } from '@fayz-ai/saas'

/**
 * BeautySoft theme — navy/lavender palette derived from the brand logo.
 * Primary: deep navy (#2B2D5B) — HSL 239 36% 27%
 * Accent: soft lavender (#B8B0CC) — HSL 260 20% 75%
 */
export const beautyTheme: SaasTheme = {
  name: 'BeautySoft',
  brand: '260 30% 45%',
  radius: 'round',
  shadow: 'subtle',
  font: 'outfit',
  sidebar: {
    background: '240 30% 16%',
    foreground: '260 15% 88%',
    border: '240 25% 22%',
    accent: '260 25% 28%',
    accentForeground: '0 0% 100%',
    muted: '260 12% 55%',
  },
  content: {
    background: '260 12% 97%',
  },
  colors: {
    card: '0 0% 100%',
    cardForeground: '240 30% 12%',
    secondary: '260 18% 95%',
    secondaryForeground: '240 30% 18%',
    muted: '260 12% 93%',
    mutedForeground: '260 8% 45%',
    border: '260 12% 90%',
    input: '260 12% 90%',
  },
}
