import type { EntityDef } from '@fayz-ai/core'
import { tl } from '../i18n/tl'

export interface BeautyService {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number
  status: string
}

// ---------------------------------------------------------------------------
// Services — service archetype, direct query on saas_core.services
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
}
