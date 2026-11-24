import type { Placement } from '../model.ts'
import { createTimeline, phase } from '../timed-lesson/timeline.ts'

export const timeline = createTimeline([
  { id: 'allocate', label: 'Allocate', durationMs: 4000 },
  { id: 'prepare', label: 'Prepare', durationMs: 4500 },
  { id: 'copy-in', label: 'Copy in', durationMs: 7000 },
  { id: 'compute', label: 'Compute', durationMs: 5000 },
  { id: 'copy-out', label: 'Copy out', durationMs: 6500 },
  { id: 'finish', label: 'Finish', durationMs: 4000 },
] as const)

export type Anchor = 'gpu' | 'ram' | 'cpu' | 'pcie-link' | 'socket-link'
type Part = Extract<Anchor, 'gpu' | 'ram' | 'cpu'>
type Buffer = 'Input' | 'Result' | null

interface GpuFrame {
  note: { anchor: Anchor; title: string; text: string }
  focus: readonly Part[]
  host: Buffer
  device: Buffer
  copy: { direction: 'h2d' | 'd2h'; progress: number | null } | null
  signal: { kind: 'prepare' | 'launch'; progress: number } | null
  allocated: boolean
  lift: number
  tokenOpacity: number
  kernel: boolean
}

export function frameAt(elapsedMs: number, placement: Placement): GpuFrame {
  const { beat, withinBeat: t } = timeline.beatAt(elapsedMs)
  const idle = { host: null, device: null, copy: null, signal: null, allocated: true, lift: 0, tokenOpacity: 1, kernel: false }
  switch (beat.id) {
    case 'allocate':
      return {
        ...idle, focus: ['gpu', 'cpu'], lift: t < 600 ? 6 * Math.sin(Math.PI * t / 600) : 0,
        note: { anchor: 'gpu', title: 'Slurm allocates GPU 0', text: 'Your job gets CPU cores and one GPU. Allocation does not copy data.' },
      }
    case 'prepare':
      return {
        ...idle, focus: ['cpu', 'ram'], host: t >= 1100 ? 'Input' : null,
        signal: t < 1100 ? { kind: 'prepare', progress: phase(t, 0, 1100) } : null,
        note: { anchor: 'ram', title: 'The CPU prepares the input', text: 'Input starts in host RAM. It is not in GPU memory yet.' },
      }
    case 'copy-in':
    case 'copy-out': {
      const intoGpu = beat.id === 'copy-in'
      const crossSocket = placement === 'remote'
      const arrival = crossSocket ? 3300 : 2500
      const arrived = t >= arrival
      return {
        ...idle, focus: ['ram', 'gpu'],
        host: intoGpu || !arrived ? 'Input' : 'Result',
        device: intoGpu ? (arrived ? 'Input' : null) : 'Result',
        copy: { direction: intoGpu ? 'h2d' : 'd2h', progress: t >= 300 && !arrived ? phase(t, 300, arrival) : null },
        note: arrived
          ? intoGpu
            ? { anchor: 'gpu', title: 'Now there are two copies', text: 'GPU memory has its own input. The original is still in host RAM.' }
            : { anchor: 'ram', title: 'The CPU can read the result', text: 'The result is now in host RAM. GPU memory retains its copy.' }
          : crossSocket
            ? {
              anchor: 'socket-link', title: intoGpu ? 'Input takes an extra hop' : 'Return across sockets',
              text: intoGpu ? 'Input crosses to the GPU’s socket before going over PCIe.' : 'PCIe first, then the inter-socket link to host RAM.',
            }
            : {
              anchor: 'pcie-link', title: intoGpu ? 'Copy input across PCIe' : 'Copy the result across PCIe',
              text: intoGpu ? 'An explicit host-to-device copy puts input in GPU memory.' : 'The device-to-host copy brings the result back to RAM.',
            },
      }
    }
    case 'compute':
      return {
        ...idle, focus: t < 900 ? ['cpu', 'gpu'] : ['gpu'], host: 'Input', device: t < 3200 ? 'Input' : 'Result',
        signal: t < 900 ? { kind: 'launch', progress: phase(t, 0, 900) } : null,
        kernel: t >= 900 && t < 3200,
        note: t < 900
          ? { anchor: 'cpu', title: 'The CPU launches a kernel', text: 'The host asks GPU 0 to run the CUDA kernel.' }
          : { anchor: 'gpu', title: 'GPU 0 computes the result', text: 'The kernel leaves its result in GPU memory. Host RAM still holds the input.' },
      }
    case 'finish':
      return {
        ...idle, focus: [], host: t < 1300 ? 'Result' : null, device: t < 1300 ? 'Result' : null,
        tokenOpacity: 1 - phase(t, 300, 1300), allocated: t < 1300,
        note: { anchor: 'gpu', title: 'The job releases GPU 0', text: 'The program exits and its buffers are freed.' },
      }
  }
}
