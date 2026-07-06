# PRODUCT — BeautySoft v2 (beauty-saas): o que o produto é HOJE

Status: canonical · Atualizado: 2026-07-06
Fonte da verdade: `src/config/app.tsx` + os plugins `@fayz-ai/*` habilitados. Este doc descreve o estado real, não a aspiração — o pitch antigo está em [archive/product-2026-03.md](archive/product-2026-03.md).

BeautySoft v2 é o sistema de gestão para salões e clínicas de estética construído sobre a arquitetura de plugins do fayz-sdk. É o **v2 do beautyplace** (`~/dev/beautyplace` — produto v1 documentado em `beautyplace/docs/PRODUCT.md`) — mesmas necessidades de negócio, nova fundação. O que falta do v1 e quanto falta: [GAP-ANALYSIS.md](GAP-ANALYSIS.md). Jornadas para QA comparar os dois apps: [USER-JOURNEYS.md](USER-JOURNEYS.md). Como é construído: [ARCHITECTURE.md](ARCHITECTURE.md).

**Legenda:** ✅ real (persistência Supabase, fluxo funciona) · 🟡 parcial (funciona com lacunas nomeadas) · 🎭 fachada (telas existem, sem persistência) · ⛔ ausente.

---

## 1. Para quem é (perfis de acesso)

Seis perfis padrão (RBAC granular, `src/config/permissions.ts` — 34 features × ler/criar/editar/excluir, **deny-by-default**, diferente do v1 que é liberado-por-padrão):

| Perfil | O que enxerga/faz |
|---|---|
| **Dona/Dono (owner)** | tudo + faturamento + gestão de permissões |
| **Administrador(a)** | tudo operacional + equipe + configurações + permissões |
| **Secretária (recepção)** | agenda, clientes, caixa, contas a receber |
| **Profissional** | a própria agenda + leitura de clientes e serviços |
| **Marketing** | campanhas + relatórios de clientes/audiência |
| **Financeiro** | módulo financeiro + relatórios financeiros |

Convites de equipe nativos (v0.2.0). Login e-mail/senha e Google.

## 2. Os módulos, um a um

### Painel — ✅ (3 KPIs pendentes)
12 indicadores (9 calculam ao vivo sobre dados reais; **3 ainda fixos**: avaliação média, taxa de ocupação, venda de produtos), Agenda de Hoje real, Ações Rápidas, onboarding que detecta o que já foi configurado.

### Agenda — ✅ (o módulo mais completo)
Calendário com slots de 30min (08h–20h configurável), 6 status com regras de transição (agendado → confirmado → **em atendimento** → concluído / cancelado / não compareceu — ⚠️ nomes diferem do v1, ver USER-JOURNEYS), regras de agendamento (antecedência mínima 2h, buffer 15min, 1 simultâneo por profissional), seleção de unidade. Páginas do vertical, todas reais: **Confirmações** (fila; canal WhatsApp/telefone — link manual, sem automação), **Cancelamentos** (follow-up com motivos configuráveis), **Lista de espera** (com conversão automática em agendamento), **Checklist de execução** (a integração mais profunda: atendimento → fichas → baixa de estoque). Criar agendamento gera ordem de serviço automaticamente. Google Calendar: conector na UI, **edge function ausente do repo** (🟡).

### Clientes — ✅ (a superfície vertical mais rica)
Perfil de cuidado: ciclo de vida (ativo/VIP/inativo/restrito), estágio (novo/recorrente/fiel/em risco), notas de anamnese, alertas. Detalhe com 5 abas reais: **Perfil de Atendimento**, **Pedidos** (canônico — agendamentos e orçamentos viram pedidos), **Linha do Tempo**, **Documentos** (fichas + anexos), **Extrato**. Conversão lead→cliente funciona.

### Financeiro — ✅ operacional (sem contabilidade formal)
Resumo, Contas a Pagar (+recorrentes), a Receber, Caixas, Extratos, Comissões (visão + regras), Cartões (visão + **conciliação**). Conciliação alimentada pelo conector **Open Banking Tecnospeed PlugBank** (a única integração externa real do v2; ⚠️ v1 usa Pluggy + Banco Inter), com matching que pondera dimensões contábeis. Limites: plano de contas/centros de custo são dimensões, **sem partidas dobradas/fechamento**; comissões têm regras cadastráveis **sem motor de cálculo/pagamento**; caixas têm estrutura, fluxo abrir/fechar pouco verificado (🟡). Sem parcelamento no contas a pagar/receber (v1 tem).

### Estoque — ✅ básico
Produtos (venda/insumo) e movimentações via CRUD. Sem receitas/lotes (desligados), sem código de barras, sem fiscal, sem fotos.

### Vendas (CRM) — ✅ estrutura, 🟡 profundidade
Painel, Pipeline, Leads, Negócios, Orçamentos, Atividades. Orçamento e pipeline funcionam; atividades rasas.

### Relatórios — ✅ (11 de 12)
Atendimentos por período, cancelamentos, faltas, horários de pico, receita por serviço e por profissional, frequência, novos clientes, dimensões contábeis, filas de confirmação/espera. Pendente: **taxa de ocupação**.

### Cadastros — ✅
Nove entidades (contatos, locais, categorias, origens…) + propriedades de serviço: **pacotes** (+itens, validade, limite de usos), **tabelas de preço**, **variações de preço**, produtos e fichas padrão por serviço. Lacuna: pacotes **não descontam sessões** ao agendar (🟡).

### Formulários e Documentos — ✅ base, 🟡 profundidade
Modelos e categorias (formulário, contrato, consentimento, **anamnese**), fichas padrão por serviço, documentos preenchidos aparecem no cliente e no checklist. Sem editor avançado, sem decalque/câmera, sem assinatura de contratos.

### Marketing — 🎭 fachada
Visão geral, canais, campanhas, funil e landing pages **renderizam dados estáticos — nada persiste, nada envia**. Único pedaço real: cadastro de origens. Sem WhatsApp/Twilio, sem automações.

### Tarefas — ✅
Gaveta de tarefas (plugin padrão).

### Assistente ("Assistente Glow") — 🟡
Chat configurado com prompt do produto; utilidade depende das aiTools dos plugins.

## 3. O que o v1 tem e o v2 ainda não (resumo)

Agendamento online público (maior gap comercial), portal do cliente token/QR, WhatsApp real (chat, disparos, logs, IA), fiscal (DFe/DANFE; NFSe), motor de comissões, PDV completo, RH profundo, escalas, anamnese estruturada + decalque, contratos com assinatura, fidelidade/metas/indicações, fotos antes/depois + jornada, multi-unidade/franqueador, painéis de TV públicos, landing pages reais, CNAB/folha, parcelamento. **Detalhe módulo a módulo com percentuais: [GAP-ANALYSIS.md](GAP-ANALYSIS.md).**

## 4. Estado de lançamento

Primeiro cliente real: clínica de estética (Wave 1, FAY-1258). Preset `clinic` implementado (`VITE_BEAUTY_PRESET=clinic` → só Painel + Agenda + Financeiro, ERP desligado — mas a decisão de 2026-07-02 é validar o **app completo**, preset guardado como evidência). RLS completo nas tabelas do app (2026-07-02), tenant e conta da proprietária criados. Falta: deploy final, Google OAuth, seed, correção do vazamento de widgets (FAY-1252). Critério de sucesso: 2 semanas seguidas de agendamentos reais.
