# HPC4 Hub: Agreed Direction

Agreed on 2026-10-19, building on the prototype and discussion of 2026-10-15 to 2026-10-17.

## Purpose

Build an architecture-first companion to the HPC handbook: a consistent HPC4 system that people can explore by component or understand through short, guided scenarios. The goal is to explain what is underneath commands, not duplicate the handbook or build a live monitoring console.

The interaction reference is Minecraft Create's Ponder: bounded scenes, deliberate steps, highlighted subjects and relationships, and explanations attached to what is happening. This is an interaction inspiration, not a commitment to its artwork, code, or game mechanics. Polish scene transitions and flow after their meaning and connections work.

## One System, Two Entry Points

- Explore: start from a system, component, or concept and follow its relationships.
- Scenarios: follow a concrete question or workload, pausing to inspect the same subjects.
- Both modes reference the same identities, explanations, hardware profiles, and evidence.
- The A30 cutaway is a detail scene within HPC4, not a separate application or a recursively embedded giant SVG.

## Navigation And Presentation

- One persistent navigation groups System, Software, and Scenarios; it becomes a focus-managed drawer on phones.
- One active destination provides orientation. Scene/subject links, step deep links (`#lesson/<id>/<step>`), and browser Back preserve navigation context.
- One contextual inspector serves Explore scenes, while one unified scenario workbench (`src/stage/`) serves all guided scenarios with reader-paced steps, optional Autoplay, state-invariant HUD chips, and non-overlapping side/bottom narrative rails.
- Returning through scenario navigation resumes the saved step; resetting a view must not rewind a lesson.
- Keep the established architectural drafting palette, typography, and SVG treatment across Explore and Learn. Put secondary explanation in expandable notes instead of repeating captions, statistics, and instructions.

## Distinct Kinds of Subject

- Hardware: nodes, sockets, GPUs, RAM, NICs, storage, and physical connections.
- Software: Spack, Lmod, CUDA, and the software environment.
- Concepts: NUMA, affinity, and allocation.
- Operations: module loading, job launch, and host/device copies.

Use appropriate views for each kind. Lmod changes a shell environment; Spack manages software builds and installations; Slurm schedules allocations. None is a physical appliance that application data travels through. Reserve 3D blocks or beveled 2.5D chassis plinths for physical hardware, render software/control/mount state as flat 2D surfaces, and separate hardware connectivity, resource allocation, and actual execution.

## Progressive Exploration

Start with HPC4, then node families, a representative node, components, and deeper concepts. A deeper scene must answer a new question rather than reveal decorative detail. Preserve orientation and context when moving back. Cross-links are essential: relationships such as NUMA and PCIe do not form a strict tree.

Use real named profiles. A30 and RTX 4090D nodes may reuse visual assets without sharing unverified specifications, capabilities, or wiring.

## Reuse Before Volume

Keep three things separate:

- Visual assets: reusable shapes with dimensions, connection points, selectable regions, palette tokens, and accessible names.
- Hardware profiles: verified specifications and connections of particular node types.
- Educational content: shared explanations and scenario steps.

Bounded asset-drawing tasks may eventually be delegated to cheaper models. Topology and factual verification remain separate responsibilities. Evaluate generation plus review cost. Extract a public asset library after a second real profile demonstrates what is reusable; do not build library infrastructure speculatively. Track licensing and reject SVG scripts or external dependencies in contributed assets.

## Scenario Direction

Organize scenarios around questions: where a program runs; what module loading changes; why placement matters; what changes across nodes; and why additional hardware does not guarantee speedup. Use highlights, paths, captions, and state changes only where they clarify the mechanism. Environment-variable changes can be more informative than moving particles.

Use HPC4 as a real example, not a prerequisite for every lesson. **SSH & tmux** accompanies ASC Week 1 and takes place on a single training server. It and **Host to GPU** share playback and inspection, not a scene format or a claim about the same system.

Near-term order:

1. Add a small HPC4 overview and a connected cluster-to-node scenario.
2. Add a contrasting node profile, such as RTX 4090D.
3. Extract the shared library from demonstrated needs.
4. Grow the scenario collection and deeper component/concept scenes.
5. Refine timing, transitions, and presentation from user feedback.

## Evidence Boundary

Distinguish published or measured facts, illustrative choices, and unknowns. Record sources and verification dates. Public specifications do not establish switch wiring, NUMA domains, GPU affinity, or the runtime transport used by an application. Do not expose private operational details without approval. Educational scenes remain independent of live production services.