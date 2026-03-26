# Reference App: BeautyPlace (BeautySoft)

## Access
- **URL:** http://localhost:8080/
- **Email:** maia_silvio@hotmail.com
- **Password:** Pipoca12

## Purpose
This is the original monolithic beauty salon SaaS that we are recreating as a plugin-based architecture using saas-core + beauty-saas.

## Key Pages to Reference
| Route | Feature |
|-------|---------|
| `/` | Dashboard with KPIs, today's schedule |
| `/agenda` | Calendar with drag-drop appointments |
| `/clientes` | Client list + detail with tabs (photos, files, notes, appointments, journey) |
| `/servicos` | Services catalog with categories, packages |
| `/profissionais` | Staff/professionals management |
| `/estoque` | Inventory dashboard (products, movements, categories, locations, recipes, DANFE) |
| `/financeiro` | Financial (receivables, payables, cash register, cards, statements) |
| `/marketing` | Marketing (automations, campaigns, channels, dispatch log) |
| `/crm` | CRM/Sales (pipeline, quotes, client journey) |
| `/configuracoes` | Settings hub (commissions, communication, contracts, company, cost centers, forms, pricing, permissions, holidays, field visibility) |
| `/relatorios` | Reports |
| `/cadastro/*` | Registry: contacts, accounts, equipment, suppliers, employees, locations, origins, partnerships, services, professionals |

## Navigation Structure
Two-row topbar:
- Row 1: Logo + Search (⌘K) + Action icons (tasks, cash register, notifications, user)
- Row 2: Dashboard | Agenda | Clientes ▼ | Estoque | Marketing | Vendas | Financeiro | Cadastros ▼ | Configurações | Relatórios

## Design Notes
- Frosted glass topbar with backdrop-blur
- Light gray content background
- White cards with subtle borders
- Purple primary color (#7C3AED)
- Page-level sidebars for multi-view pages (Inventory, Marketing, Financial, Sales)
