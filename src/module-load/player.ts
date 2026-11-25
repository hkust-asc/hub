import { createSchematicStageScene } from '../stage/renderer.ts'
import type { StageScenarioOptions } from '../stage/types.ts'
import { moduleStageSpec, moduleSteps } from './story.ts'

export const lesson: StageScenarioOptions = {
  id: 'module-load',
  title: 'Environment modules',
  subtitle: 'What module load changes in your shell',
  diagramLabel: 'Interactive Lmod environment and Spack prefix schematic',
  steps: moduleSteps,
  footer: {
    note: 'Tier 2 Spack / Lmod stack · illustrative paths',
    sourceLabel: 'HKUST scientific software stack',
    sourceHref: 'https://hkust-hpc-docs.readthedocs.io/latest/sysadmin/software-ecosystem/scientific-software-stack.html',
  },
  mountScene: canvas => createSchematicStageScene(canvas, moduleStageSpec),
}

