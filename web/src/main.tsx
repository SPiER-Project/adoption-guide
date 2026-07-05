import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import './css/RiskPill.css'
import App from './App.tsx'

// SMART on FHIR bootstrap for the hash router. Both legs of the OAuth dance
// land on the app base URL with *real* query params — an EHR launch arrives
// as ?iss=…&launch=… and the authorization server redirects back with
// ?code=…&state=… (OAuth redirect URIs cannot carry hash fragments, and
// GitHub Pages serves no path other than the app base). fhirclient reads
// those params from location.search, which survives a hash change — so just
// route into the matching hash screen before the router mounts.
const searchParams = new URLSearchParams(window.location.search)
const atDefaultRoute =
  !window.location.hash || window.location.hash === '#' || window.location.hash === '#/'
if (atDefaultRoute) {
  if (searchParams.has('iss') && searchParams.has('launch')) {
    window.location.hash = '#/launch'
  } else if (searchParams.has('state') && (searchParams.has('code') || searchParams.has('error'))) {
    window.location.hash = '#/redirect'
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
