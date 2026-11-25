# HPC4 Hub

An educational explorer of HPC and ASC workshop concepts, with HPC4 as a concrete example. Shared subjects connect free exploration with guided explanations.

## Language

**Subject**:
A hardware component, software tool, concept, or operation being explained. A subject can appear in multiple scenes and scenarios.
_Avoid_: Treating every subject as a physical component

**Scene**:
A bounded view of a system or mechanism that answers a specific question. A cluster overview and an A30 cutaway are different scenes of the same system.
_Avoid_: Page, recursively nested illustration

**Scenario**:
A guided, replayable sequence explaining a concrete question or workload through one or more scenes.
_Avoid_: Simulation, benchmark, performance trace

**Step**:
A deliberate, reader-paced explanatory state within a scenario, with a canonical resting snapshot, state-invariant HUD chips, structural deltas ("What changed"), and prose explanation. It does not represent a fixed amount of real execution time.
_Avoid_: Frame

**Beat**:
The bounded causal entrance animation (`0..1`) within a step—such as a packet crossing a wire or a progress meter advancing—that plays upon entering the step and settles into the step's deterministic resting state.
_Avoid_: Frame, benchmark interval, global millisecond timeline

**Hardware Profile**:
The specifications and evidenced relationships of a particular kind of HPC4 hardware, distinct from its visual representation.
_Avoid_: Universal HPC4 server

**Visual Asset**:
A reusable depiction of a kind of subject, independent of any particular hardware profile or scenario.
_Avoid_: Hardware specification

**Evidence**:
The source and verification status of a claim. Published or measured facts, illustrative relationships, and unknowns are explicitly distinguishable.
_Avoid_: Assuming that visual detail proves factual accuracy