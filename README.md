# HPC4 Anatomy: Scene-Based Architecture Explorer

A small Vite / TypeScript explorer for HPC and ASC workshop concepts, with HPC4 as a concrete example. It uses fixed-angle SVG scenes and runs without a 3D engine or a live server connection.

The agreed product direction is recorded in [DIRECTION.md](DIRECTION.md), including the Create Ponder-inspired interaction model, reuse boundaries, evidence policy, and near-term sequence. [CONTEXT.md](CONTEXT.md) defines the shared scene/scenario vocabulary.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1
```

## Verify

```sh
node --test tests/model.test.ts
npm run build
```

The model tests require Node.js 22.18 or newer for native TypeScript execution.

## Explore

- Use the left navigation, grouped into System, Software, and Scenarios. On phones it becomes a keyboard-accessible drawer.
- Select hardware in a diagram or use the shared Inspect subject menu. Secondary explanations and related ideas are under Why it matters.
- Open the A30 cutaway from the navigation or its subject notes. Software subjects remain distinct from physical components.
- **A job through HPC4** follows a batch job from login to compute and storage.
- **Host to GPU** (`?lesson=host-to-gpu`) shows the input and result copies at each memory location. Compare **Local** and **Cross-socket** to follow different routes.
- **SSH & tmux** (`?lesson=ssh-tmux`) compares a task run directly over SSH with the same task inside tmux, then reconnects and reads the result. It accompanies [ASC Week 1, Quest 2](https://github.com/hkust-asc/ws26-01-linux-git#quest-2-redirect-output-and-use-tmux).
- The timed lessons autoplay at 1x: 58 seconds for **SSH & tmux** and 62 seconds for **Host to GPU**. Choose 2x for a quicker replay, seek with the segmented timeline, or pause with **Inspect**.
- Compare local and cross-socket CPU/memory placement.
- Separate the drawing's layers, reset the node view without rewinding the scenario, or export its SVG.
- Open Illustrative topology for sources and assumptions. Diagram links are not a measured wiring map.
- Scene/subject URLs such as `#cluster/lmod` and `#a30/numa` support direct links and browser Back.

The published A30 profile has two Xeon Gold 6448Y sockets, four A30 GPUs with 24 GB HBM2 each, and 512 GB DDR5 host memory. These figures and the overview's other node-family profiles come from the [official HPC4 specification](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4), checked on 2026-10-19. Storage notes follow the [official storage policies](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4/fileandstorage).

Component positions, memory-module counts, CPU/GPU/NIC affinity, PCIe routes, and socket-locality regions are illustrative, not measured HPC4 topology. The drawing does not claim one NUMA domain per socket. Cluster glyphs represent families, not racks or inventory counts. The storage relationship does not establish a physical network route. The GPU operation intentionally excludes unified memory, asynchronous overlap, and performance prediction; the connected scenario explains file writing schematically without modeling storage I/O. Animation timing does not represent hardware speed. Commands containing angle-bracket placeholders are illustrative, not ready-to-run job templates.

## Structure

- `src/model.ts`: subject content, evidence, scene-aware scenarios, state transitions, transfer paths.
- `src/scene.ts`: reusable projected boxes, node cutaway, and cluster-family glyphs.
- `src/layout.ts`: semantic workspace shell, grouped navigation, shared inspector, and scenario player.
- `src/main.ts`: accessible controls, scenario playback, inspection, SVG export.
- `src/app.css`: visual styling, responsive layout, reduced-motion behavior.
- `src/timed-lesson/`: shared clock, transport, callouts, and Identify mode.
- `src/host-to-gpu/`, `src/ssh-tmux/`: scene-specific storytelling and rendering.
- `tests/model.test.ts`: locality, transfer direction, cross-scene navigation, playback, and reset tests.