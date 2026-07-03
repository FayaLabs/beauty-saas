# Revisão de prontidão — Google Calendar

Data: 2026-07-02

## Decisão

**GO para staging controlado. NO-GO para produção em massa até concluir operação e carga.**

## Validado

- OAuth, revogação e detecção de token revogado;
- criptografia AES-GCM e recuperação após troca indevida de chave;
- create/update/cancel/delete bidirecional;
- domain events, outbox/inbox, idempotência e loop prevention;
- webhook não bloqueante, cron de recuperação e watch renewal;
- incremental sync, HTTP 410 e referências órfãs;
- Realtime atualizando Agenda sem clique manual;
- isolamento por tenant nos endpoints e reconciliação manual;
- builds SDK/app e typecheck Deno.

## Bloqueadores de produção em massa

- teste de carga com volume e quotas realistas;
- dashboards/alertas de backlog, `dead`, latência e OAuth;
- retenção e purge de dados operacionais;
- runbook de incidentes e rotação assistida de chave;
- separar superfícies públicas e autenticadas em Edge Functions distintas;
- decidir semântica financeira da exclusão de appointment originada no Google.

O PR BeautySaaS depende do PR fayz-sdk e da ordem documentada de migrations.
