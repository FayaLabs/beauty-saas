# Revisão final — Google Calendar

Data: 2026-07-01

## Decisão

**GO condicionado para staging; NO-GO para produção sem o checklist operacional.**

Concluído no código:

- domain events transacionais e comandos públicos no SDK;
- roteamento somente para extensão conectada;
- outbox/inbox, claim concorrente, retry exponencial e dead-letter;
- outbound por booking, sem scan periódico;
- webhook validado, `events.watch`, `syncToken` e recuperação de HTTP 410;
- origin/correlation ID contra loops;
- tokens cifrados e mapeamento explícito para profissional;
- polling do browser removido.

Antes de produção:

- aplicar migrations empilhadas em staging e executar o roteiro E2E;
- configurar Database Webhook, cron do worker e renovação de canais;
- criar alertas de dead-letter, backlog e falhas OAuth/Google;
- executar carga, concorrência, quotas e isolamento multi-tenant;
- definir retenção e limpeza de domain events, outbox e inbox concluídos.

O PR BeautySaaS depende do PR fayz-sdk. Não retargetar para `main` sem garantir a
ordem de migrations.
