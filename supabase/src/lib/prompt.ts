// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-scribe → src/lib/prompt.ts
// Edite no repo do plugin e rode: npm run functions:sync
// ---------------------------------------------------------------------------
// Construção do prompt. Puro, sem dependência — a edge function importa daqui
// para que o prompt tenha UMA definição só. Duas cópias divergindo é como um
// documento gerado no servidor deixa de bater com o que a tela prometeu.
// ---------------------------------------------------------------------------

import type { NarrativeSchema, NarrativeSectionDef } from '../types'

/**
 * Versão do prompt, gravada em `plg_scribe_generations.prompt_version`. Subir
 * este número a cada mudança de forma é o que torna possível responder "por que
 * os documentos de março saíram diferentes dos de abril".
 */
export const PROMPT_VERSION = 'scribe/narrative@1'

export interface TranscriptLine {
  startOffsetMs: number
  text: string
  gap: boolean
  speaker?: number
}

/** `mm:ss` — a marcação que o profissional usa para achar o trecho no áudio. */
export function formatOffset(ms: number): string {
  const total = Math.floor(ms / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Renderiza a transcrição para o modelo. Buracos entram como linha EXPLÍCITA:
 * o modelo precisa saber que houve descontinuidade, senão ele costura os dois
 * lados numa narrativa contínua e inventa a ponte.
 */
export function renderTranscript(lines: TranscriptLine[]): string {
  return lines
    .filter((l) => l.gap || l.text?.trim())
    .map((l) => {
      const at = formatOffset(l.startOffsetMs)
      if (l.gap) return `[${at}] (((TRECHO AUSENTE — a gravação foi interrompida aqui)))`
      const who = l.speaker !== undefined ? `Falante ${l.speaker + 1}: ` : ''
      return `[${at}] ${who}${l.text.trim()}`
    })
    .join('\n')
}

function shapeInstruction(section: NarrativeSectionDef): string {
  switch (section.shape) {
    case 'bullets':
      return 'Formato: lista com hífen. Itens curtos, um fato por item.'
    case 'keyvalue':
      // Lista com rótulo em negrito, e não tabela, porque o renderer do SDK não
      // tem tabela e o print A4 sai quebrado.
      return 'Formato: lista com hífen no padrão `- **Rótulo:** valor`. Um par por linha.'
    default:
      return 'Formato: prosa corrida, sem listas.'
  }
}

export function buildSystemPrompt(schema: NarrativeSchema): string {
  const parts: string[] = []

  parts.push(
    'Você redige documentos a partir da transcrição de um atendimento gravado.',
    'Escreva SOMENTE o que a transcrição sustenta. Você não é um assistente conversacional: sua saída é o documento, nada mais.',
  )

  if (schema.style) parts.push(`Estilo: ${schema.style}`)
  if (schema.outputLocale) parts.push(`Escreva o documento em ${schema.outputLocale}, mesmo que a transcrição esteja em outro idioma.`)

  parts.push(
    '',
    'REGRAS INEGOCIÁVEIS:',
    '- Nunca invente fato, número, data, nome ou medida que não esteja na transcrição.',
    '- Quando a transcrição não cobre algo que a seção pede, escreva "não informado". Não deduza a partir do contexto.',
    '- Onde a transcrição indicar `(((TRECHO AUSENTE)))`, NÃO costure os dois lados como se fossem contínuos. Se aquilo afeta o que a seção diz, registre a lacuna.',
    '- Não dirija a palavra ao leitor, não comente o próprio trabalho, não peça confirmação.',
  )

  if (schema.neverInfer?.length) {
    parts.push(
      `- Estes itens NUNCA podem ser inferidos, apenas transcritos quando ditos explicitamente: ${schema.neverInfer.join(', ')}.`,
    )
  }

  parts.push(
    '',
    'FORMATO DA SAÍDA (markdown restrito):',
    '- Cada seção começa com `## ` seguido exatamente do título fornecido.',
    '- Use no máximo `###` para subtítulo. Nunca `####` ou mais fundo.',
    '- PROIBIDO: tabela, link, imagem, bloco de código cercado por crases, HTML.',
    '- Permitido: parágrafo, lista com hífen, lista numerada, **negrito**, *itálico*.',
    '- Não escreva preâmbulo nem fecho. A primeira linha da resposta é o primeiro `## `.',
  )

  return parts.join('\n')
}

export function buildUserPrompt(args: {
  schema: NarrativeSchema
  transcript: string
  context?: Record<string, string | undefined>
}): string {
  const { schema, transcript, context } = args
  const parts: string[] = []

  const ctx = Object.entries(context ?? {}).filter(([, v]) => v)
  if (ctx.length > 0) {
    // Contexto é DADO, resolvido do banco. Vai como referência para o modelo
    // situar o texto — nunca como algo a ser reproduzido no corpo, senão ele
    // repete o cabeçalho que a tela já renderiza.
    parts.push('DADOS DO ATENDIMENTO (referência; não repita como seção):')
    for (const [k, v] of ctx) parts.push(`- ${k}: ${v}`)
    parts.push('')
  }

  parts.push('TRANSCRIÇÃO:', '"""', transcript, '"""', '')
  parts.push('SEÇÕES A ESCREVER, nesta ordem:')

  schema.sections.forEach((section, i) => {
    parts.push('')
    parts.push(`${i + 1}. ## ${section.heading}`)
    parts.push(`   O que entra: ${section.guidance}`)
    parts.push(`   ${shapeInstruction(section)}`)
    if (section.maxWords) parts.push(`   Limite: cerca de ${section.maxWords} palavras.`)
    if (section.required) parts.push('   Obrigatória: escreva-a mesmo que só para registrar "não informado".')
    else if (section.omitWhenEmpty) parts.push('   Se a transcrição não disser nada sobre isto, OMITA a seção inteira, título incluso.')
  })

  return parts.join('\n')
}

/**
 * Quebra o markdown de volta em seções por `id`, casando os títulos `## `. Serve
 * para o commit gravar `data.sections` e para o assistente reescrever UMA seção
 * sem tocar no resto.
 *
 * Casa por título normalizado porque é o único âncora que o modelo devolve —
 * daí o `id` da seção nunca ser traduzido: ele é a chave, o título é a etiqueta.
 */
export function parseSections(markdown: string, schema: NarrativeSchema): Record<string, string> {
  const out: Record<string, string> = {}
  if (!markdown) return out

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[:.]+$/, '')
  const byHeading = new Map(schema.sections.map((s) => [norm(s.heading), s.id]))

  const lines = markdown.split('\n')
  let currentId: string | null = null
  let buffer: string[] = []

  const flush = () => {
    if (currentId) out[currentId] = buffer.join('\n').trim()
    buffer = []
  }

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (match && !line.startsWith('###')) {
      flush()
      currentId = byHeading.get(norm(match[1])) ?? null
      continue
    }
    if (currentId) buffer.push(line)
  }
  flush()
  return out
}

/** Título do documento: primeira seção com conteúdo, encurtada. Cai no nome do template. */
export function deriveTitle(markdown: string, fallback: string, maxLen = 80): string {
  const firstBody = markdown
    .split('\n')
    .find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('>'))
  if (!firstBody) return fallback
  const clean = firstBody.replace(/[*_`]/g, '').trim()
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean
}
