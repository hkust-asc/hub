# Practice workstation & audit

Practice workstation provides six browser-simulated Linux and cluster safety missions (`#practice/1`–`#practice/6`) with a virtual filesystem, Command X-ray token chips, State X-ray inspector, non-executing Mission 06 command proposals, and persistent concept-card credit (`Practiced ✓`).

## Sub-features

- `practice-unlock` enforces sequential mission unlocking by default while persisting the optional `Unlock all missions` toggle (`[data-unlock-all]`).
- `practice-shell` runs simulated commands via `.terminal-form`, updates Command X-ray (`[data-chips]`) and State X-ray (`.sim-state`), and awards mission completion when `level.observe` succeeds.
- `practice-audit` steps through Mission 06 proposals via `[data-verdict-choice="reject"]` and `[data-verdict-choice="approve"]` in order without executing proposal commands.
- `practice-credit` stores completed missions and awarded codex keys in `localStorage['hpc4-hub.practice.act1']` and displays `Practiced ✓` on corresponding `#atlas/concept/<id>` sheets.

## How to get to it (user POV)

- Choose `Practice` in the top bar (`#practice`), then select an unlocked mission card (`#practice/1`–`#practice/6`).
- Follow a `Practice · Mission N` link under a scenario in `Learn`, on `#weeks/asc01`, or inside a `#atlas/concept/<id>` sheet.
- Jump directly to a mission via Quick Switcher (`Ctrl+K`).

## Driving it with control-hub

Preconditions:

- `control-hub.ts doctor --run-id "$RUN_ID"` reports `"status": "healthy"`.
- Fresh browser profile so `hpc4-hub.practice.act1` starts empty.

- **Run automated journey.** Execute `node .agents/skills/verify-hub-app/scripts/control-hub.ts drive --run-id "$RUN_ID" --evidence-dir "$EVIDENCE_DIR" --journey practice`. Exit code is `0` and `04-practice-mission1-complete.png` is saved.
- **Complete Mission 01.** Navigate to `#practice/1`, enter `ls -a` in `input[name="command"]` and submit, then enter `cat .vault/.access_key` and submit. `[data-outcome]` announces `Mission complete` and `[data-next]` offers `#practice/2`.
- **Verify persisted concept credit from second view.** Navigate to `#atlas/concept/dotfiles` and confirm `.concept-sheet .status-pill.is-done` displays `Practiced ✓`.

## Gotchas

- Reading `.vault/.access_key` before running `ls -a` on `~/workspace` prints the file contents in stdout yet intentionally withholds Mission 01 completion (`RevealBeforeRead` invariant in `formal/Mission/Mission.tla`).
- `[data-reset]` (`Reset practice progress`) and `[data-restart]` (`Restart this simulation`) call `window.confirm(...)` in interactive browsers; handle modal dialogs if clicking those buttons.
