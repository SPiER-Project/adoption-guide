/**
 * Generate a unique id. `crypto.randomUUID()` is only available in secure
 * contexts (HTTPS / localhost); fall back to a timestamp+random id for
 * plain-HTTP demo deployments and test environments so callers never crash.
 */
export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
