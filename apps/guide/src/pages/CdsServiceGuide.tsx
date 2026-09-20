import { useEffect, useState } from 'react'
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import { MOCK_EHR_LABEL, MOCK_EHR_URL } from '../data/surfaces'
import {
  CDS_DISCOVERY_URL,
  CDS_INVOKE_URL,
  CDS_SANDBOX_URL,
  CDS_SERVICE_ID,
} from '@spier/core/lib/cdsHooks'
import '../css/CdsServiceGuide.css'

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
          and <code>buildCdsCards</code> in <code>packages/core/src/lib/</code> &mdash; so the wire
          response and the chart emit byte-identical CDS Hooks 2.0 cards. That package is React-free
          and DOM-free by gate (<code>npm run check:core-boundary</code>), which is what lets one
          implementation serve a Worker and a browser rather than two that drift.
        </p>
        <p>
          That claim has a running demonstration rather than only a curl command. Open a chart in
          the{' '}
          <a className="cds-service-guide__link" href={MOCK_EHR_URL} target="_blank" rel="noreferrer">
            {MOCK_EHR_LABEL}
          </a>
          : the host calls this endpoint itself on <code>patient-view</code> and renders whatever
          comes back, beside the SPiER panel it launches from a card. Two surfaces, one builder,
          visibly agreeing.
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
          <code>{'{ "cards": [...] }'}</code>. Invocation is <strong>authenticated</strong> &mdash;
          see below &mdash; so the call carries a bearer JWT your client signs:
        </p>
        <pre className="cds-service-guide__pre">
          <code>{INVOKE_CURL}</code>
        </pre>
        <p>
          Without a valid token this returns <code>401</code>. Discovery, above, stays open.
        </p>
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
          , add the discovery URL above as a service, then open a patient. CORS is wide open, so
          no proxy is needed &mdash; but the sandbox does not sign a client JWT, so{' '}
          <strong>invocation returns <code>401</code></strong> and discovery is as far as it gets.
          That is the service behaving correctly rather than a gap: a CDS Client is an identity the
          service has registered, and the sandbox is not one. Register an issuer and its key-set
          URL to change that.
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
          Enforcement runs in <strong>require</strong> mode: any failure is a <code>401</code>, and
          an unsigned call never reaches the card builder. It ran in <strong>warn</strong> until
          2026&#8209;09&#8209;20 &mdash; verifying, logging the failure, and proceeding &mdash;
          which is not authentication so much as a log line, and it stayed that way because nothing
          in the demo could produce a token.
        </p>
        <p>
          What changed is that the {MOCK_EHR_LABEL} became a real CDS Client. It holds an ES384
          keypair, publishes the public half as a JWK Set, and calls this service{' '}
          <strong>server to server</strong> with a short-lived signed JWT &mdash; the browser never
          holds one, which is the only arrangement in which a signature proves anything. Its chart
          page names the key-set URL under &ldquo;Under the hood&rdquo;.
        </p>
        <p>
          A JWT&rsquo;s client-controlled <code>jku</code> header is treated as an SSRF risk &mdash;
          its host must be allowlisted or the token is rejected <em>without ever being fetched</em>.
          The demo host&rsquo;s tokens do carry <code>jku</code>, so that guard is on the live path
          rather than only under test.
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
            This is a <strong>demo service</strong>. Bearer-JWT validation is <strong>enforced</strong>
            (see above): an unsigned or invalid token is a <code>401</code> and never reaches the card
            builder.
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
