import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, stages, transferPath, updateState } from '../src/model.ts'

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
  assert.deepEqual(updateState(changed, { type: 'reset' }), { ...initialState, mode: 'scenario', selected: 'slurm' })
})