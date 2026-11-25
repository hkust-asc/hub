import { computeSpotlightGeometry } from './layout.ts'
import type { ViewBoxRect } from './layout.ts'
import { measurePillWidth } from './measure.ts'
import type { StageBox, StagePartInfo, StageSceneController, StageStepNarrative, StageTone } from './types.ts'

export interface SvgTokenPill {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly label: string
  readonly tone: StageTone
  readonly opacity?: number
}

export interface IsoSpotlightTarget {
  readonly id: string
  readonly element?: SVGGraphicsElement
  readonly box?: StageBox
  readonly tone?: StageTone
}

export interface IsoStageFrame extends StageStepNarrative {
  readonly viewBox?: ViewBoxRect
  readonly tokens?: readonly SvgTokenPill[]
  readonly spotlights?: readonly IsoSpotlightTarget[]
}

export interface IsoStageSpec<VariantId extends string = string> {
  readonly id: string
  readonly baseViewBox: ViewBoxRect
  readonly tokenIds?: readonly string[]
  buildSvg(): string
  bind(art: SVGSVGElement): {
    applyFrame(options: {
      stepIndex: number
      beatProgress: number
      variant: VariantId
      reducedMotion: boolean
    }): IsoStageFrame
    describePart(element: SVGGraphicsElement, stepIndex: number, variant: VariantId): StagePartInfo | null
  }
}

export function createIsoStageScene<VariantId extends string = string>(
  canvas: HTMLElement,
  spec: IsoStageSpec<VariantId>,
): StageSceneController<VariantId> {
  canvas.innerHTML = spec.buildSvg()
  const art = canvas.querySelector<SVGSVGElement>('svg')!
  art.classList.add('stage-svg', 'stage-iso-svg')

  const spotlightLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  spotlightLayer.setAttribute('class', 'layer-spotlight st-iso-spotlights')
  spotlightLayer.setAttribute('aria-hidden', 'true')
  art.append(spotlightLayer)

  const tokenLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  tokenLayer.setAttribute('class', 'layer-over st-iso-tokens')
  tokenLayer.setAttribute('aria-hidden', 'true')
  tokenLayer.innerHTML = (spec.tokenIds ?? []).map(id => `
    <g class="st-token" data-token="${id}" data-tone="amber" hidden>
      <rect height="22"/>
      <text y="4"></text>
    </g>
  `).join('')
  art.append(tokenLayer)

  const spotlightEls = new Map<string, { group: SVGGElement; halo: SVGRectElement; corners: SVGPathElement }>()
  function getSpotlightSlot(id: string) {
    let slot = spotlightEls.get(id)
    if (slot) return slot
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'st-spotlight')
    group.dataset.spotlight = id
    group.dataset.tone = 'blue'
    group.setAttribute('hidden', '')
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    halo.setAttribute('class', 'st-spotlight-halo')
    const corners = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    corners.setAttribute('class', 'st-spotlight-corners')
    group.append(halo, corners)
    spotlightLayer.append(group)
    slot = { group, halo, corners }
    spotlightEls.set(id, slot)
    return slot
  }

  const tokenEls = new Map(
    (spec.tokenIds ?? []).map(id => {
      const group = tokenLayer.querySelector<SVGGElement>(`[data-token="${id}"]`)!
      return [id, {
        group,
        rect: group.querySelector<SVGRectElement>('rect')!,
        text: group.querySelector<SVGTextElement>('text')!,
      }]
    }),
  )

  const binding = spec.bind(art)
  let currentViewBox: ViewBoxRect = { ...spec.baseViewBox }
  let lastSpotlightStepKey = ''
  art.setAttribute('viewBox', `${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.w} ${currentViewBox.h}`)

  return {
    art,
    resize() {
      // SVG viewBox scales responsively; no HTML token alignment needed.
    },
    render(options) {
      const progress = options.reducedMotion ? 1 : options.beatProgress
      const frame = binding.applyFrame({
        stepIndex: options.stepIndex,
        beatProgress: progress,
        variant: options.variant,
        reducedMotion: options.reducedMotion,
      })

      const tokens = frame.tokens ?? []
      for (const [id, slot] of tokenEls) {
        const tok = tokens.find(t => t.id === id)
        slot.group.toggleAttribute('hidden', !tok)
        if (!tok) continue
        if (slot.group.dataset.tone !== tok.tone) slot.group.dataset.tone = tok.tone
        const w = measurePillWidth(tok.label, { sizePx: 11, padX: 16, minWidth: 48 })
        slot.rect.setAttribute('x', String(-w / 2))
        slot.rect.setAttribute('y', '-11')
        slot.rect.setAttribute('width', String(w))
        if (slot.text.textContent !== tok.label) slot.text.textContent = tok.label
        slot.group.setAttribute('transform', `translate(${Math.round(tok.x * 10) / 10} ${Math.round(tok.y * 10) / 10})`)
        slot.group.style.opacity = tok.opacity !== undefined && !options.reducedMotion
          ? String(Math.round(tok.opacity * 100) / 100)
          : ''
      }

      const targetVb = options.fitOverride || !frame.viewBox ? spec.baseViewBox : frame.viewBox
      let animatingLayout = false
      if (options.reducedMotion || options.dtMs <= 0) {
        currentViewBox = targetVb
      } else {
        const camBlend = 1 - Math.exp(-Math.min(64, options.dtMs) / 125)
        currentViewBox = {
          x: currentViewBox.x + (targetVb.x - currentViewBox.x) * camBlend,
          y: currentViewBox.y + (targetVb.y - currentViewBox.y) * camBlend,
          w: currentViewBox.w + (targetVb.w - currentViewBox.w) * camBlend,
          h: currentViewBox.h + (targetVb.h - currentViewBox.h) * camBlend,
        }
        if (
          Math.abs(targetVb.x - currentViewBox.x) > 0.3 ||
          Math.abs(targetVb.y - currentViewBox.y) > 0.3 ||
          Math.abs(targetVb.w - currentViewBox.w) > 0.3 ||
          Math.abs(targetVb.h - currentViewBox.h) > 0.3
        ) {
          animatingLayout = true
        } else {
          currentViewBox = targetVb
        }
      }

      art.setAttribute(
        'viewBox',
        `${Math.round(currentViewBox.x * 10) / 10} ${Math.round(currentViewBox.y * 10) / 10} ${Math.round(currentViewBox.w * 10) / 10} ${Math.round(currentViewBox.h * 10) / 10}`,
      )

      const spotlights = frame.spotlights ?? []
      art.dataset.spotlight = String(spotlights.length > 0)
      art.dataset.reducedMotion = String(options.reducedMotion)
      const stepKey = `${options.stepIndex}:${options.variant}`
      const stepChanged = stepKey !== lastSpotlightStepKey
      lastSpotlightStepKey = stepKey

      const activeIds = new Set(spotlights.map(sp => sp.id))
      for (const [id, slot] of spotlightEls) {
        if (!activeIds.has(id)) {
          slot.group.setAttribute('hidden', '')
          slot.group.classList.remove('is-pulsing')
        }
      }
      for (const sp of spotlights) {
        const rawBox = sp.box ?? (typeof sp.element?.getBBox === 'function'
          ? (() => {
            const b = sp.element.getBBox()
            return b.width > 0 && b.height > 0 ? { x: b.x, y: b.y, w: b.width, h: b.height } : null
          })()
          : null)
        const slot = getSpotlightSlot(sp.id)
        if (!rawBox) {
          slot.group.setAttribute('hidden', '')
          continue
        }
        const geom = computeSpotlightGeometry(rawBox, currentViewBox, 6, 2)
        if (!geom) {
          slot.group.setAttribute('hidden', '')
          slot.group.classList.remove('is-pulsing')
          continue
        }
        slot.group.removeAttribute('hidden')
        const tone = sp.tone ?? 'blue'
        if (slot.group.dataset.tone !== tone) slot.group.dataset.tone = tone
        slot.halo.setAttribute('x', String(geom.halo.x))
        slot.halo.setAttribute('y', String(geom.halo.y))
        slot.halo.setAttribute('width', String(geom.halo.w))
        slot.halo.setAttribute('height', String(geom.halo.h))
        slot.corners.setAttribute('d', geom.cornersPath)
        if (options.reducedMotion) {
          slot.group.classList.remove('is-pulsing')
        } else if (stepChanged) {
          slot.group.classList.remove('is-pulsing')
          void slot.group.getBoundingClientRect()
          slot.group.classList.add('is-pulsing')
        }
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
        hasCameraZoom: Boolean(frame.viewBox),
      }
    },
    describePart(element, stepIndex, variant) {
      return binding.describePart(element, stepIndex, variant)
    },
  }
}
