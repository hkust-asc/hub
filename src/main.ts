import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import './app.css'
import { createIcons, ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Box, CalendarCheck, Check, ChevronRight, Cpu, GitCompareArrows, HardDrive, Info, Layers2, ListFilter, MemoryStick, Menu, Microchip, Network, Package, Pause, Play, RotateCcw, Route, SkipBack, SkipForward, Terminal, X } from 'lucide'
import { clusterTopics, initialState, scenarios, topics, transferPath, updateState } from './model'
import type { Action, AppState, ClusterTopicId, ScenarioId, SceneId, TopicId } from './model'
import { createLayout, icon } from './layout'

const iconSet = { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Box, CalendarCheck, Check, ChevronRight, Cpu, GitCompareArrows, HardDrive, Info, Layers2, ListFilter, MemoryStick, Menu, Microchip, Network, Package, Pause, Play, RotateCcw, Route, SkipBack, SkipForward, Terminal, X }
const app = document.querySelector<HTMLDivElement>('#app')!
function navigationFromHash(): Action {
  const [scene, subject] = location.hash.slice(1).split('/')
  return scene === 'a30'
    ? { type: 'browse', scene: 'a30', topic: subject && Object.hasOwn(topics, subject) ? subject as TopicId : undefined }
    : { type: 'browse', scene: 'cluster', topic: subject && Object.hasOwn(clusterTopics, subject) ? subject as ClusterTopicId : undefined }
}
let state: AppState = updateState({ ...initialState }, navigationFromHash())
let playbackTimer: ReturnType<typeof setTimeout> | undefined
let renderedInspector = ''
let renderedScene: SceneId | undefined
let renderedScenario: ScenarioId | undefined
const visitedScenarios = new Set<ScenarioId>()
app.innerHTML = createLayout()

function element<ElementType extends HTMLElement = HTMLElement>(identifier: string): ElementType {
  return document.getElementById(identifier) as ElementType
}

function dispatch(action: Action, recordHistory = true): void {
  const previous = state
  state = updateState(state, action)
  if (action.type === 'start-scenario' || state.mode === 'scenario') visitedScenarios.add(state.scenario)
  render()
  if (recordHistory && location.hash !== routeForState()) {
    if (action.type === 'browse' || action.type === 'navigate') history.pushState(null, '', routeForState())
    else history.replaceState(null, '', routeForState())
  }
  if (action.type === 'browse' || action.type === 'navigate') element('page-title').focus({ preventScroll: true })
  if (state.mode === 'scenario' && (action.type === 'select' || action.type === 'cluster-select')) element('subject-picker').focus()
  if (previous.playing !== state.playing || previous.step !== state.step || previous.scenario !== state.scenario) {
    clearTimeout(playbackTimer)
    playbackTimer = undefined
    if (state.playing) playbackTimer = setTimeout(() => dispatch({ type: 'tick' }), scenarios[state.scenario].steps[state.step]!.holdMs)
  }
}

function routeForState(): string {
  const subject = state.scene === 'a30' ? state.selected : state.clusterSelected
  const defaultSubject = state.scene === 'a30' ? 'gpu' : 'a30'
  return `#${state.scene}${subject === defaultSubject ? '' : `/${subject}`}`
}

function render(): void {
  const currentScenario = scenarios[state.scenario]
  const activeStage = currentScenario.steps[state.step]!
  const scenario = state.mode === 'scenario'
  const node = state.scene === 'a30'
  const visual = scenario && node ? activeStage.visual : undefined
  const software = !node && ['spack', 'lmod', 'slurm'].includes(state.clusterSelected)
  const activeNav = scenario ? state.scenario : node ? 'a30' : ['storage', 'fabric', 'spack', 'lmod', 'slurm'].includes(state.clusterSelected) ? state.clusterSelected : 'overview'
  element('cluster-view').hidden = node
  element('node-view').hidden = !node
  element('workbench').classList.toggle('is-lesson', scenario)
  element('lesson-copy').hidden = !scenario
  element('inspection-detour').hidden = !state.inspecting
  element<HTMLDetailsElement>('inspection-details').open = !scenario || state.inspecting
  const title = node ? 'A30 GPU node' : software ? clusterTopics[state.clusterSelected].name : state.clusterSelected === 'storage' ? 'Shared storage' : state.clusterSelected === 'fabric' ? 'Network fabric' : 'Cluster overview'
  element('page-title').innerHTML = `${title}<span class="title-period">.</span>`
  element('breadcrumb-section').textContent = scenario ? currentScenario.name : software ? 'Software' : node ? 'Compute architecture' : 'System'
  element('scene-reference').textContent = node ? 'SCENE 01 / A30' : 'SCENE 00 / HPC4'
  element('view-tools').hidden = !node
  element('view-label').innerHTML = `${icon(node ? 'box' : 'network')}${node ? 'Isometric anatomy' : 'Connectivity schematic'}`
  document.title = `HPC4 Anatomy / ${title}`
  document.querySelectorAll<HTMLElement>('[data-nav-id]').forEach(button => {
    const selected = button.dataset.navId === activeNav
    if (selected) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  document.querySelectorAll<HTMLElement>('[data-bookmark]').forEach(bookmark => {
    bookmark.textContent = bookmark.dataset.bookmark === state.scenario && visitedScenarios.has(state.scenario) ? `${state.step + 1}/${currentScenario.steps.length}` : ''
  })
  if (renderedScene !== state.scene) {
    const subjects = node ? Object.entries(topics) : Object.entries(clusterTopics)
    element('subject-picker').innerHTML = subjects.map(([identifier, subject]) => `<option value="${identifier}">${subject.name}</option>`).join('')
    renderedScene = state.scene
  }
  const subjectId = node ? state.selected : state.clusterSelected
  const subject = node ? topics[state.selected] : clusterTopics[state.clusterSelected]
  element<HTMLSelectElement>('subject-picker').value = subjectId
  const inspectorKey = `${state.scene}/${subjectId}`
  if (renderedInspector !== inspectorKey) {
    const related = node ? topics[state.selected].related.map(identifier => `<button type="button" class="text-link" data-select="${identifier}">${topics[identifier].name} ${icon('chevron-right')}</button>`).join('') : ''
    element('inspector-content').innerHTML = `<div class="subject-heading"><span class="topic-icon ${subject.color}">${icon(subject.icon)}</span><span class="topic-eyebrow">${node ? topics[state.selected].eyebrow.split(' / ')[1] : clusterTopics[state.clusterSelected].kind}</span><h2>${subject.name}</h2></div><p class="topic-subtitle">${subject.subtitle}</p><p class="topic-description">${subject.description}</p><dl class="topic-properties">${subject.properties.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><details class="subject-notes"><summary>Why it matters ${icon('chevron-right')}</summary><p>${subject.takeaway}</p>${related ? `<div class="related-topics">${related}</div>` : ''}</details>${!node && subjectId === 'a30' ? `<button type="button" class="open-scene-button" data-browse-scene="a30">Open anatomy ${icon('arrow-right')}</button>` : ''}`
    renderedInspector = inspectorKey
  }
  document.querySelectorAll<SVGElement>('[data-cluster-topic]').forEach(subjectElement => {
    const selected = subjectElement.dataset.clusterTopic === state.clusterSelected
    subjectElement.setAttribute('aria-pressed', String(selected))
    subjectElement.classList.toggle('is-selected', selected)
  })
  element('cluster-stage').classList.toggle('storage-focused', scenario && activeStage.clusterTopic === 'storage')
  document.querySelectorAll<SVGElement>('[data-family-link]').forEach(link => link.classList.toggle('is-active', link.dataset.familyLink === (scenario ? activeStage.clusterTopic : state.clusterSelected)))
  element('scenario-panel').hidden = !scenario
  element('explode-button').setAttribute('aria-pressed', String(state.exploded))
  element('explode-button').setAttribute('aria-label', state.exploded ? 'Assemble node layers' : 'Explode node layers')
  element('explode-button').title = state.exploded ? 'Assemble node layers' : 'Explode node layers'
  element('local-button').setAttribute('aria-pressed', String(state.placement === 'local'))
  element('remote-button').setAttribute('aria-pressed', String(state.placement === 'remote'))
  const diagram = element('diagram-stage')
  diagram.querySelector('svg')!.setAttribute('viewBox', scenario ? '20 90 850 480' : '0 0 900 570')
  diagram.classList.toggle('is-exploded', state.exploded)
  diagram.classList.toggle('is-scenario', scenario)
  diagram.classList.toggle('has-buffer-state', Boolean(visual))
  diagram.classList.toggle('is-playing', state.playing)
  diagram.classList.toggle('is-allocated', visual?.allocated === true)
  diagram.classList.toggle('is-computing', visual?.computing === true)
  diagram.classList.toggle('remote-placement', state.placement === 'remote')
  diagram.classList.toggle('show-locality', state.selected === 'numa' || scenario && state.placement === 'remote')
  diagram.dataset.stage = String(state.step)
  diagram.querySelectorAll<SVGElement>('[data-topic]').forEach(part => {
    const selected = (!scenario || state.inspecting) && part.dataset.topic === state.selected
    const focused = visual && (visual.focus.includes('host') && part.classList.contains(state.placement === 'local' ? 'bank-1' : 'bank-0') || visual.focus.includes('device') && part.classList.contains('gpu-0'))
    part.classList.toggle('is-lesson-focus', Boolean(focused))
    part.classList.toggle('is-selected', selected)
    part.setAttribute('aria-pressed', String(selected))
  })
  diagram.querySelectorAll<SVGElement>('[data-annotation]').forEach(annotation => annotation.classList.toggle('is-selected', annotation.dataset.annotation === state.selected))
  const activeLinks = transferPath(visual?.transfer ?? null, state.placement)
  diagram.querySelectorAll<SVGElement>('[data-link]').forEach(connection => connection.classList.toggle('is-active', activeLinks.includes(connection.dataset.link as typeof activeLinks[number])))
  diagram.querySelectorAll<SVGElement>('[data-flow]').forEach(flow => {
    flow.classList.toggle('is-active', activeLinks.includes(flow.dataset.flow as typeof activeLinks[number]))
    flow.classList.toggle('is-reversed', visual?.transfer === 'd2h')
  })
  element('buffer-ledger').hidden = !visual
  if (visual) {
    element('host-buffer-state').textContent = visual.host
    element('device-buffer-state').textContent = visual.device
    element('host-buffer').classList.toggle('is-focused', visual.focus.includes('host'))
    element('device-buffer').classList.toggle('is-focused', visual.focus.includes('device'))
    const route = state.placement === 'remote' ? 'cross-socket + PCIe' : 'PCIe'
    element('transfer-caption').textContent = visual.transfer
      ? `${visual.transfer === 'h2d' ? 'H -> D / Host to device' : 'D -> H / Device to host'} / ${route} / State after copy`
      : visual.computing ? 'State after the GPU kernel.' : 'No host/device copy in this step.'
  }
  element('step-title').textContent = activeStage.title
  element('step-description').textContent = activeStage.description
  element('scenario-title').textContent = currentScenario.name
  element('step-count').textContent = `${String(state.step + 1).padStart(2, '0')} / ${String(currentScenario.steps.length).padStart(2, '0')}  ${activeStage.label}`
  element('step-command').hidden = !activeStage.command
  element('step-command').textContent = activeStage.command ?? ''
  element('lesson-location').textContent = `${String(state.step + 1).padStart(2, '0')} / ${activeStage.location}`
  element('playback-status').textContent = state.playing ? 'Auto-advance on' : state.inspecting ? 'Paused for inspection' : 'Your pace / Next when ready'
  if (renderedScenario !== state.scenario) {
    element('step-picker').innerHTML = currentScenario.steps.map((step, index) => `<option value="${index}">${index + 1}. ${step.label}</option>`).join('')
    renderedScenario = state.scenario
  }
  element<HTMLSelectElement>('step-picker').value = String(state.step)
  const range = element<HTMLInputElement>('step-range')
  range.max = String(currentScenario.steps.length - 1)
  range.value = String(state.step)
  range.setAttribute('aria-valuetext', `Step ${state.step + 1} of ${currentScenario.steps.length}: ${activeStage.label}`)
  range.style.setProperty('--progress', `${state.step / (currentScenario.steps.length - 1) * 100}%`)
  element<HTMLButtonElement>('previous-button').disabled = state.step === 0
  element<HTMLButtonElement>('next-button').disabled = state.step === currentScenario.steps.length - 1
  const playButton = element<HTMLButtonElement>('play-button')
  playButton.innerHTML = icon(state.playing ? 'pause' : 'play')
  playButton.setAttribute('aria-label', state.playing ? 'Pause scenario' : state.step === currentScenario.steps.length - 1 ? 'Replay scenario' : 'Play scenario')
  playButton.title = state.playing ? 'Pause automatic advancement' : 'Auto-advance at an authored reading pace'
  createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.65, 'aria-hidden': 'true' } })
}

app.addEventListener('click', event => {
  const target = event.target as Element
  const browseScene = target.closest<HTMLElement>('[data-browse-scene]')?.dataset.browseScene
  const browseTopic = target.closest<HTMLElement>('[data-browse-topic]')?.dataset.browseTopic
  if (browseScene === 'cluster' || browseScene === 'a30') {
    closeNavigation()
    dispatch(browseScene === 'cluster' ? { type: 'browse', scene: 'cluster' } : { type: 'browse', scene: 'a30' })
  }
  if (browseTopic && browseTopic in clusterTopics) {
    closeNavigation()
    dispatch({ type: 'browse', scene: 'cluster', topic: browseTopic as ClusterTopicId })
  }
  const selectedScenario = target.closest<HTMLElement>('[data-scenario]')?.dataset.scenario
  if (selectedScenario === 'first-job') {
    closeNavigation()
    dispatch(visitedScenarios.has(selectedScenario) && state.scenario === selectedScenario ? { type: 'mode', mode: 'scenario' } : { type: 'start-scenario', scenario: selectedScenario })
    element('page-title').focus({ preventScroll: true })
  }
  const clusterTopic = target.closest<SVGElement>('[data-cluster-topic]')?.dataset.clusterTopic
  if (clusterTopic && clusterTopic in clusterTopics) dispatch({ type: 'cluster-select', topic: clusterTopic as ClusterTopicId })
  const topic = target.closest<HTMLElement>('[data-select]')?.dataset.select ?? target.closest<SVGElement>('[data-topic]')?.dataset.topic
  if (topic && topic in topics) dispatch({ type: 'select', topic: topic as TopicId })
})

element('diagram-stage').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const topic = (event.target as Element).closest<SVGElement>('[data-topic]')?.dataset.topic
  if (topic && topic in topics) {
    event.preventDefault()
    dispatch({ type: 'select', topic: topic as TopicId })
  }
})

element('cluster-stage').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const topic = (event.target as Element).closest<SVGElement>('[data-cluster-topic]')?.dataset.clusterTopic
  if (topic && topic in clusterTopics) {
    event.preventDefault()
    dispatch({ type: 'cluster-select', topic: topic as ClusterTopicId })
  }
})
window.addEventListener('popstate', () => dispatch(navigationFromHash(), false))
element<HTMLSelectElement>('subject-picker').addEventListener('change', event => {
  const subject = (event.target as HTMLSelectElement).value
  dispatch(state.scene === 'a30' ? { type: 'select', topic: subject as TopicId } : { type: 'cluster-select', topic: subject as ClusterTopicId })
})
element<HTMLInputElement>('step-range').addEventListener('input', event => dispatch({ type: 'step', step: Number((event.target as HTMLInputElement).value) }))
element<HTMLSelectElement>('step-picker').addEventListener('change', event => dispatch({ type: 'step', step: Number((event.target as HTMLSelectElement).value) }))
element('return-to-lesson').addEventListener('click', () => {
  dispatch({ type: 'return-to-lesson' })
  element('step-title').focus()
})
element<HTMLDetailsElement>('inspection-details').addEventListener('toggle', event => {
  if (state.mode !== 'scenario') return
  const open = (event.target as HTMLDetailsElement).open
  if (open === state.inspecting) return
  dispatch(open
    ? state.scene === 'a30' ? { type: 'select', topic: state.selected } : { type: 'cluster-select', topic: state.clusterSelected }
    : { type: 'return-to-lesson' })
})
element('leave-scenario').addEventListener('click', () => dispatch({ type: 'mode', mode: 'explore' }))
element('restart-scenario').addEventListener('click', () => dispatch({ type: 'start-scenario', scenario: state.scenario }))
element('local-button').addEventListener('click', () => dispatch({ type: 'placement', placement: 'local' }))
element('remote-button').addEventListener('click', () => dispatch({ type: 'placement', placement: 'remote' }))
element('explode-button').addEventListener('click', () => dispatch({ type: 'explode' }))
element('reset-button').addEventListener('click', () => dispatch({ type: 'reset-view' }))
element('play-button').addEventListener('click', () => dispatch({ type: 'play' }))
element('previous-button').addEventListener('click', () => dispatch({ type: 'step', step: state.step - 1 }))
element('next-button').addEventListener('click', () => dispatch({ type: 'step', step: state.step + 1 }))
const dialog = element<HTMLDialogElement>('evidence-dialog')
const openEvidence = () => {
  if (state.playing) dispatch({ type: 'play' })
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
  if (document.hidden && state.playing) dispatch({ type: 'play' })
})
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
  if (state.playing) dispatch({ type: 'play' })
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
  dispatch({ type: 'browse', scene: 'cluster' })
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
  const visual = state.mode === 'scenario' ? scenarios[state.scenario].steps[state.step]!.visual : undefined
  clone.setAttribute('viewBox', visual ? '0 0 900 660' : '0 0 900 590')
  clone.setAttribute('height', visual ? '880' : '787')
  if (visual) {
    const caption = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    caption.setAttribute('x', '84')
    caption.setAttribute('y', '580')
    caption.setAttribute('fill', '#425968')
    caption.setAttribute('font-size', '13')
    caption.setAttribute('font-family', 'sans-serif')
    caption.textContent = `H / Host RAM: ${visual.host}. D / GPU 0 memory: ${visual.device}.`
    clone.append(caption)
    const transferCaption = caption.cloneNode(true) as SVGTextElement
    transferCaption.setAttribute('y', '605')
    transferCaption.textContent = element('transfer-caption').textContent
    clone.append(transferCaption)
  }
  const note = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  note.setAttribute('x', '84')
  note.setAttribute('y', visual ? '635' : '570')
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

render()
history.replaceState(null, '', routeForState())
