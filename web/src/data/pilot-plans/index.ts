// Vite's `?raw` suffix loads the file as a string at build time.
import asqPlan from './asq.md?raw'

export const PILOT_PLANS: Record<string, string> = {
  asq: asqPlan,
}

export const pilotPlanBySlug = (slug: string): string | undefined => PILOT_PLANS[slug]
