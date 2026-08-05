import { tl } from '@fayz-ai/saas'
import type { NarrativeTemplatePreset, ScribePluginOptions } from '@fayz-ai/plugin-scribe'

// ---------------------------------------------------------------------------
// Scribe — a vertical de beleza expressa em dados, e só em dados.
//
// Este arquivo é a superfície INTEIRA da vertical. O plugin não sabe o que é um
// salão: ele grava uma "session" sobre um "subject" conduzida por um "operator".
// Quem diz que session se chama Atendimento e que o documento se chama Anamnese
// é aqui.
//
// O teste da abstração é este: um app de advocacia deve precisar trocar apenas
// os `labels` e o array de `templatePresets`. Se precisar tocar em qualquer
// outra coisa, a abstração falhou e o conserto é no SDK, não aqui.
// ---------------------------------------------------------------------------

const STYLE_BEAUTY =
  'Terceira pessoa, tempo passado, português do Brasil. Tom profissional e objetivo, ' +
  'sem jargão desnecessário. Sem tabelas, sem links, sem blocos de código. Títulos no máximo em nível ###.'

const DISCLAIMER =
  'Documento gerado por IA a partir da gravação do atendimento e revisado pelo profissional responsável.'

/**
 * Itens que o modelo NUNCA pode inferir. A lista não é genérica de propósito —
 * ela nomeia exatamente o que, num contexto de estética, causa dano se for
 * chutado: alergia que ninguém declarou, contraindicação deduzida do contexto,
 * concentração de ativo que o profissional não falou em voz alta.
 */
const NEVER_INFER = [
  'alergia não mencionada explicitamente',
  'contraindicação',
  'concentração ou dosagem de ativo',
  'diagnóstico clínico',
]

export const beautyAnamnesisPreset: NarrativeTemplatePreset = {
  key: 'beauty.anamnesis.v1',
  name: tl('Anamnesis', 'Anamnese'),
  description: tl(
    'First-visit intake from the recorded session',
    'Ficha de primeira avaliação a partir do atendimento gravado',
  ),
  category: 'anamnesis',
  schema: {
    kind: 'narrative',
    style: STYLE_BEAUTY,
    outputLocale: 'pt-BR',
    neverInfer: NEVER_INFER,
    disclaimer: DISCLAIMER,
    sections: [
      {
        id: 'main_concern',
        heading: tl('Main Concern', 'Queixa Principal'),
        guidance:
          'O motivo da visita, nas palavras do cliente. Uma a três frases. Não interprete nem traduza para termo técnico.',
        shape: 'prose',
        required: true,
      },
      {
        id: 'history',
        heading: tl('History', 'Histórico'),
        guidance:
          'Há quanto tempo, o que já tentou, o que funcionou e o que não funcionou, procedimentos anteriores e quando.',
        shape: 'prose',
      },
      {
        id: 'health_context',
        heading: tl('Health Context', 'Condições de Saúde'),
        guidance:
          'Alergias, medicamentos em uso, gestação/amamentação, condições de pele e restrições — SOMENTE o que foi dito. ' +
          'Para cada item que a seção pede e não foi mencionado, escreva "não informado".',
        shape: 'keyvalue',
        required: true,
      },
      {
        id: 'routine',
        heading: tl('Current Routine', 'Rotina Atual'),
        guidance: 'Produtos e cuidados que o cliente já faz em casa, frequência, hábitos relevantes.',
        shape: 'bullets',
        omitWhenEmpty: true,
      },
      {
        id: 'plan',
        heading: tl('Plan', 'Conduta'),
        guidance: 'O que foi combinado: procedimentos, número de sessões, intervalo, orientações de cuidado.',
        shape: 'bullets',
        required: true,
      },
    ],
  },
}

export const beautyEvolutionPreset: NarrativeTemplatePreset = {
  key: 'beauty.evolution.v1',
  name: tl('Session Note', 'Evolução'),
  description: tl('Follow-up note for a returning client', 'Registro de evolução de um atendimento de retorno'),
  category: 'evolution',
  schema: {
    kind: 'narrative',
    style: STYLE_BEAUTY,
    outputLocale: 'pt-BR',
    neverInfer: NEVER_INFER,
    disclaimer: DISCLAIMER,
    sections: [
      {
        id: 'since_last',
        heading: tl('Since Last Visit', 'Desde o Último Atendimento'),
        guidance: 'O que o cliente relatou sobre o período: resultado percebido, reações, adesão à orientação.',
        shape: 'prose',
        required: true,
      },
      {
        id: 'performed',
        heading: tl('Performed Today', 'Realizado Hoje'),
        guidance:
          'Procedimentos executados nesta sessão, com produtos e parâmetros SE tiverem sido ditos em voz alta. ' +
          'Não complete parâmetro que não foi mencionado.',
        shape: 'keyvalue',
        required: true,
      },
      {
        id: 'observations',
        heading: tl('Observations', 'Observações'),
        guidance: 'Reação durante a sessão, intercorrências, o que o profissional observou.',
        shape: 'prose',
        omitWhenEmpty: true,
      },
      {
        id: 'next_steps',
        heading: tl('Next Steps', 'Próximos Passos'),
        guidance: 'Retorno combinado, cuidados domiciliares, o que observar até a próxima sessão.',
        shape: 'bullets',
        required: true,
      },
    ],
  },
}

export const beautyScribeOptions: ScribePluginOptions = {
  subjectKind: 'customer',
  contextEntities: ['person', 'appointment'],
  labels: {
    sessionSingular: tl('Session', 'Atendimento'),
    sessionPlural: tl('Sessions', 'Atendimentos'),
    start: tl('Start session', 'Iniciar atendimento'),
    pause: tl('Pause', 'Pausar'),
    resume: tl('Resume', 'Retomar'),
    finish: tl('Finish', 'Finalizar'),
    discard: tl('Discard', 'Descartar'),
    generate: tl('Generate', 'Gerar'),
    subject: tl('Client', 'Cliente'),
    transcript: tl('Transcript', 'Transcrição'),
    settingsTitle: tl('Session recording', 'Gravação de atendimentos'),
  },
  templatePresets: [beautyAnamnesisPreset, beautyEvolutionPreset],
  stt: {
    // A API do fayz — o MESMO broker que o assistente do app já usa. A chave do
    // modelo fica lá; aqui não existe secret nenhum para configurar nem edge
    // function nenhuma para fazer deploy. Isso não é conveniência: o
    // `google-calendar-sync` está neste repositório há meses e nunca subiu,
    // porque não há processo de deploy de edge function.
    transport: 'fayz',
    provider: 'openai',
    // whisper-1 é o único que devolve duração e offset por palavra. A duração é
    // o número AUTORITATIVO da sessão — o que conta na cota e no registro — e os
    // offsets são o que um dia permite clicar numa frase do documento e cair no
    // segundo do áudio de onde ela veio. Os gpt-4o-*-transcribe costumam ser
    // melhores em pt-BR mas devolvem só texto; trocar é editar esta linha, e o
    // preço é perder as duas coisas acima.
    model: 'whisper-1',
    locale: 'pt-BR',
    // Sem efeito neste transporte: quem diariza é o Deepgram, que exige
    // `transport: 'edge'`. Fica declarado porque é a diferença conhecida entre
    // os dois caminhos, e é o motivo mais provável de voltarmos ao 'edge'.
    diarize: false,
  },
  retention: {
    audioDays: 90,
    requireConsent: true,
    // O salão pede o consentimento em voz alta no início; o profissional
    // confirma no diálogo. Advocacia usaria 'written'.
    defaultConsentMode: 'verbal',
  },
  limits: {
    minutesMonth: 'scribe_minutes_month',
    documentsMonth: 'scribe_documents_month',
  },
}
