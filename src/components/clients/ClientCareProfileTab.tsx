import { AlertTriangle, HeartPulse, UserRoundCheck } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import type { EntityDef } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

const lifecycleLabels: Record<string, string> = {
  active: tl('Active', 'Ativo'),
  vip: 'VIP',
  inactive: tl('Inactive', 'Inativo'),
  restricted: tl('Restricted', 'Restrito'),
}

const stageLabels: Record<string, string> = {
  new: tl('New', 'Novo'),
  returning: tl('Returning', 'Recorrente'),
  loyal: tl('Loyal', 'Fidelizado'),
  at_risk: tl('At Risk', 'Em risco'),
}

function textValue(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function labeledValue(labels: Record<string, string>, value: unknown): string {
  const key = textValue(value)
  return labels[key] ?? key
}

export function ClientCareProfileTab({
  item,
}: {
  item: unknown
  entityDef: EntityDef
}) {
  const client = item as Record<string, unknown>
  const lifecycleStatus = labeledValue(lifecycleLabels, client.lifecycleStatus) || lifecycleLabels.active
  const stage = labeledValue(stageLabels, client.stage) || stageLabels.new
  const statusAlert = textValue(client.statusAlert)
  const anamnesisNotes = textValue(client.anamnesisNotes)
  const hasAlert = Boolean(client.hasAnamnesisAlert || statusAlert)

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <UserRoundCheck className="h-3.5 w-3.5" />
              {tl('Client status', 'Status do cliente')}
            </div>
            <Badge variant="secondary">{lifecycleStatus}</Badge>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <HeartPulse className="h-3.5 w-3.5" />
              {tl('Relationship stage', 'Etapa')}
            </div>
            <Badge variant="outline">{stage}</Badge>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tl('Care alert', 'Alerta')}
            </div>
            <Badge variant={hasAlert ? 'destructive' : 'secondary'}>
              {hasAlert ? tl('Review before service', 'Revisar antes do atendimento') : tl('No active alert', 'Sem alerta ativo')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <section>
            <h3 className="text-sm font-semibold text-foreground">{tl('Operational alert', 'Alerta operacional')}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {statusAlert || tl('No operational alert registered for this client.', 'Nenhum alerta operacional cadastrado para este cliente.')}
            </p>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-foreground">{tl('Anamnesis notes', 'Anamnese')}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {anamnesisNotes || tl('No anamnesis notes registered for this client.', 'Nenhuma observacao de anamnese cadastrada para este cliente.')}
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
