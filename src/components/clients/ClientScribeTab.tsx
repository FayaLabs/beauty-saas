import React, { useCallback, useEffect, useState } from 'react'
import { FileText, Mic, Sparkles } from 'lucide-react'
import { Badge, Button, Card, CardContent } from '@fayz-ai/saas/ui'
import { tl } from '@fayz-ai/saas'
import {
  fetchSessionsForSubject,
  formatElapsed,
  isCaptureSupported,
  requestScribeStart,
  useScribeStore,
  type ScribeSession,
} from '@fayz-ai/plugin-scribe'

// ---------------------------------------------------------------------------
// A entrada do atendimento gravado na ficha do cliente.
//
// UMA ABA É A AFFORDANCE ERRADA para um verbo primário — "Iniciar atendimento"
// devia estar no cabeçalho, ao lado de Editar. Mas `CrudDetailPage` não tem
// nenhum ponto de extensão ali: a linha do hero é hardcoded em onEdit/onDelete
// (packages/saas/src/crud/CrudDetailPage.tsx:363-377), e a única outra zona é
// um WidgetSlot que renderiza ABAIXO das abas.
//
// O conserto certo é uma zona `${entityId}.detail.header.actions` no SDK — ~5
// linhas, e toda plugin vai querer ("Iniciar atendimento", "Abrir conversa",
// "Gerar cobrança"). Está listado no v1 do plano. Esta aba destrava o v0 sem
// depender daquele PR.
//
// O disparo é por evento (`scribe:start`), espelhando `agenda:open-booking`
// (src/config/app.tsx:544): a ficha do cliente não passa a depender do scribe.
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

export function ClientScribeTab({ item }: { item?: { id?: string; personId?: string; name?: string } }) {
  const [sessions, setSessions] = useState<ScribeSession[]>([])
  const [loading, setLoading] = useState(true)

  // `clients` é a tabela de extensão; o titular da sessão é a linha de `people`.
  const subjectId = item?.personId ?? item?.id
  const subjectName = item?.name

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

  return (
    <div className="space-y-4">
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
        <Button
          size="sm"
          disabled={!supported || !subjectId}
          onClick={() => requestScribeStart({ subjectId, subjectName })}
          title={
            supported
              ? undefined
              : tl('This browser does not support recording', 'Este navegador não suporta gravação')
          }
        >
          <Mic className="mr-1.5 h-4 w-4" />
          {tl('Start session', 'Iniciar atendimento')}
        </Button>
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
        <p className="py-8 text-center text-sm text-muted-foreground">{tl('Loading…', 'Carregando…')}</p>
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
              onClick={() => {
                window.location.hash = `/scribe/${session.id}`
              }}
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
