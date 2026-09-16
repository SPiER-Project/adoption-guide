/**
 * The three small cells the data dictionary writes a coding with: the code
 * as a link to its authority, the system by its short label, and the
 * bindable ValueSet a coded value is drawn from. Used by both the stage rows
 * (BindingRow, in the page) and the concept layer (SharedConcepts).
 */
import { codeHref, systemLabel, valueSetHref, valueSetLabel, type Coding } from '@spier/core/data/catalog'
import '../css/DictionaryCodeCells.css'

export function CodeLink({ coding }: { coding: Coding }) {
  const href = codeHref(coding.system, coding.code)
  if (!href) return <>{coding.code}</>
  const external = href.startsWith('http')
  return (
    <a
      className="dd-code-link"
      href={href}
      title={`${coding.system}#${coding.code}`}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {coding.code}
    </a>
  )
}

/**
 * A system, shown by its short label with the full URL on hover. `note`
 * distinguishes the value-side vocabulary from the code — the two used to
 * compete for one column, which is the defect #260 set out to fix.
 */
export function SystemCell({ system, note }: { system: string; note?: string }) {
  return (
    <span className="dd-system" title={system}>
      {systemLabel(system)}
      {note && <span className="dd-system-note">{note}</span>}
    </span>
  )
}

/**
 * The bindable ValueSet a coded value is drawn from (#281).
 *
 * A system says which vocabulary the codes come from; the ValueSet says which
 * subset of it is *allowed here*, which is the question an implementer building a
 * picker actually has. 18 of the 24 value blocks name one and none of them
 * reached the page before this.
 *
 * SPiER-local canonicals resolve inside our own published IG, so — like a
 * SPiER-local code — this opens in the same tab. `check:catalog` proves the
 * target exists, so an absent link means "no ValueSet named", never a broken one.
 */
export function ValueSetLine({ canonical }: { canonical: string }) {
  const href = valueSetHref(canonical)
  const label = valueSetLabel(canonical)
  return (
    <span className="dd-valueset">
      <span className="dd-valueset-label">bindable set</span>
      {href ? (
        <a className="dd-code-link" href={href} title={canonical}>{label}</a>
      ) : (
        <span title={canonical}>{label}</span>
      )}
    </span>
  )
}
