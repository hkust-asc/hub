---------------------------- MODULE Navigation -----------------------------
EXTENDS Integers, Sequences
CONSTANT Variant
VARIABLES route, trail, currentLoad, staleLoad, mounted, mountCount,
          modal, drawerOpen, stageState, escapeLeaked

Routes == {"atlas", "a30_gpu", "a30_mem", "lesson_gpu", "lesson_ssh"}
Lessons == {"lesson_gpu", "lesson_ssh"}
WorkbenchRoutes == {"a30_gpu", "a30_mem"}
MaxTrail == 1

Fallback(r) ==
  CASE r = "atlas" -> "none"
    [] OTHER -> "atlas"

PruneTrail(stack, dest) ==
  IF Len(stack) = 0 THEN <<>>
  ELSE IF stack[Len(stack)] = dest THEN <<>>
  ELSE stack

AppendCap(stack, item) ==
  IF Len(stack) >= MaxTrail THEN <<item>> ELSE Append(stack, item)

PushTrail(stack, item, dest) ==
  IF Variant = "trail_loop" THEN AppendCap(stack, item)
  ELSE IF item = dest THEN PruneTrail(stack, dest)
  ELSE IF Len(stack) > 0 /\ stack[Len(stack)] = item THEN stack
  ELSE AppendCap(stack, item)

EffectiveBackTarget ==
  IF Len(trail) > 0 THEN trail[Len(trail)] ELSE Fallback(route)

PauseIfPlaying(st) ==
  IF st = "playing" THEN "paused" ELSE st

ApplyRoute(dest, nextTrail) ==
  /\ route' = dest
  /\ trail' = nextTrail
  /\ IF dest \in Lessons /\ mounted = dest
     THEN UNCHANGED <<currentLoad, staleLoad, mounted, mountCount, stageState>>
     ELSE /\ staleLoad' = IF currentLoad = "lesson_gpu" THEN "lesson_gpu" ELSE staleLoad
          /\ currentLoad' = IF dest \in Lessons THEN dest ELSE "none"
          /\ mounted' = "none"
          /\ mountCount' = 0
          /\ stageState' = "none"

Init ==
  /\ route = "atlas"
  /\ trail = <<>>
  /\ currentLoad = "none"
  /\ staleLoad = "none"
  /\ mounted = "none"
  /\ mountCount = 0
  /\ modal = "none"
  /\ drawerOpen = FALSE
  /\ stageState = "none"
  /\ escapeLeaked = FALSE

NavigateTo(dest) ==
  /\ modal = "none"
  /\ ApplyRoute(dest, PushTrail(trail, route, dest))
  /\ drawerOpen' = FALSE
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED modal

NavAtlas == NavigateTo("atlas")
NavA30Gpu == NavigateTo("a30_gpu")
NavA30Mem == NavigateTo("a30_mem")
NavLessonGpu == NavigateTo("lesson_gpu")
NavLessonSsh == NavigateTo("lesson_ssh")

SelectWorkbenchSubject ==
  /\ modal = "none" /\ ~drawerOpen
  /\ route \in WorkbenchRoutes
  /\ LET dest == IF route = "a30_gpu" THEN "a30_mem" ELSE "a30_gpu"
     IN /\ route' = dest
        /\ trail' = IF Variant = "trail_loop" THEN trail ELSE PruneTrail(trail, dest)
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<currentLoad, staleLoad, mounted, mountCount, modal, drawerOpen, stageState>>

ThinkBack ==
  /\ modal = "none" /\ ~drawerOpen
  /\ EffectiveBackTarget /= "none"
  /\ LET dest == EffectiveBackTarget
         rest == <<>>
     IN ApplyRoute(dest, IF Variant = "trail_loop" THEN rest ELSE PruneTrail(rest, dest))
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<modal, drawerOpen>>

ResolveCurrentLoad ==
  /\ currentLoad /= "none"
  /\ mounted' = currentLoad
  /\ mountCount' = IF mountCount < 2 THEN mountCount + 1 ELSE 2
  /\ currentLoad' = "none"
  /\ stageState' = "paused"
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, staleLoad, modal, drawerOpen>>

ResolveStaleLoad ==
  /\ staleLoad /= "none"
  /\ staleLoad' = "none"
  /\ IF Variant = "stale_mount"
     THEN /\ mounted' = staleLoad
          /\ mountCount' = IF mountCount < 2 THEN mountCount + 1 ELSE 2
          /\ stageState' = "paused"
     ELSE UNCHANGED <<mounted, mountCount, stageState>>
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, currentLoad, modal, drawerOpen>>

StartStageAutoplay ==
  /\ modal = "none" /\ ~drawerOpen
  /\ mounted /= "none" /\ stageState = "paused"
  /\ stageState' = "playing"
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, currentLoad, staleLoad, mounted, mountCount, modal, drawerOpen>>

EnterStageInspect ==
  /\ modal = "none" /\ ~drawerOpen
  /\ mounted /= "none" /\ stageState \in {"playing", "paused"}
  /\ stageState' = "inspect"
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, currentLoad, staleLoad, mounted, mountCount, modal, drawerOpen>>

PinStagePart ==
  /\ modal = "none" /\ ~drawerOpen
  /\ mounted /= "none" /\ stageState \in {"playing", "paused", "inspect"}
  /\ stageState' = "pinned"
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, currentLoad, staleLoad, mounted, mountCount, modal, drawerOpen>>

OpenSearch ==
  /\ modal = "none"
  /\ modal' = "search"
  /\ drawerOpen' = FALSE
  /\ stageState' = PauseIfPlaying(stageState)
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, currentLoad, staleLoad, mounted, mountCount>>

OpenEvidence ==
  /\ modal = "none"
  /\ modal' = "evidence"
  /\ drawerOpen' = FALSE
  /\ stageState' = PauseIfPlaying(stageState)
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, currentLoad, staleLoad, mounted, mountCount>>

OpenDrawer ==
  /\ modal = "none" /\ ~drawerOpen
  /\ drawerOpen' = TRUE
  /\ stageState' = PauseIfPlaying(stageState)
  /\ escapeLeaked' = FALSE
  /\ UNCHANGED <<route, trail, currentLoad, staleLoad, mounted, mountCount, modal>>

SwitchViaSearch ==
  /\ modal = "search"
  /\ modal' = "none"
  /\ drawerOpen' = FALSE
  /\ ApplyRoute("lesson_gpu", PushTrail(trail, route, "lesson_gpu"))
  /\ escapeLeaked' = FALSE

PressEscape ==
  LET nextModal == "none"
      nextDrawer == IF modal /= "none" THEN drawerOpen ELSE FALSE
      nextStage ==
        IF modal /= "none" THEN stageState
        ELSE IF drawerOpen THEN
          IF Variant = "escape_leak" /\ stageState = "pinned" THEN "inspect"
          ELSE IF Variant = "escape_leak" /\ stageState = "inspect" THEN "paused"
          ELSE stageState
        ELSE IF stageState = "pinned" THEN "inspect"
        ELSE IF stageState = "inspect" THEN "paused"
        ELSE stageState
  IN /\ modal' = nextModal
     /\ drawerOpen' = nextDrawer
     /\ stageState' = nextStage
     /\ escapeLeaked' =
          \/ (modal /= "none" /\ (nextDrawer /= drawerOpen \/ nextStage /= stageState))
          \/ (modal = "none" /\ drawerOpen /\ nextStage /= stageState)
          \/ (modal = "none" /\ ~drawerOpen /\ stageState = "pinned" /\ nextStage /= "inspect")
     /\ UNCHANGED <<route, trail, currentLoad, staleLoad, mounted, mountCount>>

Next ==
  \/ NavAtlas \/ NavA30Gpu \/ NavA30Mem \/ NavLessonGpu \/ NavLessonSsh
  \/ SelectWorkbenchSubject \/ ThinkBack
  \/ ResolveCurrentLoad \/ ResolveStaleLoad
  \/ StartStageAutoplay \/ EnterStageInspect \/ PinStagePart
  \/ OpenSearch \/ OpenEvidence \/ OpenDrawer \/ SwitchViaSearch \/ PressEscape

MountedMatchesActiveLesson ==
  /\ (mounted /= "none" => (route = mounted /\ mountCount = 1))
  /\ (route \notin Lessons => (mounted = "none" /\ currentLoad = "none" /\ mountCount = 0 /\ stageState = "none"))

BackNeverSelfLoops ==
  /\ EffectiveBackTarget /= route
  /\ (route = "atlas" => Fallback(route) = "none")

OverlayExclusivityAndPause ==
  /\ (modal /= "none" => ~drawerOpen)
  /\ ((modal /= "none" \/ drawerOpen) => stageState /= "playing")

OverlayEscapeIsolation == ~escapeLeaked
=============================================================================
