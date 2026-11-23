import { clusterTopics, evidence, scenarios } from './model'
import { createClusterScene, createScene } from './scene'

export const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`

export function createLayout(): string {
  return `
    <a class="skip-link" href="#workspace">Skip to workspace</a>
    <header class="topbar">
      <div class="brand-group"><button class="icon-button mobile-menu" type="button" id="menu-button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false" title="Navigation">${icon('menu')}</button><a class="brand" href="#cluster" id="brand-link"><span class="brand-symbol">${icon('box')}</span><span>HPC4 <span class="brand-divider">/</span> <strong>anatomy</strong></span></a></div>
      <button class="evidence-button" id="open-evidence" type="button" aria-label="Illustrative topology" title="Sources and illustrative assumptions"><span class="evidence-dot"></span><span class="evidence-label">Illustrative topology</span>${icon('info')}</button>
    </header>
    <div class="app-layout">
      <button class="nav-backdrop" id="nav-backdrop" type="button" aria-label="Close navigation" hidden></button>
      <aside class="sidebar" id="sidebar" aria-label="Navigation">
        <div class="drawer-heading"><span>HPC4 anatomy</span><button class="icon-button" type="button" id="close-menu" aria-label="Close navigation" title="Close navigation">${icon('x')}</button></div>
        <nav class="primary-nav" aria-label="Primary navigation">
          <div class="nav-group"><h2>System</h2><button class="nav-item" type="button" data-browse-scene="cluster" data-nav-id="overview">${icon('network')}<span>Cluster overview</span></button><button class="nav-item nav-child" type="button" data-browse-scene="a30" data-nav-id="a30">${icon('microchip')}<span>A30 GPU node</span></button><button class="nav-item" type="button" data-browse-topic="storage" data-nav-id="storage">${icon('hard-drive')}<span>Shared storage</span></button><button class="nav-item" type="button" data-browse-topic="fabric" data-nav-id="fabric">${icon('route')}<span>Network fabric</span></button></div>
          <div class="nav-group"><h2>Software</h2>${(['spack', 'lmod', 'slurm'] as const).map(identifier => `<button class="nav-item" type="button" data-browse-topic="${identifier}" data-nav-id="${identifier}">${icon(clusterTopics[identifier].icon)}<span>${clusterTopics[identifier].name}</span></button>`).join('')}</div>
          <div class="nav-group">
            <h2>Scenarios</h2>
            <a class="nav-item scenario-nav" href="?lesson=host-to-gpu">${icon('play')}<span>Host to GPU</span></a>
            ${Object.entries(scenarios).map(([identifier, scenario]) => `<button class="nav-item scenario-nav" type="button" data-scenario="${identifier}" data-nav-id="${identifier}">${icon('play')}<span>${scenario.name}</span><span class="scenario-bookmark" data-bookmark="${identifier}"></span></button>`).join('')}
          </div>
        </nav>
        <div class="sidebar-footer"><a href="${evidence.handbook}" target="_blank" rel="noopener noreferrer">${icon('book-open')}<span>HPC handbook</span>${icon('arrow-up-right')}</a><span class="offline-note"><span></span>Educational model / not live</span></div>
      </aside>
      <main class="workspace" id="workspace">
        <header class="workspace-heading"><div><div class="breadcrumb"><span>HPC4</span>${icon('chevron-right')}<span id="breadcrumb-section">System</span></div><h1 id="page-title" tabindex="-1">Cluster overview<span class="title-period">.</span></h1></div><span class="scene-reference" id="scene-reference">SCENE 00</span></header>
        <section class="workbench" id="workbench" aria-label="Architecture workspace">
          <div class="visual-column">
            <div class="view-toolbar"><span class="view-label" id="view-label">${icon('network')} Connectivity schematic</span><div class="view-tools" id="view-tools"><button type="button" class="icon-button" id="explode-button" aria-pressed="false" aria-label="Explode node layers" title="Explode node layers">${icon('layers-2')}</button><button type="button" class="icon-button" id="download-button" aria-label="Download diagram as SVG" title="Download diagram as SVG">${icon('arrow-down-to-line')}</button><button type="button" class="icon-button" id="reset-button" aria-label="Reset node view" title="Reset node view">${icon('rotate-ccw')}</button></div></div>
            <div id="cluster-view"><div class="diagram-stage cluster-stage" id="cluster-stage">${createClusterScene()}</div></div>
            <div id="node-view" hidden>
              <div class="diagram-stage" id="diagram-stage">${createScene()}</div>
              <section class="buffer-ledger" id="buffer-ledger" aria-label="Buffer state after this step" hidden>
                <div class="buffer-card host-buffer" id="host-buffer"><span class="buffer-key">H</span><div><span class="buffer-name">Host RAM</span><strong id="host-buffer-state"></strong></div></div>
                <div class="buffer-card device-buffer" id="device-buffer"><span class="buffer-key">D</span><div><span class="buffer-name">GPU 0 memory</span><strong id="device-buffer-state"></strong></div></div>
                <p id="transfer-caption"></p>
              </section>
              <div class="placement-strip"><span>${icon('git-compare-arrows')}CPU / memory placement</span><div class="placement-control" role="group" aria-label="CPU and memory placement"><button type="button" id="local-button" aria-pressed="true">Local</button><button type="button" id="remote-button" aria-pressed="false">Cross-socket</button></div></div>
            </div>
            <section class="lesson-player" id="scenario-panel" aria-label="Scenario player" hidden>
              <div class="player-heading"><div class="scenario-transport"><button class="icon-button" type="button" id="previous-button" aria-label="Previous step" title="Previous step">${icon('skip-back')}</button><button class="play-button" type="button" id="play-button" aria-label="Play scenario" title="Play scenario">${icon('play')}</button><button class="icon-button" type="button" id="next-button" aria-label="Next step" title="Next step">${icon('skip-forward')}</button></div><div class="player-identity"><h2 id="scenario-title"></h2><span id="step-count"></span></div><div class="player-actions"><button class="icon-button" type="button" id="restart-scenario" aria-label="Restart scenario" title="Restart scenario">${icon('rotate-ccw')}</button><button class="icon-button" type="button" id="leave-scenario" aria-label="Leave scenario" title="Leave scenario">${icon('x')}</button></div></div>
              <input id="step-range" class="step-range" type="range" min="0" max="5" step="1" value="0" aria-label="Scenario step" />
              <div class="player-footer"><span id="playback-status"></span><select id="step-picker" aria-label="Jump to step"></select></div>
            </section>
          </div>
          <aside class="context-panel" aria-label="Explanation and inspection">
            <section class="lesson-copy" id="lesson-copy" aria-label="Current explanation" hidden>
              <p class="lesson-location" id="lesson-location"></p>
              <div class="step-copy" aria-live="polite" aria-atomic="true"><h2 id="step-title" tabindex="-1"></h2><p id="step-description"></p><code id="step-command" hidden></code></div>
              <p class="lesson-caveat">Illustrative sequence, not hardware timing.</p>
              <div id="inspection-detour" hidden><p>Lesson paused for inspection.</p><button type="button" class="return-to-lesson" id="return-to-lesson">Back to this step ${icon('arrow-right')}</button></div>
            </section>
            <details class="inspection-details" id="inspection-details" open>
              <summary>Inspect a subject</summary>
              <div class="inspector"><label class="subject-picker-label" for="subject-picker">Inspect</label><select id="subject-picker" aria-label="Inspect subject"></select><div id="inspector-content"></div></div>
            </details>
          </aside>
        </section>
      </main>
    </div>
    <dialog id="evidence-dialog" aria-labelledby="evidence-title"><div class="dialog-heading"><span class="section-kicker">Sources & assumptions</span><button type="button" class="icon-button" id="close-evidence" aria-label="Close sources and assumptions" title="Close">${icon('x')}</button></div><h2 id="evidence-title">What is real. What is schematic.</h2><p class="dialog-intro">Published HPC4 specifications, checked ${evidence.verified}. These scenes are not an inventory of inspected nodes or switches.</p><h3>Published hardware</h3><ul class="evidence-list published-list">${evidence.published.map(fact => `<li>${icon('check')}<span>${fact}</span></li>`).join('')}</ul><h3>Illustrative, not verified</h3><ul class="evidence-list">${evidence.illustrative.map(fact => `<li>${icon('info')}<span>${fact}</span></li>`).join('')}</ul><p class="dialog-caveat">The GPU operation uses explicit copies without overlap or unified memory. Motion is explanatory, not measured traffic or speed. Cluster glyphs represent families; shared-storage access is a logical relationship, not a measured network route.</p><a class="source-link" href="${evidence.hardwareSource}" target="_blank" rel="noopener noreferrer">Official HPC4 specification ${icon('arrow-up-right')}</a><a class="source-link" href="${evidence.storageSource}" target="_blank" rel="noopener noreferrer">Storage policies ${icon('arrow-up-right')}</a><a class="source-link" href="${evidence.handbook}" target="_blank" rel="noopener noreferrer">HPC handbook ${icon('arrow-up-right')}</a></dialog>
  `
}