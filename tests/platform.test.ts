import assert from 'node:assert/strict'
import test from 'node:test'
import { fallbackBackTarget, filterEntries, parseRoute, trailSnapshotForCurrent } from '../src/catalog.ts'
import { initialState } from '../src/model.ts'

test('a learner can leave a mission for a walkthrough and navigate back to that mission', () => {
  const mission = parseRoute('#practice/3')
  assert.deepEqual(mission, { view: 'practice', mission: 3 })
  assert.equal(trailSnapshotForCurrent(mission, '#practice/3', initialState).route, '#practice/3')
  assert.equal(fallbackBackTarget(mission, initialState)?.route, '#practice')
  assert.deepEqual(parseRoute('#practice/99'), { view: 'practice' })
})

test('Atlas exposes permanent reference cards separately from the similarly named lesson and scene', () => {
  assert.deepEqual(parseRoute('#atlas/concept/standard-streams'), { view: 'concept', id: 'standard-streams' })
  assert.deepEqual(parseRoute('#lesson/streams'), { view: 'lesson', lesson: 'streams' })
  assert.deepEqual(parseRoute('#atlas/concept/slurm'), { view: 'concept', id: 'slurm' })
  assert.deepEqual(parseRoute('#cluster/slurm'), { view: 'workbench', scene: 'cluster', clusterTopic: 'slurm' })
  assert.equal(filterEntries({ kind: 'subject', query: 'scheduler' }).filter(c => c.id === 'slurm').length, 1)
  assert.ok(filterEntries({ kind: 'subject', query: '2> stderr' }).some(c => c.id === 'standard-streams'))
})

test('resume, completion and checked field quests survive reopening the app', async () => {
  const { LearningProgress } = await import('../src/platform/progress.ts')
  const values = new Map<string, string>()
  const disk = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
  const first = new LearningProgress(disk)
  first.record('streams', { positionMs: 24000, durationMs: 24000, beat: 3, total: 4 })
  first.record('streams', { positionMs: 4500, durationMs: 24000, beat: 0, total: 4 })
  first.checkQuest('asc01/connect', true)
  first.save()
  const second = new LearningProgress(disk)
  assert.equal(second.lessons.get('streams')?.positionMs, 4500)
  assert.equal(second.lessons.get('streams')?.completed, true)
  assert.equal(second.last, 'streams')
  assert.ok(second.checked.has('asc01/connect'))
})

test('finishing a lesson publishes the completed bookmark without waiting for the tab to close', async () => {
  const { LearningProgress } = await import('../src/platform/progress.ts')
  let stored: string | null = null
  const disk = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value } }
  const player = new LearningProgress(disk)
  player.record('streams', { positionMs: 23500, durationMs: 24000, beat: 3, total: 4 })
  player.record('streams', { positionMs: 24000, durationMs: 24000, beat: 3, total: 4 })
  assert.ok(new LearningProgress(disk).lessons.get('streams')?.completed)
})

test('search distinguishes the stdout walkthrough, the simulation and the reference; planned items have no jump target', async () => {
  const { searchDestinations } = await import('../src/platform/search.ts')
  const routes = searchDestinations('streams').map(item => item.route)
  for (const route of ['#lesson/streams', '#practice/3', '#atlas/concept/standard-streams']) assert.ok(routes.includes(route), route)
  assert.ok(searchDestinations('week git').some(item => item.route === '#weeks/asc01'))
  assert.ok(!searchDestinations('').some(item => item.route.includes('planned')))
})

test('unlock-all-missions preference persists across reloads and practice groups cover every mission', async () => {
  const { LearningProgress } = await import('../src/platform/progress.ts')
  const { practiceGroups } = await import('../src/platform/curriculum.ts')
  const { levels } = await import('../src/practice/engine/levels/index.ts')
  const values = new Map<string, string>()
  const disk = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
  const first = new LearningProgress(disk)
  assert.equal(first.unlockAllMissions, false)
  first.setUnlockAllMissions(true)
  assert.equal(new LearningProgress(disk).unlockAllMissions, true)
  first.setUnlockAllMissions(false)
  assert.equal(new LearningProgress(disk).unlockAllMissions, false)
  const groupedIds = practiceGroups.flatMap(g => [...g.missions])
  assert.deepEqual(groupedIds, levels.map(l => l.id))
})
