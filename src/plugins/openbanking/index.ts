// Open Banking plugin (app-local incubator) — public surface + manifest.
//
// CLIENT-OWNED connector following the SDK plugin contract. Settings-only
// (no left-nav page): contributes an "Open Banking" tab to /settings for
// connecting Tecnospeed PlugBank and importing the bank statement. Imported
// lines land in the SDK financial ledger and are reconciled in
// Financial → Conciliação (enable the financial `reconciliation` module).
//
// Graduation path (PLUGIN.md): move to fayz-sdk/plugins/plugin-banking-br.
import React from 'react'
import type { PluginManifest } from '@fayz-ai/saas'
import { BankIntegrationSettings } from './settings/BankIntegrationSettings'

export { createOpenBankingProvider } from './data/supabase'
export * from './schema'
export * from './types'

export function createOpenBankingPlugin(): PluginManifest {
  return {
    id: 'openbanking',
    name: 'Open Banking',
    icon: 'Landmark',
    version: '0.1.0',
    scope: 'addon',
    defaultEnabled: true,
    dependencies: ['financial'],
    navigation: [],
    routes: [],
    settings: [
      {
        id: 'openbanking',
        label: 'Open Banking',
        icon: 'Landmark',
        component: BankIntegrationSettings as React.ComponentType<any>,
        order: 50,
      },
    ],
  }
}
