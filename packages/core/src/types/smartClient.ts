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
 * ⚠️ **Upstream fixed the missing file in 3.0.2, and the repo is still on
 * 3.0.0** (tried 2026-11-24; package.json's "//pins" has the reason, which is
 * in the mock EHR and not here). Trying it was still worth something: with
 * fhirclient's types resolving, the structural check at the seam was real for
 * the first time, and it caught one member this file had wrong — see
 * `patient.read` below. If 3.0.2 is taken later, this declaration stays:
 * importing fhirclient's `Client` instead would be a *loosening*, for the
 * reason above.
 */
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
    /**
     * ⚠️ `unknown`, not `PatientResource`, since 2026-11-24. This is a response
     * body off the wire, and fhirclient's own return type promises only
     * `{ resourceType: "Patient" }` with a `meta` this codebase's `Meta` does
     * not accept. While fhirclient 3.0.0's types are missing that mismatch is
     * invisible; under 3.0.2, which restores them, the seam did not compile. The one
     * caller (`readSmartPatientSummary`) checks what came back before reading it.
     */
    read(): Promise<unknown>
  }

  readonly state: {
    /** FHIR base URL of the server this client is authorized against. */
    serverUrl: string
    /** The raw token response — SMART puts launch context here. */
    tokenResponse?: Record<string, unknown>
  }
}
