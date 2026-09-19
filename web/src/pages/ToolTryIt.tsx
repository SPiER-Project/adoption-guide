/**
 * `/guide/tools/:slug/try` — an instrument or recorder, rendered for an
 * implementer rather than for a clinician.
 *
 * ── Why this route exists ───────────────────────────────────────────────────
 *
 * The clinician-facing app stopped showing raw FHIR on 2026-09-17: it should
 * read as something a health system would adopt into its own SMART on FHIR
 * application, and JSON beside a C-SSRS is the clearest sign that it is a demo.
 * But the guide's tool catalogue *needs* that view — "here is the Questionnaire,
 * here is the QuestionnaireResponse it produces, here is what was written back"
 * is the thing an implementer came to see.
 *
 * The two audiences were reading one URL. `/patient/assessments/asq` is what the
 * catalogue linked to, and it is also what every CDS Hooks card and every SMART
 * `intent` resolves to — so it could not serve both. This route is the second
 * one: same view, same element (see `data/toolViews.tsx`), inspection on.
 *
 * ⚠️ **NOT nested under the `/guide` layout route, and that is structural.**
 * `QuestionnaireView` and the recorders render their own `PageHeader`. Nesting
 * this inside `AdoptionGuide` would put two page headers on one page, which
 * `check:template` forbids and which looks exactly as wrong as it sounds. So it
 * is a top-level route that happens to live under the `/guide/` prefix, and it
 * provides `InspectContext` itself rather than inheriting the layout's.
 *
 * ⚠️ **It is deliberately NOT a `guideSections.ts` entry**, which is the one
 * place this repo's conventions and this route disagree. A guide section is
 * gated by `check:guide-boundary` as holding no patient data; this route renders
 * the app's own recorders, which write to patient context on submit. Declaring
 * it a guide page would either fail that gate or, worse, pass it while meaning
 * something the gate was not written to check. What covers it instead is
 * `toolViews.test.ts`, which pins that every slug the guide offers has a view
 * and that the clinician routes and this map agree.
 *
 * ⚠️ **It renders no `PageHeader` and declares no width, deliberately.** The
 * view it wraps already owns both — `QuestionnaireView`'s root is `.form-view`,
 * and the recorders' is `WorkflowForm`'s frame. A wrapper that added a second
 * header would break `check:template`'s one-header rule, and a root declaring a
 * width would take ownership of it away from the view, which CLAUDE.md gives to
 * whoever owns the header. `.tool-try-it` exists only so the gate can find this
 * page's root; it carries no rule of its own.
 */
import { useParams, Link } from 'react-router-dom'
import { InspectContext } from '@spier/tool-views/context/InspectContext'
import { TOOL_VIEWS, isToolViewSlug } from '@spier/tool-views/data/toolViews'
import { EmptyState } from '@spier/ui/EmptyState'
import { Notice } from '@spier/ui/Notice'
import { guideHref } from '../data/guideSections'

export function ToolTryIt() {
  const { slug } = useParams<{ slug: string }>()

  if (!isToolViewSlug(slug)) {
    // A slug with no view is a broken link in the catalogue rather than a
    // reader's mistake, so it says where to go rather than what they typed.
    return (
      <div className="tool-try-it">
        <EmptyState>
          Nothing is registered under that name. <Link to={guideHref('tools')}>Back to Tools</Link>.
        </EmptyState>
      </div>
    )
  }

  return (
    <InspectContext.Provider value>
      <div className="tool-try-it">
      <Notice tone="info">
        <strong>This is the implementer&rsquo;s view.</strong> It is the same recorder a clinician
        uses, with the FHIR opened up: the Questionnaire it is built from, the
        QuestionnaireResponse your answers produce, and what SPiER would write back. A clinician
        launching this from a chart sees the form and none of this.{' '}
        <Link to={guideHref('tools')}>Back to Tools</Link>.
      </Notice>
      {TOOL_VIEWS[slug]}
      </div>
    </InspectContext.Provider>
  )
}
