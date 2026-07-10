# Motion Skill

Motion Skill turns a versioned JSON scene into a live browser preview. Its CLI supports complete scene replacement, constrained RFC 6902 patches, exact undo, validation, and a persistent state directory; the bundled Codex skill translates natural-language requests into those operations.

## Requirements and setup

- Node.js 22 or newer
- npm

```sh
cd motion-skill
npm install
npm run build
```

Run all checks with `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npm run test:e2e`.

## Quick start: Radial Breath

Commands below run from this package directory. State defaults to `.motion-scene`; pass an absolute path to `--state-dir` when callers use a different working directory.

```sh
npm exec -- vite-node src/cli/motion-scene.ts init --name Draft --seed 1 --state-dir .motion-scene
npm exec -- vite-node src/cli/motion-scene.ts validate --file examples/02-radial-breath.json --state-dir .motion-scene
npm exec -- vite-node src/cli/motion-scene.ts replace --file examples/02-radial-breath.json --state-dir .motion-scene
skill/scripts/preview.sh --state-dir .motion-scene --port 0
```

The last command prints JSON containing the local preview `url`. Re-running it reuses a healthy server. The state directory contains authoritative `state.json` plus `current.json` and `history.json` compatibility projections; keep it stable for the lifetime of one conversation.

## CLI workflow

Inspect and validate before changing a scene:

```sh
npm exec -- vite-node src/cli/motion-scene.ts status --state-dir .motion-scene
npm exec -- vite-node src/cli/motion-scene.ts validate --file /tmp/candidate.json --state-dir .motion-scene
```

Replace only when creating a new scene or intentionally starting over:

```sh
npm exec -- vite-node src/cli/motion-scene.ts replace --file /tmp/candidate.json --state-dir .motion-scene
```

For normal refinements, write the smallest JSON Patch and map “keep everything else unchanged” to repeatable preservation flags: `layout`, `content`, `palette`, `timing`, and `motion`.

```sh
npm exec -- vite-node src/cli/motion-scene.ts patch --file /tmp/change.json \
  --preserve layout --preserve content --preserve palette --state-dir .motion-scene
npm exec -- vite-node src/cli/motion-scene.ts undo --state-dir .motion-scene
```

Failed validation or a contradictory preservation constraint leaves the active revision unchanged. Undo restores the previous scene content as a new revision. Run `status` after every mutation.

## Installing the skill

Copy or symlink the checked-in `skill` directory to the personal Codex skill path, preserving its references and scripts:

```sh
mkdir -p "$CODEX_HOME/skills"
ln -s "$(pwd)/skill" "$CODEX_HOME/skills/motion-scene"
```

`CODEX_HOME` commonly defaults to `~/.codex`. Restart or refresh Codex skill discovery after installation. The authoritative usage contract is [skill/SKILL.md](skill/SKILL.md).

## Architecture boundaries

- `src/model`: schema, semantic validation, cost estimation, revision history, patches, preservation, and undo.
- `src/evaluate`: deterministic generators, behaviors, falloffs, transforms, and frame evaluation. It does not own persistence or DOM rendering.
- `src/render`: Canvas 2D drawing only.
- `src/runtime`: the local preview server/client and live state updates.
- `src/cli`: argument validation and durable state orchestration.
- `examples`: eight acceptance scenes; `skill`: the natural-language workflow and authoring references.

State commits are atomic. The preview is the primary artifact and updates without a page reload; it is deliberately not a general-purpose editor.

## Supported scene language

- Elements: text, circle, rectangle, line, polygon, star, and group.
- Generators: linear, grid, radial, path, and seeded scatter.
- Behaviors: wave, seeded noise, spring, follow, look-at, attract, and repel.
- Falloffs: linear, radial, index, seeded random, and time.
- Channels: position, rotation, scale, opacity, plus supported color, typography, geometry, and path-progress channels.

See [skill/references/scene-schema.md](skill/references/scene-schema.md) for the complete fields and reference rules.

## Performance budgets

Simple scenes have a 500-instance budget. Compound scenes—physics behaviors or bindings with two or more falloffs—have a 150-instance budget. The CLI reports a warning and suggested maximum rather than silently degrading output. Reduce generator counts, validate again, and disclose what was reduced. Motion hierarchy is limited to one primary and two supporting bindings.

## Non-goals

The first release does not provide media export, 3D, imported images, audio, a timeline, layer panel, chat box, code editor, user-supplied code, or a general animation authoring UI. It is a focused, local, deterministic 2D scene preview driven through the CLI and skill.
