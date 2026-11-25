export const title = "Navigation, async lesson mount, and overlay Escape";

function effectiveBack(current) {
  const len = Object.keys(current.trail).length;
  return len > 0 ? current.trail[len] : current.route === "atlas" ? "none" : "atlas";
}

export function state(current) {
  if (current.escapeLeaked) return "Escape leaked across overlay layers";
  if (current.mounted !== "none" && (current.route !== current.mounted || current.mountCount > 1)) {
    return current.route !== current.mounted
      ? "Stale lesson mounted over active route"
      : "Duplicate scenario mounted into view";
  }
  if (effectiveBack(current) === current.route) {
    return "Think Back points to current route";
  }

  if (current.modal !== "none") return "Modal dialog open";
  if (current.drawerOpen) return "Mobile drawer open";

  if (current.route === "atlas" || current.route === "a30_gpu" || current.route === "a30_mem") {
    return "Atlas or cutaway view";
  }

  if (current.mounted === "none") return "Scenario loading";
  if (current.stageState === "pinned") return "Scenario · component pinned";
  if (current.stageState === "inspect") return "Scenario · Inspect mode";
  if (current.stageState === "playing") return "Scenario · autoplay";
  return "Scenario · reader-paced";
}

export function step(action, before, after) {
  if (action === "OpenSearch" || action === "OpenEvidence") return "open modal dialog";
  if (action === "OpenDrawer") return "open mobile drawer";
  if (action === "NavigateTo") {
    return after.route === "lesson_gpu" || after.route === "lesson_ssh"
      ? "open guided scenario"
      : "open Atlas or cutaway";
  }
  if (action === "ThinkBack") return "click Think Back";
  if (action === "PressEscape") {
    if (before.modal !== "none") return "press Escape to close modal";
    if (before.drawerOpen) return "press Escape to close drawer";
    if (before.stageState === "pinned") return "press Escape to unpin component";
    if (before.stageState === "inspect") return "press Escape to exit Inspect";
    return "press Escape";
  }
  if (action === "ResolveStaleLoad") {
    return after.mounted !== before.mounted || after.mountCount !== before.mountCount
      ? "stale scenario load overwrites view"
      : "discard superseded scenario load";
  }
  const labels = {
    SelectWorkbenchSubject: "switch workbench subject in place",
    ResolveCurrentLoad: "scenario module finishes loading",
    StartStageAutoplay: "start scenario autoplay",
    EnterStageInspect: "enter Stage Inspect",
    PinStagePart: "pin component details",
    SwitchViaSearch: "jump to scenario from Search",
  };
  return labels[action];
}
