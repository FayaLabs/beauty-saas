import { useEffect } from 'react'
import { renderApp, defineSaas } from '@fayz-ai/saas'
import { getActiveTenantId, getSupabaseClientOptional } from '@fayz-ai/saas'
import { beautyAppConfig } from './config/app'

const beautyManifest = defineSaas(beautyAppConfig)

export function App() {
  useEffect(() => {
    if (import.meta.env.VITE_GOOGLE_CALENDAR_ENABLED !== 'true') return
    const supabase = getSupabaseClientOptional() as any
    if (!supabase) return
    const channel = supabase.channel('agenda-bookings-refresh')
      .on('postgres_changes', { event: '*', schema: 'saas_core', table: 'bookings' }, (payload: any) => {
        const changedTenantId = payload.new?.tenant_id ?? payload.old?.tenant_id
        if (!changedTenantId || changedTenantId === getActiveTenantId()) {
          window.dispatchEvent(new CustomEvent('agenda:refresh'))
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  return renderApp(beautyManifest, { surface: 'admin' })
}
