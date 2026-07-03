# Integração Google Calendar

## Estado

Integração bidirecional validada em staging. O transporte normal é automático;
`Sincronizar agora` existe somente para reconciliação e suporte.

## Limites de responsabilidade

- Agenda é dona de bookings e publica eventos neutros.
- A extensão Google conhece OAuth, Calendar API, outbox, inbox e cursores.
- Nenhum componente ou comando da Agenda chama o Google diretamente.
- Falhas externas nunca impedem criar, editar ou excluir um booking.

## Fluxo outbound

```text
comando Agenda
  -> booking + domain_event na mesma transação
  -> roteador verifica extensão ativa/conectada
  -> calendar_event_outbox
  -> trigger assíncrono pg_net
  -> Edge worker
  -> Google Calendar
```

O ID Google criado pelo BeautySaaS é determinístico. Repetir um job não cria
eventos duplicados. Jobs usam claim com `FOR UPDATE SKIP LOCKED`, oito tentativas,
backoff exponencial e estado `dead`.

## Fluxo inbound

```text
Google events.watch
  -> webhook valida channel/resource/token
  -> calendar_webhook_inbox
  -> events.list com syncToken
  -> comando público da Agenda
  -> Supabase Realtime
  -> agenda:refresh
```

Eventos externos viram bloqueios do profissional mapeado. Eventos all-day são
ignorados. HTTP 410 invalida o cursor e executa full sync controlado desde 30 dias
atrás. `origin=google-calendar` evita feedback loop.

## Configuração

Aplicar primeiro `fayz-sdk/packages/db/migrations/009_booking_domain_events.sql`
e depois as migrations deste repositório. Configurar:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GCAL_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/google-calendar-sync
GCAL_WEBHOOK_URL=https://<project-ref>.supabase.co/functions/v1/google-calendar-sync
GCAL_STATE_SECRET=<aleatório>
GCAL_TOKEN_ENCRYPTION_KEY=<aleatório e estável>
GCAL_WORKER_SECRET=<aleatório>
GCAL_ALLOWED_REDIRECT_ORIGINS=https://app.exemplo.com
```

O banco precisa do mesmo valor de `GCAL_WORKER_SECRET`, com nome fixo no Vault:

```sql
select vault.create_secret(
  '<mesmo valor de GCAL_WORKER_SECRET>',
  'gcal_worker_secret',
  'Google Calendar worker secret'
);
```

Os argumentos são valor, nome e descrição. Nunca use o token como nome. A Edge
Function preenche `calendar_worker_config.endpoint_url` a partir de
`GCAL_WEBHOOK_URL`; nenhuma migration depende do project ref de staging.

## Secrets e rotação

- `GCAL_TOKEN_ENCRYPTION_KEY` cifra tokens OAuth com AES-GCM. Não rotacionar sem
  uma migração de recriptografia. Se for perdida, é obrigatório reconectar contas.
- `GCAL_WORKER_SECRET` pode ser rotacionado, mas Edge Secret e Vault devem ser
  atualizados juntos.
- Nunca colocar secrets em `VITE_*`, logs, screenshots, SQL versionado ou metadata.
- Revogação manual no Google é detectada ao consultar o status da integração.

## Recuperação

- Database trigger entrega imediatamente.
- Cron `google-calendar-worker-reconciliation` roda a cada minuto e recupera
  retries, claims abandonados, inbox pendente e canais próximos da expiração.
- `Sincronizar agora` drena somente o tenant autenticado e depois faz incremental.
- Falhas ficam em `calendar_sync_log`; jobs esgotados permanecem como `dead`.

## Operação e observabilidade

- O painel mostra filas de entrada e saída, falhas definitivas, última
  sincronização e alertas abertos do tenant.
- `refresh_google_calendar_operational_alerts()` roda a cada cinco minutos. Ele
  abre alertas para jobs `dead`, backlog superior a cinco minutos e canal
  `events.watch` ausente ou a menos de seis horas da expiração. O alerta é
  resolvido automaticamente quando a condição deixa de existir.
- `cleanup_google_calendar_operational_data()` roda diariamente. Jobs concluídos
  ficam 30 dias; logs de sincronização e alertas resolvidos ficam 90 dias.
- Alertas e métricas não participam da transação do booking. Uma falha nesse
  subsistema não impede criar, editar, cancelar ou excluir um agendamento.
- Tabelas operacionais e RPCs são restritas ao `service_role`. A Edge Function
  valida a sessão e o vínculo com o tenant antes de retornar a saúde.

## Teste E2E

Antes do teste funcional, confirme no painel que a sincronização automática está
operacional e que não existem jobs em falha definitiva.

1. Conectar e mapear profissional.
2. Criar, editar, cancelar e excluir no BeautySaaS sem sincronização manual.
3. Criar, mover e excluir no Google/celular sem sincronização manual.
4. Confirmar atualização da tela via Realtime.
5. Repetir notificações/jobs e confirmar ausência de duplicatas.
6. Revogar no Google e confirmar status local desconectado.
7. Validar isolamento com dois tenants.

## Próxima evolução

- testes automatizados contra Google sandbox/conta dedicada;
- rate limiting por tenant e controle explícito de quota;
- separar callback OAuth, webhook e worker em funções independentes;
- política explícita para exclusão Google de appointments com financeiro.
