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

test('step bookmarks map legacy millisecond records proportionally and restart completed lessons cleanly', async () => {
  const { resolveSavedStep, stepBookmarkPosition } = await import('../src/platform/progress.ts')
  // Legacy 4-beat streams bookmark mid-way -> maps cleanly into 5-step lesson
  assert.equal(
    resolveSavedStep({ positionMs: 12500, durationMs: 24500, beat: 2, total: 4, completed: false }, 5),
    2,
  )
  // Exact matching step count uses saved beat index directly
  assert.equal(
    resolveSavedStep({ positionMs: 3000, durationMs: 5000, beat: 3, total: 5, completed: false }, 5),
    3,
  )
  // Completed lesson at end starts fresh at step 0 on reopen
  assert.equal(
    resolveSavedStep({ positionMs: 5000, durationMs: 5000, beat: 4, total: 5, completed: true }, 5),
    0,
  )
  assert.deepEqual(stepBookmarkPosition(4, 5, true), {
    positionMs: 5000,
    durationMs: 5000,
    beat: 4,
    total: 5,
  })
})

test('search distinguishes the stdout walkthrough, the simulation and the reference; planned items have no jump target', async () => {
  const { searchDestinations } = await import('../src/platform/search.ts')
  const routes = searchDestinations('streams').map(item => item.route)
  for (const route of ['#lesson/streams', '#practice/3', '#atlas/concept/standard-streams']) assert.ok(routes.includes(route), route)
  assert.ok(searchDestinations('week git').some(item => item.route === '#weeks/asc01'))
  assert.ok(!searchDestinations('').some(item => item.route.includes('planned')))
})

test('Resources is discoverable in the switcher and can be revisited through Think Back', async () => {
  const { searchDestinations } = await import('../src/platform/search.ts')
  assert.ok(searchDestinations('resources').some(item => item.route === '#resources'))
  const route = parseRoute('#resources')
  assert.equal(trailSnapshotForCurrent(route, '#resources', initialState).route, '#resources')
  assert.equal(fallbackBackTarget(route, initialState), null)
  const materials = parseRoute('#resources/asc01')
  assert.deepEqual(materials, { view: 'resources', detail: 'asc01' })
  assert.equal(trailSnapshotForCurrent(materials, '#resources/asc01', initialState).route, '#resources/asc01')
  assert.equal(fallbackBackTarget(materials, initialState)?.route, '#resources')
  assert.deepEqual(parseRoute('#resources/asc01/unknown'), route)
  assert.deepEqual(parseRoute('#resources/slurm-2023'), parseRoute('#resources/archer2'))
})

test('workshop and collection rows are title links and ordinary references use one visible action label', async () => {
  const { renderResourceResults } = await import('../src/platform/resources.ts')
  const all = renderResourceResults('all')
  assert.match(all.html, /HPC4 user guide[\s\S]*datetime="2026-11-25"[\s\S]*datetime="2026-11-18"[\s\S]*Shared references[\s\S]*href="#resources\/archer2"/)
  assert.doesNotMatch(all.html, /Workshop exercises|Follow in Weeks|Recording \(Zoom\)|Slides \(PDF\): Slurm/)
  assert.match(all.html, /aria-label="Open resource: Linux shell crash course">Open resource/)
  assert.match(all.html, /aria-label="Open resource: 2026 HPC tutorials">Open resource/)

  const search = renderResourceResults('recording', '  OPENACC 6 October 2026  ')
  assert.equal(search.status, '1 entry')
  assert.match(search.html, /href="#resources\/archer2"[^>]*>ARCHER2 training/)
  assert.doesNotMatch(search.html, /GPU programming using OpenMP|href="https:/)
})

test('ARCHER2 details retain all three courses and their material links', async () => {
  const { getResourcePage } = await import('../src/platform/resource-catalog.ts')
  const { renderResourcePage } = await import('../src/platform/resources.ts')
  const collection = renderResourcePage(getResourcePage('archer2')!)
  assert.equal(collection.match(/class="resource-row"/g)?.length, 3)
  assert.match(collection, /Recordings: GPU programming using OpenMP[\s\S]*Slides \(PDF\): Slurm job scheduling[\s\S]*Exercises \(PDF\): Message-passing/)
})

test('workshop detail actions preserve exercise links and do not publish member replay URLs', async () => {
  const { getResourcePage } = await import('../src/platform/resource-catalog.ts')
  const { renderResourcePage, renderResourceResults } = await import('../src/platform/resources.ts')
  const week = renderResourcePage(getResourcePage('asc01')!)
  assert.match(week, /href="https:\/\/github\.com\/hkust-asc\/ws26-01-linux-git#quest-1-connect-and-explore"[^>]*>Workshop exercises/)
  assert.match(week, /href="#weeks\/asc01"[^>]*>Follow in Weeks/)

  const curriculum = renderResourcePage(getResourcePage('asc27-first-principles')!)
  assert.match(curriculum, /Related MPI exercises \(PDF\)/)
  for (const page of [week, curriculum]) {
    assert.match(page, /disabled aria-label="Recording \(Zoom\), members only"/)
    assert.doesNotMatch(page, /zoom\.us/)
  }
  const filtered = renderResourceResults('recording', 'zoom 2026-11-25')
  assert.equal(filtered.status, '1 entry')
  assert.match(filtered.html, /href="#resources\/asc27-first-principles"[^>]*>ASC01: ASC27 First-Principles Curriculum/)
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
