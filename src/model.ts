export type TopicId = 'gpu' | 'cpu' | 'memory' | 'pcie' | 'numa' | 'nic' | 'slurm'
export type Placement = 'local' | 'remote'
export type LinkId = 'memory-local' | 'memory-remote' | 'socket-link' | 'pcie-link' | 'gpu-link'
export type SceneId = 'cluster' | 'a30'
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

export interface AppState {
  selected: TopicId
  scene: SceneId
  clusterSelected: ClusterTopicId
  placement: Placement
  exploded: boolean
}

export type Action =
  | { type: 'select'; topic: TopicId }
  | { type: 'navigate'; scene: SceneId }
  | { type: 'browse'; scene: 'cluster'; topic?: ClusterTopicId }
  | { type: 'browse'; scene: 'a30'; topic?: TopicId }
  | { type: 'cluster-select'; topic: ClusterTopicId }
  | { type: 'placement'; placement: Placement }
  | { type: 'explode' }
  | { type: 'reset-view' }
  | { type: 'reset' }

export const initialState: AppState = {
  selected: 'gpu',
  scene: 'cluster',
  clusterSelected: 'a30',
  placement: 'local',
  exploded: false,
}

export function updateState(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.topic }
    case 'navigate':
      return { ...state, scene: action.scene }
    case 'browse':
      return action.scene === 'cluster'
        ? { ...state, scene: 'cluster', clusterSelected: action.topic ?? 'a30' }
        : { ...state, scene: 'a30', selected: action.topic ?? state.selected }
    case 'cluster-select':
      return { ...state, clusterSelected: action.topic }
    case 'placement':
      return { ...state, placement: action.placement }
    case 'explode':
      return { ...state, exploded: !state.exploded }
    case 'reset-view':
      return { ...state, placement: 'local', exploded: false }
    case 'reset':
      return { ...initialState, scene: state.scene }
  }
}

export function transferPath(step: number, placement: Placement): LinkId[] {
  return step === 2 || step === 4 ? copyPath(step === 2 ? 'h2d' : 'd2h', placement) : []
}

export function copyPath(direction: 'h2d' | 'd2h', placement: Placement): LinkId[] {
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