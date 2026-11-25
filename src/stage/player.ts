import { ArrowLeft, ArrowRight, createIcons, Eye, Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward, X } from 'lucide'
import { icon } from '../layout.ts'
import { createInitialRunnerState, describeStageCue, describeStageRailNav, reduceRunnerState } from './runner.ts'
import type { StagePlaybackRate, StageRunnerAction } from './runner.ts'
import type {
  MountedStageScenario,
  StageHudChip,
  StageScenarioHost,
  StageScenarioOptions,
  StageStepNarrative,
} from './types.ts'

export { createInitialRunnerState, describeStageCue, describeStageRailNav, reduceRunnerState } from './runner.ts'
export type { StagePlaybackRate, StageRailNavView, StageRunnerAction, StageRunnerState } from './runner.ts'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function mountStageScenario<VariantId extends string = string>(
  options: StageScenarioOptions<VariantId>,
  host: StageScenarioHost,
): MountedStageScenario {
  const { container } = host
  const { steps } = options
  const defaultVariant = (options.variants?.defaultId ?? 'default') as VariantId
  const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)')

  let state = createInitialRunnerState({
    steps,
    initialStep: host.initialStep,
    defaultVariant,
    reducedMotion: reduceMotionQuery.matches,
  })

  const variantHtml = options.variants
    ? `<div class="stage-variants" role="group" aria-label="${escapeHtml(options.variants.label)}">
        ${options.variants.options.map(opt => `<button type="button" data-stage-variant="${escapeHtml(opt.id)}" aria-pressed="${String(opt.id === state.variant)}">${escapeHtml(opt.label)}</button>`).join('')}
      </div>`
    : ''

  container.innerHTML = `<div class="stage-workbench" data-scenario="${escapeHtml(options.id)}">
    <div class="stage-main">
      <div class="stage-column">
        <div class="stage-statusbar">
          <div class="stage-hud" role="status" aria-label="Scenario state invariants"></div>
          <div class="stage-toolbar">
            ${variantHtml}
            <button type="button" class="stage-tool-btn" data-stage-fit aria-pressed="false" title="Toggle full diagram view (0)" hidden>
              ${icon('maximize-2')}<span>Fit</span>
            </button>
            <button type="button" class="stage-tool-btn" data-stage-inspect aria-pressed="false" title="Pause and inspect diagram parts (I)">
              ${icon('eye')}<span>Inspect</span>
            </button>
          </div>
        </div>

        <section class="stage-canvas-wrap" aria-label="${escapeHtml(options.diagramLabel)}">
          <div class="stage-canvas"></div>
          <button type="button" class="stage-canvas-cue" data-stage-cue aria-pressed="false">
            <span class="stage-cue-dot" aria-hidden="true"></span>
            <span data-stage-cue-text>Click any block to inspect (I)</span>
          </button>
          <div class="stage-inspect-pop" hidden>
            <button type="button" class="stage-pop-close" aria-label="Close component details" hidden>${icon('x')}</button>
            <span class="stage-pop-role"></span>
            <h3 class="stage-pop-title" tabindex="-1"></h3>
            <p class="stage-pop-detail" hidden></p>
          </div>
        </section>

        <section class="stage-transport-bar" aria-label="Scenario steps and playback">
          <div class="stage-steps" role="tablist" aria-label="Scenario steps" style="grid-template-columns: repeat(${steps.length}, minmax(0, 1fr))">
            ${steps.map((step, idx) => `
              <button type="button" class="stage-step-btn" data-step-idx="${idx}" aria-label="Step ${idx + 1}: ${escapeHtml(step.label)}">
                <span class="stage-step-num">${String(idx + 1).padStart(2, '0')}</span>
                <span class="stage-step-label">${escapeHtml(step.label)}</span>
                <span class="stage-step-bar"><span class="stage-step-fill"></span></span>
              </button>
            `).join('')}
          </div>
          <div class="stage-controls">
            <div class="stage-controls-nav">
              <button type="button" class="stage-nav-btn" data-stage-prev aria-label="Previous step">
                ${icon('skip-back')}<span>Prev</span>
              </button>
              <button type="button" class="stage-play-btn" data-stage-play aria-pressed="false" title="Auto-advance steps (Space)">
                <span data-icon-play>${icon('play')}</span>
                <span data-icon-pause hidden>${icon('pause')}</span>
                <span data-play-label>Auto</span>
              </button>
              <button type="button" class="stage-nav-btn stage-next-primary" data-stage-next aria-label="Next step">
                <span>Next</span>${icon('skip-forward')}
              </button>
              <a class="stage-nav-btn stage-next-primary" data-transport-continue hidden>
                <span data-transport-continue-label>Continue</span>${icon('arrow-right')}
              </a>
            </div>
            <div class="stage-controls-meta">
              <select class="stage-rate-select" aria-label="Playback speed">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1x</option>
                <option value="2">2x</option>
              </select>
              <button type="button" class="stage-icon-btn" data-stage-replay aria-label="Replay current step animation (R)" title="Replay current step (R)">
                ${icon('rotate-ccw')}
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside class="stage-rail" aria-label="Step explanation and state changes">
        <div class="stage-rail-copy" aria-live="polite">
          <span class="stage-eyebrow"></span>
          <h2 class="stage-step-title"></h2>
          <p class="stage-step-body"></p>
        </div>
        <div class="stage-code-card" hidden>
          <span class="stage-code-label" hidden></span>
          <code class="stage-code-cmd" hidden></code>
          <div class="stage-code-lines" hidden></div>
        </div>
        <div class="stage-changes-box" hidden>
          <span class="stage-section-label">What changed</span>
          <ul class="stage-changes-list"></ul>
        </div>
        <footer class="stage-rail-footer" data-rail-footer aria-label="Step navigation">
          <div class="stage-rail-upnext" data-rail-upnext hidden>
            <span class="stage-section-label" data-rail-upnext-kicker>Up next</span>
            <div class="stage-rail-chips" data-rail-chips></div>
          </div>
          <div class="stage-rail-actions">
            <a class="stage-rail-btn stage-rail-return" data-rail-return hidden>
              ${icon('arrow-left')}<span data-rail-return-label></span>
            </a>
            <button type="button" class="stage-rail-btn stage-rail-prev" data-rail-prev>
              ${icon('arrow-left')}<span>Prev</span>
            </button>
            <button type="button" class="stage-rail-btn stage-rail-next" data-rail-next>
              <span data-rail-next-label></span>${icon('arrow-right')}
            </button>
            <a class="stage-rail-btn stage-rail-next stage-rail-continue" data-rail-continue hidden>
              <span data-rail-continue-label></span>${icon('arrow-right')}
            </a>
          </div>
          <p class="stage-kbd-strip" data-stage-kbd aria-label="Keyboard shortcuts">
            <kbd>←</kbd> <kbd>→</kbd> step · <kbd>R</kbd> replay · <kbd>I</kbd> inspect · <kbd>Space</kbd> auto
          </p>
        </footer>
      </aside>
    </div>

    <footer class="stage-footer">
      <span>${escapeHtml(options.subtitle)} · ${escapeHtml(options.footer.note)}</span>
      <a href="${escapeHtml(options.footer.sourceHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(options.footer.sourceLabel)} ↗</a>
    </footer>
  </div>`

  const root = container.querySelector<HTMLElement>('.stage-workbench')!
  const canvasWrap = root.querySelector<HTMLElement>('.stage-canvas-wrap')!
  const canvasEl = root.querySelector<HTMLElement>('.stage-canvas')!
  const scene = options.mountScene(canvasEl)

  createIcons({
    root,
    icons: { ArrowLeft, ArrowRight, Eye, Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward, X },
    attrs: { 'aria-hidden': 'true', 'stroke-width': 1.65 },
  })
  root.querySelectorAll('svg.lucide rect[rx], svg.lucide rect[ry]').forEach(rect => {
    rect.removeAttribute('rx')
    rect.removeAttribute('ry')
  })

  const hudEl = root.querySelector<HTMLElement>('.stage-hud')!
  const fitBtn = root.querySelector<HTMLButtonElement>('[data-stage-fit]')!
  const inspectBtn = root.querySelector<HTMLButtonElement>('[data-stage-inspect]')!
  const variantBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-stage-variant]')]
  const stepBtns = [...root.querySelectorAll<HTMLButtonElement>('.stage-step-btn')]
  const stepFills = stepBtns.map(btn => btn.querySelector<HTMLElement>('.stage-step-fill')!)
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-stage-prev]')!
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-stage-next]')!
  const transportContinueLink = root.querySelector<HTMLAnchorElement>('[data-transport-continue]')!
  const transportContinueLabel = root.querySelector<HTMLElement>('[data-transport-continue-label]')!
  const playBtn = root.querySelector<HTMLButtonElement>('[data-stage-play]')!
  const iconPlay = playBtn.querySelector<HTMLElement>('[data-icon-play]')!
  const iconPause = playBtn.querySelector<HTMLElement>('[data-icon-pause]')!
  const playLabel = playBtn.querySelector<HTMLElement>('[data-play-label]')!
  const rateSelect = root.querySelector<HTMLSelectElement>('.stage-rate-select')!
  const replayBtn = root.querySelector<HTMLButtonElement>('[data-stage-replay]')!

  const eyebrowEl = root.querySelector<HTMLElement>('.stage-eyebrow')!
  const titleEl = root.querySelector<HTMLElement>('.stage-step-title')!
  const bodyEl = root.querySelector<HTMLElement>('.stage-step-body')!
  const codeCardEl = root.querySelector<HTMLElement>('.stage-code-card')!
  const codeLabelEl = root.querySelector<HTMLElement>('.stage-code-label')!
  const codeCmdEl = root.querySelector<HTMLElement>('.stage-code-cmd')!
  const codeLinesEl = root.querySelector<HTMLElement>('.stage-code-lines')!
  const changesBoxEl = root.querySelector<HTMLElement>('.stage-changes-box')!
  const changesListEl = root.querySelector<HTMLUListElement>('.stage-changes-list')!

  const railUpnextEl = root.querySelector<HTMLElement>('[data-rail-upnext]')!
  const railUpnextKicker = root.querySelector<HTMLElement>('[data-rail-upnext-kicker]')!
  const railChipsEl = root.querySelector<HTMLElement>('[data-rail-chips]')!
  const railReturnLink = root.querySelector<HTMLAnchorElement>('[data-rail-return]')!
  const railReturnLabel = root.querySelector<HTMLElement>('[data-rail-return-label]')!
  const railPrevBtn = root.querySelector<HTMLButtonElement>('[data-rail-prev]')!
  const railNextBtn = root.querySelector<HTMLButtonElement>('[data-rail-next]')!
  const railNextLabel = root.querySelector<HTMLElement>('[data-rail-next-label]')!
  const railContinueLink = root.querySelector<HTMLAnchorElement>('[data-rail-continue]')!
  const railContinueLabel = root.querySelector<HTMLElement>('[data-rail-continue-label]')!

  const stageCueBtn = root.querySelector<HTMLButtonElement>('[data-stage-cue]')!
  const stageCueText = root.querySelector<HTMLElement>('[data-stage-cue-text]')!
  const popEl = root.querySelector<HTMLElement>('.stage-inspect-pop')!
  const popCloseBtn = root.querySelector<HTMLButtonElement>('.stage-pop-close')!
  const popRoleEl = root.querySelector<HTMLElement>('.stage-pop-role')!
  const popTitleEl = root.querySelector<HTMLElement>('.stage-pop-title')!
  const popDetailEl = root.querySelector<HTMLElement>('.stage-pop-detail')!

  const partEls = [...scene.art.querySelectorAll<SVGGraphicsElement>('[data-stage-part]')]
  const abortController = new AbortController()
  const { signal } = abortController

  let hoveredPart: SVGGraphicsElement | null = null
  let focusedPart: SVGGraphicsElement | null = null
  let pinnedPart: SVGGraphicsElement | null = null
  let prevHudMap = new Map<string, string>()
  let renderedNarrativeKey = ''
  let renderedHudKey = ''
  let renderedChipsKey = ''
  let lastFrameNow = performance.now()
  let rafId = 0
  let completedReported = false

  function updateHud(chips: readonly StageHudChip[]): void {
    const key = chips.map(c => `${c.label}:${c.value}:${c.tone ?? 'neutral'}`).join('|')
    if (key === renderedHudKey) return
    renderedHudKey = key
    const nextMap = new Map<string, string>()
    hudEl.innerHTML = chips.map(chip => {
      const changed = prevHudMap.has(chip.label) && prevHudMap.get(chip.label) !== chip.value
      nextMap.set(chip.label, chip.value)
      return `<div class="stage-hud-chip${changed ? ' is-changed' : ''}" data-severity="${chip.tone ?? 'neutral'}">
        <span class="stage-hud-label">${escapeHtml(chip.label)}</span>
        <strong class="stage-hud-val">${escapeHtml(chip.value)}</strong>
      </div>`
    }).join('')
    prevHudMap = nextMap
  }

  function updateNarrative(narrative: StageStepNarrative): void {
    const step = steps[state.stepIndex]!
    const eyebrow = narrative.eyebrow ?? `Step ${String(state.stepIndex + 1).padStart(2, '0')} of ${String(steps.length).padStart(2, '0')} · ${step.label}`
    const panelKey = narrative.panel
      ? `${narrative.panel.label ?? ''}|${narrative.panel.command ?? ''}|${(narrative.panel.lines ?? []).map(l => `${l.tone ?? ''}:${l.text}`).join(';')}`
      : ''
    const changesKey = narrative.changes.map(c => `${c.kind}:${c.text}`).join(';')
    const fullKey = `${state.stepIndex}|${eyebrow}|${narrative.title}|${narrative.body}|${panelKey}|${changesKey}`
    if (fullKey === renderedNarrativeKey) return
    renderedNarrativeKey = fullKey

    eyebrowEl.textContent = eyebrow
    titleEl.textContent = narrative.title
    bodyEl.textContent = narrative.body

    const panel = narrative.panel
    const hasPanel = Boolean(panel && (panel.command || (panel.lines && panel.lines.length > 0)))
    codeCardEl.hidden = !hasPanel
    if (panel && hasPanel) {
      codeLabelEl.hidden = !panel.label
      codeLabelEl.textContent = panel.label ?? ''
      codeCmdEl.hidden = !panel.command
      codeCmdEl.textContent = panel.command ?? ''
      const lines = panel.lines ?? []
      codeLinesEl.hidden = lines.length === 0
      codeLinesEl.innerHTML = lines.map(l => `<div class="stage-code-line" data-tone="${l.tone ?? 'slate'}">${escapeHtml(l.text)}</div>`).join('')
    }

    changesBoxEl.hidden = narrative.changes.length === 0
    if (narrative.changes.length > 0) {
      changesListEl.innerHTML = narrative.changes.map(delta => {
        const sym = delta.kind === 'add' ? '+' : delta.kind === 'remove' ? '−' : '~'
        return `<li class="stage-delta" data-delta="${delta.kind}"><span class="stage-delta-sym" aria-hidden="true">${sym}</span><span>${escapeHtml(delta.text)}</span></li>`
      }).join('')
    }
  }

  function positionInspectPop(target: SVGGraphicsElement): void {
    const wrapBounds = canvasWrap.getBoundingClientRect()
    const targetBounds = target.getBoundingClientRect()
    const popW = popEl.offsetWidth || 230
    const popH = popEl.offsetHeight || 88
    const pad = 10
    const bottomPad = 36
    const gap = 10

    const cx = targetBounds.left - wrapBounds.left + targetBounds.width / 2
    const topAbove = targetBounds.top - wrapBounds.top - popH - gap
    const topBelow = targetBounds.bottom - wrapBounds.top + gap

    const left = Math.max(pad, Math.min(wrapBounds.width - popW - pad, cx - popW / 2))
    const top = topAbove >= pad
      ? topAbove
      : Math.max(pad, Math.min(wrapBounds.height - popH - bottomPad, topBelow))

    popEl.style.left = `${Math.round(left)}px`
    popEl.style.top = `${Math.round(top)}px`
  }

  function updateInspectUi(): void {
    canvasWrap.classList.toggle('is-inspecting', state.inspecting)
    inspectBtn.setAttribute('aria-pressed', String(state.inspecting))
    stageCueBtn.setAttribute('aria-pressed', String(state.inspecting))
    for (const part of partEls) {
      part.setAttribute('tabindex', state.inspecting ? '0' : '-1')
    }

    if (pinnedPart?.closest('[hidden]')) {
      pinnedPart.setAttribute('aria-pressed', 'false')
      pinnedPart = null
    }

    const cueLabel = describeStageCue(state.inspecting, Boolean(pinnedPart))
    if (stageCueText.textContent !== cueLabel) stageCueText.textContent = cueLabel

    const activeTarget = [pinnedPart, state.inspecting ? (hoveredPart ?? focusedPart) : hoveredPart]
      .find(el => el && !el.closest('[hidden]')) ?? null

    if (!activeTarget) {
      popEl.hidden = true
      return
    }

    const info = scene.describePart(activeTarget, state.stepIndex, state.variant)
    if (!info) {
      popEl.hidden = true
      return
    }

    const isPinned = activeTarget === pinnedPart
    popEl.hidden = false
    popEl.dataset.pinned = String(isPinned)
    popCloseBtn.hidden = !isPinned
    popRoleEl.textContent = info.role
    popTitleEl.textContent = info.name
    popDetailEl.hidden = !isPinned
    popDetailEl.textContent = isPinned ? info.detail : ''
    positionInspectPop(activeTarget)
  }

  function syncControls(hasCameraZoom: boolean): void {
    const maxIdx = steps.length - 1
    const railNav = describeStageRailNav({
      steps,
      stepIndex: state.stepIndex,
      returnLink: host.returnLink,
      continuation: host.continuation,
    })

    prevBtn.disabled = railNav.isFirstStep
    prevBtn.title = railNav.prevStepLabel ? `Previous: ${railNav.prevStepLabel} (←)` : 'First step'

    if (railNav.primaryContinuation) {
      nextBtn.hidden = true
      transportContinueLink.hidden = false
      transportContinueLink.href = railNav.primaryContinuation.route
      transportContinueLink.dataset.route = railNav.primaryContinuation.route
      transportContinueLabel.textContent = railNav.primaryContinuation.label
      transportContinueLink.title = railNav.primaryContinuation.label
    } else {
      nextBtn.hidden = false
      nextBtn.disabled = railNav.isFinalStep
      nextBtn.title = railNav.nextStepLabel ? `Next: ${railNav.nextStepLabel} (→)` : 'Final step'
      transportContinueLink.hidden = true
    }

    if (railNav.returnLink) {
      railReturnLink.hidden = false
      railReturnLink.href = railNav.returnLink.route
      railReturnLink.dataset.route = railNav.returnLink.route
      railReturnLabel.textContent = railNav.returnLink.label
      railReturnLink.title = `Back to ${railNav.returnLink.label}`
      railPrevBtn.hidden = true
    } else {
      railReturnLink.hidden = true
      railPrevBtn.hidden = false
      railPrevBtn.disabled = railNav.isFirstStep
      railPrevBtn.title = railNav.prevStepLabel ? `Previous: ${railNav.prevStepLabel} (←)` : 'First step'
      railPrevBtn.setAttribute(
        'aria-label',
        railNav.prevStepLabel ? `Previous step: ${railNav.prevStepLabel}` : 'Previous step',
      )
    }

    if (railNav.primaryContinuation) {
      railNextBtn.hidden = true
      railContinueLink.hidden = false
      railContinueLink.href = railNav.primaryContinuation.route
      railContinueLink.dataset.route = railNav.primaryContinuation.route
      railContinueLink.dataset.kind = railNav.primaryContinuation.kind ?? 'learn'
      railContinueLabel.textContent = railNav.primaryContinuation.label
      railContinueLink.setAttribute('aria-label', railNav.primaryContinuation.label)
    } else {
      railContinueLink.hidden = true
      railNextBtn.hidden = false
      railNextBtn.disabled = railNav.isFinalStep
      const nextLabelText = railNav.nextStepLabel ? `Next: ${railNav.nextStepLabel}` : 'Final step'
      railNextLabel.textContent = nextLabelText
      railNextBtn.title = railNav.nextStepLabel ? `${nextLabelText} (→)` : 'Final step'
      railNextBtn.setAttribute('aria-label', nextLabelText)
    }

    const showSecondary = railNav.secondaryContinuation.length > 0
    railUpnextEl.hidden = !showSecondary && !railNav.primaryContinuation
    if (!railUpnextEl.hidden) {
      railUpnextKicker.textContent = railNav.upNextKicker
      const chipsKey = railNav.secondaryContinuation.map(item => `${item.route}:${item.label}`).join('|')
      if (chipsKey !== renderedChipsKey) {
        renderedChipsKey = chipsKey
        railChipsEl.hidden = !showSecondary
        railChipsEl.innerHTML = railNav.secondaryContinuation
          .map(
            item =>
              `<a class="stage-rail-chip" data-kind="${escapeHtml(item.kind ?? 'concept')}" data-route="${escapeHtml(item.route)}" href="${escapeHtml(item.route)}">${escapeHtml(item.label)}</a>`,
          )
          .join('')
      }
    }

    playBtn.setAttribute('aria-pressed', String(state.autoplay))
    iconPlay.hidden = state.autoplay
    iconPause.hidden = !state.autoplay
    playLabel.textContent = state.autoplay ? 'Playing' : 'Auto'

    fitBtn.hidden = !hasCameraZoom && !state.fitOverride
    fitBtn.setAttribute('aria-pressed', String(state.fitOverride))

    for (const vBtn of variantBtns) {
      vBtn.setAttribute('aria-pressed', String(vBtn.dataset.stageVariant === state.variant))
    }

    for (const [idx, btn] of stepBtns.entries()) {
      const isCurrent = idx === state.stepIndex
      const isPast = idx < state.stepIndex
      if (isCurrent) btn.setAttribute('aria-current', 'step')
      else btn.removeAttribute('aria-current')
      btn.classList.toggle('is-past', isPast)

      const fill = stepFills[idx]!
      const prog = isPast ? 1 : isCurrent ? state.beatProgress : 0
      fill.style.transform = `scaleX(${Math.round(prog * 1000) / 1000})`
    }

    const isFinalSettled = state.stepIndex === maxIdx && state.beatProgress >= 1
    if (isFinalSettled) completedReported = true
    host.onProgress?.(state.stepIndex, steps.length, completedReported)
  }

  function paintFrame(now: number, forceStaticDt = false): void {
    cancelAnimationFrame(rafId)
    rafId = 0
    const dtMs = forceStaticDt ? 0 : Math.min(80, Math.max(0, now - lastFrameNow))
    lastFrameNow = now

    if (!forceStaticDt && dtMs > 0) {
      state = reduceRunnerState(state, { type: 'tick', dtMs, reducedMotion: reduceMotionQuery.matches }, steps, reduceMotionQuery.matches)
    }

    const result = scene.render({
      stepIndex: state.stepIndex,
      beatProgress: state.beatProgress,
      variant: state.variant,
      reducedMotion: reduceMotionQuery.matches,
      fitOverride: state.fitOverride,
      dtMs: forceStaticDt ? 0 : Math.max(16, dtMs),
    })

    updateHud(result.narrative.hud)
    updateNarrative(result.narrative)
    syncControls(result.hasCameraZoom)
    updateInspectUi()

    const needsNextFrame =
      result.animatingLayout ||
      (!state.inspecting && ((state.beatProgress < 1 && !reduceMotionQuery.matches) || state.autoplay))

    if (needsNextFrame && !document.hidden) {
      rafId = requestAnimationFrame(ts => paintFrame(ts, false))
    }
  }

  function dispatch(action: StageRunnerAction<VariantId>): void {
    const prevInspecting = state.inspecting
    state = reduceRunnerState(state, action, steps, reduceMotionQuery.matches)
    if (prevInspecting && !state.inspecting && pinnedPart) {
      pinnedPart.setAttribute('aria-pressed', 'false')
      pinnedPart = null
    }
    lastFrameNow = performance.now()
    paintFrame(lastFrameNow, action.type === 'tick')
  }

  function clearPin(): void {
    if (!pinnedPart) return
    const prev = pinnedPart
    pinnedPart.setAttribute('aria-pressed', 'false')
    pinnedPart = null
    updateInspectUi()
    if (state.inspecting) prev.focus({ preventScroll: true })
  }

  function findPart(target: EventTarget | null): SVGGraphicsElement | null {
    return target instanceof Element ? target.closest<SVGGraphicsElement>('[data-stage-part]') : null
  }

  prevBtn.addEventListener('click', () => dispatch({ type: 'prev' }), { signal })
  nextBtn.addEventListener('click', () => dispatch({ type: 'next' }), { signal })
  const markCompletedOnContinue = () => {
    completedReported = true
    host.onProgress?.(state.stepIndex, steps.length, true)
  }
  railPrevBtn.addEventListener('click', () => dispatch({ type: 'prev' }), { signal })
  railNextBtn.addEventListener('click', () => dispatch({ type: 'next' }), { signal })
  railContinueLink.addEventListener('click', markCompletedOnContinue, { signal })
  transportContinueLink.addEventListener('click', markCompletedOnContinue, { signal })
  playBtn.addEventListener('click', () => dispatch({ type: 'toggle-autoplay' }), { signal })
  replayBtn.addEventListener('click', () => dispatch({ type: 'replay-step' }), { signal })
  fitBtn.addEventListener('click', () => dispatch({ type: 'toggle-fit' }), { signal })
  inspectBtn.addEventListener('click', () => dispatch({ type: 'toggle-inspect' }), { signal })
  stageCueBtn.addEventListener('click', () => {
    if (pinnedPart) clearPin()
    dispatch({ type: 'toggle-inspect' })
  }, { signal })
  popCloseBtn.addEventListener('click', () => clearPin(), { signal })

  rateSelect.addEventListener('change', () => {
    dispatch({ type: 'set-rate', rate: Number(rateSelect.value) as StagePlaybackRate })
  }, { signal })

  for (const [idx, btn] of stepBtns.entries()) {
    btn.addEventListener('click', () => dispatch({ type: 'goto', stepIndex: idx }), { signal })
  }

  for (const vBtn of variantBtns) {
    vBtn.addEventListener('click', () => {
      const val = vBtn.dataset.stageVariant as VariantId
      dispatch({ type: 'set-variant', variant: val })
    }, { signal })
  }

  scene.art.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return
    const next = findPart(event.target)
    if (next === hoveredPart) return
    hoveredPart?.classList.remove('st-hovered')
    hoveredPart = next
    hoveredPart?.classList.add('st-hovered')
    updateInspectUi()
  }, { signal })

  scene.art.addEventListener('pointerleave', () => {
    hoveredPart?.classList.remove('st-hovered')
    hoveredPart = null
    updateInspectUi()
  }, { signal })

  scene.art.addEventListener('focusin', event => {
    focusedPart = findPart(event.target)
    updateInspectUi()
  }, { signal })

  scene.art.addEventListener('focusout', () => {
    focusedPart = null
    updateInspectUi()
  }, { signal })

  scene.art.addEventListener('click', event => {
    const part = findPart(event.target)
    if (!part) {
      if (pinnedPart) clearPin()
      return
    }
    if (!state.inspecting) dispatch({ type: 'enter-inspect' })
    pinnedPart?.setAttribute('aria-pressed', 'false')
    pinnedPart = part
    pinnedPart.setAttribute('aria-pressed', 'true')
    updateInspectUi()
    popTitleEl.focus({ preventScroll: true })
  }, { signal })

  scene.art.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const part = findPart(event.target)
    if (!part) return
    event.preventDefault()
    if (!state.inspecting) dispatch({ type: 'enter-inspect' })
    pinnedPart?.setAttribute('aria-pressed', 'false')
    pinnedPart = part
    pinnedPart.setAttribute('aria-pressed', 'true')
    updateInspectUi()
    popTitleEl.focus({ preventScroll: true })
  }, { signal })

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    if (document.querySelector('dialog[open]') || document.body.classList.contains('navigation-open')) return
    const target = event.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return
    }

    if (event.key === 'Escape') {
      if (pinnedPart) {
        event.preventDefault()
        clearPin()
      } else if (state.inspecting) {
        event.preventDefault()
        dispatch({ type: 'toggle-inspect' })
        inspectBtn.focus({ preventScroll: true })
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      dispatch({ type: 'prev' })
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      dispatch({ type: 'next' })
    } else if (event.key === ' ' && !(target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement)) {
      event.preventDefault()
      dispatch({ type: 'toggle-autoplay' })
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault()
      dispatch({ type: 'replay-step' })
    } else if (event.key === '0' && !fitBtn.hidden) {
      event.preventDefault()
      dispatch({ type: 'toggle-fit' })
    } else if (event.key.toLowerCase() === 'i') {
      event.preventDefault()
      dispatch({ type: 'toggle-inspect' })
    }
  }, { signal })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId)
      rafId = 0
      if (state.autoplay) dispatch({ type: 'pause' })
    } else {
      lastFrameNow = performance.now()
      paintFrame(lastFrameNow, true)
    }
  }, { signal })

  reduceMotionQuery.addEventListener('change', () => {
    lastFrameNow = performance.now()
    paintFrame(lastFrameNow, true)
  }, { signal })

  let resizeRaf = 0
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(() => {
      scene.resize()
      lastFrameNow = performance.now()
      paintFrame(lastFrameNow, true)
    })
  })
  resizeObserver.observe(canvasEl)

  // Initial paint + kickoff entrance beat
  scene.resize()
  lastFrameNow = performance.now()
  paintFrame(lastFrameNow, true)
  if (state.beatProgress < 1 && !reduceMotionQuery.matches && !document.hidden) {
    rafId = requestAnimationFrame(ts => paintFrame(ts, false))
  }

  return {
    pause() {
      if (state.autoplay) dispatch({ type: 'pause' })
    },
    goToStep(stepIndex: number) {
      dispatch({ type: 'goto', stepIndex })
    },
    destroy() {
      cancelAnimationFrame(rafId)
      cancelAnimationFrame(resizeRaf)
      resizeObserver.disconnect()
      abortController.abort()
      scene.destroy?.()
    },
  }
}
