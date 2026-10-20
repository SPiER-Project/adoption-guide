/**
 * The under-development notice on the rendered IG, written into each page as
 * this Worker serves it.
 *
 * ⚠️ **Here, and not in the IG's template, because the IG has no slot for it.**
 * The render uses `fhir.base.template` unmodified, and forking a template to add
 * one strip is a maintenance cost the notice is not worth — it is temporary.
 * The cost of doing it here instead: the GitHub Pages render (the fallback for
 * oversized downloads, `IG_FALLBACK_BASE`) carries no notice. Those are zip
 * and tarball downloads, not pages, so nothing a reader browses is missed.
 *
 * The words come from core, the one copy every surface shares — imported
 * relatively, for the reason `deploy-origins.json` is: this Worker has no
 * `@spier/core` alias, and `developmentNotice.ts` imports nothing.
 *
 * Inline styles, because the IG's stylesheet knows no SPiER token and this
 * Worker's CSP sets `frame-ancestors` only. The colours are
 * `--status-warning-*` from `packages/ui/src/foundation.css`, restated.
 */
import { DEVELOPMENT_NOTICE } from '../../../packages/core/src/lib/developmentNotice'

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const IG_NOTICE_HTML =
  '<div role="note" style="background:#f8eed8;color:#72500a;border-bottom:1px solid #e6cf98;' +
  'padding:4px 24px;text-align:center;font:13px/1.4 system-ui,sans-serif">' +
  `<strong>${escapeHtml(DEVELOPMENT_NOTICE.title)}</strong> ${escapeHtml(DEVELOPMENT_NOTICE.body)}` +
  '</div>'

/**
 * Return `response` with the notice inserted after `<body …>` when it is an
 * HTML page; anything else (CSS, JSON, a zip, a redirect) comes back untouched.
 * A page with no `<body>` tag is also returned as-is rather than guessed at.
 */
export async function withIgNotice(response: Response): Promise<Response> {
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.includes('text/html')) return response

  const html = await response.text()
  const body = /<body\b[^>]*>/i.exec(html)
  if (!body) return new Response(html, response)

  const at = body.index + body[0].length
  const out = new Response(html.slice(0, at) + IG_NOTICE_HTML + html.slice(at), response)
  // The length changed; let the runtime recompute it rather than ship a stale one.
  out.headers.delete('content-length')
  return out
}
