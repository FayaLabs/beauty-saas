import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fayzVite } from '@fayz-ai/sdk/vite'

// Ponte ate o proximo release do SDK. Quem monta os aliases de source e o
// `fayzVite` da versao INSTALADA, e a lista de pacotes dele congelou nessa
// versao: o que nasceu depois (@fayz-ai/admin, plugin-scribe, plugin-banking-br)
// fica sem alias e o Vite resolve pelo workspace, caindo no `dist` — build velha
// no meio de uma app que, no resto, roda source. Ler o checkout do disco cobre
// qualquer pacote que exista nele, inclusive os que ainda nem foram criados.
// Continua valendo o mesmo interruptor: FAYZ_SDK_SOURCE=published (`npm run
// dev:published-sdk`) volta tudo pro node_modules.
const sdkDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../fayz-sdk')
const useLocalSdk =
  process.env.FAYZ_SDK_SOURCE !== 'published' && existsSync(resolve(sdkDir, 'packages/core/src/index.ts'))
const sdkAliases = useLocalSdk
  ? Object.fromEntries(
      ['packages', 'plugins'].flatMap((group) =>
        readdirSync(resolve(sdkDir, group))
          .filter((name) => existsSync(resolve(sdkDir, group, name, 'src/index.ts')))
          .map((name) => [`@fayz-ai/${name}`, resolve(sdkDir, group, name, 'src')] as const),
      ),
    )
  : {}

const base = fayzVite({
  port: 5301,
  strictPort: true,
  plugins: [react()],
  aliases: sdkAliases,
})

// Segunda ponte, mesma causa: rodando o SDK do source, os @fayz-ai/* saem do
// optimize e as bare deps DELES somem do scan inicial do Vite. A que so aparece
// atras de um React.lazy() e descoberta no clique, e o re-optimize que vem a
// seguir mata o proprio import que o disparou ("Failed to fetch dynamically
// imported module"). recharts (graficos) e @dnd-kit (builder de formularios)
// sao esses casos. O fayzVite novo ja inclui a lista; ate o release, aqui.
// Terceira ponte: plugin-agenda e a app carregam CADA UMA uma copia de
// @fullcalendar, e so a da app tem `premium-common`. Em duas copias, as views
// de recurso registram o ScrollGrid num `core` que nao e o do calendario e a
// grade da semana morre com "No ScrollGrid implementation" — falha que so
// aparece depois de limpar o cache de deps, entao parece aleatoria. O fayzVite
// novo ja deduplica; ate o release, aqui.
const FULLCALENDAR = [
  '@fullcalendar/core', '@fullcalendar/react', '@fullcalendar/daygrid',
  '@fullcalendar/timegrid', '@fullcalendar/list', '@fullcalendar/interaction',
  '@fullcalendar/premium-common', '@fullcalendar/resource',
  '@fullcalendar/resource-daygrid', '@fullcalendar/resource-timegrid',
]

export default defineConfig({
  ...base,
  resolve: {
    ...base.resolve,
    dedupe: [...(base.resolve?.dedupe ?? []), ...FULLCALENDAR],
  },
  optimizeDeps: {
    ...base.optimizeDeps,
    include: ['recharts', '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/modifiers', '@dnd-kit/utilities', ...FULLCALENDAR],
  },
})
