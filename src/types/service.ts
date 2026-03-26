import type { EntityDef } from '@fayz/saas-core'

export interface BeautyService {
  id: string
  tenantId: string
  createdAt: string
  updatedAt: string
  name: string
  category: string
  duration: number
  price: number
  status: 'active' | 'inactive'
}

export const serviceEntity: EntityDef<BeautyService> = {
  name: 'Service',
  icon: 'Package',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: 'Service Name', type: 'text', required: true, searchable: true },
    { key: 'category', label: 'Category', type: 'select', options: ['Hair', 'Nails', 'Skin', 'Body'], required: true },
    { key: 'duration', label: 'Duration (min)', type: 'number', min: 5, max: 480, required: true },
    { key: 'price', label: 'Price', type: 'currency', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], defaultValue: 'active' },
  ],
}
