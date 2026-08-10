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
/**
 * Recover from a stale-chunk blank page.
 *
 * Routes are lazily imported, so a tab left open across a deploy holds an
 * index.html whose asset hashes no longer exist. Navigating to a not-yet-loaded
 * route then fails its dynamic import and renders nothing — no error, just a
 * blank pane. Observed live: five deploys in an hour left an open tab dead on
 * the Population route.
 *
 * The host makes this quieter than it should be: a missing /assets/* path
 * returns 200 with index.html rather than 404, so the browser reports a MIME
 * type error instead of a clean fetch failure. Vite raises `vite:preloadError`
 * either way, which is what we listen for.
 *
 * A reload fetches the current index.html (which is served
 * `max-age=0, must-revalidate`, so it genuinely re-fetches) and the new hashes
 * with it. Guarded by sessionStorage so a chunk that is broken for any *other*
 * reason fails visibly once rather than reload-looping forever.
 */
const RELOAD_GUARD = 'spier:chunk-reload'

// The guard records *which build* already tried a reload, rather than a bare
// "we reloaded once". A plain flag is the obvious version and it is wrong in
// both directions: cleared on load it loops forever on a genuinely broken
// chunk, and never cleared it gives up on the second deploy of a session.
//
// Keying on the entry script's hashed filename gets both right. Reloading onto
// a *new* build changes this id, so the stale guard no longer matches and a
// later deploy can recover too. Reloading onto the *same* build leaves it
// matching, so a chunk broken for some other reason fails visibly instead of
// reload-looping. (In dev the src is the stable `/src/main.tsx`, which behaves
// as the "same build" case — correct, since dev has no stale-hash problem.)
const buildId =
  document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? 'unknown'

window.addEventListener('vite:preloadError', event => {
  if (sessionStorage.getItem(RELOAD_GUARD) === buildId) return
  sessionStorage.setItem(RELOAD_GUARD, buildId)
  event.preventDefault()
  window.location.reload()
})

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
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </HashRouter>
  </StrictMode>,
)
