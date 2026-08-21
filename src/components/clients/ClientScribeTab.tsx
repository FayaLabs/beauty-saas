import React, { useCallback, useEffect, useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'
import { Badge, Card, CardContent, Skeleton } from '@fayz-ai/saas/ui'
import { tl } from '@fayz-ai/saas'
import {
  ScribeLivePanel,
  ScribeSessionPage,
  fetchSessionsForSubject,
  formatElapsed,
  isCaptureSupported,
  useScribeStore,
  type ScribeSession,
} from '@fayz-ai/plugin-scribe'
import { beautyScribeOptions } from '../../config/scribe'

// ---------------------------------------------------------------------------
// O histórico de atendimentos gravados na ficha do cliente.
//
// O verbo NÃO mora mais aqui. "Iniciar atendimento" é widget do plugin-scribe
// na zona `clients.detail.header.actions` do CrudDetailPage — ao lado de
// Editar, que é onde uma ação primária pertence. Uma aba é um lugar, não um
// botão: enquanto o verbo esteve aqui, era preciso descobrir a aba para achar
// a ação.
//
// Esta aba sobrou com o que de fato é conteúdo: a gravação em curso (com a
// transcrição correndo) e o histórico das anteriores. Ela só é registrada
// quando o widget do plugin existe (`requiresWidgetZone` em types/client.ts),
// ou seja, quando o plugin está ligado no tenant.
//
// A transcrição ao vivo aparece AQUI e não numa aba própria do assistente: o
// lugar de tudo que é daquele encontro é o encontro, não uma segunda tela
// paralela. O assistente mantém só o controle (pill do FAB e barra) — que é o
// que precisa existir quando a pessoa está longe desta ficha.
//
// Abrir uma gravação também não sai daqui: é mestre-detalhe DENTRO da aba. A
// rota `#/scribe/:id` trocava a página inteira, e com ela o contexto — o nome
// do cliente, as outras abas, o caminho de volta. Voltar de lá caía na lista de
// gravações solta, não na ficha de onde a pessoa saiu.
//
// E mestre-detalhe DENTRO da aba não quer dizer escondido da URL: a gravação
// aberta é o segmento depois de `/scribe` (ver `tabPath` no CrudDetailPage), o
// que a torna linkável sem ela virar uma página. É por ali que o assistente
// entrega o atendimento recém-encerrado.
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  recording: tl('Recording', 'Gravando'),
  paused: tl('Paused', 'Pausado'),
  interrupted: tl('Interrupted', 'Interrompido'),
  uploading: tl('Uploading', 'Enviando'),
  transcribing: tl('Transcribing', 'Transcrevendo'),
  ready: tl('Ready', 'Pronto'),
  generating: tl('Draft', 'Rascunho'),
  completed: tl('Completed', 'Concluído'),
  abandoned: tl('Discarded', 'Descartado'),
  failed: tl('Failed', 'Falhou'),
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function ClientScribeTab({
  item,
  tabPath,
  setTabPath,
}: {
  item?: { id?: string; personId?: string; name?: string }
  /** Segmentos depois de `/scribe` na URL — ver CrudDetailPage.tabPath. */
  tabPath?: string[]
  setTabPath?: (...segments: string[]) => void
}) {
  const [sessions, setSessions] = useState<ScribeSession[]>([])
  const [loading, setLoading] = useState(true)

  // A gravação aberta ANDA COM a URL: `/clients/:id/scribe` lista,
  // `/clients/:id/scribe/:gravacao` abre aquela. É o que faz o link ser
  // compartilhável e o que deixa o assistente mandar alguém para cá ao encerrar
  // — sem trocar a página inteira, como a rota `#/scribe/:id` fazia.
  //
  // Estado local espelhando a URL, e não a URL direto: quem escreve usa
  // `replaceState`, que não dispara `hashchange`, então o clique na lista não
  // repintaria nada. O efeito cobre o caminho contrário — a URL mudando por
  // fora (link colado, ou o fim de uma gravação) manda na tela.
  const [openSessionId, setOpenSessionId] = useState<string | null>(tabPath?.[0] ?? null)
  const deepLinked = tabPath?.[0] ?? null
  useEffect(() => setOpenSessionId(deepLinked), [deepLinked])

  const openSession = useCallback((id: string | null) => {
    setOpenSessionId(id)
    setTabPath?.(...(id ? [id] : []))
  }, [setTabPath])

  // `clients` é a tabela de extensão; o titular da sessão é a linha de `people`.
  const subjectId = item?.personId ?? item?.id

  // Redesenha a lista quando a gravação corrente termina, para a sessão nova
  // aparecer sem o usuário precisar recarregar a ficha.
  const captureState = useScribeStore((s) => s.state)

  const load = useCallback(async () => {
    if (!subjectId) return
    setLoading(true)
    try {
      setSessions(await fetchSessionsForSubject(subjectId))
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [subjectId])

  useEffect(() => {
    void load()
  }, [load, captureState])

  const supported = isCaptureSupported()
  // A gravação em curso é DESTE cliente? Duas fichas abertas não podem exibir
  // a mesma sessão como se fosse de ambas.
  const liveSubjectId = useScribeStore((s) => s.subjectId)
  const liveState = useScribeStore((s) => s.state)
  const isLiveHere =
    !!subjectId &&
    liveSubjectId === subjectId &&
    (liveState === 'recording' || liveState === 'paused' || liveState === 'interrupted')

  if (openSessionId) {
    return (
      <ScribeSessionPage
        sessionId={openSessionId}
        embedded
        labels={beautyScribeOptions.labels as never}
        presets={beautyScribeOptions.templatePresets ?? []}
        stt={beautyScribeOptions.stt}
        // O default do plugin quando a vertical não declara um.
        generateEndpoint={beautyScribeOptions.generateEndpoint ?? 'scribe-generate'}
        onBack={() => openSession(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {isLiveHere && (
        <div className="overflow-hidden rounded-xl border">
          <ScribeLivePanel
            labels={beautyScribeOptions.labels as never}
            // Finalizar abre a gravação recém-encerrada aqui mesmo, não numa
            // página que apaga a ficha de onde ela veio.
            onOpenSession={(id) => openSession(id)}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{tl('Recorded sessions', 'Atendimentos gravados')}</h3>
          <p className="text-xs text-muted-foreground">
            {tl(
              'Record the session and generate the document automatically.',
              'Grave o atendimento e gere o documento automaticamente.',
            )}
          </p>
        </div>
      </div>

      {!supported && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          {tl(
            'Audio recording is unavailable in this browser. Use Chrome, Edge or Safari.',
            'A gravação de áudio não está disponível neste navegador. Use Chrome, Edge ou Safari.',
          )}
        </p>
      )}

      {loading ? (
        // Esqueleto no formato das linhas que vêm, não um spinner: a lista já
        // ocupa o espaço final, então a chegada dos dados não empurra a página
        // — e quem olha entende o que está sendo carregado.
        <div className="space-y-2" aria-busy="true" aria-label={tl('Loading recordings', 'Carregando gravações')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">{tl('No recorded sessions yet', 'Nenhum atendimento gravado')}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {tl(
                'Start a session and keep using the app normally — recording continues while you navigate.',
                'Inicie um atendimento e continue usando o app normalmente — a gravação segue enquanto você navega.',
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => openSession(session.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{formatDate(session.startedAt)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatElapsed(session.audioDurationMs)}
                  {session.transcribedSegmentCount > 0 && ` · ${session.transcriptChars} caracteres`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {session.status === 'completed' && <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                <Badge variant={session.status === 'completed' ? 'secondary' : 'outline'}>
                  {STATUS_LABELS[session.status] ?? session.status}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
