# USER-JOURNEYS — roteiros de QA para comparar v1 (beautyplace) × v2 (beauty-saas)

Status: canonical · Atualizado: 2026-07-06
Uso: um QA executa cada jornada **nos dois apps**, marca ✅/⚠️/❌ por passo e anota divergências. O resultado alimenta [GAP-ANALYSIS.md](GAP-ANALYSIS.md) (corrige percentuais) e vira insumo direto do refactor. Contas e ambientes: [testing.md](testing.md) (v2: `localhost:5180`, `teste@teste.com`/`teste123`) e `beautyplace/docs/e2e-test-account.md` (conta E2E compartilhada; login do v1 estava rejeitando no último smoke — resolver antes da rodada).

**Como anotar:** para cada passo → `[v1: ✅/⚠️/❌] [v2: ✅/⚠️/❌] + observação curta`. Divergência ≠ bug: o v2 muda vocabulário e modelo de propósito (seção 0). Bug = quebra dentro do modelo do próprio app.

---

## 0. Divergências ESPERADAS (não reportar como bug)

| Tema | v1 | v2 |
|---|---|---|
| Status da agenda | Agendado → Confirmado → **Aguardando** → Concluído (+ **Desmarcado**, Cancelado, Faltou) | agendado → confirmado → **em atendimento** → concluído (+ cancelado, não compareceu; **não existe "desmarcado"**) |
| Pedido/cobrança | fatura própria (`invoices`) + transações pagar/receber paralelas, **com parcelamento** | agendamento gera **ordem de serviço** (pedido canônico); sem parcelamento |
| Lista de espera | tabela `waiting_list`, conversão manual | `appointment_waitlist_entries`, conversão automática ao criar booking |
| Permissões | liberado por padrão (enforcement opt-in) | **negado por padrão** (RBAC por perfil) |
| Open Banking | Pluggy + Banco Inter | Tecnospeed PlugBank |
| Rotas de cliente | abas ficha/arquivos/fotos/pets | 5 abas: Perfil de Atendimento / Pedidos / Linha do Tempo / Documentos / Extrato (aliases redirecionam rotas antigas) |
| Calendário | colunas por profissional + arrastar-e-soltar | sem colunas por profissional / sem DnD (gap conhecido #1) |
| Módulos ausentes no v2 | — | marketing real, WhatsApp, fiscal, portal/booking público, RH, escalas, contratos assinados (GAP §1) |

---

## J1 · Secretária — ciclo completo do atendimento (a jornada crítica do salão)
**Objetivo:** do agendamento ao dinheiro no caixa. **Personas:** secretária.
1. Criar cliente novo (nome, telefone, origem).
2. Criar agendamento para amanhã (cliente + serviço + profissional) → verificar: preço veio da tabela de preços correta? conflito/antecedência respeitados?
3. Confirmar via fila de **Confirmações** (canal WhatsApp) → v1: template WhatsApp real; v2: link manual (esperado ⚠️).
4. No dia: mudar status para "em atendimento"/"Aguardando" → verificar transições permitidas por dia.
5. Abrir **checklist de execução** → preencher ficha/anamnese vinculada ao serviço → dar baixa de produto do estoque.
6. Concluir atendimento → verificar que virou pedido/ordem de serviço com valor certo.
7. Receber pagamento (dinheiro e depois cartão) → verificar contas a receber/caixa.
8. Conferir no Painel: agendamento de hoje apareceu? KPI de receita mexeu?
**Divergências a caçar:** log de mudança de status (v1 tem tabela; v2 verificar), baixa de estoque refletida em movimentações, valor do pedido vs preço com variação.

## J2 · Secretária — cancelamento, falta e lista de espera
1. Cancelar um agendamento escolhendo **motivo** → aparece no painel de Cancelamentos?
2. Marcar outro como **não compareceu/Faltou** → relatório de faltas atualiza?
3. Adicionar cliente na **lista de espera** para um horário cheio; liberar o horário; criar booking → v2: entrada da espera marcada como agendada automaticamente? v1: fluxo manual?
4. Reagendar arrastando (v1) vs editar horário (v2 — sem DnD, esperado ⚠️).

## J3 · Profissional — meu dia
1. Logar como profissional → vejo **só** minha agenda? (v2: RBAC nega o resto; v1: depende do enforcement — anotar o que vaza).
2. Ver ficha do cliente do próximo horário (leitura) → consigo editar? (não deveria).
3. Concluir meu atendimento e preencher a ficha.

## J4 · Dona — dinheiro da semana
1. Lançar conta a pagar (aluguel, recorrente mensal) e conta a receber avulsa. v1: testar **parcelado em 3x** (v2 esperado ❌).
2. Abrir e fechar **caixa** do dia → sessão registra valores? (v2: fluxo pouco verificado — anotar tudo).
3. Extrato bancário + **conciliação**: importar/sincronizar (v1 Pluggy/Inter; v2 PlugBank) → aceitar uma sugestão de match → conferir baixa.
4. Comissões: cadastrar regra de 40% para a profissional → existe **cálculo** em algum relatório/fechamento? (v1 ✅; v2 esperado ⚠️ só coluna de relatório).
5. Relatórios: receita por serviço e por profissional batem com os lançamentos do J1?

## J5 · Dona — cadastros e preços
1. Criar serviço com categoria; criar **tabela de preço** com valor diferente e **variação** (ex.: sexta +10%).
2. Agendar usando essa tabela → preço resolvido certo? (v2 tem engine real — validar contra v1).
3. Criar **pacote** de 4 sessões com validade → vender/atribuir ao cliente → agendar sessão → **desconta do pacote?** (v1 ✅; v2 esperado ❌ — gap #11).
4. Definir produto padrão e ficha padrão do serviço → aparecem no checklist de execução?

## J6 · Recepção/Dona — estoque
1. Cadastrar produto de venda e um insumo; entrada de estoque; baixa manual.
2. v1 extra: código de barras, posição de estoque, etiqueta (v2 esperado ❌).
3. Baixa automática via atendimento (J1.5) refletiu aqui?

## J7 · Marketing — campanha e origem (v2: fachada, documentar exatamente onde quebra)
1. Cadastrar **origem** "Instagram" → usar no cliente novo → relatório de novos clientes por origem.
2. Criar campanha (v1: assistente com IA, salvar, disparar por WhatsApp, ver log; v2: telas demo — anotar cada tela que finge persistir).
3. v1 extra: landing page + submissão pública; pesquisa de avaliação.

## J8 · CRM — do lead ao cliente
1. Criar lead → mover no pipeline → criar **orçamento** → aprovar.
2. Converter em cliente → v2: virou pessoa+cliente (aba Pedidos mostra o orçamento?); v1: comparar.
3. Registrar atividade/interação → aparece na Linha do Tempo (v2) / interações (v1)?

## J9 · Cliente final — superfícies públicas (v2 esperado ❌ em todas — evidenciar o gap comercial)
1. v1: agendar via `/booking/:configId` → pedido cai em "pendentes de aprovação" → aprovar vira agendamento.
2. v1: abrir portal `/cliente/:token` (QR na ficha) → ver histórico.
3. v1: responder pesquisa de avaliação pública; abrir painel TV `/painel/:code`.
4. v2: confirmar ausência das três superfícies (anotar qualquer flag/menu que sugira o contrário).

## J10 · Administrador — equipe e permissões
1. Convidar funcionária por e-mail com perfil **secretária** (v2 nativo; v1 convite de profissional) → aceitar → logar.
2. Verificar recortes: secretária vê financeiro? profissional vê configurações? (v2: negar por padrão; v1: ativar enforcement e repetir).
3. Trocar perfil para **financeiro** → acesso muda na hora?

## J11 · Fichas e documentos
1. Criar modelo de **anamnese** com campos; vincular ao serviço.
2. Preencher no atendimento (J1.5) → documento aparece na aba Documentos do cliente?
3. v1 extra: campo obrigatório bloqueia conclusão; decalque com câmera; contrato com **assinatura** (v2 esperado ❌).

---

## Registro de resultados

Criar `docs/qa/journeys-<data>.md` com uma tabela por jornada (`passo | v1 | v2 | observação`) + lista final "divergências novas" e "bugs". Divergências novas → atualizar a seção 0 e o GAP-ANALYSIS; bugs → Linear (v2: projeto fayz-sdk, mencionar FAY-1186/FAY-1220).
