import type { ViewBoxRect } from './layout.ts'
import { measurePillWidth } from './measure.ts'
import type { StagePartInfo, StageSceneController, StageStepNarrative, StageTone } from './types.ts'

export interface SvgTokenPill {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly label: string
  readonly tone: StageTone
  readonly opacity?: number
}

export interface IsoStageFrame extends StageStepNarrative {
  readonly viewBox?: ViewBoxRect
  readonly tokens?: readonly SvgTokenPill[]
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
