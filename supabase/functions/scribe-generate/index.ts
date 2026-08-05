// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-scribe/functions/scribe-generate
// Edite no repo do plugin e rode: npm run functions:sync
// scribe-generate — transcrição + template narrativo → documento em Markdown.
//
// Env: OPENAI_API_KEY (ou ANTHROPIC_API_KEY), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// ---------------------------------------------------------------------------
// Por que isto NÃO é uma tool do assistente de chat
// ---------------------------------------------------------------------------
// O turn loop do chat tem teto de 4 rodadas, vive num hook React que morre na
// navegação, executa no plano do cliente, e persiste tudo que passa por ele no
// histórico de conversa do broker. Gerar um documento clínico precisa do
// oposto em todos os quatro pontos: sem teto de rodada, sem depender de aba,
// no servidor, e sem despejar 9k tokens de transcrição de saúde num store de
// conversa que ninguém revisou.
//
// Além disso a geração precisa ser AUDITÁVEL (modelo, versão de prompt, tokens)
// e REPETÍVEL. Um turno de chat não é nem um nem outro.
//
// O assistente entra depois, na tela do rascunho, para reescrever UMA seção —
// isso sim cabe folgado em 4 rodadas.
//
// ---------------------------------------------------------------------------
// callModel: um ponto, um dia trocável
// ---------------------------------------------------------------------------
// Toda chamada de modelo passa por `callModel`. Quando o broker Fayz expuser um
// endpoint headless (`POST /agents/complete`, sem conversa persistida), a troca
// é o corpo desta função e nenhum app volta a segurar chave de modelo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import {
  PROMPT_VERSION,
  buildSystemPrompt,
  buildUserPrompt,
  deriveTitle,
  renderTranscript,
  type TranscriptLine,
} from '../../src/lib/prompt.ts'
import type { NarrativeSchema } from '../../src/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MODEL = 'gpt-4o'

interface ModelResult {
  text: string
  model: string
  inputTokens?: number
  outputTokens?: number
}

async function callModel(args: { system: string; user: string; model?: string }): Promise<ModelResult> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) throw new Error('OPENAI_API_KEY não configurada')
  const model = args.model ?? Deno.env.get('SCRIBE_MODEL') ?? DEFAULT_MODEL

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      // Baixa mas não zero: documento clínico quer consistência, e temperatura
      // zero deixa o modelo repetitivo em texto longo.
      temperature: 0.2,
      max_tokens: 4000,
    }),
  })
  if (!res.ok) throw new Error(`modelo ${res.status}: ${await res.text()}`)

  const json = await res.json()
  return {
    text: json?.choices?.[0]?.message?.content ?? '',
    model,
    inputTokens: json?.usage?.prompt_tokens,
    outputTokens: json?.usage?.completion_tokens,
  }
}

/**
 * Monta a transcrição na ordem dos segmentos. Buraco entra como linha, não é
 * pulado — a costura invisível é o modo de falha que este design recusa.
 */
async function loadTranscript(supabase: any, sessionId: string): Promise<TranscriptLine[]> {
  const { data } = await supabase
    .from('plg_scribe_segments')
    .select('seg_index, start_offset_ms, text, gap, words')
    .eq('session_id', sessionId)
    .order('seg_index', { ascending: true })
  if (!data) return []

  return data.map((s: any) => ({
    startOffsetMs: s.start_offset_ms ?? 0,
    text: s.text ?? '',
    gap: !!s.gap,
    speaker: Array.isArray(s.words) && s.words.length > 0 ? s.words[0]?.sp : undefined,
  }))
}

/**
 * Resolve o schema: linha do tenant (forkada) ou preset vindo do cliente. Preset
 * de sistema de propósito NÃO tem linha — ele não deve consumir a cota de
 * templates do plano, e corrigir seu prompt deve ser release, não migration.
 */
async function resolveSchema(
  supabase: any,
  templateId: string | undefined,
  inlineSchema: NarrativeSchema | undefined,
): Promise<{ schema: NarrativeSchema; name: string }> {
  if (templateId) {
    const { data } = await supabase
      .from('plg_forms_templates')
      .select('name, schema')
      .eq('id', templateId)
      .single()
    if (data?.schema?.kind === 'narrative') return { schema: data.schema, name: data.name }
    throw new Error('template não é narrativo')
  }
  if (inlineSchema?.kind === 'narrative') return { schema: inlineSchema, name: 'Documento' }
  throw new Error('nenhum template informado')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  let generationId: string | null = null

  try {
    const body = await req.json()
    const sessionId = body.sessionId as string
    if (!sessionId) throw new Error('sessionId é obrigatório')

    // Mesma checagem do scribe-transcribe: a service key contorna a RLS, então
    // a autorização é explícita aqui.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'não autenticado' }, 401)
    const { data: caller } = await supabase.auth.getUser(jwt)
    if (!caller?.user) return json({ error: 'não autenticado' }, 401)

    const { data: session } = await supabase
      .from('plg_scribe_sessions')
      .select('id, tenant_id, subject_id, started_at, audio_duration_ms, locale')
      .eq('id', sessionId)
      .single()
    if (!session) return json({ error: 'sessão não encontrada' }, 404)

    const { data: membership } = await supabase
      .schema('saas_core')
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', session.tenant_id)
      .eq('user_id', caller.user.id)
      .maybeSingle()
    if (!membership) return json({ error: 'acesso negado' }, 403)

    const { schema, name } = await resolveSchema(supabase, body.templateId, body.schema)

    const lines = await loadTranscript(supabase, sessionId)
    const hasAudio = lines.some((l) => !l.gap && l.text.trim())
    if (!hasAudio) return json({ error: 'não há transcrição para gerar o documento' }, 422)

    // A linha nasce em `running` ANTES da chamada ao modelo: uma geração que
    // trava sem deixar rastro é indistinguível de uma que nunca foi pedida.
    const { data: created, error: insErr } = await supabase
      .from('plg_scribe_generations')
      .insert({
        tenant_id: session.tenant_id,
        session_id: sessionId,
        template_id: body.templateId ?? null,
        template_key: body.templateKey ?? null,
        tab_order: body.tabOrder ?? 0,
        status: 'running',
        prompt_version: PROMPT_VERSION,
        created_by: caller.user.id,
      })
      .select('id')
      .single()
    if (insErr || !created) throw new Error(`falha ao criar a geração: ${insErr?.message}`)
    generationId = created.id

    let subjectName: string | undefined
    if (session.subject_id) {
      const { data: person } = await supabase
        .from('people')
        .select('name')
        .eq('id', session.subject_id)
        .maybeSingle()
      subjectName = person?.name
    }

    const result = await callModel({
      system: buildSystemPrompt(schema),
      user: buildUserPrompt({
        schema,
        transcript: renderTranscript(lines),
        context: {
          Titular: subjectName,
          Data: new Date(session.started_at).toLocaleDateString(session.locale ?? 'pt-BR'),
          'Duração (min)': String(Math.round((session.audio_duration_ms ?? 0) / 60000)),
        },
      }),
      model: body.model,
    })

    const markdown = result.text.trim()

    await supabase
      .from('plg_scribe_generations')
      .update({
        status: 'ready',
        // `markdown` é escrito uma vez e nunca mais. A edição do humano vai
        // para `markdown_edited`, e a diferença entre os dois é a prova de que
        // alguém revisou.
        markdown,
        title: deriveTitle(markdown, name),
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generationId)

    await supabase
      .from('plg_scribe_sessions')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    return json({ ok: true, generationId, markdown, model: result.model })
  } catch (err) {
    const message = String((err as Error)?.message ?? err)
    if (generationId) {
      await supabase
        .from('plg_scribe_generations')
        .update({ status: 'failed', error: message.slice(0, 500), updated_at: new Date().toISOString() })
        .eq('id', generationId)
    }
    return json({ error: message }, 500)
  }
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
