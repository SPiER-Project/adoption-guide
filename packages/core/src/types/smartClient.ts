/**
 * The slice of an authorized SMART client this codebase actually uses.
 *
 * ⚠️ **Declared here rather than imported from `fhirclient`, and that is a
 * correctness decision rather than a boundary preference.** fhirclient 3.0.0's
 * published tarball is missing `types/types.d.ts`: every one of its shipped
 * declarations opens with `import { fhirclient } from "./types"`, and that file
 * is not in the package. `skipLibCheck: true` swallows the resulting TS2307, so
 * nothing goes red — the types simply degrade. Measured on the real tree at the
 * upgrade: `client.state` became `any`, `client.request`'s parameters became
 * `any`, and the type-aware lint probe went from 34 unsafe flows in production
 * code to 43, all nine of the new ones in the SMART read/write path. A
 * dependency that silently turns the FHIR writer's arguments into `any` is the
 * exact failure `packages/core` exists to make impossible.
 *
 * ⚠️ **This is not a re-declaration of fhirclient's `Client`, and must not grow
 * into one.** It names five members, because five is what the app touches:
 * `request`, `patient.id`, `patient.read`, `state.serverUrl` and
 * `state.tokenResponse`. It is *structural* — `FHIR.oauth2.ready()` returns
 * fhirclient's own `Client`, and TypeScript checks it against this shape at the
 * one place the two meet (`SmartProvider` / `SmartRedirect`). So an upstream
 * signature change still fails a build here; it just fails at the seam rather
 * than spreading `any` through everything downstream.
 *
 * ⚠️ **It is also STRICTER than what fhirclient 2 gave us**, which is why this
 * is not merely damage control. v2 typed `request`'s options through its own
 * `fhirclient.RequestOptions`/`FhirOptions`; the two call shapes below say what
 * this codebase sends, so a typo'd `pageLimit` or a missing `method` is an
 * error here and was not before.
 *
 * Revisit if upstream publishes a fix (3.0.0 is the newest release as of
 * 2026-09-20) — but note that adopting it back would be a *loosening*, so the
 * reason to would have to be more than "the import works again".
 */
import type { PatientResource } from './fhir'

/** Search options — the only `fhirOptions` shape the data source passes. */
export interface SmartSearchOptions {
  /** 0 means "follow every page". */
  pageLimit?: number
  /** Yield the entry resources rather than the Bundle. */
  flat?: boolean
}

/** A write — the only `RequestOptions` object shape the data source passes. */
export interface SmartWriteOptions {
  url: string
  method: 'POST' | 'PUT'
  body: string
  headers?: Record<string, string>
  /** Ask for `{ body, response }` back instead of the parsed body alone. */
  includeResponse?: boolean
}

/**
 * The authorized client. Structurally satisfied by fhirclient's `Client`.
 *
 * ⚠️ `state` is deliberately NOT `Record<string, unknown>`: `tokenResponse`
 * carries the SMART launch context (`intent`, the worklist flags) that
 * `SmartRedirect` reads, and typing it as `unknown` is what forces those reads
 * through an explicit narrowing rather than a member access on `any`.
 */
export interface SmartClient {
  /** A relative search path, with optional pagination/flattening. */
  request<T = unknown>(url: string, fhirOptions?: SmartSearchOptions): Promise<T>
  /** A write, described by an options object. */
  request<T = unknown>(options: SmartWriteOptions): Promise<T>

  readonly patient: {
    /** null when the launch carried no patient context (a worklist launch). */
    id: string | null
    read(): Promise<PatientResource>
  }

  readonly state: {
    /** FHIR base URL of the server this client is authorized against. */
    serverUrl: string
    /** The raw token response — SMART puts launch context here. */
    tokenResponse?: Record<string, unknown>
  }
}
