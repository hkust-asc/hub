import { computeSpotlightGeometry, planCameraViewBox, resolveEntityWorldBoxes, resolveWireRoute } from './layout.ts'
import type { ViewBoxRect } from './layout.ts'
import { measurePillWidth } from './measure.ts'
import type {
  LayoutMode,
  SchematicStageSpec,
  StageBox,
  StageCardRow,
  StageEntitySpec,
  StageTone,
  StageWireKind,
} from './types.ts'
import type { StageSceneController } from './types.ts'

const allTones: readonly StageTone[] = ['slate', 'green', 'amber', 'blue', 'coral']

const defaultWireTone: Record<StageWireKind, StageTone> = {
  control: 'amber',
  data: 'green',
  fault: 'coral',
  mount: 'slate',
  tree: 'slate',
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function plinthPaths(w: number, h: number, bevel: number, depth: number): {
  edge: string
  deck: string
  crease: string
} {
  return {
    edge: `M 0 ${bevel} H ${w} V ${h - bevel + depth} L ${w - bevel} ${h + depth} H ${bevel} L 0 ${h - bevel + depth} Z`,
    deck: `M 0 ${bevel} L ${bevel} 0 H ${w - bevel} L ${w} ${bevel} V ${h - bevel} L ${w - bevel} ${h} H ${bevel} L 0 ${h - bevel} Z`,
    crease: `M ${bevel} ${bevel} H ${w - bevel} M ${bevel} ${h} V ${h + depth} M ${w - bevel} ${h} V ${h + depth}`,
  }
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
  meterTrack: SVGRectElement
  meterFill: SVGRectElement
  meterLabel: SVGTextElement
}

interface EntitySlotEls {
  group: SVGGElement
  clipRect?: SVGRectElement
  // plinth & brick
  edgePath?: SVGPathElement
  deckPath?: SVGPathElement
  creasePath?: SVGPathElement
  ledCircle?: SVGCircleElement
  subtitleText?: SVGTextElement
  brickMeterTrack?: SVGRectElement
  brickMeterFill?: SVGRectElement
  // card & tile & port
  boxRect?: SVGRectElement
  stripePath?: SVGPathElement
  rulePath?: SVGPathElement
  kickerText?: SVGTextElement
  titleText: SVGTextElement
  badgeGroup?: SVGGElement
  badgeRect?: SVGRectElement
  badgeText?: SVGTextElement
  portCircle?: SVGCircleElement
  portNumText?: SVGTextElement
  operatorText?: SVGTextElement
  rows: RowSlotEls[]
}

interface AnimatedEntityTransform {
  x: number
  y: number
  opacity: number
  lift: number
  initialized: boolean
  wasVisible: boolean
}

export function createSchematicStageScene<
  EntityId extends string,
  WireId extends string,
  TrayId extends string = string,
  VariantId extends string = string,
>(
  canvas: HTMLElement,
  spec: SchematicStageSpec<EntityId, WireId, TrayId, VariantId>,
): StageSceneController<VariantId> {
  const hostSpecs = spec.entities.filter(e => e.kind === 'plinth')
  const childSpecs = spec.entities.filter(e => e.kind !== 'plinth')
  const trays = spec.trays ?? []
  const packetIds = spec.maxPackets ?? []
  const pinIds = spec.maxPins ?? []

  function renderEntityMarkup(entity: StageEntitySpec<EntityId>): string {
    const inspectAttrs = entity.part
      ? `data-stage-part="entity:${entity.id}" data-lesson-part="${entity.id}" role="button" tabindex="-1" aria-label="${escapeHtml(entity.part.name)}" aria-pressed="false"`
      : `aria-hidden="true"`
    const baseAttrs = `class="st-entity st-${entity.kind}" data-entity="${entity.id}" data-tone="slate" ${inspectAttrs}`

    if (entity.kind === 'plinth') {
      return `<g ${baseAttrs}>
        <path class="st-plinth-edge"/>
        <path class="st-plinth-deck"/>
        <path class="st-plinth-crease"/>
        <text class="st-kicker"></text>
        <circle class="st-led" r="3.6" hidden/>
        <text class="st-title"></text>
        <text class="st-subtitle" text-anchor="end"></text>
        <g class="st-badge" hidden>
          <rect class="st-badge-bg" height="17"/>
          <text class="st-badge-text"></text>
        </g>
      </g>`
    }

    if (entity.kind === 'brick') {
      return `<g ${baseAttrs}>
        <path class="st-brick-edge"/>
        <path class="st-brick-deck"/>
        <path class="st-brick-crease"/>
        <text class="st-title"></text>
        <text class="st-subtitle" text-anchor="end"></text>
        <rect class="st-meter-track" height="5.5" hidden/>
        <rect class="st-meter-fill" height="5.5" width="0" hidden/>
      </g>`
    }

    if (entity.kind === 'tile') {
      return `<g ${baseAttrs}>
        <rect class="st-tile-box"/>
        <path class="st-stripe" hidden/>
        <text class="st-title" text-anchor="middle"></text>
        <text class="st-subtitle" text-anchor="middle" hidden></text>
      </g>`
    }

    if (entity.kind === 'port') {
      return `<g ${baseAttrs}>
        <rect class="st-port-box"/>
        <circle class="st-port-dot" r="9.5"/>
        <text class="st-port-num" text-anchor="middle">${entity.portNumber ?? ''}</text>
        <text class="st-title"></text>
        <text class="st-operator" text-anchor="end"></text>
      </g>`
    }

    // kind === 'card'
    const rowCount = entity.maxRows ?? 0
    return `<g ${baseAttrs}>
      <rect class="st-card-box"/>
      <path class="st-stripe"/>
      <g clip-path="url(#${spec.id}-clip-${entity.id})">
        <text class="st-kicker"></text>
        <text class="st-title"></text>
        <g class="st-badge" hidden>
          <rect class="st-badge-bg" height="17"/>
          <text class="st-badge-text"></text>
        </g>
        <path class="st-rule"/>
        ${Array.from({ length: rowCount }, (_, idx) => `
          <g class="st-row" data-row="${idx}" hidden>
            <rect class="st-row-bg" hidden/>
            <rect class="st-pill-bg" hidden/>
            <text class="st-code" hidden></text>
            <text class="st-kv" hidden><tspan class="st-kv-key"></tspan><tspan class="st-kv-val"></tspan></text>
            <text class="st-pill-label" hidden></text>
            <text class="st-pill-meta" text-anchor="end" hidden></text>
            <rect class="st-row-meter-track" height="5.5" hidden/>
            <rect class="st-row-meter-fill" height="5.5" width="0" hidden/>
            <text class="st-row-meter-label" hidden></text>
          </g>
        `).join('')}
      </g>
    </g>`
  }

  canvas.innerHTML = `<svg class="stage-svg" viewBox="0 0 ${spec.wideSize.w} ${spec.wideSize.h}" role="group" aria-labelledby="${spec.id}-svg-title ${spec.id}-svg-desc">
    <title id="${spec.id}-svg-title">${escapeHtml(spec.svgTitle)}</title>
    <desc id="${spec.id}-svg-desc">${escapeHtml(spec.svgDesc)}</desc>
    <defs>
      <pattern id="${spec.id}-dot-grid" width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="9" r="0.85" class="st-grid-dot"/>
      </pattern>
      <radialGradient id="${spec.id}-grid-fade" cx="50%" cy="50%" r="62%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="82%" stop-color="#ffffff" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.12"/>
      </radialGradient>
      <mask id="${spec.id}-grid-mask">
        <rect x="-200" y="-200" width="1800" height="1400" fill="url(#${spec.id}-grid-fade)"/>
      </mask>
      ${allTones.map(tone => `<marker id="${spec.id}-arrow-${tone}" data-tone="${tone}" viewBox="0 0 8 8" refX="7.2" refY="4" markerWidth="6.6" markerHeight="6.6" orient="auto" markerUnits="userSpaceOnUse"><path class="st-arrow" d="M 0 0 L 8 4 L 0 8 Z"/></marker>`).join('')}
      ${childSpecs.filter(e => e.kind === 'card').map(e => `<clipPath id="${spec.id}-clip-${e.id}"><rect x="1" y="1" width="${e.wide.w - 2}" height="${e.wide.h - 2}"/></clipPath>`).join('')}
    </defs>
    <rect class="st-grid-rect" x="-200" y="-200" width="1800" height="1400" fill="url(#${spec.id}-dot-grid)" mask="url(#${spec.id}-grid-mask)" aria-hidden="true"/>
    <g class="layer-floor" aria-hidden="true">
      ${trays.map(tray => `<g class="st-tray" data-tray="${tray.id}"><path class="st-tray-rule"/><text class="st-tray-label">${escapeHtml(tray.label)}</text></g>`).join('')}
    </g>
    <g class="layer-hosts">
      ${hostSpecs.map(renderEntityMarkup).join('')}
    </g>
    <g class="layer-links-base" aria-hidden="true">
      ${spec.wires.map(w => `<path class="st-wire-base" data-wire-base="${w.id}" data-kind="${w.kind}" ${w.baseTrack === false ? 'hidden' : ''}/>`).join('')}
    </g>
    <g class="layer-entities">
      ${childSpecs.map(renderEntityMarkup).join('')}
    </g>
    <g class="layer-links">
      ${spec.wires.map(w => {
        const inspectAttrs = w.part
          ? `data-stage-part="wire:${w.id}" data-lesson-part="${w.id}" role="button" tabindex="-1" aria-label="${escapeHtml(w.part.name)}" aria-pressed="false"`
          : `aria-hidden="true"`
        return `<g class="st-wire-group" data-wire-group="${w.id}" ${inspectAttrs} hidden>
          ${w.part ? `<path class="st-wire-hit"/>` : ''}
          <path class="st-wire" data-kind="${w.kind}" data-tone="${w.tone ?? defaultWireTone[w.kind]}"/>
          <g class="st-fault-mark" hidden>
            <circle r="10"/>
            <path d="M -4 -4 L 4 4 M 4 -4 L -4 4"/>
          </g>
        </g>`
      }).join('')}
    </g>
    <g class="layer-spotlight" aria-hidden="true">
      ${spec.entities.map(e => `<g class="st-spotlight" data-spotlight="${e.id}" data-tone="blue" hidden><rect class="st-spotlight-halo"/><path class="st-spotlight-corners"/></g>`).join('')}
    </g>
    <g class="layer-packets" aria-hidden="true">
      ${packetIds.map(pid => `<g class="st-packet" data-packet="${pid}" data-tone="green" hidden><rect height="19"/><text y="3.5"></text></g>`).join('')}
    </g>
    <g class="layer-over" aria-hidden="true">
      ${pinIds.map(pinId => `<g class="st-pin" data-pin="${pinId}" data-tone="green" hidden><rect height="19"/><circle cx="8" cy="0" r="2.4"/><text y="3.5"></text></g>`).join('')}
    </g>
  </svg>`

  const art = canvas.querySelector<SVGSVGElement>('.stage-svg')!
  const entityMap = new Map(spec.entities.map(e => [e.id, e]))
  const wireMap = new Map(spec.wires.map(w => [w.id, w]))

  const trayEls = new Map(
    trays.map(t => {
      const g = art.querySelector<SVGGElement>(`[data-tray="${t.id}"]`)!
      return [t.id, { group: g, rule: g.querySelector<SVGPathElement>('.st-tray-rule')!, label: g.querySelector<SVGTextElement>('.st-tray-label')! }]
    }),
  )

  const entityEls = new Map<EntityId, EntitySlotEls>()
  for (const entity of spec.entities) {
    const group = art.querySelector<SVGGElement>(`[data-entity="${entity.id}"]`)!
    const clipRect = entity.kind === 'card'
      ? art.querySelector<SVGRectElement>(`#${CSS.escape(`${spec.id}-clip-${entity.id}`)} rect`) ?? undefined
      : undefined
    const rows = [...group.querySelectorAll<SVGGElement>('.st-row')].map<RowSlotEls>(rg => ({
      group: rg,
      highlightBg: rg.querySelector<SVGRectElement>('.st-row-bg')!,
      pillBg: rg.querySelector<SVGRectElement>('.st-pill-bg')!,
      codeText: rg.querySelector<SVGTextElement>('.st-code')!,
      kvText: rg.querySelector<SVGTextElement>('.st-kv')!,
      kvKey: rg.querySelector<SVGTSpanElement>('.st-kv-key')!,
      kvVal: rg.querySelector<SVGTSpanElement>('.st-kv-val')!,
      pillLabel: rg.querySelector<SVGTextElement>('.st-pill-label')!,
      pillMeta: rg.querySelector<SVGTextElement>('.st-pill-meta')!,
      meterTrack: rg.querySelector<SVGRectElement>('.st-row-meter-track')!,
      meterFill: rg.querySelector<SVGRectElement>('.st-row-meter-fill')!,
      meterLabel: rg.querySelector<SVGTextElement>('.st-row-meter-label')!,
    }))
    entityEls.set(entity.id, {
      group,
      clipRect,
      edgePath: group.querySelector<SVGPathElement>('.st-plinth-edge, .st-brick-edge') ?? undefined,
      deckPath: group.querySelector<SVGPathElement>('.st-plinth-deck, .st-brick-deck') ?? undefined,
      creasePath: group.querySelector<SVGPathElement>('.st-plinth-crease, .st-brick-crease') ?? undefined,
      ledCircle: group.querySelector<SVGCircleElement>('.st-led') ?? undefined,
      subtitleText: group.querySelector<SVGTextElement>('.st-subtitle') ?? undefined,
      brickMeterTrack: group.querySelector<SVGRectElement>('.st-meter-track') ?? undefined,
      brickMeterFill: group.querySelector<SVGRectElement>('.st-meter-fill') ?? undefined,
      boxRect: group.querySelector<SVGRectElement>('.st-card-box, .st-tile-box, .st-port-box') ?? undefined,
      stripePath: group.querySelector<SVGPathElement>('.st-stripe') ?? undefined,
      rulePath: group.querySelector<SVGPathElement>('.st-rule') ?? undefined,
      kickerText: group.querySelector<SVGTextElement>('.st-kicker') ?? undefined,
      titleText: group.querySelector<SVGTextElement>('.st-title')!,
      badgeGroup: group.querySelector<SVGGElement>('.st-badge') ?? undefined,
      badgeRect: group.querySelector<SVGRectElement>('.st-badge-bg') ?? undefined,
      badgeText: group.querySelector<SVGTextElement>('.st-badge-text') ?? undefined,
      portCircle: group.querySelector<SVGCircleElement>('.st-port-dot') ?? undefined,
      portNumText: group.querySelector<SVGTextElement>('.st-port-num') ?? undefined,
      operatorText: group.querySelector<SVGTextElement>('.st-operator') ?? undefined,
      rows,
    })
  }

  const wireBaseEls = new Map(
    spec.wires.map(w => [w.id, art.querySelector<SVGPathElement>(`[data-wire-base="${w.id}"]`)!]),
  )
  const wireSlotEls = new Map(
    spec.wires.map(w => {
      const group = art.querySelector<SVGGElement>(`[data-wire-group="${w.id}"]`)!
      return [w.id, {
        group,
        hit: group.querySelector<SVGPathElement>('.st-wire-hit') ?? undefined,
        path: group.querySelector<SVGPathElement>('.st-wire')!,
        fault: group.querySelector<SVGGElement>('.st-fault-mark')!,
      }]
    }),
  )
  const packetEls = new Map(
    packetIds.map(pid => {
      const group = art.querySelector<SVGGElement>(`[data-packet="${pid}"]`)!
      return [pid, { group, rect: group.querySelector<SVGRectElement>('rect')!, text: group.querySelector<SVGTextElement>('text')! }]
    }),
  )
  const pinEls = new Map(
    pinIds.map(id => {
      const group = art.querySelector<SVGGElement>(`[data-pin="${id}"]`)!
      return [id, {
        group,
        rect: group.querySelector<SVGRectElement>('rect')!,
        dot: group.querySelector<SVGCircleElement>('circle')!,
        text: group.querySelector<SVGTextElement>('text')!,
      }]
    }),
  )
  const spotlightEls = new Map(
    spec.entities.map(entity => {
      const group = art.querySelector<SVGGElement>(`[data-spotlight="${entity.id}"]`)!
      return [entity.id, {
        group,
        halo: group.querySelector<SVGRectElement>('.st-spotlight-halo')!,
        corners: group.querySelector<SVGPathElement>('.st-spotlight-corners')!,
      }]
    }),
  )

  const animState = new Map<EntityId, AnimatedEntityTransform>()
  for (const entity of spec.entities) {
    animState.set(entity.id, { x: 0, y: 0, opacity: 1, lift: 0, initialized: false, wasVisible: false })
  }

  const wirePathCache = new Map<WireId, { d: string; len: number; midX: number; midY: number }>()
  let mode: LayoutMode = 'wide'
  let layoutInitialized = false
  let currentViewBox: ViewBoxRect = { x: 0, y: 0, w: spec.wideSize.w, h: spec.wideSize.h }
  let lastSpotlightStepKey = ''

  function applyBoxGeometry(entity: StageEntitySpec<EntityId>, box: StageBox, isCompact: boolean): void {
    const els = entityEls.get(entity.id)!
    const padX = isCompact ? 9 : 11

    if (entity.kind === 'plinth') {
      const bevel = entity.bevel ?? (isCompact ? 8 : 10)
      const depth = entity.depth ?? (isCompact ? 6 : 8)
      const paths = plinthPaths(box.w, box.h - depth, bevel, depth)
      els.edgePath!.setAttribute('d', paths.edge)
      els.deckPath!.setAttribute('d', paths.deck)
      els.creasePath!.setAttribute('d', paths.crease)
      els.kickerText!.setAttribute('x', String(padX + 2))
      els.kickerText!.setAttribute('y', isCompact ? '17' : '19')
      els.ledCircle!.setAttribute('cx', String(box.w - padX - 4))
      els.ledCircle!.setAttribute('cy', isCompact ? '15' : '16.5')
      els.titleText.setAttribute('x', String(padX + 2))
      els.titleText.setAttribute('y', isCompact ? '35' : '38')
      els.subtitleText!.setAttribute('x', String(box.w - padX - 14))
      els.subtitleText!.setAttribute('y', isCompact ? '35' : '37.5')
      return
    }

    if (entity.kind === 'brick') {
      const bevel = entity.bevel ?? 5
      const depth = entity.depth ?? 4
      const deckH = Math.max(18, box.h - depth)
      const paths = plinthPaths(box.w, deckH, bevel, depth)
      els.edgePath!.setAttribute('d', paths.edge)
      els.deckPath!.setAttribute('d', paths.deck)
      els.creasePath!.setAttribute('d', paths.crease)
      els.titleText.setAttribute('x', String(padX))
      els.titleText.setAttribute('y', isCompact ? '17.5' : '19')
      els.subtitleText!.setAttribute('x', String(box.w - padX))
      els.subtitleText!.setAttribute('y', isCompact ? '17.5' : '19')
      els.brickMeterTrack!.setAttribute('x', String(padX))
      els.brickMeterTrack!.setAttribute('y', String(deckH - 11))
      els.brickMeterTrack!.setAttribute('width', String(Math.max(12, box.w - padX * 2)))
      els.brickMeterFill!.setAttribute('x', String(padX))
      els.brickMeterFill!.setAttribute('y', String(deckH - 11))
      return
    }

    if (entity.kind === 'tile') {
      els.boxRect!.setAttribute('width', String(box.w))
      els.boxRect!.setAttribute('height', String(box.h))
      els.stripePath!.setAttribute('d', `M 1.2 0 V ${box.h}`)
      els.titleText.setAttribute('x', String(box.w / 2))
      els.titleText.setAttribute('y', String(Math.round(box.h / 2 + 4.5)))
      els.subtitleText!.setAttribute('x', String(box.w / 2))
      els.subtitleText!.setAttribute('y', String(box.h - 6))
      return
    }

    if (entity.kind === 'port') {
      els.boxRect!.setAttribute('width', String(box.w))
      els.boxRect!.setAttribute('height', String(box.h))
      const cy = box.h / 2
      els.portCircle!.setAttribute('cx', '14')
      els.portCircle!.setAttribute('cy', String(cy))
      els.portNumText!.setAttribute('x', '14')
      els.portNumText!.setAttribute('y', String(cy + 3.8))
      els.titleText.setAttribute('x', '28')
      els.titleText.setAttribute('y', String(cy + 4))
      els.operatorText!.setAttribute('x', String(box.w - 8))
      els.operatorText!.setAttribute('y', String(cy + 4))
      return
    }

    // kind === 'card'
    const hasKicker = Boolean(entity.kicker || entity.compactKicker)
    const headerH = hasKicker ? (isCompact ? 34 : 39) : (isCompact ? 25 : 28)
    const rowStart = headerH + (isCompact ? 5 : 6)
    const rowStep = isCompact ? 18.5 : 21
    const rowBoxH = isCompact ? 15.5 : 17.5

    els.clipRect?.setAttribute('width', String(Math.max(0, box.w - 2)))
    els.clipRect?.setAttribute('height', String(Math.max(0, box.h - 2)))
    els.boxRect!.setAttribute('width', String(box.w))
    els.boxRect!.setAttribute('height', String(box.h))

    if (entity.stripeSide === 'top') {
      els.stripePath!.setAttribute('d', `M 0 1.3 H ${box.w}`)
    } else {
      els.stripePath!.setAttribute('d', `M 1.3 0 V ${box.h}`)
    }

    els.kickerText!.toggleAttribute('hidden', !hasKicker)
    els.kickerText!.setAttribute('x', String(padX))
    els.kickerText!.setAttribute('y', isCompact ? '13' : '15')
    els.titleText.setAttribute('x', String(padX))
    els.titleText.setAttribute('y', hasKicker ? (isCompact ? '27.5' : '31.5') : (isCompact ? '18' : '20'))
    els.rulePath!.toggleAttribute('hidden', els.rows.length === 0)
    els.rulePath!.setAttribute('d', `M ${padX} ${headerH} H ${box.w - padX}`)

    for (const [index, row] of els.rows.entries()) {
      const y = rowStart + index * rowStep
      row.group.setAttribute('transform', `translate(0 ${y})`)
      row.highlightBg.setAttribute('x', String(padX - 3))
      row.highlightBg.setAttribute('y', '0.5')
      row.highlightBg.setAttribute('width', String(Math.max(0, box.w - padX * 2 + 6)))
      row.highlightBg.setAttribute('height', String(rowBoxH))

      row.pillBg.setAttribute('x', String(padX - 2))
      row.pillBg.setAttribute('y', '0.5')
      row.pillBg.setAttribute('width', String(Math.max(0, box.w - padX * 2 + 4)))
      row.pillBg.setAttribute('height', String(rowBoxH))

      const textY = isCompact ? '11.5' : '12.6'
      row.codeText.setAttribute('x', String(padX))
      row.codeText.setAttribute('y', textY)
      row.kvText.setAttribute('x', String(padX))
      row.kvText.setAttribute('y', textY)
      row.pillLabel.setAttribute('x', String(padX + 4))
      row.pillLabel.setAttribute('y', textY)
      row.pillMeta.setAttribute('x', String(box.w - padX - 4))
      row.pillMeta.setAttribute('y', textY)

      row.meterTrack.setAttribute('x', String(padX))
      row.meterTrack.setAttribute('y', '2.5')
      row.meterTrack.setAttribute('width', String(Math.max(16, box.w - padX * 2)))
      row.meterFill.setAttribute('x', String(padX))
      row.meterFill.setAttribute('y', '2.5')
      row.meterLabel.setAttribute('x', String(padX))
      row.meterLabel.setAttribute('y', isCompact ? '16.5' : '17.5')
    }
  }

  function renderCardRow(slot: RowSlotEls, row: StageCardRow | undefined, boxW: number, isCompact: boolean): void {
    slot.group.toggleAttribute('hidden', !row)
    if (!row) return
    const tone = row.tone ?? 'slate'
    if (slot.group.dataset.tone !== tone) slot.group.dataset.tone = tone

    const isCode = row.kind === 'code'
    const isKv = row.kind === 'kv'
    const isPill = row.kind === 'pill'
    const isMeter = row.kind === 'meter'

    slot.codeText.toggleAttribute('hidden', !isCode)
    slot.kvText.toggleAttribute('hidden', !isKv)
    slot.highlightBg.toggleAttribute('hidden', !(isKv && row.highlight))
    slot.pillBg.toggleAttribute('hidden', !isPill)
    slot.pillLabel.toggleAttribute('hidden', !isPill)
    slot.pillMeta.toggleAttribute('hidden', !(isPill && row.meta))
    slot.meterTrack.toggleAttribute('hidden', !isMeter)
    slot.meterFill.toggleAttribute('hidden', !isMeter)
    slot.meterLabel.toggleAttribute('hidden', !(isMeter && row.label))

    slot.group.dataset.highlight = String(Boolean(isKv && row.highlight))
    slot.group.dataset.selected = String(Boolean(isPill && row.selected))
    slot.group.dataset.dashed = String(Boolean(isPill && row.dashed))

    if (isCode) {
      if (slot.codeText.textContent !== row.text) slot.codeText.textContent = row.text
    } else if (isKv) {
      const keyStr = `${row.key}: `
      if (slot.kvKey.textContent !== keyStr) slot.kvKey.textContent = keyStr
      if (slot.kvVal.textContent !== row.value) slot.kvVal.textContent = row.value
    } else if (isPill) {
      if (slot.pillLabel.textContent !== row.label) slot.pillLabel.textContent = row.label
      const meta = row.meta ?? ''
      if (slot.pillMeta.textContent !== meta) slot.pillMeta.textContent = meta
    } else if (isMeter) {
      const padX = isCompact ? 9 : 11
      const maxW = Math.max(16, boxW - padX * 2)
      const clamped = Math.max(0, Math.min(1, row.value))
      slot.meterFill.setAttribute('width', String(Math.round(maxW * clamped * 10) / 10))
      if (row.label && slot.meterLabel.textContent !== row.label) {
        slot.meterLabel.textContent = row.label
      }
    }
  }

  function applyStaticModeLayout(nextMode: LayoutMode): void {
    mode = nextMode
    const isCompact = mode === 'compact'
    const sceneSize = isCompact ? spec.compactSize : spec.wideSize
    art.classList.toggle('is-compact', isCompact)
    currentViewBox = { x: 0, y: 0, w: sceneSize.w, h: sceneSize.h }
    art.setAttribute('viewBox', `0 0 ${sceneSize.w} ${sceneSize.h}`)

    for (const tray of trays) {
      const slot = trayEls.get(tray.id)!
      const geom = isCompact ? tray.compact : tray.wide
      slot.rule.setAttribute('d', `M ${geom.x} ${geom.y} H ${geom.x + geom.w}`)
      slot.label.setAttribute('x', String(geom.x + 2))
      slot.label.setAttribute('y', String(geom.y - 5))
    }

    const baseBoxes = resolveEntityWorldBoxes(spec.entities, mode)
    for (const entity of spec.entities) {
      applyBoxGeometry(entity, baseBoxes[entity.id], isCompact)
      const anim = animState.get(entity.id)!
      anim.initialized = false
    }
    wirePathCache.clear()
  }

  function resize(): void {
    const width = canvas.clientWidth || 800
    const nextMode: LayoutMode = width < 480 ? 'compact' : 'wide'
    if (layoutInitialized && nextMode === mode) return
    layoutInitialized = true
    applyStaticModeLayout(nextMode)
  }

  function render(options: {
    stepIndex: number
    beatProgress: number
    variant: VariantId
    reducedMotion: boolean
    fitOverride: boolean
    dtMs: number
  }) {
    if (!layoutInitialized) resize()
    const isCompact = mode === 'compact'
    const sceneSize = isCompact ? spec.compactSize : spec.wideSize
    const progress = options.reducedMotion ? 1 : options.beatProgress
    const frame = spec.evaluate(options.stepIndex, progress, options.variant, isCompact)

    const overrides: Partial<Record<EntityId, { x: number; y: number }>> = {}
    for (const entity of spec.entities) {
      const ov = frame.entities[entity.id]?.overridePos
      const pos = isCompact ? ov?.compact : ov?.wide
      if (pos) overrides[entity.id] = pos
    }
    const worldBoxes = resolveEntityWorldBoxes(spec.entities, mode, overrides)

    const emphasizedIds = new Set<EntityId>()
    const involvedIds = new Set<EntityId>()
    for (const entity of spec.entities) {
      const eState = frame.entities[entity.id]
      if (!eState?.hidden && eState?.emphasis) {
        emphasizedIds.add(entity.id)
        involvedIds.add(entity.id)
        if (entity.parent) involvedIds.add(entity.parent)
      }
    }
    for (const pin of frame.pins ?? []) {
      involvedIds.add(pin.target)
    }
    for (const wire of spec.wires) {
      const wState = frame.wires[wire.id]
      if (wState?.visible && wState.active !== false && wire.kind !== 'tree') {
        const fromId = (wState.fromOverride?.id as EntityId | undefined) ?? wire.from.id
        const toId = (wState.toOverride?.id as EntityId | undefined) ?? wire.to.id
        involvedIds.add(fromId)
        involvedIds.add(toId)
      }
    }
    const hasSpotlight = emphasizedIds.size > 0
    art.dataset.spotlight = String(hasSpotlight)
    art.dataset.reducedMotion = String(options.reducedMotion)
    const stepKey = `${options.stepIndex}:${options.variant}`
    const stepChanged = stepKey !== lastSpotlightStepKey
    lastSpotlightStepKey = stepKey

    for (const tray of trays) {
      const slot = trayEls.get(tray.id)!
      const visible = frame.trays?.[tray.id] ?? true
      slot.group.toggleAttribute('hidden', !visible)
    }

    const blend = options.reducedMotion || options.dtMs <= 0
      ? 1
      : 1 - Math.exp(-Math.min(64, options.dtMs) / 95)
    let animatingLayout = false

    for (const entity of spec.entities) {
      const state = frame.entities[entity.id]
      const els = entityEls.get(entity.id)!
      const box = worldBoxes[entity.id]
      const anim = animState.get(entity.id)!
      const visible = !state?.hidden
      const targetOpacity = visible ? (state?.opacity ?? (state?.dimmed ? 0.52 : 1)) : 0

      if (!anim.initialized || options.reducedMotion) {
        anim.x = box.x
        anim.y = box.y
        anim.opacity = targetOpacity
        anim.lift = 0
        anim.initialized = true
      } else {
        if (visible && !anim.wasVisible) {
          anim.x = box.x
          anim.y = box.y
          anim.opacity = 0.05
          anim.lift = 5
        }
        anim.x += (box.x - anim.x) * blend
        anim.y += (box.y - anim.y) * blend
        anim.opacity += (targetOpacity - anim.opacity) * blend
        anim.lift += (0 - anim.lift) * blend
        if (
          Math.abs(box.x - anim.x) > 0.25 ||
          Math.abs(box.y - anim.y) > 0.25 ||
          Math.abs(targetOpacity - anim.opacity) > 0.015 ||
          Math.abs(anim.lift) > 0.2
        ) {
          animatingLayout = true
        } else {
          anim.x = box.x
          anim.y = box.y
          anim.opacity = targetOpacity
          anim.lift = 0
        }
      }
      anim.wasVisible = visible

      const hideDom = !visible && anim.opacity <= 0.02
      els.group.toggleAttribute('hidden', hideDom)
      if (hideDom) continue

      const rx = Math.round(anim.x * 10) / 10
      const ry = Math.round((anim.y + anim.lift) * 10) / 10
      els.group.setAttribute('transform', `translate(${rx} ${ry})`)
      els.group.style.opacity = Math.abs(anim.opacity - 1) < 0.01 ? '' : String(Math.round(anim.opacity * 100) / 100)

      const tone = state?.tone ?? 'slate'
      if (els.group.dataset.tone !== tone) els.group.dataset.tone = tone
      els.group.dataset.emphasis = String(Boolean(state?.emphasis))
      els.group.dataset.dashed = String(Boolean(state?.dashed))
      els.group.dataset.spotlightRole = !hasSpotlight
        ? 'none'
        : emphasizedIds.has(entity.id)
          ? 'focus'
          : involvedIds.has(entity.id)
            ? 'context'
            : 'muted'

      if (els.kickerText && (entity.kind === 'plinth' || entity.kind === 'card')) {
        const kicker = state?.kicker ?? (isCompact ? (entity.compactKicker ?? entity.kicker ?? '') : (entity.kicker ?? ''))
        if (els.kickerText.textContent !== kicker) els.kickerText.textContent = kicker
      }

      const title = state?.title ?? (isCompact ? (entity.compactTitle ?? entity.title) : entity.title)
      if (els.titleText.textContent !== title) els.titleText.textContent = title

      if (els.subtitleText) {
        const sub = state?.subtitle ?? ''
        els.subtitleText.toggleAttribute('hidden', !sub)
        if (els.subtitleText.textContent !== sub) els.subtitleText.textContent = sub
        if (entity.kind === 'tile') {
          els.titleText.setAttribute('y', sub ? String(Math.round(box.h / 2 - 1.5)) : String(Math.round(box.h / 2 + 4.5)))
          els.stripePath!.toggleAttribute('hidden', !sub && !state?.emphasis)
        }
      }

      if (els.ledCircle) {
        const led = state?.led
        els.ledCircle.toggleAttribute('hidden', !led)
        if (led) els.ledCircle.dataset.led = led
      }

      if (els.operatorText) {
        const op = state?.operator ?? ''
        if (els.operatorText.textContent !== op) els.operatorText.textContent = op
      }

      if (els.brickMeterTrack && els.brickMeterFill) {
        const meter = state?.meter
        els.brickMeterTrack.toggleAttribute('hidden', !meter)
        els.brickMeterFill.toggleAttribute('hidden', !meter)
        if (meter) {
          const padX = isCompact ? 9 : 11
          const maxW = Math.max(12, box.w - padX * 2)
          const clamped = Math.max(0, Math.min(1, meter.value))
          els.brickMeterFill.setAttribute('width', String(Math.round(maxW * clamped * 10) / 10))
          els.brickMeterFill.dataset.tone = meter.tone ?? tone
        }
      }

      if (els.badgeGroup && els.badgeRect && els.badgeText) {
        const badge = state?.badge ?? ''
        els.badgeGroup.toggleAttribute('hidden', !badge)
        if (badge) {
          const padX = isCompact ? 9 : 11
          const badgeW = measurePillWidth(badge, { sizePx: isCompact ? 9 : 9.5, padX: 12, minWidth: 36 })
          const badgeX = box.w - padX - badgeW
          const hasKicker = Boolean(entity.kicker || entity.compactKicker)
          const badgeY = entity.kind === 'plinth' ? (isCompact ? 9 : 10) : hasKicker ? (isCompact ? 6 : 7) : 5.5
          els.badgeRect.setAttribute('x', String(badgeX))
          els.badgeRect.setAttribute('y', String(badgeY))
          els.badgeRect.setAttribute('width', String(badgeW))
          els.badgeText.setAttribute('x', String(badgeX + badgeW / 2))
          els.badgeText.setAttribute('y', String(badgeY + 11.6))
          if (els.badgeText.textContent !== badge) els.badgeText.textContent = badge
        }
      }

      if (entity.kind === 'card') {
        const rows = state?.rows ?? []
        for (const [idx, slot] of els.rows.entries()) {
          renderCardRow(slot, rows[idx], box.w, isCompact)
        }
      }
    }

    for (const wire of spec.wires) {
      const wState = frame.wires[wire.id]
      const route = resolveWireRoute(wire, worldBoxes, mode, wState)
      const cached = wirePathCache.get(wire.id)
      const slot = wireSlotEls.get(wire.id)!
      const baseEl = wireBaseEls.get(wire.id)!

      if (!cached || cached.d !== route.path) {
        baseEl.setAttribute('d', route.path)
        slot.path.setAttribute('d', route.path)
        slot.hit?.setAttribute('d', route.path)
        const len = slot.path.getTotalLength()
        wirePathCache.set(wire.id, {
          d: route.path,
          len,
          midX: route.midpoint.x,
          midY: route.midpoint.y,
        })
      }

      const info = wirePathCache.get(wire.id)!
      slot.group.toggleAttribute('hidden', !wState?.visible)
      if (!wState?.visible) continue

      const tone = wState.tone ?? wire.tone ?? defaultWireTone[wire.kind]
      if (slot.path.dataset.tone !== tone) slot.path.dataset.tone = tone
      slot.path.dataset.active = String(wState.active !== false)
      const isDashed = Boolean(wState.dashed || wire.kind === 'mount')
      slot.path.dataset.dashed = String(isDashed)

      const showArrow = wire.arrow !== false && wire.kind !== 'tree' && wire.kind !== 'mount' && !wState.faultMark
      if (showArrow) slot.path.setAttribute('marker-end', `url(#${spec.id}-arrow-${tone})`)
      else slot.path.removeAttribute('marker-end')

      const drawProg = options.reducedMotion ? 1 : (wState.drawProgress ?? 1)
      if (!isDashed && drawProg < 0.999 && info.len > 0) {
        slot.path.style.strokeDasharray = `${info.len}`
        slot.path.style.strokeDashoffset = `${info.len * (1 - Math.max(0, drawProg))}`
      } else {
        slot.path.style.strokeDasharray = ''
        slot.path.style.strokeDashoffset = ''
      }

      slot.fault.toggleAttribute('hidden', !wState.faultMark)
      if (wState.faultMark) {
        slot.fault.setAttribute('transform', `translate(${info.midX} ${info.midY})`)
      }
    }

    const activePackets = options.reducedMotion ? [] : (frame.packets ?? [])
    for (const [pid, slot] of packetEls) {
      const pkt = activePackets.find(item => item.id === pid)
      const visible = Boolean(pkt && pkt.progress >= 0 && pkt.progress <= 1)
      slot.group.toggleAttribute('hidden', !visible)
      if (!pkt || !visible) continue
      const wireSlot = wireSlotEls.get(pkt.wire)!
      const info = wirePathCache.get(pkt.wire)
      if (!info || info.len <= 0) continue

      const tone = pkt.tone ?? 'green'
      if (slot.group.dataset.tone !== tone) slot.group.dataset.tone = tone
      const width = measurePillWidth(pkt.badge, { sizePx: 10, padX: 14, minWidth: 40 })
      slot.rect.setAttribute('x', String(-width / 2))
      slot.rect.setAttribute('y', '-9.5')
      slot.rect.setAttribute('width', String(width))
      if (slot.text.textContent !== pkt.badge) slot.text.textContent = pkt.badge

      const dist = pkt.reverse ? info.len * (1 - pkt.progress) : info.len * pkt.progress
      const pt = wireSlot.path.getPointAtLength(Math.max(0, Math.min(info.len, dist)))
      slot.group.setAttribute('transform', `translate(${Math.round(pt.x * 10) / 10} ${Math.round(pt.y * 10) / 10})`)
    }

    const activePins = frame.pins ?? []
    for (const [pinId, slot] of pinEls) {
      const pin = activePins.find(item => item.id === pinId)
      slot.group.toggleAttribute('hidden', !pin)
      if (!pin) continue
      const targetBox = worldBoxes[pin.target]
      if (!targetBox) continue
      const tone = pin.tone ?? 'green'
      if (slot.group.dataset.tone !== tone) slot.group.dataset.tone = tone

      const w = measurePillWidth(pin.label, { sizePx: 10, padX: 22, minWidth: 48 })
      slot.rect.setAttribute('x', '0')
      slot.rect.setAttribute('y', '-9.5')
      slot.rect.setAttribute('width', String(w))
      slot.text.setAttribute('x', '15')
      if (slot.text.textContent !== pin.label) slot.text.textContent = pin.label

      const align = pin.align ?? 'top-right'
      const px = align === 'top-right'
        ? targetBox.x + targetBox.w - w + 6
        : targetBox.x + targetBox.w / 2 - w / 2
      const py = align === 'bottom-center'
        ? targetBox.y + targetBox.h + 10
        : targetBox.y - 8
      slot.group.setAttribute('transform', `translate(${Math.round(px * 10) / 10} ${Math.round(py * 10) / 10})`)
    }

    const cam = planCameraViewBox({
      sceneSize,
      boxes: worldBoxes,
      focus: frame.cameraFocus,
      fitOverride: options.fitOverride,
    })

    if (options.reducedMotion || options.dtMs <= 0) {
      currentViewBox = cam.rect
    } else {
      const camBlend = 1 - Math.exp(-Math.min(64, options.dtMs) / 120)
      currentViewBox = {
        x: currentViewBox.x + (cam.rect.x - currentViewBox.x) * camBlend,
        y: currentViewBox.y + (cam.rect.y - currentViewBox.y) * camBlend,
        w: currentViewBox.w + (cam.rect.w - currentViewBox.w) * camBlend,
        h: currentViewBox.h + (cam.rect.h - currentViewBox.h) * camBlend,
      }
      if (
        Math.abs(cam.rect.x - currentViewBox.x) > 0.3 ||
        Math.abs(cam.rect.y - currentViewBox.y) > 0.3 ||
        Math.abs(cam.rect.w - currentViewBox.w) > 0.3 ||
        Math.abs(cam.rect.h - currentViewBox.h) > 0.3
      ) {
        animatingLayout = true
      } else {
        currentViewBox = cam.rect
      }
    }

    art.setAttribute(
      'viewBox',
      `${Math.round(currentViewBox.x * 10) / 10} ${Math.round(currentViewBox.y * 10) / 10} ${Math.round(currentViewBox.w * 10) / 10} ${Math.round(currentViewBox.h * 10) / 10}`,
    )

    for (const entity of spec.entities) {
      const spSlot = spotlightEls.get(entity.id)!
      const eState = frame.entities[entity.id]
      const showSp = Boolean(!eState?.hidden && eState?.emphasis)
      spSlot.group.toggleAttribute('hidden', !showSp)
      if (!showSp) {
        spSlot.group.classList.remove('is-pulsing')
        continue
      }
      const anim = animState.get(entity.id)!
      const box = worldBoxes[entity.id]
      const tone = eState?.tone && eState.tone !== 'slate' ? eState.tone : 'blue'
      if (spSlot.group.dataset.tone !== tone) spSlot.group.dataset.tone = tone
      const geom = computeSpotlightGeometry(
        { x: anim.x, y: anim.y + anim.lift, w: box.w, h: box.h },
        currentViewBox,
        4,
        1.5,
      )
      if (!geom) {
        spSlot.group.setAttribute('hidden', '')
        spSlot.group.classList.remove('is-pulsing')
        continue
      }
      spSlot.halo.setAttribute('x', String(geom.halo.x))
      spSlot.halo.setAttribute('y', String(geom.halo.y))
      spSlot.halo.setAttribute('width', String(geom.halo.w))
      spSlot.halo.setAttribute('height', String(geom.halo.h))
      spSlot.corners.setAttribute('d', geom.cornersPath)
      if (options.reducedMotion) {
        spSlot.group.classList.remove('is-pulsing')
      } else if (stepChanged) {
        spSlot.group.classList.remove('is-pulsing')
        void spSlot.group.getBoundingClientRect()
        spSlot.group.classList.add('is-pulsing')
      }
    }

    for (const [pinId, slot] of pinEls) {
      const pin = activePins.find(item => item.id === pinId)
      if (!pin) continue
      const targetBox = worldBoxes[pin.target]
      if (!targetBox) continue
      const w = Number(slot.rect.getAttribute('width') || 48)
      const align = pin.align ?? 'top-right'
      const rawPx = align === 'top-right'
        ? targetBox.x + targetBox.w - w + 6
        : targetBox.x + targetBox.w / 2 - w / 2
      const rawPy = align === 'bottom-center'
        ? targetBox.y + targetBox.h + 10
        : targetBox.y - 8
      const clampedPx = Math.max(currentViewBox.x + 2, Math.min(currentViewBox.x + currentViewBox.w - w - 2, rawPx))
      const clampedPy = Math.max(currentViewBox.y + 11, Math.min(currentViewBox.y + currentViewBox.h - 11, rawPy))
      slot.group.setAttribute('transform', `translate(${Math.round(clampedPx * 10) / 10} ${Math.round(clampedPy * 10) / 10})`)
    }

    return {
      narrative: {
        eyebrow: frame.eyebrow,
        title: frame.title,
        body: frame.body,
        panel: frame.panel,
        changes: frame.changes,
        hud: frame.hud,
      },
      animatingLayout,
      hasCameraZoom: Boolean(frame.cameraFocus && frame.cameraFocus.length > 0),
    }
  }

  return {
    art,
    render,
    resize,
    describePart(element, stepIndex, variant) {
      const raw = element.dataset.stagePart ?? ''
      if (raw.startsWith('entity:')) {
        const id = raw.slice('entity:'.length) as EntityId
        if (spec.describeEntity) return spec.describeEntity(id, stepIndex, variant)
        return entityMap.get(id)?.part ?? null
      }
      if (raw.startsWith('wire:')) {
        const id = raw.slice('wire:'.length) as WireId
        if (spec.describeWire) return spec.describeWire(id, stepIndex, variant)
        return wireMap.get(id)?.part ?? null
      }
      return null
    },
  }
}
