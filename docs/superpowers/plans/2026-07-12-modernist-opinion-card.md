# Modernist Opinion Card v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-opinion-to-modernist-motion-card workflow with a Live Photo packaging boundary.

**Architecture:** A pure opinion analyzer/composer produces the existing `Scene` type. The CLI persists that scene through `SceneStore`; the skill orchestrates preview and optional Live Photo packaging without adding a timeline editor.

**Tech Stack:** Existing TypeScript, Zod, Vitest, Canvas 2D, CLI, and Python/Swift Live Photo packaging helper.

## Global Constraints

- Accept one 12–40 Chinese-character opinion and at most two emphasized phrases.
- Output 900×1200, five seconds, modernist palette, stable seed, and at most three bindings.
- Preserve the existing scene engine and preview runtime.
- Live Photo packaging consumes an already rendered JPG/MOV pair; it does not hide missing frame rendering.

---

### Task 1: Opinion analysis and deterministic scene composition

**Files:** Create `motion-skill/src/opinion/compose.ts`; test `motion-skill/tests/opinion-card.test.ts`.

- [ ] Write failing tests for length validation, contrast/focus/converge/propagate inference, two-emphasis cap, deterministic scene output, 900×1200 dimensions, five-second duration, palette, and valid semantic scene.
- [ ] Run `npm run test:unit -- tests/opinion-card.test.ts`; expect missing-module failure.
- [ ] Implement `analyzeOpinion(text)` and `composeOpinionCard({text, seed})` with no I/O.
- [ ] Re-run the focused test; expect PASS.

### Task 2: CLI and skill workflow

**Files:** Modify `motion-skill/src/cli/motion-scene.ts`, `motion-skill/skill/SKILL.md`, and relevant references/tests.

- [ ] Add failing CLI tests for `opinion --text ... --seed ... --state-dir ...` and strict help parsing.
- [ ] Implement the command through existing init/replace persistence.
- [ ] Update the skill to route one-sentence viewpoint requests through `opinion`, then preview and refine through patches.
- [ ] Run CLI and skill-contract tests; expect PASS.

### Task 3: Live Photo packaging adapter and full verification

**Files:** Create `motion-skill/skill/scripts/package-live-photo.py`; create focused adapter tests; update references.

- [ ] Write a failing dry-run test that validates JPG/MOV inputs, platform duration metadata, output path, and the exact external packaging invocation.
- [ ] Implement a thin adapter around the installed Guizang/makelive packaging path without duplicating Apple metadata code.
- [ ] Run lint, typecheck, full unit suite, build, browser tests, and `git diff --check`.
- [ ] Commit and update the installed `~/.codex/skills/motion-scene` copy after verification.
