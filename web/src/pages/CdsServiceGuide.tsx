import { useEffect, useState } from 'react'
import { FhirJsonViewer } from '../components/FhirJsonViewer'
import {
  CDS_DISCOVERY_URL,
  CDS_INVOKE_URL,
  CDS_SANDBOX_URL,
  CDS_SERVICE_ID,
} from '../lib/cdsHooks'
import '../css/CdsServiceGuide.css'

const DISCOVERY_CURL = `curl -s ${CDS_DISCOVERY_URL}`

const INVOKE_CURL = `curl -X POST ${CDS_INVOKE_URL} \\
  -H 'Content-Type: application/json' \\
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
    <div className="cds-service-guide">
      <section className="cds-service-guide__intro">
        <h3 className="cds-service-guide__h3">What this is</h3>
        <p>
          SPiER&rsquo;s pathway recommendations are available to any CDS Hooks-capable EHR as a{' '}
          <strong>hosted service</strong> &mdash; no decision logic needs to be built into the EHR.
          It registers the discovery URL and renders whatever cards the service returns.
        </p>
        <p>
          The endpoint runs the <strong>same browser-free derivation code</strong> as the in-app
          Patient Chart &mdash; the <code>observationMappers</code>, <code>derivePathwayStatus</code>,
          and <code>buildCdsCards</code> in <code>web/src/lib/</code> &mdash; so the wire response and
          the chart emit byte-identical CDS Hooks 2.0 cards.
        </p>
      </section>

      <section className="cds-service-guide__section">
        <h3 className="cds-service-guide__h3">Discovery endpoint</h3>
        <p>
          A CDS client starts by fetching the discovery document, which advertises the{' '}
          <code>{CDS_SERVICE_ID}</code> service (a <code>patient-view</code> hook):
        </p>
        <p>
          <a
            className="cds-service-guide__link"
            href={CDS_DISCOVERY_URL}
            target="_blank"
            rel="noreferrer"
          >
            {CDS_DISCOVERY_URL}
          </a>
        </p>
        <pre className="cds-service-guide__pre">
          <code>{DISCOVERY_CURL}</code>
        </pre>
      </section>

      <section className="cds-service-guide__section">
        <h3 className="cds-service-guide__h3">Invoke the service</h3>
        <p>
          Post a <code>patient-view</code> request with a patient in context to get back{' '}
          <code>{'{ "cards": [...] }'}</code>:
        </p>
        <pre className="cds-service-guide__pre">
          <code>{INVOKE_CURL}</code>
        </pre>
        <p>
          There are <strong>two derivation paths</strong>. When the request includes the patient&rsquo;s
          completed <code>QuestionnaireResponse</code>s in <code>prefetch</code>, the cards derive from
          that live data &mdash; behaving like a connected EHR. Without prefetch, the service falls back
          to the bundled population scenario for <code>patient-001</code>&hellip;<code>patient-011</code>,
          including that patient&rsquo;s curated recommended next step. Unknown patient ids return{' '}
          <code>{'{ "cards": [] }'}</code>.
        </p>
      </section>

      <section className="cds-service-guide__section">
        <h3 className="cds-service-guide__h3">Try it in the CDS Hooks sandbox</h3>
        <p>
          Open the{' '}
          <a
            className="cds-service-guide__link"
            href={CDS_SANDBOX_URL}
            target="_blank"
            rel="noreferrer"
          >
            CDS Hooks Sandbox
          </a>
          , add the discovery URL above as a service, then open a patient to see SPiER&rsquo;s cards
          appear in context. CORS is already wide open, so no proxy or configuration is needed.
        </p>
      </section>

      <section className="cds-service-guide__section">
        <h3 className="cds-service-guide__h3">Authentication</h3>
        <p>
          Per CDS Hooks 2.0 a CDS client sends{' '}
          <code>Authorization: Bearer &lt;JWT&gt;</code> on each call. The service validates that
          token on the <strong>invoke</strong> and <strong>feedback</strong> endpoints &mdash;
          signature plus registered claims (<code>aud</code> must equal the invoke URL,{' '}
          <code>exp</code>/<code>iat</code>, optional issuer allowlist). <strong>Discovery stays
          open</strong>, since clients fetch it before they hold a token.
        </p>
        <p>
          Enforcement currently runs in <strong>warn</strong> mode: an invalid or missing token is
          logged but <em>not</em> blocked, so the tokenless curl commands above and the sandbox flow
          still work while callers adopt tokens. It flips to a hard <code>require</code> (401 on any
          failure) via a single config change. A JWT&rsquo;s client-controlled <code>jku</code>{' '}
          header is treated as an SSRF risk &mdash; its host must be allowlisted or it is rejected
          without ever being fetched.
        </p>
      </section>

      <section className="cds-service-guide__section">
        <h3 className="cds-service-guide__h3">Live discovery document</h3>
        {discovery.status === 'loading' && (
          <p className="cds-service-guide__status" role="status" aria-live="polite">
            Fetching the live discovery document&hellip;
          </p>
        )}
        {discovery.status === 'error' && (
          <p className="cds-service-guide__status cds-service-guide__status--error">
            Couldn&rsquo;t reach the live endpoint right now &mdash; the{' '}
            <a
              className="cds-service-guide__link"
              href={CDS_DISCOVERY_URL}
              target="_blank"
              rel="noreferrer"
            >
              discovery URL
            </a>{' '}
            and curl commands above still work.
          </p>
        )}
        {discovery.status === 'ok' && (
          <FhirJsonViewer
            data={discovery.data}
            title="Live /cds-services response"
            defaultOpen
          />
        )}
      </section>

      <section className="cds-service-guide__section cds-service-guide__notes">
        <h3 className="cds-service-guide__h3">Honesty notes</h3>
        <ul>
          <li>
            This is a <strong>demo service</strong>. Bearer-JWT validation exists (see above) but runs
            in <strong>warn</strong> mode &mdash; tokens are verified and logged, not yet enforced.
          </li>
          <li>
            It is <strong>prefetch-only</strong>: it never queries a FHIR server. Live-path cards come
            from the <code>QuestionnaireResponse</code>s the client hands over in <code>prefetch</code>.
          </li>
          <li>Nothing is persisted.</li>
          <li>The feedback endpoint accepts requests but discards them.</li>
        </ul>
      </section>
    </div>
  )
}
