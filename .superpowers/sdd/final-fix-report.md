# Final fix report

## Implemented

- Completed evaluator and Canvas rendering for `color`, `letterSpacing`, `lineHeight`, `cornerRadius`, `width`, `height`, and `pathProgress`; added schema base fields, element/channel validation, clamping, and documented composition semantics.
- Corrected cost estimation to sum every generated target plus each ungenerated drawable singleton while excluding groups. Path guide elements remain rendered singletons, matching `evaluateScene`.
- Strengthened `preserve layout` for element geometry, hierarchy/transforms, path sources, and all generator placement parameters. Strengthened `preserve timing` for duration/loop, behavior frequency/phase, follow timing identity, time falloffs, and binding order.
- Kept the hard v1 motion hierarchy limit at one primary and two supporting bindings and documented it explicitly.
- Documented the v1 orphaned-preview-process lifecycle tradeoff.

## TDD evidence

Focused tests were added first and observed failing for all three findings. They then passed after implementation. Coverage includes evaluator composition, Canvas typography/geometry/path drawing, mixed generator/singleton cost bypasses, all five generator placement modes under layout preservation, hierarchy/path/geometry adversarial changes, and temporal behavior/falloff/order changes.

## Verification

- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run test:unit`: 11 files, 105 tests passed
- `npm run build`: pass, 92 modules transformed
- `npm run test:e2e`: 13 tests passed, including eight deterministic timestamp snapshot comparisons
- `git diff --check`: pass

## Concerns

- Non-hex colors use CSS relative-color `hsl(from ...)`; current target browsers accept this, while hex colors are converted directly for broader determinism.
- The intentionally unaddressed aborted-request 409 remains as the review's minor item.

## Final review follow-up

- Added spring `stiffness` and `damping` to the `timing` preservation projection. Adversarial patches changing either parameter are rejected, while unrelated palette edits remain allowed.
- Restricted composition and drawable colors to explicit `#RGB` and `#RRGGBB` forms. Removed the CSS relative-color fallback; animated colors are parsed and transformed numerically, then emitted deterministically as `#RRGGBB`. Updated the schema reference and added shorthand/unsupported-format coverage.
- Extracted grapheme segmentation into a shared helper used by both generators and the Canvas renderer. Letter spacing now measures and draws combining sequences and ZWJ emoji as single grapheme clusters.

### Follow-up TDD evidence

The spring preservation, color schema, and Canvas grapheme tests were added and observed failing against the prior implementation (3 focused failures). After implementation, the focused suite passed: 4 files, 41 tests.

### Follow-up verification

- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run test:unit`: pass, 12 files and 109 tests
- `npm run build`: pass, 93 modules transformed
- `npm run test:e2e`: pass, 13 tests
- `git diff --check`: pass

### Follow-up concerns

- The color contract intentionally excludes alpha-bearing and other CSS formats because the renderer's numeric animation path currently models RGB/HSL only; supporting alpha later should add explicit interpolation and compositing semantics first.
- The intentionally unaddressed aborted-request 409 remains outside this follow-up's scope.
