# Natural-Language Motion Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conversational skill that creates and incrementally edits structured text-and-geometry motion scenes rendered in a persistent browser preview.

**Architecture:** A standalone TypeScript package owns a versioned scene schema, deterministic evaluator, validated patch store, Canvas 2D renderer, and local preview server. The Codex skill converts user intent into scene JSON or constrained JSON Patch, calls small CLI scripts, and keeps the browser runtime independent from natural-language interpretation.

**Tech Stack:** Node.js 22+, TypeScript 5, Vite 7, Canvas 2D, Zod 4, `fast-json-patch`, Vitest 3, Playwright, ESLint 9.

## Global Constraints

- The first release supports text, circle, rectangle, line, polygon, star, and group elements only.
- It supports linear, grid, radial, path, and seeded scatter generators.
- It supports wave, noise, spring, follow, look-at, attract, and repel behaviors.
- It supports linear, radial, index, seeded-random, and time falloffs.
- Random output must be seeded and reproducible.
- Every accepted mutation creates an undoable revision; invalid changes leave the active scene untouched.
- The preview UI contains canvas, play/pause, restart, fullscreen, grid/safe-area toggles, scene name, and connection state only.
- The default budget is 500 simple instances or 150 compound-behavior instances.
- No image/video input, 3D, audio response, rigs, timeline editor, media export, or user-authored expressions.
- A new scene uses at most one primary and two supporting behaviors unless the user explicitly requests more.

---

## Planned file structure

```text
motion-skill/
├── package.json                         # isolated scripts and dependencies
├── tsconfig.json                        # shared TypeScript settings
├── vite.config.ts                       # preview build and dev server
├── playwright.config.ts                 # browser integration configuration
├── src/
│   ├── model/schema.ts                  # Zod schema and inferred scene types
│   ├── model/defaults.ts                # conservative scene defaults
│   ├── model/validate.ts                # semantic references and cost checks
│   ├── model/patch-store.ts             # atomic patching and revision history
│   ├── math/random.ts                   # seeded PRNG and continuous noise
│   ├── evaluate/generators.ts           # generated instance placement
│   ├── evaluate/falloffs.ts             # normalized influence evaluation
│   ├── evaluate/behaviors.ts            # channel deltas at time/pointer state
│   ├── evaluate/scene.ts                # compose scene into render instances
│   ├── render/canvas-renderer.ts         # Canvas 2D drawing only
│   ├── runtime/client.ts                # playback, pointer, reconnect, rollback
│   ├── runtime/server.ts                # scene HTTP/SSE API and filesystem state
│   ├── runtime/index.html                # minimal preview shell
│   ├── runtime/styles.css                # preview chrome
│   └── cli/motion-scene.ts               # validate/apply/undo/serve commands
├── skill/
│   ├── SKILL.md                          # conversational workflow and constraints
│   ├── references/scene-schema.md        # scene authoring reference
│   ├── references/motion-language.md     # phrase-to-primitive guidance
│   ├── references/visual-quality.md      # composition and motion guardrails
│   └── scripts/preview.sh                # stable entry point for the runtime
├── examples/                              # eight acceptance scenes
└── tests/
    ├── schema.test.ts
    ├── patch-store.test.ts
    ├── generators.test.ts
    ├── falloffs.test.ts
    ├── behaviors.test.ts
    ├── scene.test.ts
    ├── acceptance-scenes.test.ts
    └── preview.spec.ts
```

---

### Task 1: Package skeleton and complete scene contract

**Files:**
- Create: `motion-skill/package.json`
- Create: `motion-skill/tsconfig.json`
- Create: `motion-skill/vite.config.ts`
- Create: `motion-skill/src/model/schema.ts`
- Create: `motion-skill/src/model/defaults.ts`
- Test: `motion-skill/tests/schema.test.ts`

**Interfaces:**
- Produces: `Scene`, `Element`, `Generator`, `Behavior`, `Falloff`, `AnimationBinding`, `sceneSchema`, and `createDefaultScene(name, seed)`.
- IDs are non-empty strings; references use those stable IDs.
- Coordinates are canvas pixels, rotations are radians, normalized influence is `[0, 1]`, and time is seconds.

- [ ] **Step 1: Scaffold the isolated package and test runner**

Create `package.json` with scripts `test`, `test:unit`, `test:e2e`, `dev`, `build`, `typecheck`, and `lint`; pin the stack from the plan header. Configure strict TypeScript with DOM and ES2022 libraries. Configure Vite root as `src/runtime` and alias `@` to `src`.

Run: `cd motion-skill && npm install`

Expected: dependencies install and a new `motion-skill/package-lock.json` is created without changing the repository-root package files.

- [ ] **Step 2: Write failing schema tests**

Cover one valid minimal scene and rejection of unknown element types, missing references, negative duration, out-of-range opacity, unseeded scatter/random falloff, and more than three default behaviors. Use a representative assertion:

```ts
const result = sceneSchema.safeParse({
  metadata: { schemaVersion: 1, revision: 0, seed: 42, name: 'Wave' },
  composition: { width: 1080, height: 1080, background: '#111111', duration: 4, loop: true, style: 'kinetic-type' },
  elements: [{ id: 'title', type: 'text', text: 'HELLO', split: 'characters', fill: '#ffffff', opacity: 1 }],
  generators: [], behaviors: [], falloffs: [], animation: []
});
expect(result.success).toBe(true);
```

Run: `cd motion-skill && npm run test:unit -- tests/schema.test.ts`

Expected: FAIL because `schema.ts` does not exist.

- [ ] **Step 3: Implement the discriminated scene schema and defaults**

Define explicit Zod discriminated unions for every primitive listed in Global Constraints. Bindings use:

```ts
type AnimationBinding = {
  id: string;
  elementId: string;
  behaviorId: string;
  falloffIds: string[];
  channels: Array<'x'|'y'|'rotation'|'scale'|'opacity'|'color'|'letterSpacing'|'lineHeight'|'cornerRadius'|'width'|'height'|'pathProgress'>;
  role: 'primary'|'supporting';
};
```

`createDefaultScene()` returns a 1080×1080, four-second looping scene with a dark background, no nodes, schema version `1`, revision `0`, and the supplied integer seed.

- [ ] **Step 4: Run schema tests, typecheck, and commit**

Run: `cd motion-skill && npm run test:unit -- tests/schema.test.ts && npm run typecheck`

Expected: all schema tests PASS and TypeScript reports zero errors.

```bash
git add motion-skill/package.json motion-skill/package-lock.json motion-skill/tsconfig.json motion-skill/vite.config.ts motion-skill/src/model motion-skill/tests/schema.test.ts
git commit -m "feat(motion): define scene schema"
```

### Task 2: Semantic validation, cost policy, and atomic revision store

**Files:**
- Create: `motion-skill/src/model/validate.ts`
- Create: `motion-skill/src/model/patch-store.ts`
- Test: `motion-skill/tests/patch-store.test.ts`

**Interfaces:**
- Consumes: `Scene` and `sceneSchema` from Task 1.
- Produces: `validateScene(scene): ValidationResult`, `estimateSceneCost(scene): CostReport`, and `SceneStore` with `current()`, `apply(operations, preserve)`, `replace(scene)`, `undo()`, and `markRenderFailed(revision)`.
- `PreserveConstraint` is one of `layout`, `content`, `palette`, `timing`, or `motion`.

- [ ] **Step 1: Write failing store and semantic validation tests**

Test dangling IDs, duplicate IDs, invalid channel/type combinations, simple/compound budget classification, successful revision increment, preservation rejection, undo equality, invalid-patch atomicity, and render-failure rollback.

```ts
const before = store.current();
expect(() => store.apply([{ op: 'replace', path: '/composition/duration', value: -1 }], [])).toThrow();
expect(store.current()).toEqual(before);
```

Run: `cd motion-skill && npm run test:unit -- tests/patch-store.test.ts`

Expected: FAIL because validation and store modules do not exist.

- [ ] **Step 2: Implement semantic validation and deterministic cost calculation**

Reject duplicate IDs and missing element/behavior/falloff references. Calculate generated instance count and classify a binding as compound when it uses two or more behaviors/falloffs or any spring/force behavior. Return a suggested capped count when cost exceeds 500 simple or 150 compound instances.

- [ ] **Step 3: Implement atomic patching and snapshots**

Use `fast-json-patch` against a clone, validate the candidate, compare canonical projections for requested preservation constraints, increment revision, then append the accepted snapshot. Keep at least 50 revisions. `markRenderFailed(n)` restores the latest revision below `n` and records the failed revision so it cannot become active again.

- [ ] **Step 4: Verify and commit**

Run: `cd motion-skill && npm run test:unit -- tests/schema.test.ts tests/patch-store.test.ts && npm run typecheck`

Expected: all tests PASS with zero type errors.

```bash
git add motion-skill/src/model motion-skill/tests/patch-store.test.ts motion-skill/package.json motion-skill/package-lock.json
git commit -m "feat(motion): add validated scene revisions"
```

### Task 3: Deterministic generators and falloffs

**Files:**
- Create: `motion-skill/src/math/random.ts`
- Create: `motion-skill/src/evaluate/generators.ts`
- Create: `motion-skill/src/evaluate/falloffs.ts`
- Test: `motion-skill/tests/generators.test.ts`
- Test: `motion-skill/tests/falloffs.test.ts`

**Interfaces:**
- Produces: `createRandom(seed)`, `noise1D(seed, x)`, `generateInstances(generator, element, composition)`, and `evaluateFalloff(falloff, context)`.
- `InstanceContext` contains stable `id`, zero-based `index`, `count`, base transform, canvas position, and optional path tangent.

- [ ] **Step 1: Write failing deterministic generator tests**

Assert exact counts and endpoint placement for linear/grid/radial generators, tangent availability for line/circle/Bézier paths, bounds and repeatability for scatter, and stable IDs such as `title:0`.

Run: `cd motion-skill && npm run test:unit -- tests/generators.test.ts`

Expected: FAIL because generator modules do not exist.

- [ ] **Step 2: Implement PRNG and generators**

Use `mulberry32` for discrete seeded choices and interpolated value noise for continuous noise. Implement generator functions as pure functions with no wall-clock or global-random access. Split text into block/line/word/character instances before distribution.

- [ ] **Step 3: Write failing falloff tests**

Test linear endpoints, radial center/edge, index order, seeded-random repeatability, moving time field, inversion, clamp, and multiplication of two falloffs.

Run: `cd motion-skill && npm run test:unit -- tests/falloffs.test.ts`

Expected: FAIL because `evaluateFalloff` does not exist.

- [ ] **Step 4: Implement normalized falloffs and verify**

Each falloff returns `[0, 1]`, applies easing before optional inversion, and never mutates its context. Combined falloffs multiply their normalized values in binding order.

Run: `cd motion-skill && npm run test:unit -- tests/generators.test.ts tests/falloffs.test.ts`

Expected: all generator and falloff tests PASS.

```bash
git add motion-skill/src/math motion-skill/src/evaluate motion-skill/tests/generators.test.ts motion-skill/tests/falloffs.test.ts
git commit -m "feat(motion): evaluate generators and falloffs"
```

### Task 4: Behavior evaluation and scene composition

**Files:**
- Create: `motion-skill/src/evaluate/behaviors.ts`
- Create: `motion-skill/src/evaluate/scene.ts`
- Test: `motion-skill/tests/behaviors.test.ts`
- Test: `motion-skill/tests/scene.test.ts`

**Interfaces:**
- Consumes: generated instances and falloff values from Task 3.
- Produces: `evaluateBehavior(behavior, context): ChannelDelta` and `evaluateScene(scene, frame): RenderInstance[]`.
- `FrameContext` is `{ time: number; delta: number; pointer: { x: number; y: number; active: boolean } }`.

- [ ] **Step 1: Write failing behavior tests**

Test sine/triangle/saw values at quarter periods, continuous seeded noise, damped spring convergence, indexed follow delay, outward look-at angles, and capped attract/repel displacement. Verify finite values for zero distance and large `delta`.

Run: `cd motion-skill && npm run test:unit -- tests/behaviors.test.ts`

Expected: FAIL because behavior evaluation does not exist.

- [ ] **Step 2: Implement pure behavior evaluators**

Return channel deltas rather than mutating instances. Clamp forces and spring integration. Derive follow phase from stable index. Use the seeded noise module; never call `Math.random()`.

- [ ] **Step 3: Write failing scene-composition tests**

Test generator → behavior → falloff ordering, additive position/rotation, multiplicative scale/opacity, binding role limits, deterministic frames, and loop equality at `t=0` and `t=duration` for periodic fixtures.

- [ ] **Step 4: Compose render instances and verify**

`evaluateScene` resolves groups, generates instances, evaluates ordered bindings, applies falloff weights, and emits flattened render instances containing geometry/text plus final visual channels.

Run: `cd motion-skill && npm run test:unit -- tests/behaviors.test.ts tests/scene.test.ts && npm run typecheck`

Expected: all tests PASS and TypeScript reports zero errors.

```bash
git add motion-skill/src/evaluate motion-skill/tests/behaviors.test.ts motion-skill/tests/scene.test.ts
git commit -m "feat(motion): evaluate animated scenes"
```

### Task 5: Canvas renderer and persistent preview runtime

**Files:**
- Create: `motion-skill/src/render/canvas-renderer.ts`
- Create: `motion-skill/src/runtime/index.html`
- Create: `motion-skill/src/runtime/styles.css`
- Create: `motion-skill/src/runtime/client.ts`
- Create: `motion-skill/src/runtime/server.ts`
- Create: `motion-skill/playwright.config.ts`
- Test: `motion-skill/tests/preview.spec.ts`

**Interfaces:**
- Consumes: `evaluateScene`, `SceneStore`, and `RenderInstance[]`.
- Produces: `CanvasRenderer.render(instances, composition)`, `startPreviewServer({ port, stateDir })`, `GET /api/scene`, `GET /api/events` using SSE, and `POST /api/render-failed`.

- [ ] **Step 1: Write the failing browser integration test**

Start the preview server with a fixture scene, assert connection state is `connected`, verify the scene title, canvas dimensions, and required controls, click pause/restart/grid/fullscreen, mutate the fixture through the store, and assert revision text updates without reloading the page. Simulate `render-failed` and assert rollback.

Run: `cd motion-skill && npm run test:e2e -- tests/preview.spec.ts`

Expected: FAIL because the preview server and page do not exist.

- [ ] **Step 2: Implement the Canvas 2D renderer**

Render every supported element with save/translate/rotate/scale/globalAlpha/restore isolation. Use device-pixel-ratio backing dimensions. Cache split text metrics per font/style/content key. A thrown draw error includes the instance ID and revision.

- [ ] **Step 3: Implement server, SSE updates, and revision rollback**

Serve the Vite runtime and current scene, watch the state file, broadcast revision events, and accept render-failure reports. Bind to `127.0.0.1` by default. Return structured JSON errors without exposing filesystem paths.

- [ ] **Step 4: Implement the minimal preview shell**

Add only the controls in Global Constraints. Drive animation with `requestAnimationFrame`; loop using scene duration; track pointer position in canvas coordinates; reconnect SSE with capped exponential backoff; display `connecting`, `connected`, or `disconnected`.

- [ ] **Step 5: Verify and commit**

Run: `cd motion-skill && npm run build && npm run test:e2e -- tests/preview.spec.ts`

Expected: production build succeeds and the browser test PASSes.

```bash
git add motion-skill/src/render motion-skill/src/runtime motion-skill/playwright.config.ts motion-skill/tests/preview.spec.ts
git commit -m "feat(motion): add persistent canvas preview"
```

### Task 6: CLI operations used by the conversational skill

**Files:**
- Create: `motion-skill/src/cli/motion-scene.ts`
- Create: `motion-skill/skill/scripts/preview.sh`
- Test: `motion-skill/tests/cli.test.ts`

**Interfaces:**
- Produces commands `init`, `validate`, `replace`, `patch`, `undo`, `status`, and `serve`.
- State defaults to `.motion-scene/current.json` and `.motion-scene/history.json`; all commands accept `--state-dir` for isolation.
- Successful mutating commands print JSON `{ ok, revision, warnings }`; failures print `{ ok: false, code, message }` and exit nonzero.

- [ ] **Step 1: Write failing CLI tests**

Run the CLI in a temporary directory and test initialization, replacement, constrained patch, invalid patch preservation, undo, budget warning, status, and reuse of an already-running preview server.

Run: `cd motion-skill && npm run test:unit -- tests/cli.test.ts`

Expected: FAIL because the CLI does not exist.

- [ ] **Step 2: Implement commands over the shared store**

Use Node argument parsing with explicit command schemas. `patch` accepts RFC 6902 JSON from a file and repeated `--preserve` flags. Write state atomically through a temporary sibling file and rename. `serve` writes its PID and selected port; a second invocation returns the existing healthy server URL.

- [ ] **Step 3: Add the stable preview launcher and verify**

`preview.sh` resolves its own directory, invokes the package-local CLI, forwards `--state-dir` and `--port`, and never assumes the caller’s working directory.

Run: `cd motion-skill && npm run test:unit -- tests/cli.test.ts && npm run typecheck`

Expected: CLI tests PASS with zero type errors.

```bash
git add motion-skill/src/cli motion-skill/skill/scripts motion-skill/tests/cli.test.ts motion-skill/package.json
git commit -m "feat(motion): expose scene preview CLI"
```

### Task 7: Acceptance scenes and visual regression coverage

**Files:**
- Create: `motion-skill/examples/01-character-wave.json`
- Create: `motion-skill/examples/02-radial-breath.json`
- Create: `motion-skill/examples/03-pointer-repel-grid.json`
- Create: `motion-skill/examples/04-outward-type-ring.json`
- Create: `motion-skill/examples/05-organic-dot-field.json`
- Create: `motion-skill/examples/06-following-lines.json`
- Create: `motion-skill/examples/07-progressive-stars.json`
- Create: `motion-skill/examples/08-swiss-poster.json`
- Test: `motion-skill/tests/acceptance-scenes.test.ts`
- Modify: `motion-skill/tests/preview.spec.ts`

**Interfaces:**
- Consumes: public scene schema and runtime only.
- Produces: eight canonical fixtures named after the design-spec acceptance scenarios.

- [ ] **Step 1: Write failing fixture contract tests**

For every example, parse with `sceneSchema`, validate semantics and budget, evaluate representative timestamps, assert finite render channels, assert deterministic replay, and compare loop endpoints for looping scenes.

Run: `cd motion-skill && npm run test:unit -- tests/acceptance-scenes.test.ts`

Expected: FAIL because the example files do not exist.

- [ ] **Step 2: Author the eight structured scenes**

Build each example only from supported primitives. Each scene has a distinct stable seed, uses no more than three bindings by default, stays within its budget, and represents the named composition without custom code.

- [ ] **Step 3: Add timestamp visual snapshots**

For each scene, capture the canvas at `0`, `duration/4`, and `duration/2` through Playwright. Mask connection text and disable host-dependent font fallback by loading a bundled open font or using a deterministic system stack confirmed in CI.

Run: `cd motion-skill && npm run test:unit -- tests/acceptance-scenes.test.ts && npm run test:e2e -- tests/preview.spec.ts --update-snapshots`

Expected: contract tests PASS and 24 baseline snapshots are created.

- [ ] **Step 4: Re-run without updating and commit**

Run: `cd motion-skill && npm run test:e2e -- tests/preview.spec.ts`

Expected: all 24 visual comparisons PASS within the configured pixel threshold.

```bash
git add motion-skill/examples motion-skill/tests
git commit -m "test(motion): cover acceptance scenes"
```

### Task 8: Skill instructions and conversational modification protocol

**Files:**
- Create: `motion-skill/skill/SKILL.md`
- Create: `motion-skill/skill/references/scene-schema.md`
- Create: `motion-skill/skill/references/motion-language.md`
- Create: `motion-skill/skill/references/visual-quality.md`
- Create: `motion-skill/tests/skill-contract.test.ts`

**Interfaces:**
- Consumes: CLI and schema from Tasks 1–6.
- Produces: a self-contained skill workflow for initial scenes, follow-up patches, undo, unsupported requests, performance warnings, preview launch/reuse, and post-change interpretation notes.

- [ ] **Step 1: Write failing static skill-contract tests**

Parse frontmatter, verify the skill description triggers on natural-language motion requests, check every referenced path exists, ensure example CLI commands execute with `--help`, and assert the workflow contains explicit branches for create/update/undo/unsupported/ambiguous requests.

Run: `cd motion-skill && npm run test:unit -- tests/skill-contract.test.ts`

Expected: FAIL because the skill files do not exist.

- [ ] **Step 2: Write `SKILL.md` as a strict orchestration workflow**

Require the skill to inspect current status first; choose `replace` only for a new scene or explicit restart; otherwise generate the smallest patch; map “other things unchanged” to preservation flags; validate before applying; launch or reuse preview; report any interpretation or budget reduction; and ask one focused question only when a safe reversible interpretation is unavailable.

- [ ] **Step 3: Write focused references**

`scene-schema.md` documents every node and valid channel with complete JSON examples. `motion-language.md` maps spatial, rhythmic, force, typography, and subjective phrases to primitives without presenting them as fixed templates. `visual-quality.md` codifies conservative defaults, loop rules, legibility, behavior count, bounded physics, and composition structure.

- [ ] **Step 4: Verify and commit**

Run: `cd motion-skill && npm run test:unit -- tests/skill-contract.test.ts && npm run lint`

Expected: contract tests PASS and lint reports zero errors.

```bash
git add motion-skill/skill motion-skill/tests/skill-contract.test.ts
git commit -m "feat(motion): add conversational motion skill"
```

### Task 9: Full-system verification and user journey

**Files:**
- Create: `motion-skill/README.md`
- Create: `motion-skill/tests/user-journey.test.ts`
- Modify: `motion-skill/package.json`

**Interfaces:**
- Consumes: the complete package and skill.
- Produces: one automated journey proving create → three constrained refinements → undo → invalid-patch recovery.

- [ ] **Step 1: Write the failing end-to-end user-journey test**

Use a temporary state directory to load the character-wave scene, patch only duration while preserving layout/content/palette/motion, patch only palette while preserving layout/content/timing/motion, add seeded timing noise while preserving layout/content/palette, undo the noise patch, submit an invalid negative duration patch, and assert the active revision and evaluated frame remain valid after every step.

Run: `cd motion-skill && npm run test:unit -- tests/user-journey.test.ts`

Expected: FAIL until any missing integration behavior is connected.

- [ ] **Step 2: Fix only integration gaps exposed by the journey**

Keep corrections inside the responsible modules; do not add new primitives or expand first-release scope. Add a regression assertion for every corrected gap.

- [ ] **Step 3: Document setup and usage**

Document Node requirement, install, test, preview launch, state directory, CLI examples for replace/patch/undo, skill installation path, architecture boundaries, performance budgets, supported primitives, and non-goals. Use the radial-breath example for the quick start.

- [ ] **Step 4: Run complete verification**

Run:

```bash
cd motion-skill
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Expected: lint and typecheck report zero errors; all unit/integration tests PASS; Vite production build succeeds; all browser and visual tests PASS.

- [ ] **Step 5: Commit the verified MVP**

```bash
git add motion-skill/README.md motion-skill/tests/user-journey.test.ts motion-skill/package.json motion-skill/package-lock.json motion-skill/src
git commit -m "docs(motion): verify and document MVP"
```

## Final manual acceptance

- [ ] Start the preview using `motion-skill/skill/scripts/preview.sh` and open the reported local URL.
- [ ] Load each of the eight example scenes and confirm the visual result matches its description.
- [ ] Run the three-refinement journey from the skill instructions and confirm the browser never reloads.
- [ ] Confirm “other things unchanged” constraints survive each revision.
- [ ] Confirm undo restores the exact prior scene and an invalid patch leaves it visible.
- [ ] Confirm the preview contains no timeline, layers, chat box, media export, or code editor.
- [ ] Confirm performance warnings state what was reduced rather than silently degrading the scene.
