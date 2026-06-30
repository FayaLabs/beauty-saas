// Requires the updated Fayz UI export map with "./tailwind".
// If Tailwind reports "Cannot find module '@fayz-ai/ui/tailwind'", update/link
// the matching fayz-sdk branch before reviewing this BeautySaaS PR.
import { fayzTailwind } from '@fayz-ai/ui/tailwind'

export default fayzTailwind()
