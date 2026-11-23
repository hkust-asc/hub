import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, jobSteps, transferPath, updateState } from '../src/model.ts'
import { beats, durationMs, frameAt, positionAt, updatePlayback } from '../src/host-to-gpu/story.ts'
import type { PlaybackState } from '../src/host-to-gpu/story.ts'

test('a local H2D path does not cross the inter-socket link', () => {
  assert.deepEqual(transferPath('h2d', 'local'), ['memory-local', 'pcie-link', 'gpu-link'])
})

test('remote placement adds an inter-socket crossing', () => {
  assert.deepEqual(transferPath('h2d', 'remote'), ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link'])
})

test('D2H reverses the same transfer path without changing H2D', () => {
  const forward = transferPath('h2d', 'remote')
  assert.deepEqual(transferPath('d2h', 'remote'), forward.toReversed())
  assert.deepEqual(transferPath('h2d', 'remote'), forward)
})

test('a step without a copy shows neither placement route', () => {
  assert.deepEqual(transferPath(null, 'local'), [])
  assert.deepEqual(transferPath(null, 'remote'), [])
})

test('scenario navigation clamps at its boundaries and selects the matching topic', () => {
  assert.equal(updateState(initialState, { type: 'step', step: -1 }).step, 0)
  const last = updateState(initialState, { type: 'step', step: 100 })
  assert.equal(last.step, jobSteps.length - 1)
  assert.equal(last.selected, 'slurm')
})

test('playback reaches completion, stops, and can replay from the beginning', () => {
  let state = updateState(initialState, { type: 'play' })
  for (let count = 0; count < jobSteps.length; count++) state = updateState(state, { type: 'tick' })
  assert.equal(state.step, jobSteps.length - 1)
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
  assert.deepEqual(updateState(changed, { type: 'reset' }), { ...initialState, mode: 'scenario', clusterSelected: 'login', selected: 'cpu' })
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
  const transferIndex = jobSteps.findIndex(step => step.visual?.transfer === 'h2d')
  const transfer = updateState(started, { type: 'step', step: transferIndex })
  assert.equal(transfer.scene, 'a30')
  assert.deepEqual(transferPath(jobSteps[transfer.step]!.visual!.transfer, 'remote'), ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link'])
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

test('inspection is a reversible detour, including at the final step', () => {
  for (const [step, action] of [
    [5, { type: 'select', topic: 'nic' }],
    [jobSteps.length - 1, { type: 'cluster-select', topic: 'lmod' }],
  ] as const) {
    const lesson = updateState({ ...initialState, placement: 'remote' }, { type: 'step', step })
    const inspected = updateState({ ...lesson, playing: true }, action)
    assert.equal(inspected.inspecting, true)
    assert.equal(inspected.playing, false)
    assert.equal(inspected.step, lesson.step)
    assert.equal(action.type === 'select' ? inspected.selected : inspected.clusterSelected, action.topic)
    assert.deepEqual(updateState(inspected, { type: 'return-to-lesson' }), lesson)
  }
})

test('resuming after inspection restores the teaching subject before advancing', () => {
  const lesson = updateState(initialState, { type: 'step', step: 5 })
  const inspected = updateState(lesson, { type: 'select', topic: 'cpu' })
  const resumed = updateState(inspected, { type: 'play' })
  assert.equal(resumed.inspecting, false)
  assert.equal(resumed.selected, 'pcie')
  assert.equal(resumed.step, 5)
  assert.equal(resumed.playing, true)
  const next = updateState(resumed, { type: 'tick' })
  assert.equal(next.step, 6)
  assert.equal(next.selected, 'gpu')
})

test('seeking reconstructs a step independently of playback and inspection history', () => {
  const start = updateState({ ...initialState, placement: 'remote' }, { type: 'start-scenario', scenario: 'first-job' })
  const last = jobSteps.length - 1
  let traveled = updateState(start, { type: 'play' })
  for (let tick = 0; tick < last; tick++) traveled = updateState(traveled, { type: 'tick' })
  traveled = updateState(traveled, { type: 'cluster-select', topic: 'spack' })
  for (let step = last; step >= 0; step--) {
    traveled = updateState(traveled, { type: 'step', step })
    assert.deepEqual(traveled, updateState(start, { type: 'step', step }))
  }
})

test('changing placement pauses on the same copy step and changes only its route', () => {
  const copying = updateState(updateState(initialState, { type: 'step', step: 5 }), { type: 'play' })
  const remote = updateState(copying, { type: 'placement', placement: 'remote' })
  assert.deepEqual(remote, { ...copying, placement: 'remote', playing: false })
  assert.deepEqual(transferPath(jobSteps[remote.step]!.visual!.transfer, remote.placement), ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link'])
})

test('leaving or restarting the walkthrough clears inspection', () => {
  const lesson = updateState(initialState, { type: 'step', step: 6 })
  const inspected = updateState(lesson, { type: 'select', topic: 'cpu' })
  const explored = updateState(inspected, { type: 'mode', mode: 'explore' })
  assert.equal(explored.inspecting, false)
  assert.equal(explored.selected, 'cpu')
  const restarted = updateState(inspected, { type: 'start-scenario', scenario: 'first-job' })
  assert.equal(restarted.inspecting, false)
  assert.equal(restarted.step, 0)
  assert.equal(restarted.scene, 'cluster')
  assert.equal(restarted.clusterSelected, 'login')
})

const stopped: PlaybackState = { positionMs: 0, startedAt: null, inspection: null }

test('the GPU lesson advances across a beat boundary and resumes from a fractional position', () => {
  const starting = updatePlayback(stopped, { type: 'play' }, 100)
  const boundary = beats[1]!.startMs
  assert.equal(frameAt(positionAt(starting, 100 + boundary - 1)).index, 0)
  assert.equal(frameAt(positionAt(starting, 100 + boundary)).index, 1)
  const paused = updatePlayback(starting, { type: 'pause' }, 100 + boundary + 329.5)
  assert.equal(positionAt(paused, 30000), boundary + 329.5)
  const resumed = updatePlayback(paused, { type: 'play' }, 30000)
  assert.equal(positionAt(resumed, 30190), boundary + 519.5)
})

test('GPU lesson inspection preserves the exact timestamp and prior playback intent', () => {
  const playing = updatePlayback(stopped, { type: 'play' }, 1000)
  for (const state of [playing, updatePlayback(playing, { type: 'pause' }, 2477.5)]) {
    const inspection = updatePlayback(state, { type: 'inspect' }, 2477.5)
    assert.equal(positionAt(inspection, 9000), 1477.5)
    const back = updatePlayback(inspection, { type: 'inspect' }, 9000)
    assert.equal(positionAt(back, 9000), 1477.5)
    assert.equal(positionAt(back, 9100), state.startedAt === null ? 1477.5 : 1577.5)
  }
})

test('seeking backward reconstructs the in-flight and settled copy independently', () => {
  const start = beats.find(beat => beat.copy?.direction === 'h2d')!.startMs
  const later = updatePlayback(stopped, { type: 'seek', positionMs: durationMs }, 0)
  const during = frameAt(positionAt(updatePlayback(later, { type: 'seek', positionMs: start + 1350 }, 4000), 4000))
  const after = frameAt(start + 3000)
  assert.equal(during.packetProgress, 0.5)
  assert.notEqual(during.note, after.note)
  assert.equal(after.packetProgress, null)
  assert.equal(frameAt(beats[4]!.startMs + 1350).beat.copy?.direction, 'd2h')
})

test('the GPU lesson stops at the final beat and play after completion starts at zero', () => {
  const running = updatePlayback(stopped, { type: 'play' }, 0)
  const end = updatePlayback(running, { type: 'pause' }, durationMs + 500)
  assert.equal(frameAt(positionAt(end, durationMs + 500)).beat.label, 'Finish')
  const replay = updatePlayback(end, { type: 'play' }, durationMs + 500)
  assert.equal(positionAt(replay, durationMs + 500), 0)
})