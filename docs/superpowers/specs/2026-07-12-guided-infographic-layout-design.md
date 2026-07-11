# Guided Infographic Layout Design

## Product change

Motion Scene evolves from a generic animated-card generator into a lightweight visual-argument tool. It keeps one-sentence generation as the default while offering optional Art Direction controls when users need predictable infographic composition.

## Interaction modes

### Default mode

The user enters a viewpoint. The system infers the relationship, generates a modernist draft, previews it, and states the choices it made. It never blocks first generation with a mandatory form.

### Guided mode

When the user asks for control, or when the system cannot safely choose one of several materially different treatments, expose four concise choices:

- Composition: contrast, causal, converge, system, data.
- Palette: default modernist, mono, signal red, electric blue, warm paper.
- Motion: calm, natural, pronounced, quick, still-first.
- Typography: sans, editorial serif, mixed, brand font.

Optional controls are visual language (nodes, linear icons, grid, particles, text only) and output (static, preview, Live Photo package). Natural-language requests map to the same fields. The user can omit every control and retain the default.

## Layout system

Introduce layout primitives rather than hand-positioning every generated element:

- Text anchors: `left`, `center`, `right`, with multi-line blocks sharing the chosen edge.
- Node layouts: horizontally centered pair, converging causes, contrast pair, and simple graph.
- Edge layouts: relation edge with start/end anchors, optional label, automatic arrowhead tangent, and minimum clearance from node boundaries.
- Token layouts: color roles (`background`, `foreground`, `muted`, `accent`) and type roles (`display`, `body`, `meta`).

The renderer must calculate arrowheads from the final edge vector. A title requested as left aligned must share one left edge across all lines. Generated elements may not require per-card coordinate corrections.

## Default visual system

The initial default remains modernist editorial: warm paper background, black foreground, muted gray structure, electric-blue accent, large sans-serif Chinese type, clear negative space, and restrained motion. Palette and typography are tokens, not templates.

## Motion

`calm` is the default: low-frequency sine-like response, small scale or position range, no distracting looping entrance. Motion explains a relationship; it does not add copy. The existing engine may approximate entrance/exit requests until a timeline model exists, and must disclose that approximation.

## Acceptance criteria

- A causal request with two causes and one result produces two correctly attached arrowheads aimed at the result.
- A multi-line left-aligned title has identical left bounds for every line.
- A horizontally paired node layout has a combined visual bounding box centered on the canvas.
- Palette selection maps only to the four semantic color roles and maintains readable contrast.
- Guided controls and equivalent natural-language wording produce the same scene configuration.
- Omitting all controls still produces a valid modernist card.
- Existing opinion-card and diagram-card workflows remain available.
