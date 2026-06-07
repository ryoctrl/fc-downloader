import React from 'react'
import ReactDOM from 'react-dom/client'
// Bundle the IBM Plex fonts locally (no Google Fonts CDN — keeps the app
// fully offline / local-first). Latin subset only: the UI chrome is Latin and
// Japanese text falls back to the system font stack. Imported before theme.css
// so the @font-face rules are registered first.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import { App } from './App'
import './theme.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
