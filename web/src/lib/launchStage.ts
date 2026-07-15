/**
 * launchStage — write-path helper that stamps a submitted QuestionnaireResponse
 * with the *launching* tool's pathway stage, so a questionnaire shared by more
 * than one tool at different stages is grouped by launch context rather than by
 * the questionnaire canonical alone.
 *
 * The motivating case was CAMS SSF-5 Section A when its first-session and
 * interim-session launches belonged to tools at different stages. The CAMS
 * SSF-5 is now consolidated into one tool (TL-020 @ `clarify-risk`), so today
 * every launch stamps the same stage — but the mechanism stays: any future
 * questionnaire shared across tools at different stages groups by launch
 * context rather than by the questionnaire canonical alone.
 *
 * The launching tool id is threaded from the launchAction/route as a `?tool=`
 * query param (see catalog `tool-ui-metadata.ts` and `QuestionnaireView`).
 */
import { toolById, stripCanonicalVersion } from '../data/catalog'
import { PATHWAY_STAGE_SYSTEM } from './patientPathway'
import type { QuestionnaireResponseResource } from '../types/fhir'

/**
 * Return `qr` stamped with `launchToolId`'s pathway stage via `meta.tag`
 * (PATHWAY_STAGE_SYSTEM), or `qr` unchanged when no stamp applies.
 *
 * A stamp is applied only when the launching tool actually owns the QR's
 * questionnaire canonical — a crafted or stale `?tool=` id can't tag an
 * unrelated stage. If the QR already carries that exact stage tag, it's returned
 * as-is (idempotent). When `launchToolId` is absent/unknown, or the tool doesn't
 * own the questionnaire, the QR is returned untouched and canonical-based
 * resolution applies as before.
 */
export function stampLaunchStage(
  qr: QuestionnaireResponseResource,
  launchToolId: string | null | undefined,
): QuestionnaireResponseResource {
  const launchTool = toolById(launchToolId ?? '')
  const canonical = qr.questionnaire ? stripCanonicalVersion(qr.questionnaire) : undefined
  const owns =
    !!canonical &&
    !!launchTool?.questionnaireUrls?.some((u) => stripCanonicalVersion(u) === canonical)
  if (!launchTool || !owns) return qr

  const meta = qr.meta as { tag?: { system?: string; code?: string }[] } | undefined
  const existingTags = meta?.tag ?? []
  const alreadyTagged = existingTags.some(
    (t) => t.system === PATHWAY_STAGE_SYSTEM && t.code === launchTool.stageId,
  )
  if (alreadyTagged) return qr

  return {
    ...qr,
    meta: {
      ...(meta as Record<string, unknown> | undefined),
      tag: [...existingTags, { system: PATHWAY_STAGE_SYSTEM, code: launchTool.stageId }],
    },
  }
}
