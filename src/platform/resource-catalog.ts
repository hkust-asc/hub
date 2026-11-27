import { evidence } from '../model.ts'
import { weeks } from './curriculum.ts'

interface ResourceLink {
  label: string
  href: string
  format: 'recording' | 'summary' | 'slides' | 'reference'
}

export interface ResourceEntry {
  title: string
  source: string
  use: string
  topics?: readonly string[]
  links: readonly ResourceLink[]
}

export interface WorkshopResource extends ResourceEntry {
  id: string
  date?: string
  weekId?: string
}

const weekOne = weeks.find(week => week.id === 'asc01')!
const slurmCourse = 'https://www.archer2.ac.uk/training/courses/230726-slurm-vt/'
const gpuCourse = 'https://www.archer2.ac.uk/training/courses/261006-gpu-openmp/'
const mpiCourse = 'https://www.archer2.ac.uk/training/courses/220323-mpi/'
const weekOneSlides = `${weekOne.source}/blob/main/slides/week1-slides.md`

export const workshopResources: readonly WorkshopResource[] = [
  {
    id: 'asc01', weekId: weekOne.id, date: '2026-11-18',
    title: weekOne.title, source: 'HKUST ASC',
    use: 'Revisit shell navigation, output redirection, tmux, and the branch-to-PR workflow before starting the quests.',
    topics: ['SSH', 'command line'],
    links: [
      { label: 'Session outline', href: `${weekOneSlides}#todays-roadmap-90-mins`, format: 'summary' },
      { label: 'Slides (Markdown)', href: weekOneSlides, format: 'slides' },
      { label: 'Workshop repo', href: weekOne.source, format: 'reference' },
    ],
  },
  {
    id: 'slurm-2023', date: '2023-07-26',
    title: 'Slurm job scheduling', source: 'ARCHER2 training',
    use: 'See what happens after you submit a batch job. The examples use ARCHER2, not HPC4.',
    topics: ['sbatch', 'job submission', 'queues'],
    links: [
      { label: 'Recording', href: 'https://www.youtube.com/watch?v=p5t1vXPdi5A', format: 'recording' },
      { label: 'Session overview', href: slurmCourse, format: 'summary' },
      { label: 'Slides (PDF)', href: `${slurmCourse}Slurm-Job-Submission-2023-07-26.pdf`, format: 'slides' },
    ],
  },
  {
    id: 'gpu-openmp-2026', date: '2026-10-06',
    title: 'GPU programming using OpenMP', source: 'ARCHER2 training',
    use: 'Learn to move computation and data to a GPU with OpenMP directives and check whether offloading helps.',
    topics: ['offload', 'OpenACC', 'HIP', 'performance tuning'],
    links: [
      { label: 'Recordings', href: `${gpuCourse}#videos`, format: 'recording' },
      { label: 'Course outline', href: `${gpuCourse}#timetable`, format: 'summary' },
      { label: 'Slides & exercises', href: 'https://github.com/EPCCed/archer2-GPU-directives/tree/2026-10-06', format: 'slides' },
    ],
  },
  {
    id: 'mpi-2022', date: '2022-03-23',
    title: 'Message-passing programming with MPI', source: 'ARCHER2 training',
    use: 'Practice sending messages between processes before writing your first multi-node parallel program.',
    topics: ['parallel computing', 'collectives', 'non-blocking communication'],
    links: [
      { label: 'Recordings', href: `${mpiCourse}#videos`, format: 'recording' },
      { label: 'Course outline', href: `${mpiCourse}#timetable`, format: 'summary' },
      { label: 'Exercises & notes', href: 'https://github.com/EPCCed/archer2-MPI-2022-03-23', format: 'reference' },
    ],
  },
]

export const resourceSetup: ResourceEntry = {
  title: 'HPC4 access & setup', source: 'HKUST ITSO',
  use: 'Check how to request access, connect, and find the cluster documentation.',
  links: [
    { label: 'HPC4 user guide', href: evidence.handbook, format: 'reference' },
    { label: 'HPC4 service page', href: evidence.hardwareSource, format: 'reference' },
  ],
}

export const resourceReferences: readonly ResourceEntry[] = [
  {
    title: 'Linux knowledge base', source: 'HKUST ITSO',
    use: 'Look up Linux commands, shell concepts, and working with files.',
    links: [{ label: 'Linux guides', href: 'https://hkust-hpc-docs.readthedocs.io/latest/kb/linux/index.html', format: 'reference' }],
  },
  {
    title: 'Git and GitHub knowledge base', source: 'HKUST ITSO',
    use: 'Check how to work with Git and open a pull request.',
    links: [{ label: 'Git and GitHub guides', href: 'https://hkust-hpc-docs.readthedocs.io/latest/kb/git/index.html', format: 'reference' }],
  },
  {
    title: 'Slurm sbatch manual', source: 'SchedMD',
    use: 'Look up a batch script option, time limit, or output setting.',
    links: [{ label: 'Command reference', href: 'https://slurm.schedmd.com/sbatch.html', format: 'reference' }],
  },
  {
    title: 'ASC27 curriculum', source: 'HKUST ASC',
    use: 'Check the workshop roadmap or find a slide deck when planning a session.',
    links: [{ label: 'Curriculum site', href: 'https://hkust-asc.github.io/asc27-curriculum/', format: 'reference' }],
  },
]

export function getWorkshopResource(id: string) {
  return workshopResources.find(workshop => workshop.id === id)
}

export function resourcesRoute(workshop?: string) {
  return workshop ? `#resources/${workshop}` : '#resources'
}
