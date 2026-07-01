# Integração Google Calendar

## Objetivo

Conectar a Agenda do BeautySaaS ao Google Calendar sem acoplar o plugin Agenda
ao provedor Google. A Agenda é dona dos bookings; a extensão é uma consumidora
opcional dos eventos de domínio publicados pela Agenda.

## Estado atual

O ambiente de homologação comprova:

- OAuth Google com credenciais exclusivamente server-side;
- isolamento por tenant;
- conexão, status, troca de calendário e revogação do consentimento;
- criação, atualização e exclusão nos dois sentidos;
- importação de eventos Google como bloqueios quando existe exatamente um
  profissional ativo;
- histórico de sincronização e reconciliação manual;
- polling rápido somente em `DEV`, para facilitar testes.

O polling e a varredura de 180 dias são mecanismos de homologação. Eles não são
o desenho aprovado para produção e devem ser removidos quando hooks duráveis,
outbox e notificações `events.watch` estiverem completos.

## Arquitetura aprovada para produção

```text
Agenda command
  -> grava booking e domain event na mesma transação
  -> outbox durável
  -> extensão ativa recebe o hook
  -> fila do Google Calendar
  -> worker idempotente
  -> Google Calendar API

Google events.watch
  -> webhook autenticado
  -> fila de entrada
  -> leitura incremental com syncToken
  -> comando público da Agenda
  -> origin=google_calendar evita loop
```

A Agenda nunca importa SDKs Google, não conhece OAuth e não chama a Edge
Function do conector. Ela publica apenas eventos neutros:

- `booking.created`;
- `booking.updated`;
- `booking.status_changed`;
- `booking.cancelled`;
- `booking.deleted`.

A extensão registra quais eventos consome. Se não estiver instalada e ativa no
tenant, nenhum job Google deve ser criado.

## Regras de consistência

- Toda operação externa possui `idempotency_key`.
- O vínculo usa `(tenant_id, booking_id, provider, external_event_id)`.
- Handlers nunca bloqueiam o salvamento da Agenda esperando o Google.
- Falhas usam retry exponencial com jitter e dead-letter.
- Alterações inbound carregam `origin=google_calendar` e `external_event_id`.
- Exclusões usam tombstone/outbox; nunca dependem do booking continuar existindo.
- Polling periódico é apenas reconciliação, não transporte principal.

## Segurança

- `GOOGLE_CLIENT_SECRET`, refresh tokens e service-role nunca entram no browser.
- Toda ação autenticada valida JWT, tenant ativo e membership.
- O callback OAuth usa estado HMAC, expiração e allowlist de retorno.
- A revogação chama o endpoint Google antes de apagar tokens locais.
- Logs não podem conter tokens, códigos OAuth nem payloads sensíveis.

## Secrets de homologação

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GCAL_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/google-calendar-sync
GCAL_STATE_SECRET=<32 bytes aleatórios ou mais>
GCAL_ALLOWED_REDIRECT_ORIGINS=http://localhost:5180
```

## Banco e deploy

As migrations versionadas ficam em `supabase/migrations`. A função fica em
`supabase/functions/google-calendar-sync`.

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy google-calendar-sync --project-ref <project-ref>
```

Sempre revisar o `--dry-run`. Nunca mover secrets para variáveis `VITE_*`.

Para habilitar o addon apenas no ambiente de homologação:

```text
VITE_GOOGLE_CALENDAR_ENABLED=true
```

Sem essa variável, o addon e o polling DEV não são registrados.

## Teste de homologação

1. Conectar uma conta em Configurações -> Agenda -> Integrações.
2. Confirmar status conectado e calendário `primary`.
3. Criar booking com cliente, profissional e serviço realmente selecionados.
4. Confirmar criação no Google.
5. Alterar horário no Google e confirmar atualização no BeautySaaS.
6. Excluir no BeautySaaS e confirmar exclusão no Google.
7. Criar evento futuro no Google e confirmar importação como bloqueio.
8. Desconectar e confirmar revogação nas conexões da Conta Google.

## Critérios antes de produção

- hooks da Agenda e contratos de payload versionados;
- outbox transacional e worker concorrente;
- `events.watch`, renovação de canais e `syncToken` incremental;
- mapeamento explícito calendário -> profissional/unidade;
- criptografia de refresh token;
- métricas, alertas, retry, dead-letter e reconciliação;
- testes de idempotência, loop, concorrência, quota e isolamento multi-tenant.
