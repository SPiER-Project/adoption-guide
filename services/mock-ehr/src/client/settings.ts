/**
 * The operator's bench: a top-level launch, the panel-width preference, the
 * capability profile switch, and the write log with its reset.
 */
import { must, readConfig } from './config'
import type { SettingsClientConfig } from './types'

const config = readConfig<SettingsClientConfig>()

interface LaunchResponse { launchUrl?: string; patient?: string; error?: string }
interface WritesResponse { count: number; byType: Record<string, number> }

// ── Launch the panel top-level ───────────────────────────────────────────────
must<HTMLFormElement>('launch-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const data = new FormData(e.currentTarget as HTMLFormElement)
  const res = await fetch('/_admin/launch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      patient: data.get('patient'),
      intent: data.get('intent') || undefined,
      // Checked means the host draws the banner, i.e. need_patient_banner:false.
      needPatientBanner: data.get('needPatientBanner') ? false : undefined,
    }),
  })
  const out = must('launch-result')
  out.hidden = false
  if (!res.ok) { out.textContent = 'Could not mint a launch: HTTP ' + res.status; return }
  const body = (await res.json()) as LaunchResponse
  const a = document.createElement('a')
  a.href = body.launchUrl ?? '#'
  a.target = '_blank'
  a.rel = 'noopener'
  a.textContent = 'Launch the panel for ' + (body.patient ?? '') + ' →'
  out.replaceChildren(a)
})

// ── The write log and its reset ──────────────────────────────────────────────
function refreshWrites(): Promise<void> {
  const out = must('writes-summary')
  return fetch('/_admin/writes')
    .then(res => (res.ok ? (res.json() as Promise<WritesResponse>) : null))
    .then((body) => {
      if (!body) { out.textContent = 'No DEMO_STORE binding — this deployment cannot persist writes.'; return }
      if (body.count === 0) { out.textContent = 'Nothing written yet.'; return }
      const byType = Object.keys(body.byType).sort().map(t => `${body.byType[t]} ${t}`).join(', ')
      out.textContent = `${body.count} resource(s) written: ${byType}`
    })
    .catch(() => { out.textContent = 'Could not read the write log.' })
}
void refreshWrites()

must('reset-writes').addEventListener('click', () => {
  void fetch('/_admin/reset', { method: 'POST' }).then((res) => {
    if (!res.ok) { alert('Could not reset: HTTP ' + res.status); return }
    return refreshWrites()
  })
})

// ── Panel width: a per-browser preference the chart page reads ───────────────
const WIDTH_KEY = config.panelWidthKey
const WIDTHS = config.panelWidths
const widthButtons = document.querySelectorAll<HTMLButtonElement>('button[data-width]')

function markWidth(px: number): void {
  for (const b of widthButtons) b.setAttribute('aria-pressed', String(Number(b.dataset.width) === px))
}
function readWidth(): number {
  try {
    const raw = Number(localStorage.getItem(WIDTH_KEY))
    return WIDTHS.indexOf(raw) === -1 ? config.defaultPanelWidth : raw
  } catch {
    return config.defaultPanelWidth
  }
}
markWidth(readWidth())
for (const btn of widthButtons) {
  btn.addEventListener('click', () => {
    const px = Number(btn.dataset.width)
    try {
      localStorage.setItem(WIDTH_KEY, String(px))
    } catch {
      alert(`This browser refused to store the preference; the chart will use ${config.defaultPanelWidth}px.`)
      return
    }
    markWidth(px)
  })
}

// ── Capability profile ───────────────────────────────────────────────────────
const profileButtons = document.querySelectorAll<HTMLButtonElement>('button[data-profile]')
for (const btn of profileButtons) {
  btn.addEventListener('click', async () => {
    const res = await fetch('/_admin/capabilities', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: btn.dataset.profile }),
    })
    if (!res.ok) { alert('Could not switch profile: HTTP ' + res.status); return }
    for (const b of profileButtons) b.setAttribute('aria-pressed', String(b === btn))
  })
}
