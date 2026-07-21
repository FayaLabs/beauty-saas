import { fayzTailwind } from '@fayz-ai/ui/tailwind'

// The preset provides the token colors (hsl(var(--*))), dark mode, radii, and —
// critically — the content globs that scan the @fayz-ai SDK packages so their
// layout classes aren't purged. The pink accent comes from src/styles.css vars.
export default fayzTailwind()
