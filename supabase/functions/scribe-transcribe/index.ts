// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-scribe/functions/scribe-transcribe
// Edite no repo do plugin e rode: npm run functions:sync
// scribe-transcribe — transcreve os segmentos de áudio de uma sessão.
//
// Ações:
//   drain   → transcreve tudo o que está pendente numa sessão (o caso normal)
//   segment → transcreve um segmento específico (retry manual / debug)
//
// Env: DEEPGRAM_API_KEY (ou OPENAI_API_KEY), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// ---------------------------------------------------------------------------
// Por que a credencial mora aqui e não no browser
// ---------------------------------------------------------------------------
// Duas razões, e a segunda é a que importa. A primeira é óbvia: uma chave de STT
// no bundle é uma chave pública. A segunda é que o áudio deste bucket é privado
// e o browser não tem — nem deve ter — permissão para mandá-lo a um terceiro.
// A função lê com service key e fala com o provedor; a fronteira do dado
// sensível fica em um lugar só, auditável.
//
// ---------------------------------------------------------------------------
// Por que por SEGMENTO e não o arquivo inteiro
// ---------------------------------------------------------------------------
// Custo é IGUAL nos dois provedores (cobram por minuto de áudio, não por
// requisição), então custo não decide. Decide o modo de falha:
//
//   - o texto aparece DURANTE a consulta, que é o requisito de produto
//   - o request tem tamanho limitado (2 h de sessão estoura o teto de 25 MB do
//     Whisper num arquivo só; segmentado, o teto some do mapa)
//   - um segmento envenenado perde 30 s, não 40 minutos
//   - retry é uma coluna, não um reprocessamento inteiro
//   - quem para no minuto 12 tem 12 minutos de transcrição
//
// ---------------------------------------------------------------------------
// Contexto de fronteira
// ---------------------------------------------------------------------------
// Rotacionar o gravador a cada 30 s corta palavras na emenda. Mitigação barata:
// semear cada request com a CAUDA do texto do segmento anterior (`prompt` no
// Whisper, `keyterm` no Deepgram). O provedor usa isso como pista de contexto e
// a emenda para de comer nome próprio e termo técnico.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AUDIO_BUCKET = 'scribe-audio'
/** Quantos segmentos transcrevem em paralelo por invocação. */
const CONCURRENCY = 3
/** Teto de tentativas antes de desistir de um segmento e seguir com o resto. */
const MAX_ATTEMPTS = 4
/** Quantos caracteres do segmento anterior viram pista de contexto. */
const CONTEXT_TAIL_CHARS = 200

interface TranscriptWord {
  w: string
  s: number
  e: number
  c?: number
  sp?: number
}

interface SttResult {
  text: string
  words: TranscriptWord[]
  durationMs: number
  confidence: number
  provider: string
}

// ---------------------------------------------------------------------------
// Deepgram
// ---------------------------------------------------------------------------

async function transcribeDeepgram(
  audio: ArrayBuffer,
  mimeType: string,
  opts: { locale: string; diarize: boolean; model: string; context?: string },
): Promise<SttResult> {
  const key = Deno.env.get('DEEPGRAM_API_KEY')
  if (!key) throw new Error('DEEPGRAM_API_KEY não configurada')

  const params = new URLSearchParams({
    model: opts.model,
    language: opts.locale,
    punctuate: 'true',
    smart_format: 'true',
    diarize: String(opts.diarize),
  })
  // `keyterm` só existe no Nova-3; mandar em outro modelo é erro 400.
  if (opts.context && opts.model.startsWith('nova-3')) {
    for (const term of extractKeyterms(opts.context)) params.append('keyterm', term)
  }

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': mimeType },
    body: audio,
  })
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text()}`)

  const json = await res.json()
  const alt = json?.results?.channels?.[0]?.alternatives?.[0]
  const words: TranscriptWord[] = (alt?.words ?? []).map((w: any) => ({
    w: w.punctuated_word ?? w.word,
    s: Math.round((w.start ?? 0) * 1000),
    e: Math.round((w.end ?? 0) * 1000),
    c: w.confidence,
    sp: w.speaker,
  }))

  return {
    text: alt?.transcript ?? '',
    words,
    durationMs: Math.round((json?.metadata?.duration ?? 0) * 1000),
    confidence: alt?.confidence ?? 0,
    provider: `deepgram:${opts.model}`,
  }
}

/**
 * Termos que valem como pista: palavras longas o bastante para serem nome
 * próprio ou jargão. Artigo e preposição não ajudam o reconhecedor e só gastam
 * espaço no limite de keyterms.
 */
function extractKeyterms(context: string): string[] {
  const seen = new Set<string>()
  for (const word of context.split(/\s+/)) {
    const clean = word.replace(/[^\p{L}\p{N}-]/gu, '')
    if (clean.length >= 6) seen.add(clean)
    if (seen.size >= 10) break
  }
  return [...seen]
}

// ---------------------------------------------------------------------------
// OpenAI (o segundo provedor atrás do mesmo seam)
// ---------------------------------------------------------------------------

async function transcribeOpenAI(
  audio: ArrayBuffer,
  mimeType: string,
  opts: { locale: string; model: string; context?: string },
): Promise<SttResult> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) throw new Error('OPENAI_API_KEY não configurada')

  const form = new FormData()
  form.append('file', new Blob([audio], { type: mimeType }), 'segment.webm')
  form.append('model', opts.model)
  form.append('language', opts.locale.slice(0, 2))
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')
  if (opts.context) form.append('prompt', opts.context)

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)

  const json = await res.json()
  const words: TranscriptWord[] = (json?.words ?? []).map((w: any) => ({
    w: w.word,
    s: Math.round((w.start ?? 0) * 1000),
    e: Math.round((w.end ?? 0) * 1000),
  }))

  return {
    text: json?.text ?? '',
    words,
    durationMs: Math.round((json?.duration ?? 0) * 1000),
    confidence: 0,
    provider: `openai:${opts.model}`,
  }
}

// ---------------------------------------------------------------------------
// O seam de UM método
// ---------------------------------------------------------------------------

function transcribe(
  audio: ArrayBuffer,
  mimeType: string,
  opts: { provider: string; model?: string; locale: string; diarize: boolean; context?: string },
): Promise<SttResult> {
  if (opts.provider === 'openai') {
    return transcribeOpenAI(audio, mimeType, {
      locale: opts.locale,
      model: opts.model ?? 'whisper-1',
      context: opts.context,
    })
  }
  return transcribeDeepgram(audio, mimeType, {
    locale: opts.locale,
    diarize: opts.diarize,
    model: opts.model ?? 'nova-3',
    context: opts.context,
  })
}

// ---------------------------------------------------------------------------
// Drenagem
// ---------------------------------------------------------------------------

async function drainSession(
  supabase: any,
  sessionId: string,
  provider: string,
  model: string | undefined,
  diarize: boolean,
): Promise<{ transcribed: number; failed: number; remaining: number }> {
  const { data: session, error: sessionErr } = await supabase
    .from('plg_scribe_sessions')
    .select('id, tenant_id, locale, mime_type, status')
    .eq('id', sessionId)
    .single()
  if (sessionErr || !session) throw new Error('sessão não encontrada')

  const { data: pending } = await supabase
    .from('plg_scribe_segments')
    .select('session_id, seg_index, storage_path, stt_attempts')
    .eq('session_id', sessionId)
    .eq('upload_state', 'uploaded')
    .in('stt_state', ['pending', 'failed'])
    .lt('stt_attempts', MAX_ATTEMPTS)
    .order('seg_index', { ascending: true })

  if (!pending || pending.length === 0) {
    await maybeMarkReady(supabase, sessionId)
    return { transcribed: 0, failed: 0, remaining: 0 }
  }

  let transcribed = 0
  let failed = 0

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (seg: any) => {
        if (!seg.storage_path) return { ok: false }
        try {
          // Marcar `running` ANTES de baixar: duas invocações concorrentes
          // (browser + cron) veriam o mesmo segmento pendente, e transcrever
          // duas vezes é dinheiro jogado fora.
          await supabase
            .from('plg_scribe_segments')
            .update({ stt_state: 'running', stt_attempts: (seg.stt_attempts ?? 0) + 1, updated_at: new Date().toISOString() })
            .eq('session_id', seg.session_id)
            .eq('seg_index', seg.seg_index)

          const { data: file, error: dlErr } = await supabase.storage
            .from(AUDIO_BUCKET)
            .download(seg.storage_path)
          if (dlErr || !file) throw new Error(`download falhou: ${dlErr?.message ?? 'sem corpo'}`)

          const context = await previousTail(supabase, sessionId, seg.seg_index)
          const audio = await file.arrayBuffer()
          const result = await transcribe(audio, session.mime_type ?? 'audio/webm', {
            provider,
            model,
            locale: session.locale ?? 'pt-BR',
            diarize,
            context,
          })

          await supabase
            .from('plg_scribe_segments')
            .update({
              stt_state: 'done',
              stt_provider: result.provider,
              stt_error: null,
              text: result.text,
              words: result.words,
              confidence: result.confidence,
              // A duração AUTORITATIVA: medida no áudio, não contada no JS.
              duration_ms: result.durationMs > 0 ? result.durationMs : null,
              updated_at: new Date().toISOString(),
            })
            .eq('session_id', seg.session_id)
            .eq('seg_index', seg.seg_index)

          return { ok: true }
        } catch (err) {
          await supabase
            .from('plg_scribe_segments')
            .update({
              stt_state: 'failed',
              stt_error: String((err as Error)?.message ?? err).slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq('session_id', seg.session_id)
            .eq('seg_index', seg.seg_index)
          return { ok: false }
        }
      }),
    )
    transcribed += results.filter((r) => r.ok).length
    failed += results.filter((r) => !r.ok).length
  }

  await recomputeCounters(supabase, sessionId)
  await maybeMarkReady(supabase, sessionId)

  const { count } = await supabase
    .from('plg_scribe_segments')
    .select('seg_index', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('upload_state', 'uploaded')
    .in('stt_state', ['pending', 'failed'])
    .lt('stt_attempts', MAX_ATTEMPTS)

  return { transcribed, failed, remaining: count ?? 0 }
}

/** Cauda do segmento anterior — a pista de contexto que salva a palavra da emenda. */
async function previousTail(supabase: any, sessionId: string, segIndex: number): Promise<string | undefined> {
  if (segIndex === 0) return undefined
  const { data } = await supabase
    .from('plg_scribe_segments')
    .select('text')
    .eq('session_id', sessionId)
    .eq('seg_index', segIndex - 1)
    .maybeSingle()
  const text = data?.text as string | undefined
  return text ? text.slice(-CONTEXT_TAIL_CHARS) : undefined
}

/**
 * Recalcula os contadores a partir dos segmentos — mesma razão do RPC do
 * cliente: derivar, nunca incrementar.
 */
async function recomputeCounters(supabase: any, sessionId: string): Promise<void> {
  const { data: segs } = await supabase
    .from('plg_scribe_segments')
    .select('stt_state, duration_ms, text, gap')
    .eq('session_id', sessionId)
  if (!segs) return

  const transcribed = segs.filter((s: any) => s.stt_state === 'done').length
  const audioMs = segs.filter((s: any) => !s.gap).reduce((acc: number, s: any) => acc + (s.duration_ms ?? 0), 0)
  const chars = segs.reduce((acc: number, s: any) => acc + (s.text?.length ?? 0), 0)

  await supabase
    .from('plg_scribe_sessions')
    .update({
      transcribed_segment_count: transcribed,
      audio_duration_ms: audioMs,
      transcript_chars: chars,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
}

/**
 * `ready` é decidido no SERVIDOR, a partir do manifesto — assim a transição
 * acontece com ou sem browser aberto.
 *
 * `ready` inclui o caso em que alguns segmentos esgotaram as tentativas: uma
 * sessão com 78 de 80 segmentos transcritos é utilizável, e travá-la em
 * `transcribing` para sempre por causa de dois seria o pior dos dois mundos.
 */
async function maybeMarkReady(supabase: any, sessionId: string): Promise<void> {
  const { data: session } = await supabase
    .from('plg_scribe_sessions')
    .select('status, ended_at')
    .eq('id', sessionId)
    .single()
  if (!session?.ended_at) return
  if (!['uploading', 'transcribing', 'recording', 'paused', 'interrupted'].includes(session.status)) return

  const { data: segs } = await supabase
    .from('plg_scribe_segments')
    .select('stt_state, stt_attempts, upload_state')
    .eq('session_id', sessionId)
  if (!segs || segs.length === 0) return

  const outstanding = segs.filter(
    (s: any) =>
      s.upload_state === 'uploaded' &&
      ['pending', 'running', 'failed'].includes(s.stt_state) &&
      (s.stt_attempts ?? 0) < MAX_ATTEMPTS,
  )
  const nextStatus = outstanding.length === 0 ? 'ready' : 'transcribing'
  await supabase
    .from('plg_scribe_sessions')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const action = body.action ?? 'drain'
    const sessionId = body.sessionId as string
    if (!sessionId) throw new Error('sessionId é obrigatório')

    const provider = (body.provider as string) ?? 'deepgram'
    const model = body.model as string | undefined
    const diarize = body.diarize !== false

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    // A service key contorna a RLS, então a autorização é feita aqui: o JWT do
    // chamador precisa pertencer a um membro do tenant DESTA sessão. Sem esta
    // checagem qualquer usuário logado leria o áudio de qualquer clínica.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'não autenticado' }, 401)

    const { data: caller } = await supabase.auth.getUser(jwt)
    if (!caller?.user) return json({ error: 'não autenticado' }, 401)

    const { data: session } = await supabase
      .from('plg_scribe_sessions')
      .select('tenant_id')
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

    if (action === 'drain') {
      const result = await drainSession(supabase, sessionId, provider, model, diarize)
      return json({ ok: true, ...result })
    }

    return json({ error: `ação desconhecida: ${action}` }, 400)
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500)
  }
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
