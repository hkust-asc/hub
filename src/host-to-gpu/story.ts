import type { Placement } from '../model.ts'
import type { ViewBoxRect } from '../stage/layout.ts'
import type { StageStepDef, StageStepNarrative } from '../stage/types.ts'

export const gpuSteps: readonly StageStepDef[] = [
  { id: 'allocate', label: 'Allocate', beatDurationMs: 900 },
  { id: 'prepare', label: 'Prepare', beatDurationMs: 1200 },
  { id: 'copy-in', label: 'Copy in', beatDurationMs: 1550 },
  { id: 'compute', label: 'Compute', beatDurationMs: 1450 },
  { id: 'copy-out', label: 'Copy out', beatDurationMs: 1500 },
  { id: 'finish', label: 'Finish', beatDurationMs: 1000 },
]

export type GpuFocusPart = 'gpu' | 'ram' | 'cpu'
export type BufferState = 'Input' | 'Result' | null

export interface GpuStepFrame extends StageStepNarrative {
  readonly focus: readonly GpuFocusPart[]
  readonly host: BufferState
  readonly device: BufferState
  readonly copy: { readonly direction: 'h2d' | 'd2h'; readonly progress: number | null } | null
  readonly signal: { readonly kind: 'prepare' | 'launch'; readonly progress: number } | null
  readonly allocated: boolean
  readonly lift: number
  readonly tokenOpacity: number
  readonly kernel: boolean
  readonly viewBox?: ViewBoxRect
}

const localZoom: ViewBoxRect = { x: 242, y: 184, w: 520, h: 325 }
const remoteZoom: ViewBoxRect = { x: 175, y: 140, w: 585, h: 365 }

export function evaluateGpuStep(
  stepIndex: number,
  beatProgress: number,
  placement: Placement,
): GpuStepFrame {
  const p = Math.max(0, Math.min(1, beatProgress))
  const crossSocket = placement === 'remote'
  const activeZoom = crossSocket ? remoteZoom : localZoom
  const idle = {
    host: null as BufferState,
    device: null as BufferState,
    copy: null,
    signal: null,
    allocated: true,
    lift: 0,
    tokenOpacity: 1,
    kernel: false,
  }

  switch (stepIndex) {
    case 0:
      return {
        ...idle,
        focus: ['gpu', 'cpu'],
        lift: p < 0.7 ? 5 * Math.sin((Math.PI * p) / 0.7) : 0,
        title: 'Slurm allocates GPU 0 and host CPUs',
        body: 'Requesting --gpus=1 reserves GPU 0 and host CPU cores on this 4-GPU A30 node while GPUs 1–3 stay free. Allocation grants access—it does not move data.',
        panel: {
          label: 'Slurm allocation',
          command: '#SBATCH --gpus-per-node=1',
          lines: [
            { text: `Host placement: ${crossSocket ? 'Socket 0 (cross-socket to GPU 0)' : 'Socket 1 (local to GPU 0)'}`, tone: crossSocket ? 'amber' : 'green' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Reserved GPU 0 (24 GB HBM2); GPUs 1–3 dimmed outside allocation' },
          { kind: 'change', text: 'Both Host RAM and GPU 0 HBM2 start empty' },
        ],
        hud: [
          { label: 'Host RAM', value: 'empty', tone: 'neutral' },
          { label: 'GPU 0 HBM2', value: 'empty', tone: 'neutral' },
          { label: 'Placement', value: crossSocket ? 'Cross-socket' : 'Local socket', tone: crossSocket ? 'warn' : 'good' },
        ],
      }

    case 1: {
      const ready = p >= 0.55
      return {
        ...idle,
        viewBox: activeZoom,
        focus: ['cpu', 'ram'],
        host: ready ? 'Input' : null,
        signal: !ready ? { kind: 'prepare', progress: p / 0.55 } : null,
        title: 'The CPU prepares input in host RAM',
        body: 'Your host code allocates and fills an input buffer in DDR5 system RAM. Even though GPU 0 is allocated, its 24 GB HBM2 device memory still has nothing in it.',
        panel: {
          label: 'Host preparation',
          command: 'float *h_in = malloc(bytes); init(h_in);',
          lines: [
            { text: `Buffer resides in ${crossSocket ? 'Socket 0 DDR5' : 'Socket 1 DDR5'}`, tone: 'amber' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Input buffer initialized in Host DDR5 RAM' },
          { kind: 'change', text: 'GPU 0 HBM2 remains empty until an explicit copy runs' },
        ],
        hud: [
          { label: 'Host RAM', value: ready ? 'Input' : 'preparing…', tone: 'warn' },
          { label: 'GPU 0 HBM2', value: 'empty', tone: 'neutral' },
          { label: 'PCIe bus', value: 'idle', tone: 'neutral' },
        ],
      }
    }

    case 2: {
      const arrival = crossSocket ? 0.84 : 0.68
      const arrived = p >= arrival
      return {
        ...idle,
        viewBox: activeZoom,
        focus: ['ram', 'gpu'],
        host: 'Input',
        device: arrived ? 'Input' : null,
        copy: {
          direction: 'h2d',
          progress: p >= 0.08 && !arrived ? (p - 0.08) / (arrival - 0.08) : null,
        },
        title: crossSocket && !arrived
          ? 'Cross-socket H2D takes an extra inter-socket hop'
          : arrived
            ? 'Two separate Input copies now exist'
            : 'Explicit H2D copy crosses PCIe into GPU 0',
        body: crossSocket
          ? 'Because the buffer sits in Socket 0 RAM, data first traverses the inter-socket link to Socket 1 before crossing PCIe into GPU 0 HBM2. Host RAM retains its original copy.'
          : 'cudaMemcpyHostToDevice copies the buffer across PCIe into GPU 0’s HBM2 memory. Copying duplicates the bytes—the original Input buffer remains in Host RAM.',
        panel: {
          label: 'Host-to-device copy (H2D)',
          command: 'cudaMemcpy(d_in, h_in, bytes, cudaMemcpyHostToDevice);',
          lines: [
            { text: crossSocket ? 'Route: RAM 0 -> Socket link -> PCIe -> GPU 0' : 'Route: RAM 1 -> PCIe -> GPU 0 (no socket crossing)', tone: crossSocket ? 'amber' : 'green' },
          ],
        },
        changes: [
          { kind: 'add', text: 'GPU 0 HBM2 receives its own Input buffer copy' },
          { kind: 'change', text: 'Host DDR5 RAM retains the original Input buffer' },
          ...(crossSocket ? [{ kind: 'change' as const, text: 'Cross-socket placement adds an inter-socket NUMA hop' }] : []),
        ],
        hud: [
          { label: 'Host RAM', value: 'Input', tone: 'neutral' },
          { label: 'GPU 0 HBM2', value: arrived ? 'Input' : 'copying H2D…', tone: arrived ? 'good' : 'warn' },
          { label: 'Bus route', value: crossSocket ? 'NUMA + PCIe' : 'Local PCIe', tone: crossSocket ? 'warn' : 'good' },
        ],
      }
    }

    case 3: {
      const launched = p >= 0.28
      const computed = p >= 0.76
      return {
        ...idle,
        viewBox: localZoom,
        focus: !launched ? ['cpu', 'gpu'] : ['gpu'],
        host: 'Input',
        device: computed ? 'Result' : 'Input',
        signal: !launched ? { kind: 'launch', progress: p / 0.28 } : null,
        kernel: launched && !computed,
        title: 'GPU 0 computes on HBM2; Host RAM still holds old Input',
        body: 'The CPU launches a CUDA kernel that reads and writes inside GPU 0’s high-bandwidth HBM2. Until you copy back, the host CPU cannot read Result from Host RAM.',
        panel: {
          label: 'CUDA kernel execution',
          command: 'solve_kernel<<<grid, block>>>(d_in, d_out);',
          lines: [
            { text: 'PCIe bus stays idle during non-overlapped kernel compute', tone: 'blue' },
          ],
        },
        changes: [
          { kind: 'change', text: 'GPU 0 transforms device Input into Result inside HBM2' },
          { kind: 'change', text: 'Host RAM still holds stale Input (no automatic sync)' },
        ],
        hud: [
          { label: 'Host RAM', value: 'Input (stale)', tone: 'warn' },
          { label: 'GPU 0 HBM2', value: computed ? 'Result' : 'computing…', tone: 'good' },
          { label: 'PCIe bus', value: 'idle (0 B)', tone: 'good' },
        ],
      }
    }

    case 4: {
      const arrival = crossSocket ? 0.84 : 0.68
      const arrived = p >= arrival
      return {
        ...idle,
        viewBox: activeZoom,
        focus: ['gpu', 'ram'],
        host: arrived ? 'Result' : 'Input',
        device: 'Result',
        copy: {
          direction: 'd2h',
          progress: p >= 0.08 && !arrived ? (p - 0.08) / (arrival - 0.08) : null,
        },
        title: crossSocket && !arrived
          ? 'Return copy traverses PCIe then the inter-socket link'
          : 'Explicit D2H copy brings Result back to Host RAM',
        body: 'cudaMemcpyDeviceToHost transfers Result back over the reverse PCIe path into Host DDR5 RAM so CPU code can inspect, print, or save it to /scratch.',
        panel: {
          label: 'Device-to-host copy (D2H)',
          command: 'cudaMemcpy(h_out, d_out, bytes, cudaMemcpyDeviceToHost);',
          lines: [
            { text: crossSocket ? 'Reverse route: GPU 0 -> PCIe -> Socket link -> RAM 0' : 'Reverse route: GPU 0 -> PCIe -> RAM 1', tone: 'green' },
          ],
        },
        changes: [
          { kind: 'add', text: 'Host DDR5 RAM now holds Result so CPU code can read it' },
          { kind: 'change', text: 'GPU 0 HBM2 still retains its Result copy until freed' },
        ],
        hud: [
          { label: 'Host RAM', value: arrived ? 'Result' : 'copying D2H…', tone: arrived ? 'good' : 'warn' },
          { label: 'GPU 0 HBM2', value: 'Result', tone: 'good' },
          { label: 'Bus route', value: crossSocket ? 'PCIe + NUMA' : 'Local PCIe', tone: crossSocket ? 'warn' : 'good' },
        ],
      }
    }

    default: {
      const freed = p >= 0.55
      return {
        ...idle,
        focus: [],
        host: freed ? null : 'Result',
        device: freed ? null : 'Result',
        tokenOpacity: 1 - Math.min(1, p / 0.55),
        allocated: !freed,
        title: 'Free buffers and release the GPU allocation',
        body: 'cudaFree and free release device and host buffers before the process exits and Slurm returns GPU 0 to the cluster pool.',
        panel: {
          label: 'Cleanup & release',
          command: 'cudaFree(d_in); cudaFree(d_out); free(h_out);',
          lines: [
            { text: 'GPU 0 released when job exits', tone: 'muted' },
          ],
        },
        changes: [
          { kind: 'remove', text: 'Device HBM2 and Host DDR5 buffers freed' },
          { kind: 'remove', text: 'Slurm releases GPU 0 allocation' },
        ],
        hud: [
          { label: 'Host RAM', value: freed ? 'freed' : 'releasing…', tone: 'neutral' },
          { label: 'GPU 0 HBM2', value: freed ? 'freed' : 'releasing…', tone: 'neutral' },
          { label: 'Allocation', value: freed ? 'released' : 'closing…', tone: 'good' },
        ],
      }
    }
  }
}

