export const title = "Stage scenario runner";

export function state(current) {
  if (current.inspectBroken) return "Leaving Inspect lost autoplay intent";
  if (current.readerDrifted) return "Reader-paced step auto-advanced";
  if (current.reducedMotion && current.beat < 2) return "Reduced motion left mid-beat";

  if (current.inspecting) {
    return current.resumeAutoplay
      ? "Inspecting (autoplay paused to resume)"
      : "Inspecting (reader-paced)";
  }

  if (current.autoplay) {
    return current.beat < 2 ? "Autoplay · entrance beat" : "Autoplay · reading dwell";
  }

  return current.beat < 2 ? "Reader-paced · entrance beat" : "Reader-paced · settled";
}

const labels = {
  GotoFirst: "step or jump",
  NextStep: "step or jump",
  PrevStep: "step or jump",
  ReplayStep: "replay step",
  Pause: "pause playback",
  EnterInspect: "enter Inspect mode",
  SwitchVariant: "switch locality variant",
};

export function step(action, before, after) {
  if (action === "ToggleAutoplay") {
    if (before.autoplay) return "pause autoplay";
    return before.stepIndex === 2 && before.beat === 2
      ? "restart autoplay from step 01"
      : "start autoplay";
  }
  if (action === "ToggleInspect") {
    return before.inspecting ? "exit Inspect mode" : "enter Inspect mode";
  }
  if (action === "Tick") {
    if (before.beat < 2 && after.beat === 2) return "beat settles to resting state";
    if (after.stepIndex > before.stepIndex) return "dwell completes and advances step";
    if (before.autoplay && !after.autoplay) return "final step dwell finishes";
    return "frame tick";
  }
  return labels[action];
}
