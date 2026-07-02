import type { PluginManifest } from '@fayz-ai/saas'
import { googleCalendarConnector } from './connectorDef'

export function createGoogleCalendarPlugin(): PluginManifest {
  return { id: 'google-calendar', name: 'Google Calendar', icon: 'Calendar', version: '0.1.0',
    scope: 'addon', defaultEnabled: true, dependencies: ['agenda'], navigation: [], routes: [], connectors: [googleCalendarConnector] }
}
