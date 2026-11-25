import type { StageContinuation, StageContinuationLink, StageStepDef } from './types.ts'

export type StagePlaybackRate = 0.5 | 1 | 2

export interface StageRailNavView {
  readonly isFirstStep: boolean
  readonly isFinalStep: boolean
  readonly prevStepLabel: string | null
  readonly nextStepLabel: string | null
  readonly returnLink: StageContinuationLink | null
  readonly primaryContinuation: StageContinuationLink | null
  readonly secondaryContinuation: readonly StageContinuationLink[]
  readonly upNextKicker: string
}

export function describeStageRailNav(options: {
  steps: readonly StageStepDef[]
  stepIndex: number
  returnLink?: StageContinuationLink
  continuation?: StageContinuation
}): StageRailNavView {
  const maxIdx = Math.max(0, options.steps.length - 1)
  const clamped = Math.max(0, Math.min(maxIdx, options.stepIndex))
  const isFirstStep = clamped === 0
  const isFinalStep = clamped >= maxIdx
  return {
    isFirstStep,
    isFinalStep,
    prevStepLabel: isFirstStep ? null : options.steps[clamped - 1]!.label,
    nextStepLabel: isFinalStep ? null : options.steps[clamped + 1]!.label,
    returnLink: isFirstStep && options.returnLink ? options.returnLink : null,
    primaryContinuation: isFinalStep && options.continuation ? options.continuation.primary : null,
    secondaryContinuation: isFinalStep && options.continuation?.secondary ? options.continuation.secondary : [],
    upNextKicker: options.continuation?.kicker ?? 'Up next',
  }
}

export function describeStageCue(inspecting: boolean, hasPinnedPart: boolean): string {
  if (!inspecting) return 'Click any block to inspect (I)'
  if (hasPinnedPart) return 'Inspecting component · Click another block or press Esc to close'
  return 'Inspect active · Click, hover, or Tab through blocks (Esc to exit)'
}

export interface StageRunnerState<VariantId extends string = string> {
  readonly stepIndex: number
  readonly beatProgress: number
  readonly dwellElapsedMs: number
  readonly autoplay: boolean
  readonly inspecting: boolean
  readonly resumeAutoplayAfterInspect: boolean
  readonly fitOverride: boolean
  readonly rate: StagePlaybackRate
  readonly variant: VariantId
}

export type StageRunnerAction<VariantId extends string = string> =
  | { readonly type: 'goto'; readonly stepIndex: number }
  | { readonly type: 'next' }
  | { readonly type: 'prev' }
  | { readonly type: 'replay-step' }
  | { readonly type: 'toggle-autoplay' }
  | { readonly type: 'pause' }
  | { readonly type: 'toggle-inspect' }
  | { readonly type: 'enter-inspect' }
  | { readonly type: 'toggle-fit' }
  | { readonly type: 'set-rate'; readonly rate: StagePlaybackRate }
  | { readonly type: 'set-variant'; readonly variant: VariantId }
  | { readonly type: 'tick'; readonly dtMs: number; readonly reducedMotion: boolean }

const DEFAULT_BEAT_MS = 1350
const DEFAULT_DWELL_MS = 2700

export function stepBeatMs(step: StageStepDef): number {
  return step.beatDurationMs ?? DEFAULT_BEAT_MS
}

export function stepDwellMs(step: StageStepDef): number {
  return step.dwellMs ?? DEFAULT_DWELL_MS
}

export function createInitialRunnerState<VariantId extends string = string>(options: {
  steps: readonly StageStepDef[]
  initialStep?: number
  defaultVariant: VariantId
  reducedMotion?: boolean
}): StageRunnerState<VariantId> {
  const maxIdx = Math.max(0, options.steps.length - 1)
  const clamped = Math.max(0, Math.min(maxIdx, options.initialStep ?? 0))
  const beatMs = stepBeatMs(options.steps[clamped]!)
  return {
    stepIndex: clamped,
    beatProgress: options.reducedMotion || beatMs <= 0 ? 1 : 0,
    dwellElapsedMs: 0,
    autoplay: false,
    inspecting: false,
    resumeAutoplayAfterInspect: false,
    fitOverride: false,
    rate: 1,
    variant: options.defaultVariant,
  }
}

export function reduceRunnerState<VariantId extends string = string>(
  state: StageRunnerState<VariantId>,
  action: StageRunnerAction<VariantId>,
  steps: readonly StageStepDef[],
  reducedMotion = false,
): StageRunnerState<VariantId> {
  const maxIdx = Math.max(0, steps.length - 1)
  const freshBeat = (idx: number): number => {
    const ms = stepBeatMs(steps[idx]!)
    return reducedMotion || ms <= 0 ? 1 : 0
  }

  switch (action.type) {
    case 'goto': {
      const target = Math.max(0, Math.min(maxIdx, action.stepIndex))
      return {
        ...state,
        stepIndex: target,
        beatProgress: freshBeat(target),
        dwellElapsedMs: 0,
        inspecting: false,
        resumeAutoplayAfterInspect: false,
      }
    }
    case 'next': {
      if (state.stepIndex >= maxIdx) return state
      const target = state.stepIndex + 1
      return {
        ...state,
        stepIndex: target,
        beatProgress: freshBeat(target),
        dwellElapsedMs: 0,
        inspecting: false,
        resumeAutoplayAfterInspect: false,
      }
    }
    case 'prev': {
      if (state.stepIndex <= 0) return state
      const target = state.stepIndex - 1
      return {
        ...state,
        stepIndex: target,
        beatProgress: freshBeat(target),
        dwellElapsedMs: 0,
        inspecting: false,
        resumeAutoplayAfterInspect: false,
      }
    }
    case 'replay-step':
      return {
        ...state,
        beatProgress: freshBeat(state.stepIndex),
        dwellElapsedMs: 0,
        inspecting: false,
        resumeAutoplayAfterInspect: false,
      }
    case 'toggle-autoplay': {
      if (state.autoplay) {
        return { ...state, autoplay: false, dwellElapsedMs: 0 }
      }
      const restartFromZero = state.stepIndex === maxIdx && state.beatProgress >= 1
      const nextStep = restartFromZero ? 0 : state.stepIndex
      return {
        ...state,
        stepIndex: nextStep,
        beatProgress: restartFromZero ? freshBeat(0) : state.beatProgress,
        dwellElapsedMs: 0,
        autoplay: true,
        inspecting: false,
        resumeAutoplayAfterInspect: false,
      }
    }
    case 'pause':
      return {
        ...state,
        autoplay: false,
        dwellElapsedMs: 0,
        resumeAutoplayAfterInspect: false,
      }
    case 'enter-inspect':
      if (state.inspecting) return state
      return {
        ...state,
        inspecting: true,
        resumeAutoplayAfterInspect: state.autoplay,
        autoplay: false,
      }
    case 'toggle-inspect':
      return state.inspecting
        ? {
          ...state,
          inspecting: false,
          autoplay: state.resumeAutoplayAfterInspect,
          resumeAutoplayAfterInspect: false,
          dwellElapsedMs: 0,
        }
        : {
          ...state,
          inspecting: true,
          resumeAutoplayAfterInspect: state.autoplay,
          autoplay: false,
        }
    case 'toggle-fit':
      return { ...state, fitOverride: !state.fitOverride }
    case 'set-rate':
      return { ...state, rate: action.rate }
    case 'set-variant':
      if (state.variant === action.variant) return state
      return {
        ...state,
        variant: action.variant,
        autoplay: false,
        inspecting: false,
        resumeAutoplayAfterInspect: false,
        beatProgress: freshBeat(state.stepIndex),
        dwellElapsedMs: 0,
      }
    case 'tick': {
      if (state.inspecting) return state
      const step = steps[state.stepIndex]!
      const beatMs = stepBeatMs(step)
      const scaledDt = Math.max(0, action.dtMs) * state.rate

      if (action.reducedMotion) {
        if (!state.autoplay) {
          return state.beatProgress === 1 ? state : { ...state, beatProgress: 1 }
        }
        const dwell = state.dwellElapsedMs + scaledDt
        if (dwell < stepDwellMs(step)) {
          return { ...state, beatProgress: 1, dwellElapsedMs: dwell }
        }
        if (state.stepIndex >= maxIdx) {
          return { ...state, beatProgress: 1, autoplay: false, dwellElapsedMs: 0 }
        }
        return {
          ...state,
          stepIndex: state.stepIndex + 1,
          beatProgress: 1,
          dwellElapsedMs: 0,
        }
      }

      if (state.beatProgress < 1) {
        const nextBeat = beatMs <= 0 ? 1 : Math.min(1, state.beatProgress + scaledDt / beatMs)
        return { ...state, beatProgress: nextBeat }
      }

      if (!state.autoplay) return state

      const nextDwell = state.dwellElapsedMs + scaledDt
      if (nextDwell < stepDwellMs(step)) {
        return { ...state, dwellElapsedMs: nextDwell }
      }
      if (state.stepIndex >= maxIdx) {
        return { ...state, autoplay: false, dwellElapsedMs: 0 }
      }
      const nextIdx = state.stepIndex + 1
      return {
        ...state,
        stepIndex: nextIdx,
        beatProgress: freshBeat(nextIdx),
        dwellElapsedMs: 0,
      }
    }
  }
}
