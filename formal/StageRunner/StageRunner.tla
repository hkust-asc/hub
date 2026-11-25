---------------------------- MODULE StageRunner ----------------------------
EXTENDS Integers
CONSTANT Variant
VARIABLES stepIndex, beat, dwell, autoplay, inspecting, resumeAutoplay,
          reducedMotion, variant, inspectBroken, readerDrifted

MaxStep == 2

FreshBeat(rm) ==
  IF rm /\ Variant /= "reduced_stall" THEN 2 ELSE 0

ViolatesInspectOnTick(nextStep, nextBeat, nextDwell) ==
  inspecting /\ (nextStep /= stepIndex \/ nextBeat /= beat \/ nextDwell /= dwell)

ViolatesInspectOnExit(nextStep, nextBeat, nextAutoplay) ==
  nextStep /= stepIndex \/ nextBeat /= beat \/ nextAutoplay /= resumeAutoplay

Init ==
  /\ stepIndex = 0
  /\ reducedMotion \in BOOLEAN
  /\ beat = IF reducedMotion THEN 2 ELSE 0
  /\ dwell = 0
  /\ autoplay = FALSE
  /\ inspecting = FALSE
  /\ resumeAutoplay = FALSE
  /\ variant = "local"
  /\ inspectBroken = FALSE
  /\ readerDrifted = FALSE

GotoFirst ==
  /\ stepIndex' = 0
  /\ beat' = FreshBeat(reducedMotion)
  /\ dwell' = 0
  /\ inspecting' = FALSE /\ resumeAutoplay' = FALSE
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<autoplay, reducedMotion, variant>>

NextStep ==
  /\ stepIndex < MaxStep
  /\ stepIndex' = stepIndex + 1
  /\ beat' = FreshBeat(reducedMotion)
  /\ dwell' = 0
  /\ inspecting' = FALSE /\ resumeAutoplay' = FALSE
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<autoplay, reducedMotion, variant>>

PrevStep ==
  /\ stepIndex > 0
  /\ stepIndex' = stepIndex - 1
  /\ beat' = FreshBeat(reducedMotion)
  /\ dwell' = 0
  /\ inspecting' = FALSE /\ resumeAutoplay' = FALSE
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<autoplay, reducedMotion, variant>>

ReplayStep ==
  /\ beat' = FreshBeat(reducedMotion)
  /\ dwell' = 0
  /\ inspecting' = FALSE /\ resumeAutoplay' = FALSE
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<stepIndex, autoplay, reducedMotion, variant>>

ToggleAutoplay ==
  /\ IF autoplay
     THEN /\ autoplay' = FALSE /\ dwell' = 0
          /\ UNCHANGED <<stepIndex, beat, inspecting, resumeAutoplay>>
     ELSE LET restart == stepIndex = MaxStep /\ beat = 2
          IN /\ stepIndex' = IF restart THEN 0 ELSE stepIndex
             /\ beat' = IF restart THEN FreshBeat(reducedMotion) ELSE beat
             /\ dwell' = 0
             /\ autoplay' = TRUE
             /\ inspecting' = FALSE /\ resumeAutoplay' = FALSE
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<reducedMotion, variant>>

Pause ==
  /\ autoplay' = FALSE
  /\ dwell' = 0
  /\ resumeAutoplay' = FALSE
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<stepIndex, beat, inspecting, reducedMotion, variant>>

EnterInspect ==
  /\ ~inspecting
  /\ inspecting' = TRUE
  /\ resumeAutoplay' = autoplay
  /\ autoplay' = FALSE
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<stepIndex, beat, dwell, reducedMotion, variant>>

ToggleInspect ==
  /\ IF inspecting
     THEN LET nextAuto == IF Variant = "inspect_clobber" THEN FALSE ELSE resumeAutoplay
              nextStep == stepIndex
              nextBeat == beat
          IN /\ inspecting' = FALSE
             /\ autoplay' = nextAuto
             /\ resumeAutoplay' = FALSE
             /\ dwell' = 0
             /\ stepIndex' = nextStep /\ beat' = nextBeat
             /\ inspectBroken' = ViolatesInspectOnExit(nextStep, nextBeat, nextAuto)
     ELSE /\ inspecting' = TRUE
          /\ resumeAutoplay' = autoplay
          /\ autoplay' = FALSE
          /\ inspectBroken' = FALSE
          /\ UNCHANGED <<stepIndex, beat, dwell>>
  /\ readerDrifted' = FALSE
  /\ UNCHANGED <<reducedMotion, variant>>

SwitchVariant ==
  /\ variant' = IF variant = "local" THEN "remote" ELSE "local"
  /\ autoplay' = FALSE
  /\ inspecting' = FALSE /\ resumeAutoplay' = FALSE
  /\ beat' = FreshBeat(reducedMotion)
  /\ dwell' = 0
  /\ inspectBroken' = FALSE /\ readerDrifted' = FALSE
  /\ UNCHANGED <<stepIndex, reducedMotion>>

Tick ==
  LET nextTuple ==
        IF inspecting THEN <<stepIndex, beat, dwell, autoplay>>
        ELSE IF reducedMotion THEN
          IF ~autoplay /\ Variant /= "reader_drift" THEN <<stepIndex, 2, 0, FALSE>>
          ELSE IF dwell = 0 THEN <<stepIndex, 2, 1, autoplay>>
          ELSE IF stepIndex >= MaxStep THEN <<stepIndex, 2, 0, FALSE>>
          ELSE <<stepIndex + 1, FreshBeat(TRUE), 0, autoplay>>
        ELSE IF beat < 2 THEN <<stepIndex, beat + 1, 0, autoplay>>
        ELSE IF ~autoplay /\ Variant /= "reader_drift" THEN <<stepIndex, 2, 0, FALSE>>
        ELSE IF dwell = 0 THEN <<stepIndex, 2, 1, autoplay>>
        ELSE IF stepIndex >= MaxStep THEN <<stepIndex, 2, 0, FALSE>>
        ELSE <<stepIndex + 1, FreshBeat(FALSE), 0, autoplay>>
      nStep == nextTuple[1]
      nBeat == nextTuple[2]
      nDwell == nextTuple[3]
      nAuto == nextTuple[4]
  IN /\ stepIndex' = nStep
     /\ beat' = nBeat
     /\ dwell' = nDwell
     /\ autoplay' = nAuto
     /\ inspectBroken' = ViolatesInspectOnTick(nStep, nBeat, nDwell)
     /\ readerDrifted' = (~autoplay /\ nStep /= stepIndex)
     /\ UNCHANGED <<inspecting, resumeAutoplay, reducedMotion, variant>>

Next ==
  \/ GotoFirst \/ NextStep \/ PrevStep \/ ReplayStep
  \/ ToggleAutoplay \/ Pause \/ EnterInspect \/ ToggleInspect
  \/ SwitchVariant \/ Tick

RunnerStateCoherence ==
  /\ stepIndex \in 0..MaxStep
  /\ beat \in 0..2
  /\ ~(inspecting /\ autoplay)
  /\ (resumeAutoplay => inspecting)
  /\ (beat < 2 => dwell = 0)

InspectPreservesContext == ~inspectBroken
ReducedMotionSettlesImmediately == reducedMotion => beat = 2
ReaderPacedNeverAutoAdvances == ~readerDrifted
=============================================================================
