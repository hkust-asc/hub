---
name: verify-hub-app
description: Launch, check, drive, and verify the HPC4 Hub web application end-to-end across Learn, Practice, Weeks, Atlas, Quick Switcher (Ctrl+K), Explore cutaways, and Stage scenarios. Use when changing UI, routes, scenarios, layout styles, or interactive workflows in hkust-asc/hub.
---

# Verify HPC4 Hub

This skill drives the live HPC4 Hub Vite web application on an isolated localhost port and disposable Chromium profile, paired with the deterministic link-graph verifier and TLA+ formal suite. Read [features/README.md](./features/README.md) before driving a specific user journey.

## Static & formal preflight

Run the fast deterministic checks from the repository root before booting a browser:

```sh
node scripts/check-state-machines.ts
npm run check
bash formal/check.sh
```

- `node scripts/check-state-machines.ts` verifies all 5 registered state machines, 100 canonical route nodes, 970 cross-link and `Think Back` edges, zero orphan targets, and bidirectional `lesson <-> concept` / `mission <-> concept` symmetry. Pass `--mermaid` to inspect the route graph as Mermaid.
- `npm run check` runs `node --test "tests/*.test.ts"` (including `tests/link-graph.test.ts`, `tests/model.test.ts`, `tests/platform.test.ts`, and `tests/practice-*.test.ts`) followed by `tsc && vite build`.
- `bash formal/check.sh` runs TLC 1.7.4 across all 6 TLA+ models (`Mission`, `Shell`, `VFS`, `Audit`, `StageRunner`, `Navigation`).

## Launch

Pick a unique `RUN_ID` (for example `verify-$(date +%s)`) so concurrent worktrees or sessions never collide on ports or browser `localStorage`:

```sh
RUN_ID="verify-$(date +%s)"
EVIDENCE_DIR="/tmp/hub-evidence-${RUN_ID}"
node .agents/skills/verify-hub-app/scripts/control-hub.ts launch --run-id "$RUN_ID"
```

What `launch` guarantees:

- Installs `node_modules` via `npm ci` automatically if `node_modules/.bin/vite` is absent in a fresh git worktree.
- Allocates an unused loopback port (`127.0.0.1:<port>`) with `--strictPort`—never sharing or hijacking another session's dev server.
- Writes `/tmp/hub-verify-$RUN_ID/instance.json` (`pid`, `port`, `url`, `repoRoot`, `commit`) and waits until both `GET /` (matching `<div id="app">` and `/src/entry.ts`) and `GET /src/catalog.ts` return HTTP 200.

## Doctor

Run this read-only health check before driving or whenever behavior looks unexpected:

```sh
node .agents/skills/verify-hub-app/scripts/control-hub.ts doctor --run-id "$RUN_ID"
```

`doctor` confirms that `instance.json` belongs to the current `repoRoot`, the recorded Vite `pid` is alive, `/proc/<pid>/cmdline` matches our `vite --port <port>` process, and HTTP module serving is responsive. Refuse to drive any server that fails `doctor`.

## Drive

Drive the live app through real DOM clicks, forms, keyboard shortcuts, media emulation, and viewport resizes using a disposable headless Chromium `--user-data-dir` via CDP:

```sh
node .agents/skills/verify-hub-app/scripts/control-hub.ts drive \
  --run-id "$RUN_ID" \
  --evidence-dir "$EVIDENCE_DIR" \
  --journey all
```

Supported `--journey` selectors (`all` runs every journey in order):

- `modes` — clicks topbar mode tabs (`Learn`, `Practice`, `Weeks`, `Atlas`), enters `#cluster` and `#a30`, toggles `Explode` (`#explode-button`) and `Cross-socket` (`#remote-button`), verifies `Reset view` (`#reset-button`), and navigates back via `#think-back`.
- `search` — dispatches `Control+K`, verifies `<dialog id="switcher" open>`, queries `streams`, asserts `#lesson/streams`, `#practice/3`, and `#atlas/concept/standard-streams` appear with zero `planned` leaks, and closes cleanly with `Escape`.
- `stage` — mounts `#lesson/host-to-gpu`, steps with `[data-stage-next]`, toggles `Cross-socket` (`[data-stage-variant="remote"]`), starts `Auto` (`[data-stage-play]`), enters `Inspect` (`[data-stage-inspect]`), verifies `Escape` exits Inspect while restoring Autoplay on the same step, emulates `prefers-reduced-motion: reduce` to confirm immediate `scaleX(1)` settling, and verifies the persisted `hpc4:learning:v1` bookmark via `#resume-slot` on `#atlas`.
- `practice` — opens `#practice/1`, submits `ls -a` and `cat .vault/.access_key` through `.terminal-form`, confirms `Mission complete` + `hpc4-hub.practice.act1` persistence, and checks `#atlas/concept/dotfiles` for the `Practiced ✓` pill.
- `layout` — sweeps `320`, `390`, `768`, `1152`, and `1440` CSS-pixel viewports across `#atlas`, `#a30`, `#lesson/host-to-gpu`, and `#practice/1`, failing if `documentElement.scrollWidth > window.innerWidth + 1`.

When inspecting custom interactive changes interactively in VS Code, pair `launch` + `doctor` with the integrated browser tools (`openBrowserPage`, `readPage`, `clickElement`, `typeInPage`, `screenshotPage`) against the `url` printed by `doctor`, preferring ARIA roles and stable `data-*` / `#id` handles over DOM coordinates.

## Evidence

Proof artifacts are written to `--evidence-dir` (for example `/tmp/hub-evidence-$RUN_ID/` or the session's durable `files/` folder), never inside `/tmp/hub-verify-$RUN_ID/`:

- `01-a30-cutaway-exploded.png` — `#a30` cutaway with exploded layers and cross-socket locality active.
- `02-quick-switcher-streams.png` — `<dialog#switcher>` showing Learn, Practice, and Atlas destinations for `streams`.
- `03-stage-host-to-gpu-inspect.png` — `Host to GPU` scenario paused in `Inspect` mode on Step 03 (`Copy in`).
- `04-practice-mission1-complete.png` — simulated terminal completion and state X-ray for Mission 01.
- `05-layout-stage-390w.png` & `05-layout-stage-1440w.png` — mobile (`390px`) and wide desktop (`1440px`) stage bounds.
- `verification-report.json` — structured log of actions, observed DOM/ARIA states, `localStorage` values (`hpc4:learning:v1`, `hpc4-hub.practice.act1`), and the 20-cell responsive overflow matrix.

Proof standards:

- Exercise user-facing controls (`click()`, form `requestSubmit()`, `KeyboardEvent`), never internal TypeScript state setters.
- Verify persisted mutations from a second user-facing surface (`#resume-slot` on `#atlas` for `Learn` bookmarks; `Practiced ✓` on `#atlas/concept/<id>` for `Practice` awards).
- Confirm `--evidence-dir` files still exist *after* running `cleanup`.

## Cleanup

Always tear down the server you started—including after failed runs:

```sh
node .agents/skills/verify-hub-app/scripts/control-hub.ts cleanup --run-id "$RUN_ID"
```

- Terminates only the exact Vite `pid` (and its detached process group `-pid`) recorded in `/tmp/hub-verify-$RUN_ID/instance.json`—never `pkill` or `killall`.
- Deletes `/tmp/hub-verify-$RUN_ID/` scratch state and temporary Chromium profiles while preserving `--evidence-dir`.

## Helpers & maintenance

- Helper CLI: [scripts/control-hub.ts](./scripts/control-hub.ts) (`chmod +x`, native Node 22.18+ / Node 26 TypeScript, zero extra npm packages).
- Feature map: [features/README.md](./features/README.md) and its per-feature journey specs. Use `/maintain-verification-skill` to keep the feature map synchronized when routes or controls evolve.
