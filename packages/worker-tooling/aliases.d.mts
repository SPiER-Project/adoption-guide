/** One `resolve.alias` entry, in the array form Vite and Vitest both accept. */
export interface WorkerAlias {
  find: string | RegExp
  replacement: string
}

export function workerAliases(): WorkerAlias[]
