---
name: verify-stage-and-navigation
description: Verify HPC4 Hub stage scenario playback, Inspect/reduced-motion invariants, async lesson cancellation, Think Back trail pruning, overlay Escape precedence, and the canonical route/link graph when changing src/stage/{runner,player}.ts, src/catalog.ts, src/main.ts, or src/platform/{links,codex,curriculum,search,views}.ts.
---

# Stage runner, navigation, and route link graph

From the repository root run:

```sh
bash formal/check.sh StageRunner
bash formal/check.sh Navigation
node scripts/check-state-machines.ts
npm test
```

`formal/check.sh` bootstraps checksum-pinned TLC 1.7.4 and Zulu JRE 21.0.8 on Linux x86_64 into `${XDG_CACHE_HOME:-$HOME/.cache}/hub-formal` (requires Bash, `curl`, `tar`, and `sha256sum`; first run needs network). Read every TLA+ result with the pstack `/statechart` skill. Inspect `formal/StageRunner/{StageRunner.tla,StageRunner.cfg,view.mjs,charts.md}` and `formal/Navigation/{Navigation.tla,Navigation.cfg,view.mjs,charts.md}`, and run `node scripts/check-state-machines.ts --mermaid` to inspect the full route topology chart.

## Code and step boundaries

Sync commit: `cb52c96b6d7dd3b0e6fbce4385b9f95b4e409a65`.

### 1. `formal/StageRunner/` → `src/stage/runner.ts` & `src/stage/player.ts`

| Model | Implementation |
|---|---|
| `Init`, `FreshBeat` | `createInitialRunnerState` and `freshBeat` in `src/stage/runner.ts`. `beat` uses `{0, 1, 2}` for start (`0`), mid-entrance (`0 < beatProgress < 1`), and canonical settled state (`beatProgress = 1`). |
| `GotoFirst`, `NextStep`, `PrevStep`, `ReplayStep` | `reduceRunnerState` cases `'goto'`, `'next'`, `'prev'`, and `'replay-step'`. Explicit step transitions clear `inspecting`, `resumeAutoplayAfterInspect`, and `dwellElapsedMs`. |
| `ToggleAutoplay`, `Pause` | `reduceRunnerState` cases `'toggle-autoplay'` (including restart from step `0` when settled at `maxIdx`) and `'pause'` (also invoked by `mounted.pause()` on visibility hide, modal open, or mobile drawer open). |
| `EnterInspect`, `ToggleInspect` | `reduceRunnerState` cases `'enter-inspect'` and `'toggle-inspect'`, dispatched by `[data-stage-inspect]`, component click/Enter, and `Escape` in `src/stage/player.ts`. Entering Inspect saves `autoplay` into `resumeAutoplayAfterInspect`; toggling Inspect off restores `autoplay`. |
| `SwitchVariant` | `reduceRunnerState` case `'set-variant'` (`Local` vs. `Cross-socket`), pausing autoplay, leaving Inspect, and replaying `freshBeat`. |
| `Tick` | `reduceRunnerState` case `'tick'` driven by `paintFrame` in `src/stage/player.ts`: frozen during `inspecting`, snaps immediately to `beatProgress = 1` under `reducedMotion`, advances `beatProgress` before accumulating `dwellElapsedMs`, and auto-advances only while `autoplay` is true. |

Bounds and scope: 3 steps (`0..2`), discrete beat `{0, 1, 2}`, discrete dwell `{0, 1}`, two variants (`local`, `remote`), and both standard and reduced-motion modes (`120` distinct reachable states). Exact millisecond interpolation, playback rate multipliers (`0.5x`/`1x`/`2x`), SVG geometry, and `ResizeObserver` camera framing are covered by `tests/model.test.ts` and `verify-hub-app` rather than TLA+.

### 2. `formal/Navigation/` → `src/main.ts`, `src/catalog.ts`, `src/platform/search.ts`, `src/stage/player.ts`

| Model | Implementation |
|---|---|
| `NavigateTo`, `ApplyRoute` | `navigateTo`, `applyParsedRoute`, `stopActiveLesson`, and `ensureLessonMounted` in `src/main.ts`; `pushTrail` and `pruneTrailForDestination` in `src/catalog.ts`. |
| `SelectWorkbenchSubject` | In-place `history.replaceState` transitions in `src/main.ts` (`dispatchScene` with `select`/`cluster-select` and `[data-atlas-mode]` toggles) that call `pruneTrailForDestination(trail, nextHash)`. |
| `ThinkBack` | `#think-back` click handler in `src/main.ts` using `popTrail(trail)` with `recordTrail: false` and `fallbackBackTarget(currentRoute, state)` when `trail` is empty. |
| `ResolveCurrentLoad`, `ResolveStaleLoad` | Dynamic `await lessonLoaders[lessonId]()` in `ensureLessonMounted` (`src/main.ts`), guarded by `token !== lessonLoadToken \|\| currentRoute.view !== 'lesson' \|\| currentRoute.lesson !== lessonId`. |
| `OpenSearch`, `OpenEvidence`, `OpenDrawer`, `SwitchViaSearch` | `openSwitcher` (`Ctrl+K`, `<dialog#switcher>`), `openEvidence` (`<dialog#evidence-dialog>`), and `#menu-button` (`.navigation-open` drawer) in `src/main.ts` and `src/platform/search.ts`, each calling `activeLesson?.mounted.pause()`. |
| `StartStageAutoplay`, `EnterStageInspect`, `PinStagePart`, `PressEscape` | Layered `Escape` handling across `switcher` (`stopPropagation`), `evidence-dialog` (`stopPropagation`), `#sidebar` (`preventDefault` before `closeNavigation`), and `src/stage/player.ts` (`pinnedPart` unpin before `toggle-inspect`). |

Bounds and scope: 5 representative routes (`atlas`, `a30_gpu`, `a30_mem`, `lesson_gpu`, `lesson_ssh`), bounded trail slice, active vs. superseded async scenario imports, and 4 overlay/stage focus layers (`460` distinct reachable states). Full 100-node route/link graph enumeration, 12-item trail cap, legacy URL normalization, and bidirectional cross-links (`lesson <-> concept`, `mission <-> concept`, `lesson <-> mission`, `week <-> *`) are checked exhaustively by `scripts/check-state-machines.ts` and `tests/link-graph.test.ts`.

## Prove and maintain

Run the six negative-control variants and verify each fails its target invariant (never a syntax or JVM error):

```sh
bash formal/check.sh StageRunner inspect_clobber   # violates InspectPreservesContext
bash formal/check.sh StageRunner reduced_stall     # violates ReducedMotionSettlesImmediately
bash formal/check.sh StageRunner reader_drift      # violates ReaderPacedNeverAutoAdvances
bash formal/check.sh Navigation stale_mount        # violates MountedMatchesActiveLesson
bash formal/check.sh Navigation trail_loop         # violates BackNeverSelfLoops
bash formal/check.sh Navigation escape_leak        # violates OverlayEscapeIsolation
```

Rerun `bash formal/check.sh StageRunner`, `bash formal/check.sh Navigation`, and `node scripts/check-state-machines.ts` afterwards to confirm the baseline passes. When investigating a counterexample, replay the shortest step sequence directly against `reduceRunnerState` (`tests/model.test.ts`) or `pushTrail`/`pruneTrailForDestination`/`parseRoute` (`tests/link-graph.test.ts`) before concluding whether the code or model projection diverged. Never weaken an invariant to silence a real counterexample. Use `/maintain-formal-verification-skill` after intentional behavior changes and advance the sync commit only once code, TLA+ specs, `charts.md`, and tests agree.
