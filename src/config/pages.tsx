import React from 'react'
import { createCrudPage } from '@fayz-ai/saas'
import { createPlaceholder } from '../pages/Placeholder'
import { CancellationsFollowUpPage } from '../pages/agenda/CancellationsFollowUpPage'
import { ConfirmationsPage } from '../pages/agenda/ConfirmationsPage'
import { ExecutionChecklistPage } from '../pages/agenda/ExecutionChecklistPage'
import { WaitlistPage } from '../pages/agenda/WaitlistPage'
import { tl } from '../i18n/tl'
import type { BeautyCustomPage } from '../types/sdk-contract'
import {
  serviceEntity,
  serviceDefaultProductEntity,
  servicePackageEntity,
  servicePackageItemEntity,
  servicePriceTableEntity,
  servicePriceTableItemEntity,
  servicePriceVariationEntity,
} from '../types/service'
import { clientEntity } from '../types/client'
import {
  contactEntity,
  equipmentEntity,
  locationGroupEntity,
  partnershipEntity,
  serviceLocationEntity,
  serviceCategoryEntity,
  staffEntity,
  supplierEntity,
  appointmentWaitlistEntryEntity,
} from '../types/registry'

function FinancialAccountsAliasRedirect() {
  React.useEffect(() => {
    window.location.hash = '/settings/financial/_properties/bank-accounts'
  }, [])

  return null
}

function MarketingOriginsAliasRedirect() {
  React.useEffect(() => {
    window.location.hash = '/settings/marketing/_properties/origins'
  }, [])

  return null
}

function ClientRegistryAliasRedirect() {
  React.useEffect(() => {
    const rawHash = window.location.hash.replace(/^#/, '') || '/registry/clients'
    const [rawPath, rawQuery] = rawHash.split('?')
    const normalizedPath = rawPath
      .replace(/^\/registry\/clients\b/, '/clients')
      .replace(/\/appointments$/, '/orders')
      .replace(/\/quotes$/, '/orders')
      .replace(/\/activity$/, '/timeline')
      .replace(/\/journey$/, '/documents')
      .replace(/\/evidence$/, '/documents')
    const params = new URLSearchParams(rawQuery)

    if (rawPath.endsWith('/appointments') && !params.has('stage')) params.set('stage', 'booked')
    if (rawPath.endsWith('/quotes') && !params.has('stage')) params.set('stage', 'quoted')

    const query = params.toString()
    window.location.hash = `${normalizedPath}${query ? `?${query}` : ''}`
  }, [])

  return null
}

export const beautyPages: BeautyCustomPage[] = [
  {
    path: '/clients',
    label: tl('Clients', 'Clientes'),
    icon: 'Users',
    position: 3,
    component: createCrudPage(clientEntity, { feature: 'clients' }),
    permission: { feature: 'clients', action: 'read' },
    children: [
      { path: '/clients/new', label: tl('Add', 'Adicionar'), icon: 'Plus' },
      { path: '/clients', label: tl('List', 'Lista'), icon: 'List' },
    ],
  },
  {
    path: '/registry/clients',
    label: '',
    icon: 'Users',
    component: ClientRegistryAliasRedirect,
    permission: { feature: 'clients', action: 'read' },
  },
  {
    path: '/registry/origins',
    label: '',
    icon: 'Globe',
    component: MarketingOriginsAliasRedirect,
    permission: { feature: 'marketing', action: 'read' },
  },
  {
    path: '/agenda/confirmations',
    label: tl('Confirmations', 'Confirmações'),
    icon: 'CalendarCheck2',
    position: 2.4,
    component: ConfirmationsPage,
    permission: { feature: 'appointments', action: 'read' },
  },
  {
    path: '/agenda/cancellations',
    label: tl('Cancellations', 'Cancelamentos'),
    icon: 'CalendarX',
    position: 2.5,
    component: CancellationsFollowUpPage,
    permission: { feature: 'appointments', action: 'read' },
  },
  {
    path: '/agenda/waitlist',
    label: tl('Waitlist Queue', 'Fila de Espera'),
    icon: 'Inbox',
    position: 2.6,
    component: WaitlistPage,
    permission: { feature: 'appointments', action: 'read' },
  },
  {
    path: '/agenda/waitlist/entries',
    label: '',
    icon: 'ListPlus',
    component: createCrudPage(appointmentWaitlistEntryEntity, { feature: 'agenda_waitlist' }),
    permission: { feature: 'appointments', action: 'read' },
  },
  {
    path: '/agenda/execution-checklist',
    label: tl('Execution Checklist', 'Checklist de Atendimento'),
    icon: 'ListChecks',
    position: 2.7,
    component: ExecutionChecklistPage,
    permission: { feature: 'appointments', action: 'read' },
  },
  {
    path: '/registry',
    label: tl('Registry', 'Cadastros'),
    icon: 'ClipboardList',
    position: 8,
    component: createPlaceholder(tl('Registry', 'Cadastros'), tl('Manage your business records', 'Gerencie seus registros de negócios')),
    children: [
      // The service catalog (services + their categories + delivery locations) is
      // gated by the `services` registry feature — passing it here arms the central
      // PermissionGate so create/edit/delete honor the role's action grants
      // (e.g. Secretária/Profissional hold services:read only → no "+ Adicionar Serviço").
      { path: '/registry/services', label: tl('Services', 'Serviços'), icon: 'Briefcase', component: createCrudPage(serviceEntity, { feature: 'services' }) },
      { path: '/registry/categories', label: tl('Categories', 'Categorias'), icon: 'Tag', component: createCrudPage(serviceCategoryEntity, { feature: 'services' }) },
      { path: '/registry/locations', label: tl('Service Locations', 'Locais de Atendimento'), icon: 'MapPin', component: createCrudPage(serviceLocationEntity, { feature: 'services' }) },
      { path: '/registry/location-groups', label: tl('Location Groups', 'Grupos de Locais'), icon: 'Map', component: createCrudPage(locationGroupEntity, { feature: 'services' }) },
      // NOTE (QA): the entities below have NO feature declared in permissions.ts —
      // there is no `staff`, `contacts`, `suppliers`, `partnerships` or `equipment`
      // registry feature (staff is governed by the `manage_team` system permission,
      // not a CRUD feature). Not gated here to avoid inventing features; flagged so a
      // follow-up can decide whether to add the missing taxonomy entries.
      { path: '/registry/staff', label: tl('Staff', 'Equipe'), icon: 'UserCog', component: createCrudPage(staffEntity) },
      { path: '/registry/contacts', label: tl('Contacts', 'Contatos'), icon: 'Contact', component: createCrudPage(contactEntity) },
      { path: '/registry/suppliers', label: tl('Suppliers', 'Fornecedores'), icon: 'Building2', component: createCrudPage(supplierEntity) },
      { path: '/registry/partnerships', label: tl('Partnerships', 'Parcerias'), icon: 'Handshake', component: createCrudPage(partnershipEntity) },
      { path: '/registry/equipment', label: tl('Equipment', 'Equipamentos'), icon: 'Wrench', component: createCrudPage(equipmentEntity) },
    ],
  },
  {
    path: '/settings',
    label: tl('Settings', 'Configurações'),
    icon: 'Settings',
    position: 9,
    component: createPlaceholder(tl('Settings', 'Configurações')),
  },
  {
    path: '/settings/services/_properties/service-packages',
    label: '',
    icon: 'Package',
    component: createCrudPage(servicePackageEntity, { feature: 'services' }),
    permission: { feature: 'settings', action: 'read' },
  },
  {
    path: '/settings/services/_properties/service-package-items',
    label: '',
    icon: 'ListChecks',
    component: createCrudPage(servicePackageItemEntity, { feature: 'services' }),
    permission: { feature: 'settings', action: 'read' },
  },
  {
    path: '/settings/services/_properties/default-products',
    label: '',
    icon: 'Boxes',
    component: createCrudPage(serviceDefaultProductEntity, { feature: 'services' }),
    permission: { feature: 'settings', action: 'read' },
  },
  {
    path: '/settings/services/_properties/price-tables',
    label: '',
    icon: 'BadgeDollarSign',
    component: createCrudPage(servicePriceTableEntity, { feature: 'services' }),
    permission: { feature: 'settings', action: 'read' },
  },
  {
    path: '/settings/services/_properties/price-table-items',
    label: '',
    icon: 'CircleDollarSign',
    component: createCrudPage(servicePriceTableItemEntity, { feature: 'services' }),
    permission: { feature: 'settings', action: 'read' },
  },
  {
    path: '/settings/services/_properties/price-variations',
    label: '',
    icon: 'Tags',
    component: createCrudPage(servicePriceVariationEntity, { feature: 'services' }),
    permission: { feature: 'settings', action: 'read' },
  },
  {
    path: '/settings/financial/_properties/accounts',
    label: '',
    icon: 'Landmark',
    component: FinancialAccountsAliasRedirect,
    permission: { feature: 'financial', action: 'read' },
  },
]
