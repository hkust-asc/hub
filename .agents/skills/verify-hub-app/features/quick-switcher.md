# Quick Switcher (`Ctrl+K`)

Quick Switcher lets a learner search across modes, guided scenarios, interactive scenes, practice missions, workshop weeks, domains, and permanent concept sheets from anywhere in the app.

## Sub-features

- `switcher-open` opens `<dialog id="switcher">` via `#open-switcher` or `Ctrl+K` / `Cmd+K` while pausing any active scenario autoplay.
- `switcher-filter` narrows `#switch-list` `[role="option"]` entries across modes (`Learn`, `Practice`, `Weeks`, `Scene`, `Concept`, `Domain`) and updates `#switch-count`.
- `switcher-keyboard` moves `aria-selected` with `ArrowDown` / `ArrowUp`, navigates on `Enter`, and closes on `Escape` without leaking `Escape` to Stage Inspect underneath.
- `switcher-no-planned` excludes `planned` roadmap items from jump targets.

## How to get to it (user POV)

- Click the `Search` button (`#open-switcher`) in the top bar.
- Press `Ctrl+K` (or `Cmd+K` on Apple platforms) from any view when no modal dialog is already open.

## Driving it with control-hub

Preconditions:

- `control-hub.ts doctor --run-id "$RUN_ID"` reports `"status": "healthy"`.
- `<dialog#switcher>` is not currently open.

- **Run automated journey.** Execute `node .agents/skills/verify-hub-app/scripts/control-hub.ts drive --run-id "$RUN_ID" --evidence-dir "$EVIDENCE_DIR" --journey search`. Exit code is `0` and `02-quick-switcher-streams.png` is written.
- **Trigger via keyboard.** Dispatch `Control+K` on `document`. `<dialog id="switcher">` opens with focus in `#switch-input`.
- **Query multi-mode term.** Enter `streams` into `#switch-input`. `#switch-list` includes `#lesson/streams` (`Learn`), `#practice/3` (`Practice · Mission 3`), and `#atlas/concept/standard-streams` (`Concept`), and zero options contain `planned`.
- **Close cleanly with Escape.** Dispatch `Escape` inside `#switcher`. The dialog closes (`open === false`), `#switch-input` resets to `""`, and any underlying view remains intact.

## Gotchas

- `#switcher` stops `keydown` propagation (`event.stopPropagation()`) so arrow keys and `Escape` inside search never step an open scenario or exit Stage Inspect underneath.
