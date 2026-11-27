# Agent Guidelines

Read [CONTEXT.md](CONTEXT.md) for domain terminology, [DIRECTION.md](DIRECTION.md) for product boundaries, and [AUTHORING.md](AUTHORING.md) before authoring or editing guided scenarios.

## Standard Checks

- `npm run check` — runs `tests/*.test.ts` and the TypeScript/Vite production build.
- `node scripts/check-state-machines.ts` — verifies the concrete route/link graph and explicit state machines.
- `bash formal/check.sh` — runs TLC against the TLA+ models in `formal/` (Linux `x86_64`).

## Verification & TLA+ Policy

- Default to TypeScript tests (`npm test`) and `node scripts/check-state-machines.ts`.
- Load and run an existing `verify-*` skill in `.agents/skills/` only when changing behavior in the files listed in its frontmatter.
- Treat `StageRunner`, `Navigation`, and `Mission` (`formal/StageRunner/`, `formal/Navigation/`, `formal/Mission/`) as the active TLA+ models to keep synced with code. Keep `Audit`, `VFS`, and `Shell` passing in `formal/check.sh`, or retire them to TypeScript tests if they become maintenance friction.
- Run negative-control variants only when editing `.tla` specs (not on routine TypeScript changes). Regenerate `formal/*/charts.md` only when modeled states or transitions change.
- Do **not** create a new TLA+ model unless explicitly requested, OR the feature has:
  1. Non-trivial multi-step state interleavings, async races/cancellation, or undo/back-stack invariants, AND
  2. Failure modes that ordinary unit tests cannot easily enumerate.
- Never model CSS/theming, static content/copy, pure single-step functions, or small linear checklists (< ~20 states) in TLA+.