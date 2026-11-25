# Authoring and reviewing a scenario

## Current reference

All guided scenarios run on one unified stage and step engine (`src/stage/`) paired with the shared isometric projector (`src/iso.ts`):

- **2.5D + 2D schematic scenarios**: [src/first-job/story.ts](src/first-job/story.ts), [src/ssh-tmux/story.ts](src/ssh-tmux/story.ts), [src/module-load/story.ts](src/module-load/story.ts), [src/streams/story.ts](src/streams/story.ts), and [src/linux-fs/story.ts](src/linux-fs/story.ts) compose standardized block primitives (`plinth`, `brick`, `card`, `tile`, `port`) and typed wires (`control`, `data`, `fault`, `mount`, `tree`) inside a 7-layer `<svg>` stage.
- **3D isometric hardware scenarios**: [src/host-to-gpu/player.ts](src/host-to-gpu/player.ts) mounts the A30 cutaway ([src/scene.ts](src/scene.ts) + [src/iso.ts](src/iso.ts)) through [src/stage/iso-scene.ts](src/stage/iso-scene.ts) with native SVG buffer tokens, `Local` vs. `Cross-socket` variants, and camera `viewBox` framing.

Use Vite reload, reader-paced `Prev` / `Next` (`←` / `→`), `Auto` playback, `Replay` (`R`), `Fit` (`0`), and `Inspect` (`I`) to preview edits. The Explore node view can export a static SVG snapshot.

## Agent-led loop

1. Pick one learner question and write the misconception the scenario should correct. Read [CONTEXT.md](CONTEXT.md) and [DIRECTION.md](DIRECTION.md).
2. Inspect current code and worktree changes. Preserve unrelated work. Reuse an existing subject or block primitive before adding one.
3. Author pure per-step states (`evaluate(stepIndex, beatProgress, variant, compact)`), HUD state invariants, and `"What changed"` deltas before polishing causal packet motion. Keep published facts, illustrative choices, and unknowns distinguishable.
4. Validate dual-mode (`wide` and `compact`) bounds and wire routing with `validateStageSpec` in [tests/model.test.ts](tests/model.test.ts). Do not add external layout or animation libraries.
5. Run `npm run check`. Use `npm test` while iterating on the state model.
6. Run `npm run dev -- --host 127.0.0.1`, open the local page, interact with it, inspect screenshots, and check actual element bounds across `320`, `390`, `768`, `1152`, and `1440` CSS pixels. A successful build does not prove text fits inside its box.
7. Review the acceptance checks below. Revise the scenario before generating more assets.
8. Summarize changed behavior, checks actually run, remaining limitations, and any specific human review needed. Stop temporary preview processes when finished.

## Content contract

- [src/stage/types.ts](src/stage/types.ts) defines the standardized block primitives (`plinth`, `brick`, `card`, `tile`, `port`), port-anchored typed wires, HUD chips, code panel, and `"What changed"` deltas.
- [src/stage/layout.ts](src/stage/layout.ts) resolves parent-nested boxes, orthogonal rounded wire paths, `viewBox` camera framing, and `validateStageSpec` collision checks synchronously without runtime layout libraries.
- [src/stage/renderer.ts](src/stage/renderer.ts) renders the 7-layer SVG stage (`grid → floor → host plinths → base tracks → child/standalone entities → active wires/fault marks → packets & pins`) so connections inside or into 2.5D host plinths are never occluded.
- [src/stage/iso-scene.ts](src/stage/iso-scene.ts) adapts 3D isometric hardware scenes ([src/scene.ts](src/scene.ts), [src/iso.ts](src/iso.ts)) to the same stage controller, camera zoom, and SVG token layer.
- [src/stage/runner.ts](src/stage/runner.ts) and [src/stage/player.ts](src/stage/player.ts) own reader-paced stepping, optional Autoplay dwell, `Replay` (`R`), `Fit` (`0`), and `Inspect` (`I`) mode. Derive every visual purely from `(stepIndex, beatProgress, variant, compact)` where `beatProgress === 1` is the canonical resting state.
- [src/main.ts](src/main.ts) owns the Concept Atlas, Explore workbench (`#cluster`, `#a30`), and scenario loader (`#lesson/<id>` and `#lesson/<id>/<step>`).
- Match visual dimensionality to what a part is:
  - **3D isometric blocks** (`src/iso.ts`, `src/scene.ts`) when physical board locality (NUMA sockets, PCIe lanes) is the point.
  - **Orthographic 2.5D `plinth` hosts and `brick` units** when physical machines/GPUs/disks and software share a schematic.
  - **Flat 2D `card`, `tile`, and `port` blocks** for schedulers, shells, module environments, streams, and directory paths. Keep all dynamic or multi-line text on flat 2D surfaces and in the structured Step & State Rail.
- Static resting states (`beatProgress = 1`), HUD chips, and `"What changed"` deltas must convey the mechanism clearly with motion disabled. Keep the schematic qualification with the sources rather than repeating it in every step.

Keep source content trusted and reviewed. This app is not a safe arbitrary JSON/SVG importer. A future external-content pipeline will need validation and SVG sanitization before rendering.

## Acceptance checks

### Model, layout & build gate

```sh
npm run check
```

Add focused tests to [tests/model.test.ts](tests/model.test.ts) covering state invariants and `validateStageSpec` (`wide` and `compact` non-overlap, child-inside-parent bounds, and wire routing). Avoid tests that simply compare authored prose with itself.

### Browser gate

These are browser checks, not part of `npm run check`:

- Step forward and backward (`←` / `→` and step pills) across every scenario. Every step must settle cleanly at `beatProgress = 1` without leaving stale packets or wires.
- In **Host to GPU**, toggle **Local** and **Cross-socket** during Copy in/out, and test **Fit** (`0`) to zoom out to the full A30 board and back. Host RAM retains Input after H2D; GPU HBM2 retains Result after D2H; buffers clear on Finish.
- In **SSH & tmux**, verify that foreground execution stops after the SSH drop while detached `tmux: sim` advances and writes `~/sim_result.txt` on reattach.
- In **Streams & redirection**, verify that Step 3 (`Predict 2>`) holds on the `?` anticipation state before Step 4 reveals the quiet terminal and separated files.
- Toggle **Inspect** (`I` or clicking any component) with mouse and keyboard (`Tab`, `Enter`, `Escape`). Leaving Inspect must preserve the active step and Autoplay intent.
- Check `prefers-reduced-motion: reduce`: steps snap immediately to their resting state (`beatProgress = 1`) with static routes and arrowheads, and Autoplay still advances after reading dwell.
- Check `320`, `390`, `768`, `1152`, and `1440` CSS pixels wide: zero horizontal page overflow, zero text clipping outside entity boxes, and zero title/badge collisions.
- Leave the scenario and check normal Explore scenes (`#cluster`, `#a30`), Explode toggle, view reset, navigation drawer, and SVG export.
