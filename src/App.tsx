import { useEffect } from 'react'
import { renderApp, defineSaas } from '@fayz-ai/saas'
import { beautyAppConfig } from './config/app'
import { createGoogleCalendarProvider } from './plugins/google-calendar/data/supabase'

const beautyManifest = defineSaas(beautyAppConfig)

export function App() {
  useEffect(() => {
    if (import.meta.env.VITE_GOOGLE_CALENDAR_ENABLED !== 'true') return
    const provider = createGoogleCalendarProvider()
    const syncIntervalMs = import.meta.env.DEV ? 10_000 : 5 * 60 * 1000
    let running = false
    const sync = async () => {
      if (running || document.visibilityState === 'hidden') return
      running = true
      try {
        const integration = await provider.getIntegration()
        if (integration?.connected) await provider.syncNow()
      } catch {
        // Background sync is best effort; the integrations panel exposes errors
        // and keeps the explicit retry action.
      } finally {
        running = false
      }
    }
    const initial = window.setTimeout(() => void sync(), 1000)
    const interval = window.setInterval(() => void sync(), syncIntervalMs)
    const onVisible = () => { if (document.visibilityState === 'visible') void sync() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return renderApp(beautyManifest, { surface: 'admin' })
}
