# HPC4 Anatomy: Scene-Based Architecture Explorer

A small Vite / TypeScript app built with reusable, fixed-angle SVG parts. No 3D engine, external API, or live HPC connection is required. Fonts and icons are bundled locally.

The agreed product direction is recorded in [DIRECTION.md](DIRECTION.md), including the Create Ponder-inspired interaction model, reuse boundaries, evidence policy, and near-term sequence. [CONTEXT.md](CONTEXT.md) defines the shared scene/scenario vocabulary.

For the agent-led authoring loop, reference lesson, acceptance checks, and next milestone, see [AUTHORING.md](AUTHORING.md).

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1
```

## Verify

```sh
npm run check
```

This runs the model tests and production build/type-check. Use `npm test` for model-only changes. The model tests require Node.js 22.18 or newer for native TypeScript execution.

## Explore

- Use the left navigation, grouped into System, Software, and Scenarios. On phones it becomes a keyboard-accessible drawer.
- Select hardware in a diagram or use the shared Inspect subject menu. Secondary explanations and related ideas are under Why it matters.
- Open the A30 cutaway from the navigation or its subject notes. Software subjects remain distinct from physical components.
- Choose **A job through HPC4** for a ten-step cluster-to-node journey. It starts paused; use Next, the scrubber, or Jump to step. Play advances automatically. In the walkthrough, **Back to this step** closes the inspector without restarting playback.
- Return to the walkthrough from its navigation item to resume after exploring within the same page session.
- Compare local and cross-socket CPU/memory placement. Changing placement pauses playback at the current position.
- Separate the drawing's layers, reset the node view without rewinding the scenario, or export its SVG.
- Open Illustrative topology for sources and assumptions. Diagram links are not a measured wiring map.
- Scene/subject URLs such as `#cluster/lmod` and `#a30/numa` support direct links and browser Back.

The cluster walkthrough uses the explorer's diagram and inspector. Its SVG export is a static diagram, with buffer captions when the walkthrough is inside the node.

### Host to GPU

Choose **Host to GPU** under **Scenarios**, or open `?lesson=host-to-gpu`. It autoplays six beats with captions next to the relevant hardware. Drag the segmented scrubber to seek to any moment, or choose a beat by name. **Inspect** pauses playback: hover or focus a part for its name and role, or select it to pin details. Leaving Inspect returns to the same moment and resumes only if the lesson was playing.

The published A30 profile has two Xeon Gold 6448Y sockets, four A30 GPUs with 24 GB HBM2 each, and 512 GB DDR5 host memory. These figures and the overview's other node-family profiles come from the [official HPC4 specification](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4), checked on 2026-10-19. Storage notes follow the [official storage policies](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4/fileandstorage).

Component positions, memory-module counts, CPU/GPU/NIC affinity, PCIe routes, and socket-locality regions are illustrative, not measured HPC4 topology. The drawing does not claim one NUMA domain per socket. Cluster glyphs represent families, not racks or inventory counts. The storage relationship does not establish a physical network route. The GPU operation intentionally excludes unified memory, asynchronous overlap, and performance prediction; the connected scenario explains file writing schematically without modeling storage I/O. Animation timing does not represent hardware speed. Commands containing angle-bracket placeholders are illustrative, not ready-to-run job templates.

## Structure

- `src/model.ts`: subject content, evidence, scene-aware scenarios, state transitions, transfer paths.
- `src/scene.ts`: reusable projected boxes, node cutaway, and cluster-family glyphs.
- `src/layout.ts`: semantic workspace shell, grouped navigation, shared inspector, and scenario player.
- `src/main.ts`: exploration, the connected job walkthrough, inspection, and SVG export.
- `src/host-to-gpu/`: the GPU lesson's timed beats, anchored callouts, scrubber, and inspector.
- `src/app.css`: visual styling, responsive layout, reduced-motion behavior.
- `tests/model.test.ts`: locality, transfer direction, cross-scene navigation, playback, and reset tests.