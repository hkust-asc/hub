import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLinkGraph,
  canonicalizeParsedRoute,
  LESSON_STEP_COUNTS,
  renderMermaidStatecharts,
  STATE_MACHINES,
  stateForRoute,
  verifyStateMachines,
} from '../scripts/check-state-machines.ts'
import {
  categories,
  entries,
  fallbackBackTarget,
  parseRoute,
  popTrail,
  pruneTrailForDestination,
  pushTrail,
  trailSnapshotForCurrent,
} from '../src/catalog.ts'
import { clusterTopics, topics } from '../src/model.ts'
import { codex, conceptForAward } from '../src/platform/codex.ts'
import { missionLessons, weeks } from '../src/platform/curriculum.ts'
import { conceptsForLesson } from '../src/platform/links.ts'
import { levels } from '../src/practice/engine/levels/index.ts'

test('explicit state-machine catalog registers all 5 core state machines with code and verification mappings', () => {
  assert.equal(STATE_MACHINES.length, 5)
  assert.deepEqual(
    STATE_MACHINES.map(sm => sm.name),
    [
      'Route & Link Graph',
      'Stage Scenario Runner',
      'Learning & Practice Persistence',
      'Practice Shell/VFS/Mission Engine',
      'Explore Workbench & Overlay Stack',
    ],
  )
  for (const sm of STATE_MACHINES) {
    assert.ok(sm.ownerFiles.length > 0, `${sm.id} must declare ownerFiles`)
    assert.ok(sm.invariants.length > 0, `${sm.id} must declare invariants`)
    assert.ok(
      sm.verification.formalModels.length + sm.verification.scriptsAndTests.length > 0,
      `${sm.id} must declare verification coverage`,
    )
  }
})

test('canonical route graph enumerates every mode, hub, concept, scene, topic, scenario, step, mission, and week with zero invariant errors', () => {
  const graph = buildLinkGraph()
  const report = verifyStateMachines(graph)
  assert.deepEqual(report.errors, [], `State-machine / link-graph violations:\n${report.errors.join('\n')}`)
  assert.equal(report.ok, true)
  assert.equal(report.reachableCount, report.nodeCount)

  // Verify every canonical route family is present
  for (const root of ['#learn', '#practice', '#weeks', '#atlas', '#atlas/domains']) {
    assert.ok(graph.nodeMap.has(root), `Missing root ${root}`)
  }
  for (const cat of categories) {
    assert.ok(graph.nodeMap.has(`#atlas/${cat.id}`), `Missing category hub #atlas/${cat.id}`)
  }
  for (const level of levels) {
    assert.ok(graph.nodeMap.has(`#practice/${level.id}`), `Missing mission #practice/${level.id}`)
  }
  for (const week of weeks) {
    assert.ok(graph.nodeMap.has(`#weeks/${week.id}`), `Missing week #weeks/${week.id}`)
  }
  for (const topicId of Object.keys(clusterTopics)) {
    const route = topicId === 'a30' ? '#cluster' : `#cluster/${topicId}`
    assert.ok(graph.nodeMap.has(route), `Missing cluster route ${route}`)
  }
  for (const topicId of Object.keys(topics)) {
    const route = topicId === 'gpu' ? '#a30' : `#a30/${topicId}`
    assert.ok(graph.nodeMap.has(route), `Missing A30 route ${route}`)
  }
  for (const entry of entries) {
    if (entry.kind === 'subject') {
      assert.ok(graph.nodeMap.has(`#atlas/concept/${entry.id}`), `Missing concept #atlas/concept/${entry.id}`)
    } else if (entry.kind === 'scenario') {
      const lessonId = entry.id as keyof typeof LESSON_STEP_COUNTS
      assert.ok(graph.nodeMap.has(`#lesson/${lessonId}`), `Missing lesson #lesson/${lessonId}`)
      for (let step = 1; step <= LESSON_STEP_COUNTS[lessonId]; step++) {
        assert.ok(graph.nodeMap.has(`#lesson/${lessonId}/${step}`), `Missing step #lesson/${lessonId}/${step}`)
      }
    }
  }
})

test('Think Back trail and pruneTrailForDestination prevent self-loops even after in-place subject or atlas-mode switches', () => {
  // Reproduces the subtle in-place return sequence uncovered by formal Navigation modeling:
  // #a30/memory -> navigateTo('#a30') pushes '#a30/memory' -> in-place subject picker back to '#a30/memory'
  const startRoute = '#a30/memory'
  const parsedStart = parseRoute(startRoute)
  const snap = trailSnapshotForCurrent(parsedStart, startRoute, stateForRoute(parsedStart))
  let trail = pushTrail([], snap, '#a30')
  assert.equal(trail.at(-1)?.route, '#a30/memory')

  // Selecting 'memory' inside #a30 returns canonicalHash to '#a30/memory' in place;
  // pruneTrailForDestination removes the stale self-pointing top entry so Think Back falls back to #atlas/interconnect.
  trail = pruneTrailForDestination(trail, '#a30/memory')
  assert.equal(trail.length, 0)
  const popped = popTrail(trail)
  assert.equal(popped.target, undefined)
  const fallback = fallbackBackTarget(parsedStart, stateForRoute(parsedStart))
  assert.equal(fallback?.route, '#atlas/interconnect')
  assert.equal(canonicalizeParsedRoute(parseRoute(fallback!.route)), '#atlas/interconnect')
})

test('bidirectional lesson <-> concept and mission <-> concept contracts hold across catalog, codex, and curriculum', () => {
  for (const [missionKey, lessonList] of Object.entries(missionLessons)) {
    const level = levels.find(item => item.id === Number(missionKey))
    assert.ok(level, `missionLessons[${missionKey}] must correspond to a level`)
    assert.ok(lessonList.length > 0)
  }

  for (const level of levels) {
    for (const cardKey of level.cards) {
      const conceptId = conceptForAward(cardKey)
      assert.ok(Object.hasOwn(codex, conceptId), `Award '${cardKey}' -> '${conceptId}' missing from codex`)
      assert.equal(entries.find(e => e.id === conceptId)?.kind, 'subject')
    }
  }

  for (const scenario of entries.filter(e => e.kind === 'scenario')) {
    const concepts = conceptsForLesson(scenario.id as keyof typeof LESSON_STEP_COUNTS)
    assert.ok(concepts.length > 0, `${scenario.id} should reference at least one subject concept`)
    for (const conceptId of concepts) {
      assert.equal(entries.find(e => e.id === conceptId)?.kind, 'subject')
    }
  }
})

test('mermaid statechart exporter renders a valid stateDiagram-v2 overview of modes and state machines', () => {
  const mermaid = renderMermaidStatecharts()
  assert.match(mermaid, /stateDiagram-v2/)
  assert.match(mermaid, /\[\*\] --> Atlas/)
  assert.match(mermaid, /Route & Link Graph/)
  assert.match(mermaid, /Stage Scenario Runner/)
})

test('verifier catches broken outgoing hashes and unreachable orphan route nodes (negative controls)', () => {
  const baseline = buildLinkGraph()

  const withBrokenEdge = {
    ...baseline,
    edges: [
      ...baseline.edges,
      { from: '#learn', to: '#atlas/concept/missing-subject', source: 'negative-test', kind: 'content' as const },
      { from: '#lesson/streams', to: '#lesson/streams/99', source: 'negative-test', kind: 'step' as const },
    ],
  }
  const brokenReport = verifyStateMachines(withBrokenEdge)
  assert.equal(brokenReport.ok, false)
  assert.ok(brokenReport.errors.some(err => err.includes('#atlas/concept/missing-subject')))
  assert.ok(brokenReport.errors.some(err => err.includes('#lesson/streams/99')))

  const isolatedEdges = baseline.edges.filter(edge => edge.to !== '#weeks/asc01')
  const orphanReport = verifyStateMachines({ ...baseline, edges: isolatedEdges })
  assert.equal(orphanReport.ok, false)
  assert.ok(orphanReport.errors.some(err => err.includes("Orphan canonical route unreachable from top-level modes: '#weeks/asc01'")))
})

