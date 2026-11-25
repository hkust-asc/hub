import type { LessonScene } from '../timed-lesson/player'
import type { ComputedNodeBox, SchematicLayoutPair } from './layout.ts'
import { createMotionSampler } from './motion.ts'
import type { SchematicRow, SchematicSceneSpec, SchematicTone } from './types.ts'
import './schematic.css'

const tones: readonly SchematicTone[] = ['neutral', 'mint', 'amber', 'blue', 'coral']

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface RowSlotEls {
  group: SVGGElement
  highlightBg: SVGRectElement
  pillBg: SVGRectElement
  codeText: SVGTextElement
  kvText: SVGTextElement
  kvKey: SVGTSpanElement
  kvVal: SVGTSpanElement
  pillLabel: SVGTextElement
  pillMeta: SVGTextElement
}

interface NodeSlotEls {
  group: SVGGElement
  clipRect: SVGRectElement
  card: SVGRectElement
  stripe: SVGPathElement
  kicker: SVGTextElement
  title: SVGTextElement
  badgeGroup: SVGGElement
  badgeRect: SVGRectElement
  badgeText: SVGTextElement
  rule: SVGPathElement
  rows: RowSlotEls[]
}

export function createSchematicScene<PartId extends string, WireId extends string>(
  stage: HTMLElement,
  spec: SchematicSceneSpec<PartId, WireId>,
  layouts: SchematicLayoutPair<PartId, WireId>,
): LessonScene {
  stage.classList.add('schematic-stage')

  const nodeIds = spec.nodes.map(node => node.id)
  const wireIds = spec.wires.map(wire => wire.id)
  const transfers = spec.motion.transfers ?? []

  stage.innerHTML = `<svg class="story-art schematic-art" viewBox="0 0 ${layouts.wide.width} ${layouts.wide.height}" role="group" aria-labelledby="${spec.id}-title ${spec.id}-desc">
    <title id="${spec.id}-title">${escapeHtml(spec.svgTitle)}</title>
    <desc id="${spec.id}-desc">${escapeHtml(spec.svgDesc)}</desc>
    <defs>
      ${tones.map(tone => `<marker id="${spec.id}-arrow-${tone}" data-tone="${tone}" viewBox="0 0 8 8" refX="7.4" refY="4" markerWidth="6.8" markerHeight="6.8" orient="auto" markerUnits="userSpaceOnUse"><path class="sch-arrow" d="M 0 0 L 8 4 L 0 8 Z"/></marker>`).join('')}
      ${spec.nodes.map(node => `<clipPath id="${spec.id}-clip-${node.id}"><rect x="1" y="1" width="${node.wide.width - 2}" height="${node.wide.height - 2}" rx="7"/></clipPath>`).join('')}
    </defs>
    <g class="sch-wires-base" aria-hidden="true">
      ${spec.wires.map(wire => `<path class="sch-wire-base" data-wire-base="${wire.id}"/>`).join('')}
    </g>
    <g class="sch-wires" aria-hidden="true">
      ${spec.wires.map(wire => `<path class="sch-wire" data-wire="${wire.id}" data-tone="${wire.tone}" hidden/>`).join('')}
    </g>
    <g class="sch-nodes">
      ${spec.nodes.map(node => `
        <g class="sch-node" data-lesson-part="${node.id}" data-tone="neutral" role="button" tabindex="-1" aria-label="${escapeHtml(node.part.name)}" aria-pressed="false">
          <rect class="sch-card" rx="8"/>
          <path class="sch-stripe"/>
          <g clip-path="url(#${spec.id}-clip-${node.id})">
            <text class="sch-kicker"></text>
            <text class="sch-title"></text>
            <g class="sch-badge" hidden>
              <rect class="sch-badge-bg" rx="4" height="16"/>
              <text class="sch-badge-text"></text>
            </g>
            <path class="sch-rule"/>
            ${Array.from({ length: node.maxRows }, (_, i) => `
              <g class="sch-row" data-row="${i}" hidden>
                <rect class="sch-row-bg" rx="4" hidden/>
                <rect class="sch-pill-bg" rx="4" hidden/>
                <text class="sch-code" hidden></text>
                <text class="sch-kv" hidden><tspan class="sch-kv-key"></tspan><tspan class="sch-kv-val"></tspan></text>
                <text class="sch-pill-label" hidden></text>
                <text class="sch-pill-meta" text-anchor="end" hidden></text>
              </g>
            `).join('')}
          </g>
        </g>
      `).join('')}
    </g>
    <g class="sch-packets" aria-hidden="true">
      ${transfers.map(item => {
        const width = Math.max(40, item.badge.length * 6.8 + 14)
        return `<g class="sch-packet" data-packet="${item.id}" data-tone="${item.tone ?? 'mint'}" hidden><rect x="${-width / 2}" y="-9.5" width="${width}" height="19" rx="4.5"/><text y="3.5">${escapeHtml(item.badge)}</text></g>`
      }).join('')}
    </g>
  </svg>`

  const art = stage.querySelector<SVGSVGElement>('.schematic-art')!
  const nodeSpecs = new Map(spec.nodes.map(node => [node.id, node]))
  const wireSpecs = new Map(spec.wires.map(wire => [wire.id, wire]))

  const nodeEls = new Map<PartId, NodeSlotEls>()
  for (const node of spec.nodes) {
    const group = art.querySelector<SVGGElement>(`[data-lesson-part="${node.id}"]`)!
    const clipRect = art.querySelector<SVGRectElement>(`#${CSS.escape(`${spec.id}-clip-${node.id}`)} rect`)!
    const rows = [...group.querySelectorAll<SVGGElement>('.sch-row')].map<RowSlotEls>(rowGroup => ({
      group: rowGroup,
      highlightBg: rowGroup.querySelector<SVGRectElement>('.sch-row-bg')!,
      pillBg: rowGroup.querySelector<SVGRectElement>('.sch-pill-bg')!,
      codeText: rowGroup.querySelector<SVGTextElement>('.sch-code')!,
      kvText: rowGroup.querySelector<SVGTextElement>('.sch-kv')!,
      kvKey: rowGroup.querySelector<SVGTSpanElement>('.sch-kv-key')!,
      kvVal: rowGroup.querySelector<SVGTSpanElement>('.sch-kv-val')!,
      pillLabel: rowGroup.querySelector<SVGTextElement>('.sch-pill-label')!,
      pillMeta: rowGroup.querySelector<SVGTextElement>('.sch-pill-meta')!,
    }))
    nodeEls.set(node.id, {
      group,
      clipRect,
      card: group.querySelector<SVGRectElement>('.sch-card')!,
      stripe: group.querySelector<SVGPathElement>('.sch-stripe')!,
      kicker: group.querySelector<SVGTextElement>('.sch-kicker')!,
      title: group.querySelector<SVGTextElement>('.sch-title')!,
      badgeGroup: group.querySelector<SVGGElement>('.sch-badge')!,
      badgeRect: group.querySelector<SVGRectElement>('.sch-badge-bg')!,
      badgeText: group.querySelector<SVGTextElement>('.sch-badge-text')!,
      rule: group.querySelector<SVGPathElement>('.sch-rule')!,
      rows,
    })
  }

  const wireBaseEls = new Map(
    spec.wires.map(wire => [wire.id, art.querySelector<SVGPathElement>(`[data-wire-base="${wire.id}"]`)!]),
  )
  const wireEls = new Map(
    spec.wires.map(wire => [wire.id, art.querySelector<SVGPathElement>(`[data-wire="${wire.id}"]`)!]),
  )
  const packetEls = new Map(
    transfers.map(item => [item.id, art.querySelector<SVGGElement>(`[data-packet="${item.id}"]`)!]),
  )

  const motion = createMotionSampler(wireIds, nodeIds, spec.motion)
  const wireLengths = new Map<WireId, number>()
  let compact = false
  let layoutReady = false
  let activeBoxes: Record<PartId, ComputedNodeBox> = layouts.wide.nodes

  function applyNodeGeometry(id: PartId, box: ComputedNodeBox, isCompact: boolean): void {
    const els = nodeEls.get(id)!
    const padX = isCompact ? 9 : 11
    const ruleY = isCompact ? 34 : 40
    const rowStart = isCompact ? 40 : 47
    const rowStep = isCompact ? 19 : 22
    const rowBoxH = isCompact ? 16 : 18

    els.clipRect.setAttribute('width', String(Math.max(0, box.width - 2)))
    els.clipRect.setAttribute('height', String(Math.max(0, box.height - 2)))
    els.card.setAttribute('width', String(box.width))
    els.card.setAttribute('height', String(box.height))
    els.stripe.setAttribute('d', `M 1.5 8 V ${box.height - 8}`)
    els.kicker.setAttribute('x', String(padX))
    els.kicker.setAttribute('y', isCompact ? '13.5' : '15.5')
    els.title.setAttribute('x', String(padX))
    els.title.setAttribute('y', isCompact ? '28' : '32.5')
    els.rule.setAttribute('d', `M ${padX} ${ruleY} H ${box.width - padX}`)

    for (const [index, row] of els.rows.entries()) {
      const y = rowStart + index * rowStep
      row.group.setAttribute('transform', `translate(0 ${y})`)
      row.highlightBg.setAttribute('x', String(padX - 3))
      row.highlightBg.setAttribute('y', '0.5')
      row.highlightBg.setAttribute('width', String(box.width - padX * 2 + 6))
      row.highlightBg.setAttribute('height', String(rowBoxH))

      row.pillBg.setAttribute('x', String(padX - 2))
      row.pillBg.setAttribute('y', '0.5')
      row.pillBg.setAttribute('width', String(box.width - padX * 2 + 4))
      row.pillBg.setAttribute('height', String(rowBoxH))

      const textY = isCompact ? '11.8' : '13'
      row.codeText.setAttribute('x', String(padX))
      row.codeText.setAttribute('y', textY)
      row.kvText.setAttribute('x', String(padX))
      row.kvText.setAttribute('y', textY)
      row.pillLabel.setAttribute('x', String(padX + 4))
      row.pillLabel.setAttribute('y', textY)
      row.pillMeta.setAttribute('x', String(box.width - padX - 4))
      row.pillMeta.setAttribute('y', textY)
    }
  }

  function resize(): void {
    const narrow = stage.clientWidth < 630
    if (layoutReady && compact === narrow) return
    compact = narrow
    layoutReady = true
    const current = compact ? layouts.compact : layouts.wide
    activeBoxes = current.nodes
    art.classList.toggle('sch-art-compact', compact)
    art.setAttribute('viewBox', `0 0 ${current.width} ${current.height}`)

    for (const id of nodeIds) {
      const box = current.nodes[id]
      nodeEls.get(id)!.group.setAttribute('transform', `translate(${box.x} ${box.y})`)
      applyNodeGeometry(id, box, compact)
    }

    for (const id of wireIds) {
      const d = current.wires[id].path
      const baseEl = wireBaseEls.get(id)!
      const wireEl = wireEls.get(id)!
      baseEl.setAttribute('d', d)
      wireEl.setAttribute('d', d)
      wireLengths.set(id, wireEl.getTotalLength())
    }
  }

  function renderRow(slot: RowSlotEls, row: SchematicRow | undefined): void {
    slot.group.toggleAttribute('hidden', !row)
    if (!row) return
    const tone = row.tone ?? 'neutral'
    if (slot.group.dataset.tone !== tone) slot.group.dataset.tone = tone

    const isCode = row.kind === 'code'
    const isKv = row.kind === 'kv'
    const isPill = row.kind === 'pill'

    slot.codeText.toggleAttribute('hidden', !isCode)
    slot.kvText.toggleAttribute('hidden', !isKv)
    slot.highlightBg.toggleAttribute('hidden', !(isKv && row.highlight))
    slot.pillBg.toggleAttribute('hidden', !isPill)
    slot.pillLabel.toggleAttribute('hidden', !isPill)
    slot.pillMeta.toggleAttribute('hidden', !(isPill && row.meta))

    slot.group.dataset.highlight = String(Boolean(isKv && row.highlight))
    slot.group.dataset.selected = String(Boolean(isPill && row.selected))
    slot.group.dataset.dashed = String(Boolean(isPill && row.dashed))

    if (isCode) {
      if (slot.codeText.textContent !== row.text) slot.codeText.textContent = row.text
    } else if (isKv) {
      const keyLabel = `${row.key}: `
      if (slot.kvKey.textContent !== keyLabel) slot.kvKey.textContent = keyLabel
      if (slot.kvVal.textContent !== row.value) slot.kvVal.textContent = row.value
    } else {
      if (slot.pillLabel.textContent !== row.label) slot.pillLabel.textContent = row.label
      const meta = row.meta ?? ''
      if (slot.pillMeta.textContent !== meta) slot.pillMeta.textContent = meta
    }
  }

  function draw(elapsedMs: number, reducedMotion: boolean) {
    if (!layoutReady) resize()
    const frame = spec.frameAt(elapsedMs, compact)
    const sampled = motion.sample(elapsedMs, reducedMotion)
    const avoid: Element[] = []

    for (const id of nodeIds) {
      const nodeSpec = nodeSpecs.get(id)!
      const state = frame.nodes[id]
      const els = nodeEls.get(id)!
      const box = activeBoxes[id]
      const hidden = Boolean(state.hidden)
      els.group.toggleAttribute('hidden', hidden)
      if (hidden) continue
      avoid.push(els.group)

      const lift = sampled.nodePulse[id] * 2.5
      const y = lift > 0.02 ? Math.round((box.y - lift) * 10) / 10 : box.y
      els.group.setAttribute('transform', `translate(${box.x} ${y})`)

      const tone = state.tone ?? 'neutral'
      if (els.group.dataset.tone !== tone) els.group.dataset.tone = tone
      els.group.dataset.emphasis = String(Boolean(state.emphasis))
      els.group.dataset.dimmed = String(Boolean(state.dimmed))

      const kickerText = state.kicker ?? (compact ? (nodeSpec.compactKicker ?? nodeSpec.kicker) : nodeSpec.kicker)
      if (els.kicker.textContent !== kickerText) els.kicker.textContent = kickerText

      const titleText = state.title ?? (compact ? (nodeSpec.compactTitle ?? nodeSpec.title) : nodeSpec.title)
      if (els.title.textContent !== titleText) els.title.textContent = titleText

      const badge = state.badge ?? ''
      els.badgeGroup.toggleAttribute('hidden', !badge)
      if (badge) {
        const padX = compact ? 9 : 11
        const badgeW = Math.max(36, badge.length * (compact ? 6.1 : 6.5) + 12)
        const badgeX = box.width - padX - badgeW
        const badgeY = compact ? 6 : 7
        els.badgeRect.setAttribute('x', String(badgeX))
        els.badgeRect.setAttribute('y', String(badgeY))
        els.badgeRect.setAttribute('width', String(badgeW))
        els.badgeText.setAttribute('x', String(badgeX + badgeW / 2))
        els.badgeText.setAttribute('y', String(badgeY + 11.2))
        if (els.badgeText.textContent !== badge) els.badgeText.textContent = badge
      }

      for (const [index, slot] of els.rows.entries()) {
        renderRow(slot, state.rows[index])
      }
    }

    for (const id of wireIds) {
      const wireSpec = wireSpecs.get(id)!
      const state = frame.wires[id]
      const wireEl = wireEls.get(id)!
      wireEl.toggleAttribute('hidden', !state.visible)
      if (!state.visible) continue
      avoid.push(wireEl)

      const tone = state.tone ?? wireSpec.tone
      if (wireEl.dataset.tone !== tone) wireEl.dataset.tone = tone
      wireEl.dataset.active = String(state.active !== false)
      wireEl.dataset.dashed = String(Boolean(state.dashed))
      wireEl.setAttribute('marker-end', `url(#${spec.id}-arrow-${tone})`)

      const totalLen = wireLengths.get(id) ?? 0
      const reveal = sampled.wireReveal[id]
      if (!state.dashed && reveal < 0.999 && totalLen > 0) {
        wireEl.style.strokeDasharray = `${totalLen}`
        wireEl.style.strokeDashoffset = `${totalLen * (1 - reveal)}`
      } else {
        wireEl.style.strokeDasharray = ''
        wireEl.style.strokeDashoffset = ''
      }
    }

    for (const [packetId, packetEl] of packetEls) {
      const active = sampled.transfers.find(item => item.id === packetId)
      packetEl.toggleAttribute('hidden', !active)
      if (!active) continue
      const wireEl = wireEls.get(active.wire)!
      const len = wireLengths.get(active.wire) ?? 0
      if (len > 0) {
        const pt = wireEl.getPointAtLength(len * active.progress)
        packetEl.setAttribute('transform', `translate(${Math.round(pt.x * 10) / 10} ${Math.round(pt.y * 10) / 10})`)
      }
    }

    const { anchor, ...note } = frame.note
    return {
      ...note,
      target: nodeEls.get(anchor)!.group,
      avoid,
    }
  }

  return {
    art,
    draw,
    resize,
    describe(element, elapsedMs) {
      const id = element.dataset.lessonPart as PartId
      return spec.describePart ? spec.describePart(id, elapsedMs) : nodeSpecs.get(id)!.part
    },
  }
}
