import type { BeautyService } from '../types/service'

export const mockServices: BeautyService[] = [
  { id: '1', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Haircut & Blowout', category: 'Hair', duration: 45, price: 65, status: 'active' },
  { id: '2', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Balayage', category: 'Hair', duration: 150, price: 250, status: 'active' },
  { id: '3', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Full Color', category: 'Hair', duration: 120, price: 180, status: 'active' },
  { id: '4', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Highlights', category: 'Hair', duration: 90, price: 150, status: 'active' },
  { id: '5', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Deep Conditioning', category: 'Hair', duration: 30, price: 45, status: 'active' },
  { id: '6', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Classic Manicure', category: 'Nails', duration: 30, price: 35, status: 'active' },
  { id: '7', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Gel Manicure', category: 'Nails', duration: 45, price: 55, status: 'active' },
  { id: '8', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Classic Pedicure', category: 'Nails', duration: 45, price: 50, status: 'active' },
  { id: '9', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Full Set Acrylics', category: 'Nails', duration: 90, price: 85, status: 'active' },
  { id: '10', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Nail Art (per nail)', category: 'Nails', duration: 10, price: 10, status: 'active' },
  { id: '11', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Classic Facial', category: 'Skin', duration: 60, price: 95, status: 'active' },
  { id: '12', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Hydra Facial', category: 'Skin', duration: 75, price: 150, status: 'active' },
  { id: '13', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Chemical Peel', category: 'Skin', duration: 45, price: 120, status: 'active' },
  { id: '14', tenantId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01', name: 'Microdermabrasion', category: 'Skin', duration: 60, price: 130, status: 'active' },
]
