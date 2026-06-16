import { tl } from '../i18n/tl'
import type { BeautyBilling } from '../types/sdk-contract'

export const beautyBilling: BeautyBilling = {
  plans: [
    {
      id: 'starter',
      name: tl('Starter', 'Inicial'),
      description: tl('For independent stylists', 'Para estilistas independentes'),
      features: [
        tl('Up to 3 staff members', 'Até 3 profissionais'),
        tl('100 appointments/month', '100 agendamentos/mês'),
        tl('Basic reports', 'Relatórios básicos'),
        tl('Email support', 'Suporte por e-mail'),
      ],
      prices: { monthly: 29, yearly: 279 },
    },
    {
      id: 'professional',
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
      popular: true,
    },
    {
      id: 'enterprise',
      name: tl('Enterprise', 'Empresarial'),
      description: tl('For multi-location businesses', 'Para negócios multi-unidades'),
      features: [
        tl('Unlimited staff', 'Profissionais ilimitados'),
        tl('Multi-location', 'Multi-unidades'),
        tl('Custom branding', 'Marca personalizada'),
        tl('API access', 'Acesso à API'),
        tl('Dedicated account manager', 'Gerente de conta dedicado'),
        tl('Custom integrations', 'Integrações personalizadas'),
      ],
      prices: { monthly: 199, yearly: 1909 },
    },
  ],
}
