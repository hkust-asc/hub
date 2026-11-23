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
- Choose A job through HPC4 for a ten-step cluster-to-node journey, or Host to GPU for the six-step explicit-copy operation.
- Host to GPU is the reference storyboard: H/D markers connect the diagram to readable host/device buffer states. Copy and compute steps show the state after the operation; animated routes are explanatory, not a simulation.
- Lessons start paused. Use Next, the scrubber, or Jump to step at your own pace; Play enables automatic advancement with per-step reading holds.
- Inspection pauses the lesson without changing its buffer states or teaching focus. Back to this step restores the lesson subject and stays paused; Play resumes automatic advancement.
- One player owns playback, previous/next, progress scrubbing, and restart. Return through the same scenario navigation item to resume after exploring (within the current page session).
- Compare local and cross-socket CPU/memory placement. Changing placement pauses playback on the same step.
- Separate the drawing's layers, reset the node view without rewinding the scenario, or export its SVG.
- Open Illustrative topology for sources and assumptions. Diagram links are not a measured wiring map.
- Scene/subject URLs such as `#cluster/lmod` and `#a30/numa` support direct links and browser Back.

During a lesson, the explanation replaces the always-open reference panel. On narrow screens it appears above playback and the diagram; Inspect a subject reveals the shared reference details. SVG export remains a static diagram, with buffer captions when a GPU lesson is active, not an interactive lesson package.

The published A30 profile has two Xeon Gold 6448Y sockets, four A30 GPUs with 24 GB HBM2 each, and 512 GB DDR5 host memory. These figures and the overview's other node-family profiles come from the [official HPC4 specification](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4), checked on 2026-10-19. Storage notes follow the [official storage policies](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4/fileandstorage).

Component positions, memory-module counts, CPU/GPU/NIC affinity, PCIe routes, and socket-locality regions are illustrative, not measured HPC4 topology. The drawing does not claim one NUMA domain per socket. Cluster glyphs represent families, not racks or inventory counts. The storage relationship does not establish a physical network route. The GPU operation intentionally excludes unified memory, asynchronous overlap, and performance prediction; the connected scenario explains file writing schematically without modeling storage I/O. Animation timing does not represent hardware speed. Commands containing angle-bracket placeholders are illustrative, not ready-to-run job templates.

## Structure

- `src/model.ts`: subject content, evidence, scene-aware scenarios, state transitions, transfer paths.
- `src/scene.ts`: reusable projected boxes, node cutaway, and cluster-family glyphs.
- `src/layout.ts`: semantic workspace shell, grouped navigation, shared inspector, and scenario player.
- `src/main.ts`: accessible controls, scenario playback, inspection, SVG export.
- `src/app.css`: visual styling, responsive layout, reduced-motion behavior.
- `tests/model.test.ts`: locality, transfer direction, cross-scene navigation, playback, and reset tests.