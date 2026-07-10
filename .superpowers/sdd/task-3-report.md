# Task 3 report

Implemented deterministic Mulberry32/value noise, pure linear/grid/radial/path/scatter instance generation, text splitting, and normalized composable falloffs. Added the minimum compatible schema surface for line splitting and falloff easing/inversion/clamping.

## TDD evidence

- `npm run test:unit -- tests/generators.test.ts tests/falloffs.test.ts`
  - Initial result: 2 failed suites because generator/falloff modules did not exist.
- `npm run test:unit -- tests/generators.test.ts tests/falloffs.test.ts`
  - Result: 2 files passed, 8 tests passed.
- `npm run typecheck`
  - Result: passed (`tsc --noEmit`).
- `npm run test:unit`
  - Final result: 4 files passed, 38 tests passed.
- `npm run lint`
  - Result: blocked by two pre-existing `structuredClone` `no-undef` errors in Task 2 files (`src/model/patch-store.ts` and `tests/patch-store.test.ts`); no Task 3 lint errors reported.

## Self-review

- No wall-clock or global random access.
- Instance IDs are stable and all coordinate/rotation/time/influence units follow the brief.
- Path generation supports line/circle and a four-control-point polygon as the existing schema-compatible cubic Bézier representation.
- Root lockfiles and `node_modules` are intentionally excluded from the commit.

## Review fixes

- Path generators now require `pathElementId === element.id` and throw for geometry outside line, circle, and four-point cubic Bézier polygons.
- Character splitting uses `Intl.Segmenter` graphemes with a deterministic Unicode-aware fallback; block, line, word, combining-mark, and ZWJ emoji cases are covered.
- Degenerate cubic endpoint derivatives use the first non-zero higher derivative with the correct limiting direction.
- Falloff clamps reject `min > max`; random repeatability, seed/index variation, bounds, context immutability, and binding order are covered.
- Removed the redundant falloff intersection type and configured the standard `structuredClone` global for ESLint.

## Review verification

- `npm run test:unit -- tests/schema.test.ts tests/generators.test.ts tests/falloffs.test.ts tests/patch-store.test.ts`
  - Result: 4 files passed, 43 tests passed.
- `npm run typecheck`
  - Result: passed (`tsc --noEmit`).
- `npm run lint`
  - Result: passed with zero errors.
