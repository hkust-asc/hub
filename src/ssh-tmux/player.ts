import { createSchematicStageScene } from '../stage/renderer.ts'
import type { StageScenarioOptions } from '../stage/types.ts'
import { sshStageSpec, sshSteps } from './story.ts'

export const lesson: StageScenarioOptions = {
  id: 'ssh-tmux',
  title: 'SSH & tmux',
  subtitle: 'What survives a disconnect?',
  diagramLabel: 'Interactive SSH and tmux diagram',
  steps: sshSteps,
  footer: {
    note: 'ASC Week 1 · compressed timing',
    sourceLabel: 'Try it in Quest 2',
    sourceHref: 'https://github.com/hkust-asc/ws26-01-linux-git#quest-2-redirect-output-and-use-tmux',
  },
  mountScene: canvas => createSchematicStageScene(canvas, sshStageSpec),
}

