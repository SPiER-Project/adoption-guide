/**
 * The three client modules the host pages load, as the Worker serves them.
 *
 * ⚠️ **Why these are built files and not template literals.** Until 2026-09-20
 * each page's behaviour was a JavaScript string inside its `.ts` page builder —
 * `chartScript()` alone was 408 lines — and a string is opaque to every tool
 * this repo trusts: `tsc` did not type it, eslint did not read it, no test could
 * import a function out of it, and `check-worker-csp` and `check-host-css`
 * could only pattern-match its text. The `innerHTML` concatenation that B11
 * of the 2026-09-20 audit replaced had lived inside one of them precisely
 * because nothing could see it. `src/client/*.ts` is the same code as real
 * modules: compiled by `vite.client.config.ts` into `src/client/dist/`
 * (gitignored — `npm run build:client`, which `build` and `pretest` both run),
 * type-checked against the DOM by `src/client/tsconfig.json`, linted by the
 * service's eslint, and served from here.
 *
 * A page names its inputs in a `<script type="application/json">` block rather
 * than interpolating them into code (see `page()` in hostChrome.ts), which is
 * what let the code stop being a string at all.
 *
 * ⚠️ `import.meta.glob`, not three imports: Rollup emits a shared chunk for any
 * module two entries both import (`config.ts`, here), named by content hash and
 * referenced from the entries by relative `import`. Globbing the whole `dist/`
 * serves whatever Rollup emitted, so a shared chunk is served under the same
 * route the entries are rather than being a file nobody thought to mount.
 * Relative path on purpose — Vite does not resolve aliases inside a glob.
 */
const BUILT = import.meta.glob('./client/dist/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** `chart.js` → its source, for every file the client build emitted. */
const byFile: Map<string, { text: string; version: string }> = new Map(
  Object.entries(BUILT).map(([path, text]) => {
    const file = path.slice(path.lastIndexOf('/') + 1)
    return [file, { text, version: fnv1a(text) }]
  }),
)

/** The pages that have a module. Named here so a typo is a compile error, not a 404. */
export type ClientScript = 'home' | 'chart' | 'settings'

/**
 * The URL a page puts in its `<script type="module" src>`. `?v=` is the content
 * hash, so a rebuilt module is a new URL and the year-long cache on the route
 * can never serve a stale one.
 */
export function clientScriptUrl(name: ClientScript): string {
  const built = byFile.get(`${name}.js`)
  if (!built) {
    throw new Error(
      `[mock-ehr] src/client/dist/${name}.js is not built — run \`npm run build:client\` `
      + '(both `npm run build` and `npm test` do). The pages cannot render without it.',
    )
  }
  return `/client/${name}.js?v=${built.version}`
}

/** Serve a built file by name, or null when there is no such file. */
export function serveClientScript(file: string): Response | null {
  const built = byFile.get(file)
  if (!built) return null
  return new Response(built.text, {
    status: 200,
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      // Safe only because the URL changes when the content does — see
      // clientScriptUrl, and Rollup's content-hashed chunk names.
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${built.version}"`,
    },
  })
}

/** 32-bit FNV-1a, as eight hex digits. A version tag, not a security hash. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
