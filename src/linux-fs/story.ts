import type {
  SchematicStageFrame,
  SchematicStageSpec,
  StageEntitySpec,
  StagePartInfo,
  StageStepDef,
  StageWireSpec,
} from '../stage/types.ts'

export type FsEntity =
  | 'win-c'
  | 'win-d'
  | 'root'
  | 'home'
  | 'opt'
  | 'tmp'
  | 'scratch'
  | 'user-home'
  | 'quest'
  | 'workspace'
  | 'dotfile'
  | 'local-disk'
  | 'shared-storage'

export type FsWire =
  | 'root-home'
  | 'root-opt'
  | 'root-tmp'
  | 'root-scratch'
  | 'home-user'
  | 'opt-quest'
  | 'user-work'
  | 'user-dot'
  | 'mount-root'
  | 'mount-tmp'
  | 'mount-home'
  | 'mount-scratch'

export const fsSteps: readonly StageStepDef[] = [
  { id: 'root', label: 'One root /', beatDurationMs: 1100 },
  { id: 'home', label: 'Home & dots', beatDurationMs: 1200 },
  { id: 'relative', label: 'Relative cd', beatDurationMs: 1150 },
  { id: 'absolute', label: 'Absolute cd', beatDurationMs: 1250 },
  { id: 'mounts', label: 'Mount points', beatDurationMs: 1350 },
]

const partDetails: Record<Exclude<FsEntity, 'win-c' | 'win-d'>, StagePartInfo> = {
  root: {
    name: '/ (root)',
    role: 'Top of the directory tree',
    detail: 'Every absolute path on Linux begins at /. Separate disks mount onto directories inside this single tree.',
  },
  home: {
    name: '/home',
    role: 'User home directories',
    detail: 'Contains personal directories such as /home/asc01. Clusters commonly mount shared backed-up storage here.',
  },
  'user-home': {
    name: '/home/asc01 (~)',
    role: 'Your home directory',
    detail: 'Login shells start here by default. The shell expands ~ to /home/<username>.',
  },
  workspace: {
    name: '~/workspace',
    role: 'Working directory',
    detail: 'Inside /home/asc01, cd workspace is a relative step; cd ~/workspace works from any directory.',
  },
  dotfile: {
    name: '.bashrc',
    role: 'Hidden shell config',
    detail: 'A leading dot hides entries from plain ls. Use ls -a to reveal dotfiles.',
  },
  opt: {
    name: '/opt',
    role: 'Add-on software & quests',
    detail: 'Holds optional packages and, in ASC Week 1, the /opt/asc_quest exercise directory.',
  },
  quest: {
    name: '/opt/asc_quest',
    role: 'Workshop exercises',
    detail: 'Shared read-only workshop materials reached via an absolute path starting with /.',
  },
  tmp: {
    name: '/tmp',
    role: 'Node-local temporary files',
    detail: 'Backed by this server’s local root disk in this example—not visible from other nodes.',
  },
  scratch: {
    name: '/scratch',
    role: 'Shared job workspace',
    detail: 'Mount point for high-speed shared cluster storage used for large job inputs and outputs.',
  },
  'local-disk': {
    name: 'Local root disk',
    role: 'Node-local storage',
    detail: 'Backs / and unmounted subdirectories like /tmp on this individual machine.',
  },
  'shared-storage': {
    name: 'Shared cluster storage',
    role: 'Network-mounted filesystems',
    detail: 'Mounted at /home and /scratch across nodes so login and compute nodes see the same files.',
  },
}

export const fsEntities: readonly StageEntitySpec<FsEntity>[] = [
  {
    id: 'win-c',
    kind: 'tile',
    title: 'C:\\',
    wide: { x: 256, y: 14, w: 68, h: 30 },
    compact: { x: 34, y: 12, w: 58, h: 28 },
  },
  {
    id: 'win-d',
    kind: 'tile',
    title: 'D:\\',
    wide: { x: 556, y: 14, w: 68, h: 30 },
    compact: { x: 288, y: 12, w: 58, h: 28 },
  },
  {
    id: 'root',
    kind: 'tile',
    title: '/',
    wide: { x: 386, y: 10, w: 108, h: 38 },
    compact: { x: 148, y: 10, w: 84, h: 34 },
    part: partDetails.root,
  },
  {
    id: 'home',
    kind: 'tile',
    title: '/home',
    wide: { x: 88, y: 82, w: 118, h: 38 },
    compact: { x: 10, y: 68, w: 82, h: 36 },
    part: partDetails.home,
  },
  {
    id: 'opt',
    kind: 'tile',
    title: '/opt',
    wide: { x: 292, y: 82, w: 118, h: 38 },
    compact: { x: 100, y: 68, w: 82, h: 36 },
    part: partDetails.opt,
  },
  {
    id: 'tmp',
    kind: 'tile',
    title: '/tmp',
    wide: { x: 496, y: 82, w: 118, h: 38 },
    compact: { x: 190, y: 68, w: 82, h: 36 },
    part: partDetails.tmp,
  },
  {
    id: 'scratch',
    kind: 'tile',
    title: '/scratch',
    wide: { x: 696, y: 82, w: 128, h: 38 },
    compact: { x: 280, y: 68, w: 90, h: 36 },
    part: partDetails.scratch,
  },
  {
    id: 'user-home',
    kind: 'tile',
    title: 'asc01  ~',
    compactTitle: 'asc01 ~',
    wide: { x: 88, y: 148, w: 118, h: 38 },
    compact: { x: 10, y: 128, w: 102, h: 36 },
    part: partDetails['user-home'],
  },
  {
    id: 'quest',
    kind: 'tile',
    title: 'asc_quest',
    wide: { x: 282, y: 148, w: 138, h: 38 },
    compact: { x: 122, y: 128, w: 114, h: 36 },
    part: partDetails.quest,
  },
  {
    id: 'workspace',
    kind: 'tile',
    title: 'workspace',
    wide: { x: 24, y: 214, w: 124, h: 38 },
    compact: { x: 10, y: 190, w: 108, h: 36 },
    part: partDetails.workspace,
  },
  {
    id: 'dotfile',
    kind: 'tile',
    title: '.bashrc',
    wide: { x: 164, y: 214, w: 108, h: 38 },
    compact: { x: 128, y: 190, w: 98, h: 36 },
    part: partDetails.dotfile,
  },
  {
    id: 'local-disk',
    kind: 'brick',
    title: 'Local disk',
    wide: { x: 148, y: 290, w: 244, h: 52 },
    compact: { x: 10, y: 266, w: 170, h: 50 },
    part: partDetails['local-disk'],
  },
  {
    id: 'shared-storage',
    kind: 'brick',
    title: 'Shared storage',
    compactTitle: 'Shared',
    wide: { x: 488, y: 290, w: 260, h: 52 },
    compact: { x: 190, y: 266, w: 180, h: 50 },
    part: partDetails['shared-storage'],
  },
]

export const fsWires: readonly StageWireSpec<FsWire, FsEntity>[] = [
  { id: 'root-home', kind: 'tree', from: { id: 'root', port: 's' }, to: { id: 'home', port: 'n' } },
  { id: 'root-opt', kind: 'tree', from: { id: 'root', port: 's' }, to: { id: 'opt', port: 'n' } },
  { id: 'root-tmp', kind: 'tree', from: { id: 'root', port: 's' }, to: { id: 'tmp', port: 'n' } },
  { id: 'root-scratch', kind: 'tree', from: { id: 'root', port: 's' }, to: { id: 'scratch', port: 'n' } },
  { id: 'home-user', kind: 'tree', from: { id: 'home', port: 's' }, to: { id: 'user-home', port: 'n' } },
  { id: 'opt-quest', kind: 'tree', from: { id: 'opt', port: 's' }, to: { id: 'quest', port: 'n' } },
  { id: 'user-work', kind: 'tree', from: { id: 'user-home', port: 's' }, to: { id: 'workspace', port: 'n' } },
  { id: 'user-dot', kind: 'tree', from: { id: 'user-home', port: 's' }, to: { id: 'dotfile', port: 'n' } },

  {
    id: 'mount-root',
    kind: 'mount',
    tone: 'blue',
    baseTrack: false,
    from: { id: 'local-disk', port: 'n', offset: -60 },
    to: { id: 'root', port: 'w' },
    wideVia: [[210, 262], [12, 262], [12, 29]],
    compactVia: [[35, 244], [4, 244], [4, 27]],
  },
  {
    id: 'mount-tmp',
    kind: 'mount',
    tone: 'blue',
    baseTrack: false,
    from: { id: 'local-disk', port: 'n', offset: 60 },
    to: { id: 'tmp', port: 's' },
    wideVia: [[330, 266], [555, 266]],
    compactVia: [[150, 244], [231, 244]],
  },
  {
    id: 'mount-home',
    kind: 'mount',
    tone: 'green',
    baseTrack: false,
    from: { id: 'shared-storage', port: 'n', offset: -65 },
    to: { id: 'home', port: 'e' },
    wideVia: [[553, 272], [244, 272], [244, 101]],
    compactVia: [[225, 250], [96, 250], [96, 86]],
  },
  {
    id: 'mount-scratch',
    kind: 'mount',
    tone: 'green',
    baseTrack: false,
    from: { id: 'shared-storage', port: 'n', offset: 65 },
    to: { id: 'scratch', port: 's' },
    wideVia: [[683, 266], [760, 266]],
    compactVia: [[340, 246], [325, 246]],
  },
]

const baseTreeWires: Record<FsWire, { visible: boolean; active?: boolean; tone?: 'slate' | 'green' | 'amber' | 'blue' }> = {
  'root-home': { visible: true, active: false, tone: 'slate' },
  'root-opt': { visible: true, active: false, tone: 'slate' },
  'root-tmp': { visible: true, active: false, tone: 'slate' },
  'root-scratch': { visible: true, active: false, tone: 'slate' },
  'home-user': { visible: true, active: false, tone: 'slate' },
  'opt-quest': { visible: true, active: false, tone: 'slate' },
  'user-work': { visible: true, active: false, tone: 'slate' },
  'user-dot': { visible: true, active: false, tone: 'slate' },
  'mount-root': { visible: false },
  'mount-tmp': { visible: false },
  'mount-home': { visible: false },
  'mount-scratch': { visible: false },
}

export function evaluateFsStep(
  stepIndex: number,
  beatProgress: number,
  _variant = 'default',
  compact = false,
): SchematicStageFrame<FsEntity, FsWire, 'storage'> {
  const p = Math.max(0, Math.min(1, beatProgress))

  const baseTreeEntities: SchematicStageFrame<FsEntity, FsWire, 'storage'>['entities'] = {
    'win-c': { hidden: true },
    'win-d': { hidden: true },
    root: { tone: 'slate' },
    home: { tone: 'slate' },
    opt: { tone: 'slate' },
    tmp: { tone: 'slate' },
    scratch: { tone: 'slate' },
    'user-home': { tone: 'slate' },
    quest: { tone: 'slate' },
    workspace: { tone: 'slate' },
    dotfile: { dimmed: true, dashed: true, tone: 'slate' },
    'local-disk': { hidden: true },
    'shared-storage': { hidden: true },
  }

  switch (stepIndex) {
    case 0: {
      const winFade = Math.max(0.22, 1 - p * 0.78)
      return {
        title: 'Everything lives under one / root',
        body: 'Unlike Windows drive letters (C:\\, D:\\), Linux organizes every file, tool, and mounted filesystem inside a single directory tree starting at /.',
        panel: {
          label: 'Inspect the root directory',
          command: '$ ls /',
          lines: [
            { text: 'home   opt   tmp   scratch   usr   etc', tone: 'slate' },
          ],
        },
        changes: [
          { kind: 'remove', text: 'No per-disk C:\\ or D:\\ drive letters' },
          { kind: 'add', text: 'Single hierarchy rooted at /' },
        ],
        hud: [
          { label: 'Tree root', value: '/', tone: 'good' },
          { label: 'pwd', value: '(not set yet)', tone: 'neutral' },
          { label: 'Dotfiles', value: 'hidden', tone: 'neutral' },
        ],
        trays: { storage: false },
        entities: {
          ...baseTreeEntities,
          'win-c': { hidden: false, dashed: true, opacity: winFade, subtitle: 'Windows' },
          'win-d': { hidden: false, dashed: true, opacity: winFade, subtitle: 'Windows' },
          root: { emphasis: true, tone: 'amber' },
        },
        wires: baseTreeWires,
      }
    }

    case 1: {
      const revealedDot = p >= 0.55
      return {
        title: 'Login starts in ~, and ls -a reveals dotfiles',
        body: 'Your shell starts inside /home/asc01 (abbreviated ~). Plain ls skips names starting with a dot, whereas ls -a reveals configuration files like .bashrc.',
        panel: {
          label: 'Home & hidden files',
          command: '$ pwd && ls -a ~',
          lines: [
            { text: '/home/asc01', tone: 'green' },
            { text: '.   ..   .bashrc   workspace', tone: revealedDot ? 'green' : 'muted' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Shell working directory (pwd) starts at /home/asc01 (~)' },
          { kind: 'change', text: 'ls -a exposes .bashrc without changing pwd' },
        ],
        hud: [
          { label: 'pwd', value: '/home/asc01 (~)', tone: 'good' },
          { label: 'Path kind', value: '~ shorthand', tone: 'neutral' },
          { label: 'Dotfiles', value: revealedDot ? 'visible (ls -a)' : 'hidden (ls)', tone: revealedDot ? 'good' : 'warn' },
        ],
        trays: { storage: false },
        entities: {
          ...baseTreeEntities,
          'user-home': { emphasis: true, tone: 'green' },
          dotfile: {
            dimmed: !revealedDot,
            dashed: !revealedDot,
            emphasis: revealedDot,
            tone: revealedDot ? 'green' : 'slate',
          },
        },
        wires: {
          ...baseTreeWires,
          'root-home': { visible: true, active: true, tone: 'green' },
          'home-user': { visible: true, active: true, tone: 'green' },
          'user-dot': { visible: true, active: revealedDot, tone: revealedDot ? 'green' : 'slate' },
        },
        pins: [{ id: 'pwd', target: 'user-home', label: 'pwd', tone: 'green' }],
      }
    }

    case 2: {
      const arrived = p >= 0.6
      return {
        title: 'Relative paths step from where you stand (pwd)',
        body: 'Because workspace has no leading slash, cd workspace looks directly inside your current working directory (/home/asc01) and moves pwd one level down.',
        panel: {
          label: 'Relative navigation',
          command: '$ cd workspace && pwd',
          lines: [
            { text: '/home/asc01/workspace', tone: 'green' },
          ],
        },
        changes: [
          { kind: 'change', text: 'Relative path resolves from /home/asc01 -> workspace' },
          { kind: 'change', text: 'pwd pin moves down to /home/asc01/workspace' },
        ],
        hud: [
          { label: 'pwd', value: arrived ? '~/workspace' : '/home/asc01', tone: 'good' },
          { label: 'Path kind', value: 'relative (from pwd)', tone: 'good' },
          { label: 'Leading /', value: 'no', tone: 'neutral' },
        ],
        trays: { storage: false },
        entities: {
          ...baseTreeEntities,
          'user-home': { tone: 'green' },
          workspace: { emphasis: true, tone: 'green' },
          dotfile: { tone: 'slate' },
        },
        wires: {
          ...baseTreeWires,
          'user-work': { visible: true, active: true, tone: 'green', drawProgress: Math.min(1, p * 2) },
        },
        packets: p < 0.6
          ? [{ id: 'step', wire: 'user-work', badge: 'cd', tone: 'green', progress: p / 0.6 }]
          : [],
        pins: [{ id: 'pwd', target: arrived ? 'workspace' : 'user-home', label: 'pwd', tone: 'green' }],
      }
    }

    case 3: {
      const arrived = p >= 0.72
      return {
        title: 'Absolute paths always start from /',
        body: 'Starting a path with / ignores your current directory and walks cleanly from the root: / -> /opt -> /opt/asc_quest.',
        panel: {
          label: 'Absolute navigation',
          command: '$ cd /opt/asc_quest && pwd',
          lines: [
            { text: '/opt/asc_quest   # works from anywhere', tone: 'amber' },
          ],
        },
        changes: [
          { kind: 'change', text: 'Leading / starts resolution at root / instead of ~/workspace' },
          { kind: 'change', text: 'pwd moves across the tree to /opt/asc_quest' },
        ],
        hud: [
          { label: 'pwd', value: arrived ? '/opt/asc_quest' : '~/workspace', tone: 'good' },
          { label: 'Path kind', value: 'absolute (from /)', tone: 'good' },
          { label: 'Leading /', value: 'yes', tone: 'good' },
        ],
        trays: { storage: false },
        entities: {
          ...baseTreeEntities,
          root: { emphasis: !arrived, tone: 'amber' },
          opt: { tone: 'amber' },
          quest: { emphasis: arrived, tone: 'amber' },
          dotfile: { tone: 'slate' },
        },
        wires: {
          ...baseTreeWires,
          'root-opt': { visible: true, active: true, tone: 'amber', drawProgress: Math.min(1, p * 2.2) },
          'opt-quest': { visible: true, active: p > 0.35, tone: p > 0.35 ? 'amber' : 'slate', drawProgress: Math.min(1, Math.max(0, (p - 0.35) * 2.2)) },
        },
        packets: p < 0.38
          ? [{ id: 'step', wire: 'root-opt', badge: '/opt', tone: 'amber', progress: p / 0.38 }]
          : p < 0.72
            ? [{ id: 'step', wire: 'opt-quest', badge: 'asc_quest', tone: 'amber', progress: (p - 0.38) / 0.34 }]
            : [],
        pins: [{ id: 'pwd', target: arrived ? 'quest' : 'workspace', label: 'pwd', tone: 'amber' }],
      }
    }

    default: {
      const sharedReady = p >= 0.5
      return {
        title: 'One directory tree, multiple mounted storage systems',
        body: 'Mount points attach different storage hardware into ordinary folders: / and /tmp live on this node’s local disk, while /home and /scratch mount shared cluster filesystems.',
        panel: {
          label: 'Check mounted filesystems',
          command: '$ df -h / /tmp /home /scratch',
          lines: [
            { text: '/, /tmp        -> local NVMe (this node only)', tone: 'blue' },
            { text: '/home, /scratch -> shared storage (all nodes)', tone: 'green' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Local disk backs / and /tmp on this machine only' },
          { kind: 'add', text: 'Shared cluster storage mounts onto /home and /scratch' },
        ],
        hud: [
          { label: '/ and /tmp', value: 'node-local disk', tone: 'warn' },
          { label: '/home & /scratch', value: sharedReady ? 'shared mounts' : 'mounting…', tone: 'good' },
          { label: 'Drive letters', value: 'none needed', tone: 'good' },
        ],
        trays: { storage: true },
        entities: {
          ...baseTreeEntities,
          root: { emphasis: true, tone: 'blue', subtitle: compact ? 'Local' : 'Local mount' },
          tmp: { emphasis: true, tone: 'blue', subtitle: compact ? 'Local' : 'Local here' },
          home: { emphasis: sharedReady, tone: sharedReady ? 'green' : 'slate', subtitle: sharedReady ? (compact ? 'Shared' : 'Shared mount') : undefined },
          scratch: { emphasis: sharedReady, tone: sharedReady ? 'green' : 'slate', subtitle: sharedReady ? (compact ? 'Shared' : 'Shared mount') : undefined },
          dotfile: { tone: 'slate' },
          'local-disk': { hidden: false, emphasis: true, tone: 'blue', subtitle: compact ? '/, /tmp' : 'Root & /tmp' },
          'shared-storage': { hidden: !sharedReady, emphasis: sharedReady, tone: 'green', subtitle: '/home, /scratch' },
        },
        wires: {
          ...baseTreeWires,
          'mount-root': { visible: true, tone: 'blue' },
          'mount-tmp': { visible: true, tone: 'blue' },
          'mount-home': { visible: sharedReady, tone: 'green' },
          'mount-scratch': { visible: sharedReady, tone: 'green' },
        },
      }
    }
  }
}

export const fsStageSpec: SchematicStageSpec<FsEntity, FsWire, 'storage'> = {
  id: 'fs',
  svgTitle: 'Linux paths and mount points in one directory tree',
  svgDesc: 'Follow pwd across relative and absolute paths, then compare local and shared storage mounted behind folders in one / tree.',
  wideSize: { w: 880, h: 356 },
  compactSize: { w: 380, h: 332 },
  trays: [
    {
      id: 'storage',
      label: 'EXAMPLE BACKING STORAGE',
      wide: { x: 24, y: 278, w: 832 },
      compact: { x: 10, y: 256, w: 360 },
    },
  ],
  entities: fsEntities,
  wires: fsWires,
  maxPackets: ['step'],
  maxPins: ['pwd'],
  evaluate: evaluateFsStep,
  describeEntity(id, stepIndex) {
    if (id === 'win-c' || id === 'win-d') return { name: id, role: 'Drive letter', detail: '' }
    const base = partDetails[id]
    const cwdByStep: Partial<Record<number, FsEntity>> = { 1: 'user-home', 2: 'workspace', 3: 'quest' }
    if (cwdByStep[stepIndex] === id) {
      return { ...base, role: 'Current working directory (pwd)' }
    }
    return base
  },
}

