# HPC4 Hub: Scene-Based Architecture Explorer

A Vite / TypeScript learning companion for HPC and ASC workshops. Its four modes share one catalog: explore a mechanism, rehearse it in a simulated shell, apply it in a field quest, and return to a permanent reference. The app never connects to a training server.

The agreed product direction is recorded in [DIRECTION.md](DIRECTION.md), including the Create Ponder-inspired interaction model, reuse boundaries, evidence policy, and near-term sequence. [CONTEXT.md](CONTEXT.md) defines the shared scene/scenario vocabulary.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1
```

## Verify

```sh
npm run check
```

This runs all `tests/*.test.ts` suites (including sandbox replays) and the production build. Use Node.js 22.18 or newer for native TypeScript execution.

## Deploy

`vite.config.ts` sets `base: './'` so the built static bundle in `dist/` runs identically at a root domain or a GitHub Pages subpath such as `/hub/`. On GitHub:

1. Ensure the repository visibility supports Pages (public on GitHub Free).
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. Pushes to `main` (and manual **Actions → CI and Deploy GitHub Pages → Run workflow** dispatches) run `npm run check` and deploy `dist/` automatically.

## Four ways in

| Mode | Try it | What happens |
| --- | --- | --- |
| Learn | `#learn` → `#lesson/streams` | Reader-paced visual scenarios (`←`/`→`, step pills, `Auto` playback, `Fit`, `Inspect`, state HUD chips, and `"What changed"` deltas) with deep links such as `#lesson/streams/3`. |
| Practice | `#practice` → `#practice/1` | Six Linux X-Ray missions run against an in-memory shell and filesystem. Inspect files, descriptors, PATH and processes, then review proposals **without executing them**. Complete one mission to open the next. |
| Weeks | `#weeks/asc01` | Week 01 pairs Learn and Practice with the actual [Linux & Git workshop](https://github.com/hkust-asc/ws26-01-linux-git). The local checklist is self-reported, not a submission. Credentials, live exercises, profiles and PRs stay outside this app. |
| Atlas | `#atlas` → `#atlas/concept/standard-streams` | Reference cards, including all 17 Linux X-Ray Codex topics, are always readable. A *Practiced* mark records rehearsal, not permission to read. Existing scene links such as `#cluster/login` still go straight to the inspector. |

Use **Ctrl/Cmd+K** to jump across modes (arrows, Enter, Escape). On smaller screens the modes are in the navigation drawer. Legacy `#scenario/first-job` and `?lesson=...` links still resolve.

**Resources** (`#resources`) is the public directory for workshop materials, HPC4 setup, and shared references. Search by title, date, or topic, or filter for recordings, summaries, and slides. Workshops are listed newest first and keep all their materials in one row. **Workshop materials** in a weekly brief opens its specific entry (e.g. `#resources/asc01`); **Follow in Weeks** returns to the guided activities.

**For resource curators:** Update [the resource catalog](src/platform/resource-catalog.ts). Give each workshop a stable `id`, its start date if known (`YYYY-MM-DD`), a publisher, a sentence on when it is useful, and links to the original materials. Use the existing `weekId` only for a matching Weekly brief. Verify links while signed out and confirm permission to share. Label eligible Zoom replays **Recording (Zoom)**; do not add meeting invites, passcodes, chat exports, or member-only files to the public site.

Learn bookmarks/completion, field checkboxes, practice completions and simulated command history stay in this browser. Do not enter real credentials. Visiting a lesson or card and returning to the same mission keeps its live terminal; restarting a mission, selecting another mission or reloading the page starts a fresh simulated filesystem. **Reset practice progress** clears the practice records, not the weekly checklist or lesson bookmarks.

**For lesson authors:** register a scenario in the catalog and lesson loader as before; Learn and search pick it up automatically. Add optional pairings in `src/platform/links.ts` or `src/platform/curriculum.ts`. Neither lesson rendering nor the build requires a checkout of the workshop repos. The port is based on Linux X-Ray at `6effdce`; Week 01 is based on the workshop brief at `e6a434e`.

## Explore

- Start at the **Concept Atlas** (`#atlas`, showing **All Entries** by default, or `#atlas/domains` for domain shelves) or use the persistent left navigation grouped by domain (**Cluster & Nodes**, **Memory, Bus & Storage**, **Software & Slurm**, **Linux & Remote**, **GPU & Scaling**) plus direct scene shortcuts. On phones it becomes a keyboard-accessible drawer.
- Open any **Domain Hub** (`#atlas/nodes`, `#atlas/linux`, etc.) to browse associated scenes, concepts, and guided scenarios together, or filter across current and planned items directly in **All Entries**.
- Select hardware in a diagram or use the shared Inspect subject menu. Secondary explanations and related ideas are under Why it matters.
- Open the A30 cutaway (`#a30`) from the Atlas, navigation, or subject notes. Software subjects remain distinct from physical components.
- **Job walkthrough** (`#lesson/first-job`, or `?lesson=first-job`) follows `sbatch` from a login shell through Slurm queuing, Lmod environment setup on an A30 compute node, and output written to shared `/scratch`.
- **Environment modules** (`#lesson/module-load`, or `?lesson=module-load`) shows how `module load` rewires `PATH` and build variables in login and Slurm batch shells without moving pre-built Spack packages.
- **Host to GPU** (`#lesson/host-to-gpu`, or `?lesson=host-to-gpu`) shows the input and result copies at each memory location. Compare **Local** and **Cross-socket** to follow different routes.
- **SSH & tmux** (`#lesson/ssh-tmux`, or `?lesson=ssh-tmux`) compares a task run directly over SSH with the same task inside tmux, then reconnects and reads the result. It accompanies [ASC Week 1, Quest 2](https://github.com/hkust-asc/ws26-01-linux-git#quest-2-redirect-output-and-use-tmux).
- **Streams & redirection** (`#lesson/streams`, or `?lesson=streams`) follows a demo passcode and diagnostics through `>` and `2>`, then asks learners to predict what appears on screen. It also accompanies Quest 2.
- **Linux filesystem** (`#lesson/linux-fs`, or `?lesson=linux-fs`) follows `pwd`, `ls -a`, relative and absolute paths, and an example of local and shared mounts. It accompanies [Quest 1](https://github.com/hkust-asc/ws26-01-linux-git#quest-1-connect-and-explore).
- Use the visual **Back** pill, **Related** entry chips, or the sidebar **Resume scenario** card to move across connected scenes and scenarios without losing your saved place.
- Step through scenarios at your own pace with **Prev** / **Next** (`←` / `→`) or step pills, toggle **Auto** (`Space`, with `0.5x` / `1x` / `2x` speed) for hands-free playback, replay the current step's causal beat with **R**, toggle full-diagram framing with **Fit** (`0`), or inspect individual components with **Inspect** (`I`).
- Compare local and cross-socket CPU/memory placement in both the Explore A30 view and **Host to GPU**.
- Separate the node drawing's layers, reset the node view, or export its SVG.
- Open Illustrative topology for sources and assumptions. Diagram links are not a measured wiring map.
- Scene, subject, and step URLs such as `#cluster/lmod`, `#a30/numa`, and `#lesson/streams/3` support direct links and browser Back.

The published A30 profile has two Xeon Gold 6448Y sockets, four A30 GPUs with 24 GB HBM2 each, and 512 GB DDR5 host memory. These figures and the overview's other node-family profiles come from the [official HPC4 specification](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4), checked on 2026-10-19. Storage notes follow the [official storage policies](https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4/fileandstorage).

Component positions, memory-module counts, CPU/GPU/NIC affinity, PCIe routes, and socket-locality regions are illustrative, not measured HPC4 topology. The drawing does not claim one NUMA domain per socket. Cluster glyphs represent families, not racks or inventory counts. The storage relationship does not establish a physical network route. The GPU operation intentionally excludes unified memory, asynchronous overlap, and performance prediction; the connected scenario explains file writing schematically without modeling storage I/O. Animation timing does not represent hardware speed. Commands containing angle-bracket placeholders are illustrative, not ready-to-run job templates.

## Structure

- `src/catalog.ts`: domain categories, current & planned entry registry, route parsing, filtering, and Think Back navigation trail.
- `src/platform/`: mode surfaces, search, Codex-to-Atlas IDs, weekly briefs and local learning progress. Add a week in `curriculum.ts` using existing lesson/mission/concept IDs and link to its original workshop repo.
- `src/practice/engine/`: typed port of the ASC team's Linux X-Ray shell and mission observers. `src/practice/workstation.ts` and `state-view.ts` present those results in the explorer’s visual style; no Linux X-Ray dashboard CSS, live shell, or backend is needed.
- `src/iso.ts`: shared parameterized 2:1 isometric projector, back-to-front depth sorting, and semantic 3-face palettes.
- `src/glyphs.ts`: miniature isometric and schematic SVG glyphs using `src/iso.ts`.
- `src/model.ts`: subject content, evidence, Explore state transitions, and illustrative transfer paths.
- `src/scene.ts`: reusable projected hardware components, A30 node cutaway, and cluster-family glyphs.
- `src/layout.ts`: semantic workspace shell, grouped navigation, and shared Explore inspector.
- `src/main.ts`: accessible controls, routing, scenario mounting, inspection, and SVG export.
- `src/app.css`: visual styling, responsive layout, and reduced-motion behavior.
- `src/stage/`: unified 7-layer SVG stage renderer (`renderer.ts`), 3D isometric stage adapter (`iso-scene.ts`), synchronous port/wire router & collision validator (`layout.ts`), text-width measurement (`measure.ts`), pure step/autoplay runner (`runner.ts`), and scenario workbench UI (`player.ts`, `stage.css`).
- `src/first-job/`, `src/module-load/`, `src/host-to-gpu/`, `src/ssh-tmux/`, `src/streams/`, `src/linux-fs/`: declarative per-step scenario specs and scene bindings.
- `tests/model.test.ts` & `tests/platform.test.ts`: navigation, stage layout validation, runner state, bookmark migration, and scenario invariant tests.