/**
 * Icon lookups for the app's badge/pill families. One map per semantic
 * domain, keyed by the same string unions the catalog and mappers already
 * use, so a badge's icon can never drift from its color+label — all three
 * are chosen from the same key.
 *
 * Colored via CSS `color` (lucide icons default to `stroke="currentColor"`,
 * `fill="none"`), never via a `fill` declaration — that keeps every icon
 * inheriting whatever token-driven `color` the surrounding pill already sets.
 */
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  Circle,
  HelpCircle,
  Bell,
  Star,
  Clock,
  Unlock,
  ClipboardCheck,
  CreditCard,
  Sparkles,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'

export type RiskLevel = 'acute' | 'high' | 'moderate' | 'low' | 'none' | 'unknown'

export const RISK_ICON: Record<RiskLevel, LucideIcon> = {
  acute: AlertOctagon,
  high: AlertTriangle,
  moderate: AlertCircle,
  low: Info,
  none: Circle,
  unknown: HelpCircle,
}

export type CdsIndicator = 'critical' | 'warning' | 'info'

export const CDS_INDICATOR_ICON: Record<CdsIndicator, LucideIcon> = {
  critical: AlertTriangle,
  warning: Bell,
  info: Info,
}

export type InclusionStatus = 'core' | 'optional' | 'future'

export const INCLUSION_ICON: Record<InclusionStatus, LucideIcon> = {
  core: Star,
  optional: Circle,
  future: Clock,
}

export type Licensing = 'public-domain' | 'registration' | 'commercial' | 'spier-authored' | 'unknown'

export const LICENSING_ICON: Record<Licensing, LucideIcon> = {
  'public-domain': Unlock,
  registration: ClipboardCheck,
  commercial: CreditCard,
  'spier-authored': Sparkles,
  unknown: HelpCircle,
}

export type ReadinessTier = 'built' | 'in-progress'

export const READINESS_TIER_ICON: Record<ReadinessTier, LucideIcon> = {
  built: CheckCircle2,
  'in-progress': Clock,
}
