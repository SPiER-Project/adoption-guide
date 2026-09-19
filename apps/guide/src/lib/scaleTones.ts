import type { PillTone } from '@spier/ui/Pill'

/**
 * The soft risk ramp indexed 0 (worst) → 3 (best): the tone for a 4-step
 * scale that is NOT a risk level — a maturity score, a rubric level. Lives
 * beside the other status→visual maps rather than in Pill.tsx so that file
 * exports only a component (react-refresh).
 */
export const SCALE_TONES: readonly PillTone[] = ['soft-acute', 'soft-high', 'soft-moderate', 'soft-low']
