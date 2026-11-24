import { copyPath, evidence, topics } from '../model'
import type { LinkId, Placement } from '../model'
import { createScene } from '../scene'
import type { LessonOptions, LessonScene } from '../timed-lesson/player'
import { frameAt, timeline } from './story'
import type { Anchor } from './story'
import './player.css'

function createGpuScene(stage: HTMLElement, pause: () => void): LessonScene {
  stage.classList.add('gpu-lesson-stage')
  stage.innerHTML = `${createScene()}
    <span class="gpu-lesson-token" data-memory="host" hidden></span>
    <span class="gpu-lesson-token" data-memory="device" hidden></span>`
  const art = stage.querySelector<SVGSVGElement>('.node-diagram')!
  art.classList.add('story-art')
  art.setAttribute('viewBox', '-10 83 895 489')
  art.setAttribute('role', 'group')
  art.querySelector('desc')!.textContent = 'Illustrative A30 node cutaway. Select Inspect to see the names and roles of individual components.'

  const overlay = document.createElementNS(art.namespaceURI, 'g')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.innerHTML = `
    <path class="gpu-lesson-signal" hidden />
    <path class="gpu-lesson-arrow" d="M -6 -5 L 3 0 L -6 5" hidden />
    <circle class="gpu-lesson-packet" r="6" hidden />
    <circle class="gpu-lesson-pulse" r="4" hidden />`
  art.append(overlay)
  const signal = overlay.querySelector<SVGPathElement>('.gpu-lesson-signal')!
  const arrow = overlay.querySelector<SVGPathElement>('.gpu-lesson-arrow')!
  const packet = overlay.querySelector<SVGCircleElement>('.gpu-lesson-packet')!
  const pulse = overlay.querySelector<SVGCircleElement>('.gpu-lesson-pulse')!
  const gpu = art.querySelector<SVGGElement>('.gpu-0')!
  const rams = { local: art.querySelector<SVGGElement>('.bank-1')!, remote: art.querySelector<SVGGElement>('.bank-0')! }
  const cpus = { local: art.querySelector<SVGGElement>('.socket-1')!, remote: art.querySelector<SVGGElement>('.socket-0')! }
  const hostToken = stage.querySelector<HTMLElement>('[data-memory="host"]')!
  const deviceToken = stage.querySelector<HTMLElement>('[data-memory="device"]')!
  const paths = [...art.querySelectorAll<SVGPathElement>('[data-flow]')]
  const pathFor = (link: LinkId) => {
    const path = paths.find(element => element.dataset.flow === link)
    if (!path) throw new Error(`Missing GPU route for ${link}`)
    return path
  }
  const parts = new Map([...art.querySelectorAll<SVGGraphicsElement>('[data-topic]')].map(part => {
    const topic = part.dataset.topic
    const label = part.querySelector('title')
    if (!topic || !Object.hasOwn(topics, topic) || !label?.textContent) throw new Error(`Unknown or unlabeled diagram part: ${topic}`)
    part.dataset.lessonPart = topic
    label.remove()
    const name = topic === 'gpu' ? label.textContent.split(',')[0]! : label.textContent
    return [part, { name, topic, subject: topics[topic as keyof typeof topics] }] as const
  }))

  let placement: Placement = 'local'
  let route: { path: SVGPathElement; length: number }[] = []
  let routeLength = 0
  let reversed = false
  let routeKey = ''
  let signalKey = ''
  const alignTokens = () => {
    const bounds = stage.getBoundingClientRect()
    for (const [token, target, edge] of [[hostToken, rams[placement], 'top'], [deviceToken, gpu, 'bottom']] as const) {
      const rect = target.getBoundingClientRect()
      token.style.left = `${rect.left + rect.width / 2 - bounds.left}px`
      token.style.top = `${rect[edge] - bounds.top}px`
    }
  }
  const choices = [...stage.closest('main')!.querySelectorAll<HTMLButtonElement>('[data-gpu-placement]')]
  for (const choice of choices) choice.addEventListener('click', () => {
    const value = choice.dataset.gpuPlacement
    if (value !== 'local' && value !== 'remote') throw new Error(`Unknown placement: ${value}`)
    if (placement === value) return
    placement = value
    for (const button of choices) button.setAttribute('aria-pressed', String(button === choice))
    alignTokens()
    pause()
  })

  function routePoint(fraction: number): DOMPoint {
    let distance = routeLength * fraction
    for (const [index, segment] of route.entries()) {
      if (distance <= segment.length || index === route.length - 1) {
        return segment.path.getPointAtLength(reversed ? segment.length - distance : distance)
      }
      distance -= segment.length
    }
    throw new Error('No path for the copy operation')
  }

  function draw(elapsedMs: number, reduced: boolean) {
    const frame = frameAt(elapsedMs, placement)
    const targets: Record<Anchor, SVGGraphicsElement> = {
      gpu, ram: rams[placement], cpu: cpus[placement],
      'pcie-link': pathFor('pcie-link'), 'socket-link': pathFor('socket-link'),
    }
    const focus = frame.focus.map(key => targets[key])
    art.classList.toggle('gpu-lesson-neutral', frame.focus.length === 0)
    art.classList.toggle('gpu-lesson-other-dim', frame.allocated)
    art.classList.toggle('gpu-lesson-kernel', frame.kernel)
    art.classList.toggle('gpu-lesson-crossing', placement === 'remote' && frame.copy !== null)
    for (const part of parts.keys()) part.classList.toggle('gpu-lesson-emphasis', focus.includes(part))
    gpu.style.translate = frame.lift && !reduced ? `0 ${-frame.lift}px` : ''

    for (const [token, value, where] of [[hostToken, frame.host, 'Host RAM'], [deviceToken, frame.device, 'GPU memory']] as const) {
      token.hidden = value === null
      if (token.textContent !== (value ?? '')) {
        token.textContent = value
        token.setAttribute('aria-label', `${where}: ${value ?? 'empty'}`)
        token.classList.toggle('gpu-lesson-result', value === 'Result')
      }
      token.style.opacity = reduced ? '' : String(frame.tokenOpacity)
    }

    const key = frame.copy ? `${placement}:${frame.copy.direction}` : ''
    if (key !== routeKey) {
      routeKey = key
      const direction = frame.copy?.direction
      const links = direction ? copyPath(direction, placement) : []
      const active = links.map(pathFor)
      for (const path of paths) path.classList.toggle('gpu-lesson-active', active.includes(path))
      reversed = direction === 'd2h'
      art.classList.toggle('gpu-lesson-return', reversed)
      route = active.map(path => ({ path, length: path.getTotalLength() }))
      routeLength = route.reduce((length, item) => length + item.length, 0)
      arrow.toggleAttribute('hidden', !route.length)
      if (route.length) {
        const point = routePoint(.66)
        const ahead = routePoint(.69)
        const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI
        arrow.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle})`)
      }
    }
    const progress = frame.copy?.progress
    const moving = progress !== null && progress !== undefined && !reduced
    packet.toggleAttribute('hidden', !moving)
    if (moving) movePoint(packet, routePoint(progress))

    const currentSignal = frame.signal ? `${placement}:${frame.signal.kind}` : ''
    if (signalKey !== currentSignal) {
      signalKey = currentSignal
      signal.toggleAttribute('hidden', !frame.signal)
      if (frame.signal?.kind === 'prepare') {
        signal.setAttribute('d', pathFor(placement === 'local' ? 'memory-local' : 'memory-remote').getAttribute('d')!)
      } else if (frame.signal?.kind === 'launch') {
        const cpu = cpus[placement].getBBox()
        const device = gpu.getBBox()
        signal.setAttribute('d', `M ${cpu.x + cpu.width / 2} ${cpu.y + cpu.height / 2} L ${device.x + device.width / 2} ${device.y + device.height / 2}`)
      }
    }
    pulse.toggleAttribute('hidden', !frame.signal || reduced)
    if (frame.signal && !reduced) {
      const distance = frame.signal.kind === 'prepare' ? 1 - frame.signal.progress : frame.signal.progress
      movePoint(pulse, signal.getPointAtLength(signal.getTotalLength() * distance))
    }

    return {
      target: targets[frame.note.anchor], title: frame.note.title, text: frame.note.text,
      avoid: [
        ...focus, ...route.map(({ path }) => path), ...(frame.signal ? [signal] : []),
        ...[hostToken, deviceToken].filter(token => !token.hidden),
      ],
    }
  }

  return {
    art, draw, resize: alignTokens,
    describe(part, elapsedMs) {
      const { name, topic, subject } = parts.get(part)!
      const { allocated } = frameAt(elapsedMs, placement)
      const role = topic === 'gpu' ? !allocated ? 'GPU accelerator' : part === gpu ? 'Allocated GPU' : 'Not in this allocation'
        : topic === 'memory' ? part === rams[placement] ? 'Active host RAM' : 'Other socket’s RAM'
          : topic === 'cpu' ? part === cpus[placement] ? 'Host CPU' : 'Other CPU socket'
            : topic === 'pcie' ? 'Host-to-device link'
              : topic === 'numa' ? 'Inter-socket link' : 'Cluster network interface'
      return { name, role, detail: subject.takeaway }
    },
  }
}

function movePoint(circle: SVGCircleElement, point: DOMPoint): void {
  circle.setAttribute('cx', String(point.x))
  circle.setAttribute('cy', String(point.y))
}

export const lesson: LessonOptions = {
  title: 'Host to GPU',
  subtitle: 'A30 cutaway · Explicit copies',
  diagramLabel: 'Interactive A30 diagram',
  timeline,
  controls: `<div class="gpu-lesson-placement" role="group" aria-label="Host RAM placement">
    <button type="button" data-gpu-placement="local" aria-pressed="true">Local</button>
    <button type="button" data-gpu-placement="remote" aria-pressed="false">Cross-socket</button>
  </div>`,
  footer: `<p>Illustrative routes and timing</p><a href="${evidence.hardwareSource}" target="_blank" rel="noopener noreferrer">HPC4 specifications</a>`,
  createScene: createGpuScene,
}
