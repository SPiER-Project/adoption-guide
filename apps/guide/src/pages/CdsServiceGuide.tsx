/**
 * CdsServiceGuide — the hosted CDS Hooks endpoint, for the person wiring an EHR
 * to it.
 *
 * ── The shape ──────────────────────────────────────────────────────────────
 *
 * The same one screen and the same two drawers as its two siblings
 * (`ProviderAppGuide`, `PopulationDashboardGuide`) — adoption-guide audit §4.4,
 * applied 2026-09-20 — and it renders through `.surface-guide`, the stylesheet
 * those two already share, rather than a near-identical copy of its intro,
 * section and `h3` rules. Only the three things that are genuinely this page's
 * (the `<pre>` for a shell command, the wrapping URL link, the live-fetch status
 * line) stay in `CdsServiceGuide.css`. They sit on inner elements only: the
 * root is `.surface-guide` alone, because `check:template` reads a page root's
 * classes to work out which block it is checking and two blocks there make it
 * guess.
 *
 * ⚠️ **Auth is inside *How it decides*, not a section of its own.** The pattern
 * is two drawers, and on this page the service decides two things: whether to
 * answer you at all (the token), and what to answer (the derivation). A third
 * drawer would have been this page quietly exempting itself.
 *
 * ── Two things the audit removed, and why they do not come back ────────────
 *
 * §1.3, no repo vocabulary in reader copy: this page used to name
 * `observationMappers`, `derivePathwayStatus`, `buildCdsCards`, the package
 * directory they live in, and `npm run check:core-boundary`. The CLAIM those
 * made — one derivation serving both the Worker and the browser, so the wire
 * response and the panel cannot drift — is the interesting part and it stays.
 * The function names were never how a reader verifies it; the running
 * demonstration in the Demo EHR is.
 *
 * §1.2, the page contradicting itself: *Authentication* said enforcement runs
 * in `require` and *Honesty notes*, four paragraphs later, said `warn`. There
 * is now one statement of it, in one drawer. `require` is correct — CLAUDE.md,
 * and `services/cds` 500s without `SMART_LAUNCH_URL` for the same reason.
 *
 * The curl blocks stay. They are the task on this page, not reference: an
 * implementer copies them, and a page that hides its own commands behind a
 * disclosure has demoted the instruction rather than the caveat.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import { MOCK_EHR_LABEL, MOCK_EHR_URL } from '../data/surfaces'
import {
  CDS_DISCOVERY_URL,
  CDS_INVOKE_URL,
  CDS_SANDBOX_URL,
  CDS_SERVICE_ID,
} from '@spier/core/lib/cdsHooks'
import '../css/SurfaceGuide.css'
import '../css/CdsServiceGuide.css'
import { Button } from '@spier/ui/Button'
import { Disclosure } from '@spier/ui/Disclosure'

const DISCOVERY_CURL = `curl -s ${CDS_DISCOVERY_URL}`

// ⚠️ Carries an Authorization header, because the service enforces one.
// A tokenless version of this command was published here while enforcement ran
// in `warn` — it worked, and it taught every reader that the endpoint is open.
const INVOKE_CURL = `curl -X POST ${CDS_INVOKE_URL} \\
  -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer $CDS_CLIENT_JWT" \\
  -d '{"hook":"patient-view","hookInstance":"demo","context":{"userId":"Practitioner/demo","patientId":"patient-001"}}'`

type DiscoveryState =
  | { status: 'loading' }
  | { status: 'ok'; data: unknown }
  | { status: 'error' }

export function CdsServiceGuide() {
  const [discovery, setDiscovery] = useState<DiscoveryState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(CDS_DISCOVERY_URL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (!cancelled) setDiscovery({ status: 'ok', data })
      })
      .catch(() => {
        if (!cancelled) setDiscovery({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="surface-guide">
      <section className="surface-guide__intro">
        <p>
          SPiER&rsquo;s pathway recommendations are available to any CDS Hooks-capable EHR as a{' '}
          <strong>hosted service</strong> &mdash; the host registers one discovery URL and renders
          whatever cards come back, and no decision logic is built into the EHR.
        </p>
        <p>
          It runs the <strong>same derivation as the Provider App</strong>, so the wire response and
          the panel emit identical cards rather than two implementations that drift.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">What the endpoint gives you</h3>
        <ul className="surface-guide__list">
          <li>
            <strong>Discovery</strong> &mdash; an open <code>GET</code> advertising the{' '}
            <code>{CDS_SERVICE_ID}</code> service on the <code>patient-view</code> hook. No token.
          </li>
          <li>
            <strong>Cards</strong> &mdash; a <code>POST</code> with a patient in context returns{' '}
            <code>{'{ "cards": [...] }'}</code>: real CDS Hooks 2.0 cards, with a summary, an
            indicator and a source. Invocation is authenticated; an unknown patient returns{' '}
            <code>{'{ "cards": [] }'}</code>.
          </li>
          <li>
            <strong>A launch on the card</strong> &mdash; each card carries a link of{' '}
            <code>type: &quot;smart&quot;</code> naming the instrument the pathway calls for, which
            is how a host opens the Provider App already scoped to that tool.
          </li>
          <li>
            <strong>Feedback</strong> &mdash; the feedback endpoint accepts what a host sends when a
            clinician acts on a card, and is authenticated the same way.
          </li>
        </ul>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">Try it</h3>
        <p>
          Discovery is open, so the first command needs nothing. The second signs a bearer JWT your
          client holds &mdash; see <em>How it decides</em> below.
        </p>
        <pre className="cds-service-guide__pre">
          <code>{DISCOVERY_CURL}</code>
        </pre>
        <pre className="cds-service-guide__pre">
          <code>{INVOKE_CURL}</code>
        </pre>
        <p>
          <Button href={MOCK_EHR_URL} target="_blank" rel="noopener noreferrer" accent arrow>
            Open the Demo EHR
          </Button>
        </p>
        <p>
          That host calls this endpoint itself on <code>patient-view</code> and renders what comes
          back, beside the SPiER panel it launches from a card &mdash; two surfaces, one builder,
          visibly agreeing. The discovery URL is{' '}
          <a
            className="cds-service-guide__link"
            href={CDS_DISCOVERY_URL}
            target="_blank"
            rel="noreferrer"
          >
            {CDS_DISCOVERY_URL}
          </a>
          .
        </p>
        {discovery.status === 'loading' && (
          <p className="cds-service-guide__status" role="status" aria-live="polite">
            Fetching the live discovery document&hellip;
          </p>
        )}
        {discovery.status === 'error' && (
          <p className="cds-service-guide__status cds-service-guide__status--error">
            Couldn&rsquo;t reach the live endpoint right now &mdash; the discovery URL and the curl
            commands above still work.
          </p>
        )}
        {discovery.status === 'ok' && (
          <FhirJsonViewer data={discovery.data} title="Live /cds-services response" />
        )}
      </section>

      <section className="surface-guide__section surface-guide__drawers">
        <Disclosure summary="How it decides" hint="whether to answer, and what to answer">
          <p>
            <strong>Whether to answer.</strong> Per CDS Hooks 2.0 a client sends{' '}
            <code>Authorization: Bearer &lt;JWT&gt;</code> on each call, and the service validates
            it on <strong>invoke</strong> and <strong>feedback</strong> &mdash; signature plus
            registered claims (<code>aud</code> must equal the invoke URL, <code>exp</code>/
            <code>iat</code>, optional issuer allowlist). Enforcement is on: any failure is a{' '}
            <code>401</code> and never reaches the card builder. Discovery stays open, since clients
            fetch it before they hold a token.
          </p>
          <p>
            The {MOCK_EHR_LABEL} is a registered client: it holds an ES384 keypair, publishes the
            public half as a JWK Set, and calls this service <strong>server to server</strong> with
            a short-lived signed JWT &mdash; the browser never holds one, which is the only
            arrangement in which a signature proves anything. A JWT&rsquo;s client-controlled{' '}
            <code>jku</code> header is treated as an SSRF risk: its host must be allowlisted or the
            token is rejected <em>without ever being fetched</em>, and the demo host&rsquo;s tokens
            do carry <code>jku</code>, so that guard is on the live path rather than only under
            test.
          </p>
          <p>
            <strong>What to answer.</strong> Two derivation paths. When the request includes the
            patient&rsquo;s completed <code>QuestionnaireResponse</code>s in <code>prefetch</code>,
            the cards derive from that live data, behaving like a connected EHR. Without prefetch it
            falls back to the bundled demo scenario for <code>patient-001</code>&hellip;
            <code>patient-011</code>, including that patient&rsquo;s curated next step.
          </p>
          <p>
            Either way the rule is the pathway&rsquo;s, not the endpoint&rsquo;s &mdash; the same
            four inputs the <Link to="/guide/provider-app">Provider App</Link> uses, from one shared
            implementation.
          </p>
        </Disclosure>

        <Disclosure summary="What this does and does not prove" hint="a demo service, prefetch-only">
          <ul className="surface-guide__list">
            <li>
              <strong>It is prefetch-only.</strong> It never queries a FHIR server; live-path cards
              come from what the client hands over in <code>prefetch</code>.
            </li>
            <li>
              <strong>Nothing is persisted</strong>, and the feedback endpoint accepts requests and
              discards them.
            </li>
            <li>
              <strong>The CDS Hooks Sandbox gets as far as discovery.</strong> Add the discovery URL
              to the{' '}
              <a
                className="cds-service-guide__link"
                href={CDS_SANDBOX_URL}
                target="_blank"
                rel="noreferrer"
              >
                sandbox
              </a>{' '}
              as a service and open a patient &mdash; CORS is wide open, so no proxy is needed, but
              the sandbox does not sign a client JWT, so invocation returns <code>401</code>. That
              is the service behaving correctly rather than a gap: a CDS client is an identity the
              service has registered, and the sandbox is not one. Registering an issuer and its
              key-set URL is what changes that.
            </li>
            <li>
              <strong>The one host that does invoke it is ours</strong>, so nothing seen there is
              evidence of interoperability. The full version of that caveat is on the{' '}
              <Link to="/guide/dashboard">Population Dashboard</Link> page.
            </li>
          </ul>
        </Disclosure>
      </section>
    </div>
  )
}
