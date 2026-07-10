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
- Generator association is positional when multiple drawable elements/generators exist because the current schema has no generator-to-element reference; a lone generator applies to a lone drawable element.
