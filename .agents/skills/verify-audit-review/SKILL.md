---
name: verify-audit-review
description: Verify HPC4 Hub Practice Mission 06 command audit when changing proposal order or verdicts, decision retry and reselect, completion credit, or separation of audit from shell execution in src/practice/{workstation.ts,engine/game.ts,engine/levels/level6.ts}.
---

# Mission 06 audit

From the repository root run `bash formal/check.sh Audit`, then `npm test`. The formal command bootstraps checksum-pinned TLC 1.7.4 and Zulu JRE 21.0.8 on Linux x86_64 into `${XDG_CACHE_HOME:-$HOME/.cache}/hub-formal` (Bash, `curl`, `tar`, and `sha256sum`; first run needs network). Read every TLA+ result with the pstack `/statechart` skill. Use `formal/Audit/Audit.tla`, `Audit.cfg`, and `view.mjs`; compare the overview and close-ups in `charts.md`.

## Code and step boundaries

Sync commit: `2b0c6c8c493a3fc1cc4fc2411d0c2d1edf099dbf`.

| Model | Implementation |
|---|---|
| Index 0, 1, 2 | Recursive deletion (`rm -rf /tmp/build_cache /`), direct login-node benchmark (`./hpl_benchmark --threads 128`), and scheduler submission (`sbatch --nodes=1 --ntasks=16 run_hpl.slurm`) in `src/practice/engine/levels/level6.ts`. |
| `Approve`, `Reject` | `[data-verdict-choice]` click handler in `drawAudit` (`src/practice/workstation.ts`) calls `Game.decide` in `src/practice/engine/game.ts`; verdict check, `proposalIndex` increment, and mission completion are one synchronous action. |
| `ReselectMission06` | `Game.select` in `src/practice/engine/game.ts`: incomplete review restarts at `proposalIndex = 0`; completed review remains at `proposals.length`. |
| `accepted`, `dispatched` | Model witnesses, not production fields: credit must match the expected proposal prefix (`<<"reject", "reject", "approve">>`) and no decision may invoke `Shell.run`. |

Three fixed proposals, two valid choices, at most three accepted decisions (`4` distinct states). The machine starts unlocked; no arbitrary terminal commands, invalid verdict strings, DOM rendering, persisted-storage tampering, or earlier missions are modeled. Verdicts are pedagogical fixtures, not a proof of safety for real cluster commands. `tests/practice-game.test.ts` rewrites proposal commands to side-effecting `echo dispatched >> review` strings to prove `Game.decide` never executes proposal text, and `tests/practice-replay.test.ts` reaches Mission 06 via full progression, tests wrong and right choices, and confirms VFS files remain untouched.

## Prove and maintain

`bash formal/check.sh Audit advance` must violate `CorrectDecisionsInOrder`; `bash formal/check.sh Audit execute` must violate `ProposalsNeverDispatched`. Restore with `bash formal/check.sh Audit`. Replay exact choices in `Game.decide`; inspect `game.proposalIndex` and confirm `game.shell` never executes proposal strings. If observations differ from a shortened trace, inspect the chart's label projection and the verdict table in `src/practice/engine/levels/level6.ts` before deciding which layer is wrong. Report real findings without changing the property. Use `/maintain-formal-verification-skill` and advance the sync commit only after confirming the transition table, tests, and charts match.
