import type { Game } from './engine/game.ts'
import { getEntry } from '../catalog.ts'
import { tokenize, xray } from './engine/shell.ts'
import { conceptForAward } from '../platform/codex.ts'
import { missionLessons, practiceGroups, weeks } from '../platform/curriculum.ts'
import { entryLink, escapeHtml as esc, link } from '../platform/links.ts'
import { stateView, stateViews } from './state-view.ts'
import type { Run, StateView } from './state-view.ts'

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
  private session?: { mission: number; node: HTMLElement }
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
      const locked = panel(`<article class="mode-panel step-panel" data-tone="slate"><div class="mode-card-top"><span class="mode-meta">Mission ${id}</span><span class="status-pill is-locked">Locked</span></div><h2>${esc(mission.title)}</h2>
        <p>${esc(mission.objective)}</p><p>Finish the earlier missions first, or unlock all missions if you want to jump straight in. Atlas cards are always available.</p>
        <div class="mode-links">${link(`#practice/${next.id}`, `Continue at mission ${next.id}`)}<button type="button" class="mode-action is-accent" data-unlock-now>Unlock all missions</button>${mission.cards.map(k => entryLink(conceptForAward(k))).join('')}</div></article>`)
      locked.querySelector<HTMLButtonElement>('[data-unlock-now]')!.onclick = () => {
        game.setUnlockAll(true)
        notifyUnlock(true)
        locked.replaceWith(this.view(id))
      }
      return locked
    }
    if (this.session?.mission === id) return this.session.node
    game.select(id)
    const node = this.runner()
    this.session = { mission: id, node }
    return node
  }

  private runner(): HTMLElement {
    const game = this.game, m = game.level
    const node = panel(`<article class="mode-panel mission-brief" data-tone="green"><div class="mode-card-top"><span class="step-kicker">Mission ${m.id} / ${game.levels.length}</span><span class="mode-meta">Browser simulation</span></div>
      <h2>${esc(m.title)}</h2><p>${esc(m.objective)}</p><div class="mode-links">
      ${missionLessons[m.id].map(id => link(`#lesson/${id}`, `Learn · ${getEntry(id)!.title}`)).join('')}
      ${m.cards.map(k => entryLink(conceptForAward(k))).join('')}${weeks.filter(w => w.missions.includes(m.id)).map(w => link(`#weeks/${w.id}`, w.title)).join('')}</div>
      <div class="mission-hints"><ol></ol><button type="button" class="mode-action" data-hint>Reveal a hint</button></div>
      <p data-outcome role="status"></p><div data-next></div></article>
      <div class="practice-columns"><section class="mode-panel step-panel" data-tone="blue"><h2>Simulated terminal</h2><p class="mode-note">No host commands. Use demo values only. <span data-retention>${retentionNote(game)}</span></p>
      <div class="terminal-log" role="log" aria-label="Terminal output" tabindex="0"></div>
      <form class="terminal-form" autocomplete="off"><label><span data-prompt></span><input name="command" type="text" aria-label="Simulated command" autocapitalize="off" spellcheck="false"></label>
        <button class="mode-action is-accent" type="submit">Run</button></form><p class="mode-note">↑ / ↓ history · Tab complete · Ctrl+L clear</p>
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
    const drawChips = (text: string) => { el('[data-chips]').innerHTML = chips(text, game.shell.cwd) || '<small>Type a command to see its parts.</small>' }
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
    const updateOutcome = () => {
      const done = game.isComplete(m.id)
      el('[data-outcome]').textContent = done ? (m.reward?.title ?? 'Mission complete · Atlas cards marked practiced.') : ''
      el('[data-next]').innerHTML = done ? (game.levels.some(level => level.id === m.id + 1)
        ? link(`#practice/${m.id + 1}`, 'Next mission →') : link('#practice', 'All missions')) : ''
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
    el<HTMLButtonElement>('[data-hint]').onclick = () => {
      const item = document.createElement('li')
      item.textContent = m.hints[hint++]
      el('.mission-hints ol').append(item)
      el<HTMLButtonElement>('[data-hint]').disabled = hint >= m.hints.length
      item.tabIndex = -1
      item.focus()
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
    append('Simulator ready. Try tldr ls or a command followed by --help.', 'feedback')
    drawChips(''); drawState(); updateOutcome(); drawAudit()
    return node
  }
}
