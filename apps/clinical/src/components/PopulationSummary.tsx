/**
 * Zone 1 of the Population view: the executive-summary tiles and the risk-tier
 * census bar (deck panels 1–2, issue #278).
 *
 * ⚠️ **This is a management artifact sitting BESIDE a triage artifact, and it
 * is no longer on top of one.** "If this grows, shrink it" is what this comment
 * used to say, and it grew: seven tiles, a census bar and a blocked-metrics
 * line put the first patient row at 1,104px on a laptop and 1,419px on a phone
 * (clinical-app audit §1.11, re-measured in §8.2). It renders BELOW the table
 * now, and the collapse rule is the second half: a phone opens it collapsed to
 * the tiles that are actually breached, because on a phone this is the third
 * screen of a page whose job is on the first.
 */
import { useState } from 'react'
import { useNarrowViewport } from '../hooks/useNarrowViewport'
import type { SummaryTile, TierCensusEntry } from '../lib/populationSummary'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { cx } from '@spier/ui/cx'
import { Card } from '@spier/ui/Card'

function Tile({ tile }: { tile: Extract<SummaryTile, { state: 'value' }> }) {
  return (
    <div className={cx('pop-tile', tile.breached && 'pop-tile--breached')}>
      <div className="pop-tile-label">{tile.label}</div>
      <div className="pop-tile-value">{tile.value}</div>
      <div className="pop-tile-foot">
        {tile.goal && <span className="pop-tile-goal">Goal {tile.goal}</span>}
      </div>
    </div>
  )
}

export function PopulationSummary({
  tiles,
  census,
  total,
}: {
  tiles: SummaryTile[]
  census: TierCensusEntry[]
  total: number
}) {
  const narrow = useNarrowViewport()
  // ⚠️ The initial value is read ONCE, from the width the page opened at, and
  // is then the reader's to change. Re-deriving it on every resize would
  // re-close a summary someone had opened, which is the shape of bug that makes
  // a control feel broken.
  const [open, setOpen] = useState(() => !narrow)
  const computable = tiles.filter((t): t is Extract<SummaryTile, { state: 'value' }> => t.state === 'value')
  const blocked = tiles.filter((t): t is Extract<SummaryTile, { state: 'blocked' }> => t.state === 'blocked')
  // Collapsed does not mean empty. A caseload with five high-risk patients
  // against a goal of under 5% is the one thing in here worth a phone's first
  // glance, so the breached tiles survive the collapse and everything else
  // waits behind the toggle. Nothing breached collapses to nothing, which is
  // the honest reading of "no tile is over its goal".
  const breached = computable.filter(t => t.breached)

  return (
    <Card as="section" padding="compact" tone="wash" className="pop-summary" aria-label="Caseload summary">
      <SectionHeader
        title="Summary"
        meta={open || breached.length === 0 ? undefined : `${breached.length} over goal`}
        collapsible={{ open, onToggle: () => setOpen(o => !o), controls: 'pop-summary-body' }}
      />

      {!open && breached.length > 0 && (
        <div className="pop-tiles pop-tiles--breached-only">
          {breached.map(t => (
            <Tile key={t.id} tile={t} />
          ))}
        </div>
      )}

      {open && (
        <div id="pop-summary-body">
          <div className="pop-tiles">
            {computable.map(t => (
              <Tile key={t.id} tile={t} />
            ))}
          </div>

          {/* The census reads from the same counts the Risk column filter uses,
              passed in rather than recomputed — so the bar and the filter menu
              cannot disagree about how many high-risk patients there are. */}
          {census.length > 0 && (
            <div className="pop-census">
              <div className="pop-census-bar" role="img" aria-label={censusLabel(census, total)}>
                {census.map(c => (
                  <span
                    key={c.level}
                    className={`pop-census-seg pop-census-seg--${c.level}`}
                    style={{ flexGrow: c.count }}
                  />
                ))}
              </div>
              <ul className="pop-census-key">
                {census.map(c => (
                  <li key={c.level} className="pop-census-key-item">
                    <span
                      className={`pop-census-dot pop-census-seg--${c.level}`}
                      aria-hidden="true"
                    />
                    {c.label} <strong>{c.count}</strong>{' '}
                    <span className="pop-census-share">{Math.round(c.share * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The blocked tiles are NAMED rather than rendered as four identical
              dashes. Four full-size tiles reading "—" cost a whole grid row and
              said less than this line does: the reader learns which metrics are
              missing, and each name carries what it is waiting on. Still never a
              zero — a zero here would read as an all-clear SPiER has no data for. */}
          {blocked.length > 0 && (
            <p className="pop-summary-note">
              <span className="pop-summary-note-lead">Not yet measurable:</span>{' '}
              {blocked.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && ' · '}
                  <abbr className="pop-summary-blocked" title={t.waitingOn}>
                    {t.label}
                  </abbr>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function censusLabel(census: TierCensusEntry[], total: number): string {
  const parts = census.map(c => `${c.label} ${c.count}`).join(', ')
  return `Risk tier census of ${total} patients: ${parts}`
}
