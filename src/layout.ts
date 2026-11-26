import { categories, entries, entriesForCategory, filterEntries, getCategory, routeForEntry } from './catalog.ts'
import type { CategoryDef, CategoryId, EntryDef } from './catalog.ts'
import { renderGlyph } from './glyphs.ts'
import { evidence } from './model.ts'
import { createClusterScene, createScene } from './scene.ts'

export const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`

export function renderEntryTile(
  entry: EntryDef,
  options: { index?: number; progress?: string; compact?: boolean } = {},
): string {
  const route = routeForEntry(entry)
  const planned = entry.kind === 'planned' || !route
  const style = options.index !== undefined ? ` style="--tile-index: ${Math.min(options.index, 7)}"` : ''
  const tag = planned ? 'button' : 'a'
  const attrs = planned
    ? `type="button" aria-disabled="true"`
    : `href="${route}" data-entry-link="${entry.id}"`
  return `<${tag} class="entry-tile${options.compact ? ' is-compact' : ''}" ${attrs} data-preview-entry="${entry.id}" data-kind="${entry.kind}" data-tone="${entry.tone}"${style}>
    <span class="entry-tile-frame">
      ${renderGlyph(entry.glyph)}
      ${entry.kind === 'scenario' ? `<span class="entry-play-mark" aria-hidden="true">▶</span>` : ''}
      ${options.progress ? `<span class="entry-progress-dot" title="Saved: ${options.progress}" aria-hidden="true"></span>` : ''}
    </span>
    <span class="entry-tile-caption">${entry.shortTitle}</span>
  </${tag}>`
}

export function renderDomainTile(category: CategoryDef, index: number): string {
  return `<a class="domain-tile" href="#atlas/${category.id}" data-route="#atlas/${category.id}" data-preview-category="${category.id}" data-tone="${category.tone}" style="--tile-index: ${index}">
    <span class="domain-tile-frame">
      ${renderGlyph(category.glyph)}
    </span>
    <span class="domain-tile-title">${category.shortName}</span>
  </a>`
}

export function renderAtlasBody(options: {
  mode: 'all' | 'domains'
  query: string
  kind: 'all' | 'scene' | 'subject' | 'scenario'
  progressForEntry: (entryId: string) => string | undefined
}): string {
  const filtering = options.mode === 'all' || options.query.trim().length > 0 || options.kind !== 'all'
  if (!filtering) {
    const systemCats = categories.filter(cat => cat.track === 'system')
    const workflowCats = categories.filter(cat => cat.track === 'workflow')
    const featuredScenarios = entries.filter(entry => entry.kind === 'scenario')
    return `
      <p class="atlas-prompt">Pick a domain to explore its concepts and scenarios, or start directly from a guided walkthrough below.</p>
      <div class="atlas-shelves">
        <section class="atlas-shelf" aria-label="HPC4 System Architecture">
          <h3 class="shelf-pill"><span>HPC4 System Architecture</span></h3>
          <div class="domain-row">
            ${systemCats.map((cat, idx) => renderDomainTile(cat, idx)).join('')}
          </div>
        </section>
        <section class="atlas-shelf" aria-label="Software, Linux and GPU Execution">
          <h3 class="shelf-pill"><span>Environment, Remote Shell &amp; GPU Execution</span></h3>
          <div class="domain-row">
            ${workflowCats.map((cat, idx) => renderDomainTile(cat, idx + systemCats.length)).join('')}
          </div>
        </section>
        <section class="atlas-shelf atlas-featured-shelf" aria-label="Guided Scenarios">
          <h3 class="shelf-pill"><span>Guided Scenarios</span></h3>
          <div class="entry-row">
            ${featuredScenarios.map((entry, idx) => renderEntryTile(entry, { index: idx, progress: options.progressForEntry(entry.id) })).join('')}
          </div>
        </section>
      </div>`
  }

  const matched = filterEntries({ query: options.query, kind: options.kind })
  if (matched.length === 0) {
    return `<div class="atlas-empty">
      <p>No concepts or scenarios match <strong>"${options.query.replace(/[<>&"]/g, '')}"</strong>.</p>
      <button type="button" class="clear-filter-button" id="reset-atlas-filter">Reset filter</button>
    </div>`
  }

  return `<div class="atlas-catalog-groups">
    ${categories.map(cat => {
      const groupEntries = matched.filter(entry => entry.category === cat.id)
      if (groupEntries.length === 0) return ''
      return `<section class="catalog-group" data-tone="${cat.tone}" aria-label="${cat.name}">
        <div class="catalog-group-header">
          <a class="catalog-group-link" href="#atlas/${cat.id}" data-route="#atlas/${cat.id}">
            <span class="catalog-group-dot"></span>
            <h3>${cat.name}</h3>
            ${icon('chevron-right')}
          </a>
        </div>
        <div class="entry-row is-left">
          ${groupEntries.map((entry, idx) => renderEntryTile(entry, { index: idx, progress: options.progressForEntry(entry.id) })).join('')}
        </div>
      </section>`
    }).join('')}
  </div>`
}

export function renderHubView(
  categoryId: CategoryId,
  progressForEntry: (entryId: string) => string | undefined,
): string {
  const cat = getCategory(categoryId)
  const items = entriesForCategory(categoryId)
  const exploreItems = items.filter(item => item.kind === 'scene' || item.kind === 'subject')
  const scenarioItems = items.filter(item => item.kind === 'scenario' || item.kind === 'planned')
  let runningIndex = 0
  return `
    <div class="hub-stage" data-tone="${cat.tone}">
      <header class="hub-header">
        <span class="hub-category-glyph" data-tone="${cat.tone}">${renderGlyph(cat.glyph)}</span>
        <div class="hub-title-block">
          <span class="hub-eyebrow">Exploring</span>
          <h2 id="hub-title" tabindex="-1">${cat.name}</h2>
          <p>${cat.subtitle}</p>
        </div>
      </header>
      <div class="hub-shelves">
        ${exploreItems.length > 0 ? `<section class="hub-shelf" aria-label="Scenes and subjects">
          <h3 class="shelf-pill"><span>Scenes &amp; Concepts</span></h3>
          <div class="entry-row">
            ${exploreItems.map(entry => renderEntryTile(entry, { index: runningIndex++, progress: progressForEntry(entry.id) })).join('')}
          </div>
        </section>` : ''}
        ${scenarioItems.length > 0 ? `<section class="hub-shelf" aria-label="Guided scenarios and roadmap">
          <h3 class="shelf-pill"><span>${exploreItems.length > 0 ? 'Guided Scenarios &amp; Upcoming' : 'Scenarios &amp; Upcoming'}</span></h3>
          <div class="entry-row">
            ${scenarioItems.map(entry => renderEntryTile(entry, { index: runningIndex++, progress: progressForEntry(entry.id) })).join('')}
          </div>
        </section>` : ''}
      </div>
      <aside class="hub-thesis" aria-label="Domain core concept">
        <p>${cat.thesis}</p>
      </aside>
    </div>`
}

export function createLayout(): string {
  const systemCats = categories.filter(cat => cat.track === 'system')
  const workflowCats = categories.filter(cat => cat.track === 'workflow')
  const modes = [
    { name: 'Learn', tone: 'blue' },
    { name: 'Practice', tone: 'green' },
    { name: 'Weeks', tone: 'amber' },
    { name: 'Atlas', tone: 'slate' },
  ] as const
  const modeLinks = (className: string) => modes.map(({ name, tone }) =>
    `<a class="${className}" data-mode="${name.toLowerCase()}" data-tone="${tone}" data-route="#${name.toLowerCase()}" href="#${name.toLowerCase()}"><span class="mode-dot" aria-hidden="true"></span><span>${name}</span></a>`).join('')
  const renderSidebarCat = (cat: CategoryDef) =>
    `<a class="nav-item domain-nav-item" href="#atlas/${cat.id}" data-route="#atlas/${cat.id}" data-domain-nav="${cat.id}" data-tone="${cat.tone}">
      <span class="domain-dot" aria-hidden="true"></span>
      <span>${cat.shortName}</span>
    </a>`

  return `
    <a class="skip-link" href="#workspace">Skip to workspace</a>
    <header class="topbar">
      <div class="brand-group"><button class="icon-button mobile-menu" type="button" id="menu-button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false" title="Navigation">${icon('menu')}</button><a class="brand" href="#atlas" id="brand-link"><span class="brand-symbol">${icon('box')}</span><span>HPC4 <span class="brand-divider">/</span> <strong>hub</strong></span></a></div>
      <nav class="top-modes" aria-label="Learning modes">${modeLinks('mode-tab')}</nav>
      <div class="top-tools"><button class="search-trigger" id="open-switcher" type="button" title="Search all modes (Ctrl+K)" aria-label="Search all modes" aria-keyshortcuts="Control+K Meta+K">${icon('search')}<span class="search-trigger-label">Search</span><kbd class="search-kbd" id="search-kbd">Ctrl K</kbd></button>
      <button class="icon-button theme-toggle" id="theme-toggle" type="button" aria-label="Switch to dark mode" aria-pressed="false" title="Dark mode"><span class="theme-icon-moon">${icon('moon')}</span><span class="theme-icon-sun">${icon('sun')}</span></button>
      <button class="evidence-button" id="open-evidence" type="button" aria-label="Illustrative topology" title="Sources and illustrative assumptions"><span class="evidence-dot"></span><span class="evidence-label">Illustrative topology</span>${icon('info')}</button></div>
    </header>
    <div class="app-layout">
      <button class="nav-backdrop" id="nav-backdrop" type="button" aria-label="Close navigation" hidden></button>
      <aside class="sidebar" id="sidebar" aria-label="Navigation">
        <div class="drawer-heading"><span>HPC4 hub</span><button class="icon-button" type="button" id="close-menu" aria-label="Close navigation" title="Close navigation">${icon('x')}</button></div>
        <nav class="primary-nav" aria-label="Primary navigation">
          <div class="nav-group drawer-modes"><h2>Learning modes</h2>${modeLinks('nav-item')}</div>
          <div class="nav-group">
            <h2>Explore</h2>
            <a class="nav-item" href="#atlas" data-route="#atlas" data-nav-id="atlas">${icon('layout-grid')}<span>Concept Atlas</span></a>
          </div>
          <div class="nav-group">
            <h2>HPC4 System</h2>
            ${systemCats.map(renderSidebarCat).join('')}
          </div>
          <div class="nav-group">
            <h2>Workflow &amp; Code</h2>
            ${workflowCats.map(renderSidebarCat).join('')}
          </div>
          <div class="nav-group">
            <h2>Direct Scenes</h2>
            <button class="nav-item" type="button" data-browse-scene="cluster" data-nav-id="overview">${icon('network')}<span>Cluster schematic</span></button>
            <button class="nav-item" type="button" data-browse-scene="a30" data-nav-id="a30">${icon('microchip')}<span>A30 node cutaway</span></button>
          </div>
        </nav>
        <div id="resume-slot" class="resume-slot" hidden></div>
        <div class="sidebar-footer"><a href="${evidence.handbook}" target="_blank" rel="noopener noreferrer">${icon('book-open')}<span>HPC handbook</span>${icon('arrow-up-right')}</a><span class="offline-note"><span></span>Educational model / not live</span></div>
      </aside>
      <main class="workspace" id="workspace">
        <header class="workspace-heading">
          <div class="heading-main">
            <div class="heading-trail">
              <button type="button" class="think-back" id="think-back" hidden>
                ${icon('arrow-left')}
                <span class="think-back-glyph" id="think-back-glyph"></span>
                <span class="think-back-label" id="think-back-label"></span>
              </button>
              <div class="breadcrumb" id="breadcrumb"><span>HPC4</span>${icon('chevron-right')}<span id="breadcrumb-section">Atlas</span></div>
            </div>
            <h1 id="page-title" tabindex="-1">Concept &amp; scenario atlas<span class="title-period">.</span></h1>
          </div>
          <div class="heading-aside">
            <div class="related-strip" id="related-strip" aria-label="Related entries" hidden></div>
            <span class="scene-reference" id="scene-reference" hidden></span>
          </div>
        </header>

        <section class="atlas-surface" id="atlas-view" aria-label="Concept and scenario atlas">
          <div class="atlas-toolbar">
            <div class="segmented-pills" role="group" aria-label="Atlas view mode">
              <button type="button" data-atlas-mode="all" aria-pressed="true">All Entries</button>
              <button type="button" data-atlas-mode="domains" aria-pressed="false">Domains</button>
            </div>
            <div class="atlas-filters">
              <div class="kind-pills" role="group" aria-label="Filter by entry kind">
                <button type="button" data-atlas-kind="all" aria-pressed="true">All</button>
                <button type="button" data-atlas-kind="scene" aria-pressed="false">Scenes</button>
                <button type="button" data-atlas-kind="subject" aria-pressed="false">Concepts</button>
                <button type="button" data-atlas-kind="scenario" aria-pressed="false">Scenarios</button>
              </div>
              <label class="atlas-search-wrap" aria-label="Filter entries">
                ${icon('search')}
                <input type="search" id="atlas-search" placeholder="Filter entries (numa, 2>, tmux)…" autocomplete="off" />
              </label>
            </div>
          </div>
          <div class="atlas-body" id="atlas-body"></div>
        </section>

        <section class="atlas-surface" id="hub-view" aria-label="Domain hub" hidden></section>

        <section class="workbench" id="workbench" aria-label="Architecture workspace" hidden>
          <div class="visual-column">
            <div class="view-toolbar"><span class="view-label" id="view-label">${icon('network')} Connectivity schematic</span><div class="view-toolbar-right"><span class="view-click-cue" id="view-click-cue"><span class="view-cue-dot" aria-hidden="true"></span><span id="view-click-cue-text">Click any block to inspect (I)</span></span><div class="view-tools" id="view-tools"><button type="button" class="icon-button" id="explode-button" aria-pressed="false" aria-label="Explode node layers" title="Explode node layers">${icon('layers-2')}</button><button type="button" class="icon-button" id="download-button" aria-label="Download diagram as SVG" title="Download diagram as SVG">${icon('arrow-down-to-line')}</button><button type="button" class="icon-button" id="reset-button" aria-label="Reset node view" title="Reset node view">${icon('rotate-ccw')}</button></div></div></div>
            <div id="cluster-view"><div class="diagram-stage cluster-stage" id="cluster-stage">${createClusterScene()}</div></div>
            <div id="node-view" hidden><div class="diagram-stage" id="diagram-stage">${createScene('workbench-node')}</div><div class="placement-strip"><span>${icon('git-compare-arrows')}CPU / memory placement</span><div class="placement-control" role="group" aria-label="CPU and memory placement"><button type="button" id="local-button" aria-pressed="true">Local</button><button type="button" id="remote-button" aria-pressed="false">Cross-socket</button></div></div></div>
          </div>
          <aside class="inspector" aria-label="Subject details"><label class="subject-picker-label" for="subject-picker">Inspect</label><select id="subject-picker" aria-label="Inspect subject"></select><div id="inspector-content"></div></aside>
        </section>

        <section class="lesson-host" id="lesson-view" aria-label="Interactive scenario" hidden></section>
        <section id="lesson-links" aria-label="Related practice and concepts" hidden></section>
        <section id="platform-view" aria-labelledby="page-title" hidden></section>
      </main>
    </div>
    <div class="entry-preview" id="entry-preview" role="tooltip" hidden></div>
    <dialog id="switcher" aria-labelledby="switch-title"><header><h2 id="switch-title">Search all modes</h2>
      <button type="button" class="mode-action" id="close-switcher">Close</button></header>
      <label for="switch-input">Find a lesson, mission, week or reference</label>
      <input id="switch-input" type="search" role="combobox" aria-expanded="true" aria-controls="switch-list" aria-autocomplete="list" autocomplete="off">
      <div id="switch-list" role="listbox" aria-label="Destinations"></div><small role="status" id="switch-count"></small></dialog>
    <dialog id="evidence-dialog" aria-labelledby="evidence-title"><div class="dialog-heading"><span class="section-kicker">Sources & assumptions</span><button type="button" class="icon-button" id="close-evidence" aria-label="Close sources and assumptions" title="Close">${icon('x')}</button></div><h2 id="evidence-title">What is real. What is schematic.</h2><p class="dialog-intro">Published HPC4 specifications, checked ${evidence.verified}. These scenes are not an inventory of inspected nodes or switches.</p><h3>Published hardware</h3><ul class="evidence-list published-list">${evidence.published.map(fact => `<li>${icon('check')}<span>${fact}</span></li>`).join('')}</ul><h3>Illustrative, not verified</h3><ul class="evidence-list">${evidence.illustrative.map(fact => `<li>${icon('info')}<span>${fact}</span></li>`).join('')}</ul><p class="dialog-caveat">The GPU operation uses explicit copies without overlap or unified memory. Motion is explanatory, not measured traffic or speed. Cluster glyphs represent families; shared-storage access is a logical relationship, not a measured network route.</p><a class="source-link" href="${evidence.hardwareSource}" target="_blank" rel="noopener noreferrer">Official HPC4 specification ${icon('arrow-up-right')}</a><a class="source-link" href="${evidence.storageSource}" target="_blank" rel="noopener noreferrer">Storage policies ${icon('arrow-up-right')}</a><a class="source-link" href="${evidence.handbook}" target="_blank" rel="noopener noreferrer">HPC handbook ${icon('arrow-up-right')}</a></dialog>
  `
}