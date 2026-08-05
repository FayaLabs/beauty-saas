// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-scribe → src/types.ts
// Edite no repo do plugin e rode: npm run functions:sync
// ---------------------------------------------------------------------------
// Vocabulário do scribe — deliberadamente neutro de vertical.
//
// Um "session" é um encontro gravado: atendimento no salão, consulta na
// clínica, reunião no escritório de advocacia. O "subject" é a pessoa sobre
// quem o encontro é (linha de `people`), o "operator" é quem conduz. Nada aqui
// diz paciente, prontuário ou consulta — a vertical fornece isso via `labels`.
// Se um tipo neste arquivo precisar de uma palavra clínica, a abstração falhou.
// ---------------------------------------------------------------------------

/**
 * Estado da sessão do lado do SERVIDOR. Avança só por fato durável: um segmento
 * que chegou no Storage, uma transcrição que voltou do provedor. O estado do
 * cliente (que pode morrer a qualquer instante) vive separado em `CaptureState`.
 */
export type SessionStatus =
  | 'recording'
  | 'paused'
  | 'interrupted'
  | 'uploading'
  | 'transcribing'
  | 'ready'
  | 'generating'
  | 'completed'
  | 'abandoned'
  | 'failed'

/** Estados em que a sessão ainda é "de alguém" — usados no índice parcial e na recuperação. */
export const OPEN_SESSION_STATUSES: SessionStatus[] = [
  'recording', 'paused', 'interrupted', 'uploading', 'transcribing', 'ready', 'generating',
]

/**
 * Estado da CAPTURA no cliente. Separado de `SessionStatus` de propósito: este
 * morre com a aba, aquele não. `interrupted` é o estado honesto entre "o mic
 * sumiu" e "o usuário decidiu o que fazer" — não colapsar em `paused`, porque
 * pausa é intenção e interrupção é acidente, e a transcrição precisa saber a
 * diferença para gravar o buraco.
 */
export type CaptureState =
  | 'idle'
  | 'consent'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'interrupted'
  | 'stopping'
  | 'error'

/** A que o encontro está preso. `standalone` é gravar primeiro e anexar depois. */
export type SessionContextKind = 'person' | 'appointment' | 'standalone'

/**
 * Base legal registrada no momento da gravação. Não é enfeite: o titular ter
 * consentido é o que separa a gravação de um problema, e "quando" e "como" é o
 * que se prova depois. `implied_contract` cobre o caso em que a gravação é
 * parte do serviço contratado por escrito.
 */
export type ConsentMode = 'verbal' | 'written' | 'implied_contract'

export type UploadState = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'missing'
export type SttState = 'pending' | 'running' | 'done' | 'failed' | 'skipped'
export type GenerationStatus = 'pending' | 'running' | 'ready' | 'failed' | 'committed' | 'discarded'

// ---------------------------------------------------------------------------
// Linhas do servidor
// ---------------------------------------------------------------------------

export interface ScribeSession {
  id: string
  tenantId: string
  subjectId?: string
  subjectName?: string
  contextKind: SessionContextKind
  appointmentId?: string
  ownerUserId: string
  status: SessionStatus
  locale: string
  mimeType?: string
  startedAt: string
  endedAt?: string
  /** Relógio de parede reportado pelo cliente. Move o pill; não vale como registro. */
  wallDurationMs: number
  /** SUM(segments.duration_ms). A única duração que vale para registro, limite e fatura. */
  audioDurationMs: number
  segmentCount: number
  uploadedSegmentCount: number
  transcribedSegmentCount: number
  transcriptChars: number
  consentAt?: string
  consentMode?: ConsentMode
  retentionUntil?: string
  audioDeletedAt?: string
  error?: string
  metadata: Record<string, unknown>
}

/** Uma palavra com offset RELATIVO ao início do segmento que a contém. */
export interface TranscriptWord {
  /** word */
  w: string
  /** start ms, relativo ao segmento */
  s: number
  /** end ms, relativo ao segmento */
  e: number
  /** confidence 0..1 */
  c?: number
  /** speaker index, quando há diarização */
  sp?: number
}

export interface ScribeSegment {
  sessionId: string
  segIndex: number
  tenantId: string
  storagePath?: string
  bytes?: number
  /** Offset do início deste segmento desde o início da sessão. */
  startOffsetMs: number
  /** Vem da resposta do STT, não de um relógio JS. */
  durationMs?: number
  /** Montado a partir de pieces de um segmento que foi interrompido no meio. */
  partial: boolean
  /**
   * Linha SINTÉTICA marcando um buraco (sono, mic perdido, permissão revogada).
   * Não tem áudio. Existe para a transcrição admitir o buraco em vez de emendar
   * silenciosamente dois momentos — requisito médico-legal, não polimento.
   */
  gap: boolean
  uploadState: UploadState
  uploadedAt?: string
  sttState: SttState
  sttProvider?: string
  sttAttempts: number
  sttError?: string
  text?: string
  words?: TranscriptWord[]
  confidence?: number
}

export interface ScribeGeneration {
  id: string
  tenantId: string
  sessionId: string
  /** Linha de template do tenant. NULL quando a geração veio de um preset de código. */
  templateId?: string
  /** Chave do preset (`beauty.anamnesis.v1`) quando não há linha. */
  templateKey?: string
  tabOrder: number
  title?: string
  status: GenerationStatus
  /** Saída do modelo. Escrita uma vez, NUNCA mutada. */
  markdown?: string
  /** Cópia de trabalho do humano. É a diferença entre as duas que prova revisão. */
  markdownEdited?: string
  /** Extração stage-1 (two-stage). Reservado; a coluna existe desde o v0 de propósito. */
  facts?: Record<string, unknown>
  model?: string
  promptVersion?: string
  inputTokens?: number
  outputTokens?: number
  error?: string
  documentId?: string
  createdBy?: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Templates narrativos
//
// Um template narrativo descreve SEÇÕES DE PROSA, não campos de formulário. É o
// ponto exato onde uma vertical se expressa: as mesmas engines de captura,
// transcrição e geração servem uma anamnese e uma minuta — só a lista de seções
// muda. Vive em `plg_forms_templates.schema` discriminado por `kind`.
// ---------------------------------------------------------------------------

export type SectionShape = 'prose' | 'bullets' | 'keyvalue'

export interface NarrativeSectionDef {
  /** Chave estável de máquina. NUNCA traduzida — é o que sobrevive a renomear o heading. */
  id: string
  /** Vira `## <heading>` no markdown. Traduzível. */
  heading: string
  /**
   * O único prompt por seção que o modelo vê. Escreva como instrução a um
   * júnior: o que entra aqui, o que não entra, em que voz.
   */
  guidance: string
  /**
   * Controla a FORMA do markdown. `keyvalue` existe para dado estruturado sair
   * como `- **Rótulo:** valor` em vez de tabela de pipes — o renderer do SDK não
   * tem tabela, e A4 quebrado imprime lixo.
   */
  shape?: SectionShape
  required?: boolean
  /** Some com a seção inteira (heading incluso) quando a transcrição não disse nada. */
  omitWhenEmpty?: boolean
  maxWords?: number
  /** Chaves de fato que esta seção consome no modo two-stage. Reservado. */
  facts?: string[]
}

/** De onde o cabeçalho puxa cada campo. Resolvido de DADO, nunca pedido ao modelo. */
export type NarrativeHeaderSource =
  | 'subject.name'
  | 'subject.documentNumber'
  | 'subject.birthDate'
  | 'session.startedAt'
  | 'session.durationMinutes'
  | 'operator.name'
  | (string & {})

export interface NarrativeSchema {
  kind: 'narrative'
  sections: NarrativeSectionDef[]
  /** Tom, pessoa, tempo verbal, nível de jargão. Injetado antes das seções. */
  style?: string
  /** Idioma da SAÍDA, independente do idioma da transcrição. */
  outputLocale?: string
  /** Bloco acima da primeira seção, resolvido de dados. */
  header?: { fields: Array<{ label: string; source: NarrativeHeaderSource }> }
  /** Rodapé. Ex.: 'Documento gerado por IA a partir de gravação, revisado pelo profissional.' */
  disclaimer?: string
  /**
   * Coisas que o modelo deve declarar como "não informado" em vez de inferir.
   * Ex.: ['diagnóstico', 'dosagem', 'CID']. É a linha entre resumir e inventar.
   */
  neverInfer?: string[]
}

export function isNarrativeSchema(schema: unknown): schema is NarrativeSchema {
  return !!schema && typeof schema === 'object' && (schema as NarrativeSchema).kind === 'narrative'
}

/**
 * Template de sistema, definido em CÓDIGO e não em seed SQL. Corrigir um prompt
 * vira release em vez de migration mexendo em linha que o usuário talvez editou,
 * e o padrão não consome a cota de templates do tenant. O usuário "forka" para
 * personalizar, e o fork aí sim vira linha.
 */
export interface NarrativeTemplatePreset {
  /** Versionado na própria chave: `beauty.anamnesis.v1`. */
  key: string
  name: string
  description?: string
  /** Categoria do plugin-forms: anamnesis | evolution | report | contract | general. */
  category: string
  specialty?: string
  schema: NarrativeSchema
}

// ---------------------------------------------------------------------------
// Configuração do plugin — a superfície inteira de uma vertical
// ---------------------------------------------------------------------------

export interface ScribeLabels {
  /** "Atendimento" / "Consulta" / "Reunião" */
  sessionSingular: string
  sessionPlural: string
  /** "Iniciar atendimento" */
  start: string
  pause: string
  resume: string
  finish: string
  discard: string
  /** "Gerar documento" / "Gerar minuta" */
  generate: string
  /** "Cliente" / "Paciente" */
  subject: string
  transcript: string
  settingsTitle: string
}

export interface ScribeSttConfig {
  /** Provedor por trás de um seam de um método — trocar não deve ser refactor. */
  provider: 'deepgram' | 'openai'
  model?: string
  locale: string
  diarize?: boolean
  /**
   * Nome da edge function que faz a transcrição. SEM ISSO O PLUGIN NÃO SOBE:
   * cair no reconhecedor nativo do browser mandaria áudio de saúde para um
   * terceiro não declarado. Ver o invariante em `createScribePlugin`.
   */
  endpoint: string
}

export interface ScribeRetentionConfig {
  /** Dias até o áudio poder ser apagado. Transcrição e documento sobrevivem. */
  audioDays: number
  /** Quando true, nenhum byte é gravado antes do gate de consentimento. */
  requireConsent: boolean
  defaultConsentMode: ConsentMode
}

export interface ScribeLimitsConfig {
  minutesMonth?: string
  documentsMonth?: string
}

export interface ScribePluginOptions {
  /** `kind` da linha de `people` que pode ser titular ('customer', 'client', …). */
  subjectKind?: string
  contextEntities?: string[]
  labels?: Partial<ScribeLabels>
  /** Os templates padrão da vertical. O ÚNICO código novo que uma vertical escreve. */
  templatePresets?: NarrativeTemplatePreset[]
  stt: ScribeSttConfig
  retention?: Partial<ScribeRetentionConfig>
  limits?: ScribeLimitsConfig
  /** Nome da edge function de geração. */
  generateEndpoint?: string
  scope?: 'universal' | 'vertical'
  verticalId?: string
}
