import { tl } from '../i18n/tl'
import type { BeautyPermissions } from '../types/sdk-contract'

export const beautyPermissions: BeautyPermissions = {
  features: [
    { id: 'dashboard', label: tl('Dashboard', 'Painel'), group: tl('Core', 'Principal') },
    { id: 'appointments', label: tl('Agenda', 'Agenda'), group: tl('Operations', 'Operações') },
    { id: 'clients', label: tl('Clients', 'Clientes'), group: tl('Operations', 'Operações') },
    { id: 'services', label: tl('Services', 'Serviços'), group: tl('Operations', 'Operações') },
    { id: 'inventory', label: tl('Inventory', 'Estoque'), group: tl('Operations', 'Operações') },
    { id: 'marketing', label: 'Marketing', group: 'Marketing' },
    { id: 'sales', label: tl('Sales', 'Vendas'), group: tl('Sales', 'Vendas') },
    { id: 'financial', label: tl('Financial', 'Financeiro'), group: tl('Finance', 'Finanças') },
    { id: 'reports', label: tl('Reports', 'Relatórios'), group: tl('Analytics', 'Análises') },
  ],
  defaultProfiles: [
    {
      id: 'owner',
      name: tl('Owner', 'Proprietário'),
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
      name: tl('Stylist', 'Estilista'),
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
      name: tl('Receptionist', 'Recepcionista'),
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
}
