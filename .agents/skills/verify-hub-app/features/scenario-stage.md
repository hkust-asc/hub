# Scenario Stage workbench

Scenario Stage mounts guided interactive walkthroughs (`#lesson/<id>` and `#lesson/<id>/<step>`) with reader-paced steps, causal entrance beats (`0..1`), optional Autoplay dwell, `Inspect` component popovers, camera `Fit` override, locality variants, `prefers-reduced-motion` snapping, and persistent step bookmarks.

## Sub-features

- `stage-stepping` advances and rewinds steps via `[data-stage-prev]`, `[data-stage-next]`, `.stage-step-btn` pills, and `ArrowLeft` / `ArrowRight`, settling at `beatProgress = 1`.
- `stage-autoplay-inspect` runs Autoplay (`[data-stage-play]` or `Space`), freezes beat/dwell on `Inspect` (`[data-stage-inspect]`, `I`, or component click), and restores pre-inspect Autoplay intent on `Escape` / `ToggleInspect`.
- `stage-variants-fit` switches `Local` vs. `Cross-socket` (`[data-stage-variant]`) and toggles `Fit` (`[data-stage-fit]` / `0`) on zoomed isometric steps.
- `stage-reduced-motion` snaps step progress immediately to `scaleX(1)` (`beatProgress = 1`) when `prefers-reduced-motion: reduce` is active.
- `stage-bookmark-resume` persists progress in `localStorage['hpc4:learning:v1']` and surfaces `#resume-slot` in the sidebar on other views.

## How to get to it (user POV)

- Open `#learn` and choose any scenario card (`Host to GPU`, `SSH & tmux`, `Streams & redirection`, `Linux filesystem`, `Job walkthrough`, `Environment modules`).
- Choose a Guided Scenario tile on `#atlas`, `#atlas/domains`, or `#atlas/<category>`.
- Navigate directly to `#lesson/<id>` or deep-link to a 1-based step `#lesson/<id>/<step>`.
- Choose the `Resume scenario` card in `#resume-slot` in the left sidebar.

## Driving it with control-hub

Preconditions:

- `control-hub.ts doctor --run-id "$RUN_ID"` reports `"status": "healthy"`.
- Fresh browser profile so `hpc4:learning:v1` starts empty.

- **Run automated journey.** Execute `node .agents/skills/verify-hub-app/scripts/control-hub.ts drive --run-id "$RUN_ID" --evidence-dir "$EVIDENCE_DIR" --journey stage`. Exit code is `0` and `03-stage-host-to-gpu-inspect.png` is captured.
- **Step and switch variant.** Open `#lesson/host-to-gpu`, click `[data-stage-next]` twice to reach Step 03 (`Copy in`), and click `[data-stage-variant="remote"]`. Confirm the third `.stage-step-btn` has `aria-current="step"` and `remote` has `aria-pressed="true"`.
- **Verify Inspect preserves Autoplay.** Click `[data-stage-play]` (`aria-pressed="true"`), then click `[data-stage-inspect]`. Confirm `inspect` is `true` and `play` pauses (`aria-pressed="false"`). Press `Escape`; confirm `inspect` exits (`false`), `play` resumes (`true`), and `stepIndex` stays `2`.
- **Verify reduced-motion snap.** Enable `prefers-reduced-motion: reduce` media emulation and click `[data-stage-next]`. Confirm the active `.stage-step-fill` immediately reads `scaleX(1)`.
- **Confirm bookmark from second view.** Click `[data-route="#atlas"]` in the sidebar and confirm `#resume-slot` is visible and names `Host to GPU`.

## Gotchas

- `#lesson/<id>/<step>` URLs are 1-based (`#lesson/streams/3` mounts `stepIndex = 2`); `step = 0` or non-numeric suffixes normalize to `#lesson/<id>`.
- When a component is pinned inside `Inspect` (`popEl.dataset.pinned === "true"`), the first `Escape` unpins the component and the second `Escape` exits `Inspect` mode.
- Switching locality variants intentionally pauses `Autoplay` and replays the current step's entrance beat.
