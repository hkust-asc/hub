import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import './app.css'
import './platform/platform.css'
import { createIcons, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Box, CalendarCheck, Check, ChevronRight, Cpu, Eye, GitCompareArrows, HardDrive, Info, LayoutGrid, Layers2, ListFilter, Maximize2, MemoryStick, Menu, Microchip, Network, Package, Pause, Play, RotateCcw, Route, Search, SkipBack, SkipForward, Terminal, X } from 'lucide'
import {
  activeEntryForState,
  entriesForCategory,
  fallbackBackTarget,
  getCategory,
  getEntry,
  isCategoryId,
  parseRoute,
  popTrail,
  pruneTrailForDestination,
  pushTrail,
  routeForEntry,
  routeForTarget,
  trailSnapshotForCurrent,
} from './catalog'
import type { CategoryId, EntryDef, LessonId, ParsedRoute, TrailItem } from './catalog'
import { renderGlyph } from './glyphs'
import type { Tone } from './glyphs'
import { createLayout, icon, renderAtlasBody, renderHubView } from './layout'
import { clusterTopics, copyPath, initialState, topics, updateState } from './model'
import type { Action, AppState, ClusterTopicId, SceneId, TopicId } from './model'
import { mountStageScenario } from './stage/player'
import type { MountedStageScenario, StageScenarioOptions } from './stage/types'
import { browserStorage, LearningProgress, resolveSavedStep, stepBookmarkPosition } from './platform/progress'
import { lessonLinks } from './platform/links'
import { weeks } from './platform/curriculum'

const iconSet = { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Box, CalendarCheck, Check, ChevronRight, Cpu, Eye, GitCompareArrows, HardDrive, Info, LayoutGrid, Layers2, ListFilter, Maximize2, MemoryStick, Menu, Microchip, Network, Package, Pause, Play, RotateCcw, Route, Search, SkipBack, SkipForward, Terminal, X }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lessonLoaders: Record<LessonId, () => Promise<{ lesson: StageScenarioOptions<any> }>> = {
  'host-to-gpu': () => import('./host-to-gpu/player'),
  'ssh-tmux': () => import('./ssh-tmux/player'),
  streams: () => import('./streams/player'),
  'linux-fs': () => import('./linux-fs/player'),
  'first-job': () => import('./first-job/player'),
  'module-load': () => import('./module-load/player'),
}

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = createLayout()

function element<ElementType extends HTMLElement = HTMLElement>(identifier: string): ElementType {
  return document.getElementById(identifier) as ElementType
}

let state: AppState = { ...initialState }
let currentRoute: ParsedRoute = parseRoute(location.hash)
let atlasMode: 'all' | 'domains' = currentRoute.view === 'atlas' ? currentRoute.mode : 'all'
let atlasQuery = ''
let atlasKind: 'all' | 'scene' | 'subject' | 'scenario' = 'all'
let trail: TrailItem[] = []
let renderedInspector = ''
let renderedScene: SceneId | undefined
let renderedHubKey = ''
let renderedRelatedKey = ''
let renderedResumeKey = ''
let renderedTransitionKey = ''
let activeLesson: { id: LessonId; mounted: MountedStageScenario } | null = null
let lessonLoadToken = 0

const learning = new LearningProgress(browserStorage())
const savedLessons = learning.lessons
let lastResumable: { entryId: string; route: string; title: string; glyph: string; tone: Tone } | null = null
if (learning.last) {
  const e = getEntry(learning.last)!
  lastResumable = { entryId: e.id, route: routeForTarget(e.target)!, title: e.shortTitle, glyph: e.glyph, tone: e.tone }
}

function refreshIcons(): void {
  createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.65, 'aria-hidden': 'true' } })
  document.querySelectorAll('svg.lucide rect[rx], svg.lucide rect[ry]').forEach(rect => {
    rect.removeAttribute('rx')
    rect.removeAttribute('ry')
  })
}

function progressForEntry(entryId: string): string | undefined {
  const lessonState = savedLessons.get(entryId as LessonId)
  if (lessonState) return lessonState.completed ? 'Completed' : `Step ${lessonState.beat + 1}/${lessonState.total}`
  return undefined
}

function canonicalHash(): string {
  if (currentRoute.view === 'learn') return '#learn'
  if (currentRoute.view === 'practice') return currentRoute.mission ? `#practice/${currentRoute.mission}` : '#practice'
  if (currentRoute.view === 'weeks') return currentRoute.week ? `#weeks/${currentRoute.week}` : '#weeks'
  if (currentRoute.view === 'concept') return `#atlas/concept/${currentRoute.id}`
  if (currentRoute.view === 'atlas') return atlasMode === 'domains' ? '#atlas/domains' : '#atlas'
  if (currentRoute.view === 'hub') return `#atlas/${currentRoute.category}`
  if (currentRoute.view === 'lesson') {
    return currentRoute.step ? `#lesson/${currentRoute.lesson}/${currentRoute.step}` : `#lesson/${currentRoute.lesson}`
  }
  const subject = state.scene === 'a30' ? state.selected : state.clusterSelected
  const defaultSubject = state.scene === 'a30' ? 'gpu' : 'a30'
  return `#${state.scene}${subject === defaultSubject ? '' : `/${subject}`}`
}

function stopActiveLesson(): void {
  lessonLoadToken++
  if (activeLesson) {
    activeLesson.mounted.destroy()
    learning.save()
    activeLesson = null
  }
}

async function ensureLessonMounted(lessonId: LessonId, requestedStep?: number): Promise<void> {
  if (activeLesson?.id === lessonId) {
    if (requestedStep !== undefined) {
      activeLesson.mounted.goToStep(requestedStep - 1)
    }
    return
  }
  stopActiveLesson()
  const token = ++lessonLoadToken
  const container = element('lesson-view')
  container.innerHTML = '<div class="lesson-loading">Loading scenario…</div>'
  const { lesson } = await lessonLoaders[lessonId]()
  if (token !== lessonLoadToken || currentRoute.view !== 'lesson' || currentRoute.lesson !== lessonId) return
  const saved = savedLessons.get(lessonId)
  const initialStep = requestedStep !== undefined
    ? Math.max(0, Math.min(lesson.steps.length - 1, requestedStep - 1))
    : resolveSavedStep(saved, lesson.steps.length)
  const entry = getEntry(lessonId)!
  const mounted = mountStageScenario(lesson, {
    container,
    initialStep,
    onProgress(stepIndex, stepCount, completed) {
      learning.record(lessonId, stepBookmarkPosition(stepIndex, stepCount, completed))
      lastResumable = { entryId: entry.id, route: `#lesson/${lessonId}`, title: entry.shortTitle, glyph: entry.glyph, tone: entry.tone }
      renderResumeSlot()
    },
  })
  activeLesson = { id: lessonId, mounted }
}

function applyParsedRoute(parsed: ParsedRoute): void {
  currentRoute = parsed
  if (parsed.view !== 'lesson') stopActiveLesson()
  if (parsed.view === 'atlas') {
    atlasMode = parsed.mode
  } else if (parsed.view === 'workbench') {
    if (parsed.scene === 'a30') {
      const validTopic = parsed.nodeTopic && Object.hasOwn(topics, parsed.nodeTopic) ? parsed.nodeTopic : undefined
      state = updateState(state, { type: 'browse', scene: 'a30', topic: validTopic })
    } else {
      const validClusterTopic = parsed.clusterTopic && Object.hasOwn(clusterTopics, parsed.clusterTopic) ? parsed.clusterTopic : undefined
      state = updateState(state, { type: 'browse', scene: 'cluster', topic: validClusterTopic })
    }
  } else if (parsed.view === 'lesson') {
    void ensureLessonMounted(parsed.lesson, parsed.step)
  }
}

function navigateTo(hash: string, options: { push?: boolean; recordTrail?: boolean; focusHeading?: boolean } = {}): void {
  hidePreview()
  const nextParsed = parseRoute(hash)
  if (options.recordTrail !== false) {
    const snap = trailSnapshotForCurrent(currentRoute, canonicalHash(), state)
    applyParsedRoute(nextParsed)
    const destHash = canonicalHash()
    trail = pushTrail(trail, snap, destHash)
  } else {
    applyParsedRoute(nextParsed)
  }
  render()
  const targetHash = canonicalHash()
  if (location.hash !== targetHash) {
    if (options.push !== false) history.pushState({ trail }, '', targetHash)
    else history.replaceState({ trail }, '', targetHash)
  }
  if (options.focusHeading !== false) {
    const targetHeading = currentRoute.view === 'hub'
      ? document.getElementById('hub-title') ?? element('page-title')
      : element('page-title')
    targetHeading.focus({ preventScroll: true })
  }
}

function dispatchScene(action: Action, recordHistory = true): void {
  hidePreview()
  const prevHash = canonicalHash()
  const prevState = state
  state = updateState(state, action)
  currentRoute = { view: 'workbench', scene: state.scene }
  render()
  const nextHash = canonicalHash()
  if (recordHistory && location.hash !== nextHash) {
    if (action.type === 'browse' || action.type === 'navigate') {
      trail = pushTrail(trail, trailSnapshotForCurrent(parseRoute(prevHash), prevHash, prevState), nextHash)
      history.pushState({ trail }, '', nextHash)
    } else {
      trail = pruneTrailForDestination(trail, nextHash)
      history.replaceState({ trail }, '', nextHash)
    }
  } else {
    trail = pruneTrailForDestination(trail, nextHash)
  }
  renderThinkBackAndRelated()
  if (action.type === 'browse' || action.type === 'navigate') element('page-title').focus({ preventScroll: true })
}

function triggerModestSettle(surface: HTMLElement, key: string): void {
  if (renderedTransitionKey === key) return
  renderedTransitionKey = key
  surface.classList.remove('is-settling')
  void surface.offsetWidth
  surface.classList.add('is-settling')
}

function renderResumeSlot(): void {
  const slot = element('resume-slot')
  if (!lastResumable) {
    slot.hidden = true
    return
  }
  const progress = progressForEntry(lastResumable.entryId) ?? 'Saved'
  const key = `${lastResumable.entryId}:${progress}:${canonicalHash()}`
  const isCurrent =
    canonicalHash() === lastResumable.route ||
    (currentRoute.view === 'lesson' && currentRoute.lesson === lastResumable.entryId)
  slot.hidden = isCurrent
  if (isCurrent || renderedResumeKey === key) return
  renderedResumeKey = key
  slot.innerHTML = `<a class="resume-card" href="${lastResumable.route}" data-route="${lastResumable.route}" data-tone="${lastResumable.tone}">
    <span class="resume-glyph">${renderGlyph(lastResumable.glyph)}</span>
    <span class="resume-copy">
      <span class="resume-kicker">Resume scenario</span>
      <strong>${lastResumable.title}</strong>
      <span class="resume-progress">${progress}</span>
    </span>
  </a>`
}

function renderThinkBackAndRelated(): void {
  const backButton = element<HTMLButtonElement>('think-back')
  const backTarget = trail.at(-1) ?? fallbackBackTarget(currentRoute, state)
  backButton.hidden = !backTarget
  if (backTarget) {
    backButton.dataset.tone = backTarget.tone
    backButton.title = `Back to ${backTarget.label}`
    backButton.setAttribute('aria-label', `Back to ${backTarget.label}`)
    element('think-back-glyph').innerHTML = renderGlyph(backTarget.glyph)
    element('think-back-label').textContent = backTarget.label
  }

  const relatedStrip = element('related-strip')
  const activeEntry = activeEntryForState(currentRoute, state)
  const showRelated = (currentRoute.view === 'workbench' || currentRoute.view === 'lesson') && Boolean(activeEntry)
  relatedStrip.hidden = !showRelated
  if (!showRelated || !activeEntry) {
    renderedRelatedKey = ''
    return
  }
  const relatedEntries = activeEntry.related
    .map(id => getEntry(id))
    .filter((item): item is EntryDef => Boolean(item && item.kind !== 'planned'))
    .slice(0, 4)
  const key = `${activeEntry.id}:${relatedEntries.map(item => item.id).join(',')}`
  if (renderedRelatedKey === key) return
  renderedRelatedKey = key
  relatedStrip.innerHTML = `<span class="related-label">Related</span>${relatedEntries.map(item => {
    const route = routeForEntry(item)!
    return `<a class="related-chip" href="${route}" data-entry-link="${item.id}" data-preview-entry="${item.id}" data-tone="${item.tone}" aria-label="${item.title}">
      ${renderGlyph(item.glyph)}
    </a>`
  }).join('')}`
}

function renderAtlasSection(): void {
  const showKindPills = atlasMode === 'all' || atlasQuery.trim().length > 0 || atlasKind !== 'all'
  const kindGroup = document.querySelector<HTMLElement>('.kind-pills')
  if (kindGroup) kindGroup.hidden = !showKindPills
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-atlas-mode]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.atlasMode === atlasMode))
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-atlas-kind]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.atlasKind === atlasKind))
  }
  element('atlas-body').innerHTML = renderAtlasBody({
    mode: atlasMode,
    query: atlasQuery,
    kind: atlasKind,
    progressForEntry,
  })
}

function renderWorkbench(): void {
  const node = state.scene === 'a30'
  element('cluster-view').hidden = node
  element('node-view').hidden = !node
  element('view-tools').hidden = !node
  element('view-label').innerHTML = `${icon(node ? 'box' : 'network')}${node ? 'Isometric anatomy' : 'Connectivity schematic'}`

  if (renderedScene !== state.scene) {
    const subjects = node ? Object.entries(topics) : Object.entries(clusterTopics)
    element('subject-picker').innerHTML = subjects.map(([identifier, subject]) => `<option value="${identifier}">${subject.name}</option>`).join('')
    renderedScene = state.scene
  }
  const subjectId = node ? state.selected : state.clusterSelected
  const subject = node ? topics[state.selected] : clusterTopics[state.clusterSelected]
  element<HTMLSelectElement>('subject-picker').value = subjectId
  const activeEntry = activeEntryForState(currentRoute, state)
  const linkedScenario = activeEntry?.related
    .map(id => getEntry(id))
    .find((item): item is EntryDef => Boolean(item && item.kind === 'scenario'))
  const inspectorKey = `${state.scene}/${subjectId}/${linkedScenario?.id ?? ''}`
  if (renderedInspector !== inspectorKey) {
    const related = node ? topics[state.selected].related.map(identifier => `<button type="button" class="text-link" data-select="${identifier}">${topics[identifier].name} ${icon('chevron-right')}</button>`).join('') : ''
    const openAnatomyBtn = !node && subjectId === 'a30'
      ? `<button type="button" class="open-scene-button" data-browse-scene="a30">Open anatomy ${icon('arrow-right')}</button>`
      : ''
    const scenarioHref = linkedScenario ? routeForTarget(linkedScenario.target) : null
    const openScenarioBtn = scenarioHref && linkedScenario
      ? `<a class="open-scenario-link" href="${scenarioHref}" data-entry-link="${linkedScenario.id}"><span>${icon('play')} ${linkedScenario.title}</span>${icon('arrow-right')}</a>`
      : ''
    element('inspector-content').innerHTML = `<div class="subject-heading"><span class="topic-icon ${subject.color}">${icon(subject.icon)}</span><span class="topic-eyebrow">${node ? topics[state.selected].eyebrow.split(' / ')[1] : clusterTopics[state.clusterSelected].kind}</span><h2>${subject.name}</h2></div><p class="topic-subtitle">${subject.subtitle}</p><p class="topic-description">${subject.description}</p><dl class="topic-properties">${subject.properties.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><details class="subject-notes"><summary>Why it matters ${icon('chevron-right')}</summary><p>${subject.takeaway}</p>${related ? `<div class="related-topics">${related}</div>` : ''}</details>${openAnatomyBtn}${openScenarioBtn}`
    const cardId = activeEntry?.kind === 'subject' ? activeEntry.id : node && subjectId === 'gpu' ? 'gpu-device' : undefined
    if (cardId) {
      const card = document.createElement('a')
      card.className = 'mode-link inspector-reference'
      card.href = card.dataset.route = `#atlas/concept/${cardId}`
      card.textContent = 'Open permanent reference →'
      element('inspector-content').append(card)
    }
    renderedInspector = inspectorKey
  }
  document.querySelectorAll<SVGElement>('[data-cluster-topic]').forEach(subjectElement => {
    const selected = subjectElement.dataset.clusterTopic === state.clusterSelected
    subjectElement.setAttribute('aria-pressed', String(selected))
    subjectElement.classList.toggle('is-selected', selected)
  })
  element('cluster-stage').classList.toggle('storage-focused', state.clusterSelected === 'storage')
  document.querySelectorAll<SVGElement>('[data-family-link]').forEach(link => link.classList.toggle('is-active', link.dataset.familyLink === state.clusterSelected))
  element('explode-button').setAttribute('aria-pressed', String(state.exploded))
  element('explode-button').setAttribute('aria-label', state.exploded ? 'Assemble node layers' : 'Explode node layers')
  element('explode-button').title = state.exploded ? 'Assemble node layers' : 'Explode node layers'
  element('local-button').setAttribute('aria-pressed', String(state.placement === 'local'))
  element('remote-button').setAttribute('aria-pressed', String(state.placement === 'remote'))
  const diagram = element('diagram-stage')
  diagram.classList.toggle('is-exploded', state.exploded)
  diagram.classList.toggle('remote-placement', state.placement === 'remote')
  const previewLocality = state.selected === 'numa' || state.selected === 'pcie' || state.selected === 'memory'
  diagram.classList.toggle('show-locality', previewLocality)
  diagram.querySelectorAll<SVGElement>('[data-topic]').forEach(part => {
    const selected = part.dataset.topic === state.selected
    part.classList.toggle('is-selected', selected)
    part.setAttribute('aria-pressed', String(selected))
  })
  diagram.querySelectorAll<SVGElement>('[data-annotation]').forEach(annotation => annotation.classList.toggle('is-selected', annotation.dataset.annotation === state.selected))
  const previewLinks = node && (state.selected === 'pcie' || state.selected === 'numa')
    ? copyPath('h2d', state.placement)
    : []
  diagram.querySelectorAll<SVGElement>('[data-link]').forEach(connection => connection.classList.toggle('is-active', previewLinks.includes(connection.dataset.link as typeof previewLinks[number])))
  diagram.querySelectorAll<SVGElement>('[data-flow]').forEach(flow => {
    flow.classList.remove('is-active', 'is-reversed')
  })
}

function render(): void {
  const atlasView = element('atlas-view')
  const hubView = element('hub-view')
  const workbench = element('workbench')
  const lessonView = element('lesson-view')
  const platform = element('platform-view')
  const extras = element('lesson-links')
  element('workspace').dataset.view = currentRoute.view

  atlasView.hidden = currentRoute.view !== 'atlas'
  hubView.hidden = currentRoute.view !== 'hub'
  workbench.hidden = currentRoute.view !== 'workbench'
  lessonView.hidden = currentRoute.view !== 'lesson'
  extras.hidden = lessonView.hidden
  const page = currentRoute
  platform.hidden = !['learn', 'practice', 'weeks', 'concept'].includes(page.view)
  if (platform.hidden) platform.replaceChildren()
  const mode = page.view === 'lesson' || page.view === 'learn' ? 'learn'
    : page.view === 'practice' || page.view === 'weeks' ? page.view : 'atlas'
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach(a => {
    if (a.dataset.mode === mode) a.setAttribute('aria-current', 'location')
    else a.removeAttribute('aria-current')
  })

  const activeEntry = activeEntryForState(currentRoute, state)
  const owningDomain: CategoryId | undefined = currentRoute.view === 'hub'
    ? currentRoute.category
    : activeEntry?.category

  let title = 'Concept & scenario atlas'
  let breadcrumb = 'Atlas'
  let sceneRef = ''

  if (page.view === 'learn' || page.view === 'practice' || page.view === 'weeks' || page.view === 'concept') {
    title = page.view === 'learn' ? 'Guided walkthroughs'
      : page.view === 'practice' ? (page.mission ? `Practice · Mission ${page.mission}` : 'Practice missions')
      : page.view === 'weeks' ? (weeks.find(w => w.id === page.week)?.title ?? 'Weekly workshops') : getEntry(page.id)!.title
    breadcrumb = page.view === 'concept' ? `Atlas / ${getCategory(getEntry(page.id)!.category).shortName}` : mode[0].toUpperCase() + mode.slice(1)
    platform.textContent = 'Loading…'
    void import('./platform/views').then(({ showPage }) => {
      if (currentRoute === page) showPage(platform, page, learning)
    }).catch(error => {
      console.error('Could not open learning mode', error)
      if (currentRoute === page) platform.textContent = 'This learning view could not be loaded. Reload to try again.'
    })
  } else if (currentRoute.view === 'atlas') {
    title = atlasMode === 'domains' ? 'Explore by domain' : 'Concept & scenario atlas'
    breadcrumb = atlasMode === 'domains' ? 'Domains' : 'All Entries'
    renderAtlasSection()
    triggerModestSettle(atlasView, `atlas:${atlasMode}`)
  } else if (currentRoute.view === 'hub') {
    const cat = getCategory(currentRoute.category)
    const items = entriesForCategory(cat.id)
    title = cat.name
    breadcrumb = cat.shortName
    const hubKey = `${cat.id}:${items.map(item => `${item.id}:${progressForEntry(item.id) ?? ''}`).join('|')}`
    if (renderedHubKey !== hubKey) {
      renderedHubKey = hubKey
      hubView.innerHTML = renderHubView(cat.id, progressForEntry)
    }
    triggerModestSettle(hubView, `hub:${cat.id}`)
  } else if (currentRoute.view === 'lesson') {
    const entry = getEntry(currentRoute.lesson)!
    const cat = getCategory(entry.category)
    title = entry.title
    breadcrumb = cat.shortName
    extras.innerHTML = lessonLinks(currentRoute.lesson)
    triggerModestSettle(lessonView, `lesson:${currentRoute.lesson}`)
  } else {
    const node = state.scene === 'a30'
    const software = !node && ['spack', 'lmod', 'slurm'].includes(state.clusterSelected)
    title = node
      ? 'A30 GPU node'
      : software
        ? clusterTopics[state.clusterSelected].name
        : state.clusterSelected === 'storage'
          ? 'Shared storage'
          : state.clusterSelected === 'fabric'
            ? 'Network fabric'
            : 'Cluster overview'
    breadcrumb = owningDomain
      ? getCategory(owningDomain).shortName
      : node ? 'Compute architecture' : 'System'
    renderWorkbench()
    triggerModestSettle(workbench, `workbench:${state.scene}`)
  }

  element('page-title').innerHTML = `${title}<span class="title-period">.</span>`
  element('breadcrumb-section').textContent = breadcrumb
  const refEl = element('scene-reference')
  refEl.hidden = !sceneRef
  refEl.textContent = sceneRef
  document.title = `HPC4 Hub / ${title}`

  const activeDirectNav = currentRoute.view === 'atlas'
    ? 'atlas'
    : currentRoute.view === 'workbench'
      ? state.scene === 'a30' ? 'a30' : state.clusterSelected === 'a30' ? 'overview' : ''
      : ''

  document.querySelectorAll<HTMLElement>('[data-nav-id]').forEach(button => {
    if (button.dataset.navId === activeDirectNav) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  document.querySelectorAll<HTMLElement>('[data-domain-nav]').forEach(link => {
    const domainId = link.dataset.domainNav
    const isExactHub = currentRoute.view === 'hub' && currentRoute.category === domainId
    const isActiveContext = !isExactHub && owningDomain === domainId
    if (isExactHub) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
    link.classList.toggle('is-context-domain', isActiveContext)
  })

  renderThinkBackAndRelated()
  renderResumeSlot()
  refreshIcons()
}

const previewCard = element('entry-preview')
let previewAnchor: HTMLElement | null = null

function buildEntryPreviewHtml(entry: EntryDef): string {
  const kindNames = { scene: 'Scene', subject: 'Concept', scenario: 'Scenario', planned: 'Planned' }
  const saved = progressForEntry(entry.id)
  return `
    <div class="preview-top">
      <span class="preview-kicker">${kindNames[entry.kind]}</span>
      ${saved ? `<span class="preview-saved">${saved}</span>` : ''}
    </div>
    <h3>${entry.title}</h3>
    <p class="preview-question">${entry.question}</p>`
}

function buildCategoryPreviewHtml(categoryId: CategoryId): string {
  const cat = getCategory(categoryId)
  return `
    <h3>${cat.name}</h3>
    <p class="preview-question">${cat.subtitle}</p>`
}

function positionPreview(anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect()
  const width = previewCard.offsetWidth || 296
  const height = previewCard.offsetHeight || 168
  const margin = 12
  const gap = 10
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Place below (or above near bottom edge) so sweeping across horizontal shelves never covers adjacent tiles.
  const left = Math.max(margin, Math.min(vw - width - margin, rect.left + rect.width / 2 - width / 2))
  let top = rect.bottom + gap
  if (top + height > vh - margin) {
    top = Math.max(margin, rect.top - gap - height)
  }

  previewCard.style.left = `${Math.round(left)}px`
  previewCard.style.top = `${Math.round(top)}px`
}

function showPreviewFor(anchor: HTMLElement): void {
  const entryId = anchor.dataset.previewEntry
  const categoryId = anchor.dataset.previewCategory
  if (entryId) {
    const entry = getEntry(entryId)
    if (!entry) return
    previewCard.dataset.tone = entry.tone
    previewCard.innerHTML = buildEntryPreviewHtml(entry)
  } else if (isCategoryId(categoryId)) {
    const cat = getCategory(categoryId)
    previewCard.dataset.tone = cat.tone
    previewCard.innerHTML = buildCategoryPreviewHtml(cat.id)
  } else {
    return
  }
  previewAnchor = anchor
  previewCard.hidden = false
  positionPreview(anchor)
}

function hidePreview(): void {
  previewAnchor = null
  previewCard.hidden = true
}

app.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return
  const target = (event.target as Element).closest<HTMLElement>('[data-preview-entry], [data-preview-category]')
  if (target === previewAnchor) return
  if (target) showPreviewFor(target)
  else hidePreview()
})

app.addEventListener('pointerleave', () => hidePreview())

app.addEventListener('focusin', event => {
  const target = (event.target as Element).closest<HTMLElement>('[data-preview-entry], [data-preview-category]')
  if (target && target.matches(':focus-visible')) showPreviewFor(target)
})

app.addEventListener('focusout', event => {
  const next = event.relatedTarget instanceof Element
    ? event.relatedTarget.closest<HTMLElement>('[data-preview-entry], [data-preview-category]')
    : null
  if (!next) hidePreview()
})

window.addEventListener('scroll', () => {
  if (previewAnchor) hidePreview()
}, { passive: true })

app.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = event.target as Element

  const entryLink = target.closest<HTMLAnchorElement>('[data-entry-link]')
  if (entryLink) {
    event.preventDefault()
    closeNavigation()
    const href = entryLink.getAttribute('href')
    if (href) navigateTo(href, { push: true, recordTrail: true })
    return
  }

  const routeLink = target.closest<HTMLElement>('[data-route]')
  if (routeLink) {
    event.preventDefault()
    closeNavigation()
    const route = routeLink.dataset.route!
    navigateTo(route, { push: true, recordTrail: true })
    return
  }

  const atlasModeBtn = target.closest<HTMLButtonElement>('[data-atlas-mode]')
  if (atlasModeBtn) {
    const mode = atlasModeBtn.dataset.atlasMode === 'domains' ? 'domains' : 'all'
    atlasMode = mode
    currentRoute = { view: 'atlas', mode }
    trail = pruneTrailForDestination(trail, canonicalHash())
    hidePreview()
    render()
    history.replaceState({ trail }, '', canonicalHash())
    return
  }

  const atlasKindBtn = target.closest<HTMLButtonElement>('[data-atlas-kind]')
  if (atlasKindBtn) {
    atlasKind = (atlasKindBtn.dataset.atlasKind as typeof atlasKind) ?? 'all'
    hidePreview()
    renderAtlasSection()
    return
  }

  if (target.closest('#reset-atlas-filter')) {
    atlasQuery = ''
    atlasKind = 'all'
    element<HTMLInputElement>('atlas-search').value = ''
    renderAtlasSection()
    return
  }

  const browseScene = target.closest<HTMLElement>('[data-browse-scene]')?.dataset.browseScene
  if (browseScene === 'cluster' || browseScene === 'a30') {
    closeNavigation()
    navigateTo(browseScene === 'cluster' ? '#cluster' : '#a30', { push: true, recordTrail: true })
    return
  }

  const clusterTopic = target.closest<SVGElement>('[data-cluster-topic]')?.dataset.clusterTopic
  if (clusterTopic && clusterTopic in clusterTopics) dispatchScene({ type: 'cluster-select', topic: clusterTopic as ClusterTopicId })
  const topic = target.closest<HTMLElement>('[data-select]')?.dataset.select ?? target.closest<SVGElement>('[data-topic]')?.dataset.topic
  if (topic && topic in topics) dispatchScene({ type: 'select', topic: topic as TopicId })
})

element('think-back').addEventListener('click', () => {
  const { target, rest } = popTrail(trail)
  if (target) {
    trail = rest
    navigateTo(target.route, { push: true, recordTrail: false })
    return
  }
  const fallback = fallbackBackTarget(currentRoute, state)
  if (fallback) navigateTo(fallback.route, { push: true, recordTrail: false })
})

element<HTMLInputElement>('atlas-search').addEventListener('input', event => {
  atlasQuery = (event.target as HTMLInputElement).value
  hidePreview()
  renderAtlasSection()
})

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !previewCard.hidden) {
    hidePreview()
  }
  if (
    event.key === '/' &&
    currentRoute.view === 'atlas' &&
    !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)
  ) {
    event.preventDefault()
    element<HTMLInputElement>('atlas-search').focus()
  }
})

element('diagram-stage').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const topic = (event.target as Element).closest<SVGElement>('[data-topic]')?.dataset.topic
  if (topic && topic in topics) {
    event.preventDefault()
    dispatchScene({ type: 'select', topic: topic as TopicId })
  }
})

element('cluster-stage').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const topic = (event.target as Element).closest<SVGElement>('[data-cluster-topic]')?.dataset.clusterTopic
  if (topic && topic in clusterTopics) {
    event.preventDefault()
    dispatchScene({ type: 'cluster-select', topic: topic as ClusterTopicId })
  }
})
window.addEventListener('popstate', event => {
  hidePreview()
  closeNavigation()
  applyParsedRoute(parseRoute(location.hash))
  trail = pruneTrailForDestination(Array.isArray(event.state?.trail) ? event.state.trail : [], canonicalHash())
  render()
})
element<HTMLSelectElement>('subject-picker').addEventListener('change', event => {
  const subject = (event.target as HTMLSelectElement).value
  dispatchScene(state.scene === 'a30' ? { type: 'select', topic: subject as TopicId } : { type: 'cluster-select', topic: subject as ClusterTopicId })
})
element('local-button').addEventListener('click', () => dispatchScene({ type: 'placement', placement: 'local' }))
element('remote-button').addEventListener('click', () => dispatchScene({ type: 'placement', placement: 'remote' }))
element('explode-button').addEventListener('click', () => dispatchScene({ type: 'explode' }))
element('reset-button').addEventListener('click', () => dispatchScene({ type: 'reset-view' }))
const dialog = element<HTMLDialogElement>('evidence-dialog')
const openEvidence = () => {
  activeLesson?.mounted.pause()
  hidePreview()
  closeNavigation()
  dialog.showModal()
}
element('open-evidence').addEventListener('click', openEvidence)
element('close-evidence').addEventListener('click', () => dialog.close())
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    dialog.close()
  }
})
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return
  const bounds = dialog.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close()
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden) learning.save()
})
window.addEventListener('pagehide', () => learning.save())
const narrowScreen = matchMedia('(max-width: 900px)')
const sidebar = element('sidebar')
function closeNavigation(restoreFocus = false): void {
  document.body.classList.remove('navigation-open')
  element('menu-button').setAttribute('aria-expanded', 'false')
  element('nav-backdrop').hidden = true
  element('workspace').inert = false
  sidebar.inert = narrowScreen.matches
  if (narrowScreen.matches) sidebar.setAttribute('aria-hidden', 'true')
  else sidebar.removeAttribute('aria-hidden')
  sidebar.removeAttribute('role')
  sidebar.removeAttribute('aria-modal')
  if (restoreFocus && narrowScreen.matches) element('menu-button').focus()
}
element('menu-button').addEventListener('click', () => {
  if (document.body.classList.contains('navigation-open')) return closeNavigation(true)
  activeLesson?.mounted.pause()
  hidePreview()
  document.body.classList.add('navigation-open')
  element('menu-button').setAttribute('aria-expanded', 'true')
  element('nav-backdrop').hidden = false
  sidebar.inert = false
  sidebar.removeAttribute('aria-hidden')
  sidebar.setAttribute('role', 'dialog')
  sidebar.setAttribute('aria-modal', 'true')
  element('workspace').inert = true
  sidebar.querySelector<HTMLElement>('[aria-current="page"], .nav-item')!.focus()
})
element('close-menu').addEventListener('click', () => closeNavigation(true))
element('nav-backdrop').addEventListener('click', () => closeNavigation(true))
sidebar.addEventListener('keydown', event => {
  if (!narrowScreen.matches) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeNavigation(true)
  }
  if (event.key === 'Tab') {
    const controls = [...sidebar.querySelectorAll<HTMLElement>('button, a')].filter(control => control.getClientRects().length > 0)
    const target = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1) : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : undefined
    if (target) { event.preventDefault(); target.focus() }
  }
})
narrowScreen.addEventListener('change', () => closeNavigation())
element('brand-link').addEventListener('click', event => {
  event.preventDefault()
  closeNavigation()
  navigateTo('#atlas', { push: true, recordTrail: true })
})
closeNavigation()
element('download-button').addEventListener('click', () => {
  const source = document.querySelector<SVGSVGElement>('.node-diagram')!
  const clone = source.cloneNode(true) as SVGSVGElement
  const sourceElements = [source, ...source.querySelectorAll<SVGElement>('*')]
  const cloneElements = [clone, ...clone.querySelectorAll<SVGElement>('*')]
  const properties = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'display', 'visibility', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'transform', 'transform-origin', 'filter', 'paint-order']
  sourceElements.forEach((sourceElement, index) => {
    const computed = getComputedStyle(sourceElement)
    const destination = cloneElements[index]!
    for (const property of properties) destination.style.setProperty(property, computed.getPropertyValue(property))
    destination.style.animation = 'none'
    destination.style.transition = 'none'
    destination.removeAttribute('tabindex')
    destination.removeAttribute('role')
    destination.removeAttribute('aria-pressed')
  })
  clone.setAttribute('width', '1200')
  clone.setAttribute('height', '760')
  const note = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  note.setAttribute('x', '84')
  note.setAttribute('y', '548')
  note.setAttribute('fill', '#5e6670')
  note.setAttribute('font-size', '11')
  note.setAttribute('font-family', 'sans-serif')
  note.textContent = 'HPC4 A30 profile. Wiring, positions and affinities illustrative. Not a measured topology.'
  clone.append(note)
  const downloadUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }))
  const download = document.createElement('a')
  download.href = downloadUrl
  download.download = 'hpc4-a30-illustrative-node.svg'
  download.click()
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500)
})

const searchDialog = element<HTMLDialogElement>('switcher')
let switcherReady: Promise<void> | undefined
async function openSwitcher() {
  if (searchDialog.open || dialog.open) return
  activeLesson?.mounted.pause()
  closeNavigation()
  hidePreview()
  try {
    await (switcherReady ??= import('./platform/search').then(({ bindSwitcher }) => bindSwitcher(searchDialog, navigateTo)))
    if (!searchDialog.open) {
      searchDialog.showModal()
      const input = element<HTMLInputElement>('switch-input')
      input.focus()
      input.select()
    }
  } catch (error) {
    switcherReady = undefined
    console.error('Could not load quick switcher', error)
    element('switch-count').textContent = 'Search could not be loaded. Close and try again.'
    element('close-switcher').onclick = () => searchDialog.close()
    if (!searchDialog.open) searchDialog.showModal()
  }
}
element('open-switcher').addEventListener('click', openSwitcher)
const isApplePlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
const kbdHint = isApplePlatform ? '⌘ K' : 'Ctrl K'
element('search-kbd').textContent = kbdHint
element('open-switcher').title = `Search all modes (${kbdHint})`
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    void openSwitcher()
  }
})

applyParsedRoute(currentRoute)
render()
history.replaceState({ trail }, '', canonicalHash())
