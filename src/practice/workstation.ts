import type { Game } from './engine/game.ts'
import type { Level } from './engine/levels/index.ts'
import { getEntry } from '../catalog.ts'
import { tokenize, xray } from './engine/shell.ts'
import { conceptForAward } from '../platform/codex.ts'
import { missionLessons, practiceGroups, weeks } from '../platform/curriculum.ts'
import { entryLink, escapeHtml as esc, link } from '../platform/links.ts'
import { stateView, stateViews } from './state-view.ts'
import type { Run, StateView } from './state-view.ts'

const missionStarters: Readonly<Record<number, readonly string[]>> = {
  1: ['ls', 'tldr ls'],
  2: ['ls -l ~/downloads', 'tldr chmod'],
  3: ['./sensor_dump', 'tldr grep'],
  4: ['echo "$PATH"', 'tldr which'],
  5: ['lscpu', 'ps aux'],
  6: ['pwd', 'ls'],
}

export function starterCommandsForMission(id: number): readonly string[] {
  return missionStarters[id] ?? ['ls', 'pwd']
}

export interface MissionNavState {
  readonly prev: { readonly id: number; readonly title: string; readonly route: string } | null
  readonly next: {
    readonly id: number
    readonly title: string
    readonly route: string
    readonly unlocked: boolean
  } | null
  readonly weekBrief: { readonly id: string; readonly title: string; readonly route: string } | null
  readonly primaryLesson: { readonly id: string; readonly title: string; readonly route: string } | null
}

export function describeMissionNav(
  allLevels: readonly Pick<Level, 'id' | 'title'>[],
  currentId: number,
  isUnlocked: (id: number) => boolean,
): MissionNavState {
  const idx = allLevels.findIndex(item => item.id === currentId)
  const prevLevel = idx > 0 ? allLevels[idx - 1]! : null
  const nextLevel = idx >= 0 && idx < allLevels.length - 1 ? allLevels[idx + 1]! : null
  const week = weeks.find(w => w.missions.includes(currentId)) ?? weeks[0] ?? null
  const firstLessonId = missionLessons[currentId]?.[0]
  const firstLessonEntry = firstLessonId ? getEntry(firstLessonId) : undefined

  return {
    prev: prevLevel ? { id: prevLevel.id, title: prevLevel.title, route: `#practice/${prevLevel.id}` } : null,
    next: nextLevel
      ? {
        id: nextLevel.id,
        title: nextLevel.title,
        route: `#practice/${nextLevel.id}`,
        unlocked: isUnlocked(nextLevel.id),
      }
      : null,
    weekBrief: week ? { id: week.id, title: week.title, route: `#weeks/${week.id}` } : null,
    primaryLesson: firstLessonEntry
      ? { id: firstLessonEntry.id, title: firstLessonEntry.title, route: `#lesson/${firstLessonEntry.id}` }
      : null,
  }
}

function panel(html: string) {
  const node = document.createElement('section')
  node.innerHTML = html
  return node
}

function chips(command: string, cwd: string, host?: string) {
  return xray(command, cwd, host).map(t => `<span class="command-chip" data-token="${esc(t.type)}"><small>${esc(t.type)}</small> ${esc(t.label)}</span>`).join('')
}

function retentionNote(game: Game): string {
  switch (game.store.persistence) {
    case 'corrupt': return 'Some saved practice records could not be read. Recovered records are shown.'
    case 'unavailable':
    case 'memory': return 'Browser storage is unavailable. New practice progress and command history last for this visit only.'
    case 'available': return 'Practice progress and command history are saved in this browser.'
  }
}

export class PracticeDesk {
  readonly game: Game
  private session?: { mission: number; node: HTMLElement; refresh: () => void }
  private onToggleUnlockAll?: (enabled: boolean) => void
  constructor(game: Game) { this.game = game }

  view(id?: number, onToggleUnlockAll?: (enabled: boolean) => void): HTMLElement {
    if (onToggleUnlockAll) this.onToggleUnlockAll = onToggleUnlockAll
    const notifyUnlock = (enabled: boolean) => this.onToggleUnlockAll?.(enabled)
    const game = this.game
    if (!id) {
      const sections = practiceGroups.map(group => {
        const groupMissions = group.missions
          .map(missionId => game.levels.find(m => m.id === missionId))
          .filter((m): m is (typeof game.levels)[number] => Boolean(m))
        const doneCount = groupMissions.filter(m => game.isComplete(m.id)).length
        const pct = groupMissions.length ? Math.round((doneCount / groupMissions.length) * 100) : 0
        const weekBrief = group.weekId ? link(`#weeks/${group.weekId}`, `${group.eyebrow} brief →`) : ''
        return `<section class="practice-group" data-group="${esc(group.id)}" data-tone="${group.tone}">
          <header class="practice-group-head">
            <div class="practice-group-title">
              <span class="step-kicker">${esc(group.eyebrow)}</span>
              <h2>${esc(group.title)}</h2>
              <p class="practice-group-sub">${esc(group.subtitle)}</p>
            </div>
            <div class="practice-group-stats">
              <span class="mode-meta">${doneCount} / ${groupMissions.length} missions complete</span>
              <div class="progress-rail" aria-hidden="true"><span style="width: ${pct}%"></span></div>
              ${weekBrief}
            </div>
          </header>
          <div class="mode-grid">${groupMissions.map(m => {
            const done = game.isComplete(m.id)
            const unlocked = game.isUnlocked(m.id)
            const status = done ? 'complete' : unlocked ? 'available' : 'locked'
            const label = done ? 'Complete ✓' : unlocked ? 'Available' : 'Locked'
            return `<article class="mode-card" data-tone="${group.tone}" data-status="${status}">
              <div class="mode-card-top"><span class="mode-meta">Mission ${m.id}</span><span class="status-pill${done ? ' is-done' : !unlocked ? ' is-locked' : ''}">${label}</span></div>
              <h3>${link(`#practice/${m.id}`, m.title)}</h3><p>${esc(m.objective)}</p></article>`
          }).join('')}</div>
        </section>`
      }).join('')

      const index = panel(`<p class="mode-intro">Practice with a simulated shell. Commands change a virtual filesystem in this browser, never your computer or a cluster. Use demo values only.</p>
        <div class="practice-toolbar" data-tone="green">
          <p class="mode-note">${retentionNote(game)}</p>
          <div class="practice-toolbar-actions">
            <label class="unlock-toggle">
              <input type="checkbox" data-unlock-all ${game.unlockAll ? 'checked' : ''}>
              <span>Unlock all missions</span>
            </label>
            <button class="mode-action" type="button" data-reset>Reset practice progress</button>
          </div>
        </div>
        ${sections}`)
      index.querySelector<HTMLInputElement>('[data-unlock-all]')!.onchange = event => {
        const enabled = (event.target as HTMLInputElement).checked
        game.setUnlockAll(enabled)
        notifyUnlock(enabled)
        index.replaceWith(this.view())
      }
      index.querySelector<HTMLButtonElement>('[data-reset]')!.onclick = () => {
        if (!window.confirm('Clear all practice completions, simulator history and the current virtual filesystem? Learn and Weeks progress will be kept.')) return
        game.reset()
        this.session = undefined
        index.replaceWith(this.view())
      }
      return index
    }
    const mission = game.levels.find(m => m.id === id)!
    if (!game.isUnlocked(id)) {
      const next = game.levels.find(m => !game.isComplete(m.id) && game.isUnlocked(m.id))!
      const nav = describeMissionNav(game.levels, id, mid => game.isUnlocked(mid))
      const locked = panel(`<nav class="mission-nav" aria-label="Mission navigation">
          <a class="mode-link" data-route="#practice" href="#practice">← All missions</a>
          <div class="mission-step-links">
            ${nav.prev ? `<a class="mode-link" data-mission-prev data-route="${esc(nav.prev.route)}" href="${esc(nav.prev.route)}">← Prev mission</a>` : ''}
          </div>
        </nav>
        <article class="mode-panel step-panel" data-tone="slate"><div class="mode-card-top"><span class="mode-meta">Mission ${id}</span><span class="status-pill is-locked">Locked</span></div><h2>${esc(mission.title)}</h2>
        <p>${esc(mission.objective)}</p><p>Finish the earlier missions first, or unlock all missions if you want to jump straight in. Atlas cards are always available.</p>
        <div class="mode-links">${link(`#practice/${next.id}`, `Continue at mission ${next.id}`)}<button type="button" class="mode-action is-accent" data-unlock-now>Unlock all missions</button>${mission.cards.map(k => entryLink(conceptForAward(k))).join('')}</div></article>`)
      locked.querySelector<HTMLButtonElement>('[data-unlock-now]')!.onclick = () => {
        game.setUnlockAll(true)
        notifyUnlock(true)
        locked.replaceWith(this.view(id))
      }
      return locked
    }
    if (this.session?.mission === id) {
      this.session.refresh()
      return this.session.node
    }
    game.select(id)
    const built = this.runner()
    this.session = { mission: id, ...built }
    return built.node
  }

  private runner(): { node: HTMLElement; refresh: () => void } {
    const game = this.game, m = game.level
    const lessons = missionLessons[m.id] ?? []
    const [primaryLessonId, ...otherLessonIds] = lessons
    const primaryLesson = primaryLessonId ? getEntry(primaryLessonId) : undefined
    const starters = starterCommandsForMission(m.id)
    const node = panel(`<nav class="mission-nav" aria-label="Mission navigation">
        <a class="mode-link mission-all-link" data-route="#practice" href="#practice">← All missions</a>
        <div class="mission-step-links" data-mission-step-links></div>
      </nav>
      <article class="mode-panel mission-brief" data-tone="green">
        <div class="mode-card-top">
          <span class="step-kicker">Mission ${m.id} / ${game.levels.length}</span>
          <span class="status-pill" data-mission-status>Active mission</span>
        </div>
        <h2>${esc(m.title)}</h2>
        <p>${esc(m.objective)}</p>
        <div class="mission-callout-bar">
          <button type="button" class="mode-action is-accent" data-hint>Reveal hint (0/${m.hints.length})</button>
          ${primaryLesson ? `<a class="mode-link is-walkthrough-callout" data-walkthrough-link data-route="#lesson/${esc(primaryLesson.id)}" href="#lesson/${esc(primaryLesson.id)}">See visual walkthrough: ${esc(primaryLesson.title)} →</a>` : ''}
          ${otherLessonIds.map(lid => link(`#lesson/${lid}`, `Learn · ${getEntry(lid)!.title}`)).join('')}
          ${weeks.filter(w => w.missions.includes(m.id)).map(w => link(`#weeks/${w.id}`, `${w.title} brief`)).join('')}
        </div>
        <div class="mode-links mission-ref-links" aria-label="Reference cards">
          <span class="mission-ref-label">Atlas cards:</span>
          ${m.cards.map(k => entryLink(conceptForAward(k))).join('')}
        </div>
        <div class="mission-hints"><ol></ol></div>
        <div class="mission-complete-banner" data-complete-banner hidden>
          <p data-outcome role="status"></p>
          <div class="mission-complete-actions" data-next></div>
        </div>
      </article>
      <div class="practice-columns"><section class="mode-panel step-panel" data-tone="blue"><div class="mode-card-top"><h2>Simulated terminal</h2><span class="mode-meta">Type below &amp; press Enter</span></div><p class="mode-note">No host commands. Use demo values only. <span data-retention>${retentionNote(game)}</span></p>
      <div class="terminal-log" role="log" aria-label="Terminal output" tabindex="0"></div>
      <div class="terminal-starters" aria-label="Starter commands">
        <span class="starter-label">Start here:</span>
        ${starters.map(cmd => `<button type="button" class="starter-cmd-btn" data-starter-cmd="${esc(cmd)}"><code>${esc(cmd)}</code></button>`).join('')}
        ${m.proposals ? `<button type="button" class="starter-cmd-btn is-audit-jump" data-jump-audit>Review proposals below ↓</button>` : ''}
      </div>
      <form class="terminal-form" autocomplete="off"><label class="terminal-prompt-box"><span class="terminal-prompt-line"><span class="prompt-caret" aria-hidden="true">▸</span><span data-prompt></span></span><input name="command" type="text" aria-label="Simulated command" placeholder="Type command here (e.g. ${esc(starters[0] ?? 'ls')})…" autocapitalize="off" spellcheck="false"></label>
        <button class="mode-action is-accent" type="submit">Run ↵</button></form><p class="mode-note">↑ / ↓ history · Tab complete · Ctrl+L clear</p>
      <h3>Command X-ray</h3><div data-chips class="command-chips"></div>
      <button type="button" class="mode-action" data-restart>Restart this simulation</button></section>
      <section class="mode-panel step-panel" data-tone="green"><h2>State X-ray</h2><label class="state-picker">Inspect <select aria-label="State view">${Object.entries(stateViews).map(([k, text]) => `<option value="${k}">${text}</option>`).join('')}</select></label>
      <div class="sim-state"></div></section></div><section class="mode-panel step-panel" data-tone="amber" data-audit ${m.proposals ? '' : 'hidden'}><h2>Command audit</h2>
      <p>Review only. Neither decision executes the proposal.</p><div data-proposal></div><p role="status" data-verdict></p></section>`)
    const el = <T extends HTMLElement = HTMLElement>(selector: string) => node.querySelector<T>(selector)!
    let last: Run | undefined, hint = 0, historyIndex = game.store.state.history.length, draft = '', tabOffered = false
    const input = el<HTMLInputElement>('input[name="command"]')
    const picker = el<HTMLSelectElement>('select')
    picker.value = m.visualizer
    const drawState = () => { el('.sim-state').innerHTML = stateView(picker.value as StateView, game.shell, last) }
    const drawChips = (text: string) => { el('[data-chips]').innerHTML = chips(text, game.shell.cwd) || '<small>Type a command above (or click a starter) to inspect its parts.</small>' }
    const append = (text: string, tone = '') => {
      if (!text) return
      const pre = document.createElement('pre')
      pre.textContent = text.trimEnd()
      pre.dataset.line = tone
      const log = el('.terminal-log')
      log.append(pre)
      if (log.childElementCount > 240) log.firstElementChild!.remove()
      log.scrollTop = log.scrollHeight
    }
    const syncMissionNav = () => {
      const done = game.isComplete(m.id)
      const statusPill = el('[data-mission-status]')
      statusPill.textContent = done ? 'Complete ✓' : 'Active mission'
      statusPill.classList.toggle('is-done', done)

      const nav = describeMissionNav(game.levels, m.id, mid => game.isUnlocked(mid))
      const stepLinks: string[] = []
      if (nav.prev) {
        stepLinks.push(`<a class="mode-link" data-mission-prev data-route="${esc(nav.prev.route)}" href="${esc(nav.prev.route)}" title="Mission ${nav.prev.id}: ${esc(nav.prev.title)}">← Prev mission</a>`)
      }
      if (nav.next) {
        if (nav.next.unlocked) {
          stepLinks.push(`<a class="mode-link is-next-mission" data-mission-next data-route="${esc(nav.next.route)}" href="${esc(nav.next.route)}" title="Mission ${nav.next.id}: ${esc(nav.next.title)}">Next mission →</a>`)
        } else {
          stepLinks.push(`<span class="mission-nav-locked" data-mission-next-locked title="Complete Mission ${m.id} to unlock Mission ${nav.next.id}">Next mission →</span>`)
        }
      } else if (nav.weekBrief) {
        stepLinks.push(`<a class="mode-link" data-mission-next data-route="${esc(nav.weekBrief.route)}" href="${esc(nav.weekBrief.route)}">${esc(nav.weekBrief.title)} →</a>`)
      }
      el('[data-mission-step-links]').innerHTML = stepLinks.join('')
    }
    const updateOutcome = () => {
      const done = game.isComplete(m.id)
      syncMissionNav()
      const banner = el('[data-complete-banner]')
      banner.hidden = !done
      el('[data-outcome]').textContent = done ? (m.reward?.title ?? 'Mission complete ✓ · Atlas cards marked practiced.') : ''
      if (!done) {
        el('[data-next]').innerHTML = ''
        return
      }
      const nav = describeMissionNav(game.levels, m.id, mid => game.isUnlocked(mid))
      const actions: string[] = []
      if (nav.next) {
        actions.push(`<a class="mode-link is-complete-cta" data-route="${esc(nav.next.route)}" href="${esc(nav.next.route)}">Next mission: ${esc(nav.next.title)} →</a>`)
      } else {
        actions.push(`<a class="mode-link is-complete-cta" data-route="#practice" href="#practice">All missions →</a>`)
      }
      if (nav.weekBrief) {
        actions.push(link(nav.weekBrief.route, `${nav.weekBrief.title} brief`))
      }
      if (nav.primaryLesson) {
        actions.push(link(nav.primaryLesson.route, `Learn · ${nav.primaryLesson.title}`))
      }
      el('[data-next]').innerHTML = actions.join('')
    }
    const drawAudit = () => {
      const p = game.proposal
      el('[data-proposal]').innerHTML = p
        ? `<h3>Proposal ${game.proposalIndex + 1} / ${m.proposals!.length}</h3>${p.host ? `<p>Context: ${esc(p.host)}</p>` : ''}
        <pre>${esc(p.command)}</pre><div class="command-chips">${chips(p.command, game.shell.cwd, p.host)}</div>
        <button class="mode-action" type="button" data-verdict-choice="reject">Reject proposal</button>
        <button class="mode-action" type="button" data-verdict-choice="approve">Approve proposal</button>` : ''
      for (const button of node.querySelectorAll<HTMLButtonElement>('[data-verdict-choice]')) button.onclick = () => {
        const verdict = game.decide(button.dataset.verdictChoice === 'approve' ? 'approve' : 'reject')
        if (!verdict) return
        el('[data-retention]').textContent = retentionNote(game)
        el('[data-verdict]').textContent = `${verdict.accepted ? 'Correct.' : 'Try again.'} ${verdict.explanation}`
        updateOutcome()
        drawAudit()
        node.querySelector<HTMLElement>('[data-verdict-choice], [data-next] a')?.focus()
      }
    }
    picker.onchange = drawState
    const hintBtn = el<HTMLButtonElement>('[data-hint]')
    hintBtn.onclick = () => {
      const item = document.createElement('li')
      item.textContent = m.hints[hint++]
      el('.mission-hints ol').append(item)
      const exhausted = hint >= m.hints.length
      hintBtn.disabled = exhausted
      hintBtn.textContent = exhausted
        ? `All hints shown (${hint}/${m.hints.length})`
        : `Next hint (${hint}/${m.hints.length})`
      item.tabIndex = -1
      item.focus()
    }
    for (const starterBtn of node.querySelectorAll<HTMLButtonElement>('[data-starter-cmd]')) {
      starterBtn.onclick = () => {
        const cmd = starterBtn.dataset.starterCmd ?? ''
        input.value = cmd
        drawChips(cmd)
        tabOffered = false
        input.focus()
        input.setSelectionRange(cmd.length, cmd.length)
      }
    }
    const jumpAuditBtn = node.querySelector<HTMLButtonElement>('[data-jump-audit]')
    if (jumpAuditBtn) {
      jumpAuditBtn.onclick = () => {
        const target = node.querySelector<HTMLElement>('[data-verdict-choice], [data-audit]')
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target?.focus({ preventScroll: true })
      }
    }
    el<HTMLButtonElement>('[data-restart]').onclick = () => {
      if (!window.confirm('Start this mission with a fresh virtual filesystem? Completed missions stay complete.')) return
      this.session = undefined
      const fresh = this.view(m.id)
      node.replaceWith(fresh)
      fresh.querySelector('input')?.focus()
    }
    el<HTMLFormElement>('form').onsubmit = event => {
      event.preventDefault()
      const text = input.value
      if (!text.trim()) { input.focus(); return }
      const prompt = game.shell.prompt
      last = game.run(text)
      el('[data-retention]').textContent = retentionNote(game)
      if (last.clear) el('.terminal-log').replaceChildren()
      else append(prompt + text, 'command')
      append(last.stdout); append(last.stderr, 'error')
      last.feedback.forEach(msg => append(msg, 'feedback'))
      if (last.completed) updateOutcome()
      el('[data-prompt]').textContent = game.shell.prompt
      drawState(); drawChips(text)
      historyIndex = game.store.state.history.length
      input.value = draft = ''
      tabOffered = false
      input.focus()
    }
    input.oninput = () => { drawChips(input.value); tabOffered = false }
    input.onkeydown = event => {
      const history = game.store.state.history
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (!history.length) return
        event.preventDefault()
        if (historyIndex === history.length) draft = input.value
        historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)))
        input.value = history[historyIndex] ?? draft
        drawChips(input.value)
        tabOffered = false
      } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault(); el('.terminal-log').replaceChildren()
      } else if (event.key === 'Tab' && !event.shiftKey && !tabOffered && input.selectionStart === input.selectionEnd) {
        const cursor = input.selectionStart ?? 0
        const tokens = tokenize(input.value.slice(0, cursor), { partial: true }), end = tokens.at(-1)
        const current = end?.end === cursor && end.type === 'word' ? end : undefined
        const previous = current ? tokens.at(-2) : end
        if (!current && (!previous || previous.value === '|')) return
        const matches = game.shell.complete(current?.value ?? '', !previous || previous.value === '|')
        if (!matches.length) return
        event.preventDefault()
        if (matches.length === 1) {
          const value = matches[0].replace(/[\\\s"'$|>]/g, '\\$&')
          input.setRangeText(value + (value.endsWith('/') ? '' : ' '), current?.start ?? cursor, cursor, 'end')
          drawChips(input.value)
        } else append(matches.join('  '), 'feedback')
        tabOffered = true // A second Tab always leaves the input.
      }
    }
    el('[data-prompt]').textContent = game.shell.prompt
    append('Simulator ready. Click a starter command below or type directly (try tldr ls or --help).', 'feedback')
    drawChips(''); drawState(); updateOutcome(); drawAudit()
    return { node, refresh: updateOutcome }
  }
}
