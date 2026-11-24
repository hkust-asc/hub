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
import { initialState, jobSteps, scenarios, stages, transferPath, updateState } from '../src/model.ts'
import { frameAt as gpuFrameAt, timeline as gpuTimeline } from '../src/host-to-gpu/story.ts'
import { frameAt as filesystemFrameAt, timeline as filesystemTimeline } from '../src/linux-fs/story.ts'
import { frameAt as sshFrameAt, timeline as sshTimeline } from '../src/ssh-tmux/story.ts'
import { frameAt as streamsFrameAt, timeline as streamsTimeline } from '../src/streams/story.ts'
import type { PlaybackState } from '../src/timed-lesson/timeline.ts'

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

test('scenario navigation clamps at its boundaries and selects the matching topic', () => {
  assert.equal(updateState(initialState, { type: 'step', step: -1 }).step, 0)
  const last = updateState(initialState, { type: 'step', step: 100 })
  assert.equal(last.step, stages.length - 1)
  assert.equal(last.selected, 'slurm')
})

test('playback reaches completion, stops, and can replay from the beginning', () => {
  let state = updateState(initialState, { type: 'play' })
  for (let count = 0; count < stages.length; count++) state = updateState(state, { type: 'tick' })
  assert.equal(state.step, stages.length - 1)
  assert.equal(state.playing, false)
  state = updateState(state, { type: 'play' })
  assert.equal(state.step, 0)
  assert.equal(state.playing, true)
})

test('exploration and explicit selection stop playback without losing placement', () => {
  const playing = updateState({ ...initialState, placement: 'remote' }, { type: 'play' })
  const selected = updateState(playing, { type: 'select', topic: 'numa' })
  assert.equal(selected.playing, false)
  assert.equal(selected.placement, 'remote')
  assert.equal(updateState(playing, { type: 'mode', mode: 'explore' }).playing, false)
})

test('reset restores the initial placement and view while preserving the active mode', () => {
  const changed = { ...initialState, mode: 'scenario' as const, placement: 'remote' as const, exploded: true, step: 3, playing: true }
  assert.deepEqual(updateState(changed, { type: 'reset' }), { ...initialState, mode: 'scenario', scene: 'a30', selected: 'slurm' })
})

test('a connected scenario owns the scene and subject at each step', () => {
  let state = updateState(initialState, { type: 'start-scenario', scenario: 'first-job' })
  assert.equal(state.scene, 'cluster')
  assert.equal(state.clusterSelected, 'login')
  for (let step = 0; step < jobSteps.length; step++) {
    state = updateState(state, { type: 'step', step })
    assert.equal(state.scene, jobSteps[step]!.scene)
    assert.equal(state.clusterSelected, jobSteps[step]!.clusterTopic)
    assert.equal(state.selected, jobSteps[step]!.topic)
  }
})

test('the connected scenario enters the node and returns to shared storage', () => {
  const started = updateState(initialState, { type: 'start-scenario', scenario: 'first-job' })
  const transferIndex = jobSteps.findIndex(step => step.nodeStep === 2)
  const transfer = updateState(started, { type: 'step', step: transferIndex })
  assert.equal(transfer.scene, 'a30')
  assert.deepEqual(transferPath(jobSteps[transfer.step]!.nodeStep!, 'remote'), ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link'])
  const save = updateState(transfer, { type: 'step', step: 8 })
  assert.equal(save.scene, 'cluster')
  assert.equal(save.clusterSelected, 'storage')
})

test('manual navigation pauses without losing scenario position or node placement', () => {
  const started = updateState(initialState, { type: 'start-scenario', scenario: 'first-job' })
  const transfer = updateState({ ...started, placement: 'remote', exploded: true }, { type: 'step', step: 5 })
  const playing = updateState(transfer, { type: 'play' })
  const overview = updateState(playing, { type: 'navigate', scene: 'cluster' })
  assert.equal(overview.playing, false)
  assert.equal(overview.mode, 'explore')
  assert.equal(overview.step, 5)
  assert.equal(overview.placement, 'remote')
  assert.equal(overview.exploded, true)
  const resumed = updateState(overview, { type: 'play' })
  assert.equal(resumed.scene, 'a30')
  assert.equal(resumed.step, 5)
})

test('switching scenarios resets the step and cannot retain the previous scene', () => {
  const last = updateState(updateState(initialState, { type: 'start-scenario', scenario: 'first-job' }), { type: 'step', step: 9 })
  const gpu = updateState(last, { type: 'start-scenario', scenario: 'gpu-copy' })
  assert.equal(gpu.step, 0)
  assert.equal(gpu.scene, 'a30')
  assert.equal(gpu.selected, 'slurm')
})

test('both scenario lengths clamp, finish, and replay independently', () => {
  for (const scenario of ['gpu-copy', 'first-job'] as const) {
    let state = updateState(initialState, { type: 'start-scenario', scenario })
    state = updateState(state, { type: 'step', step: 100 })
    assert.equal(state.step, scenarios[scenario].steps.length - 1)
    state = updateState(state, { type: 'play' })
    assert.equal(state.step, 0)
    for (let tick = 0; tick <= scenarios[scenario].steps.length; tick++) state = updateState(state, { type: 'tick' })
    assert.equal(state.playing, false)
    assert.equal(state.step, scenarios[scenario].steps.length - 1)
  }
})

test('browsing a software subject selects its owning scene and pauses the journey', () => {
  const started = updateState(initialState, { type: 'start-scenario', scenario: 'first-job' })
  const running = updateState({ ...updateState(started, { type: 'step', step: 5 }), placement: 'remote', exploded: true }, { type: 'play' })
  const software = updateState(running, { type: 'browse', scene: 'cluster', topic: 'lmod' })
  assert.equal(software.scene, 'cluster')
  assert.equal(software.clusterSelected, 'lmod')
  assert.equal(software.mode, 'explore')
  assert.equal(software.playing, false)
  assert.equal(software.step, 5)
  assert.equal(software.placement, 'remote')
  assert.equal(software.exploded, true)
  const resumed = updateState(software, { type: 'mode', mode: 'scenario' })
  assert.equal(resumed.scene, 'a30')
  assert.equal(resumed.step, 5)
})

test('browsing node components and the overview is one coherent navigation action', () => {
  const node = updateState(initialState, { type: 'browse', scene: 'a30', topic: 'numa' })
  assert.equal(node.scene, 'a30')
  assert.equal(node.selected, 'numa')
  const overview = updateState(node, { type: 'browse', scene: 'cluster' })
  assert.equal(overview.clusterSelected, 'a30')
  assert.equal(overview.mode, 'explore')
  const returned = updateState(overview, { type: 'browse', scene: 'a30' })
  assert.equal(returned.selected, 'numa')
})

test('resetting the node view does not rewind, pause, or change the active scenario', () => {
  const started = updateState(initialState, { type: 'start-scenario', scenario: 'first-job' })
  const running = updateState({ ...updateState(started, { type: 'step', step: 5 }), placement: 'remote', exploded: true }, { type: 'play' })
  assert.deepEqual(updateState(running, { type: 'reset-view' }), { ...running, placement: 'local', exploded: false })
})

test('at normal speed each timed lesson takes twice its authored duration', () => {
  const playing: PlaybackState = { positionMs: 0, startedAt: 0, inspection: null, rate: 1 }
  for (const timeline of [gpuTimeline, sshTimeline, streamsTimeline, filesystemTimeline]) {
    const nextBeat = timeline.beats[1]!.startMs * 2
    assert.equal(timeline.beatAt(timeline.positionAt(playing, nextBeat - 1)).index, 0)
    assert.equal(timeline.beatAt(timeline.positionAt(playing, nextBeat)).index, 1)
    assert.equal(timeline.positionAt(playing, timeline.durationMs * 2 - 1), timeline.durationMs - 0.5)
    assert.equal(timeline.positionAt(playing, timeline.durationMs * 2), timeline.durationMs)
  }
})

test('changing playback speed preserves the fractional playhead and inspection intent', () => {
  const state: PlaybackState = { positionMs: 4000, startedAt: 1000, inspection: null, rate: 1 }
  const fast = gpuTimeline.update(state, { type: 'rate', rate: 2 }, 1885)
  assert.equal(gpuTimeline.positionAt(fast, 1885), 4442.5)
  const inspected = gpuTimeline.update(fast, { type: 'inspect' }, 2000)
  const slow = gpuTimeline.update(inspected, { type: 'rate', rate: .5 }, 6000)
  assert.equal(gpuTimeline.positionAt(slow, 6500), 4557.5)
  const resumed = gpuTimeline.update(slow, { type: 'inspect' }, 7000)
  assert.equal(gpuTimeline.positionAt(resumed, 8000), 4807.5)
})

test('copying retains the source, and cross-socket changes the arrival and the callout', () => {
  const copyIn = gpuTimeline.beats.find(beat => beat.id === 'copy-in')!.startMs
  const local = gpuFrameAt(copyIn + 2800, 'local')
  assert.equal(local.host, 'Input')
  assert.equal(local.device, 'Input')
  assert.equal(local.copy?.progress, null)
  const remote = gpuFrameAt(copyIn + 2800, 'remote')
  assert.equal(remote.host, 'Input')
  assert.equal(remote.device, null)
  assert.equal(remote.note.anchor, 'socket-link')
  assert.ok(remote.copy?.progress)
  assert.equal(gpuFrameAt(copyIn + 3300, 'remote').device, 'Input')
})

test('seeking reconstructs computation, the return copy, and buffer release', () => {
  const done = gpuFrameAt(gpuTimeline.durationMs, 'local')
  assert.equal(done.host, null)
  assert.equal(done.device, null)
  const compute = gpuTimeline.beats.find(beat => beat.id === 'compute')!.startMs
  assert.equal(gpuFrameAt(compute + 1, 'local').signal?.kind, 'launch')
  assert.equal(gpuFrameAt(compute + 3199, 'local').device, 'Input')
  const computed = gpuFrameAt(compute + 3200, 'local')
  assert.equal(computed.host, 'Input')
  assert.equal(computed.device, 'Result')
  assert.equal(computed.copy, null)
  const copyOut = gpuTimeline.beats.find(beat => beat.id === 'copy-out')!.startMs
  assert.equal(gpuFrameAt(copyOut + 2499, 'local').host, 'Input')
  const copied = gpuFrameAt(copyOut + 2500, 'local')
  assert.equal(copied.host, 'Result')
  assert.equal(copied.device, 'Result')
})

test('the SSH loss and the foreground terminal closing are distinct moments', () => {
  const shell = sshTimeline.beats.find(beat => beat.id === 'shell')!.startMs
  const dropped = sshFrameAt(shell + 2600)
  assert.equal(dropped.connection.status, 'lost')
  assert.equal(dropped.shell, 'open')
  assert.equal(dropped.process?.status, 'running')
  const closed = sshFrameAt(shell + 3400)
  assert.equal(closed.shell, 'closed')
  assert.equal(closed.process?.status, 'stopped')
  assert.equal(closed.process?.progress, sshFrameAt(shell + 5000).process?.progress)
  assert.equal(closed.file, false)
})

test('detaching leaves SSH connected, and the task advances across the later disconnect', () => {
  const detach = sshTimeline.beats.find(beat => beat.id === 'detach')!.startMs
  const unplugged = sshFrameAt(detach + 600)
  assert.equal(unplugged.tmux, 'detached')
  assert.equal(unplugged.connection.status, 'connected')
  const offline = sshFrameAt(detach + 4000)
  assert.equal(offline.connection.status, 'lost')
  assert.equal(offline.shell, 'closed')
  assert.equal(offline.process?.terminal, 'tmux')
  assert.equal(offline.process?.status, 'running')
  assert.ok(offline.process!.progress > unplugged.process!.progress)
})

test('reattaching does not restart the task and seeking before completion hides the file', () => {
  const reconnect = sshTimeline.beats.find(beat => beat.id === 'return')!.startMs
  const done = sshFrameAt(sshTimeline.durationMs)
  assert.equal(done.process?.status, 'done')
  assert.equal(done.file, true)
  const before = sshFrameAt(reconnect + 1349)
  const attached = sshFrameAt(reconnect + 1350)
  assert.equal(before.tmux, 'detached')
  assert.equal(attached.tmux, 'attached')
  assert.ok(attached.process!.progress >= before.process!.progress)
  assert.equal(sshFrameAt(reconnect + 2199).file, false)
  assert.equal(sshFrameAt(0).tmux, 'absent')
  assert.equal(sshFrameAt(0).process, null)
})

test('redirecting stdout leaves stderr on the terminal and preserves the output order', () => {
  const plain = streamsFrameAt(5000)
  assert.deepEqual(plain.contents.terminal.map(line => line.channel), ['stderr', 'stdout', 'stderr'])
  assert.equal(plain.showPasscode, false)
  assert.equal(plain.showErrors, false)

  const redirected = streamsFrameAt(11000)
  assert.deepEqual(redirected.contents.passcode.map(line => line.channel), ['stdout'])
  assert.deepEqual(redirected.contents.terminal.map(line => line.channel), ['stderr', 'stderr'])
  assert.equal(redirected.showErrors, false)
})

test('prediction withholds port 2 routing and reveal separates both files', () => {
  const pending = streamsFrameAt(14700 - 1)
  assert.equal(pending.route.stderr, null)
  assert.equal(pending.showErrors, true)
  assert.equal(pending.quiet, false)
  assert.equal(pending.inFlight.length, 0)
  assert.equal(pending.contents.errors.length, 0)

  const revealed = streamsFrameAt(14700)
  assert.equal(revealed.route.stderr, 'errors')
  assert.equal(revealed.contents.errors.length, 0)
  const settled = streamsFrameAt(17500)
  assert.equal(settled.quiet, true)
  assert.deepEqual(settled.contents.terminal, [])
  assert.deepEqual(settled.contents.passcode.map(line => line.channel), ['stdout'])
  assert.deepEqual(settled.contents.errors.map(line => line.channel), ['stderr', 'stderr'])

  const rewind = streamsFrameAt(2000)
  assert.equal(rewind.showPasscode, false)
  assert.equal(rewind.showErrors, false)
  assert.deepEqual(rewind.inFlight.map(flight => flight.destination), ['terminal', 'terminal', 'terminal'])
})

test('listing dotfiles does not change the working directory', () => {
  const before = filesystemFrameAt(8699)
  const listed = filesystemFrameAt(8700)
  assert.equal(before.cwd, 'user-home')
  assert.equal(listed.cwd, before.cwd)
  assert.equal(before.showDotfile, false)
  assert.equal(listed.showDotfile, true)
})

test('relative and absolute traces resolve from different starting points', () => {
  const relative = filesystemFrameAt(12300)
  assert.equal(relative.trace?.kind, 'relative')
  assert.equal(relative.cwd, 'workspace')
  const resolving = filesystemFrameAt(14500)
  assert.equal(resolving.trace?.kind, 'absolute')
  assert.ok(resolving.trace!.progress > 0 && resolving.trace!.progress < 1)
  assert.equal(resolving.cwd, 'workspace')
  assert.equal(filesystemFrameAt(15500).cwd, 'quest')
})

test('rewinding from shared mounts restores the tree before the storage reveal', () => {
  const mount = filesystemFrameAt(22500)
  assert.equal(mount.mounts, 'shared')
  assert.equal(mount.cwd, null)
  assert.equal(filesystemFrameAt(20000).mounts, 'local')
  const earlier = filesystemFrameAt(7000)
  assert.equal(earlier.mounts, 'none')
  assert.equal(earlier.showDotfile, false)
  assert.equal(earlier.cwd, 'user-home')
})

test('legacy lesson query URLs normalize into unified hash routes', () => {
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=streams'), 'https://example.org/#lesson/streams')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=gpu-copy-sol'), 'https://example.org/#lesson/host-to-gpu')
  assert.equal(normalizeLessonUrl('https://example.org/?lesson=unknown'), null)
  assert.equal(normalizeLessonUrl('https://example.org/#a30/numa'), null)
})

test('catalog routes preserve direct scene, domain hub, and lesson links', () => {
  assert.deepEqual(parseRoute(''), { view: 'atlas', mode: 'domains' })
  assert.deepEqual(parseRoute('#atlas/all'), { view: 'atlas', mode: 'all' })
  assert.deepEqual(parseRoute('#atlas/linux'), { view: 'hub', category: 'linux' })
  assert.deepEqual(parseRoute('#a30/numa'), { view: 'workbench', scene: 'a30', nodeTopic: 'numa' })
  assert.deepEqual(parseRoute('#cluster/lmod'), { view: 'workbench', scene: 'cluster', clusterTopic: 'lmod' })
  assert.deepEqual(parseRoute('#lesson/ssh-tmux'), { view: 'lesson', lesson: 'ssh-tmux' })
  assert.deepEqual(parseRoute('#scenario/first-job'), { view: 'workbench', scene: 'cluster', scenario: 'first-job' })
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