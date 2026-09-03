# `ig/drafts/` — sources deliberately outside the build

Empty on purpose, kept as a working slot rather than deleted: a StructureMap
or CQL library being iterated on can live here without touching the published
IG. `scripts/check-fml.mjs` still compiles any `.fml` parked here, but a file
here is otherwise a file nothing checks or publishes. Everything that has
lived here — four StructureMap drafts, and the Stage-8 measure CQL — has since
been promoted into `ig/input/`; see [#92](https://github.com/SPiER-Project/adoption-guide/issues/92),
[#229](https://github.com/SPiER-Project/adoption-guide/issues/229), and
[#212](https://github.com/SPiER-Project/adoption-guide/issues/212) for that history.
