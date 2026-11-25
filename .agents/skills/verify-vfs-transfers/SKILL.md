---
name: verify-vfs-transfers
description: Verify HPC4 Hub Practice VFS metadata isolation and root protection when changing copy, move, remove, path normalization, or mode mutations in src/practice/engine/{vfs,commands,shell}.ts.
---

# VFS install and root refusal

From the repository root run `bash formal/check.sh VFS`, then `npm test`. The formal command bootstraps checksum-pinned TLC 1.7.4 and Zulu JRE 21.0.8 on Linux x86_64 into `${XDG_CACHE_HOME:-$HOME/.cache}/hub-formal` (Bash, `curl`, `tar`, and `sha256sum`; first run needs network). Read every TLA+ result with the pstack `/statechart` skill. Use `formal/VFS/VFS.tla`, `VFS.cfg`, and `view.mjs`; compare the overview and close-ups in `charts.md`.

## Code and step boundaries

Sync commit: `2b0c6c8c493a3fc1cc4fc2411d0c2d1edf099dbf`.

| Model | Implementation |
|---|---|
| `MoveDownload`, `CopyDownload` | `commands.mv` and `commands.cp` in `src/practice/engine/commands.ts` delegate to `VFS.transfer` in `src/practice/engine/vfs.ts`; copy clones `{ ...item }`, move preserves it. |
| `ChmodInstalled`, `RemoveDownload` | `commands.chmod` mutates entry mode; `commands.rm` calls `VFS.remove`. |
| `RemoveLocalAndRoot` | `Shell.path` and `resolvePath` in `src/practice/engine/{shell,vfs}.ts` normalize operands; `commands.rm` checks `paths.includes("/")` across every operand before deletion; `VFS.remove` independently refuses `/`. |
| `ResetFixture` | A fresh `Shell` with `createVFS()` plus `level2.setup` and the local file fixture. No implication about browser storage persistence. |

One action is a whole synchronous command or fixture reset (`14` distinct states). Bounds are the simulated root `/`, one local file, diagnostic download and installed paths, mode `0644`/`0755`, and modeled aliasing. Copy isolation is checked via a `~/bin` `chmod` while the download still exists. Root refusal covers the local-first representative; `tests/practice-shell.test.ts` also tests reversed (`rm -rf / local`) and normalized (`rm -rf local /tmp/..`) root operands. No directories are copied, the download is not chmodded directly, and no symlinks, invalid non-root operands, pipeline redirection, or host OS I/O exist.

## Prove and maintain

`bash formal/check.sh VFS alias` must violate `CopyIsolatesMetadata`; `bash formal/check.sh VFS root` must violate `RootRefusalHasNoSideEffects`. Restore with `bash formal/check.sh VFS`. Replay both shortest paths in `Shell.run` / `Game.run`; before judging, compare normalized operands, file modes, and survival of the local file. These variants replace the copy clone with shared metadata or skip the root preflight; they are negative controls, not current implementation findings. Keep a real finding if the code reproduces it. Use `/maintain-formal-verification-skill` and advance the sync commit only after revalidating the step map, test matrix, and charts.
