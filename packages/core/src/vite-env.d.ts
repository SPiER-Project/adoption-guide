// packages/core has no `vite` dependency of its own — it reuses the copy in
// web/node_modules, the same way its `fhirclient/*` path mapping does (see
// packages/core/tsconfig.json). A `types: ["vite/client"]` entry can't reach
// that copy: TypeScript resolves `types` entries via typeRoots/module
// resolution rooted at this project's own (nonexistent) node_modules, and
// `paths` doesn't participate in that resolution. A relative triple-slash
// `path` reference sidesteps module resolution entirely, so it works.
// dataElements.ts's `import.meta.env.BASE_URL` is why this is needed at all.
/// <reference path="../../../web/node_modules/vite/client.d.ts" />
