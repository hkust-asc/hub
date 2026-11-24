import { createTimeline, phase } from '../timed-lesson/timeline.ts'

export const timeline = createTimeline([
  { id: 'channels', label: 'Two channels', durationMs: 5500 },
  { id: 'redirect', label: 'Redirect >', durationMs: 6000 },
  { id: 'predict', label: 'Predict 2>', durationMs: 7500 },
  { id: 'result', label: 'Clean result', durationMs: 5500 },
] as const)

export type Channel = 'stdout' | 'stderr'
export type Destination = 'terminal' | 'passcode' | 'errors'
export type StreamPart = 'process' | Channel | Destination

const output = [
  { channel: 'stderr', badge: 'ERROR', lines: ['[ERROR]', 'Sensor offline'] },
  { channel: 'stdout', badge: 'PASSCODE', lines: ['PASSCODE:', 'DEMO'] },
  { channel: 'stderr', badge: 'WARN', lines: ['[WARN]', 'Fan RPM unstable'] },
] as const

export type Message = (typeof output)[number]

const startTimes = {
  channels: [600, 1100, 1500],
  redirect: [1000, 1450, 1950],
  predict: [4000, 4400, 4750],
  result: null,
} as const

export function frameAt(elapsedMs: number) {
  const { beat, withinBeat: t } = timeline.beatAt(elapsedMs)
  const predicting = beat.id === 'predict' && t < 3200
  const route: Record<Channel, Destination | null> = {
    stdout: beat.id === 'channels' ? 'terminal' : 'passcode',
    stderr: predicting ? null : beat.id === 'predict' || beat.id === 'result' ? 'errors' : 'terminal',
  }
  const starts = startTimes[beat.id]
  const contents: Record<Destination, Message[]> = { terminal: [], passcode: [], errors: [] }
  const inFlight = output.flatMap((message, index) => {
    const destination = route[message.channel]
    if (!destination) return []
    const start = starts?.[index] ?? 0
    const end = start + (beat.id === 'predict' ? 1250 : 1500)
    if (!starts || t >= end) contents[destination].push(message)
    return starts && t >= start && t < end ? [{ message, destination, progress: phase(t, start, end) }] : []
  })

  return {
    route, contents, inFlight, predicting, reviewing: beat.id === 'result',
    quiet: route.stderr === 'errors' && contents.errors.length === 2,
    showPasscode: route.stdout === 'passcode',
    showErrors: predicting || route.stderr === 'errors',
    note: noteAt(beat.id, t),
  }
}

function noteAt(beat: (typeof timeline.beats)[number]['id'], t: number): {
  anchor: StreamPart
  title: string
  text: string
  command?: string
} {
  switch (beat) {
    case 'channels':
      return t < 3000
        ? { anchor: 'process', title: 'One command, two output streams', text: 'The passcode leaves on port 1 (stdout). Diagnostics leave on port 2 (stderr).', command: '/opt/asc_quest/noisy_sensor.sh' }
        : { anchor: 'terminal', title: 'Both land on your screen', text: 'In this shell, both streams go to the terminal, so the lines look mixed.' }
    case 'redirect':
      return t < 2500
        ? { anchor: 'stdout', title: '> changes where port 1 goes', text: 'The shell sends stdout to the file instead of the terminal.', command: '> passcode.txt' }
        : { anchor: 'stderr', title: 'Diagnostics still reach the screen', text: 'Port 2 still points at the terminal. The file receives only the passcode.' }
    case 'predict':
      return t < 3200
        ? { anchor: 'stderr', title: 'Predict what the screen will show', text: 'The next run adds 2>. Will either stream still go to the terminal?', command: '> passcode.txt 2> error.log' }
        : t < 6000
          ? { anchor: 'stderr', title: '2> sends port 2 to its own file', text: 'The passcode still goes to passcode.txt. Now the diagnostics go to error.log.' }
          : { anchor: 'terminal', title: 'Quiet screen, two files', text: 'This run sent both streams to files, so nothing appeared on the screen.' }
    case 'result':
      return { anchor: 'passcode', title: 'Read the files separately', text: 'One file contains the passcode; the other keeps the diagnostics.', command: 'cat passcode.txt && cat error.log' }
  }
}
