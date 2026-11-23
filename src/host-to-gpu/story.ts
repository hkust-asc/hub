type Buffer = 'host' | 'device'

interface Note {
  title: string
  text: string
}

interface Beat {
  label: string
  durationMs: number
  anchor: Buffer
  focus: readonly Buffer[]
  note: Note
  copy?: { direction: 'h2d' | 'd2h'; after: Note }
}

const authoredBeats: readonly Beat[] = [
  {
    label: 'Allocate', durationMs: 7000, anchor: 'device', focus: ['device'],
    note: { title: 'The job gets GPU 0', text: 'Slurm grants the job access to this GPU.' },
  },
  {
    label: 'Prepare', durationMs: 6000, anchor: 'host', focus: ['host'],
    note: { title: 'Input starts in host RAM', text: 'The CPU prepares the input in system memory.' },
  },
  {
    label: 'Copy in', durationMs: 8500, anchor: 'device', focus: ['host', 'device'],
    note: { title: 'Copy input to GPU 0', text: 'An explicit copy sends input over PCIe into GPU memory.' },
    copy: { direction: 'h2d', after: { title: 'GPU 0 has a copy', text: 'The original input is still in host RAM.' } },
  },
  {
    label: 'Compute', durationMs: 6500, anchor: 'device', focus: ['device'],
    note: { title: 'GPU 0 computes the result', text: 'A CUDA kernel reads the input and writes the result in GPU memory.' },
  },
  {
    label: 'Copy out', durationMs: 8500, anchor: 'host', focus: ['host', 'device'],
    note: { title: 'Copy the result to host RAM', text: 'The result comes back over PCIe, in the opposite direction.' },
    copy: { direction: 'd2h', after: { title: 'Host RAM has the result', text: 'GPU memory still holds its copy.' } },
  },
  {
    label: 'Finish', durationMs: 6500, anchor: 'device', focus: [],
    note: { title: 'The job releases GPU 0', text: 'When the program exits, its buffers are freed.' },
  },
]

let startMs = 0
export const beats = authoredBeats.map(beat => {
  const entry = { ...beat, startMs }
  startMs += beat.durationMs
  return entry
})
export const durationMs = startMs

const boundTime = (timeMs: number) => Math.min(durationMs, Math.max(0, timeMs))
const copyStartMs = 350
const copyEndMs = 2350

export function frameAt(timeMs: number) {
  const elapsedMs = boundTime(timeMs)
  const index = beats.findLastIndex(beat => elapsedMs >= beat.startMs)
  const beat = beats[index]!
  const withinBeat = elapsedMs - beat.startMs
  return {
    elapsedMs,
    index,
    beat,
    note: beat.copy && withinBeat >= copyEndMs ? beat.copy.after : beat.note,
    packetProgress: beat.copy && withinBeat >= copyStartMs && withinBeat < copyEndMs
      ? (withinBeat - copyStartMs) / (copyEndMs - copyStartMs) : null,
  }
}

export interface PlaybackState {
  positionMs: number
  startedAt: number | null
  inspection: 'was-playing' | 'was-paused' | null
}

export type PlaybackAction = { type: 'play' | 'pause' | 'replay' | 'inspect' } | { type: 'seek'; positionMs: number }

export function positionAt(state: PlaybackState, now: number): number {
  return boundTime(state.positionMs + (state.startedAt === null ? 0 : now - state.startedAt))
}

export function updatePlayback(state: PlaybackState, action: PlaybackAction, now: number): PlaybackState {
  const positionMs = positionAt(state, now)
  const wasPlaying = state.startedAt !== null && positionMs < durationMs
  switch (action.type) {
    case 'play':
      return { positionMs: positionMs === durationMs ? 0 : positionMs, startedAt: now, inspection: null }
    case 'pause':
      return { ...state, positionMs, startedAt: null }
    case 'replay':
      return { positionMs: 0, startedAt: now, inspection: null }
    case 'seek': {
      const target = boundTime(action.positionMs)
      return { ...state, positionMs: target, startedAt: wasPlaying && target < durationMs ? now : null }
    }
    case 'inspect':
      return state.inspection
        ? { positionMs, startedAt: state.inspection === 'was-playing' && positionMs < durationMs ? now : null, inspection: null }
        : { positionMs, startedAt: null, inspection: wasPlaying ? 'was-playing' : 'was-paused' }
  }
}
