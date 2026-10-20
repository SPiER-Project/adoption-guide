import { DEVELOPMENT_NOTICE } from '@spier/core/lib/developmentNotice'
import '../css/DevelopmentBanner.css'

/**
 * The under-development strip above the app bar, in both apps' standalone
 * chrome (`AppShell` in the guide, `LaunchShell` in the clinical app). It is the
 * shell grid's `notice` row, so it is always in view and pushes nothing under
 * the fold. The words live in core, shared with the mock EHR and the IG — see
 * `developmentNotice.ts`, including why the framed panel has none.
 */
export function DevelopmentBanner() {
  return (
    <div className="development-banner" role="note">
      <strong>{DEVELOPMENT_NOTICE.title}</strong> {DEVELOPMENT_NOTICE.body}
    </div>
  )
}
