import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '../app.css'
import './player.css'
import { createIcons, ArrowLeft, Pause, Play, RotateCcw, Search, SkipBack, SkipForward, X } from 'lucide'
import { icon } from '../layout'
import { evidence, topics, transferPath } from '../model'
import type { Placement, TopicId } from '../model'
import { createScene } from '../scene'
import { beats, durationMs, frameAt, positionAt, updatePlayback } from './story'
import type { PlaybackAction, PlaybackState } from './story'

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const app = document.querySelector<HTMLDivElement>('#app')!
document.title = 'Host to GPU / HPC4 Anatomy'
app.innerHTML = `
  <main class="gpu-lesson-player">
    <header class="gpu-lesson-header">
      <a class="gpu-lesson-back" href="./">${icon('arrow-left')} Anatomy</a>
      <div class="gpu-lesson-heading"><h1>Host to GPU</h1><p>A30 cutaway</p></div>
      <label class="gpu-lesson-placement">Host RAM placement
        <select id="gpu-lesson-placement"><option value="local">Local to GPU</option><option value="remote">Cross-socket</option></select>
      </label>
    </header>
    <div class="gpu-lesson-theater">
      <section class="gpu-lesson-stage" id="gpu-lesson-stage" aria-label="Interactive A30 diagram">
        ${createScene()}
        <svg class="gpu-lesson-leader" aria-hidden="true"><line /><circle r="3" /></svg>
        <div class="gpu-lesson-callout" hidden>
          <button type="button" class="gpu-lesson-close" aria-label="Close part details" hidden>${icon('x')}</button>
          <div class="gpu-lesson-callout-copy" aria-atomic="true">
            <h2 tabindex="-1"></h2>
            <p></p>
          </div>
        </div>
      </section>
      <section class="gpu-lesson-controls" aria-label="Playback and timeline">
        <div class="gpu-lesson-status"><span id="gpu-lesson-beat-status"></span><span id="gpu-lesson-time"></span></div>
        <div class="gpu-lesson-slider">
          <div class="gpu-lesson-rail" aria-hidden="true">
            <div class="gpu-lesson-fill"></div>
            ${beats.slice(1).map(beat => `<span class="gpu-lesson-tick" style="left: ${beat.startMs / durationMs * 100}%"></span>`).join('')}
          </div>
          <input type="range" id="gpu-lesson-position" aria-label="Lesson timeline" min="0" max="${durationMs}" step="1" value="0" />
        </div>
        <div class="gpu-lesson-beats" style="grid-template-columns: ${beats.map(beat => `${beat.durationMs}fr`).join(' ')}">
          ${beats.map((beat, i) => `<button type="button" data-gpu-lesson-beat="${i}" title="${beat.label} at ${formatTime(beat.startMs)}" aria-label="Jump to ${beat.label}">${beat.label}</button>`).join('')}
        </div>
        <div class="gpu-lesson-transport" role="group" aria-label="Playback controls">
          <button type="button" id="gpu-lesson-inspect" aria-pressed="false" title="Pause and identify parts">${icon('search')} Inspect</button>
          <div class="gpu-lesson-transport-center">
            <button type="button" id="gpu-lesson-previous" aria-label="Previous beat">${icon('skip-back')}</button>
            <button type="button" id="gpu-lesson-play"><span data-pause>${icon('pause')}</span><span data-play>${icon('play')}</span></button>
            <button type="button" id="gpu-lesson-next" aria-label="Next beat">${icon('skip-forward')}</button>
          </div>
          <button type="button" id="gpu-lesson-replay" aria-label="Replay lesson" title="Replay lesson">${icon('rotate-ccw')}</button>
        </div>
      </section>
    </div>
    <footer class="gpu-lesson-footer"><p>Illustrative routes and timing</p><a href="${evidence.hardwareSource}">HPC4 specifications</a></footer>
  </main>`
createIcons({ icons: { ArrowLeft, Pause, Play, RotateCcw, Search, SkipBack, SkipForward, X }, attrs: { 'aria-hidden': 'true', 'stroke-width': 1.65 } })

const find = <T extends Element = HTMLElement>(selector: string) => app.querySelector<T>(selector)!
const stage = find('#gpu-lesson-stage')
const art = find<SVGSVGElement>('.node-diagram')
art.setAttribute('viewBox', '-10 83 895 489')
art.setAttribute('role', 'group')
art.querySelector('desc')!.textContent = 'Illustrative A30 node cutaway. Select Inspect to see the names and roles of individual components.'

const pathElements = Array.from(art.querySelectorAll<SVGPathElement>('[data-flow]'))
const flow = document.createElementNS(art.namespaceURI, 'g')
flow.setAttribute('aria-hidden', 'true')
flow.innerHTML = '<path class="gpu-lesson-arrow" d="M -6 -5 L 3 0 L -6 5" /><circle class="gpu-lesson-packet" r="6" />'
art.append(flow)
const arrow = flow.querySelector('path')!
const packet = flow.querySelector('circle')!
const gpu = find<SVGElement>('.gpu-0')
const localRam = find<SVGElement>('.bank-1')
const remoteRam = find<SVGElement>('.bank-0')

const parts = new Map(Array.from(art.querySelectorAll<SVGElement>('[data-topic]'), part => {
  const topic = part.dataset.topic
  const label = part.querySelector('title')
  if (!topic || !Object.hasOwn(topics, topic) || !label?.textContent) throw new Error(`Unknown or unlabeled diagram part: ${topic}`)
  const name = topic === 'gpu' ? label.textContent.split(',')[0]! : label.textContent
  label.remove()
  return [part, { name, subject: topics[topic as TopicId] }] as const
}))

const slider = find<HTMLInputElement>('#gpu-lesson-position')
const fill = find('.gpu-lesson-fill')
const status = find('#gpu-lesson-beat-status')
const time = find('#gpu-lesson-time')
const jumps = Array.from(app.querySelectorAll<HTMLButtonElement>('[data-gpu-lesson-beat]'))
const play = find<HTMLButtonElement>('#gpu-lesson-play')
const playIcon = find('#gpu-lesson-play [data-play]')
const pauseIcon = find('#gpu-lesson-play [data-pause]')
const previous = find<HTMLButtonElement>('#gpu-lesson-previous')
const next = find<HTMLButtonElement>('#gpu-lesson-next')
const inspect = find<HTMLButtonElement>('#gpu-lesson-inspect')
const card = find('.gpu-lesson-callout')
const cardTitle = find('.gpu-lesson-callout h2')
const cardText = find('.gpu-lesson-callout p')
const close = find<HTMLButtonElement>('.gpu-lesson-close')
const leader = find<SVGSVGElement>('.gpu-lesson-leader')
const leaderLine = leader.querySelector('line')!
const leaderDot = leader.querySelector('circle')!
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

let hasStarted = !document.hidden
let playback: PlaybackState = { positionMs: 0, startedAt: hasStarted ? performance.now() : null, inspection: null }
let placement: Placement = 'local'
let playing = false
let hovered: SVGElement | null = null
let focused: SVGElement | null = null
let pinned: SVGElement | null = null
let animationFrame = 0
let renderedBeat = -1
let renderedPlacement: Placement | undefined
let renderedInspection: boolean | undefined
let route: { path: SVGPathElement; length: number }[] = []
let routeLength = 0
let reversed = false
let drag: { pointerId: number; resume: boolean } | null = null
let callout: { target: SVGElement; title: string; text: string; kind: 'note' | 'hover' | 'details' } | null = null

function placeCallout(): void {
  if (!callout) return
  const bounds = stage.getBoundingClientRect()
  const target = callout.target.getBoundingClientRect()
  const padding = 10
  const gap = 13
  const width = card.offsetWidth
  const height = card.offsetHeight
  const left = target.left - bounds.left
  const top = target.top - bounds.top
  const right = left + target.width
  const bottom = top + target.height
  const x = (left + right) / 2
  const y = (top + bottom) / 2
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const sideY = clamp(y - height / 2, padding, bounds.height - height - padding)
  const verticalX = clamp(x - width / 2, padding, bounds.width - width - padding)
  const sides = [[left - gap - width, sideY], [right + gap, sideY]]
  if (x > bounds.width / 2) sides.reverse()
  const vertical = [[verticalX, top - gap - height], [verticalX, bottom + gap]]
  if (y > bounds.height / 2) vertical.reverse()
  const candidates = (bounds.width < 550 ? [...vertical, ...sides] : [...sides, ...vertical]).filter(([cx, cy]) =>
    cx! >= padding && cy! >= padding && cx! + width <= bounds.width - padding && cy! + height <= bounds.height - padding
  )
  const active = callout.kind === 'note' ? [...art.querySelectorAll('.gpu-lesson-emphasis, [data-flow].gpu-lesson-active')]
    .map(element => element.getBoundingClientRect()) : []
  const [cardX, cardY] = candidates.find(([cx, cy]) => active.every(rect =>
    bounds.left + cx! + width <= rect.left || bounds.left + cx! >= rect.right ||
    bounds.top + cy! + height <= rect.top || bounds.top + cy! >= rect.bottom
  )) ?? candidates[0] ?? [verticalX, sideY]
  card.style.left = `${cardX}px`
  card.style.top = `${cardY}px`
  leaderLine.setAttribute('x1', String(x))
  leaderLine.setAttribute('y1', String(y))
  leaderLine.setAttribute('x2', String(clamp(x, cardX!, cardX! + width)))
  leaderLine.setAttribute('y2', String(clamp(y, cardY!, cardY! + height)))
  leaderDot.setAttribute('cx', String(x))
  leaderDot.setAttribute('cy', String(y))
}

function showCallout(nextCallout: typeof callout, layoutChanged = false): void {
  if (callout?.target === nextCallout?.target && callout?.title === nextCallout?.title &&
      callout?.text === nextCallout?.text && callout?.kind === nextCallout?.kind) {
    if (layoutChanged) placeCallout()
    return
  }
  callout = nextCallout
  card.hidden = !callout
  leader.toggleAttribute('hidden', !callout)
  if (!callout) return
  card.dataset.kind = callout.kind
  find('.gpu-lesson-callout-copy').setAttribute('aria-live', callout.kind === 'note' ? 'polite' : 'off')
  close.hidden = callout.kind !== 'details'
  cardTitle.textContent = callout.title
  cardText.textContent = callout.text
  placeCallout()
}

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

function drawScene(frame: ReturnType<typeof frameAt>): void {
  const { beat, index, note, packetProgress } = frame
  const ram = placement === 'local' ? localRam : remoteRam
  const inspecting = playback.inspection !== null
  const layoutChanged = renderedBeat !== index || renderedPlacement !== placement
  if (layoutChanged) {
    art.dataset.gpuLessonBeat = beat.label
    for (const part of parts.keys()) part.classList.toggle('gpu-lesson-emphasis',
      part === gpu && beat.focus.includes('device') || part === ram && beat.focus.includes('host'))
    const copy = beat.copy
    const links = transferPath(copy?.direction ?? null, placement)
    if (copy && !links.length) throw new Error(`Missing ${copy.direction} route for ${placement} placement`)
    for (const path of pathElements) path.classList.toggle('gpu-lesson-active', links.some(id => id === path.dataset.flow))
    route = links.map(id => {
      const path = pathElements.find(element => element.dataset.flow === id)
      if (!path) throw new Error(`Missing SVG route for ${id}`)
      return { path, length: path.getTotalLength() }
    })
    routeLength = route.reduce((length, part) => length + part.length, 0)
    reversed = beat.copy?.direction === 'd2h'
    arrow.classList.toggle('gpu-lesson-active', route.length > 0)
    if (route.length) {
      const point = routePoint(.66)
      const ahead = routePoint(.69)
      const angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI
      arrow.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle})`)
    }
    renderedBeat = index
    renderedPlacement = placement
  }
  packet.classList.toggle('gpu-lesson-active', packetProgress !== null && !reduceMotion.matches && !inspecting)
  if (packetProgress !== null && route.length && !reduceMotion.matches && !inspecting) {
    const point = routePoint(packetProgress)
    packet.setAttribute('cx', String(point.x))
    packet.setAttribute('cy', String(point.y))
  }
  if (inspecting !== renderedInspection) {
    stage.classList.toggle('gpu-lesson-identify', inspecting)
    for (const part of parts.keys()) part.setAttribute('tabindex', inspecting ? '0' : '-1')
    renderedInspection = inspecting
  }
  const selected = inspecting ? pinned ?? hovered ?? focused : null
  const info = selected ? parts.get(selected)! : undefined
  if (!inspecting) showCallout({ target: beat.anchor === 'host' ? ram : gpu, ...note, kind: 'note' }, layoutChanged)
  else if (selected && info) showCallout({
    target: selected,
    title: info.name,
    text: pinned ? info.subject.takeaway : selected === gpu ? 'GPU used in this lesson'
      : selected === ram ? 'Host RAM used in this lesson' : info.subject.eyebrow.split(' / ')[1]!,
    kind: pinned ? 'details' : 'hover',
  })
  else showCallout(null)
}

function paint(now: number): void {
  const frame = frameAt(positionAt(playback, now))
  const ended = frame.elapsedMs === durationMs
  if (ended && playback.startedAt !== null) playback = updatePlayback(playback, { type: 'pause' }, now)
  playing = playback.startedAt !== null
  fill.style.transform = `scaleX(${frame.elapsedMs / durationMs})`
  slider.value = String(Math.round(frame.elapsedMs))
  const position = formatTime(frame.elapsedMs)
  const valueText = `${position}, ${frame.beat.label}, beat ${frame.index + 1} of ${beats.length}`
  if (slider.getAttribute('aria-valuetext') !== valueText) slider.setAttribute('aria-valuetext', valueText)
  const clockText = `${position} / ${formatTime(durationMs)}`
  if (time.textContent !== clockText) time.textContent = clockText
  const inspecting = playback.inspection !== null
  const caption = inspecting ? 'Identify mode: point at or select a part' : `${frame.beat.label} (${frame.index + 1} of ${beats.length})`
  if (status.textContent !== caption) status.textContent = caption
  const playLabel = playing ? 'Pause lesson' : ended ? 'Replay from start' : 'Resume lesson'
  if (play.getAttribute('aria-label') !== playLabel) {
    play.setAttribute('aria-label', playLabel)
    play.title = playLabel
    playIcon.hidden = playing
    pauseIcon.hidden = !playing
  }
  if (renderedBeat !== frame.index) {
    previous.disabled = frame.index === 0
    next.disabled = frame.index === beats.length - 1
    previous.title = frame.index > 0 ? `Back to ${beats[frame.index - 1]!.label}` : 'Previous beat'
    next.title = frame.index < beats.length - 1 ? `Up next: ${beats[frame.index + 1]!.label}` : 'Next beat'
    for (const [index, jump] of jumps.entries()) {
      if (index === frame.index) jump.setAttribute('aria-current', 'step')
      else jump.removeAttribute('aria-current')
    }
  }
  if (renderedInspection !== inspecting) {
    inspect.setAttribute('aria-pressed', String(inspecting))
    inspect.title = inspecting ? 'Leave Identify mode' : 'Pause and identify parts'
  }
  drawScene(frame)
  if (playing) animationFrame = requestAnimationFrame(paint)
}

function refresh(now = performance.now()): void {
  cancelAnimationFrame(animationFrame)
  paint(now)
}

function act(action: PlaybackAction): void {
  const now = performance.now()
  playback = updatePlayback(playback, action, now)
  if (!playback.inspection && pinned) {
    pinned.setAttribute('aria-pressed', 'false')
    pinned = null
  }
  refresh(now)
}

function seekBeat(index: number): void {
  const beat = beats[index]
  if (!beat) throw new RangeError(`Unknown storyboard beat: ${index}`)
  act({ type: 'seek', positionMs: beat.startMs })
}

function partAt(target: EventTarget | null): SVGElement | null {
  return target instanceof Element ? target.closest<SVGElement>('[data-topic]') : null
}

function pinPart(part: SVGElement): void {
  if (!playback.inspection) act({ type: 'inspect' })
  pinned?.setAttribute('aria-pressed', 'false')
  pinned = part
  part.setAttribute('aria-pressed', 'true')
  refresh()
  cardTitle.focus({ preventScroll: true })
}

function closeDetails(): void {
  const part = pinned
  pinned = null
  part?.setAttribute('aria-pressed', 'false')
  part?.focus({ preventScroll: true })
  refresh()
}

art.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return
  const part = partAt(event.target)
  if (part === hovered) return
  hovered?.classList.remove('gpu-lesson-hovered')
  hovered = part
  hovered?.classList.add('gpu-lesson-hovered')
  if (playback.inspection) refresh()
})
art.addEventListener('pointerleave', () => {
  hovered?.classList.remove('gpu-lesson-hovered')
  hovered = null
  if (playback.inspection) refresh()
})
art.addEventListener('focusin', event => {
  focused = partAt(event.target)
  if (playback.inspection) refresh()
})
art.addEventListener('focusout', event => {
  focused = partAt(event.relatedTarget)
  if (playback.inspection) refresh()
})
art.addEventListener('click', event => {
  const part = partAt(event.target)
  if (part) pinPart(part)
})
art.addEventListener('keydown', event => {
  const part = partAt(event.target)
  if (!part || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  pinPart(part)
})

close.addEventListener('click', closeDetails)
inspect.addEventListener('click', event => {
  act({ type: 'inspect' })
  if (playback.inspection && event.detail === 0) {
    const { beat } = frameAt(positionAt(playback, performance.now()))
    const target = beat.anchor === 'device' ? gpu : placement === 'local' ? localRam : remoteRam
    target.focus()
  }
})
app.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !playback.inspection) return
  event.preventDefault()
  if (pinned) closeDetails()
  else { act({ type: 'inspect' }); inspect.focus() }
})
play.addEventListener('click', () => act({ type: playing ? 'pause' : 'play' }))
find('#gpu-lesson-replay').addEventListener('click', () => act({ type: 'replay' }))
previous.addEventListener('click', () => seekBeat(renderedBeat - 1))
next.addEventListener('click', () => seekBeat(renderedBeat + 1))
for (const [index, jump] of jumps.entries()) jump.addEventListener('click', () => seekBeat(index))
slider.addEventListener('input', () => act({ type: 'seek', positionMs: slider.valueAsNumber }))
slider.addEventListener('keydown', event => {
  const delta = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1000
    : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1000 : 0
  if (!delta) return
  event.preventDefault()
  act({ type: 'seek', positionMs: slider.valueAsNumber + delta })
})
slider.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return
  drag = { pointerId: event.pointerId, resume: playing }
  act({ type: 'pause' })
})
window.addEventListener('pointerup', event => {
  if (!drag || drag.pointerId !== event.pointerId) return
  const resume = drag.resume && !playback.inspection && playback.positionMs < durationMs
  drag = null
  if (resume) act({ type: 'play' })
})
window.addEventListener('pointercancel', event => {
  if (drag?.pointerId === event.pointerId) drag = null
})
find<HTMLSelectElement>('#gpu-lesson-placement').addEventListener('change', event => {
  const value = (event.currentTarget as HTMLSelectElement).value
  if (value !== 'local' && value !== 'remote') throw new Error(`Unknown placement: ${value}`)
  placement = value
  act({ type: 'pause' })
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    drag = null
    act({ type: 'pause' })
  } else if (!hasStarted) {
    hasStarted = true
    act({ type: 'play' })
  }
})
reduceMotion.addEventListener('change', () => refresh())
new ResizeObserver(placeCallout).observe(stage)
void document.fonts.ready.then(placeCallout)
refresh()
