export type TopicId = 'gpu' | 'cpu' | 'memory' | 'pcie' | 'numa' | 'nic' | 'slurm'
export type Placement = 'local' | 'remote'
export type Mode = 'explore' | 'scenario'
export type LinkId = 'memory-local' | 'memory-remote' | 'socket-link' | 'pcie-link' | 'gpu-link'
export type SceneId = 'cluster' | 'a30'
export type ScenarioId = 'gpu-copy' | 'first-job'
export type ClusterTopicId = 'login' | 'cpu-nodes' | 'a30' | 'rtx4090d' | 'other-gpus' | 'fabric' | 'storage' | 'slurm' | 'lmod' | 'spack'

export interface ClusterTopic {
  name: string
  subtitle: string
  kind: 'Hardware' | 'Software' | 'Concept'
  description: string
  takeaway: string
  properties: [string, string][]
  icon: string
  color: string
}

export const clusterTopics: Record<ClusterTopicId, ClusterTopic> = {
  login: {
    name: 'Login nodes', subtitle: 'The entry point, not the execution target', kind: 'Hardware',
    description: 'An SSH connection opens a shell on a login node. This shared entry point is where you prepare files, choose a software environment, and submit jobs.',
    takeaway: 'Submitting a batch job does not move the shell you already have to a compute node.',
    properties: [['Role', 'Access and preparation'], ['Heavy computation', 'Use a scheduled job'], ['Physical inventory', 'Not yet verified']], icon: 'terminal', color: 'network',
  },
  'cpu-nodes': {
    name: 'CPU compute nodes', subtitle: 'Intel and AMD node families', kind: 'Hardware',
    description: 'HPC4 has Intel Xeon Platinum 8592+ and AMD EPYC 9754 CPU-node families. Jobs use resources assigned by Slurm; the families have different processor and memory configurations.',
    takeaway: 'Multiple compute nodes do not automatically behave like one machine with shared memory.',
    properties: [['Intel family', '128 cores / 512 GB'], ['AMD family', '256 cores / 768 GB'], ['Detailed anatomy', 'Not yet modeled']], icon: 'cpu', color: 'cpu',
  },
  a30: {
    name: 'A30 compute nodes', subtitle: 'The first detailed hardware profile', kind: 'Hardware',
    description: 'This node family combines two host CPU sockets with four NVIDIA A30 accelerators. Its detail scene separates host memory, GPU memory, PCIe, and locality.',
    takeaway: 'The cutaway is one representative profile, not a universal description of every HPC4 node.',
    properties: [['Host processors', '2 x Xeon Gold 6448Y'], ['Accelerators', '4 x A30 / 24 GB each'], ['Host memory', '512 GB DDR5']], icon: 'microchip', color: 'gpu',
  },
  rtx4090d: {
    name: 'RTX 4090D compute nodes', subtitle: 'A contrasting GPU-node family', kind: 'Hardware',
    description: 'The published RTX 4090D profile has six GPUs per node rather than four. It appears in this overview, but its internal anatomy and device affinity have not been modeled.',
    takeaway: 'A shared GPU drawing does not imply shared device capabilities, wiring, or memory characteristics.',
    properties: [['Accelerators', '6 x RTX 4090D'], ['Per GPU', '24 GB GDDR6X'], ['Host memory', '512 GB DDR5']], icon: 'microchip', color: 'gpu',
  },
  'other-gpus': {
    name: 'Other GPU families', subtitle: 'NVIDIA L20 and RTX 5880 Ada', kind: 'Hardware',
    description: 'HPC4 also provides L20 and RTX 5880 Ada node profiles. These are grouped in this overview to keep the system map readable, not because they are identical machines.',
    takeaway: 'Choose a verified hardware profile before making assumptions about an application\'s execution path.',
    properties: [['L20 node', '4 GPUs / 48 GB each'], ['RTX 5880 Ada node', '6 GPUs / 48 GB each'], ['Detailed anatomy', 'Not yet modeled']], icon: 'microchip', color: 'gpu',
  },
  fabric: {
    name: 'Internode fabric', subtitle: 'Published 200 Gbps RoCE connectivity', kind: 'Hardware',
    description: 'The official specification describes a 200 Gbps RoCE fabric connecting HPC4 nodes. The shared line in this drawing represents connectivity, not a measured switch or cable layout.',
    takeaway: 'Physical capability does not establish which transport an MPI application actually selects.',
    properties: [['Technology', 'RDMA over Ethernet'], ['Published rate', '200 Gbps'], ['Switch / port graph', 'Not yet verified']], icon: 'network', color: 'network',
  },
  storage: {
    name: 'Shared storage', subtitle: '/home, /project, and /scratch', kind: 'Hardware',
    description: 'HPC4 exposes shared file systems across its nodes. A file being visible from another node does not mean it was automatically copied into that node\'s RAM.',
    takeaway: 'Shared, persistent, and backed up are different properties. HPC4 /project and /scratch are not backed up.',
    properties: [['/home', 'Backed up / 14-day window'], ['/project', 'Shared / no backup'], ['/scratch', 'Temporary / 60-day policy']], icon: 'hard-drive', color: 'memory',
  },
  slurm: {
    name: 'Slurm', subtitle: 'Scheduling and resource allocation', kind: 'Software',
    description: 'A batch submission gives Slurm a job description. Slurm decides when eligible resources can be assigned and starts the job on compute nodes.',
    takeaway: 'Slurm is not a network hop through which application data travels.',
    properties: [['Input', 'Job description'], ['Output', 'Job ID and allocation'], ['Running program', 'On compute resources']], icon: 'calendar-check', color: 'network',
  },
  lmod: {
    name: 'Lmod', subtitle: 'Selecting a software environment', kind: 'Software',
    description: 'Loading a module changes the current shell environment, such as PATH and library search paths, so an installed software version can be found. It is not a software installation.',
    takeaway: 'Login and batch execution are distinct contexts. A job must establish or inherit the environment it needs.',
    properties: [['Changes', 'Shell environment'], ['Selects', 'Installed software'], ['Does not do', 'Install or schedule']], icon: 'list-filter', color: 'memory',
  },
  spack: {
    name: 'Spack', subtitle: 'Building and managing software', kind: 'Software',
    description: 'Spack resolves software dependencies and manages builds and installations. Module files can expose those installations through Lmod. A build is not a necessary step every time a job runs.',
    takeaway: 'Spack installation and Lmod environment selection are related, but different operations.',
    properties: [['Manages', 'Packages and dependencies'], ['Produces', 'Installed software'], ['Job-time role', 'Use an existing installation']], icon: 'package', color: 'cpu',
  },
}

export interface Topic {
  name: string
  eyebrow: string
  subtitle: string
  description: string
  takeaway: string
  properties: [string, string][]
  related: TopicId[]
  icon: string
  color: string
}

export const topics: Record<TopicId, Topic> = {
  gpu: {
    name: 'GPU & device memory',
    eyebrow: '01 / Accelerator',
    subtitle: 'NVIDIA A30',
    description: 'A GPU executes many operations in parallel. Its device memory holds the data used by those operations, separately from the server\'s host RAM.',
    takeaway: 'A GPU allocation does not automatically move your data or make CPU code run on the GPU.',
    properties: [['Per node', '4 GPUs'], ['Per GPU', '24 GB HBM2'], ['Programming platform', 'CUDA']],
    related: ['pcie', 'memory', 'cpu'],
    icon: 'microchip',
    color: 'gpu',
  },
  cpu: {
    name: 'CPU sockets',
    eyebrow: '02 / Host processor',
    subtitle: 'Intel Xeon Gold 6448Y',
    description: 'The host processors run your application, prepare data, and launch GPU work. A socket is one physical processor package, containing many CPU cores.',
    takeaway: 'The CPU still has work to do when your computation runs on a GPU.',
    properties: [['Per node', '2 sockets'], ['Processor', 'Xeon Gold 6448Y'], ['Placement', 'Application / OS policy']],
    related: ['numa', 'memory', 'gpu'],
    icon: 'cpu',
    color: 'cpu',
  },
  memory: {
    name: 'Host memory',
    eyebrow: '03 / System RAM',
    subtitle: '512 GB DDR5 per node',
    description: 'Host RAM stores the data used by CPU processes. In this example, an input buffer begins here before an explicit copy transfers it into GPU memory.',
    takeaway: 'Host RAM and GPU memory are different pools. Free host RAM does not prevent a GPU out-of-memory error.',
    properties: [['Node total', '512 GB DDR5'], ['Shared by', 'CPU processes'], ['GPU memory', 'Separate allocation']],
    related: ['numa', 'gpu', 'pcie'],
    icon: 'memory-stick',
    color: 'memory',
  },
  pcie: {
    name: 'PCI Express',
    eyebrow: '04 / I/O interconnect',
    subtitle: 'The host-to-device path',
    description: 'PCIe connects devices such as GPUs to the host system. For this explicit-copy example, input data crosses a PCIe path from host memory into GPU memory.',
    takeaway: 'Moving data and computing on it are distinct operations. Keeping reusable data on the GPU can avoid repeated transfers.',
    properties: [['H2D', 'Host to device'], ['D2H', 'Device to host'], ['Lane / switch layout', 'Not yet verified']],
    related: ['gpu', 'numa', 'nic'],
    icon: 'route',
    color: 'gpu',
  },
  numa: {
    name: 'NUMA & locality',
    eyebrow: '05 / Placement concept',
    subtitle: 'Not all memory is equally close',
    description: 'NUMA means non-uniform memory access. Where a process runs and where its memory resides can change the path to a device. The example compares a local path with one crossing an inter-socket link.',
    takeaway: 'A socket is not necessarily one NUMA domain. Real domain boundaries and device affinity must be measured on the node.',
    properties: [['Local placement', 'No inter-socket crossing'], ['Remote placement', 'Crosses socket link'], ['Performance difference', 'Workload-dependent']],
    related: ['cpu', 'memory', 'pcie'],
    icon: 'git-compare-arrows',
    color: 'cpu',
  },
  nic: {
    name: 'Network interface',
    eyebrow: '06 / Beyond the node',
    subtitle: 'Connection to the cluster fabric',
    description: 'A network interface connects a compute node to other systems. HPC4\'s published specification describes a 200 Gbps RoCE internode fabric, supporting RDMA over Ethernet.',
    takeaway: 'An installed network capability does not prove that an application uses RDMA or a particular data path.',
    properties: [['Published fabric', '200 Gbps RoCE'], ['Role', 'Inter-node communication'], ['NIC / port wiring', 'Not yet verified']],
    related: ['pcie', 'cpu', 'gpu'],
    icon: 'network',
    color: 'network',
  },
  slurm: {
    name: 'Slurm allocation',
    eyebrow: '07 / Resource management',
    subtitle: 'Permission to use resources',
    description: 'Slurm schedules a job and allocates resources such as CPUs and GPUs. It does not turn your program into a GPU program or carry your application data through the cluster.',
    takeaway: 'An allocation describes what your job may use. The application determines what it actually does with it.',
    properties: [['Schedules', 'Jobs'], ['Allocates', 'CPU / GPU resources'], ['Program execution', 'Application-controlled']],
    related: ['cpu', 'gpu', 'memory'],
    icon: 'calendar-check',
    color: 'network',
  },
}

export interface GpuLesson {
  host: string
  device: string
  focus: readonly ('host' | 'device')[]
  transfer: 'h2d' | 'd2h' | null
  allocated: boolean
  computing: boolean
}

export const stages = [
  {
    label: 'Allocate',
    title: 'A job receives its resources.',
    description: 'Slurm grants this example job access to GPU 0 and CPU resources. The other GPUs are not part of this example allocation.',
    topic: 'slurm',
    location: 'Slurm allocation',
    holdMs: 7000,
    visual: { host: 'No input prepared', device: 'No input copied', focus: ['device'], transfer: null, allocated: true, computing: false },
  },
  {
    label: 'Prepare',
    title: 'The input starts in host memory.',
    description: 'The CPU prepares an input buffer in host RAM. The placement control chooses a local or cross-socket arrangement for this illustrative example.',
    topic: 'memory',
    location: 'Host RAM',
    holdMs: 7500,
    visual: { host: 'Input ready', device: 'No input copied', focus: ['host'], transfer: null, allocated: true, computing: false },
  },
  {
    label: 'Copy in',
    title: 'Input crosses into GPU memory.',
    description: 'An explicit host-to-device (H2D) copy puts the input in GPU memory. The host input remains. Cross-socket placement adds a crossing to this illustrative PCIe route.',
    topic: 'pcie',
    location: 'Host to device / H2D',
    holdMs: 10000,
    visual: { host: 'Input retained', device: 'Input copy ready', focus: ['host', 'device'], transfer: 'h2d', allocated: true, computing: false },
  },
  {
    label: 'Compute',
    title: 'A CUDA kernel runs on the GPU.',
    description: 'The GPU operates on data already in device memory. No host-to-device transfer is shown during this deliberately simple, non-overlapped compute step.',
    topic: 'gpu',
    location: 'GPU 0 / device memory',
    holdMs: 9000,
    visual: { host: 'Input retained', device: 'Result ready', focus: ['device'], transfer: null, allocated: true, computing: true },
  },
  {
    label: 'Copy out',
    title: 'The result returns to the host.',
    description: 'A device-to-host (D2H) copy makes the result available in host RAM. The GPU result remains until the application releases its device buffer.',
    topic: 'pcie',
    location: 'Device to host / D2H',
    holdMs: 8500,
    visual: { host: 'Result ready', device: 'Result retained', focus: ['host', 'device'], transfer: 'd2h', allocated: true, computing: false },
  },
  {
    label: 'Finish',
    title: 'The job releases its allocation.',
    description: 'The result reached host RAM in the previous step. When the program exits, its buffers and allocation are released. Saving a file is outside this example.',
    topic: 'slurm',
    location: 'Program exited',
    holdMs: 9000,
    visual: { host: 'Buffer released', device: 'Buffer released', focus: [], transfer: null, allocated: false, computing: false },
  },
] as const satisfies readonly Omit<ScenarioStep, 'scene' | 'clusterTopic'>[]

export interface ScenarioStep {
  label: string
  title: string
  description: string
  topic: TopicId
  location: string
  scene: SceneId
  clusterTopic: ClusterTopicId
  holdMs: number
  visual?: GpuLesson
  nodeStep?: number
  command?: string
}

export const gpuSteps: readonly ScenarioStep[] = stages.map((stage, nodeStep) => ({ ...stage, scene: 'a30', clusterTopic: 'a30', nodeStep }))

export const jobSteps: readonly ScenarioStep[] = [
  { label: 'Connect', title: 'Your shell starts on a login node.', description: 'SSH gives you a shell on the shared login system. The scientific computation will run somewhere else, after a compute allocation is granted.', topic: 'cpu', location: 'Login shell', scene: 'cluster', clusterTopic: 'login', holdMs: 8500, command: 'ssh <username>@hpc4.ust.hk' },
  { label: 'Environment', title: 'Select software, not a different machine.', description: 'Lmod makes an existing software installation available to a shell. Spack may have built that installation earlier. The batch script must establish or inherit the environment it needs.', topic: 'cpu', location: 'Shell environment', scene: 'cluster', clusterTopic: 'lmod', holdMs: 11000, command: 'module load <installed-module>' },
  { label: 'Submit', title: 'Send a job description to Slurm.', description: 'The batch script describes resources and commands. sbatch returns a job ID; your existing terminal remains on the login node. Waiting is compressed in this educational scenario.', topic: 'slurm', location: 'Submitted / pending', scene: 'cluster', clusterTopic: 'slurm', holdMs: 11000, command: 'sbatch gpu-job.sh' },
  { label: 'Allocate', title: 'Eligible compute resources are assigned.', description: 'This example job receives access to GPU 0 on an A30 node and host CPU resources. This is a logical allocation, not a physical data route through the scheduler.', topic: 'slurm', location: 'A30 node / allocation', scene: 'cluster', clusterTopic: 'a30', holdMs: 10000 },
  ...gpuSteps.slice(1, 5),
  { label: 'Save', title: 'The program writes its result to shared storage.', description: 'After the D2H copy, the result is in host RAM. The program now writes a file to a chosen shared path. Storage-network wiring and file-transfer timing are not modeled.', topic: 'memory', location: 'Shared output file', scene: 'cluster', clusterTopic: 'storage', holdMs: 10000 },
  { label: 'Release', title: 'The batch job ends; the file remains.', description: 'Slurm releases the allocation when the job exits. The output file remains subject to its storage location\'s retention and backup policy. The original login shell was never moved to the compute node.', topic: 'slurm', location: 'Completed / resources released', scene: 'cluster', clusterTopic: 'storage', holdMs: 11000, command: 'sacct -j <jobid>' },
]

export const scenarios = {
  'gpu-copy': { name: 'Host to GPU', question: 'Where does GPU input travel?', steps: gpuSteps },
  'first-job': { name: 'A job through HPC4', question: 'Where does a batch job actually run?', steps: jobSteps },
} as const

export interface AppState {
  mode: Mode
  selected: TopicId
  scene: SceneId
  clusterSelected: ClusterTopicId
  scenario: ScenarioId
  step: number
  placement: Placement
  exploded: boolean
  playing: boolean
  inspecting: boolean
}

export type Action =
  | { type: 'select'; topic: TopicId }
  | { type: 'mode'; mode: Mode }
  | { type: 'navigate'; scene: SceneId }
  | { type: 'browse'; scene: 'cluster'; topic?: ClusterTopicId }
  | { type: 'browse'; scene: 'a30'; topic?: TopicId }
  | { type: 'cluster-select'; topic: ClusterTopicId }
  | { type: 'start-scenario'; scenario: ScenarioId }
  | { type: 'step'; step: number }
  | { type: 'placement'; placement: Placement }
  | { type: 'explode' }
  | { type: 'play' }
  | { type: 'tick' }
  | { type: 'return-to-lesson' }
  | { type: 'reset-view' }
  | { type: 'reset' }

export const initialState: AppState = {
  mode: 'explore',
  selected: 'gpu',
  scene: 'cluster',
  clusterSelected: 'a30',
  scenario: 'gpu-copy',
  step: 0,
  placement: 'local',
  exploded: false,
  playing: false,
  inspecting: false,
}

function atStep(state: AppState, step: number): AppState {
  const scenarioSteps = scenarios[state.scenario].steps
  const boundedStep = Math.max(0, Math.min(scenarioSteps.length - 1, step))
  const activeStep = scenarioSteps[boundedStep]!
  return { ...state, step: boundedStep, selected: activeStep.topic, scene: activeStep.scene, clusterSelected: activeStep.clusterTopic, inspecting: false }
}

export function updateState(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.topic, playing: false, inspecting: state.mode === 'scenario' }
    case 'navigate':
      return { ...state, scene: action.scene, mode: 'explore', playing: false, inspecting: false }
    case 'browse':
      return action.scene === 'cluster'
        ? { ...state, scene: 'cluster', clusterSelected: action.topic ?? 'a30', mode: 'explore', playing: false, inspecting: false }
        : { ...state, scene: 'a30', selected: action.topic ?? state.selected, mode: 'explore', playing: false, inspecting: false }
    case 'cluster-select':
      return { ...state, clusterSelected: action.topic, playing: false, inspecting: state.mode === 'scenario' }
    case 'start-scenario':
      return atStep({ ...state, scenario: action.scenario, mode: 'scenario', playing: false }, 0)
    case 'mode':
      return action.mode === 'scenario'
        ? atStep({ ...state, mode: action.mode, playing: false }, state.step)
        : { ...state, mode: action.mode, playing: false, inspecting: false }
    case 'step':
      return atStep({ ...state, mode: 'scenario', playing: false }, action.step)
    case 'placement':
      return { ...state, placement: action.placement, playing: false }
    case 'return-to-lesson':
      return atStep({ ...state, mode: 'scenario', playing: false }, state.step)
    case 'explode':
      return { ...state, exploded: !state.exploded }
    case 'play':
      if (state.playing) return { ...state, playing: false }
      return atStep({ ...state, mode: 'scenario', playing: true }, state.step === scenarios[state.scenario].steps.length - 1 ? 0 : state.step)
    case 'tick':
      if (!state.playing) return state
      if (state.step === scenarios[state.scenario].steps.length - 1) return { ...state, playing: false }
      return atStep(state, state.step + 1)
    case 'reset-view':
      return { ...state, placement: 'local', exploded: false }
    case 'reset':
      return state.mode === 'scenario'
        ? atStep({ ...initialState, mode: 'scenario', scenario: state.scenario }, 0)
        : { ...initialState, scene: state.scene }
  }
}

export function transferPath(step: number, placement: Placement): LinkId[] {
  const direction = stages[step]?.visual.transfer
  if (!direction) return []
  const path: LinkId[] = placement === 'local'
    ? ['memory-local', 'pcie-link', 'gpu-link']
    : ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link']
  return direction === 'd2h' ? path.toReversed() : path
}

export const evidence = {
  profile: 'HPC4 / A30 GPU node',
  hardwareSource: 'https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4',
  storageSource: 'https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4/fileandstorage',
  handbook: 'https://hkust-hpc-docs.readthedocs.io/latest/',
  verified: '2026-10-19',
  published: ['2 Intel Xeon Gold 6448Y sockets', '4 NVIDIA A30 GPUs, 24 GB HBM2 each', '512 GB DDR5 host memory', '200 Gbps RoCE internode fabric'],
  illustrative: ['Cluster-family glyphs and connectivity, not an inventory or switch graph', 'Storage-network wiring and file-transfer timing are not modeled', 'Component positions and memory-module counts', 'GPU / CPU / NIC affinity and PCIe wiring', 'Two socket-locality regions, not measured NUMA domains', 'Transfer timing and animated markers'],
}