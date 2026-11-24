import { createTimeline, phase } from '../timed-lesson/timeline.ts'

export const timeline = createTimeline([
  { id: 'root', label: 'One root /', durationMs: 5500 },
  { id: 'home', label: 'Home & dots', durationMs: 6000 },
  { id: 'paths', label: 'Paths & pwd', durationMs: 6500 },
  { id: 'mounts', label: 'Mount points', durationMs: 7000 },
] as const)

type Directory = 'root' | 'home' | 'user-home' | 'workspace' | 'opt' | 'quest' | 'tmp' | 'scratch'
export type FsPart = Directory | 'dotfile' | 'local-disk' | 'shared-storage'
export type WorkingDirectory = 'user-home' | 'workspace' | 'quest'

interface FsFrame {
  cwd: WorkingDirectory | null
  showDotfile: boolean
  comparisonOpacity: number
  trace: { kind: 'home' | 'relative' | 'absolute'; progress: number } | null
  mounts: 'none' | 'local' | 'shared'
  note: { anchor: FsPart; title: string; text: string; command?: string }
}

export function frameAt(elapsedMs: number): FsFrame {
  const { beat, withinBeat: t } = timeline.beatAt(elapsedMs)
  const initial = { cwd: null, showDotfile: false, comparisonOpacity: 0, trace: null, mounts: 'none' } as const
  switch (beat.id) {
    case 'root':
      return {
        ...initial,
        comparisonOpacity: 1 - phase(t, 1250, 1800),
        note: {
          anchor: 'root', title: 'One tree starts at /',
          text: 'Windows paths often start with a drive letter. Linux paths share one root, written /.',
        },
      }
    case 'home':
      return t < 3200
        ? {
          ...initial, cwd: 'user-home', trace: { kind: 'home', progress: 1 },
          note: { anchor: 'user-home', title: 'Your home is inside the tree', text: 'Here, ~ is shorthand for /home/asc01. pwd shows the shell’s current directory.', command: 'pwd  # /home/asc01' },
        }
        : {
          ...initial, cwd: 'user-home', showDotfile: true,
          note: { anchor: 'dotfile', title: 'ls normally skips leading dots', text: 'The file was already there. ls -a includes hidden entries such as .bashrc.', command: 'ls -a ~' },
        }
    case 'paths':
      return t < 2800
        ? {
          ...initial, cwd: t < 600 ? 'user-home' : 'workspace', showDotfile: true, trace: { kind: 'relative', progress: phase(t, 0, 600) },
          note: { anchor: 'workspace', title: 'Relative paths start where you are', text: 'From your home directory, workspace names the folder directly below it.', command: 'cd workspace' },
        }
        : {
          ...initial, cwd: t < 3500 ? 'workspace' : 'quest', showDotfile: true, trace: { kind: 'absolute', progress: phase(t, 2800, 3500) },
          note: { anchor: 'quest', title: 'Absolute paths start at /', text: 'The leading slash makes the shell start at the root, not at the pwd marker.', command: 'cd /opt/asc_quest' },
        }
    case 'mounts':
      return t < 2800
        ? {
          ...initial, showDotfile: true, mounts: 'local',
          note: { anchor: 'local-disk', title: 'This node has a local root disk', text: 'Here, a local disk backs /. The /tmp folder lives on it too.' },
        }
        : {
          ...initial, showDotfile: true, mounts: 'shared',
          note: { anchor: 'shared-storage', title: 'Same tree, different storage', text: 'In this example, /home and /scratch are mount points for shared filesystems.' },
        }
  }
}
