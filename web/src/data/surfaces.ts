/**
 * Where SPiER's other surfaces live.
 *
 * The mock EHR's origin was typed as a literal in `Sidebar.tsx` and is now
 * needed by the two pages that explain the apps it launches
 * (`user-scoped-smart-launch.md` Phase 0). Three hand-typed copies of a
 * `workers.dev` hostname is the shape this repo keeps writing gates against, so
 * it gets one home before the third one is written rather than after.
 *
 * ⚠️ **"Mock" is load-bearing in the label, not modesty.** That host is
 * controlled by the same project it demonstrates, so nothing observed there is
 * evidence of interoperability — the panel plan's guardrail 3. A label reading
 * "EHR demo" would quietly drop the part that keeps the claim honest, which is
 * why the string is here rather than composed at each call site.
 */
export const MOCK_EHR_URL = 'https://spier-mock-ehr.bbthorson.workers.dev/'

export const MOCK_EHR_LABEL = 'Mock EHR demo'

/**
 * The three charts the demo opens with, and why — kept in the same order and
 * for the same reasons as `services/mock-ehr/src/demoStories.ts`'s
 * `TRY_IT_ORDER`, which is what the host page itself renders.
 *
 * ⚠️ Restated here rather than imported: `services/mock-ehr` is a separate
 * Worker package that imports *from* the app, never the other way round, and
 * inverting that for three display strings would pull the mock's fixtures into
 * the guide's bundle — which is precisely what this phase's sibling work is
 * removing. If the host's picks change, these are prose about them and can lag
 * by a release without misleading anyone: each says what the chart shows, not
 * what the host currently lists.
 */
export const DEMO_CHART_PICKS = [
  {
    name: 'Marcus Chen',
    situation: 'Nothing on file',
    shows: 'the whole PHQ-9 → C-SSRS handoff from zero, and the write landing',
  },
  {
    name: 'Sarah Patel',
    situation: 'PHQ-9 item 9 endorsed, risk not yet clarified',
    shows: 'a patient one step in, with the C-SSRS Screener owed',
  },
  {
    name: 'Maria Alvarez',
    situation: 'A complete ED episode',
    shows: 'what a finished pathway looks like',
  },
] as const
