import { renderApp } from '@fayz-ai/core'
import { defineSaas } from '@fayz-ai/saas'
import { beautyAppConfig } from './config/app'

const beautyManifest = defineSaas(beautyAppConfig)

export function App() {
  return renderApp(beautyManifest, { surface: 'admin' })
}
