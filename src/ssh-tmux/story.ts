import type {
  SchematicStageFrame,
  SchematicStageSpec,
  StageEntitySpec,
  StagePartInfo,
  StageStepDef,
  StageWireSpec,
} from '../stage/types.ts'

export type SshEntity = 'laptop' | 'laptop-screen' | 'server' | 'shell' | 'tmux' | 'process' | 'file'
export type SshWire = 'connection' | 'shell-tether' | 'tmux-attach' | 'file-write'

export const sshSteps: readonly StageStepDef[] = [
  { id: 'connect', label: 'Connect', beatDurationMs: 1100 },
  { id: 'without-tmux', label: 'Without tmux', beatDurationMs: 1500 },
  { id: 'start-tmux', label: 'Start tmux', beatDurationMs: 1350 },
  { id: 'detach', label: 'Detach & drop', beatDurationMs: 1500 },
  { id: 'reattach', label: 'Reattach', beatDurationMs: 1350 },
]

const partDetails: Record<string, StagePartInfo> = {
  laptop: {
    name: 'Your laptop',
    role: 'Local SSH client',
    detail: 'Sends keystrokes and renders terminal output. Heavy or long-running tasks execute on the remote machine, not here.',
  },
  connection: {
    name: 'SSH connection',
    role: 'Encrypted network session',
    detail: 'Carries input and output between laptop and server. Reconnecting opens a fresh SSH session.',
  },
  server: {
    name: 'Training server',
    role: 'Remote Linux machine',
    detail: 'Provides CPU time and filesystem storage even while your laptop is asleep or disconnected.',
  },
  shell: {
    name: 'SSH login shell',
    role: 'Connection-bound terminal',
    detail: 'Opened by SSH. When an SSH drop closes this pseudo-terminal, foreground jobs attached to it can receive SIGHUP and stop.',
  },
  tmux: {
    name: 'tmux session: sim',
    role: 'Server-side terminal multiplexer',
    detail: 'Keeps a pseudo-terminal alive on the server after you detach or lose Wi-Fi. (For heavy cluster compute, submit via Slurm.)',
  },
  process: {
    name: 'long_sim.sh',
    role: 'Remote workshop process',
    detail: 'Computes and writes ~/sim_result.txt on completion. Its survival depends on whether its controlling terminal stays alive.',
  },
  file: {
    name: '~/sim_result.txt',
    role: 'Output file on server',
    detail: 'Written to the server filesystem when long_sim.sh completes—even while no SSH client is attached.',
  },
}

export const sshEntities: readonly StageEntitySpec<SshEntity>[] = [
  {
    id: 'laptop',
    kind: 'plinth',
    kicker: 'CLIENT',
    title: 'Your laptop',
    compactTitle: 'Laptop',
    wide: { x: 20, y: 78, w: 214, h: 150 },
    compact: { x: 14, y: 10, w: 352, h: 112 },
    part: partDetails.laptop,
  },
  {
    id: 'laptop-screen',
    kind: 'card',
    parent: 'laptop',
    title: 'Local terminal',
    wide: { x: 12, y: 48, w: 190, h: 82 },
    compact: { x: 10, y: 42, w: 332, h: 56 },
    maxRows: 2,
  },
  {
    id: 'server',
    kind: 'plinth',
    kicker: 'REMOTE HOST',
    title: 'Training server',
    compactTitle: 'Training server',
    wide: { x: 368, y: 20, w: 472, h: 270 },
    compact: { x: 14, y: 162, w: 352, h: 254 },
    part: partDetails.server,
  },
  {
    id: 'shell',
    kind: 'card',
    parent: 'server',
    title: 'SSH shell',
    wide: { x: 16, y: 48, w: 174, h: 72 },
    compact: { x: 10, y: 42, w: 154, h: 66 },
    maxRows: 1,
    part: partDetails.shell,
  },
  {
    id: 'tmux',
    kind: 'card',
    parent: 'server',
    title: 'tmux: sim',
    wide: { x: 216, y: 48, w: 240, h: 72 },
    compact: { x: 174, y: 42, w: 168, h: 66 },
    maxRows: 1,
    part: partDetails.tmux,
  },
  {
    id: 'process',
    kind: 'card',
    parent: 'server',
    title: 'long_sim.sh',
    wide: { x: 216, y: 132, w: 240, h: 74 },
    compact: { x: 174, y: 120, w: 168, h: 72 },
    maxRows: 2,
    part: partDetails.process,
  },
  {
    id: 'file',
    kind: 'tile',
    parent: 'server',
    title: '~/sim_result.txt',
    compactTitle: 'sim_result.txt',
    wide: { x: 216, y: 218, w: 240, h: 36 },
    compact: { x: 174, y: 204, w: 168, h: 34 },
    part: partDetails.file,
  },
]

export const sshWires: readonly StageWireSpec<SshWire, SshEntity>[] = [
  {
    id: 'connection',
    kind: 'control',
    tone: 'blue',
    from: { id: 'laptop', port: 'e' },
    to: { id: 'shell', port: 'w' },
    part: partDetails.connection,
  },
  {
    id: 'shell-tether',
    kind: 'control',
    tone: 'slate',
    from: { id: 'shell', port: 's' },
    to: { id: 'process', port: 'n' },
    baseTrack: false,
  },
  {
    id: 'tmux-attach',
    kind: 'data',
    tone: 'green',
    from: { id: 'shell', port: 'e' },
    to: { id: 'tmux', port: 'w' },
    baseTrack: false,
  },
  {
    id: 'file-write',
    kind: 'data',
    tone: 'green',
    from: { id: 'process', port: 's' },
    to: { id: 'file', port: 'n' },
    baseTrack: false,
  },
]

export function evaluateSshStep(
  stepIndex: number,
  beatProgress: number,
  _variant = 'default',
  compact = false,
): SchematicStageFrame<SshEntity, SshWire> {
  const p = Math.max(0, Math.min(1, beatProgress))
  const connOverrides = compact
    ? { fromOverride: { id: 'laptop', port: 's' as const }, toOverride: { id: 'shell', port: 'n' as const }, compactViaOverride: [] as const }
    : {}

  switch (stepIndex) {
    case 0: {
      const open = p >= 0.55
      return {
        title: 'SSH opens an interactive shell on the server',
        body: 'Your laptop sends input and displays output over an encrypted SSH link, while commands execute on the remote training server.',
        panel: {
          label: 'Local terminal',
          command: '$ ssh asc01@training-server',
          lines: [
            { text: open ? '[asc01@server ~]$  # remote shell open' : 'Establishing encrypted session…', tone: open ? 'green' : 'muted' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Encrypted SSH link connects laptop to remote server' },
          { kind: 'add', text: 'Remote SSH shell pseudo-terminal opened' },
        ],
        hud: [
          { label: 'SSH link', value: open ? 'connected' : 'connecting…', tone: open ? 'good' : 'warn' },
          { label: 'Terminal', value: open ? 'SSH shell' : 'opening…', tone: 'neutral' },
          { label: 'long_sim.sh', value: 'not started', tone: 'neutral' },
        ],
        entities: {
          laptop: { tone: 'blue', led: 'on', subtitle: open ? 'Online' : 'Dialing' },
          'laptop-screen': {
            tone: 'blue',
            rows: [
              { kind: 'code', text: compact ? '$ ssh server' : '$ ssh asc01@server' },
              { kind: 'code', text: open ? 'Connected' : 'Handshake…', tone: open ? 'green' : 'muted' },
            ],
          },
          server: { tone: 'slate', led: 'on', subtitle: 'Up 24/7' },
          shell: {
            emphasis: open,
            tone: open ? 'blue' : 'slate',
            badge: open ? 'open' : 'init',
            rows: [{ kind: 'code', text: open ? 'Shell open' : 'Waiting for SSH…', tone: open ? 'blue' : 'muted' }],
          },
          tmux: { hidden: true },
          process: { hidden: true },
          file: { hidden: true },
        },
        wires: {
          connection: { visible: true, tone: 'blue', drawProgress: Math.min(1, p * 1.8), ...connOverrides },
          'shell-tether': { visible: false },
          'tmux-attach': { visible: false },
          'file-write': { visible: false },
        },
        packets: p < 0.65
          ? [{ id: 'pkt', wire: 'connection', badge: 'SSH', tone: 'blue', progress: p / 0.65 }]
          : [],
      }
    }

    case 1: {
      const dropped = p >= 0.48
      const stopped = p >= 0.72
      const runProg = stopped ? 0.4 : 0.4 * (p / 0.72)
      return {
        title: 'A dropped SSH link closes its foreground shell',
        body: 'Running long_sim.sh directly inside the SSH shell ties its lifetime to that terminal. When Wi-Fi drops, closing the shell stops the task before it can write output.',
        panel: {
          label: 'Without tmux',
          command: '$ /opt/asc_quest/long_sim.sh',
          lines: [
            { text: dropped ? 'packet_write_wait: Broken pipe' : 'Running in foreground (40%)…', tone: dropped ? 'coral' : 'amber' },
            { text: stopped ? 'SIGHUP -> long_sim.sh terminated (no file)' : 'Tied directly to SSH pty', tone: stopped ? 'coral' : 'muted' },
          ],
        },
        changes: [
          { kind: 'remove', text: 'Wi-Fi drop breaks the SSH connection' },
          { kind: 'remove', text: 'SSH shell closes and stops foreground long_sim.sh at 40%' },
        ],
        hud: [
          { label: 'SSH link', value: dropped ? 'dropped' : 'connected', tone: dropped ? 'bad' : 'good' },
          { label: 'Terminal', value: stopped ? 'closed (SIGHUP)' : 'SSH shell', tone: stopped ? 'bad' : 'warn' },
          { label: 'long_sim.sh', value: stopped ? 'stopped (40%)' : 'running…', tone: stopped ? 'bad' : 'warn' },
        ],
        entities: {
          laptop: { dimmed: dropped, tone: dropped ? 'coral' : 'blue', led: dropped ? 'warn' : 'on', subtitle: dropped ? 'Offline' : 'Connected' },
          'laptop-screen': {
            tone: dropped ? 'coral' : 'blue',
            rows: [
              { kind: 'code', text: compact ? 'long_sim.sh' : '$ ./long_sim.sh' },
              { kind: 'code', text: dropped ? 'Broken pipe' : 'Attached to SSH', tone: dropped ? 'coral' : 'muted' },
            ],
          },
          server: { tone: 'slate', led: 'on', subtitle: 'Still powered' },
          shell: {
            dimmed: stopped,
            tone: stopped ? 'coral' : 'blue',
            badge: stopped ? 'closed' : 'open',
            rows: [{ kind: 'code', text: stopped ? 'Terminal closed' : 'Shell open', tone: stopped ? 'coral' : 'blue' }],
          },
          tmux: { hidden: true },
          process: {
            emphasis: true,
            tone: stopped ? 'coral' : 'amber',
            badge: stopped ? 'stopped' : '40%',
            overridePos: {
              wide: { x: 16, y: 136 },
              compact: { x: 10, y: 120 },
            },
            rows: [
              { kind: 'meter', value: runProg, tone: stopped ? 'coral' : 'amber' },
              { kind: 'code', text: stopped ? 'Stopped · 40%' : `Running · ${Math.round(runProg * 100)}%`, tone: stopped ? 'coral' : 'amber' },
            ],
          },
          file: { hidden: true },
        },
        wires: {
          connection: { visible: true, tone: dropped ? 'coral' : 'blue', dashed: dropped, faultMark: dropped, ...connOverrides },
          'shell-tether': { visible: true, tone: stopped ? 'coral' : 'amber', dashed: true },
          'tmux-attach': { visible: false },
          'file-write': { visible: false },
        },
        packets: [],
      }
    }

    case 2: {
      const started = p >= 0.45
      const runProg = started ? 0.35 * ((p - 0.45) / 0.55) : 0
      return {
        title: 'Start a persistent tmux session on the server',
        body: 'Reconnecting and running tmux new -s sim creates a server-side terminal session. Launching long_sim.sh inside tmux decouples the process from your SSH link.',
        panel: {
          label: 'Inside server',
          command: '$ tmux new -s sim',
          lines: [
            { text: '[sim] $ /opt/asc_quest/long_sim.sh', tone: 'green' },
            { text: 'Controlling terminal owned by tmux server', tone: 'muted' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Created server-side session tmux: sim' },
          { kind: 'change', text: 'long_sim.sh runs inside tmux rather than raw SSH shell' },
        ],
        hud: [
          { label: 'SSH link', value: 'connected', tone: 'good' },
          { label: 'Terminal', value: 'tmux: sim (attached)', tone: 'good' },
          { label: 'long_sim.sh', value: started ? 'running (35%)' : 'launching…', tone: 'good' },
        ],
        entities: {
          laptop: { tone: 'blue', led: 'on', subtitle: 'Connected' },
          'laptop-screen': {
            tone: 'green',
            rows: [
              { kind: 'code', text: '$ tmux new -s sim' },
              { kind: 'code', text: 'Viewing [sim]', tone: 'green' },
            ],
          },
          server: { tone: 'green', led: 'on', subtitle: 'Up 24/7' },
          shell: {
            tone: 'blue',
            badge: 'open',
            rows: [{ kind: 'code', text: 'Attached -> sim', tone: 'blue' }],
          },
          tmux: {
            emphasis: true,
            tone: 'green',
            badge: 'attached',
            rows: [{ kind: 'code', text: 'Session alive on server', tone: 'green' }],
          },
          process: {
            hidden: !started,
            emphasis: started,
            tone: 'green',
            badge: `${Math.round(runProg * 100)}%`,
            rows: [
              { kind: 'meter', value: runProg, tone: 'green' },
              { kind: 'code', text: `Running · ${Math.round(runProg * 100)}%`, tone: 'green' },
            ],
          },
          file: { hidden: true },
        },
        wires: {
          connection: { visible: true, tone: 'blue', ...connOverrides },
          'shell-tether': { visible: false },
          'tmux-attach': { visible: true, tone: 'green', drawProgress: Math.min(1, p * 2.2) },
          'file-write': { visible: false },
        },
        packets: p < 0.45
          ? [{ id: 'pkt', wire: 'tmux-attach', badge: 'new -s', tone: 'green', progress: p / 0.45 }]
          : [],
      }
    }

    case 3: {
      const dropped = p >= 0.42
      const runProg = 0.35 + 0.5 * p
      return {
        title: 'Detach and survive a network drop',
        body: 'Ctrl+B then d detaches your client cleanly. Even when Wi-Fi drops and closes the SSH shell, tmux: sim and long_sim.sh keep running uninterrupted on the server.',
        panel: {
          label: 'Detach key sequence',
          command: 'Ctrl+B, then d   # [detached (from session sim)]',
          lines: [
            { text: dropped ? 'Laptop offline · server CPU keeps executing 85%' : 'Detached cleanly before disconnect', tone: 'green' },
          ],
        },
        changes: [
          { kind: 'change', text: 'tmux: sim switches to detached mode on the server' },
          { kind: 'remove', text: 'SSH link drops again, closing only the outer SSH shell' },
          { kind: 'add', text: 'long_sim.sh continues advancing from 35% to 85%' },
        ],
        hud: [
          { label: 'SSH link', value: dropped ? 'dropped' : 'connected', tone: dropped ? 'warn' : 'good' },
          { label: 'Terminal', value: 'tmux: sim (detached)', tone: 'good' },
          { label: 'long_sim.sh', value: `running (${Math.round(runProg * 100)}%)`, tone: 'good' },
        ],
        entities: {
          laptop: { dimmed: dropped, tone: dropped ? 'coral' : 'slate', led: dropped ? 'warn' : 'on', subtitle: dropped ? 'Offline' : 'Detached' },
          'laptop-screen': {
            tone: dropped ? 'coral' : 'slate',
            rows: [
              { kind: 'code', text: '[detached from sim]' },
              { kind: 'code', text: dropped ? 'Wi-Fi offline' : 'Safe to close laptop', tone: dropped ? 'coral' : 'muted' },
            ],
          },
          server: { emphasis: true, tone: 'green', led: 'on', subtitle: 'Computing' },
          shell: {
            dimmed: dropped,
            tone: dropped ? 'coral' : 'slate',
            badge: dropped ? 'closed' : 'open',
            rows: [{ kind: 'code', text: dropped ? 'Terminal closed' : 'Shell idle', tone: dropped ? 'coral' : 'muted' }],
          },
          tmux: {
            emphasis: true,
            tone: 'green',
            badge: 'detached',
            rows: [{ kind: 'code', text: 'Kept alive by server', tone: 'green' }],
          },
          process: {
            emphasis: true,
            tone: 'green',
            badge: `${Math.round(runProg * 100)}%`,
            rows: [
              { kind: 'meter', value: runProg, tone: 'green' },
              { kind: 'code', text: `Running · ${Math.round(runProg * 100)}%`, tone: 'green' },
            ],
          },
          file: { hidden: true },
        },
        wires: {
          connection: { visible: true, tone: dropped ? 'coral' : 'blue', dashed: dropped, faultMark: dropped, ...connOverrides },
          'shell-tether': { visible: false },
          'tmux-attach': { visible: !dropped, dashed: true, active: false, tone: 'green' },
          'file-write': { visible: false },
        },
        packets: [],
      }
    }

    default: {
      const attached = p >= 0.45
      const done = p >= 0.72
      const runProg = done ? 1 : 0.85 + 0.15 * (p / 0.72)
      return {
        title: 'Reconnect, reattach, and read the result',
        body: 'Opening a new SSH session and running tmux attach -t sim reconnects you to the same server-side terminal, where long_sim.sh has written ~/sim_result.txt.',
        panel: {
          label: 'Reconnect & inspect',
          command: '$ tmux attach -t sim && cat ~/sim_result.txt',
          lines: [
            { text: 'Simulation finished -> ~/sim_result.txt saved', tone: 'green' },
          ],
        },
        changes: [
          { kind: 'add', text: 'New SSH connection reattaches to existing tmux: sim' },
          { kind: 'add', text: 'long_sim.sh reaches 100% and writes ~/sim_result.txt' },
        ],
        hud: [
          { label: 'SSH link', value: 'reconnected', tone: 'good' },
          { label: 'Terminal', value: attached ? 'tmux: sim (attached)' : 'reattaching…', tone: 'good' },
          { label: 'Result file', value: done ? '~/sim_result.txt' : 'writing…', tone: 'good' },
        ],
        entities: {
          laptop: { tone: 'blue', led: 'on', subtitle: 'Reconnected' },
          'laptop-screen': {
            tone: 'green',
            rows: [
              { kind: 'code', text: '$ tmux attach -t sim' },
              { kind: 'code', text: done ? 'cat ~/sim_result.txt' : 'Reattaching…', tone: 'green' },
            ],
          },
          server: { tone: 'green', led: 'on', subtitle: 'Completed' },
          shell: {
            tone: 'blue',
            badge: 'open',
            rows: [{ kind: 'code', text: 'New SSH shell', tone: 'blue' }],
          },
          tmux: {
            emphasis: attached,
            tone: 'green',
            badge: attached ? 'attached' : 'detached',
            rows: [{ kind: 'code', text: attached ? 'Reattached to sim' : 'Waiting on server', tone: 'green' }],
          },
          process: {
            tone: 'green',
            badge: done ? 'done' : `${Math.round(runProg * 100)}%`,
            rows: [
              { kind: 'meter', value: runProg, tone: 'green' },
              { kind: 'code', text: done ? 'Done · 100%' : `Finishing · ${Math.round(runProg * 100)}%`, tone: 'green' },
            ],
          },
          file: {
            hidden: !done,
            emphasis: done,
            tone: 'green',
          },
        },
        wires: {
          connection: { visible: true, tone: 'blue', drawProgress: Math.min(1, p * 2.2), ...connOverrides },
          'shell-tether': { visible: false },
          'tmux-attach': { visible: p > 0.25, tone: 'green', drawProgress: Math.min(1, (p - 0.25) * 2.4) },
          'file-write': { visible: done, tone: 'green' },
        },
        packets: p < 0.42
          ? [{ id: 'pkt', wire: 'connection', badge: 'SSH', tone: 'blue', progress: p / 0.42 }]
          : p < 0.72
            ? [{ id: 'pkt', wire: 'tmux-attach', badge: 'attach', tone: 'green', progress: (p - 0.42) / 0.3 }]
            : [],
      }
    }
  }
}

export const sshStageSpec: SchematicStageSpec<SshEntity, SshWire> = {
  id: 'ssh',
  svgTitle: 'Laptop, SSH connection, and training server with tmux',
  svgDesc: 'Compare running a long task directly in an SSH shell versus inside a server-side tmux session when Wi-Fi drops.',
  wideSize: { w: 860, h: 310 },
  compactSize: { w: 380, h: 430 },
  entities: sshEntities,
  wires: sshWires,
  maxPackets: ['pkt'],
  evaluate: evaluateSshStep,
  describeEntity(id, stepIndex) {
    const base = partDetails[id]
    if (!base) return { name: id, role: 'Component', detail: '' }
    if (id === 'tmux' && stepIndex === 3) return { ...base, role: 'Detached on training server' }
    if (id === 'process') {
      if (stepIndex === 1) return { ...base, role: 'Stopped after SSH terminal hangup' }
      if (stepIndex === 4) return { ...base, role: 'Completed on training server' }
    }
    return base
  },
  describeWire(id, stepIndex) {
    const base = partDetails[id]!
    if (id === 'connection' && (stepIndex === 1 || stepIndex === 3)) {
      return { ...base, role: 'Disconnected (network drop)' }
    }
    return base
  },
}

