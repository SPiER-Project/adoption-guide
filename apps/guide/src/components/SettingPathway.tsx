/**
 * One setting pathway — the core protocol as it applies in one care setting.
 *
 * The body of a guide SUB-PAGE of /guide/pathway, one per entry in
 * `data/settingPathways.ts`, each reached from the "In specific settings"
 * section of the explainer. Like the protocol page, everything in the spine is
 * read from the setting's PlanDefinition
 * (ig/input/fsh/setting-pathways.fsh) by `loadSettingPathway`; the lede, the
 * review notice and the pending list are page copy and are labelled so.
 *
 * Why the spine has no tier table: a setting pathway applies the core
 * protocol's tiers rather than restating them, so the page says that in one
 * sentence and links back, instead of drawing a second copy of the table that
 * could come to disagree with the first.
 *
 * A step whose realization is ANOTHER setting pathway — the emergency
 * department's admission step, which hands over to inpatient care — renders as
 * a link to that setting's page. That link is the nesting the reader sees.
 *
 * ⚠️ A component, not a page, and in components/ on purpose: it renders a
 * fragment inside the route file's root (pages/EmergencyDepartmentPathway.tsx,
 * pages/InpatientPathway.tsx), which is where `check:template` reads a page
 * root from — a file under pages/ is read as a page, and this one's first
 * element is a capped lede rather than a root. It renders inside
 * AdoptionGuide's header, so it draws none. It holds no patient data
 * (`check:guide-boundary` walks it from the route files).
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { loadSettingPathway, type ProtocolModel } from '@spier/core/lib/pathway'
import { PathwayLoadError, PathwayProvenance, PathwaySpine, type RenderRealization } from '@spier/app-shell/components/PathwayView'
import '@spier/app-shell/css/CarePathway.css'
import { Notice } from '@spier/ui/Notice'
import { Card } from '@spier/ui/Card'
import { SETTING_PATHWAY_PAGES, type SettingPathwayPage } from '../data/settingPathways'

/** A realization that is another setting pathway links to that setting's page. */
const linkSettings: RenderRealization = (canonical) => {
  const target = SETTING_PATHWAY_PAGES.find(page => page.canonical === canonical)
  if (!target) return undefined
  return (
    <Link className="pathway-obligation__handover" to={target.href}>
      Continues in {target.label.replace(/^In /, '')}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  )
}

function useSettingPathway(canonical: string): { model: ProtocolModel | null; error: string | null } {
  return useMemo(() => {
    try {
      return { model: loadSettingPathway(canonical), error: null as string | null }
    } catch (e) {
      return { model: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [canonical])
}

export function SettingPathway({ page }: { page: SettingPathwayPage }) {
  const loaded = useSettingPathway(page.canonical)

  if (!loaded.model) return <PathwayLoadError error={loaded.error} />
  const model = loaded.model

  // A fragment: the page root is the route component's (see its file), which
  // is where check:template looks for it.
  return (
    <>
      <p className="care-pathway__lede">{page.lede}</p>

      {page.reviewStatus && (
        <Notice tone="info" title="Awaiting clinical review">
          {page.reviewStatus}
        </Notice>
      )}

      <p className="care-pathway__aside">
        A positive screen, a risk tier and what each tier is owed mean the same here as in the{' '}
        <Link to="/guide/pathway">core pathway</Link>; this page shows what the setting adds around them.
      </p>

      <section aria-labelledby="setting-spine-title">
        <h3 id="setting-spine-title" className="pathway-section-title">The pathway, step by step</h3>
        <PathwaySpine model={model} renderRealization={linkSettings} />
      </section>

      {page.pending.length > 0 && (
        <Card as="section" tone="muted" aria-labelledby="setting-pending-title">
          <h3 id="setting-pending-title" className="pathway-section-title">Not yet part of this pathway</h3>
          <p className="care-pathway__para">
            Page notes, not the published protocol: what this setting&rsquo;s source left open, and the
            protocol therefore leaves out.
          </p>
          <ul className="pathway-notes">
            {page.pending.map(item => (
              <li key={item} className="pathway-notes__item">
                <span className="pathway-notes__text">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PathwayProvenance model={model}>
        <p className="pathway-provenance__lede">
          The artifact the steps above were drawn from, published alongside the core pathway it applies.
        </p>
      </PathwayProvenance>
    </>
  )
}
