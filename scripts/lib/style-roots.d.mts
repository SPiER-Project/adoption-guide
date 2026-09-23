// Types for style-roots.mjs, so a TypeScript test can read the ONE list of
// style roots instead of restating it (the module's header says why a restated
// list is the defect). Keep in step with the .mjs exports.

export interface StyleRoot {
  source: string
  dir: string
  floorCss: number
  floorSrc: number
}

export interface FloorEntry {
  source: string
  dimension: string
  actual: number
  floor: number
}

export const REPO_ROOT: string
export const STYLE_ROOTS: StyleRoot[]
export function relRepo(p: string): string
export function walkExt(dir: string, exts: string[]): string[]
export function allStyleFiles(exts: string[]): string[]
export function styleRootFloors(opts?: { css?: boolean; src?: boolean }): FloorEntry[]
