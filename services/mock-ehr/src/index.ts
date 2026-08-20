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

/**
 * Every Durable Object class has to be exported from the Worker's entry point —
 * that is how the runtime resolves `class_name` in the `durable_objects`
 * bindings. Miss one and the deploy fails with "Durable Object class not found",
 * which is at least loud; a rename that updates only one side is the quiet
 * version.
 *
 * `DemoStore` holds written resources and the capability profile (step 4);
 * `FhircastHub` holds live WebSocket subscriptions (step 6).
 */
export { DemoStore } from './demoStore'
export { FhircastHub } from './fhircastHub'

export default app
