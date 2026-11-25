import type {
  SchematicStageFrame,
  SchematicStageSpec,
  StageEntitySpec,
  StagePartInfo,
  StageStepDef,
  StageWireSpec,
} from '../stage/types.ts'

export type StreamEntity = 'process' | 'stdout' | 'stderr' | 'passcode' | 'terminal' | 'errors'
export type StreamWire =
  | 'proc-out'
  | 'proc-err'
  | 'out-term'
  | 'out-file'
  | 'err-term'
  | 'err-file'

export const streamSteps: readonly StageStepDef[] = [
  { id: 'channels', label: 'Two channels', beatDurationMs: 1450 },
  { id: 'redirect', label: 'Redirect >', beatDurationMs: 1450 },
  { id: 'predict', label: 'Predict 2>', beatDurationMs: 700, dwellMs: 3800 },
  { id: 'route-both', label: 'Route both', beatDurationMs: 1450 },
  { id: 'result', label: 'Clean result', beatDurationMs: 900 },
]

const partDetails: Record<StreamEntity, StagePartInfo> = {
  process: {
    name: 'noisy_sensor.sh',
    role: 'Workshop command',
    detail: 'Every Linux process starts with standard file descriptors: 0 (stdin), 1 (stdout), and 2 (stderr). This script writes to both output ports.',
  },
  stdout: {
    name: 'Port 1: stdout',
    role: 'Standard output',
    detail: 'Carries normal program data (the passcode). > is shorthand for 1> and redirects only port 1.',
  },
  stderr: {
    name: 'Port 2: stderr',
    role: 'Standard error',
    detail: 'Carries warnings and diagnostics independently so errors do not corrupt redirected stdout files or pipes.',
  },
  passcode: {
    name: 'passcode.txt',
    role: 'Redirected stdout file',
    detail: 'Receives port 1 when > passcode.txt is set. Diagnostics from port 2 never enter this file.',
  },
  terminal: {
    name: 'Terminal screen',
    role: 'Default destination',
    detail: 'Both stdout and stderr point here unless the shell redirects one or both file descriptors.',
  },
  errors: {
    name: 'error.log',
    role: 'Redirected stderr file',
    detail: 'Receives port 2 when 2> error.log is set, preserving warnings without cluttering your screen or data file.',
  },
}

export const streamEntities: readonly StageEntitySpec<StreamEntity>[] = [
  {
    id: 'process',
    kind: 'card',
    kicker: 'WORKSHOP COMMAND',
    compactKicker: 'COMMAND',
    title: 'noisy_sensor.sh',
    wide: { x: 18, y: 106, w: 206, h: 112 },
    compact: { x: 14, y: 10, w: 352, h: 74 },
    maxRows: 2,
    part: partDetails.process,
  },
  {
    id: 'stdout',
    kind: 'port',
    portNumber: 1,
    title: 'stdout',
    wide: { x: 278, y: 116, w: 132, h: 36 },
    compact: { x: 22, y: 102, w: 156, h: 34 },
    part: partDetails.stdout,
  },
  {
    id: 'stderr',
    kind: 'port',
    portNumber: 2,
    title: 'stderr',
    wide: { x: 278, y: 172, w: 132, h: 36 },
    compact: { x: 202, y: 102, w: 156, h: 34 },
    part: partDetails.stderr,
  },
  {
    id: 'passcode',
    kind: 'card',
    title: 'passcode.txt',
    wide: { x: 546, y: 12, w: 316, h: 90 },
    compact: { x: 14, y: 284, w: 168, h: 112 },
    maxRows: 2,
    part: partDetails.passcode,
  },
  {
    id: 'terminal',
    kind: 'card',
    title: 'Terminal screen',
    compactTitle: 'Terminal screen',
    wide: { x: 546, y: 114, w: 316, h: 98 },
    compact: { x: 14, y: 156, w: 352, h: 108 },
    maxRows: 3,
    part: partDetails.terminal,
  },
  {
    id: 'errors',
    kind: 'card',
    title: 'error.log',
    wide: { x: 546, y: 224, w: 316, h: 90 },
    compact: { x: 198, y: 284, w: 168, h: 112 },
    maxRows: 2,
    part: partDetails.errors,
  },
]

export const streamWires: readonly StageWireSpec<StreamWire, StreamEntity>[] = [
  {
    id: 'proc-out',
    kind: 'data',
    tone: 'green',
    from: { id: 'process', port: 'e', offset: -28 },
    to: { id: 'stdout', port: 'w' },
    arrow: false,
  },
  {
    id: 'proc-err',
    kind: 'fault',
    tone: 'coral',
    from: { id: 'process', port: 'e', offset: 28 },
    to: { id: 'stderr', port: 'w' },
    arrow: false,
  },
  {
    id: 'out-term',
    kind: 'data',
    tone: 'green',
    from: { id: 'stdout', port: 'e' },
    to: { id: 'terminal', port: 'w', offset: -18 },
  },
  {
    id: 'out-file',
    kind: 'data',
    tone: 'green',
    from: { id: 'stdout', port: 'e' },
    to: { id: 'passcode', port: 'w' },
    wideVia: [[470, 134], [470, 57]],
  },
  {
    id: 'err-term',
    kind: 'fault',
    tone: 'coral',
    from: { id: 'stderr', port: 'e' },
    to: { id: 'terminal', port: 'w', offset: 18 },
  },
  {
    id: 'err-file',
    kind: 'fault',
    tone: 'coral',
    from: { id: 'stderr', port: 'e' },
    to: { id: 'errors', port: 'w' },
    wideVia: [[470, 190], [470, 269]],
  },
]

export function evaluateStreamStep(
  stepIndex: number,
  beatProgress: number,
  _variant = 'default',
  compact = false,
): SchematicStageFrame<StreamEntity, StreamWire> {
  const p = Math.max(0, Math.min(1, beatProgress))
  const compactWires = compact
    ? {
      'proc-out': { fromOverride: { id: 'process', port: 's' as const, offset: -90 }, toOverride: { id: 'stdout', port: 'n' as const } },
      'proc-err': { fromOverride: { id: 'process', port: 's' as const, offset: 90 }, toOverride: { id: 'stderr', port: 'n' as const } },
      'out-term': { fromOverride: { id: 'stdout', port: 's' as const }, toOverride: { id: 'terminal', port: 'n' as const, offset: -90 } },
      'out-file': {
        fromOverride: { id: 'stdout', port: 's' as const },
        toOverride: { id: 'passcode', port: 'w' as const },
        compactViaOverride: [[100, 146], [5, 146], [5, 340]] as const,
      },
      'err-term': { fromOverride: { id: 'stderr', port: 's' as const }, toOverride: { id: 'terminal', port: 'n' as const, offset: 90 } },
      'err-file': {
        fromOverride: { id: 'stderr', port: 's' as const },
        toOverride: { id: 'errors', port: 'e' as const },
        compactViaOverride: [[280, 146], [375, 146], [375, 340]] as const,
      },
    }
    : undefined

  switch (stepIndex) {
    case 0: {
      const arrivedErr1 = p >= 0.45
      const arrivedOut = p >= 0.68
      const arrivedErr2 = p >= 0.88
      return {
        title: 'One command writes to two output ports',
        body: 'noisy_sensor.sh writes its passcode to port 1 (stdout) and diagnostics to port 2 (stderr). Because both default to the terminal, the lines appear mixed together.',
        panel: {
          label: 'Unredirected run',
          command: '$ /opt/asc_quest/noisy_sensor.sh',
          lines: [
            { text: '[ERROR] Sensor offline      (fd 2)', tone: 'coral' },
            { text: 'PASSCODE: DEMO              (fd 1)', tone: 'green' },
            { text: '[WARN] Fan RPM unstable     (fd 2)', tone: 'coral' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Port 1 (stdout) and Port 2 (stderr) both point to Terminal screen' },
          { kind: 'change', text: 'Passcode and diagnostics interleave on screen' },
        ],
        hud: [
          { label: 'Port 1 (stdout)', value: 'Terminal', tone: 'neutral' },
          { label: 'Port 2 (stderr)', value: 'Terminal', tone: 'warn' },
          { label: 'Screen output', value: arrivedErr2 ? '3 mixed lines' : 'streaming…', tone: 'warn' },
        ],
        entities: {
          process: {
            emphasis: p < 0.4,
            tone: 'slate',
            rows: compact
              ? [{ kind: 'code', text: 'fd 1: stdout  ·  fd 2: stderr', tone: 'muted' }]
              : [
                { kind: 'code', text: 'fd 1 -> stdout', tone: 'green' },
                { kind: 'code', text: 'fd 2 -> stderr', tone: 'coral' },
              ],
          },
          stdout: { tone: 'green', operator: '·' },
          stderr: { tone: 'coral', operator: '·' },
          passcode: { hidden: true },
          terminal: {
            emphasis: arrivedErr2,
            tone: 'amber',
            badge: 'mixed',
            rows: [
              ...(arrivedErr1 ? [{ kind: 'code' as const, text: '[ERROR] Sensor offline', tone: 'coral' as const }] : []),
              ...(arrivedOut ? [{ kind: 'code' as const, text: 'PASSCODE: DEMO', tone: 'green' as const }] : []),
              ...(arrivedErr2 ? [{ kind: 'code' as const, text: '[WARN] Fan RPM unstable', tone: 'coral' as const }] : []),
              ...(!arrivedErr1 ? [{ kind: 'code' as const, text: 'Waiting for output…', tone: 'muted' as const }] : []),
            ],
          },
          errors: { hidden: true },
        },
        wires: {
          'proc-out': { visible: true, tone: 'green', ...(compactWires?.['proc-out'] ?? {}) },
          'proc-err': { visible: true, tone: 'coral', ...(compactWires?.['proc-err'] ?? {}) },
          'out-term': { visible: true, tone: 'green', ...(compactWires?.['out-term'] ?? {}) },
          'out-file': { visible: false, ...(compactWires?.['out-file'] ?? {}) },
          'err-term': { visible: true, tone: 'coral', ...(compactWires?.['err-term'] ?? {}) },
          'err-file': { visible: false, ...(compactWires?.['err-file'] ?? {}) },
        },
        packets: [
          ...(p >= 0.05 && p < 0.45 ? [{ id: 'err1', wire: 'err-term' as const, badge: 'ERROR', tone: 'coral' as const, progress: (p - 0.05) / 0.4 }] : []),
          ...(p >= 0.25 && p < 0.68 ? [{ id: 'out1', wire: 'out-term' as const, badge: 'PASSCODE', tone: 'green' as const, progress: (p - 0.25) / 0.43 }] : []),
          ...(p >= 0.45 && p < 0.88 ? [{ id: 'err2', wire: 'err-term' as const, badge: 'WARN', tone: 'coral' as const, progress: (p - 0.45) / 0.43 }] : []),
        ],
      }
    }

    case 1: {
      const arrivedErr1 = p >= 0.48
      const arrivedOut = p >= 0.72
      const arrivedErr2 = p >= 0.9
      return {
        title: '> redirects port 1 only; errors still reach the screen',
        body: 'Adding > passcode.txt switches stdout into the file, but leaves port 2 untouched—so warnings still print on the terminal while passcode.txt gets only clean data.',
        panel: {
          label: 'Redirect stdout only',
          command: '$ /opt/asc_quest/noisy_sensor.sh > passcode.txt',
          lines: [
            { text: 'passcode.txt <- PASSCODE: DEMO', tone: 'green' },
            { text: 'Terminal     <- [ERROR] + [WARN]', tone: 'coral' },
          ],
        },
        changes: [
          { kind: 'change', text: 'Port 1 (stdout) diverted via > into passcode.txt' },
          { kind: 'change', text: 'Port 2 (stderr) still points to Terminal screen' },
        ],
        hud: [
          { label: 'Port 1 (stdout)', value: '> passcode.txt', tone: 'good' },
          { label: 'Port 2 (stderr)', value: 'Terminal', tone: 'warn' },
          { label: 'Screen output', value: 'errors only', tone: 'warn' },
        ],
        entities: {
          process: {
            tone: 'slate',
            rows: compact
              ? [{ kind: 'code', text: '1> passcode.txt  ·  fd 2: tty', tone: 'muted' }]
              : [
                { kind: 'code', text: '1> passcode.txt', tone: 'green' },
                { kind: 'code', text: 'fd 2 -> tty', tone: 'coral' },
              ],
          },
          stdout: { emphasis: true, tone: 'green', operator: '>' },
          stderr: { tone: 'coral', operator: '·' },
          passcode: {
            emphasis: arrivedOut,
            tone: 'green',
            badge: 'fd 1',
            rows: arrivedOut
              ? [{ kind: 'code', text: 'PASSCODE: DEMO', tone: 'green' }]
              : [{ kind: 'code', text: 'Opening passcode.txt…', tone: 'muted' }],
          },
          terminal: {
            tone: 'coral',
            badge: 'fd 2 only',
            rows: [
              ...(arrivedErr1 ? [{ kind: 'code' as const, text: '[ERROR] Sensor offline', tone: 'coral' as const }] : []),
              ...(arrivedErr2 ? [{ kind: 'code' as const, text: '[WARN] Fan RPM unstable', tone: 'coral' as const }] : []),
              ...(!arrivedErr1 ? [{ kind: 'code' as const, text: '—', tone: 'muted' as const }] : []),
            ],
          },
          errors: { hidden: true },
        },
        wires: {
          'proc-out': { visible: true, tone: 'green', ...(compactWires?.['proc-out'] ?? {}) },
          'proc-err': { visible: true, tone: 'coral', ...(compactWires?.['proc-err'] ?? {}) },
          'out-term': { visible: false, ...(compactWires?.['out-term'] ?? {}) },
          'out-file': { visible: true, tone: 'green', drawProgress: Math.min(1, p * 2.4), ...(compactWires?.['out-file'] ?? {}) },
          'err-term': { visible: true, tone: 'coral', ...(compactWires?.['err-term'] ?? {}) },
          'err-file': { visible: false, ...(compactWires?.['err-file'] ?? {}) },
        },
        packets: [
          ...(p >= 0.08 && p < 0.48 ? [{ id: 'err1', wire: 'err-term' as const, badge: 'ERROR', tone: 'coral' as const, progress: (p - 0.08) / 0.4 }] : []),
          ...(p >= 0.26 && p < 0.72 ? [{ id: 'out1', wire: 'out-file' as const, badge: 'PASSCODE', tone: 'green' as const, progress: (p - 0.26) / 0.46 }] : []),
          ...(p >= 0.48 && p < 0.9 ? [{ id: 'err2', wire: 'err-term' as const, badge: 'WARN', tone: 'coral' as const, progress: (p - 0.48) / 0.42 }] : []),
        ],
      }
    }

    case 2: {
      return {
        title: 'Predict: what will print on the terminal now?',
        body: 'The next command adds 2> error.log alongside > passcode.txt. Before advancing to the next step, predict whether any line will still reach Terminal screen.',
        panel: {
          label: 'Check your mental model',
          command: '$ /opt/asc_quest/noisy_sensor.sh > passcode.txt 2> error.log',
          lines: [
            { text: 'Question: What appears on Terminal screen when both 1> and 2> are set?', tone: 'amber' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Added 2> error.log redirection operator on port 2' },
          { kind: 'change', text: 'Pause and predict Terminal screen + error.log before stepping forward' },
        ],
        hud: [
          { label: 'Port 1 (stdout)', value: '> passcode.txt', tone: 'good' },
          { label: 'Port 2 (stderr)', value: '2> ? (predict)', tone: 'warn' },
          { label: 'Screen output', value: 'predict next →', tone: 'warn' },
        ],
        entities: {
          process: {
            tone: 'amber',
            rows: compact
              ? [{ kind: 'code', text: '> passcode.txt  2> error.log', tone: 'amber' }]
              : [
                { kind: 'code', text: '1> passcode.txt', tone: 'green' },
                { kind: 'code', text: '2> error.log', tone: 'amber' },
              ],
          },
          stdout: { tone: 'green', operator: '>' },
          stderr: { emphasis: true, dashed: true, tone: 'amber', operator: '?' },
          passcode: {
            tone: 'green',
            badge: 'fd 1',
            rows: [{ kind: 'code', text: 'Ready for stdout', tone: 'muted' }],
          },
          terminal: {
            emphasis: true,
            dashed: true,
            tone: 'amber',
            badge: 'predict',
            rows: [{ kind: 'code', text: 'Will anything print here?', tone: 'amber' }],
          },
          errors: {
            dashed: true,
            tone: 'coral',
            badge: 'preview',
            rows: [{ kind: 'code', text: 'Pending…', tone: 'muted' }],
          },
        },
        wires: {
          'proc-out': { visible: true, tone: 'green', ...(compactWires?.['proc-out'] ?? {}) },
          'proc-err': { visible: true, dashed: true, tone: 'amber', ...(compactWires?.['proc-err'] ?? {}) },
          'out-term': { visible: false, ...(compactWires?.['out-term'] ?? {}) },
          'out-file': { visible: true, tone: 'green', ...(compactWires?.['out-file'] ?? {}) },
          'err-term': { visible: false, ...(compactWires?.['err-term'] ?? {}) },
          'err-file': { visible: false, ...(compactWires?.['err-file'] ?? {}) },
        },
        packets: [],
      }
    }

    case 3: {
      const arrivedErr1 = p >= 0.48
      const arrivedOut = p >= 0.72
      const arrivedErr2 = p >= 0.9
      return {
        title: '2> sends port 2 to error.log; the screen stays quiet',
        body: 'With both ports redirected to separate files, nothing is sent to the terminal. Silence on screen means both streams went cleanly to disk.',
        panel: {
          label: 'Both streams routed',
          command: '$ /opt/asc_quest/noisy_sensor.sh > passcode.txt 2> error.log',
          lines: [
            { text: '(no terminal output — exit code 0)', tone: 'muted' },
          ],
        },
        changes: [
          { kind: 'change', text: 'Port 2 (stderr) snaps downward into error.log' },
          { kind: 'add', text: 'Terminal screen stays completely quiet (0 lines)' },
        ],
        hud: [
          { label: 'Port 1 (stdout)', value: '> passcode.txt', tone: 'good' },
          { label: 'Port 2 (stderr)', value: '2> error.log', tone: 'good' },
          { label: 'Screen output', value: 'quiet (0 lines)', tone: 'good' },
        ],
        entities: {
          process: {
            tone: 'green',
            rows: compact
              ? [{ kind: 'code', text: '1> passcode.txt  2> error.log', tone: 'green' }]
              : [
                { kind: 'code', text: '1> passcode.txt', tone: 'green' },
                { kind: 'code', text: '2> error.log', tone: 'coral' },
              ],
          },
          stdout: { tone: 'green', operator: '>' },
          stderr: { emphasis: true, tone: 'coral', operator: '2>' },
          passcode: {
            emphasis: arrivedOut,
            tone: 'green',
            badge: 'fd 1',
            rows: arrivedOut
              ? [{ kind: 'code', text: 'PASSCODE: DEMO', tone: 'green' }]
              : [{ kind: 'code', text: 'Writing…', tone: 'muted' }],
          },
          terminal: {
            dimmed: true,
            tone: 'slate',
            badge: 'quiet',
            rows: [{ kind: 'code', text: 'No screen output', tone: 'muted' }],
          },
          errors: {
            emphasis: arrivedErr2,
            tone: 'coral',
            badge: 'fd 2',
            rows: [
              ...(arrivedErr1 ? [{ kind: 'code' as const, text: compact ? '[ERROR] Offline' : '[ERROR] Sensor offline', tone: 'coral' as const }] : []),
              ...(arrivedErr2 ? [{ kind: 'code' as const, text: compact ? '[WARN] Fan RPM' : '[WARN] Fan RPM unstable', tone: 'coral' as const }] : []),
              ...(!arrivedErr1 ? [{ kind: 'code' as const, text: 'Writing…', tone: 'muted' as const }] : []),
            ],
          },
        },
        wires: {
          'proc-out': { visible: true, tone: 'green', ...(compactWires?.['proc-out'] ?? {}) },
          'proc-err': { visible: true, tone: 'coral', ...(compactWires?.['proc-err'] ?? {}) },
          'out-term': { visible: false, ...(compactWires?.['out-term'] ?? {}) },
          'out-file': { visible: true, tone: 'green', ...(compactWires?.['out-file'] ?? {}) },
          'err-term': { visible: false, ...(compactWires?.['err-term'] ?? {}) },
          'err-file': { visible: true, tone: 'coral', drawProgress: Math.min(1, p * 2.4), ...(compactWires?.['err-file'] ?? {}) },
        },
        packets: [
          ...(p >= 0.08 && p < 0.48 ? [{ id: 'err1', wire: 'err-file' as const, badge: 'ERROR', tone: 'coral' as const, progress: (p - 0.08) / 0.4 }] : []),
          ...(p >= 0.25 && p < 0.72 ? [{ id: 'out1', wire: 'out-file' as const, badge: 'PASSCODE', tone: 'green' as const, progress: (p - 0.25) / 0.47 }] : []),
          ...(p >= 0.48 && p < 0.9 ? [{ id: 'err2', wire: 'err-file' as const, badge: 'WARN', tone: 'coral' as const, progress: (p - 0.48) / 0.42 }] : []),
        ],
      }
    }

    default: {
      return {
        title: 'Clean data for scripts, preserved logs for debugging',
        body: 'Separating stdout and stderr lets downstream tools parse passcode.txt cleanly without throwing away the diagnostic messages saved in error.log.',
        panel: {
          label: 'Inspect both files',
          command: '$ cat passcode.txt && cat error.log',
          lines: [
            { text: 'passcode.txt -> PASSCODE: DEMO', tone: 'green' },
            { text: 'error.log    -> [ERROR] Sensor offline / [WARN] Fan RPM', tone: 'coral' },
          ],
        },
        changes: [
          { kind: 'add', text: 'passcode.txt holds uncorrupted stdout data' },
          { kind: 'add', text: 'error.log retains all stderr warnings for inspection' },
        ],
        hud: [
          { label: 'passcode.txt', value: 'clean stdout', tone: 'good' },
          { label: 'error.log', value: '2 diagnostics', tone: 'good' },
          { label: 'Screen output', value: 'quiet', tone: 'neutral' },
        ],
        entities: {
          process: {
            dimmed: true,
            rows: compact
              ? [{ kind: 'code', text: 'Exited (0)', tone: 'muted' }]
              : [
                { kind: 'code', text: 'Completed cleanly', tone: 'muted' },
              ],
          },
          stdout: { dimmed: true, tone: 'green', operator: '>' },
          stderr: { dimmed: true, tone: 'coral', operator: '2>' },
          passcode: {
            emphasis: true,
            tone: 'green',
            badge: 'clean',
            rows: [{ kind: 'code', text: 'PASSCODE: DEMO', tone: 'green' }],
          },
          terminal: {
            dimmed: true,
            tone: 'slate',
            badge: 'quiet',
            rows: [{ kind: 'code', text: 'No screen output', tone: 'muted' }],
          },
          errors: {
            emphasis: true,
            tone: 'coral',
            badge: '2 lines',
            rows: [
              { kind: 'code', text: compact ? '[ERROR] Offline' : '[ERROR] Sensor offline', tone: 'coral' },
              { kind: 'code', text: compact ? '[WARN] Fan RPM' : '[WARN] Fan RPM unstable', tone: 'coral' },
            ],
          },
        },
        wires: {
          'proc-out': { visible: true, active: false, tone: 'green', ...(compactWires?.['proc-out'] ?? {}) },
          'proc-err': { visible: true, active: false, tone: 'coral', ...(compactWires?.['proc-err'] ?? {}) },
          'out-term': { visible: false, ...(compactWires?.['out-term'] ?? {}) },
          'out-file': { visible: true, active: false, tone: 'green', ...(compactWires?.['out-file'] ?? {}) },
          'err-term': { visible: false, ...(compactWires?.['err-term'] ?? {}) },
          'err-file': { visible: true, active: false, tone: 'coral', ...(compactWires?.['err-file'] ?? {}) },
        },
        packets: [],
      }
    }
  }
}

export const streamStageSpec: SchematicStageSpec<StreamEntity, StreamWire> = {
  id: 'streams',
  svgTitle: 'Two output streams and their destinations',
  svgDesc: 'Follow standard output (port 1) and standard error (port 2) as the shell routes them to the terminal or separate files.',
  wideSize: { w: 880, h: 326 },
  compactSize: { w: 380, h: 410 },
  entities: streamEntities,
  wires: streamWires,
  maxPackets: ['err1', 'out1', 'err2'],
  evaluate: evaluateStreamStep,
  describeEntity(id, stepIndex) {
    if (id === 'errors' && stepIndex === 2) {
      return {
        name: partDetails.errors.name,
        role: 'File preview (2>)',
        detail: 'Predict what will land in error.log and on the terminal screen when 2> error.log runs.',
      }
    }
    return partDetails[id]
  },
}

