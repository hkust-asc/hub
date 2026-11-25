import { entries, getEntry, routeForEntry } from '../catalog.ts'
import type { LessonId } from '../catalog.ts'
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
