# Revisão final — Google Calendar

Data: 2026-07-01

## Decisão

**NO-GO para produção e para PR marcado como implementação final.**

O protótipo é funcional em homologação, mas ainda não cumpre integralmente o
boundary aprovado entre Agenda e extensões.

## O que foi validado

- OAuth, callback assinado e allowlist de retorno;
- isolamento de tenant nas ações autenticadas;
- status, desconexão e revogação Google;
- sincronização bidirecional em homologação;
- tombstone para exclusões;
- correções de schema do banco de teste;
- título de tasks/blocks e feedback de seleção de cliente;
- build/typecheck dos pacotes afetados.

## Bloqueadores arquiteturais

### P0 — Agenda não publica hooks duráveis

Não existem eventos transacionais versionados para create/update/status/cancel/
delete. O `eventBus` atual é apenas em memória e não garante entrega.

### P0 — Extensão não consome outbox da Agenda

O outbound atual varre bookings em janelas de tempo. O correto é receber eventos
da outbox e criar operações idempotentes por aggregate version.

### P0 — Inbound ignora comandos públicos da Agenda

A Edge Function escreve diretamente em `saas_core.bookings`. Isso pode ignorar
regras de conflito, auditoria, financeiro e futuros invariantes.

### P1 — Transporte Google inbound não é event-driven

Ainda faltam `events.watch`, validação de canal, renovação e leitura incremental
com `syncToken`. Polling deve permanecer somente como reconciliação.

### P1 — Modelo de mapeamento incompleto

Eventos avulsos só são importados quando há exatamente um profissional ativo.
Produção requer configuração calendário -> profissional/unidade e política para
eventos sem vínculo.

### P1 — Operação

Faltam worker concorrente, retry exponencial, dead-letter, métricas, alertas,
criptografia de refresh token e testes de quota/concorrência.

## Sequência recomendada

1. Definir contratos de eventos e comandos públicos no `fayz-sdk`.
2. Implementar gravação transacional de domain event + outbox.
3. Criar roteador de hooks por extensão instalada/ativa no tenant.
4. Alterar Google outbound para consumir jobs direcionados.
5. Alterar inbound para usar comandos Agenda com `origin` e correlation ID.
6. Implementar `events.watch` + `syncToken` e cron de reconciliação.
7. Remover polling DEV de `src/App.tsx` antes do release de produção.
8. Executar testes multi-tenant, idempotência, loop e falhas parciais.

## Estratégia de PR

Separar em dois PRs:

- `fayz-sdk`: contratos de hooks/comandos, emissão durável e melhorias neutras da
  Agenda;
- `beauty-saas`: extensão Google, migrations, Edge Function, configuração e docs.

O PR BeautySaaS depende do PR SDK. Durante desenvolvimento, usar PR empilhado ou
aguardar o merge do SDK antes de retargetar para `main`.
