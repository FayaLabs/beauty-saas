# Beauty SaaS

Beauty salon management platform built with [@fayz-ai/sdk](https://www.npmjs.com/package/@fayz-ai/sdk).

## What it does

Complete management system for salons, spas, barbershops, and beauty studios:

- **Agenda** — Appointment scheduling with calendar view
- **Clients** — Customer database with service history, photos, and notes
- **Services** — Service catalog with categories and packages
- **Staff** — Professionals and employees with schedules and commissions
- **Financial** — Invoicing, cash register, payment tracking
- **Inventory** — Product stock and usage per service
- **Marketing** — Automated messages (WhatsApp, email) for reminders and campaigns
- **Beauty Journey** — Before/after photos, treatment history, and professional notes per client

## Setup

```bash
yarn install
cp .env.example .env  # add your Supabase credentials
yarn dev              # runs on http://localhost:5180
```

## Stack

- React + TypeScript + Vite
- @fayz-ai/sdk (Fayz SaaS framework + plugins)
- Supabase (auth, database, storage)
- Tailwind CSS
