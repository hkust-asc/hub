import { createSchematicStageScene } from '../stage/renderer.ts'
import type { StageScenarioOptions } from '../stage/types.ts'
import { streamStageSpec, streamSteps } from './story.ts'

export const lesson: StageScenarioOptions = {
  id: 'streams',
  title: 'Streams & redirection',
  subtitle: 'Separating stdout and stderr',
  diagramLabel: 'Interactive output routing diagram',
  steps: streamSteps,
  footer: {
    note: 'ASC Week 1 · demo output',
    sourceLabel: 'Try it in Quest 2',
    sourceHref: 'https://github.com/hkust-asc/ws26-01-linux-git#quest-2-redirect-output-and-use-tmux',
  },
  mountScene: canvas => createSchematicStageScene(canvas, streamStageSpec),
}

