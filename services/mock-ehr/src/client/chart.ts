/**
 * The chart page's behaviour: dock the panel over a SMART launch, subscribe to
 * the FHIRcast hub and announce this chart, ask this host for CDS cards, and
 * keep the server's own write log in view.
 *
 * Was `chartScript()` in chartPage.ts — 408 lines of ES5 inside a template
 * literal, with the page's values interpolated as `var PATIENT = ${…}`. The
 * values arrive as `ChartClientConfig` now (types.ts); see clientAssets.ts for
 * why that was the change that let this be a module.
 */
import { must, readConfig, renderInline } from './config'
import type { ChartClientConfig } from './types'

const config = readConfig<ChartClientConfig>()
const PATIENT = config.patient.id
const MRN = config.patient.mrn
const GIVEN = config.patient.given
const FAMILY = config.patient.family
// Imported by the page rather than restated: the MRN namespace has four sites
// that must agree and check:patients gates them (see fixtures.ts).
const MRN_SYSTEM = config.mrnSystem
// ⚠️ Displayed, not fetched. The browser calls this host's own /_admin/cds,
// which mints a signed JWT and invokes the service server-to-server — see
// routes/cds.ts. This stays because it is what the page SHOWS the reader, and
// because chartPage.test.ts asserts the three origins stay distinct through it.
const CDS_ENDPOINT = config.cdsEndpoint

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * The FHIRcast session topic, held in sessionStorage for the TAB.
 *
 * Per-tab rather than per-page: opening patient-012's chart is a full page
 * navigation, and a topic minted per load would put every chart in its own
 * session — so the panel launched from the previous chart would never hear
 * about the new one, which is exactly the event worth demonstrating. Per-tab
 * also keeps two people demonstrating at once on separate sessions.
 */
const TOPIC: string = (() => {
  const key = 'spier-mock-ehr:fhircast-topic'
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const minted = 'host-' + crypto.randomUUID()
    sessionStorage.setItem(key, minted)
    return minted
  } catch {
    // Storage denied — fall back to a per-load topic. The demo degrades to
    // "the panel does not follow", which is visible, rather than throwing.
    return 'host-' + crypto.randomUUID()
  }
})()

const dock = must<HTMLElement>('dock')
const frame = must<HTMLIFrameElement>('panel')
const dockContext = must('dock-context')
const dockSent = must('dock-sent')
const dockError = must('dock-error')

/*
 * The panel width, read from the operator's preference and never offered here.
 *
 * ⚠️ **The whitelist is the point, not the default.** localStorage is
 * attacker-writable in the sense that matters for a demo — anything on this
 * origin can put a string there — and this value goes into an inline style, so
 * an unvalidated read is how a preference becomes an injection. Only the three
 * measured widths are honored; anything else is the middle one.
 * chartPage.test.ts asserts the guard by its text, so keep its shape.
 */
const PANEL_WIDTHS = config.panelWidths
function storedWidth(): number {
  try {
    const raw = Number(localStorage.getItem(config.panelWidthKey))
    return PANEL_WIDTHS.indexOf(raw) === -1 ? config.defaultPanelWidth : raw
  } catch {
    // Storage denied. The middle width is the answer, which is also the answer
    // for every viewer who has never opened /settings.
    return config.defaultPanelWidth
  }
}
// ⚠️ Published as a CUSTOM PROPERTY, not as an inline width, and that is what
// lets the stacked layout exist: an inline style.width outranks any media
// query, so a narrow-screen rule could not take the dock full-width without
// !important. CSS decides the layout; this only supplies the number.
dock.style.setProperty('--panel-width', storedWidth() + 'px')

must('close-panel').addEventListener('click', () => {
  // about:blank rather than removing the node: a closed panel that keeps its
  // session alive would hide whether the next launch really re-authorizes.
  frame.src = 'about:blank'
  dock.hidden = true
})

interface LaunchResponse { launchUrl: string }

/**
 * Mint a launch context and point the iframe at it.
 *
 * needPatientBanner is always false here because this page draws a banner two
 * inches to the left. embed:true is what puts the app in panel chrome.
 */
function launch(intent: string | null, label: string): Promise<void> {
  dock.hidden = false
  dockContext.textContent = 'authorizing…'
  dockSent.textContent = 'Minting a launch…'
  dockError.hidden = true
  return fetch('/_admin/launch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      patient: PATIENT,
      intent: intent || undefined,
      needPatientBanner: false,
      embed: true,
      // ⚠️ THIS page's topic, not a fresh one. The panel joins the session the
      // host is already in, which is the whole point — a per-launch topic would
      // give each side its own session and nothing would cross, while looking
      // identical to working.
      topic: TOPIC,
    }),
  }).then((res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return res.json() as Promise<LaunchResponse>
  }).then((body) => {
    frame.src = body.launchUrl
    dockContext.textContent = label || 'pathway'
    const sentParts: Array<string | { code: string }> = ['Launch context sent: ', { code: 'patient=' + PATIENT }]
    if (intent) sentParts.push(' ', { code: 'intent=' + intent })
    sentParts.push(' ', { code: 'need_patient_banner=false' }, ' ', { code: 'hub.topic=' + TOPIC })
    renderInline(dockSent, sentParts)
  }).catch((err: unknown) => {
    dockContext.textContent = ''
    // In the dock itself, not only the drawer: a failure has to be visible
    // without opening anything.
    dockError.textContent = 'Could not mint a launch: ' + message(err)
    dockError.hidden = false
    dockSent.textContent = 'Could not mint a launch: ' + message(err)
  })
}

must('open-panel').addEventListener('click', () => { void launch(null, 'pathway') })

// ── FHIRcast: subscribe, then announce this chart ─────────────────────────────
//
// The subscription is the spec's: POST the hub with hub.channel.type=websocket
// and connect to the endpoint it hands back. Announcing patient-open on load is
// what a real EHR does when a chart is opened, and it is what the embedded
// panel reacts to.
const castStatus = must('cast-status')
const castForm = must<HTMLFormElement>('cast-form')
const castLog = must('cast-log')

function logCast(text: string, kind = 'info'): void {
  const li = document.createElement('li')
  li.className = 'card card--' + kind
  li.textContent = text
  castLog.insertBefore(li, castLog.firstChild)
}

interface HubMessage {
  'hub.mode'?: string
  'hub.topic'?: string
  id?: string
  event?: { 'hub.event'?: string; context?: Array<{ resource?: { id?: string } }> }
}

fetch('/fhircast', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    'hub.channel.type': 'websocket',
    'hub.mode': 'subscribe',
    'hub.topic': TOPIC,
    'hub.events': 'patient-open',
  }).toString(),
}).then((res) => {
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json() as Promise<{ 'hub.channel.endpoint'?: string }>
}).then((body) => {
  const endpoint = body['hub.channel.endpoint']
  if (!endpoint) throw new Error('the hub returned no channel endpoint')
  const socket = new WebSocket(endpoint)
  socket.addEventListener('open', () => {
    renderInline(castStatus, ['Subscribed on ', { code: TOPIC }, '. Announcing this chart…'])
    announce()
  })
  socket.addEventListener('message', (e: MessageEvent<string>) => {
    let parsed: HubMessage
    try { parsed = JSON.parse(e.data) as HubMessage } catch { return }
    if (parsed['hub.mode'] === 'subscribe') {
      logCast('Hub confirmed the subscription on topic ' + parsed['hub.topic'])
      return
    }
    const evt = parsed.event ?? {}
    // The ACK the spec asks of a subscriber.
    if (parsed.id) socket.send(JSON.stringify({ id: parsed.id, status: 'ok' }))
    const who = evt.context?.[0]?.resource?.id ?? '(unknown)'
    logCast(`${evt['hub.event']} → ${who}  (received on the hub)`)
  })
  socket.addEventListener('close', () => {
    castStatus.textContent = 'The hub connection closed.'
  })
}).catch((err: unknown) => {
  castStatus.textContent = 'Could not subscribe to the hub: ' + message(err)
})

castForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const form = e.currentTarget as HTMLFormElement
  const id = String(new FormData(form).get('patient') ?? '')
  const option = form.querySelector<HTMLOptionElement>(`option[value="${id}"]`)
  const label = option ? (option.textContent ?? '').split('·')[0]!.trim() : id
  const parts = label.split(' ')
  publish(id, parts[0] ?? '', parts.slice(1).join(' '), '')
})

/** Publish patient-open for THIS chart's patient. */
function announce(): void {
  postEvent({
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
    event: {
      'hub.topic': TOPIC,
      'hub.event': 'patient-open',
      context: [{
        key: 'patient',
        resource: {
          resourceType: 'Patient',
          id: PATIENT,
          identifier: [{ system: MRN_SYSTEM, value: MRN }],
          name: [{ given: [GIVEN], family: FAMILY }],
        },
      }],
    },
  }, PATIENT)
}

/** Publish patient-open for an arbitrary patient, on this page's topic. */
function publish(id: string, given: string, family: string, mrn: string): void {
  postEvent({
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
    event: {
      'hub.topic': TOPIC,
      'hub.event': 'patient-open',
      context: [{
        key: 'patient',
        resource: {
          resourceType: 'Patient',
          id,
          identifier: mrn ? [{ system: MRN_SYSTEM, value: mrn }] : undefined,
          name: [{ given: [given], family }],
        },
      }],
    },
  }, id)
}

function postEvent(event: Record<string, unknown>, who: string): void {
  fetch('/fhircast/' + encodeURIComponent(TOPIC), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  }).then(res => res.json() as Promise<{ delivered?: number }>).then((body) => {
    renderInline(castStatus, [
      'Announced ', { code: 'patient-open' }, ' for ' + who,
      ' on ', { code: TOPIC }, ` — delivered to ${body.delivered ?? 0} subscriber(s).`,
    ])
    logCast(`patient-open → ${who}  (published by this chart)`)
  }).catch((err: unknown) => {
    castStatus.textContent = 'Could not announce: ' + message(err)
  })
}

// ── The server's own account of what was written ──────────────────────────────
// Deliberately independent of the panel's scorecard: the ladder reporting on
// itself and the server reporting on the same event are two statements, and
// only two make it checkable.
interface WritesResponse { count: number; byType: Record<string, number> }
function refreshWrites(): Promise<void> {
  const out = must('writes-summary')
  return fetch('/_admin/writes')
    .then(res => (res.ok ? (res.json() as Promise<WritesResponse>) : null))
    .then((body) => {
      if (!body) { out.textContent = 'No DEMO_STORE binding — writes cannot be persisted.'; return }
      if (body.count === 0) { out.textContent = 'Nothing written yet.'; return }
      out.textContent = `${body.count} resource(s) written: `
        + Object.keys(body.byType).sort().map(t => `${body.byType[t]} ${t}`).join(', ')
    })
    .catch(() => { out.textContent = 'Could not read the write log.' })
}
void refreshWrites()
// The panel writes on submit, inside a cross-origin frame we cannot observe,
// so poll while it is open rather than pretending to know when it finished.
setInterval(() => { if (!dock.hidden) void refreshWrites() }, 4000)

// ── CDS Hooks patient-view ────────────────────────────────────────────────────
// No prefetch: see the header of chartPage.ts. hookInstance must be unique per
// call.
//
// Posted to this HOST, not to the service. The host signs a JWT with the key it
// publishes at /.well-known/jwks.json and invokes the service itself, which is
// both what CDS Hooks describes (the EHR calls the service) and the only way
// the call can be signed at all — a browser that could sign would be a browser
// holding the host's private key.
interface CdsLink { type?: string; label: string; url?: string; appContext?: string }
interface CdsCard { summary?: string; detail?: string; indicator?: string; source?: { label?: string }; links?: CdsLink[] }

fetch('/_admin/cds', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    hook: 'patient-view',
    hookInstance: crypto.randomUUID(),
    fhirServer: window.location.origin + '/fhir',
    context: { patientId: PATIENT },
  }),
}).then((res) => {
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json() as Promise<{ cards?: CdsCard[] }>
}).then((body) => {
  renderCards(body.cards ?? [])
}).catch((err: unknown) => {
  // Names the SERVICE, not this host: the reader wants to know which endpoint
  // did not answer. A 401 here means this host's signed identity was refused,
  // which the status code is what distinguishes.
  must('cds-status').textContent =
    `The CDS service at ${CDS_ENDPOINT} could not be reached (${message(err)}).`
})

function renderCards(cards: CdsCard[]): void {
  const status = must('cds-status')
  const list = must('cds-cards')
  if (cards.length === 0) {
    status.textContent = 'The CDS service returned no cards for this patient.'
    return
  }
  status.textContent = cards.length + (cards.length === 1 ? ' card' : ' cards') + ' returned.'
  for (const card of cards) {
    const li = document.createElement('li')
    li.className = 'card card--' + (card.indicator || 'info')

    const summary = document.createElement('p')
    summary.className = 'card__title'
    summary.textContent = card.summary || ''
    li.appendChild(summary)

    if (card.detail) {
      const detail = document.createElement('p')
      detail.className = 'card__body'
      // Rendered as text, not markdown: the spec allows GFM in the detail field
      // and a markdown renderer is not worth shipping to prove a launch works.
      detail.textContent = card.detail
      li.appendChild(detail)
    }

    const source = document.createElement('p')
    source.className = 'card__meta'
    source.textContent = 'Source: ' + (card.source?.label || 'unknown')
    li.appendChild(source)

    const links = card.links ?? []
    if (links.length > 0) {
      const row = document.createElement('div')
      row.className = 'card__actions'
      for (const link of links) {
        if (link.type === 'smart') {
          // The host mints the launch — the card supplies the app's launch URL
          // and its appContext, never OAuth parameters.
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'btn btn--smart'
          btn.textContent = link.label
          btn.addEventListener('click', () => { void launch(intentOf(link), link.label) })
          row.appendChild(btn)
        } else {
          // type: "absolute" — a plain deep link. Opened in a new tab rather
          // than the panel: it is not a SMART launch and carries no context.
          const a = document.createElement('a')
          a.href = link.url ?? '#'
          a.target = '_blank'
          a.rel = 'noopener'
          a.textContent = link.label + ' ↗'
          row.appendChild(a)
        }
      }
      li.appendChild(row)
    }
    list.appendChild(li)
  }
}

/** appContext is a JSON string per the CDS Hooks spec; tolerate anything else. */
function intentOf(link: CdsLink): string | null {
  if (!link.appContext) return null
  try {
    const parsed = JSON.parse(link.appContext) as { intent?: unknown }
    return typeof parsed.intent === 'string' ? parsed.intent : null
  } catch {
    return null
  }
}
