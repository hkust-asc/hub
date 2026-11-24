import type { Tone } from './glyphs'
import type { ClusterTopicId, ScenarioId, SceneId, TopicId } from './model'

export type CategoryId = 'nodes' | 'interconnect' | 'software' | 'linux' | 'gpu-scaling'
export type LessonId = 'host-to-gpu' | 'ssh-tmux' | 'streams' | 'linux-fs'
export type EntryKind = 'scene' | 'subject' | 'scenario' | 'planned'
export type EvidenceBasis = 'published' | 'illustrative' | 'workshop'

export type EntryTarget =
  | { type: 'scene'; scene: SceneId; clusterTopic?: ClusterTopicId; nodeTopic?: TopicId }
  | { type: 'scenario'; scenario: ScenarioId }
  | { type: 'lesson'; lesson: LessonId }
  | { type: 'planned' }

export interface CategoryDef {
  id: CategoryId
  index: string
  track: 'system' | 'workflow'
  name: string
  shortName: string
  tone: Tone
  glyph: string
  subtitle: string
  thesis: string
}

export interface EntryDef {
  id: string
  title: string
  shortTitle: string
  category: CategoryId
  kind: EntryKind
  tone: Tone
  glyph: string
  question: string
  summary: string
  formatLabel: string
  segments?: number
  evidenceBasis: EvidenceBasis
  evidenceLabel: string
  keywords: string
  target: EntryTarget
  related: readonly string[]
}

export interface TrailItem {
  route: string
  label: string
  glyph: string
  tone: Tone
}

export type ParsedRoute =
  | { view: 'atlas'; mode: 'domains' | 'all' }
  | { view: 'hub'; category: CategoryId }
  | { view: 'workbench'; scene: SceneId; clusterTopic?: ClusterTopicId; nodeTopic?: TopicId; scenario?: ScenarioId }
  | { view: 'lesson'; lesson: LessonId }

export const categories: readonly CategoryDef[] = [
  {
    id: 'nodes',
    index: '01',
    track: 'system',
    name: 'Cluster & Node Families',
    shortName: 'Cluster & Nodes',
    tone: 'blue',
    glyph: 'cat-nodes',
    subtitle: 'Login entry points, CPU families, and GPU node profiles on HPC4',
    thesis: 'HPC4 is a collection of distinct node families rather than one giant shared-memory computer. Login nodes prepare work; scheduled compute nodes execute it under verified hardware profiles.',
  },
  {
    id: 'interconnect',
    index: '02',
    track: 'system',
    name: 'Memory, Bus & Storage',
    shortName: 'Memory, Bus & Storage',
    tone: 'green',
    glyph: 'cat-interconnect',
    subtitle: 'Host DDR5, NUMA locality, PCIe lanes, RoCE fabric, and shared mounts',
    thesis: 'Visibility and proximity are separate properties. Shared storage makes files visible across nodes without loading them into RAM, and intra-node paths depend on socket and PCIe locality.',
  },
  {
    id: 'software',
    index: '03',
    track: 'workflow',
    name: 'Software, Environment & Slurm',
    shortName: 'Software & Slurm',
    tone: 'amber',
    glyph: 'cat-software',
    subtitle: 'Building with Spack, selecting with Lmod, and scheduling batch jobs',
    thesis: 'Installing software, wiring a shell environment, and reserving compute resources are three distinct mechanisms. Neither Lmod nor Slurm sits as a physical hop in your application data path.',
  },
  {
    id: 'linux',
    index: '04',
    track: 'workflow',
    name: 'Linux & Remote Foundations',
    shortName: 'Linux & Remote',
    tone: 'green',
    glyph: 'cat-linux',
    subtitle: 'ASC Week 1 mechanisms underneath paths, streams, SSH, and tmux',
    thesis: 'Commands manipulate concrete OS state: a single mounted directory tree, numbered file-descriptor channels (stdout vs. stderr), and terminal lifetimes that tmux decouples from SSH.',
  },
  {
    id: 'gpu-scaling',
    index: '05',
    track: 'workflow',
    name: 'GPU Execution & Scaling',
    shortName: 'GPU & Scaling',
    tone: 'blue',
    glyph: 'cat-gpu',
    subtitle: 'Device HBM2, explicit host-to-GPU copies, affinity, and multi-GPU limits',
    thesis: 'Allocating GPUs grants permission to use separate processors and HBM pools—it never moves host buffers automatically or guarantees linear speedup as hardware count grows.',
  },
] as const

export const entries: readonly EntryDef[] = [
  // 01. Cluster & Node Families
  {
    id: 'cluster-overview',
    title: 'Cluster overview',
    shortTitle: 'Cluster map',
    category: 'nodes',
    kind: 'scene',
    tone: 'slate',
    glyph: 'cluster',
    question: 'How do login nodes, compute node families, fabric, and storage fit together?',
    summary: 'System-level connectivity schematic separating access, compute families, and shared storage.',
    formatLabel: 'Interactive Scene · 10 subjects',
    segments: 4,
    evidenceBasis: 'published',
    evidenceLabel: 'Published node families · Schematic links',
    keywords: 'hpc4 cluster overview map rack families roce',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'a30' },
    related: ['login-nodes', 'a30-node', 'first-job'],
  },
  {
    id: 'login-nodes',
    title: 'Login nodes',
    shortTitle: 'Login nodes',
    category: 'nodes',
    kind: 'subject',
    tone: 'slate',
    glyph: 'login',
    question: 'Why shouldn’t heavy computation run where SSH lands?',
    summary: 'Shared entry point for editing, environment setup, and job submission—not batch execution.',
    formatLabel: 'Hardware Subject · Cluster scene',
    evidenceBasis: 'published',
    evidenceLabel: 'Published HPC4 access policy',
    keywords: 'ssh login node entry shell head',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'login' },
    related: ['slurm', 'ssh-tmux', 'first-job'],
  },
  {
    id: 'cpu-nodes',
    title: 'CPU compute nodes',
    shortTitle: 'CPU nodes',
    category: 'nodes',
    kind: 'subject',
    tone: 'amber',
    glyph: 'cpu-nodes',
    question: 'How do Intel Xeon and AMD EPYC compute families differ on HPC4?',
    summary: 'Contrasts 128-core Intel (512 GB) and 256-core AMD (768 GB) node families.',
    formatLabel: 'Hardware Profile · Cluster scene',
    evidenceBasis: 'published',
    evidenceLabel: 'Published HPC4 specification',
    keywords: 'cpu compute nodes xeon epyc cores',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'cpu-nodes' },
    related: ['cpu-sockets', 'numa-locality', 'slurm'],
  },
  {
    id: 'a30-node',
    title: 'A30 GPU node cutaway',
    shortTitle: 'A30 cutaway',
    category: 'nodes',
    kind: 'scene',
    tone: 'blue',
    glyph: 'a30',
    question: 'What sits inside a 2-socket, 4-GPU HPC4 compute node?',
    summary: 'Explodable isometric cutaway of Xeon sockets, DDR5 banks, PCIe paths, and four A30 GPUs.',
    formatLabel: 'Interactive Cutaway · 7 parts',
    segments: 5,
    evidenceBasis: 'published',
    evidenceLabel: 'Published A30 counts · Illustrative wiring',
    keywords: 'a30 gpu node cutaway isometric motherboard',
    target: { type: 'scene', scene: 'a30', nodeTopic: 'gpu' },
    related: ['host-to-gpu', 'numa-locality', 'rtx4090d-nodes'],
  },
  {
    id: 'cpu-sockets',
    title: 'CPU sockets',
    shortTitle: 'CPU sockets',
    category: 'nodes',
    kind: 'subject',
    tone: 'amber',
    glyph: 'cpu',
    question: 'What work stays on host CPUs during a GPU workload?',
    summary: 'Dual Xeon Gold 6448Y packages run host code, prepare RAM buffers, and launch kernels.',
    formatLabel: 'Hardware Subject · A30 cutaway',
    evidenceBasis: 'published',
    evidenceLabel: '2 × Xeon Gold 6448Y (Published)',
    keywords: 'cpu sockets xeon host processor cores',
    target: { type: 'scene', scene: 'a30', nodeTopic: 'cpu' },
    related: ['host-memory', 'numa-locality', 'host-to-gpu'],
  },
  {
    id: 'rtx4090d-nodes',
    title: 'RTX 4090D family',
    shortTitle: 'RTX 4090D',
    category: 'nodes',
    kind: 'subject',
    tone: 'blue',
    glyph: 'rtx4090d',
    question: 'Why doesn’t the 4-GPU A30 layout generalize to every GPU node?',
    summary: 'Contrasting 6-GPU GDDR6X node profile (24 GB per GPU, 512 GB DDR5 host memory).',
    formatLabel: 'Hardware Profile · Cluster scene',
    evidenceBasis: 'published',
    evidenceLabel: 'Published HPC4 specification',
    keywords: 'rtx 4090d 6 gpu family profile',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'rtx4090d' },
    related: ['a30-node', 'other-gpu-nodes'],
  },
  {
    id: 'other-gpu-nodes',
    title: 'L20 & RTX 5880 Ada',
    shortTitle: 'L20 / 5880',
    category: 'nodes',
    kind: 'subject',
    tone: 'blue',
    glyph: 'other-gpus',
    question: 'Which HPC4 families provide 48 GB per GPU?',
    summary: 'Overview of 4× L20 and 6× RTX 5880 Ada high-memory GPU node profiles.',
    formatLabel: 'Hardware Profile · Cluster scene',
    evidenceBasis: 'published',
    evidenceLabel: 'Published HPC4 specification',
    keywords: 'l20 rtx 5880 ada 48gb gpu',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'other-gpus' },
    related: ['rtx4090d-nodes', 'a30-node'],
  },
  {
    id: 'rtx4090d-cutaway-planned',
    title: 'RTX 4090D 6-GPU cutaway',
    shortTitle: '4090D scene',
    category: 'nodes',
    kind: 'planned',
    tone: 'blue',
    glyph: 'rtx4090d',
    question: 'How does 6-GPU PCIe topology compare against a 4-GPU A30 server?',
    summary: 'Contrasting second node cutaway planned in DIRECTION.md before extracting shared assets.',
    formatLabel: 'Planned Cutaway Scene',
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Roadmap · Second node profile',
    keywords: 'planned rtx 4090d cutaway topology',
    target: { type: 'planned' },
    related: ['rtx4090d-nodes', 'a30-node'],
  },

  // 02. Memory, Bus & Storage
  {
    id: 'host-memory',
    title: 'Host DDR5 memory',
    shortTitle: 'Host RAM',
    category: 'interconnect',
    kind: 'subject',
    tone: 'green',
    glyph: 'memory',
    question: 'Why can a GPU run out of memory when 500 GB of host RAM is free?',
    summary: '512 GB system RAM pool used by CPU processes, physically separate from GPU HBM2.',
    formatLabel: 'Hardware Subject · A30 cutaway',
    evidenceBasis: 'published',
    evidenceLabel: '512 GB DDR5 (Published)',
    keywords: 'host memory ram ddr5 dimm oom',
    target: { type: 'scene', scene: 'a30', nodeTopic: 'memory' },
    related: ['gpu-device', 'numa-locality', 'host-to-gpu'],
  },
  {
    id: 'pcie-bus',
    title: 'PCI Express path',
    shortTitle: 'PCI Express',
    category: 'interconnect',
    kind: 'subject',
    tone: 'blue',
    glyph: 'pcie',
    question: 'What link carries explicit host-to-device and device-to-host copies?',
    summary: 'Host-to-accelerator I/O interconnect traversed by explicit H2D and D2H transfers.',
    formatLabel: 'Interconnect Subject · A30 cutaway',
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Illustrative PCIe lane route',
    keywords: 'pcie pci express bus h2d d2h copy',
    target: { type: 'scene', scene: 'a30', nodeTopic: 'pcie' },
    related: ['host-to-gpu', 'numa-locality', 'gpu-device'],
  },
  {
    id: 'numa-locality',
    title: 'NUMA & socket locality',
    shortTitle: 'NUMA locality',
    category: 'interconnect',
    kind: 'subject',
    tone: 'amber',
    glyph: 'numa',
    question: 'Why isn’t all host RAM equally close to GPU 0?',
    summary: 'Compares local socket memory paths against cross-socket traversals.',
    formatLabel: 'Concept Subject · Local vs. Remote',
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Illustrative locality zones',
    keywords: 'numa locality socket affinity remote',
    target: { type: 'scene', scene: 'a30', nodeTopic: 'numa' },
    related: ['host-to-gpu', 'cpu-sockets', 'pcie-bus'],
  },
  {
    id: 'roce-fabric',
    title: '200 Gbps RoCE fabric',
    shortTitle: 'RoCE fabric',
    category: 'interconnect',
    kind: 'subject',
    tone: 'slate',
    glyph: 'fabric',
    question: 'How do compute nodes communicate across the cluster?',
    summary: 'Published 200 Gbps RDMA over Converged Ethernet internode connectivity and node NICs.',
    formatLabel: 'Hardware Subject · Cluster & Node',
    evidenceBasis: 'published',
    evidenceLabel: 'Published 200 Gbps RoCE rate',
    keywords: 'roce rdma network fabric nic ethernet mpi',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'fabric' },
    related: ['cluster-overview', 'shared-storage', 'a30-node'],
  },
  {
    id: 'shared-storage',
    title: 'Shared storage policies',
    shortTitle: 'Shared storage',
    category: 'interconnect',
    kind: 'subject',
    tone: 'green',
    glyph: 'storage',
    question: 'How do /home, /project, and /scratch differ in backup and retention?',
    summary: 'Separates visibility across nodes from backup (/home only) and purge policies (/scratch).',
    formatLabel: 'Hardware Subject · Cluster scene',
    evidenceBasis: 'published',
    evidenceLabel: 'Published HPC4 storage policy',
    keywords: 'shared storage home project scratch backup lustre',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'storage' },
    related: ['linux-fs', 'first-job', 'roce-fabric'],
  },
  {
    id: 'scratch-io-planned',
    title: 'Scratch vs. /home I/O behavior',
    shortTitle: 'Storage I/O',
    category: 'interconnect',
    kind: 'planned',
    tone: 'green',
    glyph: 'storage',
    question: 'Why does checkpointing thousands of small files to /home stall jobs?',
    summary: 'Upcoming scenario contrasting metadata contention, retention windows, and staging.',
    formatLabel: 'Planned Scenario',
    evidenceBasis: 'published',
    evidenceLabel: 'Roadmap · Storage workflow',
    keywords: 'planned scratch home io metadata staging',
    target: { type: 'planned' },
    related: ['shared-storage', 'linux-fs'],
  },

  // 03. Software, Environment & Slurm
  {
    id: 'spack',
    title: 'Spack package manager',
    shortTitle: 'Spack',
    category: 'software',
    kind: 'subject',
    tone: 'amber',
    glyph: 'spack',
    question: 'How is building software different from loading it in a job?',
    summary: 'Resolves dependency graphs and produces installed trees; jobs reuse existing builds.',
    formatLabel: 'Software Subject · Cluster scene',
    evidenceBasis: 'published',
    evidenceLabel: 'HPC software stack model',
    keywords: 'spack build package compiler dependency',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'spack' },
    related: ['lmod', 'slurm', 'first-job'],
  },
  {
    id: 'lmod',
    title: 'Lmod environment modules',
    shortTitle: 'Lmod',
    category: 'software',
    kind: 'subject',
    tone: 'green',
    glyph: 'lmod',
    question: 'What does `module load` actually mutate?',
    summary: 'Updates shell variables such as PATH and library search paths to expose an installation.',
    formatLabel: 'Software Subject · Cluster scene',
    evidenceBasis: 'published',
    evidenceLabel: 'Shell environment mechanism',
    keywords: 'lmod module load path environment',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'lmod' },
    related: ['spack', 'slurm', 'first-job'],
  },
  {
    id: 'slurm',
    title: 'Slurm scheduler & allocation',
    shortTitle: 'Slurm',
    category: 'software',
    kind: 'subject',
    tone: 'slate',
    glyph: 'slurm',
    question: 'Does application data travel through Slurm when a job runs?',
    summary: 'Queues batch requests, grants CPU/GPU allocations, and launches processes on compute nodes.',
    formatLabel: 'Software Subject · Cluster & Node',
    evidenceBasis: 'published',
    evidenceLabel: 'Batch scheduling model',
    keywords: 'slurm sbatch srun allocation queue scheduler',
    target: { type: 'scene', scene: 'cluster', clusterTopic: 'slurm' },
    related: ['first-job', 'login-nodes', 'a30-node'],
  },
  {
    id: 'first-job',
    title: 'A job through HPC4',
    shortTitle: 'Job walkthrough',
    category: 'software',
    kind: 'scenario',
    tone: 'amber',
    glyph: 'first-job',
    question: 'Where does a submitted batch job actually execute and write output?',
    summary: 'Connected 10-step journey across login shell, Lmod, Slurm, A30 node cutaway, and /scratch.',
    formatLabel: 'Connected Scenario · 10 steps',
    segments: 10,
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Cross-scene cluster → node walkthrough',
    keywords: 'first job sbatch walkthrough login compute storage',
    target: { type: 'scenario', scenario: 'first-job' },
    related: ['slurm', 'lmod', 'host-to-gpu', 'shared-storage'],
  },
  {
    id: 'module-load-planned',
    title: 'What does module load change?',
    shortTitle: 'module load',
    category: 'software',
    kind: 'planned',
    tone: 'green',
    glyph: 'lmod',
    question: 'Why wasn’t the compiler found before `module load`, and what happens in sbatch?',
    summary: 'Next storyboard slice in AUTHORING.md: before/after shell environment and batch context.',
    formatLabel: 'Planned Timed Scenario · 4 beats',
    segments: 4,
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Next slice in AUTHORING.md',
    keywords: 'planned module load path batch environment',
    target: { type: 'planned' },
    related: ['lmod', 'spack', 'first-job'],
  },
  {
    id: 'containers-planned',
    title: 'Containers & Apptainer',
    shortTitle: 'Apptainer',
    category: 'software',
    kind: 'planned',
    tone: 'slate',
    glyph: 'cat-software',
    question: 'How does an image bring user-space libraries while still binding host GPUs and mounts?',
    summary: 'Upcoming concept comparing user-space filesystem isolation with host driver/mount bindings.',
    formatLabel: 'Planned Concept & Scenario',
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Roadmap · Software environments',
    keywords: 'planned apptainer singularity containers bind gpu',
    target: { type: 'planned' },
    related: ['lmod', 'linux-fs'],
  },

  // 04. Linux & Remote Foundations
  {
    id: 'linux-fs',
    title: 'Linux filesystem',
    shortTitle: 'Linux tree',
    category: 'linux',
    kind: 'scenario',
    tone: 'green',
    glyph: 'linux-fs',
    question: 'How do relative paths, dotfiles, and shared storage fit inside one `/` tree?',
    summary: 'Follows pwd, ls -a, relative vs. absolute resolution, and local vs. shared mount points.',
    formatLabel: 'Timed Scenario · 5 beats · 49s',
    segments: 5,
    evidenceBasis: 'workshop',
    evidenceLabel: 'ASC Week 1 · Quest 1',
    keywords: 'linux filesystem pwd ls cd mount root tree scratch home',
    target: { type: 'lesson', lesson: 'linux-fs' },
    related: ['shared-storage', 'streams', 'ssh-tmux'],
  },
  {
    id: 'streams',
    title: 'Streams & redirection',
    shortTitle: 'stdout & stderr',
    category: 'linux',
    kind: 'scenario',
    tone: 'green',
    glyph: 'streams',
    question: 'Why do error messages still print on screen after `> passcode.txt`?',
    summary: 'Routes port 1 (stdout) and port 2 (stderr) through > and 2> with an interactive prediction beat.',
    formatLabel: 'Timed Scenario · 4 beats · 49s',
    segments: 4,
    evidenceBasis: 'workshop',
    evidenceLabel: 'ASC Week 1 · Quest 2',
    keywords: 'streams redirection stdout stderr 1> 2> noisy_sensor',
    target: { type: 'lesson', lesson: 'streams' },
    related: ['linux-fs', 'ssh-tmux'],
  },
  {
    id: 'ssh-tmux',
    title: 'SSH & tmux',
    shortTitle: 'SSH & tmux',
    category: 'linux',
    kind: 'scenario',
    tone: 'green',
    glyph: 'ssh-tmux',
    question: 'Why does a dropped SSH link stop a plain command, while tmux keeps it running?',
    summary: 'Contrasts losing a foreground SSH shell against detaching and reattaching a tmux session.',
    formatLabel: 'Timed Scenario · 5 beats · 50s',
    segments: 5,
    evidenceBasis: 'workshop',
    evidenceLabel: 'ASC Week 1 · Quest 2',
    keywords: 'ssh tmux detach reattach disconnect session terminal',
    target: { type: 'lesson', lesson: 'ssh-tmux' },
    related: ['login-nodes', 'streams', 'linux-fs'],
  },
  {
    id: 'pipes-planned',
    title: 'Pipes & command pipelines',
    shortTitle: 'Pipes |',
    category: 'linux',
    kind: 'planned',
    tone: 'green',
    glyph: 'streams',
    question: 'How does `|` wire one process’s port 1 directly into the next process’s stdin?',
    summary: 'Upcoming visual sequel to Streams showing streaming backpressure without temp files.',
    formatLabel: 'Planned Timed Scenario',
    evidenceBasis: 'workshop',
    evidenceLabel: 'Roadmap · Shell composition',
    keywords: 'planned pipes stdin grep awk pipeline',
    target: { type: 'planned' },
    related: ['streams', 'linux-fs'],
  },
  {
    id: 'processes-planned',
    title: 'Processes, signals & permissions',
    shortTitle: 'Signals & modes',
    category: 'linux',
    kind: 'planned',
    tone: 'slate',
    glyph: 'cat-linux',
    question: 'What happens underneath `chmod +x`, `SIGINT`, `SIGHUP`, and `SIGTERM`?',
    summary: 'Upcoming ASC foundation lesson connecting executable bits and OS lifecycle signals.',
    formatLabel: 'Planned Timed Scenario',
    evidenceBasis: 'workshop',
    evidenceLabel: 'Roadmap · Linux foundations',
    keywords: 'planned chmod permissions sigint sighup sigterm kill',
    target: { type: 'planned' },
    related: ['ssh-tmux', 'slurm'],
  },

  // 05. GPU Execution & Scaling
  {
    id: 'gpu-device',
    title: 'GPU & HBM2 memory',
    shortTitle: 'GPU & HBM2',
    category: 'gpu-scaling',
    kind: 'subject',
    tone: 'blue',
    glyph: 'gpu',
    question: 'What makes a GPU’s 24 GB HBM2 distinct from host system RAM?',
    summary: 'Parallel accelerator and dedicated device memory pool inside the A30 node cutaway.',
    formatLabel: 'Hardware Subject · A30 cutaway',
    evidenceBasis: 'published',
    evidenceLabel: '4 × A30 · 24 GB HBM2 (Published)',
    keywords: 'gpu hbm2 cuda device memory a30',
    target: { type: 'scene', scene: 'a30', nodeTopic: 'gpu' },
    related: ['host-to-gpu', 'host-memory', 'pcie-bus'],
  },
  {
    id: 'host-to-gpu',
    title: 'Host to GPU',
    shortTitle: 'Host to GPU',
    category: 'gpu-scaling',
    kind: 'scenario',
    tone: 'blue',
    glyph: 'host-to-gpu',
    question: 'Why doesn’t allocating a GPU automatically move your input or return the result?',
    summary: 'Follows Input and Result tokens across DDR5, PCIe, and GPU 0 with Local vs. Cross-socket comparison.',
    formatLabel: 'Timed Scenario · 6 beats · 62s',
    segments: 6,
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Published A30 counts · Illustrative bus',
    keywords: 'host to gpu h2d d2h cuda copy local cross-socket numa',
    target: { type: 'lesson', lesson: 'host-to-gpu' },
    related: ['a30-node', 'numa-locality', 'pcie-bus', 'first-job'],
  },
  {
    id: 'affinity-planned',
    title: 'CPU / GPU pinning & affinity',
    shortTitle: 'Affinity & pinning',
    category: 'gpu-scaling',
    kind: 'planned',
    tone: 'amber',
    glyph: 'numa',
    question: 'How do taskset, numactl, and Slurm binding keep ranks near their assigned GPU?',
    summary: 'Upcoming scenario connecting OS process migration with NUMA/PCIe locality penalties.',
    formatLabel: 'Planned Scenario',
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Roadmap · Placement & binding',
    keywords: 'planned affinity pinning numactl slurm cpu-bind gpu-bind',
    target: { type: 'planned' },
    related: ['numa-locality', 'host-to-gpu'],
  },
  {
    id: 'multi-gpu-planned',
    title: 'Multi-GPU & MPI across nodes',
    shortTitle: 'Multi-GPU / MPI',
    category: 'gpu-scaling',
    kind: 'planned',
    tone: 'blue',
    glyph: 'fabric',
    question: 'What changes when ranks exchange halos across PCIe, NVLink, or 200G RoCE?',
    summary: 'Upcoming multi-rank communication scenario bridging intra-node and inter-node scenes.',
    formatLabel: 'Planned Multi-Scene Scenario',
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Roadmap · Distributed execution',
    keywords: 'planned mpi nccl multi-gpu halo allreduce roce',
    target: { type: 'planned' },
    related: ['roce-fabric', 'host-to-gpu'],
  },
  {
    id: 'scaling-planned',
    title: 'Why more GPUs ≠ linear speedup',
    shortTitle: 'Scaling limits',
    category: 'gpu-scaling',
    kind: 'planned',
    tone: 'amber',
    glyph: 'cat-gpu',
    question: 'When do serial fractions, launch overhead, or communication dominate extra hardware?',
    summary: 'Upcoming scenario illustrating Amdahl, transfer overhead, and strong- vs. weak-scaling knees.',
    formatLabel: 'Planned Scenario',
    evidenceBasis: 'illustrative',
    evidenceLabel: 'Roadmap · Performance reasoning',
    keywords: 'planned scaling amdahl roofline speedup overhead',
    target: { type: 'planned' },
    related: ['host-to-gpu', 'multi-gpu-planned'],
  },
] as const

const categoryMap = new Map(categories.map(category => [category.id, category]))
const entryMap = new Map(entries.map(entry => [entry.id, entry]))
const validLessons = new Set<LessonId>(['host-to-gpu', 'ssh-tmux', 'streams', 'linux-fs'])

export function getCategory(id: CategoryId): CategoryDef {
  return categoryMap.get(id)!
}

export function isCategoryId(value: string | undefined): value is CategoryId {
  return Boolean(value && categoryMap.has(value as CategoryId))
}

export function isLessonId(value: string | undefined): value is LessonId {
  return Boolean(value && validLessons.has(value as LessonId))
}

export function getEntry(id: string): EntryDef | undefined {
  return entryMap.get(id)
}

export function entriesForCategory(category: CategoryId): EntryDef[] {
  return entries.filter(entry => entry.category === category)
}

export function filterEntries(options: {
  query?: string
  kind?: 'all' | 'scene' | 'subject' | 'scenario'
}): EntryDef[] {
  const normalized = (options.query ?? '').trim().toLowerCase()
  const kind = options.kind ?? 'all'
  return entries.filter(entry => {
    if (kind !== 'all') {
      if (kind === 'scenario' && entry.kind !== 'scenario' && !(entry.kind === 'planned' && entry.formatLabel.includes('Scenario'))) return false
      if (kind === 'scene' && entry.kind !== 'scene' && !(entry.kind === 'planned' && entry.formatLabel.includes('Cutaway'))) return false
      if (kind === 'subject' && entry.kind !== 'subject') return false
    }
    if (!normalized) return true
    const haystack = `${entry.title} ${entry.shortTitle} ${entry.question} ${entry.summary} ${entry.keywords} ${entry.evidenceLabel}`.toLowerCase()
    return normalized.split(/\s+/).every(term => haystack.includes(term))
  })
}

export function routeForTarget(target: EntryTarget): string | null {
  switch (target.type) {
    case 'planned':
      return null
    case 'lesson':
      return `#lesson/${target.lesson}`
    case 'scenario':
      return target.scenario === 'gpu-copy' ? '#lesson/host-to-gpu' : `#scenario/${target.scenario}`
    case 'scene':
      if (target.scene === 'a30') {
        return !target.nodeTopic || target.nodeTopic === 'gpu' ? '#a30' : `#a30/${target.nodeTopic}`
      }
      return !target.clusterTopic || target.clusterTopic === 'a30' ? '#cluster' : `#cluster/${target.clusterTopic}`
  }
}

export function normalizeLessonUrl(href: string): string | null {
  const url = new URL(href)
  const raw = url.searchParams.get('lesson')
  if (!raw) return null
  const mapped = raw === 'gpu-copy-sol' ? 'host-to-gpu' : raw
  if (!isLessonId(mapped)) return null
  url.searchParams.delete('lesson')
  url.hash = `#lesson/${mapped}`
  return url.toString()
}

export function parseRoute(hash: string): ParsedRoute {
  const cleaned = hash.replace(/^#/, '').trim()
  if (!cleaned || cleaned === 'atlas') return { view: 'atlas', mode: 'domains' }
  const [head, tail] = cleaned.split('/')
  if (head === 'atlas') {
    if (tail === 'all') return { view: 'atlas', mode: 'all' }
    if (isCategoryId(tail)) return { view: 'hub', category: tail }
    return { view: 'atlas', mode: 'domains' }
  }
  if (head === 'lesson' && isLessonId(tail)) return { view: 'lesson', lesson: tail }
  if (head === 'scenario') {
    if (tail === 'gpu-copy') return { view: 'lesson', lesson: 'host-to-gpu' }
    if (tail === 'first-job') return { view: 'workbench', scene: 'cluster', scenario: 'first-job' }
  }
  if (head === 'a30') {
    return { view: 'workbench', scene: 'a30', nodeTopic: tail as TopicId | undefined }
  }
  if (head === 'cluster') {
    return { view: 'workbench', scene: 'cluster', clusterTopic: tail as ClusterTopicId | undefined }
  }
  return { view: 'atlas', mode: 'domains' }
}

export function activeEntryForState(
  route: ParsedRoute,
  sceneState: { scene: SceneId; mode: 'explore' | 'scenario'; scenario: ScenarioId; selected: TopicId; clusterSelected: ClusterTopicId },
): EntryDef | undefined {
  if (route.view === 'lesson') return entryMap.get(route.lesson)
  if (route.view !== 'workbench') return undefined
  if (sceneState.mode === 'scenario') {
    return sceneState.scenario === 'first-job' ? entryMap.get('first-job') : entryMap.get('host-to-gpu')
  }
  if (sceneState.scene === 'a30') {
    const map: Record<TopicId, string> = {
      gpu: 'a30-node',
      cpu: 'cpu-sockets',
      memory: 'host-memory',
      pcie: 'pcie-bus',
      numa: 'numa-locality',
      nic: 'roce-fabric',
      slurm: 'slurm',
    }
    return entryMap.get(map[sceneState.selected])
  }
  const map: Record<ClusterTopicId, string> = {
    a30: 'cluster-overview',
    login: 'login-nodes',
    'cpu-nodes': 'cpu-nodes',
    rtx4090d: 'rtx4090d-nodes',
    'other-gpus': 'other-gpu-nodes',
    fabric: 'roce-fabric',
    storage: 'shared-storage',
    slurm: 'slurm',
    lmod: 'lmod',
    spack: 'spack',
  }
  return entryMap.get(map[sceneState.clusterSelected])
}

export function trailSnapshotForCurrent(
  route: ParsedRoute,
  currentHash: string,
  sceneState: { scene: SceneId; mode: 'explore' | 'scenario'; scenario: ScenarioId; selected: TopicId; clusterSelected: ClusterTopicId },
): TrailItem {
  if (route.view === 'atlas') {
    return { route: route.mode === 'all' ? '#atlas/all' : '#atlas', label: 'Concept Atlas', glyph: 'cluster', tone: 'slate' }
  }
  if (route.view === 'hub') {
    const cat = getCategory(route.category)
    return { route: `#atlas/${cat.id}`, label: cat.shortName, glyph: cat.glyph, tone: cat.tone }
  }
  const entry = activeEntryForState(route, sceneState)
  if (entry) {
    return { route: currentHash || routeForTarget(entry.target) || '#atlas', label: entry.shortTitle, glyph: entry.glyph, tone: entry.tone }
  }
  return { route: '#atlas', label: 'Concept Atlas', glyph: 'cluster', tone: 'slate' }
}

export function fallbackBackTarget(
  route: ParsedRoute,
  sceneState: { scene: SceneId; mode: 'explore' | 'scenario'; scenario: ScenarioId; selected: TopicId; clusterSelected: ClusterTopicId },
): TrailItem | null {
  if (route.view === 'atlas') return null
  if (route.view === 'hub') {
    return { route: '#atlas', label: 'Concept Atlas', glyph: 'cluster', tone: 'slate' }
  }
  const entry = activeEntryForState(route, sceneState)
  const cat = getCategory(entry?.category ?? 'nodes')
  return { route: `#atlas/${cat.id}`, label: cat.shortName, glyph: cat.glyph, tone: cat.tone }
}

export function pushTrail(stack: readonly TrailItem[], item: TrailItem, destinationRoute: string): TrailItem[] {
  if (item.route === destinationRoute) return [...stack]
  const filtered = stack.at(-1)?.route === item.route ? [...stack] : [...stack, item]
  return filtered.slice(-12)
}

export function popTrail(stack: readonly TrailItem[]): { target: TrailItem | undefined; rest: TrailItem[] } {
  if (stack.length === 0) return { target: undefined, rest: [] }
  return { target: stack.at(-1), rest: stack.slice(0, -1) }
}
