/**
 * The one button: the 2026 website's plum pill with a trailing arrow.
 *
 * The eighth surface owner (after SectionHeader, Card, Pill, Notice,
 * EmptyState, DataTable and WorkflowForm), and the last look a page used to
 * draw for itself. Before this existed the same control was written five
 * ways — `.workflow-submit-btn` (13 sites, radius-md), `.submit-result-action-btn`
 * (radius-md, a different padding), `.tool-detail-launch-btn` (radius-md, a
 * third padding, its own secondary), `.surface-guide__cta` (the only pill), and
 * the formbox renderer's submit through a hashed-class override — with three
 * radii, four paddings and two hover recipes. The decisions, made once:
 *
 *   shape    inline-flex pill (`--radius-pill`), `--space-2 --space-5`, the
 *            display face at 600, `--type-ui`; `sm` steps to `--space-1-5
 *            --space-4` for a control inside a list row (same type since the
 *            type roles: 13px and 14px were one step, 1px apart).
 *   variant  `primary` — plum fill, white label (the website's CTA).
 *            `secondary` — plum hairline, plum label, peach-soft on hover.
 *            `link` — no box; `--brand-link` text for the quiet exit beside a
 *            primary ("View in chart").
 *   accent   the website's signature: the label set in the brand gradient
 *            (`--gradient-brand` clipped to the text) on the plum fill. For the
 *            one action a page most wants taken, never for every button — a
 *            row of gradients is a row of nothing.
 *   arrow    a trailing → that nudges right on hover. The website puts one on
 *            every CTA; here it marks a button that NAVIGATES (a Link, an
 *            href, a "go and do") as opposed to one that records in place.
 *
 * Renders a `<Link>` when given `to`, an `<a>` when given `href`, otherwise a
 * `<button>`. A page may pass `className` for LAYOUT — `align-self`, a margin
 * in a flex row — never for what the button looks like.
 *
 * ⚠️ The formbox renderer's own submit button cannot become this component
 * (vendor DOM). Its override in `App.css` copies these decisions by token; if
 * a decision here moves, move it there too.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cx } from './cx'
import './Button.css'

type Variant = 'primary' | 'secondary' | 'link'
type Size = 'md' | 'sm'

interface CommonProps {
  variant?: Variant
  size?: Size
  /** Gradient-text label — the website's signature, for a page's ONE lead action. */
  accent?: boolean
  /** Trailing arrow, for a button that navigates. */
  arrow?: boolean
  /** Layout only — see the header. */
  className?: string
  'aria-label'?: string
  children: ReactNode
}

interface LinkProps extends CommonProps {
  /** An in-app route. */
  to: string
  href?: never
  onClick?: never
  type?: never
  disabled?: never
  target?: never
  rel?: never
}

interface AnchorProps extends CommonProps {
  /** An absolute URL on another origin. */
  href: string
  to?: never
  onClick?: never
  type?: never
  disabled?: never
  target?: '_blank'
  rel?: string
}

interface NativeProps extends CommonProps {
  to?: never
  href?: never
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type']
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  disabled?: boolean
  target?: never
  rel?: never
}

export type ButtonProps = LinkProps | AnchorProps | NativeProps

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', accent, arrow, className, children } = props
  const ariaLabel = props['aria-label']
  const classes = cx(
    'button',
    `button--${variant}`,
    size === 'sm' && 'button--sm',
    accent && 'button--accent',
    className,
  )
  const inner = (
    <>
      <span className="button__label">{children}</span>
      {arrow && <ArrowRight aria-hidden="true" size={size === 'sm' ? 14 : 16} className="button__arrow" />}
    </>
  )

  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={classes} aria-label={ariaLabel}>
        {inner}
      </Link>
    )
  }
  if (props.href !== undefined) {
    return (
      <a href={props.href} target={props.target} rel={props.rel} className={classes} aria-label={ariaLabel}>
        {inner}
      </a>
    )
  }
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      className={classes}
      aria-label={ariaLabel}
    >
      {inner}
    </button>
  )
}
