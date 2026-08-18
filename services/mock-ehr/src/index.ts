/**
 * SPiER mock EHR — Worker entry point.
 *
 * Its own Worker and therefore its own origin (`spier-mock-ehr.*.workers.dev`),
 * separate from the Worker that serves the app and the CDS Hooks API. The
 * embedded SMART panel must be launched cross-origin, so the two hosts cannot
 * be the same one (docs/plans/embedded-panel-smart-launch.md §6).
 *
 * See docs/plans/mock-ehr-read-api.md for what this is and is not.
 */
import app from './app'

export default app
