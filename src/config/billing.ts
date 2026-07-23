import { tl } from '../i18n/tl'
import type { BeautyBilling } from '../types/sdk-contract'

export const beautyBilling: BeautyBilling = {
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
        features: { assistant: false, marketing: false, reports: false, fin_reconciliation: false },
        limits: { users: 2, locations: 1, clients: 100, bookings_month: 150, products: 25 },
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
        features: { assistant: false, marketing: true, reports: true, fin_reconciliation: true },
        limits: { users: 10, locations: 1, clients: -1, bookings_month: -1, products: -1 },
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
        features: { assistant: true, marketing: true, reports: true, fin_reconciliation: true },
        limits: { users: -1, locations: -1, clients: -1, bookings_month: -1, products: -1, ai_credits_month: 1000 },
      },
    },
  ],
}
