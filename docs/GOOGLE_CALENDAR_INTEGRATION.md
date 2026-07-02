# Integração Google Calendar

## Arquitetura

A Agenda é dona dos bookings e não conhece Google. A migration `009_booking_domain_events.sql`
do fayz-sdk grava, na mesma transação, um dos eventos duráveis `booking.created`,
`booking.updated`, `booking.status_changed`, `booking.cancelled` ou `booking.deleted`.

Quando a extensão Google está ativa e conectada, o roteador cria um job na
`calendar_event_outbox`. O worker entrega somente esse booking ao Google. A tela
nunca aguarda uma chamada externa.

No sentido inverso, `events.watch` chama o webhook, que valida channel ID,
resource ID e channel token e persiste a notificação em `calendar_webhook_inbox`.
O worker usa `syncToken` e chama os comandos públicos da Agenda com
`origin=google-calendar` e correlation ID. Isso impede loops. HTTP 410 invalida o
cursor e dispara um novo full sync controlado.

O polling no browser e o scan de 180 dias foram removidos. “Sincronizar agora” é
somente uma ferramenta de reconciliação.

## Ordem de deploy

1. Aplicar `fayz-sdk/packages/db/migrations/009_booking_domain_events.sql`.
2. Aplicar as migrations deste repositório, incluindo
   `20260701000007_google_calendar_durable_delivery.sql`.
3. Configurar os secrets e implantar `google-calendar-sync`.
4. Configurar Database Webhook para INSERT em `calendar_event_outbox`, chamando
   a Edge Function com `{"action":"process_outbox"}` e header `X-Worker-Secret`.
5. Configurar cron de reconciliação do worker a cada minuto.
6. Renovar diariamente canais que expirem nas próximas 24 horas.

Secrets server-side:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GCAL_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/google-calendar-sync
GCAL_WEBHOOK_URL=https://<project-ref>.supabase.co/functions/v1/google-calendar-sync
GCAL_STATE_SECRET=<32 bytes aleatórios ou mais>
GCAL_TOKEN_ENCRYPTION_KEY=<32 bytes aleatórios ou mais>
GCAL_WORKER_SECRET=<32 bytes aleatórios ou mais>
GCAL_ALLOWED_REDIRECT_ORIGINS=http://localhost:5180,https://app.exemplo.com
```

Tokens legados sem prefixo `v1.` são aceitos temporariamente. Reconectar a conta
os regrava cifrados com AES-GCM. Nunca exponha esses valores em variáveis `VITE_*`.

## Teste em staging

1. Habilitar `VITE_GOOGLE_CALENDAR_ENABLED=true`.
2. Conectar uma conta e selecionar calendário e profissional.
3. Criar, editar, cancelar e excluir um agendamento no BeautySaaS; validar Google.
4. Criar, editar e excluir um evento no Google; validar BeautySaaS.
5. Repetir notificações e worker para validar idempotência.
6. Simular falha Google, validar retry e depois recuperação.
7. Validar dois tenants sem vazamento de dados.
8. Desconectar e confirmar revogação na Conta Google.

## Liberação para produção

O código fica apto a staging. Produção exige ainda alertas para filas `dead`,
limites de backlog, teste de carga/quota, política de retenção de eventos/jobs e
automação operacional dos webhooks, cron e renovação de canais.
