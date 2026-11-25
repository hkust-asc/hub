import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeEntryForState,
  fallbackBackTarget,
  filterEntries,
  normalizeLessonUrl,
  parseRoute,
  popTrail,
  pushTrail,
} from '../src/catalog.ts'
import { createIsoProjector } from '../src/iso.ts'
import { initialState, transferPath, updateState } from '../src/model.ts'
import { evaluateJobStep, jobStageSpec, jobSteps } from '../src/first-job/story.ts'
import { evaluateGpuStep, gpuSteps } from '../src/host-to-gpu/story.ts'
import { evaluateFsStep, fsStageSpec, fsSteps } from '../src/linux-fs/story.ts'
import { evaluateModuleStep, moduleStageSpec, moduleSteps } from '../src/module-load/story.ts'
import { evaluateSshStep, sshStageSpec, sshSteps } from '../src/ssh-tmux/story.ts'
import { evaluateStreamStep, streamStageSpec, streamSteps } from '../src/streams/story.ts'
import { planCameraViewBox, validateStageSpec } from '../src/stage/layout.ts'
import { createInitialRunnerState, reduceRunnerState } from '../src/stage/runner.ts'

test('a local H2D path does not cross the inter-socket link', () => {
  assert.deepEqual(transferPath(2, 'local'), ['memory-local', 'pcie-link', 'gpu-link'])
})

test('remote placement adds an inter-socket crossing', () => {
  assert.deepEqual(transferPath(2, 'remote'), ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link'])
})

test('D2H reverses the same transfer path without changing H2D', () => {
  const forward = transferPath(2, 'remote')
  assert.deepEqual(transferPath(4, 'remote'), forward.toReversed())
  assert.deepEqual(transferPath(2, 'remote'), forward)
})

test('allocation, preparation, computation, and completion do not show a transfer', () => {
  for (const step of [0, 1, 3, 5]) assert.deepEqual(transferPath(step, 'local'), [])
})

test('explicit selection and placement preserve explore state', () => {
  const remote = updateState(initialState, { type: 'placement', placement: 'remote' })
  const selected = updateState(remote, { type: 'select', topic: 'numa' })
  assert.equal(selected.selected, 'numa')
  assert.equal(selected.placement, 'remote')
})

test('reset-view restores placement and exploded layers while keeping active subject', () => {
  const changed = { ...initialState, scene: 'a30' as const, selected: 'pcie' as const, placement: 'remote' as const, exploded: true }
  assert.deepEqual(updateState(changed, { type: 'reset-view' }), {
    ...changed,
    placement: 'local',
    exploded: false,
  })
  assert.deepEqual(updateState(changed, { type: 'reset' }), { ...initialState, scene: 'a30' })
})

test('browsing node components, software subjects, and overview is one coherent navigation action', () => {
  const node = updateState(initialState, { type: 'browse', scene: 'a30', topic: 'numa' })
  assert.equal(node.scene, 'a30')
  assert.equal(node.selected, 'numa')
  const software = updateState(node, { type: 'browse', scene: 'cluster', topic: 'lmod' })
  assert.equal(software.scene, 'cluster')
  assert.equal(software.clusterSelected, 'lmod')
  const overview = updateState(software, { type: 'browse', scene: 'cluster' })
  assert.equal(overview.clusterSelected, 'a30')
  const returned = updateState(overview, { type: 'browse', scene: 'a30' })
  assert.equal(returned.selected, 'numa')
})

test('shared isometric projector preserves 2:1 orthographic ratio and back-to-front depth order', () => {
  const proj = createIsoProjector({ originX: 100, originY: 50, scale: 0.88 })
  const [x0, y0] = proj.project([0, 0, 0])
  const [x1, y1] = proj.project([10, 0, 0])
  const [x2, y2] = proj.project([0, 10, 0])
  assert.equal(x0, 100)
  assert.equal(y0, 50)
  assert.equal(Math.round(((x1 - x0) / (y1 - y0)) * 100) / 100, 2)
  assert.equal(Math.round(((x0 - x2) / (y2 - y0)) * 100) / 100, 2)
  assert.ok(proj.depthKey(80, 100, 100, 100) < proj.depthKey(80, 230, 100, 60))
  assert.ok(proj.depthKey(80, 230, 100, 60) < proj.depthKey(380, 350, 80, 70))
})

test('legacy scenario hashes and step deep-links parse cleanly', () => {
  assert.deepEqual(parseRoute('#scenario/first-job'), { view: 'lesson', lesson: 'first-job' })
  assert.deepEqual(parseRoute('#scenario/gpu-copy'), { view: 'lesson', lesson: 'host-to-gpu' })
  assert.deepEqual(parseRoute('#lesson/streams/3'), { view: 'lesson', lesson: 'streams', step: 3 })
  assert.deepEqual(parseRoute('#lesson/streams/0'), { view: 'lesson', lesson: 'streams' })
  assert.deepEqual(parseRoute('#lesson/streams/nope'), { view: 'lesson', lesson: 'streams' })
})

test('every schematic and 2.5D stage spec has non-overlapping bounds and valid wire routes in wide and compact modes', () => {
  const suites = [
    { spec: moduleStageSpec, steps: moduleSteps.length },
    { spec: jobStageSpec, steps: jobSteps.length },
    { spec: sshStageSpec, steps: sshSteps.length },
    { spec: streamStageSpec, steps: streamSteps.length },
    { spec: fsStageSpec, steps: fsSteps.length },
  ] as const

  for (const { spec, steps } of suites) {
    const issues = validateStageSpec(spec as never, steps, ['default'])
    assert.deepEqual(issues, [], `Layout issues in ${spec.id}: ${issues.join('; ')}`)
  }
})

test('stage runner rests in reader-paced mode, advances on autoplay dwell, freezes in inspect, and replays on variant switch', () => {
  let state = createInitialRunnerState({
    steps: gpuSteps,
    defaultVariant: 'local' as 'local' | 'remote',
  })
  assert.equal(state.stepIndex, 0)
  assert.equal(state.beatProgress, 0)

  // Reader-paced tick advances beatProgress to 1 and holds without changing step
  state = reduceRunnerState(state, { type: 'tick', dtMs: 2000, reducedMotion: false }, gpuSteps)
  assert.equal(state.stepIndex, 0)
  assert.equal(state.beatProgress, 1)
  state = reduceRunnerState(state, { type: 'tick', dtMs: 5000, reducedMotion: false }, gpuSteps)
  assert.equal(state.stepIndex, 0)

  // Inspect preserves autoplay intent and freezes beatProgress
  state = reduceRunnerState(state, { type: 'goto', stepIndex: 2 }, gpuSteps)
  state = reduceRunnerState(state, { type: 'toggle-autoplay' }, gpuSteps)
  state = reduceRunnerState(state, { type: 'tick', dtMs: 500, reducedMotion: false }, gpuSteps)
  const midBeat = state.beatProgress
  assert.ok(midBeat > 0 && midBeat < 1)

  state = reduceRunnerState(state, { type: 'toggle-inspect' }, gpuSteps)
  assert.equal(state.inspecting, true)
  assert.equal(state.autoplay, false)
  state = reduceRunnerState(state, { type: 'tick', dtMs: 3000, reducedMotion: false }, gpuSteps)
  assert.equal(state.beatProgress, midBeat)

  state = reduceRunnerState(state, { type: 'toggle-inspect' }, gpuSteps)
  assert.equal(state.inspecting, false)
  assert.equal(state.autoplay, true)

  // Variant switch pauses autoplay and replays the current step's causal beat
  state = reduceRunnerState(state, { type: 'set-variant', variant: 'remote' }, gpuSteps)
  assert.equal(state.variant, 'remote')
  assert.equal(state.autoplay, false)
  assert.equal(state.beatProgress, 0)

  // Reduced motion snaps beatProgress to 1 and advances autoplay after dwellMs
  state = reduceRunnerState(state, { type: 'toggle-autoplay' }, gpuSteps, true)
  state = reduceRunnerState(state, { type: 'tick', dtMs: 2800, reducedMotion: true }, gpuSteps, true)
  assert.equal(state.stepIndex, 3)
  assert.equal(state.beatProgress, 1)
})

test('camera planner bounds zoomed viewBox and respects fitOverride', () => {
  const boxes = {
    a: { x: 20, y: 20, w: 120, h: 80 },
    b: { x: 640, y: 200, w: 180, h: 90 },
  }
  const zoomed = planCameraViewBox({
    sceneSize: { w: 900, h: 360 },
    boxes,
    focus: ['a'],
  })
  assert.equal(zoomed.zoomed, true)
  assert.ok(zoomed.rect.w < 900)
  assert.equal(Math.round((zoomed.rect.w / zoomed.rect.h) * 10), 25)

  const fitted = planCameraViewBox({
    sceneSize: { w: 900, h: 360 },
    boxes,
    focus: ['a'],
    fitOverride: true,
  })
  assert.equal(fitted.zoomed, false)
  assert.deepEqual(fitted.rect, { x: 0, y: 0, w: 900, h: 360 })
})

test('Host to GPU retains source buffers across copies, delays cross-socket arrival, and frees on finish', () => {
  const localMid = evaluateGpuStep(2, 0.72, 'local')
  assert.equal(localMid.host, 'Input')
  assert.equal(localMid.device, 'Input')
  assert.equal(localMid.copy?.progress, null)

  const remoteMid = evaluateGpuStep(2, 0.72, 'remote')
  assert.equal(remoteMid.host, 'Input')
  assert.equal(remoteMid.device, null)
  assert.ok(remoteMid.copy?.progress !== null)
  assert.equal(evaluateGpuStep(2, 0.9, 'remote').device, 'Input')

  // Compute updates HBM2 only; Host RAM stays Input until D2H
  const computed = evaluateGpuStep(3, 1, 'local')
  assert.equal(computed.host, 'Input')
  assert.equal(computed.device, 'Result')
  assert.equal(computed.copy, null)

  const copiedBack = evaluateGpuStep(4, 1, 'local')
  assert.equal(copiedBack.host, 'Result')
  assert.equal(copiedBack.device, 'Result')

  const finished = evaluateGpuStep(5, 1, 'local')
  assert.equal(finished.host, null)
  assert.equal(finished.device, null)
  assert.equal(finished.allocated, false)
})

test('SSH & tmux distinguishes foreground hangup from detached server persistence and file creation', () => {
  const dropped = evaluateSshStep(1, 0.55)
  assert.equal(dropped.wires.connection.faultMark, true)
  assert.equal(dropped.entities.shell.badge, 'open')

  const stopped = evaluateSshStep(1, 1)
  assert.equal(stopped.entities.shell.badge, 'closed')
  assert.equal(stopped.entities.process.badge, 'stopped')
  assert.equal(stopped.entities.file.hidden, true)

  const detachedOffline = evaluateSshStep(3, 1)
  assert.equal(detachedOffline.wires.connection.faultMark, true)
  assert.equal(detachedOffline.entities.tmux.badge, 'detached')
  assert.equal(detachedOffline.entities.process.badge, '85%')
  assert.equal(detachedOffline.entities.file.hidden, true)

  const reattachedDone = evaluateSshStep(4, 1)
  assert.equal(reattachedDone.entities.tmux.badge, 'attached')
  assert.equal(reattachedDone.entities.process.badge, 'done')
  assert.equal(reattachedDone.entities.file.hidden, false)
})

test('Streams separates stdout, pauses at prediction, and quiets the terminal when both ports redirect', () => {
  const mixed = evaluateStreamStep(0, 1)
  assert.equal(mixed.entities.terminal.rows?.length, 3)
  assert.equal(mixed.entities.passcode.hidden, true)
  assert.equal(mixed.entities.errors.hidden, true)

  const stdoutOnly = evaluateStreamStep(1, 1)
  assert.equal(stdoutOnly.entities.passcode.rows?.[0]?.kind, 'code')
  assert.equal(stdoutOnly.entities.terminal.rows?.length, 2)
  assert.equal(stdoutOnly.entities.errors.hidden, true)

  const prediction = evaluateStreamStep(2, 1)
  assert.equal(prediction.entities.stderr.operator, '?')
  assert.equal(prediction.wires['err-file'].visible, false)
  assert.equal(prediction.packets?.length, 0)

  const routed = evaluateStreamStep(3, 1)
  assert.equal(routed.entities.stderr.operator, '2>')
  assert.equal(routed.entities.terminal.badge, 'quiet')
  assert.equal(routed.entities.errors.rows?.length, 2)
})

test('Linux filesystem preserves pwd on ls -a, contrasts relative vs absolute cd, and reveals mounts cleanly', () => {
  const home = evaluateFsStep(1, 0.3)
  const listed = evaluateFsStep(1, 1)
  assert.equal(home.pins?.[0]?.target, 'user-home')
  assert.equal(listed.pins?.[0]?.target, 'user-home')
  assert.equal(home.entities.dotfile.dashed, true)
  assert.equal(listed.entities.dotfile.dashed, false)

  assert.equal(evaluateFsStep(2, 1).pins?.[0]?.target, 'workspace')
  assert.equal(evaluateFsStep(3, 1).pins?.[0]?.target, 'quest')

  const mounts = evaluateFsStep(4, 1)
  assert.equal(mounts.entities['local-disk'].hidden, false)
  assert.equal(mounts.entities['shared-storage'].hidden, false)
  assert.equal(mounts.wires['mount-home'].visible, true)
  assert.equal(evaluateFsStep(1, 1).entities['shared-storage'].hidden, true)
})

test('Job walkthrough keeps interactive shell on login01, wires Lmod on gpu01, and streams output to shared scratch', () => {
  const submitted = evaluateJobStep(0, 1)
  assert.equal(submitted.entities.slurm.badge, 'PD')
  assert.equal(submitted.entities.compute.dimmed, true)

  const allocated = evaluateJobStep(1, 1)
  assert.equal(allocated.entities.compute.subtitle, 'Allocated')
  assert.equal(allocated.entities.gpu.subtitle, 'Allocated')

  const modules = evaluateJobStep(2, 1)
  assert.equal(modules.entities.env.badge, 'Lmod ready')

  const executed = evaluateJobStep(3, 1)
  assert.equal(executed.entities.gpu.subtitle, 'Done')
  assert.equal(executed.wires.submit.visible, false)
  assert.equal(executed.wires['scratch-write'].visible, true)

  const finished = evaluateJobStep(4, 1)
  assert.equal(finished.entities.slurm.badge, 'CD · DONE')
  assert.equal(finished.entities.compute.dimmed, true)
  assert.equal(finished.wires['scratch-read'].visible, true)
})

test('Environment modules rewires shell variables, switches versions cleanly, and isolates batch shells', () => {
  const miss = evaluateModuleStep(0, 1)
  assert.equal(miss.entities.os.badge, 'miss')
  assert.equal(miss.entities.spack.badge, 'shared')

  const loaded = evaluateModuleStep(1, 1)
  assert.equal(loaded.entities.lmod.badge, '1 loaded')
  assert.equal(loaded.entities.env.badge, 'login01')
  assert.equal(loaded.wires['env-spack'].visible, false)

  const resolved = evaluateModuleStep(2, 1)
  assert.equal(resolved.entities.spack.badge, 'hit')

  const switched = evaluateModuleStep(3, 1)
  assert.equal(switched.entities.spack.badge, 'hit 11.8')

  const batch = evaluateModuleStep(4, 1)
  assert.equal(batch.entities.batch.badge, 'running')
  assert.equal(batch.entities.env.badge, 'gpu01')
})

test('legacy lesson query URLs normalize into unified hash routes', () => {
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=streams'), 'https://example.org/#lesson/streams')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=gpu-copy-sol'), 'https://example.org/#lesson/host-to-gpu')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=first-job'), 'https://example.org/#lesson/first-job')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=job-walkthrough'), 'https://example.org/#lesson/first-job')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=module-load'), 'https://example.org/#lesson/module-load')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=lmod'), 'https://example.org/#lesson/module-load')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=unknown'), null)
  assert.equal(normalizeLessonUrl('https://example.org/#a30/numa'), null)
})

test('catalog routes default to all entries and preserve domain, scene, and lesson links', () => {
  assert.deepEqual(parseRoute(''), { view: 'atlas', mode: 'all' })
  assert.deepEqual(parseRoute('#atlas'), { view: 'atlas', mode: 'all' })
  assert.deepEqual(parseRoute('#atlas/all'), { view: 'atlas', mode: 'all' })
  assert.deepEqual(parseRoute('#atlas/domains'), { view: 'atlas', mode: 'domains' })
  assert.deepEqual(parseRoute('#atlas/linux'), { view: 'hub', category: 'linux' })
  assert.deepEqual(parseRoute('#a30/numa'), { view: 'workbench', scene: 'a30', nodeTopic: 'numa' })
  assert.deepEqual(parseRoute('#cluster/lmod'), { view: 'workbench', scene: 'cluster', clusterTopic: 'lmod' })
  assert.deepEqual(parseRoute('#lesson/ssh-tmux'), { view: 'lesson', lesson: 'ssh-tmux' })
  assert.deepEqual(parseRoute('#lesson/first-job'), { view: 'lesson', lesson: 'first-job' })
  assert.deepEqual(parseRoute('#lesson/module-load'), { view: 'lesson', lesson: 'module-load' })
  assert.deepEqual(parseRoute('#scenario/first-job'), { view: 'lesson', lesson: 'first-job' })
})

test('think-back trail deduplicates consecutive routes and falls back to owning domain', () => {
  const atlas = { route: '#atlas', label: 'Concept Atlas', glyph: 'cluster', tone: 'slate' as const }
  const linuxHub = { route: '#atlas/linux', label: 'Linux & Remote', glyph: 'cat-linux', tone: 'green' as const }
  let stack = pushTrail([], atlas, '#atlas/linux')
  stack = pushTrail(stack, atlas, '#atlas/linux')
  assert.equal(stack.length, 1)
  stack = pushTrail(stack, linuxHub, '#lesson/streams')
  const popped = popTrail(stack)
  assert.equal(popped.target?.route, '#atlas/linux')
  assert.equal(popped.rest.length, 1)

  const coldLesson = parseRoute('#lesson/streams')
  assert.equal(fallbackBackTarget(coldLesson, initialState)?.route, '#atlas/linux')
  const numaState = updateState(initialState, { type: 'browse', scene: 'a30', topic: 'numa' })
  const numaRoute = parseRoute('#a30/numa')
  assert.equal(activeEntryForState(numaRoute, numaState)?.id, 'numa-locality')
  assert.equal(fallbackBackTarget(numaRoute, numaState)?.route, '#atlas/interconnect')
})

test('catalog filtering narrows by entry kind and multi-term search keywords', () => {
  const stderrMatches = filterEntries({ query: 'stderr 2>' })
  assert.ok(stderrMatches.some(entry => entry.id === 'streams'))
  const scenesOnly = filterEntries({ kind: 'scene' })
  assert.ok(scenesOnly.some(entry => entry.id === 'a30-node'))
  assert.ok(scenesOnly.every(entry => entry.kind === 'scene' || entry.kind === 'planned'))
})