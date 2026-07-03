import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  tenantId,
  timestamps,
  uuid,
  saasCore,
} from '@fayz-ai/saas/db'

const coreServices = saasCore.table('services', {
  id: uuid('id').primaryKey(),
})

const coreProducts = saasCore.table('products', {
  id: uuid('id').primaryKey(),
})

const formTemplates = pgTable('frm_templates', {
  id: uuid('id').primaryKey(),
})

const serviceCategories = saasCore.table('categories', {
  id: uuid('id').primaryKey(),
})

const serviceLocations = saasCore.table('locations', {
  id: uuid('id').primaryKey(),
})

const corePersons = saasCore.table('persons', {
  id: uuid('id').primaryKey(),
})

export const servicePackages = pgTable('service_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  validityDays: integer('validity_days'),
  maxUses: integer('max_uses'),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => ({
  tenantActiveIdx: index('service_packages_tenant_active_idx').on(table.tenantId, table.isActive, table.name),
}))

export const servicePackageItems = pgTable('service_package_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  packageId: uuid('package_id').notNull().references(() => servicePackages.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => coreServices.id, { onDelete: 'cascade' }),
  includedQuantity: integer('included_quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, (table) => ({
  tenantPackageIdx: index('service_package_items_tenant_package_idx').on(table.tenantId, table.packageId, table.sortOrder),
  serviceIdx: index('service_package_items_service_idx').on(table.serviceId),
}))

export const servicePriceTables = pgTable('service_price_tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: text('name').notNull(),
  description: text('description'),
  startsOn: date('starts_on'),
  endsOn: date('ends_on'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => ({
  tenantActiveIdx: index('service_price_tables_tenant_active_idx').on(table.tenantId, table.isActive, table.sortOrder),
}))

export const servicePriceTableItems = pgTable('service_price_table_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  priceTableId: uuid('price_table_id').notNull().references(() => servicePriceTables.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => coreServices.id, { onDelete: 'cascade' }),
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  ...timestamps,
}, (table) => ({
  tenantTableIdx: index('service_price_table_items_tenant_table_idx').on(table.tenantId, table.priceTableId),
  serviceIdx: index('service_price_table_items_service_idx').on(table.serviceId),
}))

export const servicePriceVariations = pgTable('service_price_variations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  name: text('name').notNull(),
  variationType: text('variation_type').notNull().default('discount'),
  valueType: text('value_type').notNull().default('percentage'),
  value: numeric('value', { precision: 12, scale: 2 }).notNull().default('0'),
  firstAppointmentOnly: boolean('first_appointment_only').notNull().default(false),
  categoryFilterType: text('category_filter_type').notNull().default('all'),
  categoryId: uuid('category_id').references(() => serviceCategories.id, { onDelete: 'set null' }),
  professionalFilterType: text('professional_filter_type').notNull().default('all'),
  professionalId: uuid('professional_id').references(() => corePersons.id, { onDelete: 'set null' }),
  partnershipFilterType: text('partnership_filter_type').notNull().default('all'),
  partnershipId: uuid('partnership_id').references(() => corePersons.id, { onDelete: 'set null' }),
  unitFilterType: text('unit_filter_type').notNull().default('all'),
  unitId: uuid('unit_id').references(() => serviceLocations.id, { onDelete: 'set null' }),
  serviceFilterType: text('service_filter_type').notNull().default('all'),
  serviceId: uuid('service_id').references(() => coreServices.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
}, (table) => ({
  tenantActiveIdx: index('service_price_variations_tenant_active_idx').on(table.tenantId, table.isActive, table.sortOrder),
  serviceIdx: index('service_price_variations_service_idx').on(table.serviceId),
  professionalIdx: index('service_price_variations_professional_idx').on(table.professionalId),
}))

export const serviceDefaultProducts = pgTable('service_default_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  serviceId: uuid('service_id').notNull().references(() => coreServices.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => coreProducts.id, { onDelete: 'restrict' }),
  quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull().default('1'),
  unit: text('unit'),
  deductionTiming: text('deduction_timing').notNull().default('on_execution'),
  isRequired: boolean('is_required').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  notes: text('notes'),
  ...timestamps,
}, (table) => ({
  tenantServiceIdx: index('service_default_products_tenant_service_idx').on(table.tenantId, table.serviceId, table.sortOrder),
  productIdx: index('service_default_products_product_idx').on(table.productId),
}))

export const serviceDefaultTemplates = pgTable('service_default_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  serviceId: uuid('service_id').notNull().references(() => coreServices.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => formTemplates.id, { onDelete: 'restrict' }),
  templateKind: text('template_kind').notNull().default('form'),
  trigger: text('trigger').notNull().default('before_execution'),
  isRequired: boolean('is_required').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  notes: text('notes'),
  ...timestamps,
}, (table) => ({
  tenantServiceIdx: index('service_default_templates_tenant_service_idx').on(table.tenantId, table.serviceId, table.sortOrder),
  templateIdx: index('service_default_templates_template_idx').on(table.templateId),
}))
