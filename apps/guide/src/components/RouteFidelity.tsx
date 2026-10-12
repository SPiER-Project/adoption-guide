import { routePrecision, tierRoute, type RoutePrecision } from '@spier/core/lib/conceptCrosswalk'
import { conceptMapHref, type Binding } from '@spier/core/data/catalog'
import { Disclosure } from '@spier/ui/Disclosure'
import { Pill, type PillTone } from '@spier/ui/Pill'

/**
 * How far a route into a shared concept can be trusted, on two axes (#264).
 *
 * **Precision** comes from the published crosswalk: its rows' equivalences,
 * summarized by the lossiest one, and the inexact rows named in a closed
 * drawer — the row that is inexact is the thing a reader has to know before
 * acting on a tier. **Status** is the crosswalk's own: a draft map is a
 * proposal still waiting on clinical sign-off, and says so for as long as the
 * IG does. **Who asserts it** is the binding's `assertedBy`, because no
 * ConceptMap can say whether it is translating a clinician's determination or
 * the patient's own rating.
 *
 * ⚠️ None of the three is written on this page. A crosswalk signed off in FSH
 * loses its marker here with no edit to this file, and a route nothing
 * translates renders as untranslated rather than borrowing a neighbour's word.
 */

const PRECISION: Record<RoutePrecision, { label: string; tone: PillTone; title: string }> = {
  native: { label: 'Native', tone: 'sky', title: 'The value is already a tier; nothing translates it.' },
  exact: { label: 'Exact', tone: 'sage', title: 'Every value translates to a tier that means the same thing.' },
  approximate: {
    label: 'Approximate',
    tone: 'peach',
    title: 'Some values translate to a neighbouring tier, not an equivalent one.',
  },
  widened: {
    label: 'Widened',
    tone: 'peach',
    title: 'Some values land on a broader tier, so detail the instrument had is lost.',
  },
}

const ASSERTED_BY: Record<NonNullable<Binding['assertedBy']>, string> = {
  clinician: 'Clinician’s determination',
  patient: 'Patient’s self-rating',
  carried: 'Restates the latest route',
}

const EQUIVALENCE_WORD: Record<string, string> = {
  relatedto: 'related to',
  wider: 'widened to',
  subsumes: 'widened to',
  narrower: 'narrowed to',
  specializes: 'narrowed to',
  inexact: 'roughly',
}

export function RouteFidelity({ binding }: { binding: Binding }) {
  const route = tierRoute(binding.value?.system)
  if (!route) return <span className="dd-fidelity-none">Not translated</span>
  const { precision, inexact } = routePrecision(route)
  const shown = PRECISION[precision]
  const mapHref = route.kind === 'crosswalk' ? conceptMapHref(route.url) : undefined
  return (
    <div className="dd-fidelity">
      <span className="dd-fidelity-pills">
        <Pill variant="label" tone={shown.tone} title={shown.title}>{shown.label}</Pill>
        {route.kind === 'crosswalk' && route.draft && (
          <Pill tone="warning" size="sm" title="This translation is proposed and awaiting clinical sign-off.">
            Proposed
          </Pill>
        )}
      </span>
      {binding.assertedBy && <span className="dd-fidelity-who">{ASSERTED_BY[binding.assertedBy]}</span>}
      {route.kind === 'crosswalk' && inexact.length > 0 && (
        <Disclosure variant="quiet" summary={`${inexact.length} of ${route.rows.length} not exact`}>
          {/*
            ⚠️ The pairs only, with each row's reasoning on hover and in full on
            the crosswalk's own page. Printed in the cell, the five CAMS comments
            stood 40 lines tall in a column a fifth of the table wide.
          */}
          <ul className="dd-fidelity-rows">
            {inexact.map(row => (
              <li key={`${row.source.code}-${row.target.code}`} title={row.comment}>
                <strong>{row.source.display ?? row.source.code}</strong>{' '}
                {EQUIVALENCE_WORD[row.equivalence] ?? row.equivalence}{' '}
                <strong>{row.target.display ?? row.target.code}</strong>
              </li>
            ))}
          </ul>
          {mapHref && (
            <a className="dd-code-link dd-fidelity-map" href={mapHref} title={route.url}>
              Why, row by row
            </a>
          )}
        </Disclosure>
      )}
    </div>
  )
}
