import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fayzVite } from '@fayz-ai/sdk/vite'

// Ponte ate o proximo release do SDK: `fayzVite` resolve os @fayz-ai/plugin-*
// pela lista embutida na versao PUBLICADA do @fayz-ai/sdk, que ainda nao inclui
// plugin-banking-br (graduado do incubador local). Some quando o plugin sair no npm.
const bankingBr = resolve(dirname(fileURLToPath(import.meta.url)), '../../fayz-sdk/plugins/plugin-banking-br/src')
// Mesma ponte para o plugin-scribe (gravacao de atendimento), ainda nao publicado.
const scribe = resolve(dirname(fileURLToPath(import.meta.url)), '../../fayz-sdk/plugins/plugin-scribe/src')

export default defineConfig(
  fayzVite({
    port: 5301,
    strictPort: true,
    plugins: [react()],
    aliases: {
      ...(existsSync(bankingBr) ? { '@fayz-ai/plugin-banking-br': bankingBr } : {}),
      ...(existsSync(scribe) ? { '@fayz-ai/plugin-scribe': scribe } : {}),
    },
  }),
)
