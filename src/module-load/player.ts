import { computeSchematicLayouts } from '../schematic/layout.ts'
import { createSchematicScene } from '../schematic/renderer.ts'
import type { SchematicFrame, SchematicSceneSpec } from '../schematic/types.ts'
import type { LessonOptions } from '../timed-lesson/player'
import { frameAt, moduleMotion, moduleNodes, moduleWires, timeline } from './story.ts'
import type { ModulePart, ModuleWire } from './story.ts'

const layouts = await computeSchematicLayouts(moduleNodes, moduleWires)

function renderSchematicFrame(elapsedMs: number, compact: boolean): SchematicFrame<ModulePart, ModuleWire> {
  const s = frameAt(elapsedMs)
  const activeSet = new Set(s.activeWires)
  const isBatch = s.context === 'gpu01'
  const loaded = s.loadedModule !== null

  return {
    nodes: {
      login: {
        dimmed: isBatch,
        emphasis: !isBatch && (s.beatId === 'missing' || s.beatId === 'resolve'),
        tone: s.commandNotFound ? 'coral' : s.resolvedExecutable && !isBatch ? 'mint' : 'blue',
        badge: isBatch ? 'sbatch' : 'active',
        rows: s.beatId === 'missing'
          ? [
            { kind: 'code', text: '$ nvcc --version' },
            {
              kind: 'code',
              text: s.commandNotFound
                ? (compact ? 'nvcc: not found' : 'bash: nvcc: not found')
                : 'Searching PATH…',
              tone: s.commandNotFound ? 'coral' : 'muted',
            },
          ]
          : s.beatId === 'load'
            ? [
              { kind: 'code', text: compact ? '$ ml cuda/12.8' : '$ module load cuda/12.8' },
              {
                kind: 'code',
                text: loaded ? (compact ? 'Env wired · 0 B' : 'Env wired · 0 B copied') : 'Reading modulefile…',
                tone: loaded ? 'mint' : 'muted',
              },
            ]
            : s.beatId === 'resolve'
              ? [
                { kind: 'code', text: '$ nvcc --version' },
                {
                  kind: 'code',
                  text: s.resolvedExecutable
                    ? (compact ? 'CUDA tools V12.8' : 'Cuda tools, release 12.8')
                    : 'Checking PATH[0]…',
                  tone: s.resolvedExecutable ? 'mint' : 'muted',
                },
              ]
              : [
                { kind: 'code', text: '$ sbatch job.sh' },
                { kind: 'code', text: compact ? 'Job 14082 -> gpu01' : 'Submitted job 14082', tone: 'muted' },
              ],
      },

      batch: {
        dimmed: !isBatch,
        emphasis: isBatch,
        tone: s.batchStatus === 'running' ? 'mint' : isBatch ? 'amber' : 'neutral',
        badge: !isBatch ? 'idle' : s.batchStatus === 'running' ? 'running' : 'gpu01',
        rows: !isBatch
          ? [
            { kind: 'code', text: compact ? '# separate shell' : '# runs on compute node', tone: 'muted' },
            { kind: 'code', text: 'Not submitted yet', tone: 'muted' },
          ]
          : [
            {
              kind: 'code',
              text: compact ? 'ml purge && ml cuda/12.8' : 'module load cuda/12.8',
              tone: s.batchStatus === 'starting' ? 'amber' : 'mint',
            },
            {
              kind: 'code',
              text: s.batchStatus === 'running'
                ? (compact ? './sim_gpu (V12.8)' : './sim_gpu  # uses 12.8')
                : 'Preparing batch env…',
              tone: s.batchStatus === 'running' ? 'mint' : 'muted',
            },
          ],
      },

      lmod: {
        emphasis: activeSet.has('login-lmod') || activeSet.has('batch-lmod') || s.note.anchor === 'lmod',
        tone: 'mint',
        badge: loaded ? '1 loaded' : 'avail',
        rows: [
          {
            kind: 'pill',
            label: 'cuda/11.8',
            meta: 'avail',
            tone: s.note.anchor === 'lmod' && s.beatId === 'resolve' ? 'amber' : 'muted',
            dashed: s.note.anchor === 'lmod' && s.beatId === 'resolve',
          },
          {
            kind: 'pill',
            label: 'cuda/12.8',
            meta: loaded ? 'loaded' : 'default',
            tone: loaded ? 'mint' : 'neutral',
            selected: loaded || activeSet.has('login-lmod') || activeSet.has('batch-lmod'),
          },
          {
            kind: 'code',
            text: compact ? 'Edits shell vars' : 'Lua recipe · edits vars',
            tone: 'muted',
          },
        ],
      },

      env: {
        emphasis: activeSet.has('lmod-env') || s.note.anchor === 'env',
        tone: loaded ? 'mint' : isBatch ? 'amber' : 'blue',
        badge: s.context,
        rows: loaded
          ? [
            {
              kind: 'kv',
              key: 'PATH',
              value: compact ? 'cuda-12.8/bin:/usr/bin' : '.../cuda-12.8/bin:/usr/bin',
              tone: 'mint',
              highlight: activeSet.has('lmod-env') || activeSet.has('env-spack'),
            },
            {
              kind: 'kv',
              key: 'CUDA_HOME',
              value: compact ? '/opt/.../cuda-12.8' : '/opt/spack/cuda-12.8',
              tone: 'mint',
              highlight: activeSet.has('lmod-env'),
            },
            {
              kind: 'kv',
              key: compact ? 'CMAKE' : 'CMAKE_PREFIX',
              value: compact ? '.../cuda-12.8' : '/opt/spack/cuda-12.8',
              tone: 'mint',
            },
          ]
          : [
            {
              kind: 'kv',
              key: 'PATH',
              value: '/usr/bin',
              tone: s.commandNotFound ? 'coral' : 'neutral',
            },
            {
              kind: 'kv',
              key: 'CUDA_HOME',
              value: '(unset)',
              tone: 'muted',
            },
            {
              kind: 'kv',
              key: 'MODULES',
              value: isBatch ? '(clean shell)' : '(none)',
              tone: 'muted',
            },
          ],
      },

      os: {
        dimmed: loaded,
        emphasis: s.commandNotFound,
        tone: s.commandNotFound ? 'coral' : 'neutral',
        badge: s.commandNotFound ? 'miss' : undefined,
        rows: [
          { kind: 'code', text: 'bash, ls, ssh', tone: 'muted' },
          {
            kind: 'code',
            text: s.commandNotFound ? 'nvcc: not here' : 'Base OS tools only',
            tone: s.commandNotFound ? 'coral' : 'muted',
          },
        ],
      },

      spack: {
        emphasis: s.resolvedExecutable || s.note.anchor === 'spack',
        tone: s.resolvedExecutable ? 'mint' : 'blue',
        badge: s.resolvedExecutable ? 'hit' : 'shared',
        rows: [
          {
            kind: 'pill',
            label: compact ? 'cuda-11.8/bin' : 'cuda-11.8/bin/nvcc',
            meta: 'ready',
            tone: 'muted',
          },
          {
            kind: 'pill',
            label: compact ? 'cuda-12.8/bin' : 'cuda-12.8/bin/nvcc',
            meta: s.resolvedExecutable ? 'hit' : 'ready',
            tone: s.resolvedExecutable ? 'mint' : 'blue',
            selected: s.resolvedExecutable,
          },
          {
            kind: 'code',
            text: compact ? 'Read-only builds' : 'Pre-built · untouched',
            tone: 'muted',
          },
        ],
      },
    },

    wires: {
      'login-lmod': { visible: activeSet.has('login-lmod'), active: true, tone: 'mint' },
      'batch-lmod': { visible: activeSet.has('batch-lmod'), active: true, tone: 'amber' },
      'lmod-env': { visible: activeSet.has('lmod-env'), active: true, tone: 'mint' },
      'login-env': {
        visible: activeSet.has('login-env'),
        active: true,
        tone: s.beatId === 'missing' ? 'amber' : 'mint',
      },
      'batch-env': { visible: activeSet.has('batch-env'), active: true, tone: 'mint' },
      'env-os': {
        visible: activeSet.has('env-os'),
        active: true,
        dashed: s.commandNotFound,
        tone: 'coral',
      },
      'env-spack': { visible: activeSet.has('env-spack'), active: true, tone: 'mint' },
    },

    note: s.note,
  }
}

const sceneSpec: SchematicSceneSpec<ModulePart, ModuleWire> = {
  id: 'lmod',
  svgTitle: 'How Lmod rewires shell environments to Spack software builds',
  svgDesc: 'Follow PATH and CUDA_HOME as module load exposes pre-installed Spack packages in login and Slurm batch shells.',
  nodes: moduleNodes,
  wires: moduleWires,
  motion: moduleMotion,
  frameAt: renderSchematicFrame,
}

export const lesson: LessonOptions = {
  title: 'Environment modules',
  subtitle: 'What module load changes in your shell',
  diagramLabel: 'Interactive Lmod environment and Spack prefix schematic',
  timeline,
  footer: '<p>Tier 2 Spack / Lmod stack · illustrative paths</p><a href="https://hkust-hpc-docs.readthedocs.io/latest/sysadmin/software-ecosystem/scientific-software-stack.html" target="_blank" rel="noopener noreferrer">HKUST scientific software stack</a>',
  createScene: stage => createSchematicScene(stage, sceneSpec, layouts),
}
