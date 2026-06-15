import { createCrudPage, type FayzAppConfig } from '@fayz-ai/saas'
import { createPlaceholder } from '../pages/Placeholder'
import { tl } from '../i18n/tl'
import { serviceEntity } from '../types/service'
import { clientEntity } from '../types/client'
import {
  bankAccountEntity,
  contactEntity,
  equipmentEntity,
  originEntity,
  partnershipEntity,
  serviceCategoryEntity,
  staffEntity,
  supplierEntity,
} from '../types/registry'

export const beautyPages: FayzAppConfig['pages'] = [
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
    path: '/marketing',
    label: 'Marketing',
    icon: 'Megaphone',
    position: 5,
    component: createPlaceholder('Marketing', tl('Campaigns, loyalty programs, and client engagement', 'Campanhas, programas de fidelidade e engajamento de clientes')),
    permission: { feature: 'marketing', action: 'read' },
  },
  {
    path: '/registry',
    label: tl('Registry', 'Cadastros'),
    icon: 'ClipboardList',
    position: 8,
    component: createPlaceholder(tl('Registry', 'Cadastros'), tl('Manage your business records', 'Gerencie seus registros de negócios')),
    children: [
      { path: '/registry/services', label: tl('Services', 'Serviços'), icon: 'Briefcase', component: createCrudPage(serviceEntity) },
      { path: '/registry/categories', label: tl('Categories', 'Categorias'), icon: 'Tag', component: createCrudPage(serviceCategoryEntity) },
      { path: '/registry/staff', label: tl('Staff', 'Equipe'), icon: 'UserCog', component: createCrudPage(staffEntity) },
      { path: '/registry/contacts', label: tl('Contacts', 'Contatos'), icon: 'Contact', component: createCrudPage(contactEntity) },
      { path: '/registry/suppliers', label: tl('Suppliers', 'Fornecedores'), icon: 'Building2', component: createCrudPage(supplierEntity) },
      { path: '/registry/partnerships', label: tl('Partnerships', 'Parcerias'), icon: 'Handshake', component: createCrudPage(partnershipEntity) },
      { path: '/registry/equipment', label: tl('Equipment', 'Equipamentos'), icon: 'Wrench', component: createCrudPage(equipmentEntity) },
      { path: '/registry/origins', label: tl('Origins', 'Origens'), icon: 'Globe', component: createCrudPage(originEntity) },
      { path: '/registry/accounts', label: tl('Accounts', 'Contas'), icon: 'Building2', component: createCrudPage(bankAccountEntity) },
    ],
  },
  {
    path: '/settings',
    label: tl('Settings', 'Configurações'),
    icon: 'Settings',
    position: 9,
    component: createPlaceholder(tl('Settings', 'Configurações')),
  },
]
