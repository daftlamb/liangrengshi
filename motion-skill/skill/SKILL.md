---
name: motion-scene
description: Use when a user wants a natural-language motion graphic, a one-sentence modernist opinion card, a Xiaohongshu dynamic content card, text/geometry/particle motion, a browser preview, or Live Photo packaging from rendered JPG/MOV assets.
---

# Motion Scene

Turn the user's words into a scene, keep the browser preview as the primary artifact, and describe results in ordinary language. Never ask the user to edit JSON or run commands.

This renderer supports 2D shapes, text, repeated layouts, procedural motion, falloffs, simple interaction, and modernist opinion cards. It does **not** support 3D, imported images, audio, timeline editing, or user-supplied code.

Read [scene-schema.md](references/scene-schema.md) before authoring JSON. Use [motion-language.md](references/motion-language.md) to interpret phrasing and [visual-quality.md](references/visual-quality.md) for defaults and review.

For a single 12–40 Chinese-character viewpoint, read [opinion-cards.md](references/opinion-cards.md) and use the dedicated generator instead of hand-authoring a generic scene:

`npm exec -- vite-node src/cli/motion-scene.ts opinion --text "真正的壁垒不是模型能力而是进入日常工作流" --seed 1 --state-dir .motion-scene`

## Workflow

Run every CLI example from the `motion-skill` package directory. The documented `npm exec -- vite-node src/cli/motion-scene.ts` runner is package-local and real. Keep one state directory for the conversation and one temporary working directory for candidate JSON and patches.

1. **Inspect status first.** Run status before deciding anything. Read `.motion-scene/current.json` only after status succeeds; it is the current scene projection.

npm exec -- vite-node src/cli/motion-scene.ts status --state-dir .motion-scene

2. Classify the request using exactly one branch:

   - **Create:** If no state exists, initialize it. For a genuinely new scene or an explicit “start over/restart,” write a complete scene candidate and use replace. Replace is destructive in intent; never use it for an ordinary follow-up.
   - **Update:** For every normal follow-up, inspect the current scene and write the smallest JSON Patch array that expresses the change. Do not rewrite unrelated arrays or objects.
   - **Undo:** For “undo,” “go back,” or “revert that,” run undo. Do not synthesize a reverse patch.
   - **Unsupported:** Briefly say what is unsupported, then offer the nearest supported approximation (for example, flat layered shapes instead of 3D). Apply it only if the user's request already makes that approximation safe; otherwise ask whether they want it.
   - **Ambiguous:** Choose a conservative, reversible interpretation when one is safe. When materially different outcomes remain and no safe reversible interpretation exists, ask **one focused question** and stop. Never present a questionnaire.

3. Translate “other things unchanged” into one or more `--preserve` flags: `layout`, `content`, `palette`, `timing`, or `motion`. Use repeated flags. Also preserve unrelated data by keeping the patch small.

4. **validate before apply.** Validate a complete candidate scene before replace. For a patch, apply it to a temporary copy of the current scene and validate that complete candidate before running the real patch command. Never apply merely to discover whether it is valid.

npm exec -- vite-node src/cli/motion-scene.ts validate --file /tmp/motion-candidate.json --state-dir .motion-scene

npm exec -- vite-node src/cli/motion-scene.ts replace --file /tmp/motion-candidate.json --state-dir .motion-scene

npm exec -- vite-node src/cli/motion-scene.ts patch --file /tmp/motion-patch.json --preserve palette --preserve content --state-dir .motion-scene

npm exec -- vite-node src/cli/motion-scene.ts undo --state-dir .motion-scene

5. Check status again after a mutation. Treat a non-zero result or `ok: false` as failure; do not claim a change occurred. If a budget warning appears, lower generator counts while preserving the composition's intent, validate and apply that reduction, then report the budget reduction and its visual consequence.

npm exec -- vite-node src/cli/motion-scene.ts status --state-dir .motion-scene

6. Launch or **reuse** the browser preview. `serve` returns JSON containing `url` and `reused`; open the returned URL. Do not start a second preview when the healthy one is reused.

npm exec -- vite-node src/cli/motion-scene.ts serve --state-dir .motion-scene --port 0

For callers outside the package directory, the checked-in wrapper resolves the package path itself and forwards every argument:

motion-skill/skill/scripts/preview.sh --state-dir .motion-scene --port 0

7. Review the preview for hierarchy, crop, legibility, loop quality, and excessive motion. Make only corrective patches that are clearly necessary; validate each candidate first.

8. Report what changed, the interpretation made for subjective wording, whether an existing preview was reused, and any warning or budget reduction. Keep the response visual and conversational rather than discussing JSON implementation.

## Live Photo packaging

Treat the still card as the primary design. After an external renderer has produced a readable key JPG and a five-second H.264 MOV for Xiaohongshu, package them without duplicating Apple metadata logic:

`python3 skill/scripts/package-live-photo.py output/key.jpg output/motion.mov --platform xiaohongshu`

This adapter packages existing assets only; never claim it rendered the JPG/MOV. Keep generated files in a task/output directory, not in the skill root.

## JSON Patch rules

Patch files are RFC 6902 arrays. Prefer `replace` on a leaf, `add` for one new member, and `remove` for one obsolete member. Paths use JSON Pointer, for example:

```json
[
  { "op": "replace", "path": "/behaviors/0/amplitude", "value": 0.22 }
]
```

Do not patch `/metadata/revision`; the store advances it. Preserve existing IDs and seed unless the request requires changing them. A preservation failure means the patch contradicted the user's constraint: revise the patch, do not drop the flag.

## Initialization

Only initialize when status proves no scene exists. Then author and validate a replacement:

npm exec -- vite-node src/cli/motion-scene.ts init --name Draft --seed 1 --state-dir .motion-scene

After initialization, follow the same Create workflow; the default scene is scaffolding, not the requested design.
