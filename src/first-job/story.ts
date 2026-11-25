import { createTimeline, phase } from '../timed-lesson/timeline.ts'

export const timeline = createTimeline([
  { id: 'submit', label: 'Submit', durationMs: 5500 },
  { id: 'allocate', label: 'Allocate', durationMs: 5500 },
  { id: 'modules', label: 'Modules', durationMs: 5500 },
  { id: 'execute', label: 'Execute', durationMs: 6000 },
  { id: 'finish', label: 'Finish', durationMs: 5000 },
] as const)

export type JobPart = 'login' | 'slurm' | 'compute' | 'env' | 'gpu' | 'home' | 'scratch'
export type JobWire = 'submit' | 'allocate' | 'script-read' | 'scratch-write' | 'scratch-read'
export type SlurmStatus = 'idle' | 'pending' | 'running' | 'completed'
export type LoginActivity = 'editing' | 'submitted' | 'checking' | 'free' | 'reading'
export type EnvStatus = 'absent' | 'starting' | 'loaded' | 'closed'
export type GpuSliceStatus = 'free' | 'allocated' | 'running' | 'done' | 'released'

export interface JobFrame {
  login: {
    shellOpen: true
    activity: LoginActivity
    widePrompt: string
    wideOutput: string
    compactPrompt: string
    compactOutput: string
  }
  slurm: {
    status: SlurmStatus
    badge: string
    wideSummary: string
    compactSummary: string
  }
  compute: {
    allocated: boolean
    released: boolean
  }
  env: {
    status: EnvStatus
    badge: string
    wideDetail: string
    compactDetail: string
  }
  gpu: {
    status: GpuSliceStatus
    progress: number
  }
  scratchOutput: boolean
  activeWire: JobWire | null
  packet: { wire: JobWire; badge: string; progress: number } | null
  note: {
    anchor: JobPart
    title: string
    text: string
    command?: string
  }
}

const idleEnv: JobFrame['env'] = {
  status: 'absent',
  badge: 'Inactive',
  wideDetail: 'No batch shell running',
  compactDetail: 'No batch shell',
}

export function frameAt(elapsedMs: number): JobFrame {
  const { beat, withinBeat: t } = timeline.beatAt(elapsedMs)

  switch (beat.id) {
    case 'submit': {
      if (t < 2300) {
        return {
          login: {
            shellOpen: true,
            activity: 'editing',
            widePrompt: '[user@login01 ~]$ ls',
            wideOutput: 'job.sh   train.py',
            compactPrompt: '[login01]$ ls',
            compactOutput: 'job.sh  train.py',
          },
          slurm: {
            status: 'idle',
            badge: 'IDLE',
            wideSummary: 'Queue ready',
            compactSummary: 'Queue ready',
          },
          compute: { allocated: false, released: false },
          env: idleEnv,
          gpu: { status: 'free', progress: 0 },
          scratchOutput: false,
          activeWire: null,
          packet: null,
          note: {
            anchor: 'login',
            title: 'SSH lands on login01',
            text: 'Prepare job.sh in /home and submit work here. Heavy compute belongs on scheduled nodes.',
            command: 'ssh <user>@hpc4.ust.hk',
          },
        }
      }
      const queued = t >= 3600
      return {
        login: {
          shellOpen: true,
          activity: 'submitted',
          widePrompt: queued ? '[user@login01 ~]$' : '$ sbatch job.sh',
          wideOutput: queued ? 'Submitted job 1405015' : 'Sending job request…',
          compactPrompt: queued ? '[login01]$' : '$ sbatch job.sh',
          compactOutput: queued ? 'Job 1405015' : 'Sending…',
        },
        slurm: queued
          ? {
            status: 'pending',
            badge: 'PD',
            wideSummary: '1405015 · gpu-a30 · 1 GPU',
            compactSummary: '1405015 · 1 GPU',
          }
          : {
            status: 'idle',
            badge: 'IDLE',
            wideSummary: 'Receiving request…',
            compactSummary: 'Receiving…',
          },
        compute: { allocated: false, released: false },
        env: idleEnv,
        gpu: { status: 'free', progress: 0 },
        scratchOutput: false,
        activeWire: 'submit',
        packet: queued ? null : { wire: 'submit', badge: 'sbatch', progress: phase(t, 2300, 3600) },
        note: queued
          ? {
            anchor: 'login',
            title: 'Your shell stays on login01',
            text: 'sbatch returns Job 1405015 immediately. Your login terminal never moves to a compute node.',
            command: 'sbatch job.sh',
          }
          : {
            anchor: 'slurm',
            title: 'sbatch sends a job request',
            text: 'The script asks Slurm for partition gpu-a30, CPU cores, and 1 GPU.',
            command: 'sbatch job.sh',
          },
      }
    }

    case 'allocate': {
      if (t < 2200) {
        return {
          login: {
            shellOpen: true,
            activity: 'checking',
            widePrompt: '$ squeue --me',
            wideOutput: '1405015  gpu-a30  PD',
            compactPrompt: '$ squeue --me',
            compactOutput: '1405015  PD',
          },
          slurm: {
            status: 'pending',
            badge: 'PD',
            wideSummary: '1405015 · waiting for 1× A30',
            compactSummary: '1405015 · PD',
          },
          compute: { allocated: false, released: false },
          env: idleEnv,
          gpu: { status: 'free', progress: 0 },
          scratchOutput: false,
          activeWire: null,
          packet: null,
          note: {
            anchor: 'slurm',
            title: 'Queued as pending (PD)',
            text: 'Slurm holds the job until an eligible node in gpu-a30 has free resources.',
            command: 'squeue --me',
          },
        }
      }
      const arrived = t >= 3400
      return {
        login: {
          shellOpen: true,
          activity: 'free',
          widePrompt: '[user@login01 ~]$',
          wideOutput: arrived ? '1405015  R  gpu01' : 'Scheduling 1405015…',
          compactPrompt: '[login01]$',
          compactOutput: arrived ? '1405015 R gpu01' : 'Scheduling…',
        },
        slurm: {
          status: 'running',
          badge: 'R · gpu01',
          wideSummary: '1405015 → gpu01 (1/4 A30)',
          compactSummary: '1405015 → gpu01',
        },
        compute: { allocated: arrived, released: false },
        env: arrived
          ? {
            status: 'starting',
            badge: 'Starting',
            wideDetail: 'Fresh shell spawned',
            compactDetail: 'Fresh shell',
          }
          : idleEnv,
        gpu: { status: arrived ? 'allocated' : 'free', progress: 0 },
        scratchOutput: false,
        activeWire: 'allocate',
        packet: arrived ? null : { wire: 'allocate', badge: 'ALLOC', progress: phase(t, 2200, 3400) },
        note: {
          anchor: arrived ? 'gpu' : 'slurm',
          title: 'Slurm allocates 1 of 4 GPUs',
          text: 'Job 1405015 gets CPU cores and A30 #0 on gpu01. GPUs 1–3 stay available for other jobs.',
          command: '#SBATCH --gpus-per-node=1',
        },
      }
    }

    case 'modules': {
      const readDone = t >= 1350
      const loaded = t >= 2600
      return {
        login: {
          shellOpen: true,
          activity: 'free',
          widePrompt: '[user@login01 ~]$',
          wideOutput: 'Prompt free on login01',
          compactPrompt: '[login01]$',
          compactOutput: 'Prompt stays',
        },
        slurm: {
          status: 'running',
          badge: 'R · gpu01',
          wideSummary: '1405015 → gpu01 (1/4 A30)',
          compactSummary: '1405015 → gpu01',
        },
        compute: { allocated: true, released: false },
        env: loaded
          ? {
            status: 'loaded',
            badge: 'Lmod ready',
            wideDetail: 'PATH += Spack python/3.13.2',
            compactDetail: 'PATH += python',
          }
          : {
            status: 'starting',
            badge: 'Starting',
            wideDetail: 'Fresh shell · default PATH',
            compactDetail: 'Default PATH',
          },
        gpu: { status: 'allocated', progress: 0 },
        scratchOutput: false,
        activeWire: loaded ? null : 'script-read',
        packet: !readDone ? { wire: 'script-read', badge: 'job.sh', progress: phase(t, 150, 1350) } : null,
        note: loaded
          ? {
            anchor: 'env',
            title: 'module load wires PATH',
            text: 'Inside job.sh, Lmod points this batch shell at installed Spack software before launching code.',
            command: 'module load python/3.13.2',
          }
          : {
            anchor: 'env',
            title: 'A fresh batch shell starts',
            text: 'gpu01 reads job.sh from shared /home in a new shell, separate from your login session.',
          },
      }
    }

    case 'execute': {
      const writing = t >= 2800
      const runProgress = writing
        ? 0.65 + 0.35 * phase(t, 2800, 4600)
        : 0.65 * phase(t, 0, 2800)
      const written = t >= 4700
      return {
        login: {
          shellOpen: true,
          activity: 'free',
          widePrompt: '[user@login01 ~]$',
          wideOutput: 'Idle (safe to log out)',
          compactPrompt: '[login01]$',
          compactOutput: 'Idle on login',
        },
        slurm: {
          status: 'running',
          badge: 'R · gpu01',
          wideSummary: 'Control only · no data I/O',
          compactSummary: 'No app data I/O',
        },
        compute: { allocated: true, released: false },
        env: {
          status: 'loaded',
          badge: 'Lmod ready',
          wideDetail: runProgress >= 1 ? 'train.py finished' : 'Running python train.py',
          compactDetail: runProgress >= 1 ? 'Done train.py' : 'python train.py',
        },
        gpu: {
          status: runProgress >= 1 ? 'done' : 'running',
          progress: runProgress,
        },
        scratchOutput: written,
        activeWire: writing ? 'scratch-write' : null,
        packet: t >= 3050 && !written
          ? { wire: 'scratch-write', badge: 'result.pt', progress: phase(t, 3050, 4700) }
          : null,
        note: writing
          ? {
            anchor: 'scratch',
            title: 'Write output straight to /scratch',
            text: 'gpu01 writes output directly to shared /scratch—high-speed job storage with a 60-day purge.',
            command: '#SBATCH -o /scratch/%u/slurm-%j.out',
          }
          : {
            anchor: 'gpu',
            title: 'Code runs on gpu01, not Slurm',
            text: 'train.py executes on gpu01’s allocated CPUs and A30 #0. Application data never crosses Slurm.',
            command: 'python train.py',
          },
      }
    }

    case 'finish': {
      const freed = t >= 650
      const reading = t >= 2100
      const readArrived = t >= 3250
      return {
        login: reading
          ? {
            shellOpen: true,
            activity: 'reading',
            widePrompt: '$ cat slurm-1405015.out',
            wideOutput: readArrived ? 'Saved result.pt (gpu01)' : 'Reading shared /scratch…',
            compactPrompt: '$ cat slurm.out',
            compactOutput: readArrived ? 'Saved result.pt' : 'Reading…',
          }
          : {
            shellOpen: true,
            activity: 'free',
            widePrompt: '[user@login01 ~]$',
            wideOutput: freed ? 'Job 1405015 completed' : 'Completing 1405015…',
            compactPrompt: '[login01]$',
            compactOutput: freed ? '1405015 done' : 'Completing…',
          },
        slurm: freed
          ? {
            status: 'completed',
            badge: 'CD · DONE',
            wideSummary: '1405015 done · gpu01 freed',
            compactSummary: 'gpu01 freed',
          }
          : {
            status: 'running',
            badge: 'R · gpu01',
            wideSummary: 'Releasing gpu01…',
            compactSummary: 'Releasing…',
          },
        compute: { allocated: !freed, released: freed },
        env: freed
          ? {
            status: 'closed',
            badge: 'Exited (0)',
            wideDetail: 'Batch shell closed',
            compactDetail: 'Shell closed',
          }
          : {
            status: 'loaded',
            badge: 'Lmod ready',
            wideDetail: 'Exiting job.sh…',
            compactDetail: 'Exiting…',
          },
        gpu: {
          status: freed ? 'released' : 'done',
          progress: freed ? 0 : 1,
        },
        scratchOutput: true,
        activeWire: reading ? 'scratch-read' : null,
        packet: reading && !readArrived
          ? { wire: 'scratch-read', badge: '.out', progress: phase(t, 2100, 3250) }
          : null,
        note: reading
          ? {
            anchor: 'login',
            title: 'Read output from login01',
            text: 'Because login01 mounts the same /scratch and /home, your output is already visible here.',
            command: 'cat /scratch/<user>/slurm-1405015.out',
          }
          : {
            anchor: 'compute',
            title: 'Allocation ends; files remain',
            text: 'When job.sh exits, Slurm frees gpu01 for the next job. Shared storage keeps your files.',
            command: 'sacct -j 1405015',
          },
      }
    }
  }
}
