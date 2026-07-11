# Task 5 report

## Implemented

- Canvas 2D renderer for text, circle, rectangle, line, polygon, and star instances with isolated transforms/opacity, DPR backing dimensions, cached text metrics, and contextual render errors.
- Looping requestAnimationFrame preview with canvas-coordinate pointer tracking.
- Minimal preview UI: canvas, play/pause, restart, fullscreen, grid, safe area, scene name, revision, and connection state only.
- Local preview server bound to `127.0.0.1` by default, with `GET /api/scene`, persistent `GET /api/events` SSE, capped reconnect backoff, watched scene updates, and `POST /api/render-failed` rollback through `SceneStore`.
- Playwright coverage for controls, DPR canvas sizing, persistent no-reload revision updates, and failed-render rollback.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit` (63 passed)
- `npm run build`
- `npm run test:e2e -- tests/preview.spec.ts` (1 passed)

## Self-review

- API errors are structured and do not include state paths.
- Server watcher ignores its own rollback write when it matches the active store snapshot.
- Vite output is kept outside the runtime source tree.
- No chat, timeline, layers, or parameter panel was added.

## Concern

- The server uses Vite middleware, so `startPreviewServer` expects Vite to be installed at runtime (currently a project dev dependency).

## Review fixes

- Added a cryptographically random per-server session token plus strict same-origin, token, and JSON content-type checks for render-failure reports.
- Enforced a byte-accurate 16 KiB request limit with single-response handling for oversized, aborted, and errored streams.
- Deduplicated in-flight client failure reports and made every failed or conflicting rollback recover from `GET /api/scene`.
- Made unsupported render types fail contextually, bounded text metrics to a 256-entry LRU used for split-text placement, and avoided backing-store resets unless dimensions or DPR change.
- Expanded browser and unit coverage for authorization failures, body limits, rollback conflicts, recovery, contextual renderer failures, LRU behavior, and DPR changes.
