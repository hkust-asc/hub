import type { LessonId } from '../catalog.ts'

// A mission can rehearse a skill used in several scenarios without owning those lessons.
export const missionLessons: Record<number, readonly LessonId[]> = {
  1: ['linux-fs'],
  2: ['linux-fs'],
  3: ['streams'],
  4: ['module-load'],
  5: ['ssh-tmux', 'first-job'],
  6: ['first-job'],
}

export interface FieldQuest {
  id: string
  title: string
  detail: string
  example: string
  anchor: string
}

export interface WorkshopWeek {
  id: string
  title: string
  description: string
  source: string
  lessons: LessonId[]
  missions: number[]
  concepts: string[]
  quests: FieldQuest[]
}

export interface PracticeGroup {
  id: string
  eyebrow: string
  title: string
  subtitle: string
  weekId?: string
  tone: 'blue' | 'green' | 'amber' | 'slate'
  missions: readonly number[]
}

export const practiceGroups: readonly PracticeGroup[] = [
  {
    id: 'week-1',
    eyebrow: 'Week 1',
    title: 'Linux basics & remote shell',
    subtitle: 'Filesystem paths, permissions, streams, PATH lookup, login-node processes, and command safety.',
    weekId: 'asc01',
    tone: 'green',
    missions: [1, 2, 3, 4, 5, 6],
  },
]

export const weeks: readonly WorkshopWeek[] = [{
  id: 'asc01', title: 'Week 01: Linux basics & Git',
  description: 'Trace a path, separate output, and leave a job running after disconnecting. Then use those skills on the class training server.',
  source: 'https://github.com/hkust-asc/ws26-01-linux-git',
  lessons: ['linux-fs', 'streams', 'ssh-tmux'], missions: [1, 2, 3, 4],
  concepts: ['filesystem', 'paths', 'standard-streams', 'bashrc', 'login-nodes'],
  quests: [
    { id: 'connect', title: 'Connect and explore', anchor: 'quest-1-connect-and-explore',
      detail: 'Use the class account and verify the host fingerprint against the brief. Work in your home directory and use ranger to explore the quest files.',
      example: 'mkdir -p ~/workspace' },
    { id: 'collect', title: 'Redirect output and use tmux', anchor: 'quest-2-redirect-output-and-use-tmux',
      detail: 'Collect the sensor result and diagnostics separately. Run the long simulation inside tmux, detach, reattach, then inspect its result.',
      example: 'tmux attach -t sim' },
    { id: 'submit', title: 'Submit a profile', anchor: 'quest-3-submit-a-profile',
      detail: 'Create your own submission branch and folder. Check git status before committing, then open a profile PR following the workshop rules. Do not include a student ID or legal full name.',
      example: 'git status' },
    { id: 'report', title: 'Bonus: report a bug', anchor: 'quest-4-bonus-bug-report',
      detail: 'Inspect the supplied matrix multiplication exercise. Describe the bug and proposed fix in an issue; do not push a fix to main.',
      example: 'less quests/matmul_buggy.c' },
  ],
}]
