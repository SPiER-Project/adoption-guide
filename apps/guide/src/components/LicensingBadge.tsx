import type { Licensing } from '@spier/core/data/catalog'
import { LICENSING_ICON } from '@spier/tool-views/lib/statusIcons'
import { Pill } from '@spier/ui/Pill'
import { LICENSING_LABELS } from '../data/licensing'
import '../css/LicensingBadge.css'

/**
 * A tool's licensing status as a pill — the same mark on Adoption Readiness
 * and on every tool page. The words are `data/licensing.ts`; the colour rules
 * are page-owned in the sense the `Pill` header allows: five statuses, one of
 * them a caution, as a `className` modifier and never a shape.
 */
export function LicensingBadge({ licensing, title }: { licensing: Licensing; title?: string }) {
  return (
    <Pill size="sm" variant="label" className={`licensing-badge--${licensing}`} icon={LICENSING_ICON[licensing]} title={title}>
      {LICENSING_LABELS[licensing]}
    </Pill>
  )
}
