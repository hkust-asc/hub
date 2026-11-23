import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, jobSteps, scenarios, stages, transferPath, updateState } from '../src/model.ts'

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

test('inspection is a reversible detour, including at the final step', () => {
  for (const step of [2, 5]) {
    const lesson = updateState({ ...initialState, placement: 'remote' }, { type: 'step', step })
    const inspected = updateState({ ...lesson, playing: true }, { type: 'select', topic: 'nic' })
    assert.equal(inspected.inspecting, true)
    assert.equal(inspected.playing, false)
    assert.equal(inspected.step, lesson.step)
    assert.equal(inspected.selected, 'nic')
    assert.deepEqual(updateState(inspected, { type: 'return-to-lesson' }), lesson)
  }
})

test('resuming after inspection restores the teaching subject before advancing', () => {
  const lesson = updateState(initialState, { type: 'step', step: 2 })
  const inspected = updateState(lesson, { type: 'select', topic: 'cpu' })
  const resumed = updateState(inspected, { type: 'play' })
  assert.equal(resumed.inspecting, false)
  assert.equal(resumed.selected, 'pcie')
  assert.equal(resumed.step, 2)
  assert.equal(resumed.playing, true)
  const next = updateState(resumed, { type: 'tick' })
  assert.equal(next.step, 3)
  assert.equal(next.selected, 'gpu')
})

test('seeking reconstructs a step independently of playback and inspection history', () => {
  for (const scenario of ['gpu-copy', 'first-job'] as const) {
    const start = updateState({ ...initialState, placement: 'remote' }, { type: 'start-scenario', scenario })
    const last = scenarios[scenario].steps.length - 1
    let traveled = updateState(start, { type: 'play' })
    for (let tick = 0; tick < last; tick++) traveled = updateState(traveled, { type: 'tick' })
    traveled = updateState(traveled, { type: 'cluster-select', topic: 'spack' })
    traveled = updateState(traveled, { type: 'select', topic: 'nic' })
    for (let step = last; step >= 0; step--) {
      traveled = updateState(traveled, { type: 'step', step })
      assert.deepEqual(traveled, updateState(start, { type: 'step', step }))
    }
  }
})

test('changing placement pauses on the same copy step and changes only its route', () => {
  const copying = updateState(updateState(initialState, { type: 'step', step: 2 }), { type: 'play' })
  const remote = updateState(copying, { type: 'placement', placement: 'remote' })
  assert.deepEqual(remote, { ...copying, placement: 'remote', playing: false })
  assert.deepEqual(transferPath(remote.step, remote.placement), ['memory-remote', 'socket-link', 'pcie-link', 'gpu-link'])
})

test('leaving or switching scenarios clears the inspection detour', () => {
  const lesson = updateState(initialState, { type: 'step', step: 3 })
  const inspected = updateState(lesson, { type: 'select', topic: 'cpu' })
  const explored = updateState(inspected, { type: 'mode', mode: 'explore' })
  assert.equal(explored.inspecting, false)
  assert.equal(explored.selected, 'cpu')
  const switched = updateState(inspected, { type: 'start-scenario', scenario: 'first-job' })
  assert.equal(switched.inspecting, false)
  assert.equal(switched.clusterSelected, 'login')
})