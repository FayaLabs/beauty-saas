import type { EntityDef } from '@fayz-ai/saas'
import { tl } from '../i18n/tl'

export interface BeautyService {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number
  status: string
}

export interface ServicePackage {
  id: string
  name: string
  description?: string
  price: number
  validityDays?: number
  maxUses?: number
  isActive: boolean
}

// ---------------------------------------------------------------------------
// Services — service archetype, direct query on public.services
// ---------------------------------------------------------------------------
export const serviceEntity: EntityDef<BeautyService> = {
  name: tl('Service', 'Serviço'),
  icon: 'Briefcase',
  layout: 'service',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Service Name', 'Nome do Serviço'), type: 'text', required: true, searchable: true, showInTable: true },
    { key: 'description', label: tl('Description', 'Descrição'), type: 'textarea', showInTable: false },
    { key: 'durationMinutes', label: tl('Duration (min)', 'Duração (min)'), type: 'number', required: true, showInTable: true },
    { key: 'price', label: tl('Price', 'Preço'), type: 'currency', required: true, showInTable: true },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  // Services are their own Ring-0 archetype table (public.services), not a
  // kind of product. Direct query by table+schema (no kind filter).
  data: {
    table: 'services',
    schema: 'public',
    tenantScoped: true,
    searchColumns: ['name'],
  },
}

export const servicePackageEntity: EntityDef<ServicePackage> = {
  name: tl('Service Package', 'Pacote de Serviços'),
  namePlural: tl('Service Packages', 'Pacotes de Serviços'),
  icon: 'Package',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Package Name', 'Nome do Pacote'), type: 'text', required: true, searchable: true, showInTable: true },
    { key: 'description', label: tl('Description', 'Descrição'), type: 'textarea' },
    { key: 'price', label: tl('Package Price', 'Preço do Pacote'), type: 'currency', required: true, showInTable: true, defaultValue: 0 },
    { key: 'validityDays', label: tl('Validity (days)', 'Validade (dias)'), type: 'number', showInTable: true },
    { key: 'maxUses', label: tl('Maximum Uses', 'Usos máximos'), type: 'number', showInTable: true },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'service_packages',
    tenantScoped: true,
    searchColumns: ['name', 'description'],
  },
}

export const servicePackageItemEntity: EntityDef = {
  // Join/config row — meaningless as a conversational target; the agent
  // reaches this data via the pricing quote RPC and service reads.
  agentHidden: true,
  name: tl('Package Service', 'Serviço do Pacote'),
  namePlural: tl('Package Services', 'Serviços do Pacote'),
  icon: 'ListChecks',
  displayField: 'packageId',
  defaultSort: 'sortOrder',
  fields: [
    {
      key: 'packageId',
      label: tl('Package', 'Pacote'),
      type: 'relation',
      relation: { table: 'service_packages', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    {
      key: 'serviceId',
      label: tl('Service', 'Serviço'),
      type: 'relation',
      relation: { table: 'services', schema: 'public', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    { key: 'includedQuantity', label: tl('Included Qty', 'Qtd. incluída'), type: 'number', required: true, showInTable: true, defaultValue: 1 },
    { key: 'unitPrice', label: tl('Unit Price', 'Preço unitário'), type: 'currency', showInTable: true },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
  ],
  data: {
    table: 'service_package_items',
    tenantScoped: true,
  },
}

export const servicePriceTableEntity: EntityDef = {
  name: tl('Price Table', 'Tabela de Preços'),
  namePlural: tl('Price Tables', 'Tabelas de Preços'),
  icon: 'BadgeDollarSign',
  displayField: 'name',
  defaultSort: 'sortOrder',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, searchable: true, showInTable: true },
    { key: 'description', label: tl('Description', 'Descrição'), type: 'textarea' },
    { key: 'startsOn', label: tl('Starts On', 'Início'), type: 'date', showInTable: true },
    { key: 'endsOn', label: tl('Ends On', 'Fim'), type: 'date', showInTable: true },
    { key: 'isDefault', label: tl('Default', 'Padrão'), type: 'boolean', showInTable: true, defaultValue: false, inlineToggle: true },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'service_price_tables',
    tenantScoped: true,
    searchColumns: ['name', 'description'],
  },
}

export const servicePriceTableItemEntity: EntityDef = {
  // Join/config row — meaningless as a conversational target; the agent
  // reaches this data via the pricing quote RPC and service reads.
  agentHidden: true,
  name: tl('Service Price', 'Preço de Serviço'),
  namePlural: tl('Service Prices', 'Preços de Serviços'),
  icon: 'CircleDollarSign',
  displayField: 'serviceId',
  defaultSort: 'serviceId',
  fields: [
    {
      key: 'priceTableId',
      label: tl('Price Table', 'Tabela de Preços'),
      type: 'relation',
      relation: { table: 'service_price_tables', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    {
      key: 'serviceId',
      label: tl('Service', 'Serviço'),
      type: 'relation',
      relation: { table: 'services', schema: 'public', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    { key: 'price', label: tl('Price', 'Preço'), type: 'currency', required: true, showInTable: true, defaultValue: 0 },
    { key: 'durationMinutes', label: tl('Duration (min)', 'Duração (min)'), type: 'number', showInTable: true },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea' },
  ],
  data: {
    table: 'service_price_table_items',
    tenantScoped: true,
  },
}

export const servicePriceVariationEntity: EntityDef = {
  name: tl('Price Variation', 'Variação de Preço'),
  namePlural: tl('Price Variations', 'Variações de Preço'),
  icon: 'Tags',
  displayField: 'name',
  defaultSort: 'sortOrder',
  fieldGroups: [
    { id: 'rule', label: tl('Rule', 'Regra'), columns: 2 },
    { id: 'filters', label: tl('Applicability', 'Aplicabilidade'), columns: 2 },
  ],
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, searchable: true, showInTable: true, group: 'rule' },
    {
      key: 'variationType',
      label: tl('Variation Type', 'Tipo de Variação'),
      type: 'select',
      options: [
        { label: tl('Discount', 'Desconto'), value: 'discount' },
        { label: tl('Addition', 'Acréscimo'), value: 'addition' },
      ],
      required: true,
      showInTable: true,
      defaultValue: 'discount',
      group: 'rule',
    },
    {
      key: 'valueType',
      label: tl('Value Type', 'Tipo de Valor'),
      type: 'select',
      options: [
        { label: tl('Percentage', 'Percentual'), value: 'percentage' },
        { label: tl('Fixed Amount', 'Valor Fixo'), value: 'fixed' },
      ],
      required: true,
      showInTable: true,
      defaultValue: 'percentage',
      group: 'rule',
    },
    { key: 'value', label: tl('Value', 'Valor'), type: 'currency', required: true, showInTable: true, defaultValue: 0, group: 'rule' },
    { key: 'firstAppointmentOnly', label: tl('First Appointment Only', 'Somente Primeiro Atendimento'), type: 'boolean', showInTable: true, defaultValue: false, inlineToggle: true, group: 'rule' },
    {
      key: 'serviceFilterType',
      label: tl('Service Filter', 'Filtro de Serviço'),
      type: 'select',
      options: ['all', 'only', 'except'],
      required: true,
      defaultValue: 'all',
      group: 'filters',
    },
    {
      key: 'serviceId',
      label: tl('Service', 'Serviço'),
      type: 'relation',
      relation: { table: 'services', schema: 'public', labelField: 'name' },
      group: 'filters',
    },
    {
      key: 'professionalFilterType',
      label: tl('Professional Filter', 'Filtro de Profissional'),
      type: 'select',
      options: ['all', 'only', 'except'],
      required: true,
      defaultValue: 'all',
      group: 'filters',
    },
    {
      key: 'professionalId',
      label: tl('Professional', 'Profissional'),
      type: 'relation',
      relation: { table: 'people', schema: 'public', labelField: 'name', filter: { kind: 'staff' } },
      group: 'filters',
    },
    {
      key: 'categoryFilterType',
      label: tl('Category Filter', 'Filtro de Categoria'),
      type: 'select',
      options: ['all', 'only', 'except'],
      required: true,
      defaultValue: 'all',
      group: 'filters',
    },
    {
      key: 'categoryId',
      label: tl('Category', 'Categoria'),
      type: 'relation',
      relation: { table: 'categories', schema: 'public', labelField: 'name', filter: { kind: 'service_category' } },
      group: 'filters',
    },
    {
      key: 'unitFilterType',
      label: tl('Unit Filter', 'Filtro de Unidade'),
      type: 'select',
      options: ['all', 'only', 'except'],
      required: true,
      defaultValue: 'all',
      group: 'filters',
    },
    {
      key: 'unitId',
      label: tl('Unit/Location', 'Unidade/Local'),
      type: 'relation',
      relation: { table: 'locations', schema: 'public', labelField: 'name', filter: { kind: 'branch' } },
      group: 'filters',
    },
    {
      key: 'partnershipFilterType',
      label: tl('Partnership Filter', 'Filtro de Parceria'),
      type: 'select',
      options: ['all', 'only', 'except'],
      required: true,
      defaultValue: 'all',
      group: 'filters',
    },
    {
      key: 'partnershipId',
      label: tl('Partnership', 'Parceria'),
      type: 'relation',
      relation: { table: 'people', schema: 'public', labelField: 'name', filter: { kind: 'partner' } },
      group: 'filters',
    },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0, group: 'rule' },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true, group: 'rule' },
  ],
  data: {
    table: 'service_price_variations',
    tenantScoped: true,
    searchColumns: ['name'],
  },
}

export const serviceDefaultProductEntity: EntityDef = {
  // Join/config row — meaningless as a conversational target; the agent
  // reaches this data via the pricing quote RPC and service reads.
  agentHidden: true,
  name: tl('Service Default Product', 'Produto Padrão do Serviço'),
  namePlural: tl('Service Default Products', 'Produtos Padrão dos Serviços'),
  icon: 'Boxes',
  displayField: 'serviceId',
  defaultSort: 'sortOrder',
  fields: [
    {
      key: 'serviceId',
      label: tl('Service', 'Serviço'),
      type: 'relation',
      relation: { table: 'services', schema: 'public', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    {
      key: 'productId',
      label: tl('Product', 'Produto'),
      type: 'relation',
      relation: { table: 'products', schema: 'public', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    { key: 'quantity', label: tl('Quantity', 'Quantidade'), type: 'number', required: true, showInTable: true, defaultValue: 1 },
    { key: 'unit', label: tl('Unit', 'Unidade'), type: 'text', showInTable: true },
    {
      key: 'deductionTiming',
      label: tl('Deduction Timing', 'Momento da Baixa'),
      type: 'select',
      options: [
        { label: tl('On Execution', 'No atendimento'), value: 'on_execution' },
        { label: tl('On Completion', 'Na conclusão'), value: 'on_completion' },
        { label: tl('Manual', 'Manual'), value: 'manual' },
      ],
      required: true,
      showInTable: true,
      defaultValue: 'on_execution',
    },
    { key: 'isRequired', label: tl('Required', 'Obrigatório'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea' },
  ],
  data: {
    table: 'service_default_products',
    tenantScoped: true,
  },
}

export const serviceDefaultTemplateEntity: EntityDef = {
  // Join/config row — meaningless as a conversational target; the agent
  // reaches this data via the pricing quote RPC and service reads.
  agentHidden: true,
  name: tl('Service Default Form/Contract', 'Formulário/Contrato Padrão do Serviço'),
  namePlural: tl('Service Default Forms/Contracts', 'Formulários/Contratos Padrão dos Serviços'),
  icon: 'FileCheck2',
  displayField: 'serviceId',
  defaultSort: 'sortOrder',
  fields: [
    {
      key: 'serviceId',
      label: tl('Service', 'Serviço'),
      type: 'relation',
      relation: { table: 'services', schema: 'public', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    {
      key: 'templateId',
      label: tl('Template', 'Modelo'),
      type: 'relation',
      relation: { table: 'plg_forms_templates', labelField: 'name' },
      required: true,
      showInTable: true,
    },
    {
      key: 'templateKind',
      label: tl('Template Kind', 'Tipo do Modelo'),
      type: 'select',
      options: [
        { label: tl('Form', 'Formulário'), value: 'form' },
        { label: tl('Contract', 'Contrato'), value: 'contract' },
        { label: tl('Consent', 'Consentimento'), value: 'consent' },
        { label: tl('Anamnesis', 'Anamnese'), value: 'anamnesis' },
      ],
      required: true,
      showInTable: true,
      defaultValue: 'form',
    },
    {
      key: 'trigger',
      label: tl('Trigger', 'Gatilho'),
      type: 'select',
      options: [
        { label: tl('Before Execution', 'Antes do atendimento'), value: 'before_execution' },
        { label: tl('During Execution', 'Durante o atendimento'), value: 'during_execution' },
        { label: tl('After Completion', 'Após a conclusão'), value: 'after_completion' },
      ],
      required: true,
      showInTable: true,
      defaultValue: 'before_execution',
    },
    { key: 'isRequired', label: tl('Required', 'Obrigatório'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea' },
  ],
  data: {
    table: 'service_default_templates',
    tenantScoped: true,
  },
}
