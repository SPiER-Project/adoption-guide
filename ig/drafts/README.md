# `ig/drafts/` — sources deliberately outside the build

Empty on purpose, and kept rather than deleted because it is a working slot, not
a leftover.

Anything here sits outside `ig/input/`, so SUSHI and the IG Publisher do not see
it. That is the point: a StructureMap or CQL library being written can live here
and be iterated on without breaking the published IG, and `scripts/check-fml.mjs`
still compiles any `.fml` parked here, so a draft map is gated before it moves.

Both former residents have been promoted:

| Was here | Promoted to | When |
|---|---|---|
| Four StructureMap `.fml` drafts | `ig/input/resources/maps/` | #92 / #229 |
| `SPiERSuicideSaferCareMeasures.cql` | `ig/input/cql/` | #212 |

⚠️ **Parking something here is not free.** The CQL spent a release in this
folder on the strength of a conclusion that turned out to be wrong — that the IG
Publisher could not compile it — and the first real compile found five errors
that had been sitting in it the whole time. A file here is a file nothing
checks. Treat that as a debt with a due date, not a resting state.
