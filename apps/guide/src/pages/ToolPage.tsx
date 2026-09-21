/**
 * One catalogued tool as a page — `/guide/tools/TL-0NN`.
 *
 * ── Why a tool is a page ────────────────────────────────────────────────────
 *
 * Until 2026-09-20 the Tools section was 40 accordion cards; expanding one
 * added five sections and 1,600px, and the form — the thing a reader came to
 * try — was a secondary button at the bottom of that, behind "Show details".
 * The adoption-guide UX audit (docs/plans/adoption-guide-ux-audit-2026-09-20.md
 * §4.3) put the form where the reader lands: this page is the tool's name and
 * purpose, its form in the foreground with the FHIR beside it, the catalogue
 * detail in closed drawers below, and one way onward to the Demo EHR. It
 * replaces both the accordion's drill-in (`ToolDetail`) and the separate try
 * route (`/guide/tools/:slug/try`, `ToolTryIt`), which now redirects here.
 *
 * ── Keyed by TOOL, rendering the tool's FORM ────────────────────────────────
 *
 * The URL carries the tool id the IG publishes as `ActivityDefinition.identifier`.
 * A tool's forms are read off its catalog launch actions (`data/toolForms.ts`):
 * one for most, three for the CAMS SSF-5 (a picker, `?form=`), none for eight.
 * A form shared by several tools renders on each of their pages, and each page
 * names the others — the four safety-task tools are one recorder, and the page
 * says so rather than pretending otherwise. A form slug in the URL — the old
 * try route's key, or a hand-typed `/guide/tools/asq` — canonicalises to the
 * owning tool's page so one tool has one address.
 *
 * ── What this page owns, and the three contexts it provides ─────────────────
 *
 * ⚠️ **It owns the page header, so the shared view must not.** `QuestionnaireView`
 * and `WorkflowForm` draw their own `PageHeader` on the clinician's routes,
 * where the view IS the page. Here the header names the tool the reader chose
 * — which matters exactly where four tools share one recorder — so this page
 * renders it and tells the view through `PageHeaderOwnerContext`. Two headers
 * on one page is the drift `check:template` forbids; this file is in that
 * gate's LENSES because it renders one, and owns its width (RULE 5b) for the
 * same reason. `wide`, because the form frame is a row: the card beside the
 * FHIR aside.
 *
 * ⚠️ **A SIBLING of the `/guide` layout, not a child**, for the reason the try
 * route was: the layout draws a header for every page under it. Declared in
 * `data/guideSections.ts` as a `subsections` entry with its full parameterised
 * path so `check:guide-boundary` walks it and `check:catalog` asserts the
 * route — a route under `/guide` that file does not name is checked by
 * nothing. The boundary gate's premise holds: the form writes to the guide's
 * UNSEEDED patient context (the blank "play with forms" store), which is
 * patient context and not patient data, and nothing here reaches a fixture.
 *
 * `InspectContext` on, as the try route had it: this is the implementer's
 * page, and the FHIR drawer, the examples and the writeback report render.
 * `SurfaceLinksContext` is the guide's: no chart, no caseload, and a view's
 * link to another view lands on that view's tool page.
 *
 * ⚠️ Copy rules (audit §5): the reader is not re-introduced — the Tools list
 * did that — but the task comes first and the caveat after it, quieter; no
 * script, gate or file name reaches the page; the wire format is in the
 * drawer and the examples, never in the prose. `ToolPage.test.tsx` pins the
 * word cap above the form and the single header.
 */
import { Fragment, Suspense } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  bindingsUsedByTool,
  stageById,
  systemLabel,
  toolById,
  type Tool,
} from '@spier/core/data/catalog'
import { RouteFallback } from '@spier/app-shell/components/RouteFallback'
import { FhirJsonViewer } from '@spier/tool-views/components/FhirJsonViewer'
import { InclusionBadge } from '@spier/tool-views/components/InclusionBadge'
import { InspectContext } from '@spier/tool-views/context/InspectContext'
import { PageHeaderOwnerContext } from '@spier/tool-views/context/PageHeaderOwnerContext'
import { SurfaceLinksContext } from '@spier/tool-views/context/SurfaceLinksContext'
import { TOOL_VIEWS, isToolViewSlug } from '@spier/tool-views/data/toolViews'
import { Button } from '@spier/ui/Button'
import { Card } from '@spier/ui/Card'
import { DataTable } from '@spier/ui/DataTable'
import { EmptyState } from '@spier/ui/EmptyState'
import { Notice } from '@spier/ui/Notice'
import { PageHeader } from '@spier/ui/PageHeader'
import { Pill } from '@spier/ui/Pill'
import { Disclosure } from '@spier/ui/Disclosure'
import { LicensingBadge } from '../components/LicensingBadge'
import { LICENSING_BLURB, LICENSING_LABELS } from '../data/licensing'
import { GUIDE_SURFACE_LINKS } from '../data/surfaceLinks'
import { MOCK_EHR_LABEL, MOCK_EHR_URL } from '../data/surfaces'
import { guideToolHref, toolForFormSlug, toolForms, toolsSharingForm } from '../data/toolForms'
import '../css/ToolPage.css'

/** The catalogue's record of what a tool is for: its description, the settings it belongs in, its tags. */
function AboutDrawer({ tool }: { tool: Tool }) {
  return (
    <Disclosure summary="What it is for" hint={tool.settings.join(' · ')}>
      {tool.description && <p className="tool-page__desc">{tool.description}</p>}
      {tool.settings.length > 0 && (
        <div className="tool-page__chips">
          <span className="tool-page__chips-label">Settings</span>
          {tool.settings.map((s) => (
            <Pill key={s} variant="label">{s}</Pill>
          ))}
        </div>
      )}
      {tool.tags && tool.tags.length > 0 && (
        <div className="tool-page__chips">
          <span className="tool-page__chips-label">Tags</span>
          {tool.tags.map((t) => (
            <Pill key={t} variant="label" tone="warning">{t}</Pill>
          ))}
        </div>
      )}
    </Disclosure>
  )
}

/** The implementation table: which resources the step writes (or reads), and when. */
function RecordsDrawer({ tool }: { tool: Tool }) {
  const pattern = tool.recordingPattern
  if (!pattern) return null
  return (
    <Disclosure summary="What it records" hint={`${pattern.resources.length} resource${pattern.resources.length === 1 ? '' : 's'}`}>
      <DataTable tableClassName="tool-page__table">
        <thead>
          <tr>
            <th>FHIR resource</th>
            <th>Content</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {pattern.resources.map((r, idx) => (
            <tr key={idx}>
              <td><code>{r.type}</code></td>
              <td>{r.description}</td>
              <td className="tool-page__when">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {pattern.workflowTrigger && (
        <p className="tool-page__trigger">
          <strong>Workflow trigger:</strong> {pattern.workflowTrigger}
        </p>
      )}
    </Disclosure>
  )
}

/** Every data-dictionary binding the tool produces, with its code and element path. */
function ElementsDrawer({ tool }: { tool: Tool }) {
  const bindings = bindingsUsedByTool(tool.id)
  if (bindings.length === 0) return null
  return (
    <Disclosure summary="Data elements" hint={bindings.length}>
      <ul className="tool-page__elements">
        {bindings.map((b) => (
          <li key={b.id}>
            <span className="tool-page__element-name">{b.name}</span>
            {b.code ? (
              <code className="tool-page__element-code">
                {systemLabel(b.code.system)}: {b.code.code}
              </code>
            ) : b.value ? (
              /* No code of its own, but the value is coded — name the value
                 vocabulary rather than showing nothing (#260). */
              <code className="tool-page__element-code">{systemLabel(b.value.system)} (values)</code>
            ) : null}
            {/* fhirPath is resource-qualified already — don't prefix it again. */}
            <span className="tool-page__element-path">{b.fhirPath}</span>
          </li>
        ))}
      </ul>
    </Disclosure>
  )
}

/**
 * The example resources the catalogue carries for this tool. The viewer gates
 * itself on inspection, and this page PROVIDES inspection, so the drawer can
 * never open onto nothing — which is the wrapper defect `ToolDetail` carried
 * (docs/internals/tool-views.md §3) and the reason this is not a bare wrapper
 * rendered from somewhere the answer could be no.
 */
function ExamplesDrawer({ tool }: { tool: Tool }) {
  const examples = tool.fhirExamples ?? []
  if (examples.length === 0) return null
  return (
    <Disclosure summary="FHIR examples" hint={examples.length}>
      <div className="tool-page__examples">
        {examples.map((ex) => (
          <FhirJsonViewer key={ex.title} title={ex.title} data={ex.resource} />
        ))}
      </div>
    </Disclosure>
  )
}

/** The licensing status with the full copyright notice, read from the ActivityDefinition. */
function LicensingDrawer({ tool }: { tool: Tool }) {
  if (!tool.licensing) return null
  return (
    <Disclosure summary="Licensing" hint={LICENSING_LABELS[tool.licensing]}>
      <div className="tool-page__chips">
        <LicensingBadge licensing={tool.licensing} />
        <span className="tool-page__licence-blurb">{LICENSING_BLURB[tool.licensing]}</span>
      </div>
      {tool.copyright && <p className="tool-page__licence">{tool.copyright}</p>}
    </Disclosure>
  )
}

export function ToolPage() {
  const { toolRef } = useParams<{ toolRef: string }>()
  const [searchParams] = useSearchParams()
  const ref = toolRef ?? ''
  const tool = toolById(ref.toUpperCase())

  if (!tool) {
    // A form slug rather than a tool id — the retired try route's key, or a
    // hand-typed `/guide/tools/asq` — has a page: the owning tool's. One tool,
    // one address, so it redirects rather than rendering a second copy.
    const owner = isToolViewSlug(ref) ? toolForFormSlug(ref) : undefined
    if (owner) {
      const href = guideToolHref(owner.id)
      return <Navigate to={toolForms(owner).length > 1 ? `${href}?form=${ref}` : href} replace />
    }
    // Anything else is a broken link in the catalogue rather than a reader's
    // mistake, so it says where to go rather than what they typed.
    return (
      <div className="tool-page">
        <EmptyState panel>
          Nothing is catalogued under that name. <Link to="/guide/tools">Back to Tools</Link>.
        </EmptyState>
      </div>
    )
  }

  const stage = stageById(tool.stageId)
  const forms = toolForms(tool)
  const requested = searchParams.get('form')
  const active = forms.find((f) => f.slug === requested) ?? forms[0]
  const siblings = active ? toolsSharingForm(active.slug).filter((t) => t.id !== tool.id) : []
  const href = guideToolHref(tool.id)

  return (
    <InspectContext.Provider value>
      <SurfaceLinksContext.Provider value={GUIDE_SURFACE_LINKS}>
        <PageHeaderOwnerContext.Provider value="page">
          <div className="tool-page">
            <PageHeader
              eyebrowStyle="pill"
              eyebrow={['Tools', stage?.title ?? 'Catalogue']}
              up="/guide/tools"
              title={tool.name}
              lede={tool.purpose}
            />

            <div className="tool-page__meta">
              <InclusionBadge status={tool.inclusionStatus} />
              <Pill variant="label" size="sm">{tool.badge.label}</Pill>
              {tool.licensing && (
                <LicensingBadge licensing={tool.licensing} title={tool.copyright ?? LICENSING_BLURB[tool.licensing]} />
              )}
              <span className="tool-page__id">{tool.id}</span>
            </div>

            {/* ── The form, first ────────────────────────────────────── */}
            <section className="tool-page__form" aria-label="Try the form">
              {forms.length > 1 && active && (
                <nav className="tool-page__forms" aria-label="Forms of this tool">
                  {forms.map((f) => (
                    <Button
                      key={f.slug}
                      to={`${href}?form=${f.slug}`}
                      size="sm"
                      variant={f.slug === active.slug ? 'primary' : 'secondary'}
                    >
                      {f.label}
                    </Button>
                  ))}
                </nav>
              )}
              {active ? (
                <Suspense fallback={<RouteFallback />}>{TOOL_VIEWS[active.slug]}</Suspense>
              ) : tool.launchActions.length > 0 ? (
                <Notice tone="info">
                  <strong>This step reads a caseload, so there is no form to fill in here.</strong> It runs in
                  the {MOCK_EHR_LABEL}, over the charts the host holds; the button below opens it.
                </Notice>
              ) : (
                <Notice tone="neutral">
                  <strong>No form to try yet.</strong> This step is catalogued and scoped but not built; what it
                  will record is below.
                </Notice>
              )}
              {siblings.length > 0 && (
                <p className="tool-page__siblings">
                  The same form records{' '}
                  {siblings.map((t, i) => (
                    <Fragment key={t.id}>
                      {i > 0 && (i === siblings.length - 1 ? ' and ' : ', ')}
                      <Link to={guideToolHref(t.id)}>{t.name}</Link>
                    </Fragment>
                  ))}
                  .
                </p>
              )}
            </section>

            {/* ── The catalogue detail, one click down ───────────────── */}
            <Card as="section" tone="muted" className="tool-page__about" aria-labelledby="tool-page-about-title">
              <h3 id="tool-page-about-title" className="tool-page__about-title">About this tool</h3>
              <AboutDrawer tool={tool} />
              <RecordsDrawer tool={tool} />
              <ElementsDrawer tool={tool} />
              <ExamplesDrawer tool={tool} />
              <LicensingDrawer tool={tool} />
            </Card>

            {/* ── One way onward ─────────────────────────────────────── */}
            <section className="tool-page__ehr" aria-label="See it in a chart">
              <Button
                href={MOCK_EHR_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant={active ? 'secondary' : 'primary'}
                arrow
                aria-label={`Open the ${MOCK_EHR_LABEL} (opens in a new tab)`}
              >
                Open the {MOCK_EHR_LABEL}
              </Button>
              <p className="tool-page__ehr-note">
                A clinician meets this step from a patient&rsquo;s chart, with none of the FHIR showing. The
                host there is this project&rsquo;s own, so what it shows is the app working as a guest, not
                evidence of interoperability.
              </p>
            </section>
          </div>
        </PageHeaderOwnerContext.Provider>
      </SurfaceLinksContext.Provider>
    </InspectContext.Provider>
  )
}
