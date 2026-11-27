import type { Tone } from '../glyphs.ts'
import { escapeHtml as esc, link } from './links.ts'
import { resourceCollections, resourceReferences, resourceSetup, resourcesRoute, workshopResources } from './resource-catalog.ts'
import type { ResourceEntry, ResourceInfo, ResourcePage } from './resource-catalog.ts'

const formats = [
  ['all', 'All resources'],
  ['recording', 'Recordings'],
  ['summary', 'Summaries & outlines'],
  ['slides', 'Slides & PDFs'],
] as const
type ResourceFilter = typeof formats[number][0]
type DirectoryEntry = ResourceEntry | ResourcePage

function newestFirst(a: ResourceInfo, b: ResourceInfo) {
  return (b.date ?? '').localeCompare(a.date ?? '')
}

const sections: readonly {
  title: string
  tone: Tone
  entries: readonly DirectoryEntry[]
  arrowOnly?: boolean
}[] = [
  { title: 'Start here', tone: 'green', entries: [resourceSetup] },
  { title: 'Workshops & recordings', tone: 'blue', entries: workshopResources.toSorted(newestFirst) },
  { title: 'Shared references', tone: 'slate', entries: [...resourceCollections, ...resourceReferences], arrowOnly: true },
]
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function formatDate(date: string) {
  return dateFormat.format(new Date(date))
}

function renderRow(entry: ResourceInfo, heading: string, actions = '') {
  return `<li><article class="resource-row">
    <div class="resource-info">
      <p class="mode-meta">${esc(entry.source)}${entry.date ? ` · <time datetime="${esc(entry.date)}">${esc(formatDate(entry.date))}</time>` : ''}</p>
      ${heading ? `<h3>${heading}</h3>` : ''}
      <p class="resource-use">${esc(entry.use)}</p>
    </div>
    ${actions ? `<div class="mode-links resource-links">${actions}</div>` : ''}
  </article></li>`
}

function materialLinks(entry: ResourceEntry, arrowOnly = false) {
  return entry.links.map(item =>
    `<a class="mode-link${arrowOnly ? ' resource-icon-link' : ''}" href="${esc(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${item.label}: ${entry.title}`)}">${arrowOnly ? '' : `${esc(item.label)} `}<span aria-hidden="true">↗</span></a>`
  ).join('')
}

function renderDirectoryRow(entry: DirectoryEntry, arrowOnly?: boolean) {
  if ('id' in entry) {
    const href = esc(resourcesRoute(entry.id))
    return renderRow(entry, `<a class="resource-title" data-route="${href}" href="${href}">${esc(entry.title)}</a>`)
  }
  return renderRow(entry, esc(entry.title), materialLinks(entry, arrowOnly))
}

function renderSection(title: string, tone: Tone, rows: readonly string[]) {
  return `<section class="mode-group" data-tone="${tone}">
    <div class="mode-group-head"><span class="group-dot" aria-hidden="true"></span><h2>${esc(title)}</h2></div>
    <ul class="resource-list">${rows.join('')}</ul>
  </section>`
}

function searchText(entry: ResourceInfo) {
  return [entry.title, entry.source, entry.use, ...(entry.topics ?? []),
    ...(entry.date ? [entry.date, formatDate(entry.date)] : []),
  ].join(' ')
}

function matchesEntry(entry: ResourceEntry, filter: ResourceFilter, words: readonly string[], group = '') {
  if (filter !== 'all' && !entry.links.some(item => item.format === filter)) return false
  if (!words.length) return true
  const searchable = [
    group, searchText(entry),
    ...entry.links.map(item => `${item.format} ${item.label}`),
  ].join(' ').toLowerCase()
  return words.every(word => searchable.includes(word))
}

export function renderResourceResults(filter: ResourceFilter, query = '') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  let count = 0
  const html = sections.map(({ title, tone, entries, arrowOnly }) => {
    const matches = entries.filter(entry => 'courses' in entry
      ? entry.courses.some(course => matchesEntry(course, filter, words, searchText(entry)))
      : matchesEntry(entry, filter, words))
    count += matches.length
    return matches.length ? renderSection(title, tone, matches.map(entry => renderDirectoryRow(entry, arrowOnly))) : ''
  }).join('')
  return {
    html: html || '<p class="mode-intro">No matching resources. Try a different search or clear the filters.</p>',
    status: `${count} ${count === 1 ? 'entry' : 'entries'}`,
  }
}

export function renderWorkshopMaterialsLink(weekId: string) {
  const workshop = workshopResources.find(item => item.weekId === weekId)
  return workshop ? link(resourcesRoute(workshop.id), 'Workshop materials') : ''
}

export function renderResourcePage(page: ResourcePage) {
  const back = `<nav aria-label="Resource navigation">${link(resourcesRoute(), '← Back to directory')}</nav>`
  if ('courses' in page) {
    const rows = page.courses.toSorted(newestFirst).map(course => renderRow(course, esc(course.title), materialLinks(course)))
    return `${back}${renderSection('Courses', 'slate', rows)}`
  }
  const follow = page.weekId ? link(`#weeks/${page.weekId}`, 'Follow in Weeks') : ''
  return `${back}${renderSection('Workshop materials', 'blue', [renderRow(page, '', materialLinks(page) + follow)])}`
}

let archiveFilter: ResourceFilter = 'all'
let archiveQuery = ''

export function showResources(host: HTMLElement, page?: ResourcePage) {
  if (page) {
    host.innerHTML = renderResourcePage(page)
    return
  }
  const initial = renderResourceResults(archiveFilter, archiveQuery)
  host.innerHTML = `<p class="mode-intro">Open a workshop or collection title for its materials.</p>
    <div class="resource-toolbar">
      <label class="atlas-search-wrap resource-search"><span>Search resources</span>
        <input type="search" id="resource-search" placeholder="Title, date, or topic" autocomplete="off">
      </label>
      <div class="segmented-pills" role="group" aria-label="Filter resources by format">
        ${formats.map(([format, label]) => `<button type="button" data-resource-format="${format}" aria-pressed="${format === archiveFilter}">${esc(label)}</button>`).join('')}
      </div>
      <button class="mode-link" type="button" id="resource-reset">Clear filters</button>
      <span class="mode-meta" role="status" id="resource-count">${initial.status}</span>
    </div>
    <div id="resource-results">${initial.html}</div>`

  const search = host.querySelector<HTMLInputElement>('#resource-search')!
  const results = host.querySelector('#resource-results')!
  const count = host.querySelector('#resource-count')!
  const buttons = formats.map(([format]) => ({
    format, button: host.querySelector<HTMLButtonElement>(`[data-resource-format="${format}"]`)!,
  }))
  const refresh = () => {
    const next = renderResourceResults(archiveFilter, archiveQuery)
    for (const { format, button } of buttons) button.setAttribute('aria-pressed', String(format === archiveFilter))
    results.innerHTML = next.html
    count.textContent = next.status
  }
  search.value = archiveQuery
  search.oninput = () => {
    archiveQuery = search.value
    refresh()
  }
  for (const { format, button } of buttons) {
    button.onclick = () => {
      if (format === archiveFilter) return
      archiveFilter = format
      refresh()
    }
  }
  host.querySelector<HTMLButtonElement>('#resource-reset')!.onclick = () => {
    archiveFilter = 'all'
    archiveQuery = search.value = ''
    refresh()
    search.focus()
  }
}
