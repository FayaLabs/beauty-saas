# beauty-saas docs

Start at the repo's [AGENTS.md](../AGENTS.md) (operating manual). This folder holds the three
things that must stay crystal clear, plus QA and deep references.

| Doc | O que é | Idioma |
|---|---|---|
| [PRODUCT.md](PRODUCT.md) | O produto como está hoje, módulo a módulo, com status honesto | pt-BR |
| [GAP-ANALYSIS.md](GAP-ANALYSIS.md) | **Features a migrar** do v1 (beautyplace) → v2, com % por módulo | en |
| [FOUNDATIONS.md](FOUNDATIONS.md) | **Fundações + o que falta estabilizar + known bugs** para lançar | pt-BR |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Como o app é construído sobre o fayz-sdk (config, plugins, dados, RBAC) | en |
| [USER-JOURNEYS.md](USER-JOURNEYS.md) | Roteiros de QA para rodar nos DOIS apps e apurar divergências | pt-BR |
| [data-model.md](data-model.md) · [testing.md](testing.md) | Referência profunda do modelo · como testar | en |
| [archive/](archive/) | Docs superados — histórico, não seguir | — |

**Contrato do SDK / plugins / modelo de dados** (canon, não duplicar aqui): `~/dev/fayz-sdk/docs/`
— `ARCHITECTURE`, `PLUGINS`, `DATA-MODEL`, `CUSTOMIZATION`. Par v1: `~/dev/beautyplace/docs/`.
Ledger de migração: Linear **FAY-1220**.
