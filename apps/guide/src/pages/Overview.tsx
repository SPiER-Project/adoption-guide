import { PageHeader } from '@spier/ui/PageHeader'
import { Button } from '@spier/ui/Button'
import { Notice } from '@spier/ui/Notice'
import {
  OVERVIEW_DOORS,
  OVERVIEW_EYEBROW,
  OVERVIEW_LEDE,
  OVERVIEW_SECTIONS,
  OVERVIEW_STEPS,
  OVERVIEW_TITLE,
  type OverviewBlock,
} from '../content/overview'
import { DEMO_CHART_PICKS, MOCK_EHR_LABEL, MOCK_EHR_URL } from '../data/surfaces'
import { renderInline } from '../content/renderInline'
import '../css/Overview.css'

function StepCards() {
  return (
    <ol className="overview__steps">
      {OVERVIEW_STEPS.map((step, i) => (
        <li key={step.key} className="overview__step-card">
          <span className={`overview__step-tile overview__step-tile--${step.key}`} aria-hidden="true">
            {i + 1}
          </span>
          <span className="overview__step-index">Step {i + 1}</span>
          <h4 className="overview__step-name">{step.name}</h4>
          <p className="overview__step-body">
            {step.lead} {step.body}
          </p>
        </li>
      ))}
    </ol>
  )
}

/**
 * The page's one call to action, and the three charts to open behind it.
 *
 * Both the label and the destination come from `data/surfaces.ts`, so the
 * button cannot come to name a surface the sidebar calls something else. The
 * charts are `DEMO_CHART_PICKS` for the same reason: the host offers the same
 * three in the same order, and that file says why they are restated as prose
 * there rather than imported from the mock EHR's package.
 *
 * Same divided-cell furniture as the step cards below — three columns split by
 * hairlines on the section's own ground — because this page has two three-up
 * rows and inventing a second look for the second one is how a page starts
 * carrying two design systems.
 */
function DemoPicks() {
  return (
    <>
      <Button
        href={MOCK_EHR_URL}
        target="_blank"
        rel="noopener noreferrer"
        accent
        arrow
        className="overview__cta"
        aria-label={`Open the ${MOCK_EHR_LABEL} (opens in a new tab)`}
      >
        Open the {MOCK_EHR_LABEL}
      </Button>
      <ul className="overview__picks">
        {DEMO_CHART_PICKS.map(pick => (
          <li key={pick.name} className="overview__pick">
            <h4 className="overview__pick-name">{pick.name}</h4>
            <p className="overview__pick-situation">{pick.situation}</p>
            <p className="overview__pick-shows">Shows {pick.shows}.</p>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * Three readers, three first destinations — see OVERVIEW_DOORS for why this
 * replaced a row of cards naming the four surfaces.
 *
 * A description list, because that is what it is: each reader is the term and
 * their route is the definition. It gives the reader line real markup rather
 * than a bolded paragraph, so a screen reader announces the pairing.
 */
function DoorList() {
  return (
    <dl className="overview__doors">
      {OVERVIEW_DOORS.map(door => (
        <div key={door.key} className="overview__door">
          <dt className="overview__door-reader">{door.reader}</dt>
          <dd className="overview__door-text">{renderInline(door.text)}</dd>
        </div>
      ))}
    </dl>
  )
}

function Block({ block }: { block: OverviewBlock }) {
  switch (block.kind) {
    case 'lead':
      return <p className="overview__lead">{renderInline(block.text)}</p>
    case 'note':
      // ⚠️ `neutral`, and the tone is the point of the block. The audit found
      // the interoperability caveat set at the same weight as the instruction
      // it followed, on four pages (§3, §5 rule 2). A note here is a caveat or
      // a pointer onward — both are quieter than what they follow, so neither
      // gets a tinted panel competing with the call to action above it.
      return <Notice tone="neutral">{renderInline(block.text)}</Notice>
    case 'demo':
      return <DemoPicks />
    case 'doors':
      return <DoorList />
    case 'steps':
      return <StepCards />
  }
}

export function Overview() {
  return (
    <div className="overview">
      <PageHeader
        eyebrow={OVERVIEW_EYEBROW}
        title={OVERVIEW_TITLE}
        lede={<>{renderInline(OVERVIEW_LEDE)}</>}
      />

      {OVERVIEW_SECTIONS.map(section => (
        <section
          key={section.id}
          className={
            section.modifier
              ? `overview__section overview__section--${section.modifier}`
              : 'overview__section'
          }
        >
          <h3 className="overview__h3">{renderInline(section.heading)}</h3>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </div>
  )
}
