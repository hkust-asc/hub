---
name: verify-mission-conditions
description: Verify HPC4 Hub Practice mission unlocks and win conditions when changing Game.run, Mission 01 workspace reveal, or Mission 02 diagnostic installation, permissions, launch snapshot, or feedback in src/practice/engine/.
---

# Mission win conditions

From the repository root run `bash formal/check.sh Mission`, then `npm test`. The formal command bootstraps checksum-pinned TLC 1.7.4 and Zulu JRE 21.0.8 on Linux x86_64 into `${XDG_CACHE_HOME:-$HOME/.cache}/hub-formal` (Bash, `curl`, `tar`, and `sha256sum`; first run needs network). Read every TLA+ result with the pstack `/statechart` skill. In `formal/Mission/`, use `Mission.tla`, `Mission.cfg`, and `view.mjs`; compare the whole-machine overview and close-ups in `charts.md`.

## Code and step boundaries

Sync commit: `2b0c6c8c493a3fc1cc4fc2411d0c2d1edf099dbf`. The filename, method, and transition map:

| Model | Implementation |
|---|---|
| `RevealWorkspace`, `ReadToken` | `commands.ls`, `commands.cat` in `src/practice/engine/commands.ts`; `observe` in `src/practice/engine/levels/level1.ts`. `revealed` is a successfully observed workspace reveal, not a partially applied failed `ls`. |
| `SelectMission02` | `Game.select`, `isUnlocked`, `isComplete` in `src/practice/engine/game.ts`; `progressStore.complete` in `src/practice/engine/storage.ts`; `createVFS` in `src/practice/engine/vfs.ts`; `setup` in `src/practice/engine/levels/level2.ts`. `tokenRead` denotes Mission 01 credit, not merely seeing bytes. |
| `MoveDownload`, `CopyDownload`, `RemoveDownload`, `SetExecuteBit`, `ChangeDirectory`, `OverwriteWithEcho` | `commands.mv`, `cp`, `rm`, `chmod`, `cd`, `echo` in `src/practice/engine/commands.ts`; `VFS.transfer`, `remove`, `openOutput` in `src/practice/engine/vfs.ts`; `Shell.run` and `executable` in `src/practice/engine/shell.ts`. |
| `LaunchRelative`, `LaunchAbsolute`, `SourceDiagnostic` | `Shell.execute`, `runFile` in `src/practice/engine/shell.ts`, `commands.source` in `src/practice/engine/commands.ts`, `Game.run` in `src/practice/engine/game.ts`, and `level2.observe` in `src/practice/engine/levels/level2.ts`. `last.awarded` means this submission granted new credit; later commands cannot revoke earned credit. |
| `LaunchThenRemove`, `RemoveThenLaunch` | `Shell.run` executes stages left-to-right, capturing `this.vfs.snapshot()` as `event.vfsAtExecution` after redirect setup and before `this.execute(event)`. `level2.observe` reads `event.vfsAtExecution`, not the live `shell.vfs`. `last.launchDownload` corresponds to presence in the launch snapshot; `download` after the transition is the final VFS value. |

One action is one synchronous `Game` submission with observation, or a mission selection. The finite fixture uses Missions 01–02, two working directories, the vault token, two canonical diagnostic paths, three content/origin classes plus absence, and an owner execute bit (`128` distinct states). It models single-stage representatives and both orders of one pipe between `./diag.sh` in `~/bin` and a successful removal of the download. Those stages execute serially, neither uses piped input, and only the download changes between launch and final VFS state; installed content, mode, and `cwd` are unchanged within these two pipelines. Identity is tracked only to reproduce the old object-reference bug.

The model does not check other pipeline compositions, general command failures, help, redirects, nested submissions, `unlockAll` jumps, reselect/reset, storage reload, Missions 03–06, other paths, or feedback prose/rendering. The result checks this finite model under these assumptions, not full equivalence to production TypeScript. `tests/practice-game.test.ts` plays both pipeline orders and checks feedback and persistent credit; `tests/practice-replay.test.ts` replays Missions 01–06 end-to-end; `tests/practice-shell.test.ts` checks frozen per-stage `vfsAtExecution` snapshots across redirects and mutations.

## Prove and maintain

Run `bash formal/check.sh Mission reveal`, then `leftover`, `content`, `identity`, and `pipeline` in the same argument position. Expect `RevealBeforeRead` for `reveal`, `InstallResponsiveness` for `identity`, and `InstallSoundness` for `leftover`, `content`, and `pipeline`, not a tool error. The `pipeline` variant trusts final download presence and wrongly awards on `./diag.sh | rm ~/downloads/diag.sh`. Rerun `bash formal/check.sh Mission` afterwards. For each trace, replay the equivalent commands through `Game.run` (`tests/practice-game.test.ts`) and compare the affected state, not just stdout; for `pipeline`, compare launch and final download presence as well as credit and feedback. A mismatch means inspect the projection or an excluded command before declaring a product bug. Report a confirmed counterexample, including its commands and affected guard, rather than weakening the property. Use `/maintain-formal-verification-skill` after intentional changes and advance the sync commit only after the step map, tests, counterexamples, and charts match the new revision.
