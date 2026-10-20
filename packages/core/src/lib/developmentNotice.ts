/**
 * The under-development notice every hosted SPiER surface carries: the guide,
 * the standalone clinical apps, the mock EHR's pages and the rendered IG.
 *
 * ONE copy of the words, because four surfaces render it and three of them
 * cannot share a component: the two apps render `DevelopmentBanner`
 * (`packages/app-shell`), the mock EHR renders it server-side in its own chrome
 * (`services/mock-ehr/src/hostChrome.ts`), and the guide Worker writes it into
 * each IG page as it serves it (`services/guide/src/igNotice.ts`). A copy typed
 * into any of them would drift the first time the wording changes.
 *
 * ⚠️ **The framed SMART panel does not carry it, deliberately.** The mock EHR
 * page around the frame already shows it; a second copy inside the frame would
 * spend panel height to say the same thing twice.
 *
 * Remove the notice by deleting its renderers, not by blanking these strings —
 * an empty banner still takes a row.
 */
export const DEVELOPMENT_NOTICE = {
  title: 'Under development.',
  body: 'SPiER’s guide, tools and demo may change and are not for clinical use.',
} as const
