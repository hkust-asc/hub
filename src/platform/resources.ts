import type { Tone } from '../glyphs.ts'
import { escapeHtml as esc, link } from './links.ts'
import { resourceReferences, resourceSetup, resourcesRoute, workshopResources } from './resource-catalog.ts'
import type { ResourceEntry, WorkshopResource } from './resource-catalog.ts'

const formats = [
  ['all', 'All resources'],
  ['recording', 'Recordings'],
  ['summary', 'Summaries & outlines'],
  ['slides', 'Slides & PDFs'],
] as const
type ResourceFilter = typeof formats[number][0]
type DirectoryEntry = ResourceEntry | WorkshopResource

const sections: readonly {
  title: string
  tone: Tone
  entries: readonly DirectoryEntry[]
}[] = [
  { title: 'Start here', tone: 'green', entries: [resourceSetup] },
  { title: 'Workshops & recordings', tone: 'blue', entries: workshopResources.toSorted((a, b) => (b.date ?? '').localeCompare(a.date ?? '')) },
  { title: 'Shared references', tone: 'slate', entries: resourceReferences },
]
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function formatDate(date: string) {
  return dateFormat.format(new Date(date))
}

function renderRow(entry: DirectoryEntry, focused: boolean) {
  const workshop = 'id' in entry ? entry : undefined
  const title = esc(entry.title)
  const href = workshop ? resourcesRoute(workshop.id) : undefined
  return `<li><article class="resource-row">
    <div class="resource-info">
      <p class="mode-meta">${esc(entry.source)}${workshop?.date ? ` · <time datetime="${esc(workshop.date)}">${esc(formatDate(workshop.date))}</time>` : ''}</p>
      ${focused ? '' : `<h3>${href ? `<a class="resource-title" data-route="${esc(href)}" href="${esc(href)}">${title}</a>` : title}</h3>`}
      <p class="resource-use">${esc(entry.use)}</p>
    </div>
    <div class="mode-links resource-links">${entry.links.map(item =>
      `<a class="mode-link" href="${esc(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${item.label}: ${entry.title}`)}">${esc(item.label)} <span aria-hidden="true">↗</span></a>`
    ).join('')}${workshop?.weekId ? link(`#weeks/${workshop.weekId}`, 'Follow in Weeks') : ''}</div>
  </article></li>`
}

function renderSection(title: string, tone: Tone, entries: readonly DirectoryEntry[], focused = false) {
  return `<section class="mode-group" data-tone="${tone}">
    <div class="mode-group-head"><span class="group-dot" aria-hidden="true"></span><h2>${esc(title)}</h2></div>
    <ul class="resource-list">${entries.map(entry => renderRow(entry, focused)).join('')}</ul>
  </section>`
}

export function renderResourceResults(filter: ResourceFilter, query = '') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  let count = 0
  const html = sections.map(({ title, tone, entries }) => {
    const matches = entries.filter(entry => {
      if (filter !== 'all' && !entry.links.some(item => item.format === filter)) return false
      if (!words.length) return true
      const date = 'id' in entry ? entry.date : undefined
      const searchable = [
        entry.title, entry.source, entry.use, ...(entry.topics ?? []),
        ...(date ? [date, formatDate(date)] : []),
        ...entry.links.map(item => `${item.format} ${item.label}`),
      ].join(' ').toLowerCase()
      return words.every(word => searchable.includes(word))
    })
    count += matches.length
    return matches.length ? renderSection(title, tone, matches) : ''
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

export function renderWorkshopResources(workshop: WorkshopResource) {
  return `<nav aria-label="Resource navigation">${link(resourcesRoute(), '← Back to directory')}</nav>
    ${renderSection('Workshop materials', 'blue', [workshop], true)}`
}

let archiveFilter: ResourceFilter = 'all'
let archiveQuery = ''

export function showResources(host: HTMLElement, workshop?: WorkshopResource) {
  if (workshop) {
    host.innerHTML = renderWorkshopResources(workshop)
    return
  }
  const initial = renderResourceResults(archiveFilter, archiveQuery)
  host.innerHTML = `<p class="mode-intro">Find public workshop recordings, summaries, slides, and setup guides. External links open in a new tab.</p>
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
    <div id="resource-results">${initial.html}</div>
    <section class="mode-panel step-panel" data-tone="amber" aria-labelledby="resource-end">
      <h2 id="resource-end">End of the directory</h2>
      <p>Only public links are listed. Team-only recordings and notes stay in member channels.</p>
    </section>`

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
