import { createSaasApp, createCrudPage, createArchetypeLookup } from '@fayz/saas-core'
import { createFinancialPlugin } from '@fayz/saas-core/plugins/financial'
import { createInventoryPlugin } from '@fayz/saas-core/plugins/inventory'
import { createCrmPlugin } from '@fayz/saas-core/plugins/crm'
import { createAgendaPlugin } from '@fayz/saas-core/plugins/agenda'

import { Dashboard } from './pages/Dashboard'
import { serviceEntity } from './types/service'
import { clientEntity } from './types/client'
import { contactEntity, staffEntity, supplierEntity, originEntity, partnershipEntity, equipmentEntity, bankAccountEntity, serviceCategoryEntity } from './types/registry'
import { createPlaceholder } from './pages/Placeholder'
import { Sales } from './pages/Sales'
import { Marketing } from './pages/Marketing'
import { beautyTheme } from './theme'

export const App = createSaasApp({
  name: 'Glow Studio',
  logo: 'G',
  layout: 'topbar',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  auth: {
    adapter: import.meta.env.VITE_SUPABASE_URL ? 'supabase' : 'mock',
    requireAuth: true,
    loginLayout: 'split',
    loginTagline: 'Manage your salon with confidence',
    loginDescription: 'Scheduling, client management, financial tracking, and marketing — all in one beautiful platform built for beauty professionals.',
    showOAuth: true,
    oauthProviders: ['google'],
  },
  organization: { adapter: import.meta.env.VITE_SUPABASE_URL ? 'supabase' : 'mock', multiOrg: true },
  permissions: {
    features: [
      { id: 'dashboard', label: 'Dashboard', group: 'Core' },
      { id: 'appointments', label: 'Agenda', group: 'Operations' },
      { id: 'clients', label: 'Clients', group: 'Operations' },
      { id: 'services', label: 'Services', group: 'Operations' },
      { id: 'inventory', label: 'Inventory', group: 'Operations' },
      { id: 'marketing', label: 'Marketing', group: 'Marketing' },
      { id: 'sales', label: 'Sales', group: 'Sales' },
      { id: 'financial', label: 'Financial', group: 'Finance' },
      { id: 'reports', label: 'Reports', group: 'Analytics' },
    ],
    defaultProfiles: [
      {
        id: 'owner',
        name: 'Owner',
        isSystem: true,
        systemPermissions: ['manage_team', 'manage_billing', 'manage_settings', 'manage_permissions'],
        grants: {
          dashboard: ['read'],
          appointments: ['read', 'create', 'edit', 'delete'],
          clients: ['read', 'create', 'edit', 'delete'],
          services: ['read', 'create', 'edit', 'delete'],
          inventory: ['read', 'create', 'edit', 'delete'],
          marketing: ['read', 'create', 'edit', 'delete'],
          sales: ['read', 'create', 'edit', 'delete'],
          financial: ['read', 'create', 'edit', 'delete'],
          reports: ['read'],
        },
      },
      {
        id: 'stylist',
        name: 'Stylist',
        isSystem: true,
        systemPermissions: [],
        grants: {
          dashboard: ['read'],
          appointments: ['read', 'create', 'edit'],
          clients: ['read'],
          services: ['read'],
        },
      },
      {
        id: 'receptionist',
        name: 'Receptionist',
        isSystem: true,
        systemPermissions: [],
        grants: {
          dashboard: ['read'],
          appointments: ['read', 'create', 'edit'],
          clients: ['read', 'create', 'edit'],
          services: ['read'],
          financial: ['read'],
        },
      },
    ],
  },
  theme: beautyTheme,
  plugins: (() => {
    // Archetype lookups — query saas_core tables directly
    const productLookup = createArchetypeLookup({ archetype: 'product' })
    const serviceLookup = createArchetypeLookup({ archetype: 'service' })
    const contactLookup = createArchetypeLookup({
      archetype: 'person',
      kind: ['customer', 'supplier', 'staff', 'lead'],
      kindLabels: { customer: 'Client', supplier: 'Supplier', staff: 'Professional', lead: 'Lead' },
    })

    const professionalLookup = createArchetypeLookup({
      archetype: 'person',
      kind: ['staff'],
      kindLabels: { staff: 'Professional' },
    })

    return [
      createAgendaPlugin({
        bookingKind: 'appointment',
        orderKind: 'service_order',
        scheduleKind: 'working_hours',
        professionalKind: 'staff',
        clientKind: 'customer',
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        contactLookup,
        serviceLookup,
        professionalLookup,
        // statuses use defaults from plugin (with availableWhen rules)
        businessHours: { startTime: '08:00', endTime: '20:00' },
        slotDuration: 30,
        scheduleBlockDefaults: {
          bufferMinutes: 15,
          maxConcurrent: 1,
          minAdvanceHours: 2,
          maxAdvanceDays: 30,
        },
        navPosition: 2,
        confirmationChannels: [
          { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
          { id: 'phone', label: 'Phone', icon: 'Phone' },
        ],
      }),
      createFinancialPlugin({
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        entityLookups: { product: productLookup, service: serviceLookup },
        contactLookup,
      }),
      createInventoryPlugin({
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        modules: { recipes: false, batchTracking: false },
        productTypes: [
          { value: 'sale', label: 'Retail Product' },
          { value: 'ingredient', label: 'Professional Supply' },
        ],
        labels: {
          pageTitle: 'Inventory',
          pageSubtitle: 'Product catalog and stock control',
          products: 'Products',
          stock: 'Stock',
        },
      }),
      createCrmPlugin({
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        itemTypes: [
          { value: 'service', label: 'Service' },
          { value: 'product', label: 'Product' },
        ],
        entityLookups: { product: productLookup, service: serviceLookup },
        contactLookup,
      }),
    ]
  })(),
  pages: [
    // Main navigation — matches beautyplace order
    { path: '/', label: 'Dashboard', icon: 'Home', component: Dashboard, permission: { feature: 'dashboard', action: 'read' } },
    // Agenda is now provided by the agenda plugin (createAgendaPlugin)
    // Clients dropdown
    {
      path: '/clients', label: 'Clients', icon: 'Users',
      component: createCrudPage(clientEntity, { feature: 'clients' }),
      permission: { feature: 'clients', action: 'read' },
      children: [
        { path: '/clients/new', label: 'Add', icon: 'Plus' },
        { path: '/clients', label: 'List', icon: 'List' },
      ],
    },
    { path: '/marketing', label: 'Marketing', icon: 'Megaphone', component: Marketing },
    // Registry dropdown
    {
      path: '/registry', label: 'Registry', icon: 'ClipboardList',
      component: createPlaceholder('Registry', 'Manage your business records'),
      children: [
        { path: '/registry/services', label: 'Services', icon: 'Briefcase', component: createCrudPage(serviceEntity) },
        { path: '/registry/categories', label: 'Categories', icon: 'Tag', component: createCrudPage(serviceCategoryEntity) },
        { path: '/registry/staff', label: 'Staff', icon: 'UserCog', component: createCrudPage(staffEntity) },
        { path: '/registry/contacts', label: 'Contacts', icon: 'Contact', component: createCrudPage(contactEntity) },
        { path: '/registry/suppliers', label: 'Suppliers', icon: 'Building2', component: createCrudPage(supplierEntity) },
        { path: '/registry/partnerships', label: 'Partnerships', icon: 'Handshake', component: createCrudPage(partnershipEntity) },
        { path: '/registry/equipment', label: 'Equipment', icon: 'Wrench', component: createCrudPage(equipmentEntity) },
        { path: '/registry/origins', label: 'Origins', icon: 'Globe', component: createCrudPage(originEntity) },
        { path: '/registry/accounts', label: 'Accounts', icon: 'Building2', component: createCrudPage(bankAccountEntity) },
      ],
    },
    // Reports
    { path: '/reports', label: 'Reports', icon: 'BarChart3', component: createPlaceholder('Reports', 'Analytics and business intelligence') },
  ],
  billing: {
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        description: 'For independent stylists',
        features: ['Up to 3 staff members', '100 appointments/month', 'Basic reports', 'Email support'],
        prices: { monthly: 29, yearly: 279 },
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'For growing salons',
        features: ['Up to 10 staff', 'Unlimited appointments', 'Advanced analytics', 'SMS reminders', 'Online booking page', 'Priority support'],
        prices: { monthly: 79, yearly: 759 },
        popular: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'For multi-location businesses',
        features: ['Unlimited staff', 'Multi-location', 'Custom branding', 'API access', 'Dedicated account manager', 'Custom integrations'],
        prices: { monthly: 199, yearly: 1909 },
      },
    ],
  },
  chat: {
    title: 'Glow Assistant',
    systemPrompt: 'You are a helpful salon assistant for Glow Studio.',
  },
})
