# Task 6 implementation report

## Delivered

- Added `motion-scene` CLI commands: `init`, `validate`, `replace`, `patch`, `undo`, `status`, and `serve`.
- Added isolated `--state-dir` support with defaults at `.motion-scene/current.json` and `.motion-scene/history.json`.
- Added sibling temporary-file plus rename writes for scene, history, and preview server metadata.
- Added structured JSON success/failure results, preservation constraints, validation, revision history, undo, and budget warnings.
- Added a cwd-independent `skill/scripts/preview.sh` launcher.
- Added preview server PID/port persistence and healthy-server reuse; preview continues to bind to loopback by default.
- Updated the runtime server to watch the canonical `current.json` state file.

## TDD evidence

- RED: `npm run test:unit -- tests/cli.test.ts` failed 4/4 because the CLI entry point did not exist.
- GREEN: the same command passed 4/4 after implementation.
- Related regression: CLI and patch-store tests passed 20/20.
- TypeScript: `npm run typecheck` exited successfully.

## Self-review

- Invalid patches are evaluated in memory before persistence, so current/history files remain unchanged on failure.
- The server reuse check verifies the recorded URL with `/api/scene`, rather than trusting a stale PID file.
- Detached preview output is ignored so the invoking CLI exits cleanly; tests terminate the spawned PID.
- No root lockfiles, dependency directories, build output, or test results are included in the commit.

## Review fixes

- Added authoritative atomic `state.json` commits. `current.json` and `history.json` remain compatible projections and are rebuilt from the committed state on every state load, including recovery after an injected second-projection failure.
- Hardened atomic writes with exclusive randomized sibling files, file and directory fsync, and unconditional temporary-file cleanup.
- Replaced trusted metadata URLs with a strict PID/port/identity/session schema and a derived loopback health URL. Reuse requires a live PID and an exact identity response from `/api/health`.
- Added bounded cleanup for positively identified preview children, safe metadata-only cleanup when ownership cannot be established, launch-timeout cleanup, and exact requested-port reuse semantics.
- Added explicit per-command option schemas, validation for integer/range values, duplicate/unknown/missing option rejection, and exactly one structured failure object on stdout.
- Added regression coverage for transactional recovery, malicious URL metadata, stale unowned PIDs, explicit port mismatch, malformed options, and temporary-file cleanup.

## Second review fixes

- Made `state.json` the sole authority. Legacy migration now occurs only when it is absent (`ENOENT`) and only when `current.json` exactly matches the final history entry; corrupt/unreadable authority files fail without fallback or rewrite.
- Treats the authoritative rename+fsync as the commit point. Projection failures now return `ok: true`, the committed revision, and a warning; the next load repairs both compatibility projections without reapplying the command.
- Moved preview initialization and directory watching to authoritative `state.json`, including atomic authoritative rollback writes, eliminating the compatibility-cache visibility window.
- Removed all signalling and liveness probes based on persisted PIDs. Healthy reuse relies on the loopback identity response; only the `ChildProcess` returned by the current invocation can receive bounded TERM/KILL cleanup on launch timeout.
- Added regressions for corrupt-authority preservation, inconsistent migration rejection, successful projection-warning semantics, and no double apply.

## Final verification

- `npm run test:unit`: 75/75 tests passed across 8 files.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.

## Concern

- `npm run test:e2e` currently discovers Vitest unit files through the Playwright configuration and fails before browser execution with “Vitest failed to access its internal state.” This is an existing test-runner configuration issue; the requested unit/typecheck/lint/build/diff checks pass independently.
