# Scene schema

All objects are strict in meaning even though unknown keys may parse. IDs are non-empty and globally unique across elements, generators, behaviors, falloffs, and animation bindings. Numbers must be finite.

## Complete scene

```json
{
  "metadata": { "schemaVersion": 1, "revision": 0, "seed": 42, "name": "Orbit" },
  "composition": { "width": 960, "height": 540, "background": "#10131a", "duration": 4, "loop": true, "style": "geometric" },
  "elements": [
    { "id": "title", "type": "text", "text": "ORBIT", "split": "characters", "x": 480, "y": 270, "rotation": 0, "scale": 1, "opacity": 1, "fill": "#ffffff", "fontFamily": "Inter", "fontSize": 72 },
    { "id": "dot", "type": "circle", "radius": 8, "fill": "#70d6ff" }
  ],
  "generators": [
    { "id": "ring", "type": "radial", "elementId": "dot", "count": 20, "center": { "x": 480, "y": 270 }, "radius": 160 }
  ],
  "behaviors": [
    { "id": "pulse", "type": "wave", "waveform": "sine", "amplitude": 0.25, "frequency": 0.25, "phase": 0 }
  ],
  "falloffs": [
    { "id": "sequence", "type": "index", "start": 0.2, "end": 1, "easing": "easeInOut", "invert": false, "clamp": [0, 1] }
  ],
  "animation": [
    { "id": "dot-pulse", "elementId": "dot", "behaviorId": "pulse", "falloffIds": ["sequence"], "channels": ["scale", "opacity"], "role": "primary" }
  ]
}
```

Metadata requires `schemaVersion: 1`, nonnegative integer `revision`, integer `seed`, and non-empty `name`. Composition requires positive `width`, `height`, and `duration`; a boolean `loop`; background string; and style `editorial`, `kinetic-type`, `geometric`, `organic`, or `chaotic`.

## Elements

Every element accepts `id` and optional `x`, `y`, `rotation`, nonnegative `scale`, and `opacity` from 0 to 1.

- `text`: `text`; optional `split` (`none`, `lines`, `words`, `characters`), `fill`, `fontFamily`, positive `fontSize`.
- `circle`: nonnegative `radius`; optional `fill`, `stroke`.
- `rectangle`: nonnegative `width`, `height`; optional nonnegative `cornerRadius`, `fill`, `stroke`.
- `line`: `x2`, `y2`; optional `stroke`, nonnegative `strokeWidth`.
- `polygon`: `points`, an array of at least three `{x,y}` points; optional `fill`, `stroke`.
- `star`: integer `points` of at least 2, nonnegative `innerRadius`, `outerRadius`; optional `fill`, `stroke`.
- `group`: `childIds`. Children must exist, be unique, have at most one parent, and form no cycles. A group cannot be a generator or behavior target.

```json
[
  { "id": "copy", "type": "text", "text": "MOVE", "split": "words", "fill": "#f8f7f2", "fontSize": 64 },
  { "id": "disc", "type": "circle", "radius": 24, "fill": "#ff5d8f", "stroke": "#ffffff" },
  { "id": "card", "type": "rectangle", "width": 240, "height": 140, "cornerRadius": 18, "fill": "#222222" },
  { "id": "guide", "type": "line", "x": 80, "y": 270, "x2": 880, "y2": 270, "stroke": "#777777", "strokeWidth": 2 },
  { "id": "triangle", "type": "polygon", "points": [{ "x": 0, "y": -30 }, { "x": 28, "y": 22 }, { "x": -28, "y": 22 }], "fill": "#ffd166" },
  { "id": "spark", "type": "star", "points": 5, "innerRadius": 10, "outerRadius": 24, "fill": "#fee440" },
  { "id": "lockup", "type": "group", "childIds": ["copy", "disc"] }
]
```

## Generators

All require `id`, existing drawable `elementId`, and optional positive integer `count`. One element may have at most one generator.

- `linear`: optional `start`, `end` points.
- `grid`: optional positive integer `columns`, `rows`, and numeric `gapX`, `gapY`.
- `radial`: optional `center` and nonnegative `radius`.
- `path`: required drawable `pathElementId`, optional `start`/`end` in 0–1. Paths support line, circle, or four-point polygon geometry.
- `scatter`: required integer `seed`; optional `bounds` with `x`, `y`, nonnegative `width`, `height`.

```json
[
  { "id": "row", "type": "linear", "elementId": "disc", "count": 8, "start": { "x": 100, "y": 100 }, "end": { "x": 860, "y": 440 } },
  { "id": "tiles", "type": "grid", "elementId": "card", "columns": 5, "rows": 3, "gapX": 28, "gapY": 28 },
  { "id": "halo", "type": "radial", "elementId": "spark", "count": 16, "center": { "x": 480, "y": 270 }, "radius": 180 },
  { "id": "on-guide", "type": "path", "elementId": "triangle", "count": 12, "pathElementId": "guide", "start": 0, "end": 1 },
  { "id": "field", "type": "scatter", "elementId": "disc", "count": 40, "seed": 9, "bounds": { "x": 80, "y": 60, "width": 800, "height": 420 } }
]
```

These are individual shape examples; do not combine them unchanged because generator targets must be unique.

## Behaviors

- `wave`: optional `waveform` (`sine`, `triangle`, `saw`), `amplitude`, `frequency`, `phase`.
- `noise`: required integer `seed`; optional `amplitude`, `frequency`.
- `spring`: optional nonnegative `stiffness`, `damping`.
- `follow`: required drawable `targetElementId`.
- `lookAt`: required drawable `targetElementId`.
- `attract`: required drawable `targetElementId`; optional `strength`.
- `repel`: optional drawable `targetElementId`; optional `strength`.

```json
[
  { "id": "breathe", "type": "wave", "waveform": "sine", "amplitude": 0.2, "frequency": 0.25, "phase": 0 },
  { "id": "drift", "type": "noise", "amplitude": 12, "frequency": 0.15, "seed": 7 },
  { "id": "settle", "type": "spring", "stiffness": 90, "damping": 14 },
  { "id": "chase", "type": "follow", "targetElementId": "disc" },
  { "id": "face", "type": "lookAt", "targetElementId": "disc" },
  { "id": "pull", "type": "attract", "targetElementId": "disc", "strength": 0.4 },
  { "id": "push", "type": "repel", "targetElementId": "disc", "strength": 0.6 }
]
```

## Falloffs and animation channels

All falloffs accept optional easing `linear`, `easeIn`, `easeOut`, or `easeInOut`; `invert`; and ordered 0–1 `clamp`.

- `linear`: optional numeric `start`, `end`.
- `radial`: optional `center`, positive `radius`.
- `index`: optional 0–1 `start`, `end`.
- `random`: required integer `seed`; optional 0–1 `min`, `max`.
- `time`: optional nonnegative `start`, `end`.

```json
[
  { "id": "left-right", "type": "linear", "start": 0, "end": 1, "easing": "easeOut" },
  { "id": "from-center", "type": "radial", "center": { "x": 480, "y": 270 }, "radius": 300 },
  { "id": "in-order", "type": "index", "start": 0, "end": 1 },
  { "id": "variety", "type": "random", "seed": 4, "min": 0.3, "max": 1 },
  { "id": "entrance", "type": "time", "start": 0, "end": 1.2 }
]
```

An animation binding requires `id`, existing `elementId`, existing `behaviorId`, `falloffIds`, channels, and role. Valid channels are `x`, `y`, `rotation`, `scale`, `opacity`, `color`, `letterSpacing`, `lineHeight`, `cornerRadius`, `width`, `height`, and `pathProgress`. Numeric behavior output is added to position, rotation, typography, rectangle dimensions, corner radius, and path progress; scale and opacity use `base * (1 + output)`; color rotates hue by one half-turn per output unit. Falloff weight multiplies the output before composition. Dimensions are clamped nonnegative, opacity and path progress to 0–1. `pathProgress` draws a proportional line or closed-path perimeter. Element/channel compatibility is validated. A scene permits at most one `primary` and two `supporting` bindings; this is a hard v1 limit.
