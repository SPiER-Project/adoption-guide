import type { WorkerAlias } from './aliases.mjs'

/**
 * Deliberately NOT typed against `vite`'s `UserConfig`: that would import the
 * ROOT install's Vite types into a file the services compile against their
 * own Vite. The shape is plain and structural; `defineConfig` in each service
 * checks it against the service's Vite.
 */
export interface WorkerViteConfig {
  resolve: { alias: WorkerAlias[] }
  build: {
    ssr: string
    outDir: string
    emptyOutDir: boolean
    target: string
    rollupOptions: {
      external: Array<string | RegExp>
      output: { entryFileNames: string; format: 'es' }
    }
  }
  ssr: { target: 'webworker'; noExternal: true }
}

export interface WorkerVitestConfig {
  resolve: { alias: WorkerAlias[] }
  test: { environment: 'node'; include: string[] }
}

export function workerViteConfig(options?: {
  entry?: string
  external?: Array<string | RegExp>
}): WorkerViteConfig

export function workerVitestConfig(): WorkerVitestConfig
