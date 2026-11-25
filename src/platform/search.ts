import { categories, entries, routeForEntry } from '../catalog.ts'
import { levels } from '../practice/engine/levels/index.ts'
import { weeks } from './curriculum.ts'
import { escapeHtml as esc } from './links.ts'

interface Destination { route: string; title: string; kind: string; words: string }
const destinations: Destination[] = [
  ...['Learn', 'Practice', 'Weeks', 'Atlas'].map(title => ({ route: `#${title.toLowerCase()}`, title, kind: 'Mode', words: '' })),
  ...entries.flatMap(e => {
    const route = routeForEntry(e)
    return route ? [{ route, title: e.title, kind: e.kind === 'scenario' ? 'Learn' : e.kind === 'scene' ? 'Scene' : 'Concept',
      words: `${e.id} ${e.keywords} ${e.summary}` }] : []
  }),
  ...levels.map(m => ({ route: `#practice/${m.id}`, title: m.title, kind: `Practice · Mission ${m.id}`,
    words: `${m.objective} ${m.cards.join(' ')}` })),
  ...weeks.map(w => ({ route: `#weeks/${w.id}`, title: w.title, kind: 'Weeks', words: `${w.id} ${w.quests.map(q => q.title).join(' ')}` })),
  ...categories.map(c => ({ route: `#atlas/${c.id}`, title: c.name, kind: 'Domain', words: c.subtitle })),
]

export function searchDestinations(query: string): Destination[] {
  const words = query.trim().toLowerCase().split(/\s+/)
  return destinations.filter(d => words.every(word => `${d.title} ${d.kind} ${d.words}`.toLowerCase().includes(word)))
}

export function bindSwitcher(dialog: HTMLDialogElement, navigate: (route: string) => void) {
  const input = dialog.querySelector<HTMLInputElement>('#switch-input')!
  const list = dialog.querySelector<HTMLElement>('#switch-list')!
  let selected = 0
  let results: Destination[] = []
  function select(i: number) {
    selected = i
    const options = list.querySelectorAll('[role="option"]')
    options.forEach((el, n) => el.setAttribute('aria-selected', String(i === n)))
    const active = options[i]
    if (active) {
      input.setAttribute('aria-activedescendant', active.id)
      if (dialog.open) active.scrollIntoView({ block: 'nearest' })
    } else input.removeAttribute('aria-activedescendant')
  }
  function toneFor(kind: string) {
    if (kind === 'Learn') return 'blue'
    if (kind.startsWith('Practice')) return 'green'
    if (kind === 'Weeks') return 'amber'
    return 'slate'
  }
  function filter() {
    results = searchDestinations(input.value)
    list.innerHTML = results.map((d, i) => `<a href="${esc(d.route)}" data-result="${i}" data-tone="${toneFor(d.kind)}" id="jump-${i}" role="option" tabindex="-1">
      <small>${esc(d.kind)}</small><span>${esc(d.title)}</span></a>`).join('')
    dialog.querySelector('#switch-count')!.textContent = results.length
      ? `${results.length} destinations · ↑ ↓ to choose, Enter to open` : 'No matches. Try a command, mission or concept.'
    select(0)
  }
  function go(i: number) {
    if (!results[i]) return
    dialog.close()
    navigate(results[i].route)
  }
  input.oninput = filter
  input.onkeydown = e => {
    if (!results.length) return
    if (e.key === 'Enter') { e.preventDefault(); go(selected) }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      select((selected + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length)
    }
  }
  list.onclick = e => {
    const row = (e.target as Element).closest<HTMLAnchorElement>('[data-result]')
    if (!row || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(Number(row.dataset.result))
  }
  dialog.querySelector<HTMLButtonElement>('#close-switcher')!.onclick = () => dialog.close()
  dialog.addEventListener('keydown', event => {
    event.stopPropagation() // A lesson or the Atlas underneath must not consume dialog keys.
    if (event.key === 'Escape') {
      event.preventDefault()
      dialog.close()
    }
  })
  dialog.addEventListener('close', () => { input.value = ''; filter() })
  filter()
}
