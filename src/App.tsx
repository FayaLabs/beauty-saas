import { createSaasApp, createCrudPage } from '@fayz/saas-core'

import { Dashboard } from './pages/Dashboard'
import { Appointments } from './pages/Appointments'
import { serviceEntity } from './types/service'
import { clientEntity } from './types/client'
import { contactEntity, staffEntity, locationEntity, originEntity, partnershipEntity, equipmentEntity, bankAccountEntity } from './types/registry'
import { mockServices } from './data/mock-services'
import { mockClients } from './data/mock-clients'
import { createPlaceholder } from './pages/Placeholder'
import { beautyTheme } from './theme'

export const App = createSaasApp({
  name: 'Glow Studio',
  logo: 'G',
  layout: 'topbar',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  auth: { adapter: 'supabase', requireAuth: true },
  organization: { adapter: 'supabase', multiOrg: true },
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
  pages: [
    // Main navigation — matches beautyplace order
    { path: '/', label: 'Dashboard', icon: 'Home', component: Dashboard, permission: { feature: 'dashboard', action: 'read' } },
    { path: '/agenda', label: 'Agenda', icon: 'Calendar', component: Appointments, permission: { feature: 'appointments', action: 'read' } },
    // Clients dropdown
    {
      path: '/clients', label: 'Clients', icon: 'Users',
      component: createCrudPage(clientEntity, { mockData: mockClients, feature: 'clients' }),
      permission: { feature: 'clients', action: 'read' },
      children: [
        { path: '/clients/new', label: 'Add', icon: 'Plus' },
        { path: '/clients', label: 'List', icon: 'List' },
      ],
    },
    { path: '/inventory', label: 'Inventory', icon: 'Package', component: createPlaceholder('Inventory', 'Product catalog and stock management') },
    { path: '/marketing', label: 'Marketing', icon: 'Megaphone', component: createPlaceholder('Marketing', 'Campaigns, automations, and communications') },
    { path: '/sales', label: 'Sales', icon: 'Filter', component: createPlaceholder('Sales', 'CRM, quotes, and sales pipeline') },
    { path: '/financial', label: 'Financial', icon: 'DollarSign', component: createPlaceholder('Financial', 'Invoices, payments, and cash register') },
    // Registry dropdown
    {
      path: '/registry', label: 'Registry', icon: 'ClipboardList',
      component: createPlaceholder('Registry', 'Manage your business records'),
      children: [
        { path: '/registry/contacts', label: 'Contacts', icon: 'Contact', component: createCrudPage(contactEntity) },
        { path: '/registry/accounts', label: 'Accounts', icon: 'Building2', component: createCrudPage(bankAccountEntity) },
        { path: '/registry/equipment', label: 'Equipment', icon: 'Wrench', component: createCrudPage(equipmentEntity) },
        { path: '/registry/suppliers', label: 'Suppliers', icon: 'ClipboardList', component: createCrudPage(contactEntity) },
        { path: '/registry/staff', label: 'Staff', icon: 'UserCog', component: createCrudPage(staffEntity) },
        { path: '/registry/locations', label: 'Locations', icon: 'MapPin', component: createCrudPage(locationEntity) },
        { path: '/registry/origins', label: 'Origins', icon: 'Globe', component: createCrudPage(originEntity) },
        { path: '/registry/partnerships', label: 'Partnerships', icon: 'Handshake', component: createCrudPage(partnershipEntity) },
        { path: '/registry/services', label: 'Services', icon: 'Briefcase', component: createCrudPage(serviceEntity, { mockData: mockServices }) },
        { path: '/registry/professionals', label: 'Professionals', icon: 'UserCog', component: createCrudPage(staffEntity) },
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
