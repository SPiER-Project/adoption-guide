/**
 * cdsClient — this host's identity as a **CDS Client**, and the signed JWT it
 * presents when it calls a CDS Hooks service.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * CDS Hooks 2.0 says a CDS Client SHALL send `Authorization: Bearer <JWT>` on
 * every service call, signed with its own key, and that the service SHOULD
 * verify it. `services/cds` has implemented the verifying half since #147 — and
 * ran in `warn` mode, which logs a failure and proceeds, because nothing in
 * this demo could produce a token. An enforcement mode that never rejects is
 * not authentication; it is a log line. So the missing half is here: the host
 * becomes a client that can actually sign, and the service flips to `require`.
 *
 * ⚠️ **This is asymmetric, unlike `tokens.ts`.** That module HMACs the SMART
 * artifacts this server issues *to itself*, where one secret on both ends is
 * the right shape. Here a *different* service has to verify, and handing it a
 * shared secret would make every verifier able to forge. ES384 (P-384 + SHA-384)
 * is one of the two algorithms the CDS Hooks spec names; the public half is
 * published as a JWK Set and the private half never leaves this Worker.
 *
 * ⚠️ **No `jose` dependency, deliberately.** A compact JWS is two base64url
 * segments, a signature, and a dot — `tokens.ts` already has the base64url
 * helpers, and WebCrypto's ECDSA output is *already* the raw `r || s` pair JOSE
 * specifies (unlike Node's `crypto`, which emits DER and would need
 * re-encoding). Adding a library to concatenate three strings would put a
 * dependency in a Worker whose whole point is to be a small honest fake.
 *
 * ── Where the key lives, and why it is not in the repo ──────────────────────
 *
 * Generated on first use and persisted in the `DemoStore` Durable Object, for
 * exactly the reason the profile lives there (`store.ts`): a Worker runs many
 * isolates, and a per-isolate keypair would mean the isolate serving
 * `/.well-known/jwks.json` publishing a key that the isolate signing the token
 * does not hold. The verifier would then reject a token this host had just
 * legitimately minted, intermittently, and every local `wrangler dev` test
 * would pass because that is one isolate.
 *
 * ⚠️ **A checked-in demo keypair was the obvious alternative and is worse than
 * it looks.** Not because this key protects anything — it guards synthetic
 * patients on a demo host, same as `MOCK_SIGNING_SECRET` — but because a
 * private key in a public repo is indistinguishable, to every scanner and every
 * reader, from one that does. This repo is the reference an adopter copies.
 */
import { base64urlEncode } from './tokens'
import type { DemoState } from './store'

const encoder = new TextEncoder()

/** P-384 + SHA-384 — one of the two algorithms CDS Hooks 2.0 names. */
const ALG = 'ES384'
const KEY_PARAMS = { name: 'ECDSA', namedCurve: 'P-384' } as const
const SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-384' } as const

/**
 * ⚠️ **`@cloudflare/workers-types` types these two calls as UNIONS**, because
 * one WebCrypto method covers both symmetric keys and keypairs, and one covers
 * both raw and JWK export. The narrowing below is a runtime CHECK rather than a
 * cast: an `as` here would compile identically against an algorithm that
 * returns the other arm, and the failure would then be a `TypeError` on
 * `undefined` somewhere downstream instead of a sentence naming this line.
 */
function asKeyPair(result: CryptoKey | CryptoKeyPair): CryptoKeyPair {
  if (!('privateKey' in result)) {
    throw new Error('generateKey returned a single key; ECDSA must yield a pair')
  }
  return result
}

function asJwk(exported: ArrayBuffer | JsonWebKey): JsonWebKey {
  if (exported instanceof ArrayBuffer) {
    throw new Error("exportKey returned raw bytes; 'jwk' must yield a JsonWebKey")
  }
  return exported
}

/** Lifetime of a minted token. CDS Hooks recommends 5 minutes or less. */
export const TOKEN_TTL_SECONDS = 300

/** The path this host publishes its JWK Set at. */
export const JWKS_PATH = '/.well-known/jwks.json'

/** Default `sub` — the client id a CDS service would know this host by. */
export const DEFAULT_CDS_CLIENT_ID = 'spier-mock-ehr'

/**
 * A stored keypair. Both halves are JWKs because that is what survives a
 * Durable Object round trip — a `CryptoKey` is not structured-cloneable.
 */
export interface CdsSigningKey {
  kid: string
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
}

/** Generate a fresh ES384 keypair. Exported for the store's create path. */
export async function generateSigningKey(): Promise<CdsSigningKey> {
  const pair = asKeyPair(await crypto.subtle.generateKey(KEY_PARAMS, true, ['sign', 'verify']))
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.publicKey).then(asJwk),
    crypto.subtle.exportKey('jwk', pair.privateKey).then(asJwk),
  ])
  return { kid: crypto.randomUUID(), publicJwk, privateJwk }
}

/**
 * This host's signing key, minting one on first use.
 *
 * ⚠️ **The keypair is generated here and handed to the store, rather than the
 * store generating it, because a Durable Object method takes data and not a
 * callback.** Two isolates racing therefore both generate; `putCdsKeyIfAbsent`
 * serializes inside the DO and returns whichever one won, so both callers end
 * up with the same key and the loser's is discarded. One wasted keygen on a
 * cold start is the whole cost.
 */
export async function signingKeyFor(store: DemoState): Promise<CdsSigningKey> {
  const existing = await store.getCdsKey()
  if (existing) return existing
  return store.putCdsKeyIfAbsent(await generateSigningKey())
}

/**
 * One entry in the published JWK Set.
 *
 * ⚠️ **Declared rather than reusing `JsonWebKey`, and the reason is `d`.** The
 * private scalar rides on that type, so a `JsonWebKey`-typed return would let a
 * future edit publish the private half and still typecheck — the one mistake in
 * this file that cannot be walked back once a deploy has served it. This shape
 * has no `d` to set. (workers-types' `JsonWebKey` also has no `kid`, which a
 * JWK Set needs; `JsonWebKeyWithKid` exists but still carries `d`.)
 */
export interface PublishedJwk {
  kty: string
  crv?: string
  x?: string
  y?: string
  kid: string
  use: 'sig'
  alg: typeof ALG
}

/** The public JWK Set, as served at {@link JWKS_PATH}. */
export function publicJwks(key: CdsSigningKey): { keys: PublishedJwk[] } {
  const { kty, crv, x, y } = key.publicJwk
  return { keys: [{ kty, crv, x, y, kid: key.kid, use: 'sig', alg: ALG }] }
}

/** Registered claims a CDS Hooks client JWT carries. */
export interface CdsTokenClaims {
  /** This host's issuer URI — its own origin. */
  iss: string
  /** The client id the CDS service knows this host by. */
  sub: string
  /** The service's invoke URL. Must match the service's `CDS_JWT_AUDIENCE`. */
  aud: string
  /** Where the verifier can fetch this host's JWK Set. */
  jku: string
}

/**
 * Mint a compact JWS bearing {@link CdsTokenClaims}.
 *
 * ⚠️ **`jti` is a real random id and `exp` is short, because the verifier's
 * replay guard is best-effort.** `services/cds/src/auth.ts` keeps seen `jti`s
 * in isolate memory, so it catches a replay that lands on the same isolate and
 * silently misses the rest — a five-minute `exp` is what bounds the window that
 * miss leaves open.
 */
export async function mintCdsToken(
  key: CdsSigningKey,
  claims: CdsTokenClaims,
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000)
  const header = { alg: ALG, typ: 'JWT', kid: key.kid, jku: claims.jku }
  const payload = {
    iss: claims.iss,
    sub: claims.sub,
    aud: claims.aud,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS,
    jti: crypto.randomUUID(),
  }

  const signingInput = `${jsonSegment(header)}.${jsonSegment(payload)}`
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    key.privateJwk,
    KEY_PARAMS,
    false,
    ['sign'],
  )
  // ⚠️ WebCrypto returns the raw `r || s` pair, which is exactly the JWS
  // signature encoding (RFC 7515 §A.3). Node's `crypto` returns DER here and
  // would need unwrapping; this runs on WebCrypto in both the Worker and the
  // test env, so there is one code path.
  const signature = await crypto.subtle.sign(SIGN_PARAMS, privateKey, encoder.encode(signingInput))
  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`
}

function jsonSegment(value: object): string {
  return base64urlEncode(encoder.encode(JSON.stringify(value)))
}
