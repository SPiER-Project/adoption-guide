/**
 * writeback — public surface of the SMART Form-Filler writeback ladder.
 * See ./types.ts for the tier model and docs/plans/smart-filler-writeback-ladder.md.
 */
export * from './types'
export { parseCapabilityStatement, canCreate, fetchCapabilities } from './capability'
export { buildDocumentReference, renderQrNarrative, base64Utf8 } from './documentReference'
export { buildConditionProposal, riskAlertLevelToTier, SPIER_RISK_TIER_SYSTEM } from './conditionProposal'
export { buildWritePlan, resolveConfig } from './ladder'
export { executeWritePlan } from './execute'
