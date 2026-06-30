# Open Finance · TecnoSpeed

Conector local do BeautySaaS que estende `plugin-financial` e aparece em:

```text
Financeiro → Configurações → Integrações
```

## Limite de responsabilidade

O código do navegador:

- coleta CPF/CNPJ do pagador;
- coleta dados de pagador, endereço e conta bancária quando o usuário quer
  cadastrar/vincular uma conta pelo worker;
- obtém o JWT Supabase e o tenant ativo;
- chama somente a Windows bridge configurada em `VITE_TECNOSPEED_BRIDGE_URL`;
- mostra linhas do extrato antes da importação;
- envia as linhas selecionadas para conciliação;
- exibe histórico de sincronização e estado de fila.

O navegador não possui `tokensh`, `cnpjsh`, `service_role`, token do worker,
URL direta do worker legado ou acesso direto à TecnoSpeed.

## Fluxo

```text
Open Banking connector
  → VITE_TECNOSPEED_BRIDGE_URL
  → Windows bridge (JWT + tenant)
  → worker TecnoSpeed legado (Bearer + JSON)
  → TecnoSpeed pelo worker autorizado
  → Supabase / financial_movements
  → Financeiro / Conciliação
```

Em modo legado, o bridge deve rodar com:

```env
STATEMENT_SOURCE=legacy_worker
TECNOSPEED_DIRECT_SYNC=false
LEGACY_WORKER_URL=http://127.0.0.1:3030
LEGACY_OPENFINANCE_API_URL=http://127.0.0.1:3020
```

## Tratamentos de UX

- `payer_name_mismatch`: o plugin exibe confirmação ao usuário e só reenvia o
  cadastro com `confirmPayerUpdate=true` se houver confirmação explícita.
- `already_synced`: o bridge consulta as transações imediatamente.
- `queued`/`running`: o plugin acompanha o job pelo bridge.
- `retry_wait`: o plugin mostra estado de espera e respeita o horário informado
  pelo bridge/worker.
- Período de extrato: o plugin mostra aviso fixo e pede confirmação explícita
  antes de sincronizar, porque ampliar uma busca depois pode depender da próxima
  janela permitida pelo banco/worker.

## Desenvolvimento local

Inicie primeiro `local-services/tecnospeed-bridge` em modo `memory/mock` ou em
modo legado apontando para o worker Windows. No BeautySaaS:

```env
VITE_TECNOSPEED_BRIDGE_URL=http://127.0.0.1:3001
```

## Banco

A migration canônica pertence à bridge:

```text
local-services/tecnospeed-bridge/supabase/migrations/001_tecnospeed_bridge.sql
local-services/tecnospeed-bridge/supabase/migrations/002_legacy_worker_source.sql
```

O pipeline `scripts/db-apply.mjs` aplica essas migrations após as migrations do
`plugin-financial`. A antiga Edge Function `plugbank-sync` não deve ser usada
nesse fluxo porque o IP/autorização TecnoSpeed fica centralizado no worker
Windows legado.
