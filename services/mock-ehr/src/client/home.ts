/**
 * The front door's behaviour: the framed caseload launch, and the two top-level
 * worklist launches.
 *
 * ⚠️ **The launch URL is minted here rather than baked into the HTML**, the same
 * reason the chart's dock starts at about:blank. A launch context in
 * server-rendered markup is a context minted at cache time, handed to whoever
 * loads the page next. `chartPage.test.ts` pins that the markup names no
 * destination; the module is where the request is made.
 *
 * ⚠️ **`embed: true` is what makes it a panel rather than a whole app in a box.**
 * It puts `?embed=1` on the launch URL, before the fragment, which is where the
 * app reads it — and the app's SmartRedirect then lands an EMBEDDED worklist
 * launch on the caseload SUMMARY rather than the full caseload. That is
 * deliberate: a sortable patient list framed above this page's own patient
 * table is two lists on one page, and the row clicks in the frame navigate
 * inside the frame rather than opening a chart here.
 *
 * ⚠️ **No `topic`.** The chart reuses one FHIRcast topic across every launch it
 * makes so the host and the panel share a session. This page has no chart to
 * stay in step with, so it lets the server mint a fresh one.
 */

interface LaunchResponse {
  launchUrl?: string
  error?: string
}

async function mintLaunch(body: Record<string, unknown>): Promise<string> {
  const res = await fetch('/_admin/launch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const parsed = (await res.json()) as LaunchResponse
  if (!res.ok || !parsed.launchUrl) throw new Error(parsed.error || 'launch failed')
  return parsed.launchUrl
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

// The framed activity: mint a user-scoped launch and point the iframe at it.
void (async () => {
  const frame = document.getElementById('activity') as HTMLIFrameElement | null
  const status = document.getElementById('activity-status')
  if (!frame) return
  try {
    frame.src = await mintLaunch({ userScoped: true, embed: true })
    if (status) status.textContent = 'Launched'
  } catch (error) {
    // The frame stays at about:blank rather than showing a broken page. The bar
    // says so, because an empty bordered box with no explanation reads as a
    // layout bug rather than a failed handshake.
    if (status) status.textContent = 'Could not launch: ' + message(error)
  }
})()

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-launch-worklist]')) {
  const original = button.textContent
  // ⚠️ The intent rides in the launch CONTEXT, not in the URL the app is sent
  // to. That is what makes it a SMART launch parameter rather than our own
  // convention: the host mints it, /token returns it, and the app resolves it
  // through the tool catalog. A worklist launch can name a tool just as a chart
  // launch can — SmartRedirect had to be taught that; it opened the caseload
  // regardless until 2026-09-09.
  const intent = button.getAttribute('data-intent') || undefined
  button.addEventListener('click', async () => {
    button.disabled = true
    button.textContent = 'Authorizing…'
    try {
      window.location.href = await mintLaunch(intent ? { userScoped: true, intent } : { userScoped: true })
    } catch (error) {
      button.disabled = false
      button.textContent = original
      alert('Could not start the launch: ' + message(error))
    }
  })
}
