import { categories, entries, filterEntries, getEntry, routeForEntry, routeForTarget } from '../catalog.ts'
import type { EntryDef, LessonId, ParsedRoute } from '../catalog.ts'
import { renderGlyph } from '../glyphs.ts'
import { clusterTopics, topics } from '../model.ts'
import { Game } from '../practice/engine/game.ts'
import { levels } from '../practice/engine/levels/index.ts'
import { progressStore } from '../practice/engine/storage.ts'
import { PracticeDesk } from '../practice/workstation.ts'
import { codex, conceptForAward } from './codex.ts'
import { weeks } from './curriculum.ts'
import type { WorkshopWeek } from './curriculum.ts'
import { conceptNeighbors, conceptsForLesson, escapeHtml as esc, lessonLinks, link } from './links.ts'
import { browserStorage } from './progress.ts'
import type { LearningProgress } from './progress.ts'
import { getWorkshopResource } from './resource-catalog.ts'
import { renderWorkshopMaterialsLink, showResources } from './resources.ts'

type Page = Extract<ParsedRoute, { view: 'learn' | 'practice' | 'weeks' | 'concept' | 'resources' }>
let practice: PracticeDesk | undefined
function desk() { return practice ??= new PracticeDesk(new Game(browserStorage())) }

export function completedPracticeMissions(): readonly number[] {
  return practice
    ? [...practice.game.store.state.completed]
    : progressStore(browserStorage()).state.completed
}

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

export function renderConceptSheet(e: EntryDef, practicedCards: readonly string[] = []) {
  const card = Object.hasOwn(codex, e.id) ? codex[e.id] : undefined
  const target = e.target
  const subject = target.type !== 'scene' ? undefined : target.scene === 'cluster'
    ? clusterTopics[target.clusterTopic ?? 'a30'] : topics[target.nodeTopic ?? 'gpu']
  const practiced = Boolean(card && practicedCards.some(key => conceptForAward(key) === e.id))
  const neighbors = conceptNeighbors(e.id)
  const navStrip = (position: 'top' | 'bottom') => {
    const prevRoute = neighbors.prev ? routeForEntry(neighbors.prev)! : null
    const nextRoute = neighbors.next ? routeForEntry(neighbors.next)! : null
    return `<nav class="concept-nav-strip is-${position}" data-concept-nav="${position}" aria-label="${position === 'top' ? 'Concept navigation' : 'Next and previous concepts'}">
      <div class="concept-nav-back">
        <a class="mode-link concept-all-link" data-concept-all data-route="#atlas" href="#atlas">← All Atlas entries</a>
        <a class="mode-link concept-domain-link" data-concept-domain data-route="#atlas/${esc(neighbors.category.id)}" href="#atlas/${esc(neighbors.category.id)}">${esc(neighbors.category.shortName)} · ${neighbors.index} / ${neighbors.total}</a>
      </div>
      <div class="concept-nav-pager">
        ${neighbors.prev && prevRoute ? `<a class="mode-link concept-prev-link" data-concept-prev data-route="${esc(prevRoute)}" href="${esc(prevRoute)}">← Previous: ${esc(neighbors.prev.shortTitle)}</a>` : ''}
        ${neighbors.next && nextRoute ? `<a class="mode-link concept-next-link is-primary-link" data-concept-next data-route="${esc(nextRoute)}" href="${esc(nextRoute)}">Next: ${esc(neighbors.next.shortTitle)} →</a>` : ''}
      </div>
    </nav>`
  }
  const block = (heading: string, text: string) => `<section class="mode-panel"><h2>${heading}</h2><p>${esc(text)}</p></section>`
  const related = [
    ...(target.type === 'scene' ? [link(routeForTarget(target)!, `Inspect in ${target.scene === 'a30' ? 'A30 cutaway' : 'cluster scene'}`)] : []),
    ...entries.filter(s => s.kind === 'scenario' && conceptsForLesson(s.id as LessonId).includes(e.id)).map(s => link(routeForTarget(s.target)!, `Learn · ${s.title}`)),
    ...levels.filter(m => m.cards.some(key => conceptForAward(key) === e.id)).map(m => link(`#practice/${m.id}`, `Practice · ${m.title}`)),
    ...weeks.filter(w => w.concepts.includes(e.id)).map(w => link(`#weeks/${w.id}`, w.title)),
  ]
  return `<article class="concept-sheet" data-tone="${e.tone}">
    ${navStrip('top')}
    <div class="concept-cover"><span class="sheet-glyph">${renderGlyph(e.glyph)}</span><div>
      <div class="mode-card-top"><span class="mode-meta">Permanent reference · ${esc(e.evidenceBasis)}</span>${practiced ? '<span class="status-pill is-done">Practiced ✓</span>' : ''}</div>
      <p>${esc(subject?.description ?? e.summary)}</p><small>${esc(e.evidenceLabel)}</small>
    </div></div>
    ${block('Why it matters', subject?.takeaway ?? card!.takeaway)}
    ${card ? block('Look it up in the CLI', card.lookup) + block('When reviewing a suggested command', card.review) : ''}
    ${related.length ? `<section class="mode-panel"><h2>Use this concept</h2><nav class="mode-links">${related.join('')}</nav></section>` : ''}
    ${navStrip('bottom')}
  </article>`
}

type WeekStageNum = '01' | '02' | '03' | '04'

function computeWeekProgression(
  w: WorkshopWeek,
  progress: LearningProgress,
  gameInstance: Pick<Game, 'isComplete' | 'isUnlocked' | 'store'>,
) {
  const lessonsDone = w.lessons.filter(lid => progress.lessons.get(lid)?.completed).length
  const missionsDone = w.missions.filter(mid => gameInstance.isComplete(mid)).length
  const questsDone = w.quests.filter(q => progress.checked.has(`${w.id}/${q.id}`)).length
  const practicedSet = new Set(gameInstance.store.state.cards.map(conceptForAward))
  const conceptsPracticed = w.concepts.filter(cid => practicedSet.has(cid)).length

  const nextLessonId = w.lessons.find(lid => !progress.lessons.get(lid)?.completed)
  const nextMissionId = w.missions.find(mid => !gameInstance.isComplete(mid) && gameInstance.isUnlocked(mid))
    ?? w.missions.find(mid => !gameInstance.isComplete(mid))
  const activeStage: WeekStageNum = nextLessonId
    ? '01'
    : nextMissionId
      ? '02'
      : questsDone < w.quests.length
        ? '03'
        : '04'

  const recommended = (() => {
    if (nextLessonId) {
      const entry = getEntry(nextLessonId)!
      const saved = progress.lessons.get(nextLessonId)
      const verb = saved && saved.beat > 0 ? 'Continue' : 'Start'
      return {
        route: routeForEntry(entry)!,
        label: `${verb} 01 / Learn: ${entry.shortTitle} →`,
        external: false,
      }
    }
    if (nextMissionId) {
      const m = levels.find(item => item.id === nextMissionId)!
      return {
        route: `#practice/${m.id}`,
        label: `Continue 02 / Practice: Mission ${m.id} (${m.title}) →`,
        external: false,
      }
    }
    if (questsDone < w.quests.length) {
      const nextQuest = w.quests.find(q => !progress.checked.has(`${w.id}/${q.id}`))!
      return {
        route: `${w.source}#${nextQuest.anchor}`,
        label: `03 / Field quest: ${nextQuest.title} ↗`,
        external: true,
      }
    }
    const firstConcept = getEntry(w.concepts[0]!)!
    return {
      route: routeForEntry(firstConcept)!,
      label: `Review 04 / Atlas: ${firstConcept.shortTitle} →`,
      external: false,
    }
  })()

  const stages = [
    { num: '01' as const, name: 'Learn', count: `${lessonsDone}/${w.lessons.length}`, done: lessonsDone === w.lessons.length },
    { num: '02' as const, name: 'Practice', count: `${missionsDone}/${w.missions.length}`, done: missionsDone === w.missions.length },
    { num: '03' as const, name: 'Field quests', count: `${questsDone}/${w.quests.length}`, done: questsDone === w.quests.length },
    { num: '04' as const, name: 'Atlas', count: `${conceptsPracticed}/${w.concepts.length}`, done: conceptsPracticed === w.concepts.length },
  ] as const

  return {
    lessonsDone,
    missionsDone,
    questsDone,
    practicedSet,
    conceptsPracticed,
    nextLessonId,
    nextMissionId,
    activeStage,
    recommended,
    stages,
  }
}

function renderWeekNextAction(recommended: { route: string; label: string; external: boolean }): string {
  return recommended.external
    ? `<a class="mode-link is-primary-link" data-week-next href="${esc(recommended.route)}" target="_blank" rel="noopener noreferrer">${esc(recommended.label)}</a>`
    : `<a class="mode-link is-primary-link" data-week-next data-route="${esc(recommended.route)}" href="${esc(recommended.route)}">${esc(recommended.label)}</a>`
}

export function renderWeekView(
  id: string | undefined,
  progress: LearningProgress,
  gameInstance: Pick<Game, 'isComplete' | 'isUnlocked' | 'store'>,
) {
  if (!id) {
    return `<p class="mode-intro">The visual guide and browser drills accompany the weekly workshops. Field instructions and submissions stay in the workshop repository.</p>
    <div class="mode-grid">${weeks.map(w => {
      const lDone = w.lessons.filter(lid => progress.lessons.get(lid)?.completed).length
      const mDone = w.missions.filter(mid => gameInstance.isComplete(mid)).length
      const qDone = w.quests.filter(q => progress.checked.has(`${w.id}/${q.id}`)).length
      return `<article class="mode-card" data-tone="amber"><div class="mode-card-top"><span class="mode-meta">Workshop · 01 → 04 flow</span><span class="status-pill${lDone === w.lessons.length && mDone === w.missions.length && qDone === w.quests.length ? ' is-done' : ''}">${lDone}/${w.lessons.length} learn · ${mDone}/${w.missions.length} practice · ${qDone}/${w.quests.length} quests</span></div>
      <h2>${link(`#weeks/${w.id}`, w.title)}</h2><p>${esc(w.description)}</p></article>`
    }).join('')}</div>
    <p class="mode-note">Future topics: software &amp; Slurm, then GPU execution &amp; profiling. No field briefs are published here yet for these topics.</p>`
  }

  const w = weeks.find(w => w.id === id)!
  const {
    lessonsDone,
    missionsDone,
    questsDone,
    practicedSet,
    conceptsPracticed,
    nextLessonId,
    nextMissionId,
    activeStage,
    recommended,
    stages,
  } = computeWeekProgression(w, progress, gameInstance)

  return `<nav class="week-top-bar" aria-label="Workshop navigation">
      <div class="week-navigation-links">
        <a class="mode-link" data-route="#weeks" href="#weeks">← All weeks</a>
        ${renderWorkshopMaterialsLink(w.id)}
      </div>
      <div class="week-recommended">
        <span class="week-rec-label">Recommended next</span>
        ${renderWeekNextAction(recommended)}
      </div>
    </nav>
    <p class="mode-intro">${esc(w.description)}</p>
    <div class="week-stepper" data-week-stepper aria-label="Recommended 01 to 04 workshop progression">
      ${stages.map((st, idx) => `
        <div class="week-step-pill${st.done ? ' is-done' : ''}${activeStage === st.num ? ' is-current' : ''}" data-week-stage="${st.num}">
          <span class="week-step-num">${st.num}</span>
          <span class="week-step-name">${st.name}</span>
          <span class="week-step-count" data-stage-count="${st.num}">${st.done ? `${st.count} ✓` : st.count}</span>
        </div>
        ${idx < stages.length - 1 ? '<span class="week-step-arrow" aria-hidden="true">→</span>' : ''}
      `).join('')}
    </div>
    <section class="mode-panel step-panel${activeStage === '01' ? ' is-recommended-stage' : ''}" data-week-panel="01" data-tone="blue">
      <div class="mode-card-top"><span class="step-kicker">01 / Learn</span><span class="status-pill${lessonsDone === w.lessons.length ? ' is-done' : ''}">${lessonsDone} / ${w.lessons.length} completed</span></div>
      <h2>See what the commands do</h2>
      <div class="week-item-list">${w.lessons.map(lid => {
        const entry = getEntry(lid)!
        const route = routeForEntry(entry)!
        const saved = progress.lessons.get(lid)
        const done = Boolean(saved?.completed)
        const started = Boolean(saved && !saved.completed && saved.beat > 0)
        const isNext = lid === nextLessonId
        const badgeText = done
          ? 'Completed ✓'
          : started
            ? `Step ${saved!.beat + 1}/${saved!.total}`
            : isNext
              ? 'Next up →'
              : 'Walkthrough'
        return `<a class="mode-link week-item-link${done ? ' is-done' : isNext ? ' is-next-up' : ''}" data-week-lesson="${esc(lid)}" data-status="${done ? 'complete' : started ? 'in-progress' : isNext ? 'next' : 'pending'}" data-route="${esc(route)}" href="${esc(route)}">
          <span class="week-item-title">${esc(entry.title)}</span>
          <span class="status-pill${done ? ' is-done' : isNext ? ' is-next' : ''}">${badgeText}</span>
        </a>`
      }).join('')}</div>
    </section>
    <section class="mode-panel step-panel${activeStage === '02' ? ' is-recommended-stage' : ''}" data-week-panel="02" data-tone="green">
      <div class="mode-card-top"><span class="step-kicker">02 / Practice</span><span class="status-pill${missionsDone === w.missions.length ? ' is-done' : ''}">${missionsDone} / ${w.missions.length} completed</span></div>
      <h2>Rehearse in the browser</h2>
      <div class="week-item-list">${w.missions.map(mid => {
        const m = levels.find(item => item.id === mid)!
        const done = gameInstance.isComplete(mid)
        const unlocked = gameInstance.isUnlocked(mid)
        const isNext = !nextLessonId && mid === nextMissionId && unlocked
        const badgeText = done
          ? 'Complete ✓'
          : isNext
            ? 'Next up →'
            : unlocked
              ? 'Available'
              : 'Locked'
        return `<a class="mode-link week-item-link${done ? ' is-done' : isNext ? ' is-next-up' : !unlocked ? ' is-locked-link' : ''}" data-week-mission="${mid}" data-status="${done ? 'complete' : isNext ? 'next' : unlocked ? 'available' : 'locked'}" data-route="#practice/${mid}" href="#practice/${mid}">
          <span class="week-item-title">${mid}. ${esc(m.title)}</span>
          <span class="status-pill${done ? ' is-done' : !unlocked ? ' is-locked' : isNext ? ' is-next' : ''}">${badgeText}</span>
        </a>`
      }).join('')}</div>
    </section>
    <section class="mode-panel step-panel${activeStage === '03' ? ' is-recommended-stage' : ''}" data-week-panel="03" data-tone="amber"><div class="mode-card-top"><span class="step-kicker">03 / Field quests</span><span id="week-count" class="status-pill${questsDone === w.quests.length ? ' is-done' : ''}" role="status">${questsDone} / ${w.quests.length} marked done</span></div><h2>On the training server</h2>
    <p>Use the <a href="${w.source}" class="external-brief">official workshop brief</a> for connection details, host keys and submission rules. These checkboxes are your own notes, not graded submissions.</p>
    ${w.quests.map(q => {
      const key = `${w.id}/${q.id}`
      const checked = progress.checked.has(key)
      return `<div class="field-quest${checked ? ' is-done' : ''}"><label><input type="checkbox" data-quest="${key}" ${checked ? 'checked' : ''}> ${esc(q.title)}</label>
        <p>${esc(q.detail)}</p><div class="field-example"><code>${esc(q.example)}</code><button type="button" data-copy>Copy example</button></div>
        <a class="external-brief" href="${w.source}#${q.anchor}">Field instructions ↗</a></div>`
    }).join('')}<div role="status" id="copy-status"></div></section>
    <section class="mode-panel step-panel${activeStage === '04' ? ' is-recommended-stage' : ''}" data-week-panel="04" data-tone="slate">
      <div class="mode-card-top"><span class="step-kicker">04 / Atlas</span><span class="status-pill${conceptsPracticed === w.concepts.length ? ' is-done' : ''}">${conceptsPracticed} / ${w.concepts.length} practiced</span></div>
      <h2>Keep for reference</h2>
      <div class="week-item-list">${w.concepts.map(cid => {
        const entry = getEntry(cid)!
        const route = routeForEntry(entry)!
        const practiced = practicedSet.has(cid)
        return `<a class="mode-link week-item-link${practiced ? ' is-done' : ''}" data-week-concept="${esc(cid)}" data-route="${esc(route)}" href="${esc(route)}">
          <span class="week-item-title">${esc(entry.shortTitle)}</span>
          <span class="status-pill${practiced ? ' is-done' : ''}">${practiced ? 'Practiced ✓' : 'Reference'}</span>
        </a>`
      }).join('')}</div>
    </section>`
}

export function showPage(host: HTMLElement, route: Page, progress: LearningProgress) {
  if (route.view === 'resources') {
    showResources(host, route.workshop ? getWorkshopResource(route.workshop)! : undefined)
    return
  }
  const d = desk()
  d.game.setUnlockAll(progress.unlockAllMissions)
  if (route.view === 'practice') {
    host.replaceChildren(d.view(route.mission, enabled => progress.setUnlockAllMissions(enabled)))
    return
  }
  host.innerHTML = route.view === 'learn'
    ? learn(progress)
    : route.view === 'concept'
      ? renderConceptSheet(getEntry(route.id)!, d.game.store.state.cards)
      : renderWeekView(route.week, progress, d.game)
  if (route.view !== 'weeks' || !route.week) return
  const week = weeks.find(w => w.id === route.week)!
  const checks = [...host.querySelectorAll<HTMLInputElement>('[data-quest]')]
  for (const box of checks) box.onchange = () => {
    progress.checkQuest(box.dataset.quest!, box.checked)
    box.closest('.field-quest')?.classList.toggle('is-done', box.checked)
    const state = computeWeekProgression(week, progress, d.game)
    const countEl = host.querySelector('#week-count')!
    countEl.textContent = `${state.questsDone} / ${week.quests.length} marked done`
    countEl.classList.toggle('is-done', state.questsDone === week.quests.length)

    for (const st of state.stages) {
      const pill = host.querySelector<HTMLElement>(`[data-week-stage="${st.num}"]`)
      if (pill) {
        pill.classList.toggle('is-done', st.done)
        pill.classList.toggle('is-current', state.activeStage === st.num)
      }
      const stageCount = host.querySelector(`[data-stage-count="${st.num}"]`)
      if (stageCount) stageCount.textContent = st.done ? `${st.count} ✓` : st.count
      const panelEl = host.querySelector<HTMLElement>(`[data-week-panel="${st.num}"]`)
      if (panelEl) panelEl.classList.toggle('is-recommended-stage', state.activeStage === st.num)
    }

    const nextLink = host.querySelector<HTMLAnchorElement>('[data-week-next]')
    if (nextLink) {
      nextLink.href = state.recommended.route
      nextLink.textContent = state.recommended.label
      if (state.recommended.external) {
        nextLink.removeAttribute('data-route')
        nextLink.target = '_blank'
        nextLink.rel = 'noopener noreferrer'
      } else {
        nextLink.dataset.route = state.recommended.route
        nextLink.removeAttribute('target')
        nextLink.removeAttribute('rel')
      }
    }
  }
  for (const btn of host.querySelectorAll<HTMLButtonElement>('[data-copy]')) btn.onclick = async () => {
    const status = host.querySelector('#copy-status')!
    try {
      await navigator.clipboard.writeText(btn.previousElementSibling!.textContent!)
      status.textContent = 'Example copied.'
    } catch { status.textContent = 'Clipboard unavailable. Select the example and copy it manually.' }
  }
}
