#!/usr/bin/env node
// ---------------------------------------------------------------------------
// functions-sync.mjs — traz as edge functions dos plugins para este repo.
//
// O PROBLEMA QUE ISTO RESOLVE
//
// Um plugin do SDK pode trazer uma edge function junto (plugin-agenda tem
// `functions/google-calendar-sync/`). Mas `supabase functions deploy` só
// enxerga `supabase/functions/` DESTE repo. O resultado, documentado em
// docs/ARCHITECTURE.md:43, é que a function do google-calendar existe no SDK e
// está INOPERANTE aqui — ninguém nunca a copiou.
//
// Sem um passo como este, o plugin-scribe herdaria exatamente o mesmo destino:
// código correto no SDK, feature morta em produção.
//
// COMO FUNCIONA
//
// Copia `<pkg>/functions/<nome>/` → `supabase/functions/<nome>/` para cada
// plugin instalado. Resolve primeiro em node_modules (o pacote publicado traz
// `functions` no campo `files`) e cai para o SDK local em modo source.
//
// Os arquivos copiados são GERADOS: um cabeçalho marca cada um, e editar a
// cópia é sempre errado — a fonte é o repo do plugin.
//
// Uso:
//   node scripts/functions-sync.mjs            # copia
//   node scripts/functions-sync.mjs --check    # falha se estiver defasado (CI)
//
// Depois de copiar, o deploy continua sendo manual e explícito:
//   supabase functions deploy scribe-transcribe
//   supabase secrets set DEEPGRAM_API_KEY=... OPENAI_API_KEY=...
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEST_ROOT = join(ROOT, 'supabase', 'functions')
const LOCAL_SDK = join(ROOT, '..', '..', 'fayz-sdk', 'plugins')
const NODE_MODULES = join(ROOT, 'node_modules', '@fayz-ai')

const CHECK = process.argv.includes('--check')

const BANNER = (source) =>
  `// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.\n` +
  `// Fonte: ${source}\n` +
  `// Edite no repo do plugin e rode: npm run functions:sync\n`

/** Onde procurar um plugin, em ordem de preferência. */
function pluginDirs() {
  const dirs = new Map()
  // node_modules primeiro: é o que o container de build tem, e é a fonte que
  // corresponde à versão realmente instalada.
  if (existsSync(NODE_MODULES)) {
    for (const name of readdirSync(NODE_MODULES)) {
      if (!name.startsWith('plugin-')) continue
      const fns = join(NODE_MODULES, name, 'functions')
      if (existsSync(fns)) dirs.set(name, fns)
    }
  }
  // SDK local em segundo: em modo source ele é a verdade para o dev.
  if (existsSync(LOCAL_SDK)) {
    for (const name of readdirSync(LOCAL_SDK)) {
      const fns = join(LOCAL_SDK, name, 'functions')
      if (existsSync(fns)) dirs.set(name, fns)
    }
  }
  return dirs
}

function copyTree(srcDir, destDir, sourceLabel, results) {
  mkdirSync(destDir, { recursive: true })
  for (const entry of readdirSync(srcDir)) {
    const src = join(srcDir, entry)
    const dest = join(destDir, entry)
    if (statSync(src).isDirectory()) {
      copyTree(src, dest, sourceLabel, results)
      continue
    }
    const raw = readFileSync(src, 'utf8')
    const content = entry.endsWith('.ts') || entry.endsWith('.js') ? BANNER(sourceLabel) + raw : raw
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null
    if (current === content) {
      results.unchanged.push(relative(ROOT, dest))
      continue
    }
    results.changed.push(relative(ROOT, dest))
    if (!CHECK) writeFileSync(dest, content)
  }
}

/**
 * A function pode importar do `src/` do plugin com caminho relativo
 * (`../../src/lib/prompt.ts`) — é o que o google-calendar-sync faz. Copiada
 * para cá, esse caminho quebraria. Então o src referenciado vem junto, no mesmo
 * layout relativo.
 */
function copyReferencedSources(pluginRoot, fnDir, destFnDir, sourceLabel, results) {
  const refs = new Set()
  const scan = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) {
        scan(p)
        continue
      }
      if (!entry.endsWith('.ts')) continue
      const code = readFileSync(p, 'utf8')
      for (const m of code.matchAll(/from\s+['"](\.\.\/\.\.\/src\/[^'"]+)['"]/g)) refs.add(m[1])
    }
  }
  scan(fnDir)

  for (const ref of refs) {
    const rel = ref.replace(/^\.\.\/\.\.\//, '')
    const src = join(pluginRoot, rel)
    if (!existsSync(src)) {
      console.warn(`  ! referência não encontrada: ${ref}`)
      continue
    }
    // ../../src/x a partir de supabase/functions/<nome>/ → supabase/src/x
    const dest = join(destFnDir, '..', '..', rel)
    mkdirSync(dirname(dest), { recursive: true })
    const content = BANNER(`${sourceLabel} → ${rel}`) + readFileSync(src, 'utf8')
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null
    if (current === content) {
      results.unchanged.push(relative(ROOT, dest))
      continue
    }
    results.changed.push(relative(ROOT, dest))
    if (!CHECK) writeFileSync(dest, content)
  }
}

function run() {
  const dirs = pluginDirs()
  if (dirs.size === 0) {
    console.log('Nenhum plugin com functions/ encontrado. Nada a fazer.')
    return
  }

  const results = { changed: [], unchanged: [] }

  for (const [plugin, fnsRoot] of dirs) {
    const pluginRoot = join(fnsRoot, '..')
    for (const fnName of readdirSync(fnsRoot)) {
      const srcFn = join(fnsRoot, fnName)
      if (!statSync(srcFn).isDirectory()) continue
      const destFn = join(DEST_ROOT, fnName)
      console.log(`${plugin}/functions/${fnName} → supabase/functions/${fnName}`)
      copyTree(srcFn, destFn, `${plugin}/functions/${fnName}`, results)
      copyReferencedSources(pluginRoot, srcFn, destFn, plugin, results)
    }
  }

  if (CHECK) {
    if (results.changed.length > 0) {
      console.error(`\n✗ ${results.changed.length} arquivo(s) defasado(s):`)
      for (const f of results.changed) console.error(`    ${f}`)
      console.error('\nRode: npm run functions:sync')
      process.exit(1)
    }
    console.log(`\n✓ ${results.unchanged.length} arquivo(s) em dia.`)
    return
  }

  console.log(
    `\n${results.changed.length} atualizado(s), ${results.unchanged.length} sem mudança.\n` +
      'Deploy (manual, por projeto):\n' +
      '  supabase functions deploy <nome>\n' +
      '  supabase secrets set DEEPGRAM_API_KEY=... OPENAI_API_KEY=...',
  )
}

run()
