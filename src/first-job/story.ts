import type {
  SchematicStageFrame,
  SchematicStageSpec,
  StageEntitySpec,
  StagePartInfo,
  StageStepDef,
  StageWireSpec,
} from '../stage/types.ts'

export type JobEntity =
  | 'login'
  | 'login-term'
  | 'slurm'
  | 'compute'
  | 'env'
  | 'gpu'
  | 'other-gpus'
  | 'home'
  | 'scratch'

export type JobWire = 'submit' | 'allocate' | 'script-read' | 'scratch-write' | 'scratch-read'

export const jobSteps: readonly StageStepDef[] = [
  { id: 'submit', label: 'Submit', beatDurationMs: 1350 },
  { id: 'allocate', label: 'Allocate', beatDurationMs: 1350 },
  { id: 'modules', label: 'Modules', beatDurationMs: 1300 },
  { id: 'execute', label: 'Execute', beatDurationMs: 1550 },
  { id: 'finish', label: 'Finish', beatDurationMs: 1350 },
]

const partDetails: Record<string, StagePartInfo> = {
  login: {
    name: 'Login node (login01)',
    role: 'Shared SSH entry shell',
    detail: 'Your SSH session stays on login01 for editing scripts, submitting jobs, and reading results—never for heavy computation.',
  },
  slurm: {
    name: 'Slurm scheduler',
    role: 'Queue & resource manager',
    detail: 'Matches #SBATCH requests to free compute resources and launches batch scripts. Application data never flows through Slurm.',
  },
  compute: {
    name: 'Compute node (gpu01)',
    role: 'Scheduled gpu-a30 server',
    detail: 'An HPC4 A30 node pairs two Xeon Gold 6448Y sockets and 512 GB DDR5 RAM with four NVIDIA A30 GPUs.',
  },
  env: {
    name: 'Batch shell & Lmod',
    role: 'Job environment on gpu01',
    detail: 'Each batch job starts a fresh shell on the compute node. module load updates PATH so it finds installed Spack software.',
  },
  gpu: {
    name: 'Allocated GPU (A30 #0)',
    role: 'Reserved 24 GB A30 slice',
    detail: 'Requesting --gpus-per-node=1 allocates one A30 GPU to this job while leaving GPUs 1–3 free for other jobs.',
  },
  home: {
    name: '/home/<user>',
    role: 'Shared & backed-up storage',
    detail: 'Mounted on both login and compute nodes (200 GB quota, 14-day backup window). Keep scripts, source code, and configs here.',
  },
  scratch: {
    name: '/scratch/<user>',
    role: 'High-speed job storage',
    detail: 'Mounted across nodes for large datasets and job output (500 GB quota, 60-day inactivity purge, not backed up).',
  },
}

export const jobEntities: readonly StageEntitySpec<JobEntity>[] = [
  {
    id: 'login',
    kind: 'plinth',
    kicker: 'ACCESS · SHARED',
    compactKicker: 'ACCESS',
    title: 'login01',
    wide: { x: 18, y: 18, w: 236, h: 198 },
    compact: { x: 10, y: 10, w: 176, h: 124 },
    part: partDetails.login,
  },
  {
    id: 'login-term',
    kind: 'card',
    parent: 'login',
    title: 'SSH terminal',
    compactTitle: 'SSH shell',
    wide: { x: 12, y: 48, w: 212, h: 128 },
    compact: { x: 8, y: 42, w: 160, h: 68 },
    maxRows: 3,
  },
  {
    id: 'slurm',
    kind: 'card',
    stripeSide: 'top',
    kicker: 'SCHEDULER · CONTROL',
    compactKicker: 'SCHEDULER',
    title: 'Slurm',
    wide: { x: 290, y: 18, w: 208, h: 138 },
    compact: { x: 196, y: 10, w: 174, h: 124 },
    maxRows: 3,
    part: partDetails.slurm,
  },
  {
    id: 'compute',
    kind: 'plinth',
    kicker: 'COMPUTE · gpu-a30',
    compactKicker: 'gpu-a30',
    title: 'gpu01',
    wide: { x: 534, y: 18, w: 348, h: 206 },
    compact: { x: 10, y: 152, w: 360, h: 168 },
    part: partDetails.compute,
  },
  {
    id: 'env',
    kind: 'card',
    parent: 'compute',
    title: 'Batch shell',
    wide: { x: 14, y: 48, w: 320, h: 70 },
    compact: { x: 10, y: 42, w: 340, h: 56 },
    maxRows: 1,
    part: partDetails.env,
  },
  {
    id: 'gpu',
    kind: 'brick',
    parent: 'compute',
    title: 'A30 #0',
    wide: { x: 14, y: 130, w: 172, h: 56 },
    compact: { x: 10, y: 106, w: 196, h: 48 },
    part: partDetails.gpu,
  },
  {
    id: 'other-gpus',
    kind: 'brick',
    parent: 'compute',
    title: 'A30 #1–3',
    wide: { x: 196, y: 130, w: 138, h: 56 },
    compact: { x: 214, y: 106, w: 136, h: 48 },
  },
  {
    id: 'home',
    kind: 'card',
    kicker: 'BACKED UP · 14 DAYS',
    compactKicker: 'BACKED UP',
    title: '/home/<user>',
    compactTitle: '/home',
    wide: { x: 18, y: 266, w: 408, h: 82 },
    compact: { x: 10, y: 350, w: 174, h: 78 },
    maxRows: 1,
    part: partDetails.home,
  },
  {
    id: 'scratch',
    kind: 'card',
    kicker: 'HIGH-SPEED · 60-DAY PURGE',
    compactKicker: '60D PURGE',
    title: '/scratch/<user>',
    compactTitle: '/scratch',
    wide: { x: 474, y: 266, w: 408, h: 82 },
    compact: { x: 196, y: 350, w: 174, h: 78 },
    maxRows: 1,
    part: partDetails.scratch,
  },
]

export const jobWires: readonly StageWireSpec<JobWire, JobEntity>[] = [
  {
    id: 'submit',
    kind: 'control',
    tone: 'amber',
    from: { id: 'login', port: 'e', offset: -30 },
    to: { id: 'slurm', port: 'w' },
  },
  {
    id: 'allocate',
    kind: 'control',
    tone: 'amber',
    from: { id: 'slurm', port: 'e' },
    to: { id: 'compute', port: 'w', offset: -34 },
    compactVia: [[283, 143]],
  },
  {
    id: 'script-read',
    kind: 'data',
    tone: 'green',
    from: { id: 'home', port: 'n', offset: 110 },
    to: { id: 'env', port: 's', offset: -80 },
    wideVia: [[332, 240], [628, 240]],
    compactVia: [[97, 332], [100, 332]],
  },
  {
    id: 'scratch-write',
    kind: 'data',
    tone: 'green',
    from: { id: 'gpu', port: 's' },
    to: { id: 'scratch', port: 'n', offset: -44 },
  },
  {
    id: 'scratch-read',
    kind: 'data',
    tone: 'green',
    from: { id: 'scratch', port: 'n', offset: -120 },
    to: { id: 'login', port: 's' },
    wideVia: [[558, 244], [136, 244]],
    compactVia: [[250, 334], [5, 334], [5, 72]],
  },
]

const noJobWires: Record<JobWire, { visible: boolean }> = {
  submit: { visible: false },
  allocate: { visible: false },
  'script-read': { visible: false },
  'scratch-write': { visible: false },
  'scratch-read': { visible: false },
}

export function evaluateJobStep(
  stepIndex: number,
  beatProgress: number,
  _variant = 'default',
  compact = false,
): SchematicStageFrame<JobEntity, JobWire, 'mounts'> {
  const p = Math.max(0, Math.min(1, beatProgress))
  const compactAllocOverride = compact
    ? { fromOverride: { id: 'slurm', port: 's' as const }, toOverride: { id: 'compute', port: 'n' as const, offset: 93 }, compactViaOverride: [] as const }
    : {}
  const compactReadOverride = compact
    ? { fromOverride: { id: 'scratch', port: 'n' as const, offset: -30 }, toOverride: { id: 'login', port: 'w' as const }, compactViaOverride: [[253, 334], [4, 334], [4, 72]] as const }
    : {}

  switch (stepIndex) {
    case 0: {
      const queued = p >= 0.68
      return {
        title: 'sbatch submits a request; your shell stays on login01',
        body: 'SSH places you on login01 to edit files and submit jobs. sbatch sends the resource description to Slurm and returns Job 1405015 immediately—your terminal never moves.',
        panel: {
          label: 'login01 shell',
          command: '$ sbatch job.sh',
          lines: [
            { text: queued ? 'Submitted batch job 1405015' : 'Sending #SBATCH request to Slurm…', tone: queued ? 'amber' : 'muted' },
            { text: '[user@login01 ~]$  # prompt stays on login01', tone: 'slate' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Job 1405015 queued in Slurm as Pending (PD)' },
          { kind: 'change', text: 'Interactive SSH prompt remains on login01' },
        ],
        hud: [
          { label: 'SSH shell', value: 'login01', tone: 'neutral' },
          { label: 'Job 1405015', value: queued ? 'PD (queued)' : 'submitting…', tone: 'warn' },
          { label: 'Compute node', value: 'unassigned', tone: 'neutral' },
        ],
        entities: {
          login: { emphasis: true, tone: 'blue', led: 'on', subtitle: 'Interactive' },
          'login-term': {
            tone: 'blue',
            rows: compact
              ? [
                { kind: 'code', text: '$ sbatch job.sh' },
                { kind: 'code', text: queued ? 'Job 1405015 (PD)' : 'Sending…', tone: 'amber' },
              ]
              : [
                { kind: 'code', text: '[login01 ~]$ sbatch job.sh' },
                { kind: 'code', text: queued ? 'Submitted job 1405015' : 'Sending request…', tone: 'amber' },
                { kind: 'code', text: 'Shell stays on login01', tone: 'muted' },
              ],
          },
          slurm: {
            emphasis: queued,
            tone: 'amber',
            badge: queued ? 'PD' : 'IDLE',
            rows: [
              { kind: 'kv', key: 'Job', value: '1405015', tone: 'amber', highlight: queued },
              { kind: 'kv', key: 'Req', value: compact ? '1× A30' : 'gpu-a30 · 1 GPU', tone: 'slate' },
              { kind: 'code', text: 'Control plane only', tone: 'muted' },
            ],
          },
          compute: { dimmed: true, led: 'off', subtitle: 'Idle' },
          env: {
            dimmed: true,
            dashed: true,
            badge: 'inactive',
            rows: [{ kind: 'code', text: compact ? 'No batch shell' : 'No batch shell running', tone: 'muted' }],
          },
          gpu: { dimmed: true, subtitle: 'Free' },
          'other-gpus': { dimmed: true, dashed: true, subtitle: 'Free' },
          home: {
            tone: 'green',
            rows: [{ kind: 'code', text: 'job.sh   train.py', tone: 'slate' }],
          },
          scratch: {
            tone: 'slate',
            rows: [{ kind: 'code', text: compact ? '— (empty)' : '— (no job output yet)', tone: 'muted' }],
          },
        },
        wires: {
          ...noJobWires,
          submit: { visible: true, tone: 'amber', drawProgress: Math.min(1, p * 1.8) },
        },
        packets: p < 0.68
          ? [{ id: 'pkt', wire: 'submit', badge: 'sbatch', tone: 'amber', progress: p / 0.68 }]
          : [],
      }
    }

    case 1: {
      const arrived = p >= 0.65
      return {
        title: 'Slurm allocates 1 of 4 GPUs on gpu01',
        body: 'When resources free up, Slurm assigns CPU cores and A30 #0 on gpu01 to Job 1405015 while GPUs 1–3 stay free for other users.',
        panel: {
          label: 'Slurm allocation',
          command: '#SBATCH --partition=gpu-a30 --gpus-per-node=1',
          lines: [
            { text: '$ squeue --me -> 1405015  gpu-a30  R  gpu01', tone: 'blue' },
          ],
        },
        changes: [
          { kind: 'change', text: 'Job 1405015 transitions from PD to Running (R) on gpu01' },
          { kind: 'add', text: 'Reserved A30 #0 slice; GPUs 1–3 remain available' },
        ],
        hud: [
          { label: 'SSH shell', value: 'login01 (free)', tone: 'good' },
          { label: 'Job 1405015', value: arrived ? 'R · gpu01' : 'scheduling…', tone: 'good' },
          { label: 'GPU slice', value: arrived ? 'A30 #0 (1/4)' : 'reserving…', tone: 'good' },
        ],
        entities: {
          login: { tone: 'slate', led: 'on', subtitle: 'Prompt free' },
          'login-term': {
            rows: compact
              ? [
                { kind: 'code', text: '$ squeue --me' },
                { kind: 'code', text: arrived ? '1405015 R gpu01' : '1405015 PD', tone: 'blue' },
              ]
              : [
                { kind: 'code', text: '$ squeue --me' },
                { kind: 'code', text: arrived ? '1405015  gpu-a30  R  gpu01' : '1405015  gpu-a30  PD', tone: 'blue' },
                { kind: 'code', text: 'Safe to keep working', tone: 'muted' },
              ],
          },
          slurm: {
            emphasis: !arrived,
            tone: 'blue',
            badge: 'R · gpu01',
            rows: [
              { kind: 'kv', key: 'Node', value: 'gpu01', tone: 'blue', highlight: true },
              { kind: 'kv', key: 'Slice', value: '1 / 4 A30', tone: 'blue' },
              { kind: 'code', text: 'Control plane only', tone: 'muted' },
            ],
          },
          compute: { emphasis: arrived, tone: 'blue', led: arrived ? 'active' : 'off', subtitle: arrived ? 'Allocated' : 'Assigning' },
          env: {
            tone: arrived ? 'amber' : 'slate',
            dashed: !arrived,
            badge: arrived ? 'starting' : 'inactive',
            rows: [{ kind: 'code', text: arrived ? 'Fresh shell spawned' : 'Waiting…', tone: arrived ? 'amber' : 'muted' }],
          },
          gpu: { emphasis: arrived, tone: 'blue', subtitle: arrived ? 'Allocated' : 'Free' },
          'other-gpus': { dimmed: true, dashed: true, subtitle: 'Free' },
          home: {
            tone: 'green',
            rows: [{ kind: 'code', text: 'job.sh   train.py', tone: 'slate' }],
          },
          scratch: {
            tone: 'slate',
            rows: [{ kind: 'code', text: compact ? '— (empty)' : '— (no job output yet)', tone: 'muted' }],
          },
        },
        wires: {
          ...noJobWires,
          allocate: { visible: true, tone: 'amber', drawProgress: Math.min(1, p * 1.8), ...compactAllocOverride },
        },
        packets: p < 0.65
          ? [{ id: 'pkt', wire: 'allocate', badge: 'ALLOC', tone: 'amber', progress: p / 0.65 }]
          : [],
      }
    }

    case 2: {
      const loaded = p >= 0.62
      return {
        title: 'A fresh batch shell reads job.sh and loads modules',
        body: 'gpu01 reads job.sh directly from shared /home into a clean batch shell, where module load wires Spack software into PATH before code starts.',
        panel: {
          label: 'Batch shell on gpu01',
          command: 'module load python/3.13.2',
          lines: [
            { text: 'Reads ~/job.sh from shared /home mount', tone: 'green' },
            { text: 'Updates PATH inside gpu01 batch shell only', tone: 'muted' },
          ],
        },
        changes: [
          { kind: 'add', text: 'gpu01 reads job.sh directly from shared /home' },
          { kind: 'change', text: 'Lmod wires python/3.13.2 into gpu01 batch shell PATH' },
        ],
        hud: [
          { label: 'Executes on', value: 'gpu01', tone: 'good' },
          { label: 'Batch env', value: loaded ? 'python/3.13.2' : 'loading…', tone: loaded ? 'good' : 'warn' },
          { label: 'Data route', value: 'direct mounts', tone: 'good' },
        ],
        entities: {
          login: { dimmed: true, led: 'on', subtitle: 'Idle' },
          'login-term': {
            dimmed: true,
            rows: compact
              ? [
                { kind: 'code', text: '[login01]$' },
                { kind: 'code', text: 'Prompt free', tone: 'muted' },
              ]
              : [
                { kind: 'code', text: '[user@login01 ~]$' },
                { kind: 'code', text: 'Prompt stays free', tone: 'muted' },
              ],
          },
          slurm: {
            tone: 'blue',
            badge: 'R · gpu01',
            rows: [
              { kind: 'kv', key: 'Node', value: 'gpu01', tone: 'blue' },
              { kind: 'code', text: 'No app data I/O', tone: 'muted' },
            ],
          },
          compute: { tone: 'blue', led: 'active', subtitle: 'Job 1405015' },
          env: {
            emphasis: true,
            tone: loaded ? 'green' : 'amber',
            badge: loaded ? 'Lmod ready' : 'starting',
            rows: [{
              kind: 'code',
              text: loaded ? (compact ? 'PATH += python' : 'PATH += Spack python/3.13.2') : 'Reading job.sh…',
              tone: loaded ? 'green' : 'amber',
            }],
          },
          gpu: { tone: 'blue', subtitle: 'Allocated' },
          'other-gpus': { dimmed: true, dashed: true, subtitle: 'Free' },
          home: {
            emphasis: !loaded,
            tone: 'green',
            rows: [{ kind: 'code', text: 'job.sh   train.py', tone: 'green' }],
          },
          scratch: {
            tone: 'slate',
            rows: [{ kind: 'code', text: compact ? '— (empty)' : '— (no job output yet)', tone: 'muted' }],
          },
        },
        wires: {
          ...noJobWires,
          'script-read': { visible: true, tone: 'green', drawProgress: Math.min(1, p * 2) },
        },
        packets: p < 0.62
          ? [{ id: 'pkt', wire: 'script-read', badge: 'job.sh', tone: 'green', progress: p / 0.62 }]
          : [],
      }
    }

    case 3: {
      const written = p >= 0.84
      const runProg = Math.min(1, p / 0.84)
      return {
        title: 'Compute on A30 #0 and write output straight to /scratch',
        body: 'train.py executes on gpu01’s allocated CPUs and A30 #0, streaming checkpoints and output directly to shared /scratch—application data never travels through Slurm.',
        panel: {
          label: 'Execution & output',
          command: 'python train.py   # #SBATCH -o /scratch/%u/slurm-%j.out',
          lines: [
            { text: written ? 'Saved result.pt + slurm-1405015.out to /scratch' : 'Computing on A30 #0 · writing to /scratch…', tone: 'green' },
          ],
        },
        changes: [
          { kind: 'change', text: 'A30 #0 executes train.py (login01 safe to disconnect)' },
          { kind: 'add', text: 'result.pt written directly from gpu01 to shared /scratch' },
        ],
        hud: [
          { label: 'Executes on', value: 'gpu01 · A30 #0', tone: 'good' },
          { label: 'Slurm data I/O', value: '0 B (control only)', tone: 'good' },
          { label: '/scratch output', value: written ? 'result.pt saved' : 'writing…', tone: written ? 'good' : 'warn' },
        ],
        entities: {
          login: { dimmed: true, led: 'on', subtitle: 'Safe to exit' },
          'login-term': {
            dimmed: true,
            rows: compact
              ? [
                { kind: 'code', text: '[login01]$' },
                { kind: 'code', text: 'Safe to log out', tone: 'muted' },
              ]
              : [
                { kind: 'code', text: '[user@login01 ~]$' },
                { kind: 'code', text: 'Idle (safe to log out)', tone: 'muted' },
              ],
          },
          slurm: {
            dimmed: true,
            tone: 'slate',
            badge: 'R · gpu01',
            rows: [
              { kind: 'code', text: 'Control plane only', tone: 'muted' },
              { kind: 'code', text: 'No app data crosses', tone: 'muted' },
            ],
          },
          compute: { emphasis: true, tone: 'blue', led: 'active', subtitle: 'Computing' },
          env: {
            tone: 'green',
            badge: 'running',
            rows: [{ kind: 'code', text: written ? 'train.py finished' : 'python train.py', tone: 'green' }],
          },
          gpu: {
            emphasis: true,
            tone: written ? 'green' : 'blue',
            subtitle: written ? 'Done' : `Run ${Math.round(runProg * 100)}%`,
            meter: { value: runProg, tone: written ? 'green' : 'blue' },
          },
          'other-gpus': { dimmed: true, dashed: true, subtitle: 'Free' },
          home: {
            tone: 'slate',
            rows: [{ kind: 'code', text: 'job.sh   train.py', tone: 'muted' }],
          },
          scratch: {
            emphasis: written,
            tone: written ? 'green' : 'blue',
            rows: [{
              kind: 'code',
              text: written ? (compact ? 'result.pt  .out' : 'result.pt   slurm-1405015.out') : 'Streaming output…',
              tone: written ? 'green' : 'blue',
            }],
          },
        },
        wires: {
          ...noJobWires,
          'scratch-write': { visible: p > 0.35, tone: 'green', drawProgress: Math.min(1, (p - 0.35) * 2.2) },
        },
        packets: p >= 0.4 && !written
          ? [{ id: 'pkt', wire: 'scratch-write', badge: 'result.pt', tone: 'green', progress: (p - 0.4) / 0.44 }]
          : [],
      }
    }

    default: {
      const readArrived = p >= 0.68
      return {
        title: 'Allocation releases; shared output stays visible',
        body: 'When job.sh exits, Slurm frees gpu01 and A30 #0 for the next job. Because login01 mounts the same /scratch, your results are immediately readable there.',
        panel: {
          label: 'Inspect results on login01',
          command: '$ sacct -j 1405015 && cat /scratch/$USER/slurm-1405015.out',
          lines: [
            { text: '1405015  COMPLETED  0:0  (gpu01 released)', tone: 'green' },
            { text: 'Reminder: /scratch has a 60-day inactivity purge', tone: 'amber' },
          ],
        },
        changes: [
          { kind: 'remove', text: 'Batch shell exits and Slurm releases gpu01 + A30 #0' },
          { kind: 'add', text: 'Output remains on shared /scratch, readable from login01' },
        ],
        hud: [
          { label: 'Job 1405015', value: 'COMPLETED', tone: 'good' },
          { label: 'gpu01 · A30 #0', value: 'released (free)', tone: 'neutral' },
          { label: 'Result files', value: 'on /scratch', tone: 'good' },
        ],
        entities: {
          login: { emphasis: true, tone: 'green', led: 'on', subtitle: 'Reading' },
          'login-term': {
            emphasis: true,
            tone: 'green',
            rows: compact
              ? [
                { kind: 'code', text: '$ cat slurm.out' },
                { kind: 'code', text: readArrived ? 'Saved result.pt' : 'Reading…', tone: 'green' },
              ]
              : [
                { kind: 'code', text: '$ cat /scratch/.../slurm.out' },
                { kind: 'code', text: readArrived ? 'Saved result.pt (done)' : 'Reading /scratch…', tone: 'green' },
              ],
          },
          slurm: {
            tone: 'green',
            badge: 'CD · DONE',
            rows: [
              { kind: 'kv', key: 'State', value: 'COMPLETED', tone: 'green' },
              { kind: 'code', text: 'gpu01 freed for queue', tone: 'muted' },
            ],
          },
          compute: { dimmed: true, led: 'off', subtitle: 'Released' },
          env: {
            dimmed: true,
            badge: 'exited (0)',
            rows: [{ kind: 'code', text: compact ? 'Shell closed' : 'Batch shell closed', tone: 'muted' }],
          },
          gpu: { dimmed: true, subtitle: 'Freed' },
          'other-gpus': { dimmed: true, dashed: true, subtitle: 'Free' },
          home: {
            tone: 'slate',
            rows: [{ kind: 'code', text: 'job.sh   train.py', tone: 'muted' }],
          },
          scratch: {
            emphasis: true,
            tone: 'green',
            rows: [{ kind: 'code', text: compact ? 'result.pt  .out' : 'result.pt   slurm-1405015.out', tone: 'green' }],
          },
        },
        wires: {
          ...noJobWires,
          'scratch-read': { visible: true, tone: 'green', drawProgress: Math.min(1, p * 1.8), ...compactReadOverride },
        },
        packets: p < 0.68
          ? [{ id: 'pkt', wire: 'scratch-read', badge: '.out', tone: 'green', progress: p / 0.68 }]
          : [],
      }
    }
  }
}

export const jobStageSpec: SchematicStageSpec<JobEntity, JobWire, 'mounts'> = {
  id: 'job',
  svgTitle: 'Batch job lifecycle across login, Slurm, compute node, and shared storage',
  svgDesc: 'Follow sbatch from login01 to Slurm, resource allocation and module loading on gpu01, direct output to /scratch, and reading results back on login01.',
  wideSize: { w: 900, h: 364 },
  compactSize: { w: 380, h: 440 },
  trays: [
    {
      id: 'mounts',
      label: 'SHARED MOUNTS',
      wide: { x: 18, y: 256, w: 864 },
      compact: { x: 10, y: 342, w: 360 },
    },
  ],
  entities: jobEntities,
  wires: jobWires,
  maxPackets: ['pkt'],
  evaluate: evaluateJobStep,
  describeEntity(id, stepIndex) {
    const base = partDetails[id]
    if (!base) return { name: id, role: 'Component', detail: '' }
    if (id === 'slurm') {
      const roles = ['Queued: Job 1405015 (PD)', 'Allocated: Job 1405015 on gpu01', 'Allocated: control plane only', 'Running: 0 B app data I/O', 'Completed: resources released']
      return { ...base, role: roles[stepIndex] ?? base.role }
    }
    if (id === 'gpu') {
      const roles = ['1 of 4 node GPUs (free)', 'Reserved by --gpus-per-node=1', 'Allocated to Job 1405015', 'Executing train.py', 'Freed for next job']
      return { ...base, role: roles[stepIndex] ?? base.role }
    }
    return base
  },
}

