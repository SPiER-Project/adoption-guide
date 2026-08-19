/**
 * tokens — the signed, self-contained artifacts the SMART stub hands out:
 * launch contexts, authorization codes and access tokens.
 *
 * ── Why signed blobs rather than a server-side table ────────────────────────
 * A Worker has no shared memory. Two requests seconds apart — `/authorize` then
 * `POST /token` — can land in different isolates, and a table in module memory
 * would then have no record of the code it issued. The login fails, in front of
 * an audience, intermittently. Making every artifact carry its own state and
 * proving it with an HMAC removes that failure mode entirely, and needs no KV
 * binding or Durable Object to exist first.
 *
 * ⚠️ **The cost is replay, and it is real.** Single use cannot be enforced
 * without somewhere to write "used". An authorization code is therefore
 * replayable inside its 60-second window by whoever holds it — mitigated to
 * best-effort by an in-memory used-set (below), which catches the same-isolate
 * case and silently misses the rest. That is an acceptable trade for synthetic
 * data on a demo host and would NOT be acceptable anywhere else; step 4 needs a
 * Durable Object for writes regardless, and this should move behind it then.
 *
 * ⚠️ **`MOCK_SIGNING_SECRET` is not a security control.** It stops a stray
 * request from forging a launch context, nothing more — this server holds only
 * synthetic patients and grants access to a mock. Do not reason about it as if
 * it protected anything.
 */

const encoder = new TextEncoder()

/** Default when no secret is configured. Deliberately obvious in a log. */
const DEV_SECRET = 'spier-mock-ehr-demo-signing-secret-not-a-security-control'

export function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, ch => ch.charCodeAt(0))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** `base64url(payload).base64url(hmac)` — a bearer artifact that proves itself. */
export async function sign(payload: object, secret = DEV_SECRET): Promise<string> {
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)))
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body))
  return `${body}.${base64urlEncode(new Uint8Array(mac))}`
}

/**
 * Verify and decode. Returns `null` on ANY failure — bad shape, bad signature,
 * expired — rather than distinguishing them, so a caller cannot accidentally
 * treat "expired" as "close enough".
 */
export async function verify<T extends { exp?: number }>(
  token: string,
  secret = DEV_SECRET,
  now = Date.now(),
): Promise<T | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, mac] = parts
  let valid: boolean
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64urlDecode(mac) as unknown as ArrayBufferView<ArrayBuffer>,
      encoder.encode(body),
    )
  } catch {
    return null
  }
  if (!valid) return null
  let payload: T
  try {
    payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as T
  } catch {
    return null
  }
  if (typeof payload?.exp === 'number' && payload.exp * 1000 <= now) return null
  return payload
}

/** PKCE S256: `base64url(SHA-256(verifier))`, per RFC 7636 §4.6. */
export async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier))
  return base64urlEncode(new Uint8Array(digest))
}

/**
 * Best-effort single use for authorization codes. Per-isolate, so it catches
 * the common case and misses a cross-isolate replay — see the header. Never
 * treat a `false` from this as proof the code is fresh.
 */
const spentCodes = new Set<string>()

export function spend(code: string): boolean {
  if (spentCodes.has(code)) return false
  spentCodes.add(code)
  // Unbounded growth is not a concern for a demo isolate's lifetime, but a
  // trivial cap keeps a long-lived one from leaking.
  if (spentCodes.size > 1000) spentCodes.clear()
  return true
}

/** Test seam — forget spent codes between cases. */
export function resetSpentCodes(): void {
  spentCodes.clear()
}
