# Guided Infographic Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated infographic cards geometrically correct and optionally art-directed without making first generation form-driven.

**Architecture:** Add a pure layout module that resolves anchored text, node positions, and arrow geometry before converting output into the existing `Scene` primitives. Add a `direction` object to diagram composition options and map CLI defaults plus natural-language settings to it.

**Tech Stack:** Existing TypeScript, Vitest, Zod scene validation, Canvas 2D renderer, and CLI.

## Global Constraints

- Default generation remains one sentence → modernist card.
- Guided controls are optional: composition, palette, motion, typography, visual language, output.
- Multi-line left-aligned text shares one calculated left edge.
- Arrowheads align with the final edge tangent and terminate outside node boundaries.
- Keep existing opinion and diagram commands compatible.

---

### Task 1: Anchored text and relation-edge layout primitives

**Files:** Create `motion-skill/src/layout/anchors.ts`, `motion-skill/src/layout/relations.ts`; test `motion-skill/tests/layout.test.ts`.

- [ ] Write failing tests for equal left bounds across two title lines, horizontally centered pair bounds, edge endpoints outside circles, and arrow rotation matching the edge vector.
- [ ] Run `npm run test:unit -- tests/layout.test.ts`; expect module-not-found failure.
- [ ] Implement `leftTextBlock`, `centeredPair`, and `relationEdge` returning scene-ready positions, line endpoints, and polygon arrowhead rotation.
- [ ] Run the focused test; expect all layout assertions to pass.

### Task 2: Guided diagram composer

**Files:** Modify `motion-skill/src/opinion/diagram.ts`; test `motion-skill/tests/diagram-card.test.ts`.

- [ ] Write failing tests that `composeDiagramCard` accepts optional direction fields, produces true left-aligned title elements, applies palette tokens, and uses the relation-edge helper.
- [ ] Run `npm run test:unit -- tests/diagram-card.test.ts`; expect missing option/output assertions.
- [ ] Implement direction defaults: causal composition, electric-blue palette, calm motion, sans typography, and nodes/edges visual language.
- [ ] Run focused diagram tests; expect pass.

### Task 3: CLI and skill guidance

**Files:** Modify `motion-skill/src/cli/motion-scene.ts`, `motion-skill/skill/SKILL.md`, `motion-skill/skill/references/opinion-cards.md`; test `motion-skill/tests/cli.test.ts` and `motion-skill/tests/skill-contract.test.ts`.

- [ ] Write failing CLI tests for optional `--composition`, `--palette`, `--motion`, and `--typography` values and invalid-value rejection.
- [ ] Implement strict options and map them to the direction object without changing default output.
- [ ] Document direct generation plus optional guided controls; explain that natural language maps to the same fields.
- [ ] Run lint, typecheck, full unit tests, build, browser tests, and `git diff --check`.
