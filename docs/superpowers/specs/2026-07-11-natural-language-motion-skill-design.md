# Natural-Language Motion Skill Design

## Product definition

This skill lets non-programmers create and direct motion graphics through conversation. The user describes an effect in natural language, sees it immediately in a browser canvas, and refines the same scene with follow-up instructions.

The first release focuses on text and geometric shapes. It combines motion-poster composition with abstract generative art through a shared Cavalry-inspired model rather than separate effect libraries.

The browser is a persistent preview surface, not a full editor. Conversation remains the primary interface.

## Goals

- Turn natural-language descriptions into structured, reproducible motion scenes.
- Open or reuse a browser preview and refresh it immediately after scene changes.
- Preserve unaffected composition and motion when the user requests a local change.
- Support both kinetic typography and generative geometric work with the same primitives.
- Produce visually controlled motion rather than arbitrary webpage effects.

## Non-goals for the first release

- Image or video input and automatic layer extraction
- 3D scenes, cameras, or lighting
- Audio-reactive animation
- Character rigs or skeletal animation
- A full keyframe timeline, layer editor, or complex parameter panel
- Video, GIF, or project-file export
- User-authored code or expressions

## Core interaction

The skill owns the conversation and a persistent scene state. A fixed browser runtime renders that state.

```text
Natural-language request
        ↓
Intent and constraint analysis
        ↓
Create scene or produce a targeted patch
        ↓
Validate schema, parameters, and performance budget
        ↓
Update persistent scene state
        ↓
Refresh the browser preview
```

For an initial request, the skill creates a complete scene. For follow-up requests, it emits a targeted patch. It rebuilds the scene only when the user explicitly asks to start over or requests a structural change that cannot be represented safely as a patch.

Examples of expected follow-ups include:

- “Slow it down” changes timing without changing layout.
- “Only change the colors” preserves motion and composition.
- “Make the rhythm slightly random, but keep the positions” adds seeded timing variation without spatial noise.
- “Undo that” restores the complete prior scene state.

When interpreting subjective language, the skill briefly states the concrete interpretation after applying it. For example, “more alive” may become subtle phase variation and rotational noise while preserving layout.

## Architecture

The system consists of four independently testable units.

### 1. Intent planner

Converts the latest user instruction and current scene summary into either a new-scene plan or a constrained modification plan. A modification plan identifies targets, changes, and properties that must be preserved.

### 2. Scene model

A declarative JSON scene graph inspired by Cavalry’s procedural model:

```text
Elements → Generators → Behaviors → Falloffs → Animation
```

The top-level scene contains:

- `composition`: canvas dimensions, background, duration, playback, and style tendency
- `elements`: text, shapes, and groups
- `generators`: rules for producing and distributing instances
- `behaviors`: reusable motion or interaction rules
- `falloffs`: spatial, index-based, random, or temporal influence fields
- `animation`: timing, phase, easing, looping, and channel bindings
- `metadata`: stable IDs, random seed, scene name, schema version, and revision

Every element and behavior has a stable ID so follow-up instructions can address existing structures without regenerating them.

### 3. Patch and validation layer

Applies explicit operations to the current scene. Before committing a revision, it validates:

- schema correctness
- references between nodes
- numeric limits and safe parameter ranges
- supported feature combinations
- instance and behavior cost
- preservation constraints from the user’s instruction

If validation or rendering fails, the previous valid revision remains active.

### 4. Browser runtime

A fixed renderer watches the scene state and updates the preview. It exposes only:

- motion canvas
- play/pause
- restart
- fullscreen
- optional grid or safe-area overlay
- scene name and connection status

The runtime does not include chat, a timeline, a layer panel, or a full parameter inspector in the first release.

## Scene primitives

### Elements

- Text split as a block, lines, words, or characters
- Circle
- Rectangle
- Line
- Polygon
- Star
- Group

Text layout must remain readable before motion and deformation are applied.

### Generators

- `linear`: horizontal or vertical sequences
- `grid`: two-dimensional arrangements
- `radial`: circles and arcs
- `path`: straight, circular, and Bézier paths
- `scatter`: seeded distribution inside a bounded region

### Animatable channels

- Position
- Rotation
- Scale
- Opacity
- Color
- Character spacing and line spacing
- Corner radius and shape dimensions
- Path progress

### Behaviors

- `wave`: sine, triangle, and sawtooth oscillation
- `noise`: continuous seeded noise and constrained jitter
- `spring`: damped response toward a target
- `follow`: indexed or chained phase following
- `lookAt`: orientation toward or away from a target
- `attract` and `repel`: bounded force interactions

### Falloffs

Falloffs determine which instances receive an effect and at what strength:

- `linear`: influence changes along a direction
- `radial`: influence changes with distance from a point
- `index`: influence follows generated instance order
- `random`: seeded per-instance influence
- `time`: an influence region moves through the scene

Falloffs may be combined with behaviors, but the first release should limit stacking depth to keep results understandable and performant.

## Visual-quality policy

The runtime and planner enforce conservative defaults:

- One primary motion system per initial composition, with at most two supporting behaviors.
- Low amplitude, longer periods, and restricted palettes unless the user asks otherwise.
- All randomness is seeded and temporally continuous.
- Motion should express a spatial or sequential relationship rather than unrelated per-object movement.
- Loops must be continuous at their boundary unless a deliberate cut is requested.
- Springs must be damped and bounded; force behaviors must not accumulate unstable velocity.
- Generative work must retain a compositional center, direction, rhythm, or density structure.
- Typography remains legible unless the user explicitly prioritizes abstraction.

The skill may use these style tendencies as parameter and composition guidance, not as fixed templates:

- `editorial`
- `kinetic-type`
- `geometric`
- `organic`
- `chaotic`

## Performance policy

The initial target is smooth playback on a typical desktop browser with either:

- approximately 500 simple instances, or
- approximately 150 instances using compound behaviors.

These are budgets rather than guarantees across all hardware. Before applying a scene or patch, the validator estimates cost. If the request exceeds the budget, the skill reduces instance count or effect precision and tells the user what was adjusted. It must not silently produce an unresponsive preview.

## Error handling and revision safety

- Every accepted change creates a revision that can be undone.
- Invalid patches leave the current preview and scene untouched.
- A renderer failure triggers restoration of the previous renderable revision.
- Missing or ambiguous targets cause the planner to choose the smallest reversible change when confidence is adequate; otherwise it asks one focused question.
- Unsupported requests receive a clear limitation and, when possible, a supported approximation.
- Stable random seeds preserve visual continuity across unrelated edits.

## Acceptance scenarios

The first release must generate each of these from a single natural-language request:

1. A line of text rising character by character like a wave.
2. Circles breathing outward from the center in sequence.
3. A grid of squares repelled by the pointer.
4. Text arranged on a rotating ring with characters facing outward.
5. An organic black-and-white dot field with controlled variation.
6. Thin lines following the movement of the preceding line.
7. Stars spreading progressively from left to right and returning smoothly.
8. A Swiss-style motion poster with stable headline typography and slowly changing supporting geometry.

Each scenario must also pass these modification checks:

- Timing-only changes preserve layout, content, palette, and behavior structure.
- Palette-only changes preserve motion and composition.
- Seeded randomization is reproducible.
- Position-preserving instructions do not introduce spatial noise.
- Undo restores the exact prior scene revision.
- An invalid patch cannot break the active preview.

## Testing strategy

- Schema tests cover every node type, required field, reference, and parameter boundary.
- Patch tests verify targeted changes and preservation constraints.
- Determinism tests compare scene output for identical seeds and timestamps.
- Behavior tests cover wave periodicity, spring damping, follow ordering, orientation, and bounded forces.
- Loop tests compare first- and last-frame state within defined tolerances.
- Performance fixtures exercise simple and compound instance budgets.
- Browser integration tests create, update, undo, and recover a scene through the persistent preview connection.
- Visual regression fixtures cover the eight acceptance scenarios at representative timestamps.

## Success criteria

The concept is validated when a non-programmer can create one of the acceptance scenarios, make at least three successive natural-language refinements, and retain the aspects they did not ask to change. The user should not need to see or edit code, understand node terminology, or operate a traditional animation timeline.
