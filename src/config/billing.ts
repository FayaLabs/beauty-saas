import { tl } from '@fayz-ai/saas'
import type { FayzBillingConfig } from '@fayz-ai/saas'

export const beautyBilling: FayzBillingConfig = {
  plans: [
    {
      // Freemium base tier. Ids follow the pool's `tenants.plan` vocabulary
      // (free/pro/business) — the old starter/professional/enterprise ids never
      // matched a pool row, so `Plan` resolved null and plan gating failed OPEN.
      id: 'free',
      name: tl('Free', 'Grátis'),
      description: tl('Get started — no card required', 'Comece grátis — sem cartão'),
      features: [
        tl('Up to 2 staff members', 'Até 2 profissionais'),
        tl('Up to 100 clients', 'Até 100 clientes'),
        tl('Up to 25 products', 'Até 25 produtos'),
        tl('Basic reports', 'Relatórios básicos'),
        tl('Email support', 'Suporte por e-mail'),
      ],
      prices: { monthly: 0, yearly: 0 },
      currency: 'BRL',
      // Freemium base + products cap (25). Premium (Pro+): marketing, advanced
      // reports and financial reconciliation. 'forms avançado' / blog have no
      // feature id in this app's permissions.ts, so they are not feature-gated.
      entitlements: {
        // `assistant` liga a superfície, e o agente de implantação vem em TODO
        // plano — ele é o suporte, não o produto. Cada colega pago tem a sua
        // própria chave, e contratar é opt-in explícito: um `assistant.<papel>`
        // ausente vale como não contratado.
        features: { assistant: true, marketing: false, reports: false, fin_reconciliation: false, scribe: false },
        // scribe_minutes_month tem custo REAL por minuto (STT ~US$0,0043/min):
        // 40 min de atendimento ≈ US$0,17. Por isso a cota existe desde o dia
        // um em vez de "depois" — sem ela um tenant no free custa dinheiro.
        limits: { users: 2, locations: 1, clients: 100, bookings_month: 150, products: 25, scribe_minutes_month: 0, scribe_documents_month: 0 },
      },
    },
    {
      id: 'pro',
      name: tl('Professional', 'Profissional'),
      description: tl('For growing salons', 'Para salões em crescimento'),
      features: [
        tl('Up to 10 staff', 'Até 10 profissionais'),
        tl('Unlimited appointments', 'Agendamentos ilimitados'),
        tl('Advanced analytics', 'Análises avançadas'),
        tl('SMS reminders', 'Lembretes por SMS'),
        tl('Online booking page', 'Página de agendamento online'),
        tl('Priority support', 'Suporte prioritário'),
      ],
      prices: { monthly: 79, yearly: 759 },
      currency: 'BRL',
      popular: true,
      entitlements: {
        // `assistant.encounter` (a Bia) acompanha `scribe` de propósito: ela é
        // COMO se grava neste app, então cobrar a gravação e a auxiliar em duas
        // chaves seria vender a mesma coisa duas vezes e ainda deixar um plano
        // possível onde o botão existe e ninguém pode atender por ele.
        features: { assistant: true, 'assistant.frontdesk': true, 'assistant.encounter': true, marketing: true, reports: true, fin_reconciliation: true, scribe: true },
        limits: { users: 10, locations: 1, clients: -1, bookings_month: -1, products: -1, scribe_minutes_month: 600, scribe_documents_month: 100 },
      },
    },
    {
      id: 'business',
      name: 'Premium',
      description: tl('The complete experience — with AI', 'A experiência completa — com IA'),
      features: [
        tl('*AI Assistant — 1,000 credits/mo', '*Assistente de IA — 1.000 créditos/mês'),
        tl('Unlimited staff', 'Profissionais ilimitados'),
        tl('Multi-location', 'Multi-unidades'),
        tl('Custom branding', 'Marca personalizada'),
        tl('API access', 'Acesso à API'),
        tl('Dedicated account manager', 'Gerente de conta dedicado'),
        tl('Custom integrations', 'Integrações personalizadas'),
      ],
      prices: { monthly: 199, yearly: 1909 },
      currency: 'BRL',
      entitlements: {
        features: { assistant: true, 'assistant.frontdesk': true, 'assistant.encounter': true, 'assistant.growth': true, 'assistant.finance': true, marketing: true, reports: true, fin_reconciliation: true, scribe: true },
        // Nem no Premium é -1: minuto de STT é custo variável direto, e
        // "ilimitado" num custo variável é um cheque em branco.
        limits: { users: -1, locations: -1, clients: -1, bookings_month: -1, products: -1, ai_credits_month: 1000, scribe_minutes_month: 3000, scribe_documents_month: 500 },
      },
    },
  ],
}
