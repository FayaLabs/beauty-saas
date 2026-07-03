// Beauty-SaaS — composed Drizzle schema (migration source of truth).
//   • Ring 0 spine references (@fayz-ai/db) — FK targets, baseline only
//   • Ring 1 plugin tables   (@fayz-ai/plugin-*/schema) — one line per plugin
//   • Ring 2/standalone app tables — clients/staff/appointments/service extensions
//
// `drizzle-kit generate` diffs this vs meta/_snapshot.json and emits the delta.
// (Plugins without a Drizzle schema yet — agenda/financial/inventory — are
// provisioned via their companion SQL through `pnpm db:apply`, not here.)

// Ring 0 — spine references (baseline snapshot; never re-created live)
export { tenants, persons, orders, bookings } from '@fayz-ai/saas/db'

// Ring 2 / standalone — beauty-owned tables
export { clients } from './clients'
export { staffMembers } from './staff'
export {
  servicePackages,
  servicePackageItems,
  servicePriceTables,
  servicePriceTableItems,
  servicePriceVariations,
  serviceDefaultProducts,
  serviceDefaultTemplates,
} from './services'
export {
  appointments,
  appointmentCancellationReasons,
  appointmentConfirmationChannels,
  appointmentScheduleRules,
  appointmentWaitlistEntries,
} from './appointments'

// Ring 1 — enabled plugins with a Drizzle schema
export * from '@fayz-ai/plugin-crm/schema'
export * from '../../plugins/openbanking/schema'
