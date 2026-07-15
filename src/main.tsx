import React from 'react'
import ReactDOM from 'react-dom/client'
import { setCurrentLocale } from '@fayz-ai/saas'
import { App } from './App'
import './styles.css'

// Sync @fayz-ai/core's locale so the native (de-bridged) plugins render in pt-BR
// while the shell is still saas-core. Removed once the shell de-bridges and the
// native createFayzApp owns the locale.
setCurrentLocale('pt-BR')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
