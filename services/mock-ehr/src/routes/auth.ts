/**
 * SMART authorization: `/authorize` and `/token`. The logic is smart.ts's;
 * these are its two HTTP doors. `/token` carries the FHIR API's CORS policy
 * because the panel POSTs to it directly as a public client.
 */
import { Hono } from 'hono'
import { authorize, token } from '../smart'
import { envOf, type AppEnv } from '../env'
import { apiCors } from './fhir'

export const authRoutes = new Hono<AppEnv>()
authRoutes.use('/token', apiCors)

// ── SMART authorization ──────────────────────────────────────────────────────

authRoutes.get('/authorize', async (c) => {
  const result = await authorize(new URL(c.req.url).searchParams, envOf(c), `${new URL(c.req.url).origin}/fhir`)
  if (result.kind === 'redirect') return c.redirect(result.location, 302)
  // Refusals are rendered rather than redirected — see AuthorizeResult.
  return c.json({ error: result.error, error_description: result.description }, result.status)
})

authRoutes.post('/token', async (c) => {
  const form = new URLSearchParams(await c.req.text())
  const result = await token(form, envOf(c), new URL(c.req.url).origin)
  // OAuth 2 requires token responses to be uncacheable.
  c.header('cache-control', 'no-store')
  c.header('pragma', 'no-cache')
  if (!result.ok) {
    return c.json({ error: result.error, error_description: result.description }, result.status as 400)
  }
  return c.json(result.body)
})

