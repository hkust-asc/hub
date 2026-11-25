import { copyPath, evidence, topics } from '../model.ts'
import type { LinkId, Placement } from '../model.ts'
import { a30TokenAnchors, createScene } from '../scene.ts'
import { createIsoStageScene } from '../stage/iso-scene.ts'
import type { SvgTokenPill } from '../stage/iso-scene.ts'
import type { StageScenarioOptions } from '../stage/types.ts'
import { evaluateGpuStep, gpuSteps } from './story.ts'
import type { GpuFocusPart } from './story.ts'

function moveCircle(circle: SVGCircleElement, point: DOMPoint): void {
  circle.setAttribute('cx', String(Math.round(point.x * 10) / 10))
  circle.setAttribute('cy', String(Math.round(point.y * 10) / 10))
}

export const lesson: StageScenarioOptions<Placement> = {
  id: 'host-to-gpu',
  title: 'Host to GPU',
  subtitle: 'A30 cutaway · Explicit copies',
  diagramLabel: 'Interactive A30 host-to-GPU transfer cutaway',
  steps: gpuSteps,
  variants: {
    label: 'Host RAM placement',
    defaultId: 'local',
    options: [
      { id: 'local', label: 'Local' },
      { id: 'remote', label: 'Cross-socket' },
    ],
  },
  footer: {
    note: 'Illustrative routes and timing',
    sourceLabel: 'HPC4 specifications',
    sourceHref: evidence.hardwareSource,
  },
  mountScene: canvas =>
    createIsoStageScene<Placement>(canvas, {
      id: 'host-to-gpu',
      baseViewBox: { x: 10, y: 82, w: 860, h: 455 },
      tokenIds: ['host', 'device'],
      buildSvg: () => createScene('gpu-stage'),
      bind(art) {
        art.setAttribute('role', 'group')
        art.querySelector('desc')!.textContent =
          'Illustrative A30 node cutaway. Use Inspect to see the names and roles of individual components.'

        const motionOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        motionOverlay.setAttribute('aria-hidden', 'true')
        motionOverlay.innerHTML = `
          <path class="gpu-stage-signal" hidden />
          <path class="gpu-stage-arrow" d="M -6 -5 L 3 0 L -6 5" hidden />
          <circle class="gpu-stage-packet" r="6" hidden />
          <circle class="gpu-stage-pulse" r="4.5" hidden />`
        art.append(motionOverlay)

        const signalEl = motionOverlay.querySelector<SVGPathElement>('.gpu-stage-signal')!
        const arrowEl = motionOverlay.querySelector<SVGPathElement>('.gpu-stage-arrow')!
        const packetEl = motionOverlay.querySelector<SVGCircleElement>('.gpu-stage-packet')!
        const pulseEl = motionOverlay.querySelector<SVGCircleElement>('.gpu-stage-pulse')!

        const gpu0 = art.querySelector<SVGGElement>('.gpu-0')!
        const rams = {
          local: art.querySelector<SVGGElement>('.bank-1')!,
          remote: art.querySelector<SVGGElement>('.bank-0')!,
        }
        const cpus = {
          local: art.querySelector<SVGGElement>('.socket-1')!,
          remote: art.querySelector<SVGGElement>('.socket-0')!,
        }
        const flowPaths = [...art.querySelectorAll<SVGPathElement>('[data-flow]')]
        const pathFor = (link: LinkId) => {
          const found = flowPaths.find(el => el.dataset.flow === link)
          if (!found) throw new Error(`Missing GPU route for ${link}`)
          return found
        }

        const partMeta = new Map(
          [...art.querySelectorAll<SVGGraphicsElement>('[data-topic]')].map(el => {
            const topic = el.dataset.topic!
            const titleEl = el.querySelector('title')
            const rawLabel = titleEl?.textContent ?? topics[topic as keyof typeof topics].name
            titleEl?.remove()
            el.dataset.stagePart = topic
            el.dataset.lessonPart = topic
            el.setAttribute('tabindex', '-1')
            const name = topic === 'gpu' ? rawLabel.split(',')[0]! : rawLabel
            return [el, { name, topic, subject: topics[topic as keyof typeof topics] }] as const
          }),
        )

        let routeKey = ''
        let routeSegments: { path: SVGPathElement; length: number }[] = []
        let routeTotalLen = 0
        let reversed = false
        let signalKey = ''

        function routePoint(fraction: number): DOMPoint {
          let dist = routeTotalLen * Math.max(0, Math.min(1, fraction))
          for (const [idx, seg] of routeSegments.entries()) {
            if (dist <= seg.length || idx === routeSegments.length - 1) {
              return seg.path.getPointAtLength(reversed ? seg.length - dist : dist)
            }
            dist -= seg.length
          }
          return new DOMPoint(0, 0)
        }

        return {
          applyFrame({ stepIndex, beatProgress, variant, reducedMotion }) {
            const frame = evaluateGpuStep(stepIndex, beatProgress, variant)
            const focusTargets: Record<GpuFocusPart, SVGGraphicsElement> = {
              gpu: gpu0,
              ram: rams[variant],
              cpu: cpus[variant],
            }
            const focusedEls = frame.focus.map(k => focusTargets[k])

            art.dataset.dimUnfocused = String(frame.focus.length > 0)
            art.dataset.allocated = String(frame.allocated)
            art.dataset.kernel = String(frame.kernel)
            art.dataset.crossing = String(variant === 'remote' && frame.copy !== null)
            art.dataset.direction = frame.copy?.direction ?? 'h2d'

            for (const el of partMeta.keys()) {
              el.classList.toggle('st-iso-focus', focusedEls.includes(el))
            }
            gpu0.style.transform = frame.lift && !reducedMotion ? `translateY(${-frame.lift}px)` : ''

            const nextRouteKey = frame.copy ? `${variant}:${frame.copy.direction}` : ''
            if (nextRouteKey !== routeKey) {
              routeKey = nextRouteKey
              const dir = frame.copy?.direction
              const activeLinks = dir ? copyPath(dir, variant) : []
              const activeEls = activeLinks.map(pathFor)
              for (const p of flowPaths) p.classList.toggle('st-iso-route', activeEls.includes(p))
              reversed = dir === 'd2h'
              routeSegments = activeEls.map(path => ({ path, length: path.getTotalLength() }))
              routeTotalLen = routeSegments.reduce((sum, seg) => sum + seg.length, 0)
              arrowEl.toggleAttribute('hidden', routeSegments.length === 0)
              if (routeSegments.length > 0) {
                const pt = routePoint(0.66)
                const ahead = routePoint(0.69)
                const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI
                arrowEl.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${angle})`)
              }
            }

            const copyProg = frame.copy?.progress
            const showPacket = copyProg !== null && copyProg !== undefined && !reducedMotion
            packetEl.toggleAttribute('hidden', !showPacket)
            if (showPacket) moveCircle(packetEl, routePoint(copyProg))

            const nextSigKey = frame.signal ? `${variant}:${frame.signal.kind}` : ''
            if (nextSigKey !== signalKey) {
              signalKey = nextSigKey
              signalEl.toggleAttribute('hidden', !frame.signal)
              if (frame.signal?.kind === 'prepare') {
                signalEl.setAttribute('d', pathFor(variant === 'local' ? 'memory-local' : 'memory-remote').getAttribute('d')!)
              } else if (frame.signal?.kind === 'launch') {
                const cpuBox = cpus[variant].getBBox()
                const devBox = gpu0.getBBox()
                signalEl.setAttribute(
                  'd',
                  `M ${cpuBox.x + cpuBox.width / 2} ${cpuBox.y + cpuBox.height / 2} L ${devBox.x + devBox.width / 2} ${devBox.y + devBox.height / 2}`,
                )
              }
            }

            const showPulse = Boolean(frame.signal) && !reducedMotion
            pulseEl.toggleAttribute('hidden', !showPulse)
            if (frame.signal && showPulse) {
              const dist = frame.signal.kind === 'prepare' ? 1 - frame.signal.progress : frame.signal.progress
              moveCircle(pulseEl, signalEl.getPointAtLength(signalEl.getTotalLength() * dist))
            }

            const tokens: SvgTokenPill[] = []
            if (frame.host) {
              const [hx, hy] = variant === 'local' ? a30TokenAnchors.hostLocal : a30TokenAnchors.hostRemote
              tokens.push({
                id: 'host',
                x: hx,
                y: hy,
                label: `RAM · ${frame.host}`,
                tone: frame.host === 'Result' ? 'green' : 'amber',
                opacity: frame.tokenOpacity,
              })
            }
            if (frame.device) {
              const [dx, dy] = a30TokenAnchors.device
              tokens.push({
                id: 'device',
                x: dx,
                y: dy,
                label: `HBM2 · ${frame.device}`,
                tone: frame.device === 'Result' ? 'green' : 'blue',
                opacity: frame.tokenOpacity,
              })
            }

            return {
              eyebrow: frame.eyebrow,
              title: frame.title,
              body: frame.body,
              panel: frame.panel,
              changes: frame.changes,
              hud: frame.hud,
              viewBox: frame.viewBox,
              tokens,
              spotlights: frame.focus.map(k => ({
                id: k,
                element: focusTargets[k],
                tone: k === 'gpu' ? 'blue' : k === 'ram' ? 'green' : 'amber',
              })),
            }
          },
          describePart(element, stepIndex, variant) {
            const meta = partMeta.get(element)
            if (!meta) return null
            const { name, topic, subject } = meta
            const frame = evaluateGpuStep(stepIndex, 1, variant)
            const role = topic === 'gpu'
              ? !frame.allocated
                ? 'GPU accelerator'
                : element === gpu0
                  ? 'Allocated GPU (#0)'
                  : 'Outside this 1-GPU allocation'
              : topic === 'memory'
                ? element === rams[variant]
                  ? 'Active host DDR5 RAM'
                  : 'Other socket’s DDR5 RAM'
                : topic === 'cpu'
                  ? element === cpus[variant]
                    ? 'Active host CPU socket'
                    : 'Other CPU socket'
                  : topic === 'pcie'
                    ? 'Host-to-device PCIe path'
                    : topic === 'numa'
                      ? 'Inter-socket NUMA link'
                      : 'Cluster RoCE network interface'
            return { name, role, detail: subject.takeaway }
          },
        }
      },
    }),
}

