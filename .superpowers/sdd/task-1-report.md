# Task 1 report

## Changes

- Added an isolated `motion-skill` TypeScript/Vite/Vitest package with Node 22+ metadata and the required scripts.
- Added strict ES2022 + DOM TypeScript configuration, Vite runtime root, and `@` → `src` alias.
- Added explicit Zod 4 discriminated unions for all specified element, generator, behavior, and falloff primitives.
- Added scene-wide stable-ID uniqueness and reference integrity validation, numeric bounds, seeded randomized primitives, and the three-behavior limit.
- Exported all required inferred contract types and `createDefaultScene(name, seed)`.
- Added nine unit tests covering the canonical valid scene, requested invalid cases, and default scene output.

## TDD and verification

- RED: `npm run test:unit -- tests/schema.test.ts` failed because `src/model/defaults` did not exist (expected missing implementation).
- GREEN: `npm run test:unit -- tests/schema.test.ts && npm run typecheck` passed: 1 test file, 9 tests; TypeScript exited 0.
- Final verification command and output summary will match the fresh pre-commit run: `npm run test:unit -- tests/schema.test.ts && npm run typecheck`.

## Self-review

- Confirmed all five supplied enum families are represented as explicit discriminated variants.
- Confirmed coordinates remain unbounded canvas-pixel numbers, rotation is a numeric radian value, influence-like opacity/index/random fields are bounded to `[0, 1]`, and composition/falloff time values use seconds.
- Confirmed references are checked after structural parsing and IDs are non-empty and globally unique.
- Confirmed only `motion-skill` task files are staged; pre-existing root lockfile modifications remain untouched.

## Concerns

- Primitive-specific property shapes beyond the supplied enum names were not fully specified. The schema uses a conservative explicit contract for each primitive while keeping optional tuning parameters optional.

## Review fixes

- Replaced the behavior-array size limit with the intended animation-binding role limits: at most one `primary` and two `supporting` bindings. Unbound behaviors are no longer incorrectly capped.
- Made `noise.seed` required so all noise behavior is reproducible.
- Added regression coverage for both binding limits, unseeded noise, non-empty default scene names, and successful parsing of every element, generator, behavior, and falloff discriminated-union variant.
- Made `createDefaultScene` reject an empty name.
- Added `fast-json-patch`, pinned the requested TypeScript/Vite/Zod/Vitest/Playwright/ESLint stack to exact lock-resolved versions, and added ESLint 9 flat configuration with the TypeScript parser/plugin.
- Deferred cross-field semantic validation requested as Minor 3 to Task 2, per review scope.

## Review-fix TDD and verification

- RED: `npm run test:unit -- tests/schema.test.ts` produced 4 expected failures: valid three-binding scene rejected by the old behavior cap, unseeded noise accepted, all-variant fixture rejected by the behavior cap, and empty default name accepted.
- GREEN: `npm run test:unit -- tests/schema.test.ts` passed 13/13 tests after the minimal schema/default changes.
- Dependency/configuration verification: `npm install` completed with 0 vulnerabilities.
- Final command: `npm run test:unit -- tests/schema.test.ts && npm run typecheck && npm run lint`.
- Final output: 1 test file passed, 13/13 tests passed; TypeScript exited 0; ESLint exited 0.
