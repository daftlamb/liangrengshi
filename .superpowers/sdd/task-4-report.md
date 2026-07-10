# Task 4 Report

## Implemented

- Pure deterministic evaluators for wave (sine/triangle/saw), seeded noise, bounded spring, indexed follow, look-at, attract, and repel.
- Scene composition with group flattening, generator output, ordered bindings/falloffs, additive position/rotation, multiplicative scale/opacity, deterministic loop time, and role-limit guards.
- Render instances preserve source geometry/text and include final visual channels.
- Waveform schema support and tighter configured random-falloff bounds assertion.

## TDD evidence

- Behavior and scene tests first failed because evaluator modules did not exist.
- Selectable waveform preservation test failed before the schema field was added.
- Final verification: all unit tests, typecheck, lint, and `git diff --check` pass.

## Self-review

- No `Math.random()` usage; noise and random falloffs remain seeded.
- Force displacement is capped at 100 pixels; zero-distance and extreme-delta paths are finite.
- Loop time is normalized so periodic fixtures match at `t=0` and `t=duration`.
- Generator association is explicit and stable through required `elementId` references.

## Review fixes

- Added required `elementId` to every generator. Scene validation rejects unknown targets, multiple generators for one target, unsupported path sources, and indirect group cycles.
- Separated generated content from optional path geometry in `generateInstances`; path instances retain target type/content and receive placement/tangent from the referenced line, circle, or supported four-point cubic geometry.
- Replaced positional generator lookup with stable ID lookup, including regression coverage for reordered/inserted elements and unequal generator counts.
- Group bindings now propagate through nested descendants and group transforms compose additively with descendant transforms.
- `evaluateScene` validates runtime input up front and fails fast for missing generator, behavior, target, and falloff references.
- Added regression tests for path content/source separation, nested group inheritance, cycles, duplicate generator targets, and typed-invalid scenes.
