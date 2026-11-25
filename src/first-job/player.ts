import { evidence } from '../model.ts'
import { createSchematicStageScene } from '../stage/renderer.ts'
import type { StageScenarioOptions } from '../stage/types.ts'
import { jobStageSpec, jobSteps } from './story.ts'

export const lesson: StageScenarioOptions = {
  id: 'first-job',
  title: 'Job walkthrough',
  subtitle: 'Login shell, Slurm allocation, compute node, and shared storage',
  diagramLabel: 'Interactive HPC4 batch job diagram',
  steps: jobSteps,
  footer: {
    note: 'HPC4 batch workflow · compressed queue time',
    sourceLabel: 'HPC handbook',
    sourceHref: evidence.handbook,
  },
  mountScene: canvas => createSchematicStageScene(canvas, jobStageSpec),
}

