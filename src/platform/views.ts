import { categories, entries, filterEntries, getEntry, routeForTarget } from '../catalog.ts'
import type { EntryDef, LessonId } from '../catalog.ts'
import { renderGlyph } from '../glyphs.ts'
import { clusterTopics, topics } from '../model.ts'
import { Game } from '../practice/engine/game.ts'
import { levels } from '../practice/engine/levels/index.ts'
import { PracticeDesk } from '../practice/workstation.ts'
import { codex, conceptForAward } from './codex.ts'
import { weeks } from './curriculum.ts'
import { conceptsForLesson, entryLink, escapeHtml as esc, lessonLinks, link } from './links.ts'
import { browserStorage } from './progress.ts'
import type { LearningProgress } from './progress.ts'
import type { ParsedRoute } from '../catalog.ts'

type Page = Extract<ParsedRoute, { view: 'learn' | 'practice' | 'weeks' | 'concept' }>
let practice: PracticeDesk | undefined
function desk() { return practice ??= new PracticeDesk(new Game(browserStorage())) }

function learn(progress: LearningProgress) {
  const groups = [...categories].sort((a, b) => Number(b.id === 'linux') - Number(a.id === 'linux'))
  return `<p class="mode-intro">Start with a question. Follow a visual scenario, pause to inspect what changed, then try the mechanism yourself.</p>` +
    groups.map(cat => {
      const lessons = entries.filter(e => e.category === cat.id && e.kind === 'scenario')
      if (!lessons.length) return ''
      return `<section class="mode-group" data-tone="${cat.tone}"><div class="mode-group-head"><span class="group-dot" aria-hidden="true"></span><h2>${esc(cat.shortName)}</h2></div><div class="mode-grid">${lessons.map(e => {
        const id = e.id as LessonId
        const saved = progress.lessons.get(id)
        const status = saved
          ? `<span class="status-pill${saved.completed ? ' is-done' : ''}">${saved.completed ? 'Completed ✓' : `Step ${saved.beat + 1}`}</span>`
          : ''
        return `<article class="mode-card" data-tone="${e.tone}"${saved?.completed ? ' data-status="complete"' : ''}>
          <div class="mode-card-top"><span class="mode-meta">${esc(e.formatLabel)}</span>${status}</div>
          <h3>${link(routeForTarget(e.target)!, e.title)}</h3><p>${esc(e.question)}</p>${lessonLinks(id)}</article>`
      }).join('')}</div></section>`
    }).join('') + `<details class="mode-panel" data-tone="slate"><summary>Planned walkthroughs</summary><ul>${filterEntries({ kind: 'scenario' })
      .filter(e => e.kind === 'planned').map(e => `<li>${esc(e.title)}</li>`).join('')}</ul></details>`
}

function concept(e: EntryDef) {
  const card = Object.hasOwn(codex, e.id) ? codex[e.id] : undefined
  const target = e.target
  const subject = target.type !== 'scene' ? undefined : target.scene === 'cluster'
    ? clusterTopics[target.clusterTopic ?? 'a30'] : topics[target.nodeTopic ?? 'gpu']
  const practiced = card && desk().game.store.state.cards.some(key => conceptForAward(key) === e.id)
  const block = (heading: string, text: string) => `<section class="mode-panel"><h2>${heading}</h2><p>${esc(text)}</p></section>`
  const related = [
    ...(target.type === 'scene' ? [link(routeForTarget(target)!, `Inspect in ${target.scene === 'a30' ? 'A30 cutaway' : 'cluster scene'}`)] : []),
    ...entries.filter(s => s.kind === 'scenario' && conceptsForLesson(s.id as LessonId).includes(e.id)).map(s => link(routeForTarget(s.target)!, `Learn · ${s.title}`)),
    ...levels.filter(m => m.cards.some(key => conceptForAward(key) === e.id)).map(m => link(`#practice/${m.id}`, `Practice · ${m.title}`)),
    ...weeks.filter(w => w.concepts.includes(e.id)).map(w => link(`#weeks/${w.id}`, w.title)),
  ]
  return `<article class="concept-sheet" data-tone="${e.tone}">
    <div class="concept-cover"><span class="sheet-glyph">${renderGlyph(e.glyph)}</span><div>
      <div class="mode-card-top"><span class="mode-meta">Permanent reference · ${esc(e.evidenceBasis)}</span>${practiced ? '<span class="status-pill is-done">Practiced ✓</span>' : ''}</div>
      <p>${esc(subject?.description ?? e.summary)}</p><small>${esc(e.evidenceLabel)}</small>
    </div></div>
    ${block('Why it matters', subject?.takeaway ?? card!.takeaway)}
    ${card ? block('Look it up in the CLI', card.lookup) + block('When reviewing a suggested command', card.review) : ''}
    ${related.length ? `<section class="mode-panel"><h2>Use this concept</h2><nav class="mode-links">${related.join('')}</nav></section>` : ''}
  </article>`
}

function weekView(id: string | undefined, progress: LearningProgress) {
  if (!id) return `<p class="mode-intro">The visual guide and browser drills accompany the weekly workshops. Field instructions and submissions stay in the workshop repository.</p>
    <div class="mode-grid">${weeks.map(w => `<article class="mode-card" data-tone="amber"><div class="mode-card-top"><span class="mode-meta">Workshop · ${w.quests.length} field quests</span><span class="status-pill">${w.missions.length} drills</span></div>
    <h2>${link(`#weeks/${w.id}`, w.title)}</h2><p>${esc(w.description)}</p></article>`).join('')}</div>
    <p class="mode-note">Future topics: software &amp; Slurm, then GPU execution &amp; profiling. No field briefs are published here yet for these topics.</p>`
  const w = weeks.find(w => w.id === id)!
  const n = w.quests.filter(q => progress.checked.has(`${w.id}/${q.id}`)).length
  return `<p class="mode-intro">${esc(w.description)}</p>
    <section class="mode-panel step-panel" data-tone="blue"><span class="step-kicker">01 / Learn</span><h2>See what the commands do</h2><div class="mode-links">${w.lessons.map(entryLink).join('')}</div></section>
    <section class="mode-panel step-panel" data-tone="green"><span class="step-kicker">02 / Practice</span><h2>Rehearse in the browser</h2><div class="mode-links">${w.missions.map(id => {
      const m = levels.find(m => m.id === id)!
      return link(`#practice/${id}`, `${id}. ${m.title}`)
    }).join('')}</div></section>
    <section class="mode-panel step-panel" data-tone="amber"><div class="mode-card-top"><span class="step-kicker">03 / Field quests</span><span id="week-count" class="status-pill${n === w.quests.length ? ' is-done' : ''}" role="status">${n} / ${w.quests.length} marked done</span></div><h2>On the training server</h2>
    <p>Use the <a href="${w.source}" class="external-brief">official workshop brief</a> for connection details, host keys and submission rules. These checkboxes are your own notes, not graded submissions.</p>
    ${w.quests.map(q => {
      const key = `${w.id}/${q.id}`
      const checked = progress.checked.has(key)
      return `<div class="field-quest${checked ? ' is-done' : ''}"><label><input type="checkbox" data-quest="${key}" ${checked ? 'checked' : ''}> ${esc(q.title)}</label>
        <p>${esc(q.detail)}</p><div class="field-example"><code>${esc(q.example)}</code><button type="button" data-copy>Copy example</button></div>
        <a class="external-brief" href="${w.source}#${q.anchor}">Field instructions ↗</a></div>`
    }).join('')}<div role="status" id="copy-status"></div></section>
    <section class="mode-panel step-panel" data-tone="slate"><span class="step-kicker">04 / Atlas</span><h2>Keep for reference</h2><div class="mode-links">${w.concepts.map(entryLink).join('')}</div></section>`
}

export function showPage(host: HTMLElement, route: Page, progress: LearningProgress) {
  if (route.view === 'practice') {
    const d = desk()
    d.game.setUnlockAll(progress.unlockAllMissions)
    host.replaceChildren(d.view(route.mission, enabled => progress.setUnlockAllMissions(enabled)))
    return
  }
  host.innerHTML = route.view === 'learn' ? learn(progress) : route.view === 'concept' ? concept(getEntry(route.id)!) : weekView(route.week, progress)
  if (route.view !== 'weeks' || !route.week) return
  const checks = [...host.querySelectorAll<HTMLInputElement>('[data-quest]')]
  for (const box of checks) box.onchange = () => {
    progress.checkQuest(box.dataset.quest!, box.checked)
    box.closest('.field-quest')?.classList.toggle('is-done', box.checked)
    const doneCount = checks.filter(b => b.checked).length
    const countEl = host.querySelector('#week-count')!
    countEl.textContent = `${doneCount} / ${checks.length} marked done`
    countEl.classList.toggle('is-done', doneCount === checks.length)
  }
  for (const btn of host.querySelectorAll<HTMLButtonElement>('[data-copy]')) btn.onclick = async () => {
    const status = host.querySelector('#copy-status')!
    try {
      await navigator.clipboard.writeText(btn.previousElementSibling!.textContent!)
      status.textContent = 'Example copied.'
    } catch { status.textContent = 'Clipboard unavailable. Select the example and copy it manually.' }
  }
}
