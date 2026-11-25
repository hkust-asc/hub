# Modes, Atlas & Explore cutaways

Modes, Atlas & Explore cutaways let a learner move across the four top-level hub modes (`Learn`, `Practice`, `Weeks`, `Atlas`), browse architecture domains and concept sheets, inspect the HPC4 Cluster schematic and A30 GPU node cutaway, and return cleanly via `Think Back`.

## Sub-features

- `modes-switch` switches between `#learn`, `#practice`, `#weeks`, and `#atlas` with accurate `aria-current="location"` and heading updates.
- `atlas-filter` toggles `All Entries` vs. `Domains`, filters by entry kind (`Scenes`, `Concepts`, `Scenarios`), and narrows tiles via `#atlas-search` (`/`).
- `explore-cutaway` inspects subjects on `#cluster` and `#a30`, toggles `Explode` (`#explode-button`) and `Local` / `Cross-socket` (`#local-button`, `#remote-button`), and restores defaults with `Reset node view` (`#reset-button`).
- `think-back` unwinds navigation history through `#think-back` without self-loops and falls back to the owning domain hub or `#atlas`.

## How to get to it (user POV)

- Choose `Learn`, `Practice`, `Weeks`, or `Atlas` in the top navigation bar (or inside the mobile navigation drawer via `#menu-button` below `900px`).
- Choose `Concept Atlas`, any domain under `HPC4 System` / `Workflow & Code`, or `Cluster schematic` / `A30 node cutaway` under `Direct Scenes` in the left sidebar.
- Activate `Open anatomy` inside the `#cluster` inspector when `A30 compute nodes` is selected.
- Choose `#think-back` in the workspace header to return to the prior route or owning domain hub.

## Driving it with control-hub

Preconditions:

- `control-hub.ts doctor --run-id "$RUN_ID"` reports `"status": "healthy"`.
- `EVIDENCE_DIR` points outside `/tmp/hub-verify-$RUN_ID`.

- **Run automated journey.** Execute `node .agents/skills/verify-hub-app/scripts/control-hub.ts drive --run-id "$RUN_ID" --evidence-dir "$EVIDENCE_DIR" --journey modes`. Exit code is `0` and `verification-report.json` records `checks.modesAndExplore`.
- **Switch all 4 modes.** Click `.top-modes [data-mode="learn"]`, `[data-mode="practice"]`, `[data-mode="weeks"]`, and `[data-mode="atlas"]`. Each route updates `location.hash`, sets `aria-current="location"` on the active tab only, and populates `#page-title`.
- **Open Cluster and A30 cutaway.** Click `[data-browse-scene="cluster"]` (`#cluster`), then `[data-browse-scene="a30"]` (`#a30`). `#workbench` and `#node-view` become visible with `#subject-picker` set to `gpu`.
- **Exercise A30 view tools and reset.** Click `#explode-button` and `#remote-button`; confirm both report `aria-pressed="true"` and `01-a30-cutaway-exploded.png` is saved. Click `#reset-button`; confirm `exploded` returns to `false` and `#local-button` returns to `aria-pressed="true"` while keeping `#a30` selected.
- **Unwind with Think Back.** Click `#think-back`; confirm `location.hash` returns to `#cluster` without a self-loop.

## Gotchas

- Planned roadmap tiles (`data-kind="planned"`) render `<button aria-disabled="true">` with no `href`; clicking them must never navigate.
- In-place subject switches (`#subject-picker` or SVG `[data-topic]`) use `history.replaceState` and prune redundant top-of-trail matches so `#think-back` never points to the current route.
- Below `900px` viewport width, `#sidebar` is `inert` until `#menu-button` opens `.navigation-open`.
