/**
 * InstrumentHeader — the formal identity of the instrument being filled in, and
 * the replacement for the one `@formbox/renderer` draws for itself.
 *
 * ── The measurement ─────────────────────────────────────────────────────────
 *
 * Measured in a 470px panel, the width the step-0 spike settled on (panel plan
 * §9.1), on C-SSRS Screener:
 *
 *   the renderer's <h1>        86px   the full instrument name, at --font-size-3xl,
 *                                     wrapping to three lines
 *   the renderer's <p>        240px   Questionnaire.description, at body size,
 *                                     wrapping to ten
 *   ────────────────────────────────
 *                             326px   before question one
 *
 * On top of the shell's own 76px, that put the first control at **560px in a
 * 900px panel** — 62% of the viewport spent before anything is asked. Which is
 * the joke: `PanelShell` exists to reclaim 252px of chrome, and the form then
 * spent more than that on a title block. The chrome had been measured and the
 * content had not.
 *
 * ── Why this is not just smaller type ───────────────────────────────────────
 *
 * The description is the bulk of it, and it cannot simply be deleted:
 * `Questionnaire.description` carries administration guidance on some
 * instruments, and silently truncating clinical instructions is a worse defect
 * than the one being fixed. So it moves behind a closed `<details>` — present,
 * findable, costing one line instead of ten.
 *
 * ⚠️ **It is closed by default and that is a judgement, not a default.** The
 * text is implementer-facing on every instrument in this repo today — C-SSRS
 * Screener's opens *"FHIR Questionnaire representation of the C-SSRS Screen
 * Version (Recent)"*, which is addressed to someone integrating the form, not
 * to the clinician holding it. A future instrument whose description is genuine
 * administration guidance is the case to revisit this for; it would want the
 * guidance promoted, not the disclosure opened.
 *
 * ── Why the name stays at all ───────────────────────────────────────────────
 *
 * `PageHeader` above already names the instrument, but by its short name
 * ("C-SSRS Screener (Recent)"). The formal name is a different fact — it is what
 * the instrument is called by the people who own it, and dropping it from the
 * form a clinician is filling in is an attribution decision this component is
 * not the place to make. It stays; it just stops being the largest text on the
 * screen.
 */

interface InstrumentHeaderProps {
  /** `Questionnaire.title` — the instrument's formal name. */
  name?: unknown
  /** `Questionnaire.description`. */
  description?: unknown
}

/** Only render what is really a non-empty string; these come off `[k: string]: unknown`. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function InstrumentHeader({ name, description }: InstrumentHeaderProps) {
  const formalName = text(name)
  const about = text(description)
  if (!formalName && !about) return null

  return (
    <div className="instrument-header">
      {formalName && <p className="instrument-header__name">{formalName}</p>}
      {about && (
        <details className="instrument-header__about">
          <summary>About this instrument</summary>
          <p>{about}</p>
        </details>
      )}
    </div>
  )
}
