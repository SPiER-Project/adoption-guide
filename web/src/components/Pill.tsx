/**
 * The one small inline marker: a status ("ACTIVE", "DO NOW", a risk level), a
 * count, or a label chip (a tool name, a FHIR resource type, a code).
 *
 * Before this existed the same object was drawn ~40 times with 12 paddings,
 * 7 radii (four of them a literal `20px`), 8 font sizes and two weights
 * (maintainability audit 2026-09-15, §2.4). The decisions, made once:
 *
 *   shape    inline-flex, `--radius-pill`, `--space-0-5 --space-2`, an icon
 *            leads the text at `--gap-inline`
 *   size     `md` (default, `--font-size-xs`) or `sm` (`--font-size-2xs`,
 *            for table cells and dense lists)
 *   variant  `status` (default): uppercase, tracked, 700 — a state word.
 *            `label`: sentence case, 600 — a name or a code.
 *   tone     the app's accent families, the three brand tints (`peach`,
 *            `sage`, `sky` — the website's category tags, plum on a soft
 *            tint), plus the risk ramp in its solid form (`acute`…`unknown`,
 *            what RiskPill renders) and its soft form (`soft-acute`…
 *            `soft-low`, for anything scored on a 4-step scale that is NOT a
 *            risk level — maturity, rubric levels, "done").
 *
 * A page that owns a genuine domain palette — the colour of each FHIR
 * resource type in the data dictionary, each licensing status, each CDS
 * indicator, each pathway node state — keeps ONLY the colour rules, as a
 * `className` modifier passed in here. The shape is never redeclared.
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../lib/cx'
import '../css/Pill.css'

export type PillTone =
  | 'neutral' | 'brand' | 'accent' | 'info' | 'success' | 'warning'
  | 'peach' | 'sage' | 'sky'
  | 'acute' | 'high' | 'moderate' | 'low' | 'none' | 'unknown'
  | 'soft-acute' | 'soft-high' | 'soft-moderate' | 'soft-low'

export function Pill({
  tone = 'neutral',
  size = 'md',
  variant = 'status',
  icon: Icon,
  className,
  title,
  'aria-label': ariaLabel,
  children,
}: {
  tone?: PillTone
  size?: 'sm' | 'md'
  variant?: 'status' | 'label'
  icon?: LucideIcon
  /** A page-owned COLOUR modifier only — never a shape. */
  className?: string
  title?: string
  'aria-label'?: string
  children: ReactNode
}) {
  return (
    <span
      className={cx('pill', `pill--${tone}`, size === 'sm' && 'pill--sm', variant === 'label' && 'pill--label', className)}
      title={title}
      aria-label={ariaLabel}
    >
      {Icon && <Icon aria-hidden="true" size={size === 'sm' ? 11 : 12} className="pill__icon" />}
      {children}
    </span>
  )
}
