/**
 * Assets estáticos servidos pelo bucket R2 `fayz-assets`, via assets.fayz.ai.
 *
 * Antes estes arquivos moravam em `public/` e eram referenciados por caminho
 * absoluto (`/logo.png`), o que significava uma cópia por app e nenhum cache
 * compartilhado entre eles. No bucket cada app tem seu prefixo — este é
 * `glow-studio/`, o nome do app em produção — e os ícones de conector ficam em
 * `connectors/`, fora do prefixo, porque são os mesmos para todos os apps Fayz.
 *
 * O prefixo por app não é cosmético: `ambassadors/pro-1.jpg` e `pro-2.jpg`
 * existem com o mesmo nome e conteúdo diferente aqui e no the-chef. Num bucket
 * plano um sobrescreveria o outro sem aviso.
 */
const ASSETS_BASE = 'https://assets.fayz.ai'

/** Asset próprio do Glow Studio. `asset('logo.png')` → `…/glow-studio/logo.png`. */
export const asset = (path: string) => `${ASSETS_BASE}/glow-studio/${path}`
