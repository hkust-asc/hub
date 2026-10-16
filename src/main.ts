import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import './app.css'
import { createIcons, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Box, CalendarCheck, Check, ChevronRight, Cpu, GitCompareArrows, Info, Layers2, MemoryStick, Microchip, Network, Pause, Play, RotateCcw, Route, Server, X } from 'lucide'
import { evidence, initialState, stages, topics, transferPath, updateState } from './model'
import type { Action, AppState, TopicId } from './model'
import { createScene } from './scene'

const iconSet = { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Box, CalendarCheck, Check, ChevronRight, Cpu, GitCompareArrows, Info, Layers2, MemoryStick, Microchip, Network, Pause, Play, RotateCcw, Route, Server, X }
const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`
const app = document.querySelector<HTMLDivElement>('#app')!
let state: AppState = { ...initialState }
let playbackTimer: ReturnType<typeof setInterval> | undefined

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="HPC4 Anatomy home"><span class="brand-symbol">${icon('box')}</span><span>HPC4 <span class="brand-divider">/</span> <strong>anatomy</strong></span></a>
    <div class="header-right"><span class="edition">SYSTEM STUDY 001</span><a class="handbook-link" href="${evidence.handbook}" target="_blank" rel="noopener noreferrer">Handbook ${icon('arrow-up-right')}</a></div>
  </header>
  <main>
    <div class="page-heading">
      <div><div class="breadcrumb">HPC4 <span>/</span> Compute architecture <span>/</span> A30 node</div><h1>Inside a GPU node<span class="title-period">.</span></h1><p class="page-subtitle">The processors, memory, and paths behind a GPU computation.</p></div>
      <button class="evidence-button" id="open-evidence" type="button">${icon('info')} <span>Illustrative topology</span> ${icon('arrow-up-right')}</button>
    </div>
    <section class="workbench" aria-label="GPU node explorer">
      <div class="workbench-toolbar">
        <div class="mode-tabs" role="tablist" aria-label="Experience"><button type="button" id="explore-tab" role="tab" aria-selected="true" aria-controls="explore-panel">${icon('box')} Explore the node</button><button type="button" id="scenario-tab" role="tab" aria-selected="false" aria-controls="scenario-panel">${icon('route')} Follow the data</button></div>
        <div class="view-tools"><button type="button" class="tool-button" id="explode-button" aria-pressed="false" aria-label="Explode node layers" title="Explode node layers">${icon('layers-2')}</button><span class="tool-divider"></span><button type="button" class="tool-button" id="download-button" aria-label="Download diagram as SVG" title="Download diagram as SVG">${icon('arrow-down-to-line')}</button><button type="button" class="tool-button" id="reset-button" aria-label="Reset view and scenario" title="Reset view and scenario">${icon('rotate-ccw')}</button></div>
      </div>
      <div class="workbench-body">
        <div class="visual-column">
          <div class="diagram-stage" id="diagram-stage"><div class="stage-caption"><span class="figure-number">FIG. 01</span><span>A30 COMPUTE NODE</span></div><div class="stage-view-label">ISOMETRIC VIEW</div>${createScene()}<div class="stage-bottom"><span><span class="key-dot gpu-dot"></span> Accelerator <span class="key-dot cpu-dot"></span> Host <span class="key-dot memory-dot"></span> Memory</span><span class="stage-bottom-right" id="diagram-status">4 GPUs / 2 sockets</span></div></div>
          <div class="context-strip"><span class="context-icon">${icon('git-compare-arrows')}</span><div><span class="micro-label">CPU + MEMORY PLACEMENT</span><span id="placement-description">Local to GPU 0's host path</span></div><div class="placement-control" role="group" aria-label="CPU and memory placement"><button type="button" id="local-button" aria-pressed="true">Local</button><button type="button" id="remote-button" aria-pressed="false">Cross-socket</button></div></div>
        </div>
        <aside class="inspector" aria-label="Component details"><div class="inspector-label"><span>COMPONENT NOTES</span><span id="topic-index">01 / 07</span></div><div id="inspector-content"></div></aside>
      </div>
      <div class="explore-panel" id="explore-panel" role="tabpanel" aria-labelledby="explore-tab"><div class="section-kicker">THE NODE, PART BY PART</div><div class="component-list">${(Object.entries(topics) as [TopicId, typeof topics[TopicId]][]).map(([identifier, topic]) => `<button type="button" class="component-button" data-select="${identifier}" aria-pressed="false">${icon(topic.icon)}<span>${identifier === 'gpu' ? 'GPU' : identifier === 'cpu' ? 'CPU' : identifier === 'memory' ? 'Host RAM' : identifier === 'numa' ? 'NUMA' : identifier === 'pcie' ? 'PCIe' : identifier === 'nic' ? 'Network' : 'Slurm'}</span></button>`).join('')}</div></div>
      <div class="scenario-panel" id="scenario-panel" role="tabpanel" aria-labelledby="scenario-tab" hidden><div class="scenario-header"><div class="section-kicker">ONE EXPLICIT-COPY GPU OPERATION</div><span class="simulation-label">ILLUSTRATIVE / NOT A PERFORMANCE TRACE</span></div><div class="scenario-steps" role="group" aria-label="Scenario steps">${stages.map((stage, index) => `<button type="button" data-step="${index}" class="step-button" aria-pressed="false"><span class="step-number">${String(index + 1).padStart(2, '0')}</span><span>${stage.label}</span></button>`).join('')}</div><div class="scenario-readout"><div class="scenario-transport"><button class="play-button" type="button" id="play-button" aria-label="Play scenario" title="Play scenario">${icon('play')}</button><button class="tool-button" type="button" id="previous-button" aria-label="Previous step" title="Previous step">${icon('arrow-left')}</button><button class="tool-button" type="button" id="next-button" aria-label="Next step" title="Next step">${icon('arrow-right')}</button></div><div class="step-copy" aria-live="polite"><h2 id="step-title"></h2><p id="step-description"></p></div><div class="location-readout"><span class="micro-label">DATA / STATE</span><span id="step-location"></span></div></div></div>
    </section>
    <section class="node-profile" aria-label="Published hardware specification"><div class="profile-title">${icon('server')}<div><span class="micro-label">PUBLISHED PROFILE</span><span>HPC4 / A30 node</span></div></div><div class="profile-stat"><strong>2<span>x</span></strong><span>Xeon Gold 6448Y</span></div><div class="profile-stat"><strong>512<span>GB</span></strong><span>DDR5 host memory</span></div><div class="profile-stat"><strong>4<span>x A30</span></strong><span>24 GB HBM2 per GPU</span></div><a class="profile-source" href="${evidence.hardwareSource}" target="_blank" rel="noopener noreferrer">Hardware source ${icon('arrow-up-right')}</a></section>
    <footer class="page-footer"><span><span class="footer-dot"></span> Educational proof of concept <span class="footer-separator">/</span> No live cluster connection</span><button type="button" id="footer-evidence">Sources & assumptions ${icon('arrow-up-right')}</button></footer>
  </main>
  <dialog id="evidence-dialog" aria-labelledby="evidence-title"><div class="dialog-heading"><span class="section-kicker">MODEL EVIDENCE</span><button type="button" class="tool-button" id="close-evidence" aria-label="Close sources and assumptions" title="Close">${icon('x')}</button></div><h2 id="evidence-title">What is real. What is schematic.</h2><p class="dialog-intro">Hardware facts follow the public HPC4 specification, checked ${evidence.verified}. This diagram is not an inventory of an inspected compute node.</p><h3>Published hardware</h3><ul class="evidence-list published-list">${evidence.published.map(fact => `<li>${icon('check')}<span>${fact}</span></li>`).join('')}</ul><h3>Illustrative, not verified</h3><ul class="evidence-list">${evidence.illustrative.map(fact => `<li>${icon('info')}<span>${fact}</span></li>`).join('')}</ul><p class="dialog-caveat">The scenario uses explicit copies without overlap or unified memory. Packet motion is explanatory, not measured traffic or transfer speed.</p><a class="source-link" href="${evidence.hardwareSource}" target="_blank" rel="noopener noreferrer">Official HPC4 specification ${icon('arrow-up-right')}</a><a class="source-link" href="${evidence.handbook}" target="_blank" rel="noopener noreferrer">HPC handbook ${icon('arrow-up-right')}</a></dialog>
`

function element<ElementType extends HTMLElement = HTMLElement>(identifier: string): ElementType {
  return document.getElementById(identifier) as ElementType
}

function dispatch(action: Action): void {
  state = updateState(state, action)
  render()
  if (state.playing && !playbackTimer) playbackTimer = setInterval(() => dispatch({ type: 'tick' }), 4800)
  if (!state.playing && playbackTimer) {
    clearInterval(playbackTimer)
    playbackTimer = undefined
  }
}

function render(): void {
  const topic = topics[state.selected]
  const activeStage = stages[state.step]!
  const scenario = state.mode === 'scenario'
  element('explore-panel').hidden = scenario
  element('scenario-panel').hidden = !scenario
  element('explore-tab').setAttribute('aria-selected', String(!scenario))
  element('scenario-tab').setAttribute('aria-selected', String(scenario))
  element('explode-button').setAttribute('aria-pressed', String(state.exploded))
  element('explode-button').setAttribute('aria-label', state.exploded ? 'Assemble node layers' : 'Explode node layers')
  element('explode-button').title = state.exploded ? 'Assemble node layers' : 'Explode node layers'
  element('local-button').setAttribute('aria-pressed', String(state.placement === 'local'))
  element('remote-button').setAttribute('aria-pressed', String(state.placement === 'remote'))
  element('placement-description').textContent = state.placement === 'local' ? "Local to GPU 0's host path" : 'An extra inter-socket crossing'
  element('diagram-status').textContent = scenario ? `${String(state.step + 1).padStart(2, '0')} / ${String(stages.length).padStart(2, '0')} ${activeStage.label.toUpperCase()}` : '4 GPUs / 2 sockets'
  element('topic-index').textContent = `${String(Object.keys(topics).indexOf(state.selected) + 1).padStart(2, '0')} / 07`
  element('inspector-content').innerHTML = `<div class="topic-icon ${topic.color}">${icon(topic.icon)}</div><div class="topic-eyebrow">${topic.eyebrow}</div><h2>${topic.name}</h2><p class="topic-subtitle">${topic.subtitle}</p><p class="topic-description">${topic.description}</p><dl class="topic-properties">${topic.properties.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl><div class="takeaway"><span class="micro-label">THE IMPORTANT DISTINCTION</span><p>${topic.takeaway}</p></div><div class="related-topics"><span class="micro-label">CONNECTED IDEAS</span><div>${topic.related.map(identifier => `<button type="button" data-select="${identifier}">${identifier === 'numa' ? 'NUMA' : identifier === 'pcie' ? 'PCIe' : identifier === 'gpu' ? 'GPU' : identifier === 'cpu' ? 'CPU' : identifier === 'memory' ? 'Host RAM' : identifier === 'nic' ? 'Network' : 'Slurm'} ${icon('chevron-right')}</button>`).join('')}</div></div>`
  document.querySelectorAll<HTMLElement>('[data-select]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.select === state.selected)))
  const diagram = element('diagram-stage')
  diagram.classList.toggle('is-exploded', state.exploded)
  diagram.classList.toggle('is-scenario', scenario)
  diagram.classList.toggle('is-allocated', scenario && state.step < stages.length - 1)
  diagram.classList.toggle('is-computing', scenario && state.step === 3)
  diagram.classList.toggle('remote-placement', state.placement === 'remote')
  diagram.classList.toggle('show-locality', state.selected === 'numa' || scenario && state.placement === 'remote')
  diagram.dataset.stage = String(state.step)
  diagram.querySelectorAll<SVGElement>('[data-topic]').forEach(part => {
    const selected = part.dataset.topic === state.selected
    part.classList.toggle('is-selected', selected)
    part.setAttribute('aria-pressed', String(selected))
  })
  diagram.querySelectorAll<SVGElement>('[data-annotation]').forEach(annotation => annotation.classList.toggle('is-selected', annotation.dataset.annotation === state.selected))
  const activeLinks = scenario ? transferPath(state.step, state.placement) : []
  diagram.querySelectorAll<SVGElement>('[data-link]').forEach(connection => connection.classList.toggle('is-active', activeLinks.includes(connection.dataset.link as typeof activeLinks[number])))
  diagram.querySelectorAll<SVGElement>('[data-flow]').forEach(flow => {
    flow.classList.toggle('is-active', activeLinks.includes(flow.dataset.flow as typeof activeLinks[number]))
    flow.classList.toggle('is-reversed', state.step === 4)
  })
  element('step-title').textContent = activeStage.title
  element('step-description').textContent = activeStage.description
  element('step-location').textContent = activeStage.location
  document.querySelectorAll<HTMLElement>('[data-step]').forEach(button => {
    const buttonStep = Number(button.dataset.step)
    button.setAttribute('aria-pressed', String(buttonStep === state.step))
    button.classList.toggle('is-complete', buttonStep < state.step)
    if (buttonStep === state.step) button.setAttribute('aria-current', 'step')
    else button.removeAttribute('aria-current')
  })
  element<HTMLButtonElement>('previous-button').disabled = state.step === 0
  element<HTMLButtonElement>('next-button').disabled = state.step === stages.length - 1
  const playButton = element<HTMLButtonElement>('play-button')
  playButton.innerHTML = icon(state.playing ? 'pause' : 'play')
  playButton.setAttribute('aria-label', state.playing ? 'Pause scenario' : state.step === stages.length - 1 ? 'Replay scenario' : 'Play scenario')
  playButton.title = playButton.getAttribute('aria-label')!
  createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.65, 'aria-hidden': 'true' } })
}

app.addEventListener('click', event => {
  const target = event.target as Element
  const topic = target.closest<HTMLElement>('[data-select]')?.dataset.select ?? target.closest<SVGElement>('[data-topic]')?.dataset.topic
  if (topic && topic in topics) dispatch({ type: 'select', topic: topic as TopicId })
  const step = target.closest<HTMLElement>('[data-step]')?.dataset.step
  if (step !== undefined) dispatch({ type: 'step', step: Number(step) })
})

element('diagram-stage').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const topic = (event.target as Element).closest<SVGElement>('[data-topic]')?.dataset.topic
  if (topic && topic in topics) {
    event.preventDefault()
    dispatch({ type: 'select', topic: topic as TopicId })
  }
})

element('explore-tab').addEventListener('click', () => dispatch({ type: 'mode', mode: 'explore' }))
element('scenario-tab').addEventListener('click', () => dispatch({ type: 'mode', mode: 'scenario' }))
document.querySelector('.mode-tabs')!.addEventListener('keydown', event => {
  const keyboardEvent = event as KeyboardEvent
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboardEvent.key)) return
  keyboardEvent.preventDefault()
  const scenario = keyboardEvent.key === 'End' || keyboardEvent.key !== 'Home' && state.mode === 'explore'
  dispatch({ type: 'mode', mode: scenario ? 'scenario' : 'explore' })
  element(scenario ? 'scenario-tab' : 'explore-tab').focus()
})
element('local-button').addEventListener('click', () => dispatch({ type: 'placement', placement: 'local' }))
element('remote-button').addEventListener('click', () => dispatch({ type: 'placement', placement: 'remote' }))
element('explode-button').addEventListener('click', () => dispatch({ type: 'explode' }))
element('reset-button').addEventListener('click', () => dispatch({ type: 'reset' }))
element('play-button').addEventListener('click', () => dispatch({ type: 'play' }))
element('previous-button').addEventListener('click', () => dispatch({ type: 'step', step: state.step - 1 }))
element('next-button').addEventListener('click', () => dispatch({ type: 'step', step: state.step + 1 }))
const dialog = element<HTMLDialogElement>('evidence-dialog')
const openEvidence = () => {
  if (state.playing) dispatch({ type: 'play' })
  dialog.showModal()
}
element('open-evidence').addEventListener('click', openEvidence)
element('footer-evidence').addEventListener('click', openEvidence)
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

render()
