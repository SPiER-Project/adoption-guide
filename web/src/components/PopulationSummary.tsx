/**
 * Zone 1 of the Population view: the executive-summary tiles and the risk-tier
 * census bar (deck panels 1–2, issue #278).
 *
 * ⚠️ **This is a management artifact sitting on top of a triage artifact.** The
 * caseload table below it is what someone uses to decide who to call next, and
 * a strip of tiles tall enough to push the first patient row below the fold
 * would trade the page's actual job for a summary. Hence: one wrapping row of
 * compact tiles, and a collapse toggle. If this grows, shrink it.
 */
import { useState } from 'react'
import type { SummaryTile, TierCensusEntry } from '../lib/populationSummary'

function Tile({ tile }: { tile: Extract<SummaryTile, { state: 'value' }> }) {
  return (
    <div className={`pop-tile ${tile.breached ? 'pop-tile--breached' : ''}`}>
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
  const [open, setOpen] = useState(true)
  const computable = tiles.filter((t): t is Extract<SummaryTile, { state: 'value' }> => t.state === 'value')
  const blocked = tiles.filter((t): t is Extract<SummaryTile, { state: 'blocked' }> => t.state === 'blocked')

  return (
    <section className="pop-summary" aria-label="Caseload summary">
      <div className="pop-summary-head">
        <h3 className="pop-summary-title">Summary</h3>
        <button
          type="button"
          className="pop-summary-toggle"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
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
        </>
      )}
    </section>
  )
}

function censusLabel(census: TierCensusEntry[], total: number): string {
  const parts = census.map(c => `${c.label} ${c.count}`).join(', ')
  return `Risk tier census of ${total} patients: ${parts}`
}
