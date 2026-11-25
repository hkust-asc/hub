import { gsap } from 'gsap'
import type { SchematicMotionSpec, SchematicTone } from './types.ts'

export interface ActiveTransfer<WireId extends string = string> {
  id: string
  wire: WireId
  badge: string
  tone?: SchematicTone
  progress: number
}

export interface MotionSample<WireId extends string = string, PartId extends string = string> {
  wireReveal: Record<WireId, number>
  nodePulse: Record<PartId, number>
  transfers: readonly ActiveTransfer<WireId>[]
}

export interface MotionSampler<WireId extends string = string, PartId extends string = string> {
  sample(elapsedMs: number, reducedMotion: boolean): MotionSample<WireId, PartId>
  destroy(): void
}

export function createMotionSampler<WireId extends string, PartId extends string>(
  wireIds: readonly WireId[],
  nodeIds: readonly PartId[],
  spec: SchematicMotionSpec<WireId, PartId>,
): MotionSampler<WireId, PartId> {
  const tl = gsap.timeline({ paused: true })
  const revealTargets = Object.fromEntries(wireIds.map(id => [id, { value: 1 }])) as Record<WireId, { value: number }>
  const pulseTargets = Object.fromEntries(nodeIds.map(id => [id, { value: 0 }])) as Record<PartId, { value: number }>
  const transferChannels = (spec.transfers ?? []).map(item => ({
    spec: item,
    state: { active: 0, progress: 0 },
  }))

  for (const id of wireIds) {
    tl.set(revealTargets[id], { value: 1 }, 0)
  }
  for (const id of nodeIds) {
    tl.set(pulseTargets[id], { value: 0 }, 0)
  }
  for (const channel of transferChannels) {
    tl.set(channel.state, { active: 0, progress: 0 }, 0)
  }

  for (const reveal of spec.wireReveals ?? []) {
    const startSec = reveal.startMs / 1000
    const durationSec = (reveal.durationMs ?? 550) / 1000
    const target = revealTargets[reveal.wire]
    tl.set(target, { value: 0 }, startSec)
    tl.to(target, {
      value: 1,
      duration: durationSec,
      ease: reveal.ease ?? 'power2.out',
    }, startSec)
  }

  for (const channel of transferChannels) {
    const startSec = channel.spec.startMs / 1000
    const endSec = channel.spec.endMs / 1000
    const durationSec = Math.max(0.05, endSec - startSec)
    tl.set(channel.state, { active: 1, progress: 0 }, startSec)
    tl.to(channel.state, {
      progress: 1,
      duration: durationSec,
      ease: channel.spec.ease ?? 'power1.inOut',
    }, startSec)
    tl.set(channel.state, { active: 0 }, endSec)
  }

  for (const pulse of spec.pulses ?? []) {
    const startSec = pulse.startMs / 1000
    const halfSec = ((pulse.durationMs ?? 560) / 1000) / 2
    const target = pulseTargets[pulse.node]
    tl.to(target, { value: 1, duration: halfSec, ease: 'power2.out' }, startSec)
    tl.to(target, { value: 0, duration: halfSec, ease: 'power2.in' }, startSec + halfSec)
  }

  // Anchor total duration so clamping at the end of the timeline stays exact.
  tl.set({}, {}, spec.durationMs / 1000)

  const staticReveals = Object.fromEntries(wireIds.map(id => [id, 1])) as Record<WireId, number>
  const zeroPulses = Object.fromEntries(nodeIds.map(id => [id, 0])) as Record<PartId, number>

  return {
    sample(elapsedMs: number, reducedMotion: boolean): MotionSample<WireId, PartId> {
      if (reducedMotion) {
        return {
          wireReveal: staticReveals,
          nodePulse: zeroPulses,
          transfers: [],
        }
      }
      const clampedSec = Math.max(0, Math.min(spec.durationMs, elapsedMs)) / 1000
      tl.time(clampedSec)
      const wireReveal = {} as Record<WireId, number>
      for (const id of wireIds) wireReveal[id] = revealTargets[id].value
      const nodePulse = {} as Record<PartId, number>
      for (const id of nodeIds) nodePulse[id] = pulseTargets[id].value
      const transfers: ActiveTransfer<WireId>[] = []
      for (const { spec: item, state } of transferChannels) {
        if (state.active >= 0.5 && elapsedMs >= item.startMs && elapsedMs < item.endMs) {
          transfers.push({
            id: item.id,
            wire: item.wire,
            badge: item.badge,
            tone: item.tone,
            progress: state.progress,
          })
        }
      }
      return { wireReveal, nodePulse, transfers }
    },
    destroy(): void {
      tl.kill()
    },
  }
}
