export type PlaybackRate = 0.5 | 1 | 2

// At 1x, each real second advances half a second of authored time.
export const normalPlaybackPace = 0.5

export interface PlaybackState {
  positionMs: number
  startedAt: number | null
  inspection: 'was-playing' | 'was-paused' | null
  rate: PlaybackRate
}

export type PlaybackAction =
  | { type: 'play' | 'pause' | 'replay' | 'inspect' }
  | { type: 'seek'; positionMs: number }
  | { type: 'rate'; rate: PlaybackRate }

interface Beat {
  label: string
  durationMs: number
}

export function phase(time: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (time - start) / (end - start)))
}

export function createTimeline<T extends Beat>(content: readonly T[]) {
  let durationMs = 0
  const beats = content.map(beat => {
    const startMs = durationMs
    durationMs += beat.durationMs
    return { ...beat, startMs }
  })
  const bound = (time: number) => Math.min(durationMs, Math.max(0, time))
  function positionAt(state: PlaybackState, now: number): number {
    return bound(state.positionMs + (state.startedAt === null ? 0 : (now - state.startedAt) * normalPlaybackPace * state.rate))
  }
  return {
    beats, durationMs, positionAt,
    beatAt(time: number) {
      const elapsedMs = bound(time)
      const index = beats.findLastIndex(beat => elapsedMs >= beat.startMs)
      const beat = beats[index]!
      return { beat, index, elapsedMs, withinBeat: elapsedMs - beat.startMs }
    },
    update(state: PlaybackState, action: PlaybackAction, now: number): PlaybackState {
      const positionMs = positionAt(state, now)
      const running = state.startedAt !== null && positionMs < durationMs
      switch (action.type) {
        case 'play':
          return { ...state, positionMs: positionMs === durationMs ? 0 : positionMs, startedAt: now, inspection: null }
        case 'pause':
          return { ...state, positionMs, startedAt: null }
        case 'replay':
          return { ...state, positionMs: 0, startedAt: now, inspection: null }
        case 'seek': {
          const target = bound(action.positionMs)
          return { ...state, positionMs: target, startedAt: running && target < durationMs ? now : null }
        }
        case 'rate':
          return { ...state, positionMs, startedAt: running ? now : null, rate: action.rate }
        case 'inspect':
          return state.inspection
            ? { ...state, positionMs, startedAt: state.inspection === 'was-playing' && positionMs < durationMs ? now : null, inspection: null }
            : { ...state, positionMs, startedAt: null, inspection: running ? 'was-playing' : 'was-paused' }
      }
    },
  }
}

export type Timeline = ReturnType<typeof createTimeline>
