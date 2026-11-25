# Navigation, async lesson mount, and overlay Escape

Fixed `/statechart` overview for `src/main.ts`, `src/catalog.ts`, `src/platform/search.ts`, and `src/stage/player.ts`. The projection groups Atlas and Explore cutaway routes (`s0`), collapses superseded background imports that `lessonLoadToken` discards, and separates modal dialogs (`s2`), the mobile drawer (`s3`), and the four scenario stage states (`s4`–`s7`). Notice there is no arrow from `s2` or `s3` back to `s5` (`Scenario · autoplay`): opening Search, Evidence, or the mobile drawer pauses active scenario autoplay (`OverlayExclusivityAndPause`).

```mermaid
stateDiagram-v2
  s0: Atlas or cutaway view
  s1: Scenario loading
  s2: Modal dialog open
  s3: Mobile drawer open
  s4: Scenario · reader-paced
  s5: Scenario · autoplay
  s6: Scenario · Inspect mode
  s7: Scenario · component pinned
  [*] --> s0
  s0 --> s1: open guided scenario or click Think Back
  s0 --> s2: open modal dialog
  s0 --> s3: open mobile drawer
  s1 --> s0: open Atlas or cutaway or click Think Back
  s1 --> s4: scenario module finishes loading
  s1 --> s2: open modal dialog
  s1 --> s3: open mobile drawer
  s2 --> s0: press Escape to close modal
  s2 --> s1: jump to scenario from Search or press Escape to close modal
  s2 --> s4: jump to scenario from Search or press Escape to close modal
  s2 --> s6: jump to scenario from Search or press Escape to close modal
  s2 --> s7: jump to scenario from Search or press Escape to close modal
  s3 --> s0: open Atlas or cutaway or press Escape to close drawer
  s3 --> s1: open guided scenario or press Escape to close drawer
  s3 --> s2: open modal dialog
  s3 --> s4: open guided scenario or press Escape to close drawer
  s3 --> s6: open guided scenario or press Escape to close drawer
  s3 --> s7: open guided scenario or press Escape to close drawer
  s4 --> s0: open Atlas or cutaway or click Think Back
  s4 --> s1: open guided scenario or click Think Back
  s4 --> s2: open modal dialog
  s4 --> s3: open mobile drawer
  s4 --> s5: start scenario autoplay
  s4 --> s6: enter Stage Inspect
  s4 --> s7: pin component details
  s5 --> s0: open Atlas or cutaway or click Think Back
  s5 --> s1: open guided scenario or click Think Back
  s5 --> s2: open modal dialog
  s5 --> s3: open mobile drawer
  s5 --> s6: enter Stage Inspect
  s5 --> s7: pin component details
  s6 --> s0: open Atlas or cutaway or click Think Back
  s6 --> s1: open guided scenario or click Think Back
  s6 --> s2: open modal dialog
  s6 --> s3: open mobile drawer
  s6 --> s4: press Escape to exit Inspect
  s6 --> s7: pin component details
  s7 --> s0: open Atlas or cutaway or click Think Back
  s7 --> s1: open guided scenario or click Think Back
  s7 --> s2: open modal dialog
  s7 --> s3: open mobile drawer
  s7 --> s6: press Escape to unpin component
```

## Shortest counterexamples in the broken variants

This view combines the shortest counterexamples reported by TLC across `stale_mount`, `trail_loop`, and `escape_leak`. Red states indicate the first invariant violation in each negative variant.

```mermaid
stateDiagram-v2
  state "Concept Atlas (#atlas)" as Atlas
  state "Host to GPU loading (token 1)" as LoadGpu
  state "Navigated back to Atlas (token 2)" as ReturnedAtlas
  state "Stale Host to GPU mounted over Atlas" as StaleMounted
  state "Think Back points to #atlas while on #atlas" as SelfLoop
  state "Scenario mounted & Inspect active" as InspectActive
  state "Mobile drawer open over Inspect" as DrawerOverInspect
  state "Drawer closed AND Inspect exited on one Escape" as EscapeLeaked

  [*] --> Atlas
  Atlas --> LoadGpu: open Host to GPU
  LoadGpu --> ReturnedAtlas: open Concept Atlas before import resolves
  ReturnedAtlas --> StaleMounted: broken ResolveStaleLoad without token check
  Atlas --> SelfLoop: broken NavigateTo(#atlas) pushes current route
  LoadGpu --> InspectActive: module loads, enter Stage Inspect
  InspectActive --> DrawerOverInspect: open mobile drawer
  DrawerOverInspect --> EscapeLeaked: broken Escape without preventDefault

  classDef breaks fill:#ffe4e4,stroke:#b42318,color:#8a1b13
  class StaleMounted,SelfLoop,EscapeLeaked breaks
```

- `stale_mount`: violates `MountedMatchesActiveLesson` on step 3 (`NavLessonGpu` → `NavAtlas` → `ResolveStaleLoad`). Without `token === lessonLoadToken` in `ensureLessonMounted`, an older dynamic `import()` resolving after leaving `#lesson/host-to-gpu` (or re-entering it after visiting `#atlas`) mounts over the wrong view or leaks a duplicate `MountedStageScenario`.
- `trail_loop`: violates `BackNeverSelfLoops` when `pushTrail` records the destination route or when an in-place subject switch (`#a30/memory` → `#a30` → subject-picker `memory`) leaves `#a30/memory` at the top of `trail`. `pruneTrailForDestination` in `src/catalog.ts` strips trailing destination matches so `Think Back` never points to the current route.
- `escape_leak`: violates `OverlayEscapeIsolation` on step 5 (`NavLessonGpu` → `ResolveCurrentLoad` → `EnterStageInspect` → `OpenDrawer` → `PressEscape`). In `src/main.ts`, `#sidebar` calls `event.preventDefault()` before `closeNavigation(true)` removes `.navigation-open`, ensuring the bubbling `keydown` event is ignored by `src/stage/player.ts` (`if (event.defaultPrevented ...) return`) instead of simultaneously exiting Stage Inspect.

## Close-up: layered Escape stack

Each `Escape` press peels exactly one active surface from top to bottom without disturbing underlying stage or route state:

```mermaid
stateDiagram-v2
  state "Modal dialog (<dialog#switcher> or <dialog#evidence-dialog>)" as Modal
  state "Mobile navigation drawer (body.navigation-open)" as Drawer
  state "Stage Inspect · component pinned (pinnedPart)" as Pinned
  state "Stage Inspect · browsing parts (state.inspecting)" as Inspect
  state "Scenario · reader-paced" as StageRest

  Modal --> StageRest: Escape closes modal (stopPropagation)
  Modal --> Pinned: Escape closes modal, preserves pinned part
  Drawer --> Pinned: Escape closes drawer (preventDefault), preserves pinned part
  Pinned --> Inspect: Escape unpins component, keeps Inspect active
  Inspect --> StageRest: Escape exits Inspect (restores autoplay if prior)
```
