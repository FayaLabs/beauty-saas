import type { BeautyClient } from '../types/client'

export const mockClients: BeautyClient[] = [
  { id: '1', tenantId: 't1', createdAt: '2025-06-01', updatedAt: '2026-03-08', name: 'Sarah Johnson', email: 'sarah@example.com', phone: '(555) 123-4567', visits: 24, totalSpent: 2840, lastVisit: '2026-03-08' },
  { id: '2', tenantId: 't1', createdAt: '2025-08-15', updatedAt: '2026-03-10', name: 'Emily Chen', email: 'emily@example.com', phone: '(555) 234-5678', visits: 18, totalSpent: 1620, lastVisit: '2026-03-10' },
  { id: '3', tenantId: 't1', createdAt: '2025-09-01', updatedAt: '2026-03-05', name: 'Rachel Kim', email: 'rachel@example.com', phone: '(555) 345-6789', visits: 12, totalSpent: 1080, lastVisit: '2026-03-05' },
  { id: '4', tenantId: 't1', createdAt: '2025-04-10', updatedAt: '2026-03-11', name: 'Jessica Lee', email: 'jess@example.com', phone: '(555) 456-7890', visits: 31, totalSpent: 4250, lastVisit: '2026-03-11' },
  { id: '5', tenantId: 't1', createdAt: '2025-11-20', updatedAt: '2026-02-28', name: 'Amanda White', email: 'amanda@example.com', phone: '(555) 567-8901', visits: 8, totalSpent: 720, lastVisit: '2026-02-28' },
  { id: '6', tenantId: 't1', createdAt: '2025-07-05', updatedAt: '2026-03-09', name: 'Nicole Brown', email: 'nicole@example.com', phone: '(555) 678-9012', visits: 15, totalSpent: 1950, lastVisit: '2026-03-09' },
]
