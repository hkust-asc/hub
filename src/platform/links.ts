import { entries, entriesForCategory, getCategory, getEntry, routeForEntry, routeForTarget } from '../catalog.ts'
import type { CategoryDef, EntryDef, LessonId } from '../catalog.ts'
import type { StageContinuation, StageContinuationLink } from '../stage/types.ts'
import { missionLessons, weeks } from './curriculum.ts'

export function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
}

export function link(route: string, label: string) {
  return `<a class="mode-link" data-route="${escapeHtml(route)}" href="${escapeHtml(route)}">${escapeHtml(label)}</a>`
}

export function entryLink(id: string) {
  const entry = getEntry(id)!
  return link(routeForEntry(entry)!, entry.shortTitle)
}

const lessonReferences: Partial<Record<LessonId, string[]>> = {
  'linux-fs': ['filesystem', 'paths', 'dotfiles'],
  streams: ['standard-streams'],
  'module-load': ['path', 'environment'],
  'ssh-tmux': ['signals'],
}

export function conceptsForLesson(id: LessonId) {
  const entry = getEntry(id)!
  return [...new Set([...(lessonReferences[id] ?? []), ...entry.related,
    ...entries.filter(e => e.kind === 'subject' && e.related.includes(id)).map(e => e.id)])]
    .filter(key => getEntry(key)?.kind === 'subject')
}

export function lessonLinks(id: LessonId) {
  const missions = Object.entries(missionLessons).filter(([, lessons]) => lessons.includes(id))
  return `<nav class="mode-links" aria-label="Practice and references">
    ${missions.map(([n]) => link(`#practice/${n}`, `Practice · Mission ${n}`)).join('')}
    ${conceptsForLesson(id).map(entryLink).join('')}
    ${weeks.filter(w => w.lessons.includes(id)).map(w => link(`#weeks/${w.id}`, w.title)).join('')}
  </nav>`
}

export function lessonContinuation(
  id: LessonId,
  options: { readonly completedMissions?: ReadonlySet<number> } = {},
): StageContinuation {
  const entry = getEntry(id)!
  const pairedMissions = Object.entries(missionLessons)
    .filter(([, lessons]) => lessons.includes(id))
    .map(([n]) => Number(n))
  const catScenarios = entriesForCategory(entry.category).filter(item => item.kind === 'scenario')
  const catIdx = catScenarios.findIndex(item => item.id === id)
  const nextScenario = catIdx >= 0 ? catScenarios[catIdx + 1] : undefined

  let primary: StageContinuationLink
  let kicker = 'Up next'
  const secondary: StageContinuationLink[] = []

  if (pairedMissions.length > 0) {
    const chosenMission = pairedMissions.find(m => !options.completedMissions?.has(m)) ?? pairedMissions[0]!
    kicker = 'Up next · Apply in terminal'
    primary = {
      route: `#practice/${chosenMission}`,
      label: `Practice · Mission ${chosenMission}`,
      kind: 'practice',
    }
    for (const m of pairedMissions) {
      if (m !== chosenMission) {
        secondary.push({
          route: `#practice/${m}`,
          label: `Practice · Mission ${m}`,
          kind: 'practice',
        })
      }
    }
    if (nextScenario) {
      secondary.push({
        route: routeForEntry(nextScenario)!,
        label: `Next: ${nextScenario.shortTitle}`,
        kind: 'lesson',
      })
    }
  } else if (nextScenario) {
    kicker = 'Up next · Guided walkthrough'
    primary = {
      route: routeForEntry(nextScenario)!,
      label: `Next: ${nextScenario.title}`,
      kind: 'lesson',
    }
  } else {
    kicker = 'Scenario complete · Continue exploring'
    primary = {
      route: '#learn',
      label: 'All walkthroughs',
      kind: 'learn',
    }
  }

  for (const w of weeks.filter(item => item.lessons.includes(id))) {
    secondary.push({
      route: `#weeks/${w.id}`,
      label: w.title,
      kind: 'week',
    })
  }

  for (const relId of entry.related) {
    const rel = getEntry(relId)
    if (rel?.kind === 'scene') {
      const sceneRoute = routeForTarget(rel.target)
      if (sceneRoute) {
        secondary.push({
          route: sceneRoute,
          label: `Inspect · ${rel.shortTitle}`,
          kind: 'scene',
        })
      }
    }
  }

  for (const cid of conceptsForLesson(id).slice(0, 3)) {
    const conceptEntry = getEntry(cid)
    if (conceptEntry) {
      secondary.push({
        route: routeForEntry(conceptEntry)!,
        label: conceptEntry.shortTitle,
        kind: 'concept',
      })
    }
  }

  return { kicker, primary, secondary }
}

export interface ConceptNeighbors {
  readonly category: CategoryDef
  readonly index: number
  readonly total: number
  readonly prev: EntryDef | null
  readonly next: EntryDef | null
}

export function conceptNeighbors(id: string): ConceptNeighbors {
  const entry = getEntry(id)!
  const category = getCategory(entry.category)
  const subjects = entriesForCategory(entry.category).filter(item => item.kind === 'subject')
  const idx = subjects.findIndex(item => item.id === id)
  return {
    category,
    index: idx >= 0 ? idx + 1 : 1,
    total: subjects.length,
    prev: idx > 0 ? subjects[idx - 1]! : null,
    next: idx >= 0 && idx < subjects.length - 1 ? subjects[idx + 1]! : null,
  }
}
