# Guia para IA/agentes — Google Calendar

## Invariantes obrigatórias

1. Agenda é aggregate owner; Google é consumidor opcional.
2. Nunca chamar Google dentro da transação do booking.
3. Outbound é `domain_events -> outbox -> worker`.
4. Inbound é `watch -> inbox -> syncToken -> comando Agenda`.
5. Toda operação carrega tenant, origin e correlation ID.
6. Eventos com `origin=google-calendar` não retornam à outbox Google.
7. Entrega é at-least-once; toda operação externa deve ser idempotente.
8. Falha de configuração/rede apenas registra erro; nunca aborta booking.
9. Polling não é transporte. O botão manual é reconciliação tenant-scoped.
10. Nunca persistir secrets em código, migrations, payloads ou logs.

## Contratos

Eventos canônicos:

- `booking.created`
- `booking.updated`
- `booking.status_changed`
- `booking.cancelled`
- `booking.deleted`

Comandos inbound permitidos:

- `saas_core.command_update_booking`
- `saas_core.command_import_external_block`
- `saas_core.command_delete_external_booking`
- `saas_core.command_link_external_event`

Não escrever bookings diretamente na Edge Function.

## Dados operacionais

- `calendar_integrations`: conexão, tokens cifrados, cursor e watch.
- `calendar_event_outbox`: entrega outbound e dead-letter.
- `calendar_webhook_inbox`: deduplicação das notificações Google.
- `calendar_sync_log`: auditoria legível pelo tenant.
- `calendar_worker_config`: endpoint não secreto preenchido pela Edge.
- Vault `gcal_worker_secret`: mesmo valor do Edge Secret
  `GCAL_WORKER_SECRET`.

## Regras de mudança

- Consultar saúde somente pela action autenticada `health` da Edge Function.
- Nunca expor `calendar_event_outbox`, `calendar_webhook_inbox` ou
  `calendar_operational_alerts` diretamente ao browser.
- `outboxDead` ou `inboxDead` acima de zero exigem intervenção. Pendências podem
  ser transitórias, mas geram alerta depois de cinco minutos.
- Não apagar dead letters para esconder o sintoma. Corrigir a causa e
  reprocessar de forma idempotente.
- A retenção remove somente transporte concluído e histórico operacional. Os
  eventos de domínio pertencem à plataforma.

- alterar payload exige versão compatível;
- migrations devem ser idempotentes e não conter project ref;
- preservar 404/410 como sucesso em delete remoto;
- preservar fallback 410 do syncToken;
- não reduzir validações de membership, canal ou worker secret;
- validar Deno, TypeScript, build SDK, RLS e loop antes de publicar.

## Arquivos de referência

- `supabase/functions/google-calendar-sync/index.ts`
- `supabase/migrations/20260701000007_google_calendar_durable_delivery.sql`
- `docs/GOOGLE_CALENDAR_INTEGRATION.md`
- `fayz-sdk/packages/db/migrations/009_booking_domain_events.sql`
- `fayz-sdk/plugins/plugin-agenda/docs/EXTENSION_HOOKS.md`
