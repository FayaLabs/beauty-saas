# Guia para IA/agentes — Google Calendar

## Invariantes

1. Agenda é o aggregate owner de booking.
2. Google Calendar é extensão opcional; nunca adicionar dependência Google ao
   plugin Agenda.
3. Integrações reagem a hooks/eventos públicos. Não inserir chamadas Google em
   componentes, stores ou providers da Agenda.
4. Efeitos externos são assíncronos e duráveis: transaction -> outbox -> worker.
5. Toda query e chave idempotente inclui `tenant_id`.
6. Inbound deve passar por comandos públicos da Agenda, nunca escrever tabelas
   arbitrariamente sem preservar invariantes.
7. Propagar `origin` e correlation ID para impedir loops.

## Contrato esperado

```ts
type BookingEvent = {
  eventId: string
  eventType: 'booking.created' | 'booking.updated' |
    'booking.status_changed' | 'booking.cancelled' | 'booking.deleted'
  occurredAt: string
  tenantId: string
  bookingId: string
  version: number
  origin: 'beautysaas' | 'google_calendar'
  correlationId: string
  payload: Record<string, unknown>
}
```

Payloads devem ser snapshots versionados suficientes para o consumidor; não
obrigar a extensão a ler estado que pode ter mudado antes do processamento.

## Roteamento

Antes de enfileirar, confirmar que `google-calendar` está instalada, ativa e
conectada para o tenant. O handler produz uma operação `create`, `update` ou
`delete` com chave idempotente baseada em tenant, booking, versão e operação.

## Inbound

Notificação Google não contém o evento completo. Validar canal/resource, colocar
job na fila e buscar mudanças com `syncToken`. Em `410 Gone`, invalidar cursor e
fazer resync controlado. Eventos sem vínculo seguem a política configurada:
ignorar, importar como bloqueio ou encaminhar para triagem.

## Não fazer

- polling de todos os tenants em intervalos curtos;
- varrer 180 dias após cada alteração;
- guardar tokens em localStorage ou metadados de booking;
- executar Google API dentro da transação de booking;
- apagar vínculo antes de criar tombstone de exclusão;
- importar evento externo como appointment sem cliente/serviço válidos;
- capturar erros silenciosamente sem log operacional e retry.

## Arquivos atuais

- `src/plugins/google-calendar`: addon e control plane local;
- `supabase/functions/google-calendar-sync`: data plane de homologação;
- `supabase/migrations`: conexão, views e compatibilidade do ambiente de teste;
- `src/App.tsx`: polling DEV temporário; remover quando transporte por hooks
  estiver completo;
- `docs/GOOGLE_CALENDAR_INTEGRATION.md`: documentação humana e operacional.

## Checklist de mudança

Validar typecheck/build, RLS multi-tenant, OAuth/revogação, create/update/delete
nos dois sentidos, idempotência, ausência de loop e nenhuma exposição de secret.
Atualizar documentação e migrations no mesmo PR que alterar contratos.
