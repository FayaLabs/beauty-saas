import { fayzTailwind } from '@fayz-ai/ui/tailwind'

// The preset provides the token colors (hsl(var(--*))), dark mode, radii, and —
// critically — the content globs that scan the @fayz-ai SDK packages so their
// layout classes aren't purged. The pink accent comes from src/styles.css vars.
// Ponte até o próximo release do SDK — mesma razão dos aliases de source no
// vite.config.ts, e some junto com eles.
//
// O helper publicado (@fayz-ai/ui) varre ui/saas/storefront/portal e NÃO varre
// `packages/admin/src`. O Vite resolve o admin pelo source local, então a tela
// roda com as classes novas — mas o Tailwind nunca as vê, e uma utility que ele
// não encontra literalmente num arquivo varrido simplesmente não é gerada. O
// sintoma não é um erro: é a regra faltando (a coluna do assistente saía de
// canto quadrado e sem borda porque `md:rounded-r-xl` não existia no CSS).
//
// O `admin` já entrou na lista do SDK em packages/ui/src/tailwind.ts; quando
// esse release sair, esta linha pode cair.
export default fayzTailwind({
  content: ['../../fayz-sdk/packages/admin/src/**/*.{ts,tsx}'],
})
