# Stage scenario runner

Fixed `/statechart` overview for `reduceRunnerState` (`src/stage/runner.ts`). The projection collapses step indices (`0..2`), reading-dwell sub-ticks, and `Local` vs. `Cross-socket` variants so playback, causal entrance beats, and `Inspect` pause/resume appear directly. Standard motion enters at `s0` (`beatProgress = 0`); `prefers-reduced-motion: reduce` enters immediately at `s1` (`beatProgress = 1`).

```mermaid
stateDiagram-v2
  s0: Reader-paced · entrance beat
  s1: Reader-paced · settled
  s2: Autoplay · entrance beat
  s3: Inspecting (reader-paced)
  s4: Autoplay · reading dwell
  s5: Inspecting (autoplay paused to resume)
  [*] --> s0
  [*] --> s1
  s0 --> s1: beat settles to resting state
  s0 --> s2: start autoplay
  s0 --> s3: enter Inspect mode
  s1 --> s0: step or jump or replay step or switch locality variant
  s1 --> s2: restart autoplay from step 01
  s1 --> s4: start autoplay or restart autoplay from step 01
  s1 --> s3: enter Inspect mode
  s2 --> s0: pause autoplay or pause playback or switch locality variant
  s2 --> s4: beat settles to resting state
  s2 --> s5: enter Inspect mode
  s3 --> s0: step or jump or replay step or exit Inspect mode or switch locality variant
  s3 --> s1: step or jump or replay step or exit Inspect mode or switch locality variant
  s3 --> s2: start autoplay or restart autoplay from step 01
  s3 --> s4: start autoplay or restart autoplay from step 01
  s4 --> s0: switch locality variant
  s4 --> s1: pause autoplay or pause playback or switch locality variant or final step dwell finishes
  s4 --> s2: step or jump or replay step or dwell completes and advances step
  s4 --> s5: enter Inspect mode
  s5 --> s0: step or jump or replay step or switch locality variant
  s5 --> s1: step or jump or replay step or switch locality variant
  s5 --> s2: start autoplay or exit Inspect mode or restart autoplay from step 01
  s5 --> s3: pause playback
  s5 --> s4: start autoplay or exit Inspect mode or restart autoplay from step 01
```

## Shortest counterexamples in the broken variants

This chart combines the shortest counterexample traces found by TLC across `inspect_clobber`, `reduced_stall`, and `reader_drift`. Red marks the first invariant violation in each negative variant, not a current implementation bug.

```mermaid
stateDiagram-v2
  state "Reader-paced · entrance beat (step 01)" as Start
  state "Autoplay · entrance beat" as Auto
  state "Inspecting (resumeAutoplay = true)" as InspectAuto
  state "Exited Inspect, autoplay lost" as Clobbered
  state "Reduced motion · settled at step 01" as ReducedInit
  state "Reduced motion · stranded at beatProgress = 0" as Stalled
  state "Reader-paced · settled at beatProgress = 1" as Settled
  state "Reader-paced · dwell tick" as DwellLeak
  state "Reader-paced · auto-advanced to step 02" as Drifted

  [*] --> Start
  Start --> Auto: start autoplay
  Auto --> InspectAuto: enter Inspect mode
  InspectAuto --> Clobbered: broken exit Inspect mode
  [*] --> ReducedInit
  ReducedInit --> Stalled: broken step or jump without reduced-motion snap
  Start --> Settled: 2 frame ticks settle beat
  Settled --> DwellLeak: broken reader-paced dwell tick
  DwellLeak --> Drifted: broken tick advances step without autoplay

  classDef breaks fill:#ffe4e4,stroke:#b42318,color:#8a1b13
  class Clobbered,Stalled,Drifted breaks
```

- `inspect_clobber`: violates `InspectPreservesContext` on step 3 (`ToggleAutoplay` → `EnterInspect` → `ToggleInspect`). Entering Inspect pauses active autoplay into `resumeAutoplayAfterInspect`; leaving Inspect via `toggle-inspect` must restore `autoplay` without advancing `stepIndex`. Explicit `pause` (`s5 --> s3` in the overview) clears `resumeAutoplayAfterInspect` so background tab hides or modal opens never restart autoplay unexpectedly.
- `reduced_stall`: violates `ReducedMotionSettlesImmediately` on step 1 (`Init(reducedMotion = TRUE)` → `GotoFirst`). Under `prefers-reduced-motion: reduce`, `freshBeat` and `tick` snap `beatProgress` to `1` immediately while still advancing autoplay after reading dwell.
- `reader_drift`: violates `ReaderPacedNeverAutoAdvances` on step 4 (`Tick` settles beat → `Tick` accumulates dwell → `Tick` advances step while `autoplay = false`). In `reduceRunnerState`, reader-paced steps rest indefinitely at `beatProgress = 1` until the learner steps manually or enables Autoplay.
