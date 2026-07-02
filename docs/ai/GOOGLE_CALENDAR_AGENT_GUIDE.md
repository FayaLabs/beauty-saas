# Guia para IA/agentes — Google Calendar

## Invariantes

1. Agenda é o aggregate owner; Google é extensão opcional.
2. Não importar SDK Google nem chamar Edge Function em componentes, store ou provider da Agenda.
3. Fluxo outbound: transação -> `domain_events` -> outbox -> worker -> Google.
4. Fluxo inbound: webhook -> inbox -> `syncToken` -> comando público da Agenda.
5. Toda operação inclui tenant, origin e correlation ID.
6. `origin=google-calendar` nunca volta para a outbox Google.
7. O webhook confirma rápido; processamento acontece após persistência na inbox.
8. Polling é reconciliação, nunca transporte principal.

## Contratos

O contrato canônico está em `fayz-sdk/packages/db/migrations/009_booking_domain_events.sql`
e os tipos em `plugins/plugin-agenda/src/types.ts`. A extensão roteia os cinco
eventos `booking.*` definidos ali. Inbound usa exclusivamente:

- `saas_core.command_update_booking`;
- `saas_core.command_import_external_block`;
- `saas_core.command_delete_external_booking`;
- `saas_core.command_link_external_event`.

Não escrever diretamente em bookings na Edge Function. Não colocar credenciais
em logs, metadata, localStorage ou código cliente.

## Arquivos

- `supabase/migrations/20260701000007_google_calendar_durable_delivery.sql`:
  watch state, roteamento, outbox/inbox, claims e mapeamento;
- `supabase/functions/google-calendar-sync/index.ts`: OAuth, webhook, cursor e workers;
- `src/plugins/google-calendar`: control plane e configuração;
- `docs/GOOGLE_CALENDAR_INTEGRATION.md`: deploy e teste humano.

Qualquer mudança deve validar idempotência, ausência de loop, concorrência,
isolamento multi-tenant, revogação OAuth e recuperação de falhas.
