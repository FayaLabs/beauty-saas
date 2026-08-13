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

export default defineConfig(
  fayzVite({
    port: 5301,
    strictPort: true,
    plugins: [react()],
    aliases: sdkAliases,
  }),
)
