# Task 2 report

## Changes

- Added semantic validation for schema/reference errors, element/channel compatibility, group self-reference, and duplicate group children.
- Added deterministic scene cost estimation with grid/count instance calculation and 500 simple / 150 compound caps.
- Added an atomic `SceneStore` using cloned JSON Patch candidates, semantic validation, canonical preservation projections, monotonically increasing revisions, defensive snapshots, undo, bounded 50-snapshot history, and failed-render rollback.
- Added 12 unit tests covering validation, cost policy, accepted/invalid mutations, preservation, replacement, undo, and render failure.

## TDD and verification

- RED: `npm run test:unit -- tests/patch-store.test.ts` — failed because `../src/model/patch-store` did not exist.
- GREEN: `npm run test:unit -- tests/patch-store.test.ts` — 1 file passed, 12 tests passed.
- Full: `npm run test:unit -- tests/schema.test.ts tests/patch-store.test.ts && npm run typecheck` — 2 files passed, 25 tests passed; TypeScript exited 0.
- Hygiene: `git diff --check` — exited 0.

## Self-review

- Candidate patches and returned/current scenes are cloned, so rejected patches and caller mutations cannot alter active state.
- Revision numbers are store-owned and monotonic, including undo and render rollback; failed snapshots are excluded from rollback/undo targets.
- Randomized model primitives remain explicitly seeded, so validation/cost/store behavior is reproducible.
- Only task-scoped files are staged; root lockfile and `node_modules` changes are excluded.

## Concerns

- Cost is scene-level because the current schema has no generator-to-binding reference; generated counts are therefore aggregated across scene generators.
- Preservation projections encode the current model fields explicitly and should be extended when the scene schema gains new layout/palette/content fields.
