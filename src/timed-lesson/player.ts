import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '../app.css'
import './player.css'
import { createIcons, ArrowLeft, Pause, Play, RotateCcw, Search, SkipBack, SkipForward, X } from 'lucide'
import { icon } from '../layout'
import { normalPlaybackPace } from './timeline'
import type { PlaybackAction, PlaybackState, Timeline } from './timeline'

export interface Annotation {
  target: SVGGraphicsElement
  title: string
  text: string
  command?: string
  avoid?: readonly Element[]
}

interface PartDetails {
  name: string
  role: string
  detail: string
}

export interface LessonScene {
  art: SVGSVGElement
  draw(elapsedMs: number, reducedMotion: boolean): Annotation
  describe(part: SVGGraphicsElement, elapsedMs: number): PartDetails
  resize?(): void
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / (1000 * normalPlaybackPace))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function mountLesson(options: {
  title: string
  subtitle: string
  diagramLabel: string
  timeline: Timeline
  controls?: string
  footer: string
  createScene(stage: HTMLElement, pause: () => void): LessonScene
}): void {
  const { beats, durationMs, beatAt, positionAt, update } = options.timeline
  const app = document.querySelector<HTMLDivElement>('#app')!
  document.title = `${options.title} / HPC4 Anatomy`
  app.innerHTML = `
    <main class="story-viewer">
      <header class="story-header">
        <a class="story-back" href="./">${icon('arrow-left')} Anatomy</a>
        <div class="story-heading"><h1>${options.title}</h1><p>${options.subtitle}</p></div>
        ${options.controls ? `<div class="story-options">${options.controls}</div>` : ''}
      </header>
      <div class="story-theater">
        <section class="story-stage" aria-label="${options.diagramLabel}"></section>
        <section class="story-controls" aria-label="Playback and timeline">
          <div class="story-status"><span id="story-beat"></span><span id="story-time"></span></div>
          <div class="story-slider">
            <div class="story-rail" aria-hidden="true">
              <div class="story-fill"></div>
              ${beats.slice(1).map(beat => `<span class="story-tick" style="left: ${beat.startMs / durationMs * 100}%"></span>`).join('')}
            </div>
            <input type="range" aria-label="Lesson timeline" min="0" max="${durationMs}" step="1" value="0" />
          </div>
          <div class="story-beats" style="grid-template-columns: ${beats.map(beat => `${beat.durationMs}fr`).join(' ')}">
            ${beats.map(beat => `<button type="button" title="${beat.label} at ${formatTime(beat.startMs)}" aria-label="Jump to ${beat.label}">${beat.label}</button>`).join('')}
          </div>
          <div class="story-transport" role="group" aria-label="Playback controls">
            <button type="button" id="story-inspect" aria-pressed="false" title="Pause and identify parts">${icon('search')} Inspect</button>
            <div class="story-transport-center">
              <button type="button" id="story-previous" aria-label="Previous beat">${icon('skip-back')}</button>
              <button type="button" id="story-play"><span data-pause>${icon('pause')}</span><span data-play>${icon('play')}</span></button>
              <button type="button" id="story-next" aria-label="Next beat">${icon('skip-forward')}</button>
            </div>
            <div class="story-transport-end">
              <select aria-label="Playback speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option></select>
              <button type="button" id="story-replay" aria-label="Replay lesson" title="Replay lesson">${icon('rotate-ccw')}</button>
            </div>
          </div>
        </section>
      </div>
      <footer class="story-footer">${options.footer}</footer>
    </main>`

  const find = <T extends Element = HTMLElement>(selector: string) => app.querySelector<T>(selector)!
  const stage = find('.story-stage')
  const scene = options.createScene(stage, () => act({ type: 'pause' }))
  const { art } = scene
  stage.insertAdjacentHTML('beforeend', `
    <svg class="story-leader" aria-hidden="true" hidden><line /><circle r="3" /></svg>
    <div class="story-callout" hidden>
      <button type="button" class="story-close" aria-label="Close part details" hidden>${icon('x')}</button>
      <div class="story-callout-copy" aria-atomic="true">
        <h2 tabindex="-1"></h2><p></p><code hidden></code>
      </div>
    </div>`)
  createIcons({ icons: { ArrowLeft, Pause, Play, RotateCcw, Search, SkipBack, SkipForward, X }, attrs: { 'aria-hidden': 'true', 'stroke-width': 1.65 } })
  const parts = [...art.querySelectorAll<SVGGraphicsElement>('[data-lesson-part]')]
  const slider = find<HTMLInputElement>('.story-slider input')
  const fill = find('.story-fill')
  const status = find('#story-beat')
  const time = find('#story-time')
  const jumps = [...app.querySelectorAll<HTMLButtonElement>('.story-beats button')]
  const play = find<HTMLButtonElement>('#story-play')
  const playIcon = find('#story-play [data-play]')
  const pauseIcon = find('#story-play [data-pause]')
  const previous = find<HTMLButtonElement>('#story-previous')
  const next = find<HTMLButtonElement>('#story-next')
  const inspect = find<HTMLButtonElement>('#story-inspect')
  const speed = find<HTMLSelectElement>('.story-transport-end select')
  const card = find('.story-callout')
  const cardTitle = find('.story-callout h2')
  const cardText = find('.story-callout p')
  const cardCommand = find('.story-callout code')
  const close = find<HTMLButtonElement>('.story-close')
  const leader = find<SVGSVGElement>('.story-leader')
  const leaderLine = leader.querySelector('line')!
  const leaderDot = leader.querySelector('circle')!
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')

  let hasStarted = !document.hidden
  let playback: PlaybackState = { positionMs: 0, startedAt: hasStarted ? performance.now() : null, inspection: null, rate: 1 }
  let playing = false
  let hovered: SVGGraphicsElement | null = null
  let focused: SVGGraphicsElement | null = null
  let pinned: SVGGraphicsElement | null = null
  let animationFrame = 0
  let renderedBeat = -1
  let renderedInspection: boolean | undefined
  let drag: { pointerId: number; resume: boolean } | null = null
  let annotation: Annotation | undefined
  let callout: (Annotation & { kind: 'note' | 'hover' | 'details' }) | null = null

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
    const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
    const path = callout.target instanceof SVGPathElement ? callout.target : undefined
    const matrix = path?.getScreenCTM()
    const point = path && matrix ? path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(matrix) : null
    const x = point ? point.x - bounds.left : (left + right) / 2
    const y = point ? point.y - bounds.top : (top + bottom) / 2
    const maxX = bounds.width - width - padding
    const maxY = bounds.height - height - padding
    const sideY = clamp(y - height / 2, padding, maxY)
    const verticalX = clamp(x - width / 2, padding, maxX)
    const sides = [[left - gap - width, sideY], [right + gap, sideY]]
    if (x > bounds.width / 2) sides.reverse()
    const vertical = [[verticalX, top - gap - height], [verticalX, bottom + gap]]
    if (y > bounds.height / 2) vertical.reverse()
    const obstacles = [callout.target, ...(callout.avoid ?? [])].map(element => element.getBoundingClientRect())

    // Try the closest edges first, then available space around the active parts.
    const extraX = [padding, maxX, verticalX]
    const extraY = [padding, maxY, sideY]
    for (const rect of obstacles) {
      extraX.push(rect.left - bounds.left - width - gap, rect.right - bounds.left + gap)
      extraY.push(rect.top - bounds.top - height - gap, rect.bottom - bounds.top + gap)
    }
    const extra = extraX.flatMap(cx => extraY.map(cy => [cx, cy])).sort(([ax, ay], [bx, by]) =>
      Math.hypot(ax! + width / 2 - x, ay! + height / 2 - y) - Math.hypot(bx! + width / 2 - x, by! + height / 2 - y))
    const candidates = [...(bounds.width < 550 ? [...vertical, ...sides] : [...sides, ...vertical]), ...extra]
      .filter(([cx, cy]) => cx! >= padding && cy! >= padding && cx! <= maxX && cy! <= maxY)
    const [cardX, cardY] = candidates.find(([cx, cy]) => obstacles.every(rect =>
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

  function showCallout(nextCallout: typeof callout): void {
    if (!nextCallout && !callout) return
    if (nextCallout && callout?.target === nextCallout.target && callout.title === nextCallout.title &&
      callout.text === nextCallout.text && callout.kind === nextCallout.kind && callout.command === nextCallout.command &&
      callout.avoid?.length === nextCallout.avoid?.length && callout.avoid?.every((part, i) => part === nextCallout.avoid?.[i]) !== false) return
    callout = nextCallout
    card.hidden = !callout
    leader.toggleAttribute('hidden', !callout)
    if (!callout) return
    card.dataset.kind = callout.kind
    find('.story-callout-copy').setAttribute('aria-live', callout.kind === 'note' ? 'polite' : 'off')
    close.hidden = callout.kind !== 'details'
    cardTitle.textContent = callout.title
    cardText.textContent = callout.text
    cardCommand.hidden = !callout.command
    cardCommand.textContent = callout.command ?? ''
    placeCallout()
  }

  function paint(now: number): void {
    const { index, beat, elapsedMs } = beatAt(positionAt(playback, now))
    const ended = elapsedMs === durationMs
    if (ended && playback.startedAt !== null) playback = update(playback, { type: 'pause' }, now)
    playing = playback.startedAt !== null
    fill.style.transform = `scaleX(${elapsedMs / durationMs})`
    slider.value = String(Math.round(elapsedMs))
    const timeLabel = formatTime(elapsedMs)
    const valueText = `${timeLabel}, ${beat.label}, beat ${index + 1} of ${beats.length}`
    if (slider.getAttribute('aria-valuetext') !== valueText) slider.setAttribute('aria-valuetext', valueText)
    const clockText = `${timeLabel} / ${formatTime(durationMs)}`
    if (time.textContent !== clockText) time.textContent = clockText
    const inspecting = playback.inspection !== null
    const caption = inspecting ? 'Identify mode: point at or select a part' : `${beat.label} (${index + 1} of ${beats.length})`
    if (status.textContent !== caption) status.textContent = caption
    const playLabel = playing ? 'Pause lesson' : ended ? 'Replay from start' : 'Resume lesson'
    if (play.getAttribute('aria-label') !== playLabel) {
      play.setAttribute('aria-label', playLabel)
      play.title = playLabel
      playIcon.hidden = playing
      pauseIcon.hidden = !playing
    }
    if (renderedBeat !== index) {
      previous.disabled = index === 0
      next.disabled = index === beats.length - 1
      previous.title = index > 0 ? `Back to ${beats[index - 1]!.label}` : 'Previous beat'
      next.title = index < beats.length - 1 ? `Up next: ${beats[index + 1]!.label}` : 'Next beat'
      for (const [i, jump] of jumps.entries()) {
        if (i === index) jump.setAttribute('aria-current', 'step')
        else jump.removeAttribute('aria-current')
      }
      renderedBeat = index
    }
    if (renderedInspection !== inspecting) {
      stage.classList.toggle('story-identify', inspecting)
      inspect.setAttribute('aria-pressed', String(inspecting))
      inspect.title = inspecting ? 'Leave Identify mode' : 'Pause and identify parts'
      for (const part of parts) part.setAttribute('tabindex', inspecting ? '0' : '-1')
      renderedInspection = inspecting
    }
    annotation = scene.draw(elapsedMs, reduceMotion.matches)
    if (pinned?.closest('[hidden]')) clearPin()
    const selected = [pinned, hovered, focused].find(part => part && !part.closest('[hidden]'))
    if (!inspecting) showCallout({ ...annotation, kind: 'note' })
    else if (selected) {
      const part = scene.describe(selected, elapsedMs)
      showCallout({ target: selected, title: part.name, text: pinned ? part.detail : part.role, kind: pinned ? 'details' : 'hover' })
    } else showCallout(null)
    if (playing) animationFrame = requestAnimationFrame(paint)
  }

  function refresh(now = performance.now()): void {
    cancelAnimationFrame(animationFrame)
    paint(now)
  }

  function clearPin(): void {
    pinned?.setAttribute('aria-pressed', 'false')
    pinned = null
  }

  function act(action: PlaybackAction): void {
    const now = performance.now()
    playback = update(playback, action, now)
    if (!playback.inspection) clearPin()
    refresh(now)
  }

  function seekBeat(index: number): void {
    const beat = beats[index]
    if (!beat) throw new RangeError(`Unknown storyboard beat: ${index}`)
    act({ type: 'seek', positionMs: beat.startMs })
  }

  function partAt(target: EventTarget | null): SVGGraphicsElement | null {
    return target instanceof Element ? target.closest<SVGGraphicsElement>('[data-lesson-part]') : null
  }

  function pinPart(part: SVGGraphicsElement): void {
    if (!playback.inspection) act({ type: 'inspect' })
    clearPin()
    pinned = part
    part.setAttribute('aria-pressed', 'true')
    refresh()
    cardTitle.focus({ preventScroll: true })
  }

  function closeDetails(): void {
    const part = pinned
    clearPin()
    part?.focus({ preventScroll: true })
    refresh()
  }

  art.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return
    const part = partAt(event.target)
    if (part === hovered) return
    hovered?.classList.remove('story-hovered')
    hovered = part
    hovered?.classList.add('story-hovered')
    if (playback.inspection) refresh()
  })
  art.addEventListener('pointerleave', () => {
    hovered?.classList.remove('story-hovered')
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
  art.addEventListener('keydown', (event: KeyboardEvent) => {
    const part = partAt(event.target)
    if (!part || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    pinPart(part)
  })
  close.addEventListener('click', closeDetails)
  inspect.addEventListener('click', event => {
    act({ type: 'inspect' })
    if (playback.inspection && event.detail === 0) {
      const target = partAt(annotation?.target ?? null) ?? parts.find(part => !part.closest('[hidden]'))
      target?.focus({ preventScroll: true })
    }
  })
  app.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !playback.inspection) return
    event.preventDefault()
    if (pinned) closeDetails()
    else { act({ type: 'inspect' }); inspect.focus() }
  })
  play.addEventListener('click', () => act({ type: playing ? 'pause' : 'play' }))
  find('#story-replay').addEventListener('click', () => act({ type: 'replay' }))
  previous.addEventListener('click', () => seekBeat(renderedBeat - 1))
  next.addEventListener('click', () => seekBeat(renderedBeat + 1))
  for (const [index, jump] of jumps.entries()) jump.addEventListener('click', () => seekBeat(index))
  speed.addEventListener('change', () => {
    const rate = Number(speed.value)
    if (rate !== .5 && rate !== 1 && rate !== 2) throw new Error(`Unknown playback speed: ${rate}`)
    act({ type: 'rate', rate })
  })
  slider.addEventListener('input', () => act({ type: 'seek', positionMs: slider.valueAsNumber }))
  slider.addEventListener('keydown', event => {
    const second = 1000 * normalPlaybackPace
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -second
      : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? second : 0
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
  const layout = () => {
    scene.resize?.()
    refresh()
    placeCallout()
  }
  new ResizeObserver(layout).observe(stage)
  void document.fonts.ready.then(layout)
  layout()
}
