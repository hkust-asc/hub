import { isLessonId } from '../catalog.ts'
import type { LessonId } from '../catalog.ts'
import { weeks } from './curriculum.ts'

type Disk = Pick<Storage, 'getItem' | 'setItem'>
type Position = { positionMs: number; durationMs: number; beat: number; total: number }
type Bookmark = Position & { completed: boolean }
const key = 'hpc4:learning:v1'
const questIds = new Set(weeks.flatMap(w => w.quests.map(q => `${w.id}/${q.id}`)))

export function browserStorage(): Disk | undefined {
  try { return window.localStorage }
  catch { console.warn('Browser storage unavailable; progress lasts for this visit only.'); return undefined }
}

function bookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== 'object') return false
  const b = value as Partial<Bookmark>
  return Number.isFinite(b.positionMs) && Number.isFinite(b.durationMs) &&
    b.durationMs! > 0 && b.positionMs! >= 0 && b.positionMs! <= b.durationMs! &&
    Number.isInteger(b.beat) && Number.isInteger(b.total) && b.beat! >= 0 && b.beat! < b.total! &&
    typeof b.completed === 'boolean'
}

export class LearningProgress {
  readonly lessons = new Map<LessonId, Bookmark>()
  readonly checked = new Set<string>()
  last?: LessonId
  unlockAllMissions = false
  private disk?: Disk
  private dirty = false

  constructor(disk?: Disk) {
    this.disk = disk
    try {
      const data = disk?.getItem(key)
      if (!data) return
      const parsed = JSON.parse(data)
      if (!parsed || typeof parsed.lessons !== 'object' || !Array.isArray(parsed.checked))
        throw new Error('Unexpected progress format')
      for (const [id, b] of Object.entries(parsed.lessons)) if (isLessonId(id) && bookmark(b)) this.lessons.set(id, b)
      for (const id of parsed.checked) if (questIds.has(id)) this.checked.add(id)
      if (this.lessons.has(parsed.last)) this.last = parsed.last
      if (typeof parsed.unlockAllMissions === 'boolean') this.unlockAllMissions = parsed.unlockAllMissions
    } catch (error) {
      console.warn('Saved learning progress could not be read.', error)
    }
  }

  record(id: LessonId, position: Position) {
    const previous = this.lessons.get(id)
    const completed = previous?.completed || position.positionMs >= position.durationMs
    const boundary = this.last !== id || previous?.beat !== position.beat || completed !== previous?.completed
    this.lessons.set(id, { ...position, completed })
    this.last = id
    this.dirty = true
    if (boundary) this.save()
  }

  checkQuest(id: string, checked: boolean) {
    if (!questIds.has(id)) throw new Error(`Unknown workshop quest: ${id}`)
    if (checked) this.checked.add(id)
    else this.checked.delete(id)
    this.dirty = true
    this.save()
  }

  setUnlockAllMissions(enabled: boolean) {
    this.unlockAllMissions = enabled
    this.dirty = true
    this.save()
  }

  save() {
    if (!this.dirty || !this.disk) return
    try {
      this.disk.setItem(key, JSON.stringify({
        lessons: Object.fromEntries(this.lessons),
        last: this.last,
        checked: [...this.checked],
        unlockAllMissions: this.unlockAllMissions,
      }))
      this.dirty = false
    } catch (error) {
      this.disk = undefined
      console.warn('Progress cannot be saved; continuing in memory.', error)
    }
  }
}
