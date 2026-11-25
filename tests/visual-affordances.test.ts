import assert from 'node:assert/strict'
import test from 'node:test'
import { getEntry, parseRoute } from '../src/catalog.ts'
import type { LessonId } from '../src/catalog.ts'
import { jobStageSpec, jobSteps } from '../src/first-job/story.ts'
import { createLayout } from '../src/layout.ts'
import { fsStageSpec, fsSteps } from '../src/linux-fs/story.ts'
import { moduleStageSpec, moduleSteps } from '../src/module-load/story.ts'
import { conceptNeighbors, lessonContinuation } from '../src/platform/links.ts'
import { LearningProgress, stepBookmarkPosition } from '../src/platform/progress.ts'
import { renderConceptSheet, renderWeekView } from '../src/platform/views.ts'
import { Game } from '../src/practice/engine/game.ts'
import { levels } from '../src/practice/engine/levels/index.ts'
import { describeMissionNav } from '../src/practice/workstation.ts'
import { sshStageSpec, sshSteps } from '../src/ssh-tmux/story.ts'
import { computeSpotlightGeometry, planCameraViewBox, resolveEntityWorldBoxes } from '../src/stage/layout.ts'
import { describeStageCue, describeStageRailNav } from '../src/stage/runner.ts'
import { streamStageSpec, streamSteps } from '../src/streams/story.ts'

const allLessons: readonly LessonId[] = [
  'linux-fs',
  'streams',
  'ssh-tmux',
  'first-job',
  'module-load',
  'host-to-gpu',
]

test('stage rail navigation labels next steps and replaces final-step dead ends with valid continuations', () => {
  const streamsContinuation = lessonContinuation('streams')
  assert.equal(streamsContinuation.primary.route, '#practice/3')
  assert.equal(streamsContinuation.primary.label, 'Practice · Mission 3')

  // Multi-mission lessons advance primary CTA once earlier paired mission is complete
  assert.equal(lessonContinuation('linux-fs').primary.route, '#practice/1')
  assert.equal(
    lessonContinuation('linux-fs', { completedMissions: new Set([1]) }).primary.route,
    '#practice/2',
  )

  // Lessons without a paired Practice mission fall back cleanly without dead ends
  const gpuContinuation = lessonContinuation('host-to-gpu')
  assert.equal(gpuContinuation.primary.route, '#learn')
  assert.equal(gpuContinuation.primary.label, 'All walkthroughs')
  assert.ok(gpuContinuation.secondary?.some(item => item.route === '#a30'))

  // Every emitted primary & secondary route across all lessons parses to a live view
  for (const lessonId of allLessons) {
    const cont = lessonContinuation(lessonId)
    for (const item of [cont.primary, ...(cont.secondary ?? [])]) {
      assert.ok(item.route.startsWith('#'), `${lessonId}: invalid route ${item.route}`)
      assert.ok(!item.route.includes('planned'), `${lessonId}: planned route ${item.route}`)
      const parsed = parseRoute(item.route)
      assert.ok(parsed.view !== 'atlas' || item.route === '#atlas', `${lessonId}: unexpected fallback for ${item.route}`)
    }
  }

  const firstNav = describeStageRailNav({
    steps: streamSteps,
    stepIndex: 0,
    returnLink: { route: '#learn', label: 'Walkthroughs' },
    continuation: streamsContinuation,
  })
  assert.equal(firstNav.isFirstStep, true)
  assert.equal(firstNav.isFinalStep, false)
  assert.equal(firstNav.returnLink?.route, '#learn')
  assert.equal(firstNav.nextStepLabel, 'Redirect >')
  assert.equal(firstNav.primaryContinuation, null)

  const midNav = describeStageRailNav({
    steps: streamSteps,
    stepIndex: 2,
    returnLink: { route: '#learn', label: 'Walkthroughs' },
    continuation: streamsContinuation,
  })
  assert.equal(midNav.prevStepLabel, 'Redirect >')
  assert.equal(midNav.nextStepLabel, 'Route both')
  assert.equal(midNav.returnLink, null)

  const finalNav = describeStageRailNav({
    steps: streamSteps,
    stepIndex: streamSteps.length - 1,
    returnLink: { route: '#learn', label: 'Walkthroughs' },
    continuation: streamsContinuation,
  })
  assert.equal(finalNav.isFinalStep, true)
  assert.equal(finalNav.nextStepLabel, null)
  assert.equal(finalNav.primaryContinuation?.route, '#practice/3')
  assert.ok(finalNav.secondaryContinuation.some(item => item.route === '#lesson/ssh-tmux'))
})

test('spotlight halos stay strictly inside SVG viewBox bounds across every scenario in wide and compact modes', () => {
  const suites = [
    { spec: streamStageSpec, steps: streamSteps.length },
    { spec: sshStageSpec, steps: sshSteps.length },
    { spec: fsStageSpec, steps: fsSteps.length },
    { spec: jobStageSpec, steps: jobSteps.length },
    { spec: moduleStageSpec, steps: moduleSteps.length },
  ] as const

  for (const { spec, steps } of suites) {
    for (const mode of ['wide', 'compact'] as const) {
      const isCompact = mode === 'compact'
      const sceneSize = isCompact ? spec.compactSize : spec.wideSize
      for (let step = 0; step < steps; step++) {
        const frame = spec.evaluate(step, 1, 'default' as never, isCompact)
        const overrides: Record<string, { x: number; y: number }> = {}
        for (const entity of spec.entities) {
          const ov = frame.entities[entity.id as keyof typeof frame.entities]?.overridePos
          const pos = isCompact ? ov?.compact : ov?.wide
          if (pos) overrides[entity.id] = pos
        }
        const worldBoxes = resolveEntityWorldBoxes(spec.entities as never, mode, overrides)
        const cam = planCameraViewBox({
          sceneSize,
          boxes: worldBoxes,
          focus: frame.cameraFocus as readonly string[] | undefined,
          fitOverride: false,
        })

        for (const entity of spec.entities) {
          const eState = frame.entities[entity.id as keyof typeof frame.entities]
          if (eState?.hidden || !eState?.emphasis) continue
          const geom = computeSpotlightGeometry(worldBoxes[entity.id], cam.rect, 4, 1.5)
          assert.ok(geom, `${spec.id} [${mode}/step ${step}/${entity.id}] missing spotlight geometry`)
          assert.ok(
            geom.halo.x >= cam.rect.x + 1.5 &&
            geom.halo.y >= cam.rect.y + 1.5 &&
            geom.halo.x + geom.halo.w <= cam.rect.x + cam.rect.w - 1.5 &&
            geom.halo.y + geom.halo.h <= cam.rect.y + cam.rect.h - 1.5,
            `${spec.id} [${mode}/step ${step}/${entity.id}] spotlight clipped viewBox`,
          )
          assert.match(geom.cornersPath, /^M /)
        }
      }
    }
  }

  // Edge-hugging box clamps strictly within bounds
  const edge = computeSpotlightGeometry({ x: 0, y: 0, w: 380, h: 410 }, { x: 0, y: 0, w: 380, h: 410 }, 6, 1.5)
  assert.ok(edge)
  assert.equal(edge.halo.x, 1.5)
  assert.equal(edge.halo.y, 1.5)
  assert.equal(edge.halo.x + edge.halo.w, 378.5)
  assert.equal(edge.halo.y + edge.halo.h, 408.5)

  // Targets with no visible intersection inside inset bounds are hidden (return null)
  assert.equal(computeSpotlightGeometry({ x: 99, y: 20, w: 1, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }, 4, 1.5), null)
  assert.equal(computeSpotlightGeometry({ x: 120, y: 20, w: 10, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }, 4, 1.5), null)

  // Narrow near-edge targets clamp their minimum-sized halo inside the inset boundary
  const narrow = computeSpotlightGeometry({ x: 97, y: 20, w: 1, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }, 0, 1.5)
  assert.ok(narrow)
  assert.equal(narrow.halo.x, 94.5)
  assert.equal(narrow.halo.w, 4)
  assert.equal(narrow.halo.x + narrow.halo.w, 98.5)
})

test('interactive cues and Practice mission navigation reflect inspect state and mission unlock progression', () => {
  assert.match(describeStageCue(false, false), /Click any block to inspect \(I\)/)
  assert.match(describeStageCue(true, false), /Inspect active.*Esc to exit/)
  assert.match(describeStageCue(true, true), /Esc to close/)
  assert.match(createLayout(), /id="view-click-cue"/)

  const game = new Game()
  const navStart = describeMissionNav(levels, 1, id => game.isUnlocked(id))
  assert.equal(navStart.prev, null)
  assert.equal(navStart.next?.route, '#practice/2')
  assert.equal(navStart.next?.unlocked, false)
  assert.equal(navStart.primaryLesson?.route, '#lesson/linux-fs')

  game.run('ls -a')
  assert.equal(game.run('cat .vault/.access_key').completed, true)

  const navAfterComplete = describeMissionNav(levels, 1, id => game.isUnlocked(id))
  assert.equal(navAfterComplete.next?.unlocked, true)

  const navMission2 = describeMissionNav(levels, 2, id => game.isUnlocked(id))
  assert.equal(navMission2.prev?.route, '#practice/1')
  assert.equal(navMission2.next?.route, '#practice/3')

  const navFinal = describeMissionNav(levels, 6, id => game.isUnlocked(id))
  assert.equal(navFinal.prev?.route, '#practice/5')
  assert.equal(navFinal.next, null)
  assert.equal(navFinal.weekBrief?.route, '#weeks/asc01')
})

test('concept sheets expose domain-scoped Prev/Next strips and Week views advance 01->04 recommendations', () => {
  const firstNeighbors = conceptNeighbors('filesystem')
  assert.equal(firstNeighbors.category.id, 'linux')
  assert.equal(firstNeighbors.prev, null)
  assert.equal(firstNeighbors.next?.id, 'paths')

  const firstSheet = renderConceptSheet(getEntry('filesystem')!)
  assert.match(firstSheet, /data-concept-nav="top"/)
  assert.match(firstSheet, /data-concept-nav="bottom"/)
  assert.match(firstSheet, /← All Atlas entries/)
  assert.doesNotMatch(firstSheet, /data-concept-prev/)
  assert.match(firstSheet, /href="#atlas\/concept\/paths"[^>]*>Next: Relative and absolute paths →/)

  const midSheet = renderConceptSheet(getEntry('paths')!)
  assert.match(midSheet, /href="#atlas\/concept\/filesystem"[^>]*>← Previous: The Linux filesystem/)
  assert.match(midSheet, /href="#atlas\/concept\/dotfiles"[^>]*>Next: Dotfiles →/)

  // Single-concept domain omits prev/next cleanly without broken links
  const soloSheet = renderConceptSheet(getEntry('gpu-device')!)
  assert.doesNotMatch(soloSheet, /data-concept-prev/)
  assert.doesNotMatch(soloSheet, /data-concept-next/)

  // Fresh Week 01 highlights stage 01 and marks linux-fs Next up
  const progress = new LearningProgress()
  const game = new Game()
  const freshWeek = renderWeekView('asc01', progress, game)
  assert.match(freshWeek, /week-step-pill is-current" data-week-stage="01"/)
  assert.match(freshWeek, /data-week-lesson="linux-fs" data-status="next"/)
  assert.match(freshWeek, /Start 01 \/ Learn: Linux tree →/)

  // Completing all Week 01 lessons + Mission 1 shifts recommendation to 02 / Practice Mission 2
  for (const lid of ['linux-fs', 'streams', 'ssh-tmux'] as const) {
    progress.record(lid, stepBookmarkPosition(4, 5, true))
  }
  game.run('ls -a')
  game.run('cat .vault/.access_key')

  const midWeek = renderWeekView('asc01', progress, game)
  assert.match(midWeek, /week-step-pill is-done" data-week-stage="01"/)
  assert.match(midWeek, /week-step-pill is-current" data-week-stage="02"/)
  assert.match(midWeek, /data-week-lesson="streams" data-status="complete"/)
  assert.match(midWeek, /data-week-mission="1" data-status="complete"/)
  assert.match(midWeek, /data-week-mission="2" data-status="next"/)
  assert.match(midWeek, /Continue 02 \/ Practice: Mission 2/)
})
