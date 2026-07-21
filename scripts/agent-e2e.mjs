#!/usr/bin/env node
// Conversational E2E for the Glow assistant — the FAB's turn loop, headless.
//
// Loads the app's REAL module graph through its own vite (same technique as
// `fayz manifest emit`), signs in as the QA user, hydrates the same stores the
// shell hydrates, builds the same catalog useAITools builds, and drives the
// LIVE broker (localhost:3001) with client-plane execution — including guarded
// writes (confirmations are auto-approved and logged).
//
// Usage: node scripts/agent-e2e.mjs [--scenario <name>] [--profile secretaria]
//        env: FAYZ_API_URL (default http://localhost:3001/api)

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const APP_DIR = resolve(import.meta.dirname, '..')
process.chdir(APP_DIR)

// ── env (.env / .env.local, without overriding process env) ────────────────
for (const file of ['.env', '.env.local']) {
  const path = resolve(APP_DIR, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

// ── browser shims ───────────────────────────────────────────────────────────
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size },
}
globalThis.navigator ??= { language: 'pt-BR', userAgent: 'agent-e2e' }
globalThis.window ??= globalThis

// ── module graph via the app's vite ─────────────────────────────────────────
const appRequire = createRequire(resolve(APP_DIR, 'package.json'))
const viteMod = await import(pathToFileURL(appRequire.resolve('vite')).href)
const vite = viteMod.createServer ? viteMod : viteMod.default
const server = await vite.createServer({
  root: APP_DIR,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true },
})

const fail = (msg) => { console.error('✗', msg); process.exit(1) }

try {
  const configMod = await server.ssrLoadModule('/src/config/app.tsx')
  const config = Object.values(configMod).find(
    (v) => v && typeof v === 'object' && typeof v.name === 'string' && 'plugins' in v,
  )
  if (!config) fail('config export not found')

  const core = await server.ssrLoadModule('@fayz-ai/core')
  const saas = await server.ssrLoadModule('@fayz-ai/saas')
  const auth = await server.ssrLoadModule('@fayz-ai/auth')
  const shellHandlers = await server.ssrLoadModule('@fayz-ai/saas/internal/ai-tool-handlers')
    .catch(() => null)
  // internal subpath may not exist — fall back to the source path through the alias
  const handlers = shellHandlers ??
    (await server.ssrLoadModule('/Users/fayalabs/dev/fayz-sdk/packages/saas/src/shell/lib/ai-tool-handlers.ts'))
  const coreTools = await server.ssrLoadModule('/Users/fayalabs/dev/fayz-sdk/packages/saas/src/shell/lib/core-ai-tools.ts')
  const chatStoreMod = await server.ssrLoadModule('/Users/fayalabs/dev/fayz-sdk/packages/saas/src/shell/stores/chat.store.ts')
  const sdkAgent = await server.ssrLoadModule('@fayz-ai/sdk/agent')
  const supabaseJs = await server.ssrLoadModule('@supabase/supabase-js')

  // ── supabase session (QA fixture user, same creds the app e2e uses) ──────
  const supa = supabaseJs.createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: signin, error: signinError } = await supa.auth.signInWithPassword({
    email: 'qa+beauty@fayalabs.com',
    password: process.env.QA_TENANT_PASSWORD,
  })
  if (signinError) fail(`QA sign-in failed: ${signinError.message}`)
  const user = signin.user
  core.setGlobalSupabaseClient(supa)

  const TENANT = 'a0000000-0000-4000-8000-000000000001'
  core.setActiveTenantId(TENANT)

  // ── hydrate the stores the access engine reads ───────────────────────────
  auth.useAuthStore.getState().setUser({ id: user.id, email: user.email, fullName: 'QA Owner' })
  saas.useOrganizationStore.setState({
    currentOrg: { id: TENANT, name: 'QA Fayz BeautySoft', plan: 'pro' },
    members: [{ userId: user.id, name: 'QA Owner', role: 'owner' }],
  })
  const profiles = {
    owner: { id: 'owner', name: 'Owner', grants: {} },
    secretaria: {
      id: 'secretaria', name: 'Secretária',
      grants: { appointments: ['read', 'create', 'edit'], clients: ['read', 'create', 'edit'], services: ['read'] },
    },
  }
  const profileName = process.argv.includes('--profile')
    ? process.argv[process.argv.indexOf('--profile') + 1]
    : 'owner'
  saas.usePermissionsStore.setState({ currentProfile: profiles[profileName] ?? profiles.owner })
  saas.useBillingStore.setState({ plans: config.billing?.plans ?? [] })

  // ── catalog + executor index (mirrors useAITools/useChat) ────────────────
  const plugins = config.plugins ?? []
  const registries = new Map(plugins.filter((p) => p.registries?.length).map((p) => [p.id, p.registries]))
  const queryEntities = [...plugins.flatMap((p) => p.queryEntities ?? []), ...(config.agentContract?.queryEntities ?? [])]
  const allTools = [
    ...coreTools.coreAITools,
    ...coreTools.buildDataPrimitiveTools({ entities: core.getAllEntities(), registries, queryEntities }),
    ...plugins.flatMap((p) => p.aiTools ?? []),
  ]
  const visible = allTools.filter((t) => {
    if (!t.permission) return true
    return saas.resolveAccess(
      { profile: saas.usePermissionsStore.getState().currentProfile, plan: (config.billing?.plans ?? []).find((p) => p.id === 'pro') ?? null },
      t.permission.feature,
      t.permission.action,
    ).allowed
  })
  const dataTools = handlers.buildDataToolIndex({
    registries,
    entities: core.getAllEntities(),
    registryToolName: coreTools.registryToolName,
    entityToolName: coreTools.entityToolName,
    queryEntities,
  })
  const toolset = handlers.buildAgentToolset(visible, { dataTools, activePluginId: null })
  const toolByName = new Map(visible.map((t) => [t.name, t]))
  console.log(`catalog: ${toolset.length} executable tools as ${profileName}:`, toolset.map((t) => t.name).join(', '))

  // auto-approve confirmations, logging them
  chatStoreMod.useChatStore.subscribe((s) => {
    if (s.pendingAction) {
      console.log(`   [CONFIRM auto-yes] ${s.pendingAction.toolName}:`, JSON.stringify(s.pendingAction.params).slice(0, 160))
      setTimeout(() => chatStoreMod.useChatStore.getState().resolvePendingAction(true), 10)
    }
  })

  // ── the turn loop ────────────────────────────────────────────────────────
  const client = sdkAgent.createFayzAgentClient({
    baseUrl: process.env.FAYZ_API_URL ?? process.env.VITE_FAYZ_API_BASE_URL ?? 'http://localhost:3001/api',
    projectId: process.env.VITE_FAYZ_PROJECT_ID,
    publishableKey: process.env.VITE_FAYZ_AGENT_KEY,
  })

  const routes = plugins.flatMap((p) => (p.navigation ?? []).map((n) => ({ path: n.route, label: n.label })))
  const toolContext = {
    currentOrg: saas.useOrganizationStore.getState().currentOrg,
    members: saas.useOrganizationStore.getState().members,
    currentPath: '/',
    routes,
    navigate: (path) => console.log('   [NAVIGATE]', path),
    dataTools,
  }

  const executeGuarded = async (call) => {
    const def = toolByName.get(call.name)
    if (def?.mode === 'persist') {
      if (def.permission) {
        const access = saas.checkAccess(def.permission.feature, def.permission.action)
        if (!access.allowed) return JSON.stringify(access)
      }
      if (def.limitKey) {
        const limit = await saas.guardLimit(def.limitKey)
        if (!limit.allowed) return JSON.stringify(limit)
      }
      if (def.requiresConfirmation !== false) {
        console.log(`   [CONFIRM auto-yes] ${call.name}:`, JSON.stringify(call.arguments).slice(0, 160))
      }
    }
    const exec = def?.execution
    const rpcName = exec && exec.plane === 'server' && exec.kind === 'rpc' ? exec.rpc : null
    const result = rpcName
      ? await handlers.executeRpcTool(rpcName, call.arguments, user.id)
      : await handlers.executeAITool(call.name, call.arguments, toolContext)
    return result.content
  }

  let conversationId = null
  async function turn(message) {
    let toolResults
    let msg = message
    const trace = []
    const seenCalls = new Set()
    const upcoming = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + (i + 1) * 86400e3)
      return `${d.toLocaleDateString('pt-BR', { weekday: 'long' })}=${d.toISOString().slice(0, 10)}`
    }).join(', ')
    for (let round = 0; round <= 5; round++) {
      const response = await client.chat({
        message: msg,
        toolResults,
        externalUserId: user.id,
        externalUserName: 'QA Owner (agent-e2e)',
        conversationId: conversationId ?? undefined,
        tools: toolset,
        context: {
          now: `${new Date().toISOString()} (${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })})`,
          timeZone: 'America/Sao_Paulo',
          locale: 'pt-BR',
          pages: routes.map((r) => r.label ?? r.path).join(', '),
          upcomingDates: upcoming,
          timeNote: 'Datetimes in tool results are UTC unless the field is *_local. The business timezone is the timeZone above — ALWAYS convert to it before telling the user a time.',
          businessName: 'QA Fayz BeautySoft',
          userName: 'QA Owner',
          ...(config.chat?.systemPrompt ? { appGuidance: config.chat.systemPrompt } : {}),
        },
      })
      conversationId = response.conversationId
      if (!response.toolCalls.length) return { answer: response.content, trace }
      toolResults = []
      for (const call of response.toolCalls) {
        const callKey = `${call.name}:${JSON.stringify(call.arguments)}`
        let content
        if (seenCalls.has(callKey)) {
          content = JSON.stringify({ error: 'repeated_call', message: 'You already called this exact tool with these exact arguments this turn — the result will not change. Use different arguments, a different tool, or answer with what you already have.' })
        } else {
          content = await executeGuarded(call)
          seenCalls.add(callKey)
        }
        trace.push({ tool: call.name, args: call.arguments, result: String(content).slice(0, 220) })
        toolResults.push({ toolCallId: call.id, content })
      }
      msg = undefined
    }
    return { answer: '(loop cap reached)', trace }
  }

  // ── scenario battery ─────────────────────────────────────────────────────
  const scenarios = JSON.parse(readFileSync(resolve(APP_DIR, 'scripts', 'agent-e2e-scenarios.json'), 'utf8'))
  const only = process.argv.includes('--scenario') ? process.argv[process.argv.indexOf('--scenario') + 1] : null
  const results = []
  for (const sc of scenarios) {
    if (only && sc.name !== only) continue
    if (sc.newConversation) conversationId = null
    console.log(`\n━━ [${sc.name}] USER: ${sc.user}`)
    try {
      const { answer, trace } = await turn(sc.user)
      for (const t of trace) console.log(`   ⚙ ${t.tool}(${JSON.stringify(t.args).slice(0, 140)}) → ${t.result.slice(0, 160)}`)
      console.log(`   🤖 ${answer.replace(/\n/g, ' ').slice(0, 400)}`)
      results.push({ name: sc.name, user: sc.user, answer, tools: trace.map((t) => t.tool) })
    } catch (err) {
      console.log(`   ✗ ERROR: ${err.message}`)
      results.push({ name: sc.name, user: sc.user, error: err.message })
    }
  }
  const out = resolve(APP_DIR, 'scripts', `agent-e2e-results-${profileName}.json`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(`\n✓ ${results.length} scenarios → ${out}`)
} finally {
  await server.close()
  process.exit(0)
}
