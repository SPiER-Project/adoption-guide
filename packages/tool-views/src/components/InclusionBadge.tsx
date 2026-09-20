import { Pill, type PillTone } from '@spier/ui/Pill'
import { INCLUSION_ICON, type InclusionStatus } from '../lib/statusIcons'

/**
 * A tool's inclusion status (`core` / `optional` / `future`) as a small pill,
 * icon included — the same mark on the guide's Adoption Readiness table and the
 * clinical app's Tool Configuration page.
 *
 * It was two components. The guide's was this `Pill`; the clinical one was a
 * bare `<span>` with three page-owned `.tool-row-status--*` rules that
 * re-declared a pill's padding, radius, type and colour — the exact drift the
 * "eight components own the surfaces" rule exists to stop. One definition now,
 * so the two pages cannot disagree about what `future` looks like.
 */
const INCLUSION_TONE: Record<InclusionStatus, PillTone> = { core: 'info', optional: 'neutral', future: 'warning' }

export function InclusionBadge({ status, className }: { status: InclusionStatus; className?: string }) {
  return (
    <Pill size="sm" tone={INCLUSION_TONE[status]} icon={INCLUSION_ICON[status]} className={className}>
      {status}
    </Pill>
  )
}
