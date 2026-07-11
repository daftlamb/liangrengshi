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

## Review fixes

- `SceneStore.markRenderFailed` now requires the requested revision to be the current active revision and resolves a safe rollback target before mutating failed/history/current state.
- Added atomicity regressions for nonexistent revision `999`, old non-active revision `0`, and an active revision with no safe rollback target. Each rejected call preserves the current snapshot and next accepted revision number.
- `validateScene` now returns schema issues immediately when `sceneSchema.safeParse` fails, so malformed runtime values are never traversed as a trusted `Scene`.
- Added a malformed runtime input regression proving validation returns errors without throwing.

## Review-fix TDD and verification evidence

- RED: `npm run test:unit -- tests/patch-store.test.ts` — 16 tests ran; 2 failed as expected: malformed runtime input threw while reading missing `elements`, and nonexistent revision `999` was accepted. The old-revision and no-target atomicity tests already passed against the existing implementation.
- GREEN: `npm run test:unit -- tests/patch-store.test.ts` — 1 file passed, 16 tests passed.
- Full: `npm run test:unit -- tests/schema.test.ts tests/patch-store.test.ts && npm run typecheck && git diff --check` — 2 files passed, 29 tests passed; TypeScript and diff hygiene exited 0.
