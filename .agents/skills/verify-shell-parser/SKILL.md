---
name: verify-shell-parser
description: Verify HPC4 Hub Practice shell submission when changing tokenizer quote boundaries, variable expansion, pipe and redirect validation, or execution after parse errors in src/practice/engine/{parser,shell,commands}.ts.
---

# Shell and parser

From the repository root run `bash formal/check.sh Shell`, then `npm test`. The formal command bootstraps checksum-pinned TLC 1.7.4 and Zulu JRE 21.0.8 on Linux x86_64 into `${XDG_CACHE_HOME:-$HOME/.cache}/hub-formal` (Bash, `curl`, `tar`, and `sha256sum`; first run needs network). Read every TLA+ result with the pstack `/statechart` skill. Use `formal/Shell/Shell.tla`, `Shell.cfg`, and `view.mjs`; compare the overview and close-ups in `charts.md`.

## Code and step boundaries

Sync commit: `2b0c6c8c493a3fc1cc4fc2411d0c2d1edf099dbf`.

| Model | Implementation |
|---|---|
| `Submit`, `FreshShell` | `Shell.run` entry and `Shell` constructor in `src/practice/engine/shell.ts`; each sample starts on a fresh fixture. |
| `Tokenize` | `tokenize` in `src/practice/engine/parser.ts`; observe the quoted word's segment boundary or an unclosed quote. The model denotes a single-quoted literal segment with quotes to separate it from expandable text. |
| `Parse` | `parse` in `src/practice/engine/parser.ts`, after tokenization; all stages and redirect targets must be valid before any stage executes. |
| `ReturnParseError`, `Execute` | `Shell.run` error return (`code: 2`) and stage loop in `src/practice/engine/shell.ts`, `expandWord` in `src/practice/engine/parser.ts`, and `echo`, `ls`, and `cat` in `src/practice/engine/commands.ts`. `output` omits the trailing newline and abstracts listing contents. |

These are synchronous internal function/phase boundaries of one submission, not separately schedulable learner steps (`28` distinct states). Seven fixed input shapes cover double-quoted and single-quoted adjacency, one valid pipeline, missing stage, missing redirect target, and unclosed quote. `USER=cadet`, `USER_lab` absent; no other shell grammar, commands, stdin, redirection effects on valid input, tab-completion, `xray()` token chips, or nested scripts are proved. `tests/practice-shell.test.ts` and `tests/practice-game.test.ts` replay the behavior and vary variable names, suffixes, escaping, and malformed pipelines.

## Prove and maintain

Run `bash formal/check.sh Shell quotes` and `bash formal/check.sh Shell partial`. Expect `ExpansionKeepsBoundaries` and `ParseBeforeEffects` violations respectively; a parser/tool error is not proof. Rerun `bash formal/check.sh Shell` afterwards. Replay the shortest lines via `Game.run`, checking both `stdout` and whether `shell.revealed` changed. The `quotes` variant reproduces merging adjacent expandable segments; `partial` reproduces a hypothetical prefix-execution regression before syntax rejection. If a trace disagrees with TypeScript, check the abstraction of segment flags or parser phase before treating it as a finding. Do not relax the invariants to make findings disappear. Use `/maintain-formal-verification-skill` and advance the sync commit only after checking the new code, properties, tests, and charts against each other.
