/**
 * writeback — public surface of the SMART Form-Filler writeback ladder.
 * See ./types.ts for the tier model and docs/plans/smart-filler-writeback-ladder.md.
 */
export * from '@spier/core/lib/writeback/types'
export { parseCapabilityStatement, canCreate, fetchCapabilities } from '@spier/core/lib/writeback/capability'
export { buildDocumentReference, renderQrNarrative, base64Utf8 } from '@spier/core/lib/writeback/documentReference'
export { buildWritePlan, resolveConfig } from '@spier/core/lib/writeback/ladder'
export { executeWritePlan } from '@spier/core/lib/writeback/execute'
