import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { STAGES } from '@spier/core/data/catalog/stages'
import {
  OVERVIEW_EYEBROW,
  OVERVIEW_LEDE,
  OVERVIEW_LENSES,
  OVERVIEW_SECTIONS,
  OVERVIEW_STEPS,
  OVERVIEW_TITLE,
  type OverviewBlock,
} from '../content/overview'
import { IG_HREF, IG_TOKEN, renderInline } from '../content/renderInline'
import '../css/Overview.css'

function StepCards() {
  return (
    <ol className="overview__steps">
      {OVERVIEW_STEPS.map((step, i) => (
        <li key={step.key} className="overview__step-card">
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

// The eight stages come from the pathway-stage CodeSystem via the catalog, so
// the page cannot drift from the published artifact.
function PathwayStages() {
  return (
    <ol className="overview__pathway">
      {STAGES.map(stage => (
        <li key={stage.id} className="overview__pathway-stage">
          <span className="overview__pathway-index">{stage.orderIndex + 1}</span>
          <span className="overview__pathway-title">{stage.title}</span>
        </li>
      ))}
    </ol>
  )
}

function LensCards() {
  return (
    <div className="overview__lens-grid">
      {OVERVIEW_LENSES.map(lens => {
        const className = `overview__lens-card overview__lens-card--${lens.variant}`
        const inner = (
          <>
            <span className="overview__lens-badge">{lens.badge}</span>
            <h4>{lens.title}</h4>
            <p>{lens.body}</p>
            <span className="overview__lens-cta">{lens.cta}</span>
          </>
        )
        return lens.href === IG_TOKEN ? (
          <a
            key={lens.key}
            href={IG_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
            {inner}
          </a>
        ) : (
          <Link key={lens.key} to={lens.href} className={className}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}

function Block({ block }: { block: OverviewBlock }) {
  switch (block.kind) {
    case 'lead':
      return <p className="overview__lead">{renderInline(block.text)}</p>
    case 'note':
      return <p className="overview__note">{renderInline(block.text)}</p>
    case 'prose':
      return <p>{renderInline(block.text)}</p>
    case 'vignette':
      return (
        <div className="overview__vignette">
          <h4>{block.heading}</h4>
          <p>{renderInline(block.text)}</p>
        </div>
      )
    case 'steps':
      return <StepCards />
    case 'pathway':
      return <PathwayStages />
    case 'lenses':
      return <LensCards />
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
