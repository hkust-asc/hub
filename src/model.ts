export type TopicId = 'gpu' | 'cpu' | 'memory' | 'pcie' | 'numa' | 'nic' | 'slurm'
export type Placement = 'local' | 'remote'
export type Mode = 'explore' | 'scenario'
export type LinkId = 'memory-local' | 'memory-remote' | 'socket-link' | 'pcie-link' | 'gpu-link'

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

export const stages = [
  {
    label: 'Allocate',
    title: 'A job receives its resources.',
    description: 'Slurm grants this example job access to GPU 0 and CPU resources. The other GPUs are not part of this example allocation.',
    topic: 'slurm',
    location: 'Slurm allocation',
  },
  {
    label: 'Prepare',
    title: 'The input starts in host memory.',
    description: 'The CPU prepares an input buffer in host RAM. The placement control chooses a local or cross-socket arrangement for this illustrative example.',
    topic: 'memory',
    location: 'Host RAM',
  },
  {
    label: 'Copy in',
    title: 'Input crosses into GPU memory.',
    description: 'An explicit host-to-device (H2D) copy transfers the buffer over the PCIe path. Remote placement adds an inter-socket crossing in this schematic.',
    topic: 'pcie',
    location: 'Host to device / H2D',
  },
  {
    label: 'Compute',
    title: 'A CUDA kernel runs on the GPU.',
    description: 'The GPU operates on data already in device memory. No host-to-device transfer is shown during this deliberately simple, non-overlapped compute step.',
    topic: 'gpu',
    location: 'GPU 0 / device memory',
  },
  {
    label: 'Copy out',
    title: 'The result returns to the host.',
    description: 'A device-to-host (D2H) copy brings the result back over the same illustrative path, in the opposite direction.',
    topic: 'pcie',
    location: 'Device to host / D2H',
  },
  {
    label: 'Finish',
    title: 'The job releases its allocation.',
    description: 'The result is now in host memory. The program exits and Slurm releases its resources. Writing results to shared storage is outside this example.',
    topic: 'slurm',
    location: 'Result in host RAM',
  },
] as const

export interface AppState {
  mode: Mode
  selected: TopicId
  step: number
  placement: Placement
  exploded: boolean
  playing: boolean
}

export type Action =
  | { type: 'select'; topic: TopicId }
  | { type: 'mode'; mode: Mode }
  | { type: 'step'; step: number }
  | { type: 'placement'; placement: Placement }
  | { type: 'explode' }
  | { type: 'play' }
  | { type: 'tick' }
  | { type: 'reset' }

export const initialState: AppState = {
  mode: 'explore',
  selected: 'gpu',
  step: 0,
  placement: 'local',
  exploded: false,
  playing: false,
}

function atStep(state: AppState, step: number): AppState {
  const boundedStep = Math.max(0, Math.min(stages.length - 1, step))
  return { ...state, step: boundedStep, selected: stages[boundedStep]!.topic }
}

export function updateState(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.topic, playing: false }
    case 'mode':
      return action.mode === 'scenario'
        ? atStep({ ...state, mode: action.mode, playing: false }, state.step)
        : { ...state, mode: action.mode, playing: false }
    case 'step':
      return atStep({ ...state, mode: 'scenario', playing: false }, action.step)
    case 'placement':
      return { ...state, placement: action.placement }
    case 'explode':
      return { ...state, exploded: !state.exploded }
    case 'play':
      if (state.playing) return { ...state, playing: false }
      return atStep({ ...state, mode: 'scenario', playing: true }, state.step === stages.length - 1 ? 0 : state.step)
    case 'tick':
      if (!state.playing) return state
      if (state.step === stages.length - 1) return { ...state, playing: false }
      return atStep(state, state.step + 1)
    case 'reset':
      return { ...initialState, mode: state.mode, selected: state.mode === 'scenario' ? 'slurm' : 'gpu' }
  }
}

export function transferPath(step: number, placement: Placement): LinkId[] {
  if (step !== 2 && step !== 4) return []
  const path: LinkId[] = placement === 'local'
    ? ['memory-local', 'pcie-link', 'gpu-link']
    : ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link']
  return step === 4 ? path.toReversed() : path
}

export const evidence = {
  profile: 'HPC4 / A30 GPU node',
  hardwareSource: 'https://itso.hkust.edu.hk/services/academic-teaching-support/high-performance-computing/hpc4',
  handbook: 'https://hkust-hpc-docs.readthedocs.io/latest/',
  verified: '2026-10-15',
  published: ['2 Intel Xeon Gold 6448Y sockets', '4 NVIDIA A30 GPUs, 24 GB HBM2 each', '512 GB DDR5 host memory', '200 Gbps RoCE internode fabric'],
  illustrative: ['Component positions and memory-module counts', 'GPU / CPU / NIC affinity and PCIe wiring', 'Two socket-locality regions, not measured NUMA domains', 'Transfer timing and animated markers'],
}