# HPC4 Hub verification map

This directory is the maintained source for verifying the user-facing behavior of HPC4 Hub (`hkust-asc/hub`). Read this index first, then follow the matching feature file when proving UI or state changes.

## Baseline preconditions

- Run `node scripts/check-state-machines.ts` and `npm run check` from the repository root with exit code `0`.
- Pick a unique `RUN_ID` and launch an isolated Vite dev server with `node .agents/skills/verify-hub-app/scripts/control-hub.ts launch --run-id "$RUN_ID"`.
- Store proof artifacts in `EVIDENCE_DIR` outside `/tmp/hub-verify-$RUN_ID` (for example `/tmp/hub-evidence-$RUN_ID`).
- Run `node .agents/skills/verify-hub-app/scripts/control-hub.ts doctor --run-id "$RUN_ID"` and require `"status": "healthy"` for the current checkout and commit.
- Drive each browser run in a fresh Chromium `--user-data-dir` so `hpc4:learning:v1` and `hpc4-hub.practice.act1` start empty and never touch a user's personal profile.
- Never drive a Vite server that was not started by the current verification run.

## Driving conventions

- Start every journey from `#atlas` on an empty storage profile unless its preconditions specify prior progress.
- Prefer accessible names, `#id` anchors, and `data-mode`, `data-route`, `data-entry-link`, `data-stage-*`, and `data-verdict-choice` handles over CSS layout classes or pixel coordinates.
- Check responsive bounds across `320`, `390`, `768`, `1152`, and `1440` CSS pixels (`documentElement.scrollWidth <= window.innerWidth + 1`).
- Tear down with `control-hub.ts cleanup --run-id "$RUN_ID"` after every run without deleting `EVIDENCE_DIR`.

## Proof and skip reporting

- Capture both the user action and resulting state (`verification-report.json` + PNG screenshots).
- Verify persisted state (`hpc4:learning:v1`, `hpc4-hub.practice.act1`) from a second user-facing view (`#resume-slot` in the sidebar or `Practiced ✓` on a concept sheet), not only from the originating screen.
- Report any unreachable entry point with the attempted command and unmet precondition; never mark a skipped entry point as verified via an alternate route.

## Feature entry contract

Each feature file starts with an H1 title and one summary paragraph, followed by four H2 sections in exact order:

1. `Sub-features` — short IDs with one-line behavior summaries.
2. `How to get to it (user POV)` — every user-facing entry point.
3. `Driving it with control-hub` — `Preconditions:` plus labeled steps pairing user actions, exact commands/selectors, and observable outcomes.
4. `Gotchas` — traps that can invalidate or mislead a verification run.

## Features

- [Modes, Atlas & Explore cutaways](./modes-and-explore.md) covers topbar/drawer mode switching, Domain hubs, Cluster & A30 cutaway tools, SVG export, and `Think Back` unwinding.
- [Quick Switcher (`Ctrl+K`)](./quick-switcher.md) covers cross-mode search, keyboard selection, planned-entry exclusion, and modal `Escape` isolation.
- [Scenario Stage workbench](./scenario-stage.md) covers reader-paced stepping, Autoplay dwell, `Inspect` pause/resume, locality variants, `Fit` zoom, `prefers-reduced-motion`, and bookmark resume.
- [Practice workstation & audit](./practice-workstation.md) covers simulated shell missions, Command & State X-ray, Mission 06 command audit, and `Practiced ✓` concept credit.
