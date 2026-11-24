import { createTimeline, phase } from '../timed-lesson/timeline.ts'

export const timeline = createTimeline([
  { id: 'connect', label: 'Connect', durationMs: 4500 },
  { id: 'shell', label: 'Without tmux', durationMs: 6500 },
  { id: 'start', label: 'Start tmux', durationMs: 5500 },
  { id: 'detach', label: 'Detach', durationMs: 6500 },
  { id: 'return', label: 'Reattach', durationMs: 6000 },
] as const)

export type SshPart = 'laptop' | 'connection' | 'server' | 'shell' | 'tmux' | 'process' | 'file'

interface SshFrame {
  note: { anchor: SshPart; title: string; text: string; command?: string }
  connection: { status: 'connecting' | 'connected' | 'lost'; progress: number }
  shell: 'waiting' | 'open' | 'closed'
  tmux: 'absent' | 'attached' | 'detached'
  process: { terminal: 'shell' | 'tmux'; status: 'running' | 'stopped' | 'done'; progress: number } | null
  file: boolean
}

const connected = { status: 'connected', progress: 1 } as const
const lost = { status: 'lost', progress: 0 } as const
const opening = (t: number, connectedAt: number): SshFrame['connection'] =>
  t >= connectedAt ? connected : { status: 'connecting', progress: phase(t, 0, connectedAt) }

export function frameAt(elapsedMs: number): SshFrame {
  const { beat, withinBeat: t } = timeline.beatAt(elapsedMs)
  const empty = { tmux: 'absent', process: null, file: false } as const
  switch (beat.id) {
    case 'connect':
      return {
        ...empty, connection: opening(t, 1200), shell: t < 1200 ? 'waiting' : 'open',
        note: { anchor: 'connection', title: 'SSH opens a shell on the server', text: 'Your laptop sends input and displays output. The commands run remotely.' },
      }
    case 'shell': {
      const dropped = t >= 2600
      const closed = t >= 3400
      return {
        ...empty, connection: dropped ? lost : connected, shell: closed ? 'closed' : 'open',
        process: { terminal: 'shell', status: closed ? 'stopped' : 'running', progress: .4 * phase(t, 0, 3400) },
        note: closed
          ? { anchor: 'process', title: 'The foreground task stops', text: 'Once the remote terminal closes, a hangup can stop a task running directly in that shell.' }
          : dropped
            ? { anchor: 'connection', title: 'The SSH connection drops', text: 'The laptop loses its connection. The server is still on.' }
            : { anchor: 'process', title: 'Run directly in the remote shell', text: 'This task uses the terminal opened by SSH.', command: '/opt/asc_quest/long_sim.sh' },
      }
    }
    case 'start':
      return {
        ...empty, connection: opening(t, 800), shell: t < 800 ? 'waiting' : 'open',
        tmux: t < 800 ? 'absent' : 'attached',
        process: t < 2000 ? null : { terminal: 'tmux', status: 'running', progress: .35 * phase(t, 2000, 5500) },
        note: t < 800
          ? { anchor: 'connection', title: 'Reconnect to the same server', text: 'This time, give the task a terminal that can outlive SSH.' }
          : t < 2000
            ? { anchor: 'tmux', title: 'Start a tmux session', text: 'tmux manages a separate terminal on the server.', command: 'tmux new -s sim' }
            : { anchor: 'process', title: 'Run the task inside tmux', text: 'The task now uses the terminal managed by tmux.', command: '/opt/asc_quest/long_sim.sh' },
      }
    case 'detach':
      return {
        connection: t < 1200 ? connected : lost, shell: t < 1900 ? 'open' : 'closed',
        tmux: t < 600 ? 'attached' : 'detached', file: false,
        process: { terminal: 'tmux', status: 'running', progress: .35 + .5 * phase(t, 0, 6500) },
        note: t < 1200
          ? { anchor: 'tmux', title: 'Detach from tmux', text: 'Detaching returns you to the SSH shell. The connection is still open.', command: 'Ctrl+B, then d' }
          : { anchor: 'tmux', title: 'Laptop offline, task still running', text: 'The same drop breaks SSH. The tmux session and its task stay on the server.' },
      }
    case 'return': {
      const done = t >= 2200
      return {
        connection: opening(t, 850), shell: t < 850 ? 'waiting' : 'open',
        tmux: t < 1350 ? 'detached' : 'attached', file: done,
        process: { terminal: 'tmux', status: done ? 'done' : 'running', progress: .85 + .15 * phase(t, 0, 2200) },
        note: done
          ? { anchor: 'file', title: 'The result is on the server', text: 'The task writes this file when it finishes. Read it from the remote terminal.', command: 'cat ~/sim_result.txt' }
          : t < 850
            ? { anchor: 'connection', title: 'Open a new SSH connection', text: 'The old connection is gone. The task is still running.' }
            : { anchor: 'tmux', title: 'Reattach to the same session', text: 'You can see the running task again without restarting it.', command: 'tmux attach -t sim' },
      }
    }
  }
}
