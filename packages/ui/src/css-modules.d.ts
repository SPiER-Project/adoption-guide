/**
 * `import './Button.css'` is a Vite side-effect import, and TypeScript has no
 * idea what a `.css` file is without being told.
 *
 * ⚠️ **Declared here rather than by pulling in `vite/client`.** That is how
 * `web` does it, and it does not work from this package: `types: ["vite/client"]`
 * is resolved against `typeRoots`, which points at `web/node_modules/@types`,
 * and Vite's client types do not live under `@types`. The result is
 * `TS2688: Cannot find type definition file for 'vite/client'` — a failure that
 * names the type library rather than the eight `import './X.css'` lines that
 * actually need it.
 *
 * Three lines, no dependency, and it says what it is for.
 */
declare module '*.css'
