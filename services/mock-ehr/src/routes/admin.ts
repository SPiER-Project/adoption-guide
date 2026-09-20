/**
 * The operator surface under `/_admin`: the capability profile, minting a
 * launch, the write log and the reset. `/_admin/fhircast` and `/_admin/cds`
 * live with the subsystems they belong to (routes/fhircast.ts, routes/cds.ts).
 */
import { Hono } from 'hono'
import {
  CAPABILITY_PROFILES,
  PROFILE_DESCRIPTIONS,
  creatableTypes,
  isCapabilityProfile,
} from '../capability'
import { RESOURCES_BY_KEY } from '../fixtures'
import { storeFor } from '../store'
import { mintLaunch } from '../smart'
import { envOf, panelBaseFor, type AppEnv } from '../env'
import { liveProfile, setProfile } from '../profile'

export const adminRoutes = new Hono<AppEnv>()

// ── Control surface ──────────────────────────────────────────────────────────

adminRoutes.get('/_admin/capabilities', async (c) => {
  const profile = await liveProfile(c)
  return c.json({
    profile,
    description: PROFILE_DESCRIPTIONS[profile],
    creates: creatableTypes(profile),
    available: CAPABILITY_PROFILES.map(p => ({ profile: p, description: PROFILE_DESCRIPTIONS[p] })),
    durable: storeFor(envOf(c)) !== null,
  })
})

adminRoutes.put('/_admin/capabilities', async (c) => {
  const body = await c.req.json<{ profile?: unknown }>().catch(() => ({ profile: undefined }))
  if (!isCapabilityProfile(body?.profile)) {
    return c.json(
      { error: `profile must be one of: ${CAPABILITY_PROFILES.join(', ')}` },
      400,
    )
  }
  // Both layers: the durable one is what other isolates will read, the module
  // one keeps this isolate consistent without a round trip.
  setProfile(body.profile)
  const store = storeFor(envOf(c))
  await store?.setProfile(body.profile)
  return c.json({
    profile: body.profile,
    creates: creatableTypes(body.profile),
    durable: store !== null,
  })
})

/**
 * Mint a launch context and the URL an EHR would open.
 *
 * The engine behind both launch surfaces: the chart page's activity button and
 * CDS cards (`/chart/{id}`), and the control page's top-level launch. It stayed
 * an `_admin` endpoint after step 5 added the chart because the chart is a
 * *caller*, not the mechanism — which is also what lets the two surfaces differ
 * only in what they put in the body (`embed`, `intent`, `needPatientBanner`).
 */
adminRoutes.post('/_admin/launch', async (c) => {
  type LaunchBody = {
    patient?: unknown
    userScoped?: unknown
    intent?: unknown
    needPatientBanner?: unknown
    embed?: unknown
    topic?: unknown
  }
  const body = await c.req.json<LaunchBody>().catch(() => ({} as LaunchBody))
  const patient = typeof body.patient === 'string' ? body.patient : ''
  // ⚠️ `userScoped: true` is the worklist launch (#401) — a launch context with
  // no patient, which authorizes reads across every patient on this server. It
  // is an explicit flag rather than "no patient supplied" at THIS layer too: a
  // caller that forgot to send `patient` would otherwise be handed a
  // cross-patient launch, and would have no way to tell.
  const userScoped = body.userScoped === true
  if (userScoped && patient) {
    return c.json(
      { error: 'Pass either `patient` (chart launch) or `userScoped: true` (worklist launch), not both.' },
      400,
    )
  }
  if (!userScoped && !RESOURCES_BY_KEY.has(`Patient/${patient}`)) {
    return c.json({ error: `Unknown patient '${patient}'.` }, 400)
  }
  // ⚠️ A FHIRcast topic per launch, minted here unless the caller supplies one.
  // The caller supplying one is the interesting case: the chart page reuses ONE
  // topic across every launch it makes, so the host and the panel share a session
  // (step 6). A fresh topic per launch would give each of them its own session and
  // nothing would cross — which looks identical to working until you check.
  const topic = typeof body.topic === 'string' && body.topic
    ? body.topic
    : `spier-${crypto.randomUUID()}`
  const launch = await mintLaunch({
    ...(userScoped ? { userScoped: true as const } : { patient }),
    intent: typeof body.intent === 'string' && body.intent ? body.intent : undefined,
    needPatientBanner: typeof body.needPatientBanner === 'boolean' ? body.needPatientBanner : undefined,
    topic,
  }, envOf(c))

  const origin = new URL(c.req.url).origin
  const panelBase = panelBaseFor(envOf(c))
  // SMART EHR launch: the EHR opens the app's launch_uri with `iss` + `launch`.
  // The app's launch screen is under its hash router, and main.tsx routes the
  // real query string into it.
  //
  // ⚠️ `embed=1` is the panel-chrome flag, and it belongs in the QUERY, before
  // the `#`. The app reads it from `location.search` on purpose (see
  // PresentationProvider) — appending it after the fragment would make it part
  // of the route and it would be silently ignored.
  const url = new URL(panelBase)
  url.searchParams.set('iss', `${origin}/fhir`)
  url.searchParams.set('launch', launch)
  if (body.embed === true) url.searchParams.set('embed', '1')
  url.hash = '#/launch'
  return c.json({
    launch,
    launchUrl: url.toString(),
    // Echoed as it was asked for: a worklist launch reports no patient rather
    // than an empty string, matching what /token will do with the same context.
    ...(userScoped ? { userScoped: true } : { patient }),
    topic,
  })
})

/**
 * What has been written. Powers the "written so far" readout and, more
 * importantly, makes the writeback demo checkable: the ladder's scorecard is
 * SPiER reporting on itself, and this is the server's own account of the same
 * event. Two independent statements of what happened is the difference between a
 * demo and an assertion.
 */
adminRoutes.get('/_admin/writes', async (c) => {
  const store = storeFor(envOf(c))
  if (!store) return c.json({ error: 'No DEMO_STORE binding — this deployment cannot persist writes.' }, 503)
  const writes = await store.list()
  return c.json({
    count: writes.length,
    byType: writes.reduce<Record<string, number>>((acc, w) => {
      const type = String(w.resource.resourceType)
      acc[type] = (acc[type] ?? 0) + 1
      return acc
    }, {}),
    writes: writes.map(w => ({
      patient: w.patientId,
      resourceType: w.resource.resourceType,
      id: w.resource.id,
    })),
  })
})

/**
 * Reset the demo. The plan asks for this explicitly — "this demo will be run
 * many times, and one that cannot be reset in a click goes stale
 * mid-presentation".
 *
 * Discards writes only. The capability profile survives on purpose: "reset the
 * data" and "put the server back to full capability" are different intentions,
 * and a reset that silently re-armed the ladder would undo the degradation the
 * presenter just set up.
 */
adminRoutes.post('/_admin/reset', async (c) => {
  const store = storeFor(envOf(c))
  if (!store) return c.json({ error: 'No DEMO_STORE binding — nothing to reset.' }, 503)
  const discarded = await store.reset()
  return c.json({ discarded, profileUnchanged: await liveProfile(c) })
})

