/**
 * @vitest-environment jsdom
 *
 * Opening the app from the EHR fails in a clinician's words, whatever
 * fhirclient threw.
 *
 * ⚠️ **Every error here is one fhirclient REALLY throws**, not a hand-typed
 * string. The launch and redirect pages printed `err.message` until 2026-10-07,
 * and that message is assembled inside the library — "403 Forbidden\nURL: …"
 * with the server's `error_description` appended, "access_denied: …", "No
 * 'state' parameter found. Please (re)launch the app." — so no gate that reads
 * literals could see it. This mounts the REAL `SmartLaunch` and `SmartRedirect`
 * over the REAL `authorize()` and `ready()`; only `fetch` and the page's URL
 * are stubbed, which is where a real EHR differs.
 *
 * ⚠️ **A fresh `BrowserAdapter` per call, and that is what a page load is.**
 * fhirclient's browser entry builds ONE adapter at import, and the adapter
 * caches `location` the first time it reads it — so a second case in the same
 * file would run against the first case's URL. The mock below hands each call a
 * new instance of fhirclient's own adapter, exactly as a real browser would by
 * loading `/launch` or `/redirect` afresh.
 *
 * Each case also asserts that the error the page logged DOES carry the wire
 * text it was expected to. Without that, a stub that failed with clean
 * messages would pass this test and prove nothing; and it pins that the
 * classifier's fhirclient message patterns still match what the library says.
 *
 * The pathway's load error is the third place a runtime string reached the
 * clinician, and is covered at the bottom.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SmartContext, type SmartContextType } from '@spier/app-shell/context/SmartContext'
import { InspectContext } from '@spier/tool-views/context/InspectContext'
import { PathwayLoadError } from '@spier/app-shell/components/PathwayView'
import { parsePathway } from '@spier/core/lib/pathway'
import { RESOURCE_TYPES } from '../../../../scripts/lib/fhir-vocabulary.mjs'

vi.mock('fhirclient/browser', async () => {
  // fhirclient 3's declarations reference a `./types` module its tarball omits,
  // so the adapter's type does not resolve; this is the surface the pages call.
  type SmartApi = {
    authorize: (options: unknown) => Promise<unknown>
    ready: (options?: unknown) => Promise<unknown>
  }
  const mod = (await import('fhirclient/adapters/BrowserAdapter')) as {
    default: new () => { getSmartApi: () => SmartApi }
  }
  const fresh = () => new mod.default().getSmartApi()
  return {
    default: {
      oauth2: {
        authorize: (options: unknown) => fresh().authorize(options),
        ready: (options?: unknown) => fresh().ready(options),
      },
    },
  }
})
vi.mock('@spier/tool-views/context/PresentationContext', () => ({
  usePresentation: () => ({ chromeMode: 'ehr', setHostDrawsPatientBanner: () => {} }),
}))

const { SmartLaunch } = await import('@spier/app-shell/components/SmartLaunch')
const { SmartRedirect } = await import('@spier/app-shell/components/SmartRedirect')

const ISS = 'https://ehr.test/fhir'
const TOKEN_URI = 'https://ehr.test/auth/token'
const STATE_KEY = 'state-k'

/**
 * What the clinician must not read: every resource type (singular or plural),
 * a transport status and its number, a URL, the protocols' names, an OAuth
 * error code, and the parameters fhirclient names in its own messages.
 */
const WIRE_WORDS: RegExp[] = [
  ...[...RESOURCE_TYPES, 'OperationOutcome', 'CapabilityStatement'].map(t => new RegExp(`\\b${t}s?\\b`)),
  /HTTP/i,
  /\b[45]\d\d\b/,
  /\bSMART\b/,
  /\bFHIR\b/,
  /OAuth/i,
  /https?:\/\//,
  /\b[a-z]+_[a-z_]+\b/, // access_denied, invalid_grant, error_description
  /\btoken\b/i,
  /\b(iss|state|code|launch)\b/, // fhirclient's parameter names, as words
  /well-known|conformance|metadata/i,
]

const wireIn = (text: string) => WIRE_WORDS.filter(re => re.test(text)).map(String)

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>

function json(status: number, statusText: string, body: unknown, type = 'application/json') {
  return new Response(JSON.stringify(body), { status, statusText, headers: { 'content-type': type } })
}

const OUTCOME = (diagnostics: string) => ({
  resourceType: 'OperationOutcome',
  issue: [{ severity: 'error', code: 'forbidden', diagnostics }],
})

/** A token response granting a chart launch for `pt-1`. */
const GRANTED: Route = () =>
  json(200, 'OK', { access_token: 'at', token_type: 'bearer', scope: 'launch patient/*.read', patient: 'pt-1' })

const networkDown = (): never => {
  throw new TypeError('Failed to fetch')
}

/**
 * A constructed `Response` has an empty `url`; one from a real `fetch` has the
 * URL it came from, and fhirclient's `HttpError` prints it. Stamp it, so the
 * message is the one a clinician would have been shown.
 */
function fromUrl(url: string, res: Response): Response {
  Object.defineProperty(res, 'url', { value: url })
  return res
}

function stubFetch(routes: { token?: Route; patient?: Route; discovery?: Route }) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url === TOKEN_URI && routes.token) return fromUrl(url, await routes.token(url, init))
    if (url.startsWith(`${ISS}/Patient/`) && routes.patient) return fromUrl(url, await routes.patient(url, init))
    if ((url.endsWith('/.well-known/smart-configuration') || url.endsWith('/metadata')) && routes.discovery) {
      return fromUrl(url, await routes.discovery(url, init))
    }
    throw new Error(`test: unexpected fetch ${url}`)
  })
}

/** The page URL fhirclient reads, and the sign-in a `/launch` would have stored. */
function pageAt(search: string, { pendingSignIn = false } = {}) {
  window.history.replaceState({}, '', `/${search}`)
  sessionStorage.clear()
  if (pendingSignIn) {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        serverUrl: ISS,
        clientId: 'spier-test',
        redirectUri: 'http://localhost:3000/',
        tokenUri: TOKEN_URI,
        scope: 'launch patient/*.read',
        completeInTarget: true,
      }),
    )
  }
}

const smart: SmartContextType = {
  client: null,
  patient: null,
  error: null,
  setSmartData: () => {},
  setError: () => {},
}

let logged: unknown[]
beforeEach(() => {
  logged = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(...args.filter(a => a instanceof Error))
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

interface Case {
  name: string
  page: 'launch' | 'redirect'
  search: string
  pendingSignIn?: boolean
  routes?: Parameters<typeof stubFetch>[0]
  /** The heading the clinician should read. */
  title: string
  /** What the thrown error really said — proves the stub produced wire text. */
  raw: RegExp
}

const CASES: Case[] = [
  {
    name: 'opened with no EHR named',
    page: 'launch',
    search: '',
    title: 'This app was not opened from the EHR.',
    raw: /^No server url found/,
  },
  {
    name: 'the EHR cannot be reached to start signing in',
    page: 'launch',
    search: `?iss=${encodeURIComponent(ISS)}&launch=l-1`,
    routes: { discovery: networkDown },
    title: 'Could not reach the EHR.',
    raw: /^Failed to fetch the conformance statement from "https:\/\/ehr\.test\/fhir\/metadata"/,
  },
  {
    name: 'the EHR’s sign-in refused the app',
    page: 'redirect',
    search: `?error=access_denied&error_description=${encodeURIComponent('The user denied the request')}&state=${STATE_KEY}`,
    pendingSignIn: true,
    title: 'The EHR did not let this app open.',
    raw: /^access_denied: The user denied the request$/,
  },
  {
    name: 'the redirect page opened directly',
    page: 'redirect',
    search: '',
    title: 'This app was not opened from the EHR.',
    raw: /^No 'state' parameter found/,
  },
  {
    name: 'the sign-in already completed in another tab',
    page: 'redirect',
    search: `?code=c-1&state=${STATE_KEY}`,
    title: 'This app was not opened from the EHR.',
    raw: /^No state found/,
  },
  {
    name: 'the code was already redeemed',
    page: 'redirect',
    search: `?code=c-1&state=${STATE_KEY}`,
    pendingSignIn: true,
    routes: {
      token: () =>
        json(400, 'Bad Request', { error: 'invalid_grant', error_description: 'This authorization code has already been redeemed' }),
    },
    title: 'The EHR did not let this app open.',
    raw: /^400 Bad Request\nURL: https:\/\/ehr\.test\/auth\/token\ninvalid_grant: This authorization code/,
  },
  {
    name: 'the sign-in service is down',
    page: 'redirect',
    search: `?code=c-1&state=${STATE_KEY}`,
    pendingSignIn: true,
    routes: {
      token: () => new Response('upstream connect error', { status: 503, statusText: 'Service Unavailable', headers: { 'content-type': 'text/plain' } }),
    },
    title: 'Could not reach the EHR.',
    raw: /^503 Service Unavailable\nURL: https:\/\/ehr\.test\/auth\/token\n\nupstream connect error$/,
  },
  {
    name: 'the network drops during sign-in',
    page: 'redirect',
    search: `?code=c-1&state=${STATE_KEY}`,
    pendingSignIn: true,
    routes: { token: networkDown },
    title: 'Could not reach the EHR.',
    raw: /^Failed to fetch$/,
  },
  {
    name: 'signed in, then refused the patient',
    page: 'redirect',
    search: `?code=c-1&state=${STATE_KEY}`,
    pendingSignIn: true,
    routes: {
      token: GRANTED,
      patient: () => json(403, 'Forbidden', OUTCOME('Patient/pt-1: scope patient/Patient.read not granted'), 'application/fhir+json'),
    },
    title: 'The EHR did not let this app open.',
    raw: /^403 Forbidden\nURL: https:\/\/ehr\.test\/fhir\/Patient\/pt-1[\s\S]*OperationOutcome/,
  },
  {
    name: 'signed in, then the patient is not there',
    page: 'redirect',
    search: `?code=c-1&state=${STATE_KEY}`,
    pendingSignIn: true,
    routes: {
      token: GRANTED,
      patient: () => json(404, 'Not Found', OUTCOME('Resource Patient/pt-1 is not known'), 'application/fhir+json'),
    },
    title: 'Could not read this patient’s details from the EHR.',
    raw: /^404 Not Found\nURL: https:\/\/ehr\.test\/fhir\/Patient\/pt-1[\s\S]*OperationOutcome/,
  },
]

describe('the launch and redirect pages word a failed launch, and never print it', () => {
  it.each(CASES)('$name', async c => {
    pageAt(c.search, { pendingSignIn: c.pendingSignIn })
    stubFetch(c.routes ?? {})

    render(
      <SmartContext.Provider value={smart}>
        <MemoryRouter>{c.page === 'launch' ? <SmartLaunch /> : <SmartRedirect />}</MemoryRouter>
      </SmartContext.Provider>,
    )

    const alert = await screen.findByRole('alert')
    const shown = alert.textContent ?? ''

    // The error the page logged is the library's own, carrying the wire text.
    await waitFor(() => expect(logged.length).toBeGreaterThan(0))
    const thrown = logged[0] as Error
    expect(thrown.message).toMatch(c.raw)

    expect(screen.getByRole('heading').textContent).toBe(c.title)
    expect(wireIn(shown)).toEqual([])
    expect(shown).not.toContain(thrown.message.split('\n')[0])
  })
})

describe('the pathway load error shows its detail only where inspection is on', () => {
  /** A real parse failure, from the real parser. */
  const parseError = (() => {
    try {
      parsePathway({ resourceType: 'PlanDefinition', version: '1.0.0', action: [] })
    } catch (e) {
      return (e as Error).message
    }
    throw new Error('test: parsePathway accepted a PlanDefinition with no url')
  })()

  it('carries the wire text it must not show', () => {
    expect(parseError).toMatch(/PlanDefinition/)
  })

  it('in the clinical app, says what happened and prints nothing else', () => {
    const { container } = render(<PathwayLoadError error={parseError} />)
    const shown = container.textContent ?? ''
    expect(container.querySelector('pre')).toBeNull()
    expect(wireIn(shown)).toEqual([])
    expect(shown).toContain('The care pathway could not be loaded')
  })

  it('in the guide, keeps the detail for whoever maintains the deployment', () => {
    const { container } = render(
      <InspectContext.Provider value>
        <PathwayLoadError error={parseError} />
      </InspectContext.Provider>,
    )
    expect(container.querySelector('pre')?.textContent).toBe(parseError)
  })
})
