# Visual quality

## Conservative defaults

Start at 960×540, 3–5 seconds, looped, with one background, a small palette, and a stable seed. Prefer one clear focal element and meaningful negative space. Use the fewest instances that communicate the pattern.

## Motion hierarchy

Use at most one primary animation binding. For hand-authored motion, prefer one or two supporting bindings; data charts may use more supporting bindings so each mark and value can enter clearly, but the motion should still read as one coordinated rhythm. A behavior may drive multiple channels, but channel combinations must feel related. Remove a supporting behavior before increasing overall intensity.

## Loops

For seamless loops, favor sine waves and frequencies whose cycles resolve within the composition duration. Avoid visible jumps, late entrances that never settle, and random values that change between runs. Seed noise, scatter, and random falloffs.

## Data chart motion style

For lightweight charts, use the same modernist data-card rhythm by default. Vertical bars grow from their own bottom center with `growY`; ranking bars grow left-to-right with `growX`; line charts draw progressively with `pathProgress`; donut slices sweep with `pathProgress`; numeric labels use `count` plus `opacity` so they roll from 0 to the target while appearing. Keep all chart ramps on the composition duration, usually 5 seconds, so marks finish, hold, and replay together instead of resetting early.

Use a seeded, shuffled discrete palette for data marks, with black type and axes. Do not ask the user to specify routine bar colors, number counting, or basic chart timing unless they request a different style.

For donut or pie-style CSV cards, keep legends inside the portrait card automatically. Up to six slices can use the roomy single-column legend. More than six slices should switch to a compact two-column legend with slightly smaller labels and swatches; reduce and lift the donut so the chart bottom and first legend row keep a clear safety gap. Do not let the legend extend past the lower safe area or visually overlap the donut.

## Legibility

Keep text within the frame at its largest animated extent. Use sufficient contrast and font size. Large rotations, scale near zero, high-frequency jitter, animated line height, and animated letter spacing are risky for reading; use them sparingly and preview the extremes.

## Bounded physics and performance

Keep attract/repel strength, wave/noise amplitude, and spring stiffness proportional to the canvas and spacing. Begin gently, then tune from the preview. Treat any instance-budget warning as actionable: reduce generator counts, validate, apply, and disclose the reduction. Do not hide warnings.

## Composition review

After each change check:

1. Is the focal point obvious at rest and in motion?
2. Are margins, alignment, and repeated spacing intentional?
3. Does the full animated extent remain visible?
4. Is text readable throughout?
5. Does the loop close without a jump?
6. Is each behavior contributing distinct value?
7. Are interaction forces controlled rather than explosive?

Correct only clear problems. Do not broaden a user's small requested change into a redesign.
