# HPC4 Anatomy: GPU-node proof of concept

A small Vite / TypeScript app built with reusable, fixed-angle SVG parts. No 3D engine, external API, or live HPC connection is required. Fonts and icons are bundled locally.

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

- Select hardware in the diagram or in the component list.
- Switch to Follow the data for a six-step, explicit-copy GPU operation.
- Compare local and cross-socket CPU/memory placement.
- Separate the drawing's layers, reset the view, or export its current SVG.
- Open Sources & assumptions for the factual boundary of the model.

The published A30 profile has two Xeon Gold 6448Y sockets, four A30 GPUs with 24 GB HBM2 each, and 512 GB DDR5 host memory. These figures come from the [official HPC4 specification](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4), checked on 2026-10-15.

Component positions, memory-module counts, CPU/GPU/NIC affinity, PCIe routes, and socket-locality regions are illustrative, not measured HPC4 topology. The drawing does not claim one NUMA domain per socket. The scenario intentionally excludes unified memory, asynchronous overlap, storage I/O, and performance prediction. Animation timing does not represent hardware speed.

## Structure

- `src/model.ts`: educational content, evidence, state transitions, transfer paths.
- `src/scene.ts`: reusable projected boxes, hardware parts, and connections.
- `src/main.ts`: accessible controls, scenario playback, inspection, SVG export.
- `src/app.css`: visual styling, responsive layout, reduced-motion behavior.
- `tests/model.test.ts`: locality, transfer direction, playback, and reset tests.