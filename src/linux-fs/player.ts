import { createSchematicStageScene } from '../stage/renderer.ts'
import type { StageScenarioOptions } from '../stage/types.ts'
import { fsStageSpec, fsSteps } from './story.ts'

export const lesson: StageScenarioOptions = {
  id: 'linux-fs',
  title: 'Linux filesystem',
  subtitle: 'Directories, paths, and mount points',
  diagramLabel: 'Interactive Linux directory tree',
  steps: fsSteps,
  footer: {
    note: 'ASC Week 1 · example mounts',
    sourceLabel: 'Try it in Quest 1',
    sourceHref: 'https://github.com/hkust-asc/ws26-01-linux-git#quest-1-connect-and-explore',
  },
  mountScene: canvas => createSchematicStageScene(canvas, fsStageSpec),
}

