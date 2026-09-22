/**
 * *What’s on file* — the one list, rendered.
 *
 * The grouping, the row resolution and the argument for both are
 * `lib/onFileGroups.ts`; what is here is the markup and nothing else.
 *
 * ⚠️ **A row's name is a LINK since 2026-09-22**, to the record it names. The
 * list said what was recorded, how it stood and when, and a clinician wanting
 * the answers behind it had nowhere to go — see `pages/PatientRecord.tsx` for
 * why that became a page rather than a row that expands. A row whose artifact
 * carries no id has no address, so it stays plain text rather than becoming a
 * link to the list it is already on.
 */
import { Link } from 'react-router-dom'
import { formatDate } from '@spier/tool-views/lib/dates'
import { Card } from '@spier/ui/Card'
import { EmptyState } from '@spier/ui/EmptyState'
import { Pill } from '@spier/ui/Pill'
import type { OnFileGroup } from '../lib/onFileGroups'
import '../css/OnFile.css'

export function OnFileList({ groups }: { groups: OnFileGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState>Nothing has been recorded for this patient yet.</EmptyState>
  }
  return (
    <div className="on-file">
      {groups.map(group => (
        <Card as="section" key={group.key} padding="compact" className="on-file__group">
          <header className="on-file__group-head">
            <h3 className="on-file__group-title">{group.title}</h3>
            {group.state && <Pill size="sm" tone={group.state === 'Open' ? 'brand' : 'neutral'}>{group.state}</Pill>}
          </header>
          {group.when && (
            <p className="on-file__group-when">Opened {formatDate(group.when)}</p>
          )}
          {group.rows.length === 0 ? (
            <EmptyState>Nothing recorded in this episode.</EmptyState>
          ) : (
            <ul className="on-file__rows">
              {group.rows.map(row => (
                <li className="on-file__row" key={row.key}>
                  <span className="on-file__name">
                    {row.href ? <Link to={row.href}>{row.name}</Link> : row.name}
                  </span>
                  <span className="on-file__meta">
                    {row.instrument && <span className="on-file__instrument">{row.instrument}</span>}
                    <span className="on-file__when">
                      {row.when ? formatDate(row.when) : 'No date recorded'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  )
}
