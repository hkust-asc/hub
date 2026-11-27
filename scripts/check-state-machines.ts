#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import {
  activeEntryForState,
  categories,
  entries,
  entriesForCategory,
  fallbackBackTarget,
  getCategory,
  getEntry,
  isCategoryId,
  isLessonId,
  normalizeLessonUrl,
  parseRoute,
  popTrail,
  pruneTrailForDestination,
  pushTrail,
  routeForEntry,
  routeForTarget,
  trailSnapshotForCurrent,
} from '../src/catalog.ts'
import type { CategoryId, EntryDef, LessonId, ParsedRoute, TrailItem } from '../src/catalog.ts'
import { jobSteps } from '../src/first-job/story.ts'
import { gpuSteps } from '../src/host-to-gpu/story.ts'
import { fsSteps } from '../src/linux-fs/story.ts'
import { clusterTopics, initialState, topics, updateState } from '../src/model.ts'
import type { AppState, ClusterTopicId, TopicId } from '../src/model.ts'
import { moduleSteps } from '../src/module-load/story.ts'
import { codex, conceptForAward } from '../src/platform/codex.ts'
import { missionLessons, practiceGroups, weeks } from '../src/platform/curriculum.ts'
import { conceptsForLesson, entryLink, lessonLinks } from '../src/platform/links.ts'
import { getWorkshopResource, resourcesRoute, workshopResources } from '../src/platform/resource-catalog.ts'
import { renderResourceResults, renderWorkshopMaterialsLink, renderWorkshopResources } from '../src/platform/resources.ts'
import { searchDestinations } from '../src/platform/search.ts'
import { levels } from '../src/practice/engine/levels/index.ts'
import { sshSteps } from '../src/ssh-tmux/story.ts'
import { streamSteps } from '../src/streams/story.ts'

export interface StateMachineSpec {
  readonly id: string
  readonly name: string
  readonly summary: string
  readonly ownerFiles: readonly string[]
  readonly states: readonly string[]
  readonly events: readonly string[]
  readonly invariants: readonly string[]
  readonly verification: {
    readonly formalModels: readonly string[]
    readonly scriptsAndTests: readonly string[]
  }
}

export const STATE_MACHINES: readonly StateMachineSpec[] = [
  {
    id: 'route-and-link-graph',
    name: 'Route & Link Graph',
    summary:
      'Hash router, canonical URL normalizer, Hub link graph (Learn, Practice, Weeks, Atlas, Resources, Explore scenes, Concept sheets), async scenario mount token, and bounded Think Back trail.',
    ownerFiles: [
      'src/catalog.ts',
      'src/main.ts',
      'src/platform/links.ts',
      'src/platform/codex.ts',
      'src/platform/curriculum.ts',
      'src/platform/resource-catalog.ts',
      'src/platform/resources.ts',
      'src/platform/search.ts',
      'src/platform/views.ts',
    ],
    states: [
      'learn (#learn)',
      'practice-index (#practice) & practice-mission (#practice/1..6)',
      'weeks-index (#weeks) & week-detail (#weeks/asc01)',
      'resource-directory (#resources) & workshop materials (#resources/<id>)',
      'atlas-all (#atlas) & atlas-domains (#atlas/domains)',
      'domain-hub (#atlas/<category>)',
      'concept-sheet (#atlas/concept/<id>)',
      'workbench-cluster (#cluster, #cluster/<topic>) & workbench-a30 (#a30, #a30/<topic>)',
      'lesson-stage (#lesson/<id>, #lesson/<id>/<step>) with idle | loading(token) | mounted(id)',
    ],
    events: [
      'navigateTo(hash, { push, recordTrail })',
      'dispatchScene(browse | navigate | select | cluster-select)',
      'atlasModeToggle(all | domains)',
      'thinkBack (popTrail -> fallbackBackTarget)',
      'popstate (browser Back/Forward)',
      'ensureLessonMounted(lessonId, step) / stopActiveLesson()',
    ],
    invariants: [
      'Every outgoing #hash parses via parseRoute to an existing non-planned canonical route node.',
      'Every active scene, subject, scenario, scenario step, mission, week, and domain hub is reachable from top-level modes (zero orphans).',
      'pushTrail, pruneTrailForDestination, popTrail, and fallbackBackTarget never produce self-loops and terminate at a root hub/index in bounded steps.',
      'lessonLoadToken cancels superseded async scenario imports so stale or duplicate mounts never overwrite the active view.',
      'Bidirectional cross-links hold across lesson <-> concept, mission <-> concept, lesson <-> mission, and week <-> {lesson, mission, concept, workshop materials}.',
    ],
    verification: {
      formalModels: ['formal/Navigation/Navigation.tla'],
      scriptsAndTests: ['scripts/check-state-machines.ts', 'tests/link-graph.test.ts', 'tests/platform.test.ts'],
    },
  },
  {
    id: 'stage-scenario-runner',
    name: 'Stage Scenario Runner',
    summary:
      'Pure reader-paced and autoplay step reducer driving causal entrance beats (0..1), reading dwell timers, Inspect mode freeze/resume, playback rate, Fit camera override, and reduced-motion snapping.',
    ownerFiles: ['src/stage/runner.ts', 'src/stage/player.ts', 'src/stage/types.ts'],
    states: [
      'stepIndex in 0..steps.length-1',
      'beatProgress in [0, 1] (0 = entrance start, 1 = canonical resting state)',
      'playback: reader-paced | autoplay-beat | autoplay-dwell',
      'inspect: off | inspecting(resumeAutoplayAfterInspect) | pinnedPart',
      'camera: zoomed | fitOverride',
      'variant: default | local | remote',
    ],
    events: [
      'goto(stepIndex)',
      'next / prev / replay-step',
      'toggle-autoplay / pause',
      'enter-inspect / toggle-inspect / clearPin',
      'toggle-fit / set-rate / set-variant',
      'tick(dtMs, reducedMotion)',
    ],
    invariants: [
      'Reader-paced mode (autoplay = false) settles beatProgress to 1 and never auto-advances stepIndex.',
      'Inspect mode and active autoplay are mutually exclusive; ticks while inspecting freeze stepIndex, beatProgress, and dwellElapsedMs.',
      'Leaving Inspect via toggle-inspect preserves stepIndex and restores pre-inspect autoplay intent unless explicitly paused.',
      'Under prefers-reduced-motion, step entries and ticks settle immediately to beatProgress = 1 while preserving autoplay dwell stepping.',
      'Switching scenario variants pauses autoplay, exits Inspect, and replays the active step beat from freshBeat.',
    ],
    verification: {
      formalModels: ['formal/StageRunner/StageRunner.tla'],
      scriptsAndTests: ['tests/model.test.ts'],
    },
  },
  {
    id: 'learning-and-practice-persistence',
    name: 'Learning & Practice Persistence',
    summary:
      'Dual-namespace browser persistence separating Learn/Weeks bookmarks and preferences (hpc4:learning:v1) from Practice mission completions, awarded cards, and shell history (hpc4-hub.practice.act1).',
    ownerFiles: ['src/platform/progress.ts', 'src/practice/engine/storage.ts', 'src/main.ts'],
    states: [
      'LearningProgress: lessons Map<LessonId, Bookmark>, checked Set<questId>, last?: LessonId, unlockAllMissions: boolean, dirty: boolean',
      'ProgressStore: persistence in {available, memory, unavailable, corrupt}, completed: number[], cards: string[], history: string[<=100]',
    ],
    events: [
      'learning.record(lessonId, stepBookmarkPosition(...))',
      'resolveSavedStep(bookmark, stepCount)',
      'learning.checkQuest(questId, checked)',
      'learning.setUnlockAllMissions(enabled)',
      'learning.save() on boundary / visibilitychange / pagehide',
      'store.complete(missionId, cards) / store.remember(cmd) / store.reset()',
    ],
    invariants: [
      'Scenario completion is monotonic: revisiting earlier steps updates resume position without revoking completed = true.',
      'Completed scenarios resting at final position reopen cleanly at step 0; mid-scenario bookmarks restore exact or proportional step.',
      'Resetting Practice progress clears hpc4-hub.practice.act1 (and legacy key) without mutating Learn bookmarks or Weeks checkboxes.',
      'Unavailable or corrupt localStorage recovers usable fields and degrades to in-memory session state without throwing.',
    ],
    verification: {
      formalModels: ['formal/Mission/Mission.tla'],
      scriptsAndTests: ['tests/platform.test.ts', 'tests/practice-storage.test.ts'],
    },
  },
  {
    id: 'practice-shell-vfs-mission-engine',
    name: 'Practice Shell/VFS/Mission Engine',
    summary:
      'Deterministic browser-simulated Linux shell, quote-aware tokenizer/parser, copy-isolated virtual filesystem, launch-snapshot mission observers (Missions 01-05), and non-executing human-in-the-loop command audit (Mission 06).',
    ownerFiles: [
      'src/practice/engine/game.ts',
      'src/practice/engine/shell.ts',
      'src/practice/engine/parser.ts',
      'src/practice/engine/vfs.ts',
      'src/practice/engine/commands.ts',
      'src/practice/engine/levels/index.ts',
    ],
    states: [
      'Game: active level (1..6), unlocked (sequential | unlockAll), completed[], proposalIndex (0..3), LevelState',
      'Shell submission pipeline: ready -> submitted -> tokenized | lex-error -> parsed | parse-error -> stage-loop -> returned',
      'VFS: Map<path, DirectoryEntry | FileEntry(mode, text, program)>, frozen stage snapshots (vfsAtExecution)',
    ],
    events: [
      'game.select(missionId) / game.setUnlockAll(enabled) / game.reset()',
      'game.run(input): tokenize -> parse -> openOutput redirects -> vfs.snapshot() -> execute -> level.observe',
      'game.decide("approve" | "reject") on Mission 06 proposals',
    ],
    invariants: [
      'Parse-before-effects: unclosed quotes, missing commands, extra pipes, and missing redirect targets return code 2 before mutating VFS or revealed state.',
      'Quote-boundary expansion: adjacent quoted and unquoted segments expand $VAR without swallowing literal suffixes.',
      'VFS isolation & root preflight: cp clones file metadata so chmod never mutates source; rm validates all normalized operands before deleting so `/` refusal has zero partial side effects.',
      'Launch-snapshot observation: Mission 01 requires prior workspace reveal; Mission 02 checks event.vfsAtExecution at stage launch so trailing pipeline `| rm` cannot spoof installation.',
      'Audit safety: Mission 06 advances proposalIndex strictly on expected verdicts in order and never dispatches proposal text to Shell.run.',
    ],
    verification: {
      formalModels: [
        'formal/Mission/Mission.tla',
        'formal/Shell/Shell.tla',
        'formal/VFS/VFS.tla',
        'formal/Audit/Audit.tla',
      ],
      scriptsAndTests: [
        'tests/practice-game.test.ts',
        'tests/practice-shell.test.ts',
        'tests/practice-replay.test.ts',
      ],
    },
  },
  {
    id: 'explore-workbench-and-overlay-stack',
    name: 'Explore Workbench & Overlay Stack',
    summary:
      'Interactive Cluster & A30 cutaway state reducer (scene, selected subject, local/remote NUMA placement, exploded layers) coordinated with global modals, mobile navigation drawer, hover previews, and Stage Inspect.',
    ownerFiles: [
      'src/model.ts',
      'src/main.ts',
      'src/layout.ts',
      'src/platform/search.ts',
      'src/stage/player.ts',
    ],
    states: [
      'AppState: scene in {cluster, a30}, clusterSelected in ClusterTopicId, selected in TopicId, placement in {local, remote}, exploded: boolean',
      'Overlay stack: switcher-modal (<dialog#switcher>) | evidence-modal (<dialog#evidence-dialog>) | mobile-drawer (.navigation-open) | entry-preview | stage-inspect(pinnedPart)',
    ],
    events: [
      'updateState(select | cluster-select | browse | navigate | placement | explode | reset-view | reset)',
      'openSwitcher (Ctrl+K) / openEvidence / toggleMobileDrawer',
      'Escape key dispatch across active overlay layers',
    ],
    invariants: [
      'reset-view restores placement = local and exploded = false while preserving the active scene, selected subject, and saved scenario bookmarks.',
      'Opening switcher, evidence dialog, or mobile drawer pauses active scenario autoplay and dismisses hover tooltips; switcher and evidence modals are mutually exclusive.',
      'Escape obeys strict top-down precedence: modal dialog -> mobile navigation drawer -> pinned Stage component -> Stage Inspect mode, never leaking to lower layers on a single keypress.',
    ],
    verification: {
      formalModels: ['formal/Navigation/Navigation.tla'],
      scriptsAndTests: ['tests/model.test.ts', 'scripts/check-state-machines.ts'],
    },
  },
] as const

export const LESSON_STEP_COUNTS: Readonly<Record<LessonId, number>> = {
  'host-to-gpu': gpuSteps.length,
  'ssh-tmux': sshSteps.length,
  streams: streamSteps.length,
  'linux-fs': fsSteps.length,
  'first-job': jobSteps.length,
  'module-load': moduleSteps.length,
}

export type RouteNodeKind =
  | 'mode-index'
  | 'directory'
  | 'workshop-resources'
  | 'domain-hub'
  | 'concept'
  | 'scene'
  | 'workbench-topic'
  | 'lesson'
  | 'lesson-step'
  | 'mission'
  | 'week'

export interface RouteNode {
  readonly route: string
  readonly kind: RouteNodeKind
  readonly label: string
  readonly parsed: ParsedRoute
}

export interface RouteEdge {
  readonly from: string
  readonly to: string
  readonly source: string
  readonly kind: 'navigation' | 'content' | 'in-place' | 'step' | 'fallback-back'
}

export interface LinkGraph {
  readonly roots: readonly string[]
  readonly nodes: readonly RouteNode[]
  readonly nodeMap: ReadonlyMap<string, RouteNode>
  readonly edges: readonly RouteEdge[]
}

export interface VerificationReport {
  readonly ok: boolean
  readonly stateMachineCount: number
  readonly nodeCount: number
  readonly edgeCount: number
  readonly reachableCount: number
  readonly maxFallbackDepth: number
  readonly checkedWalks: number
  readonly errors: readonly string[]
}

const TOP_LEVEL_ROOTS = ['#learn', '#practice', '#weeks', '#atlas', '#resources'] as const
const TERMINAL_BACK_ROOTS = new Set([...TOP_LEVEL_ROOTS, '#atlas/domains'])

export function stateForRoute(parsed: ParsedRoute): AppState {
  if (parsed.view === 'workbench') {
    if (parsed.scene === 'a30') {
      const validTopic = parsed.nodeTopic && Object.hasOwn(topics, parsed.nodeTopic) ? parsed.nodeTopic : 'gpu'
      return updateState(initialState, { type: 'browse', scene: 'a30', topic: validTopic })
    }
    const validClusterTopic =
      parsed.clusterTopic && Object.hasOwn(clusterTopics, parsed.clusterTopic) ? parsed.clusterTopic : 'a30'
    return updateState(initialState, { type: 'browse', scene: 'cluster', topic: validClusterTopic })
  }
  return { ...initialState }
}

export function canonicalizeParsedRoute(parsed: ParsedRoute, sceneState: AppState = stateForRoute(parsed)): string {
  switch (parsed.view) {
    case 'learn':
      return '#learn'
    case 'practice':
      return parsed.mission ? `#practice/${parsed.mission}` : '#practice'
    case 'weeks':
      return parsed.week ? `#weeks/${parsed.week}` : '#weeks'
    case 'resources':
      return resourcesRoute(parsed.workshop)
    case 'concept':
      return `#atlas/concept/${parsed.id}`
    case 'atlas':
      return parsed.mode === 'domains' ? '#atlas/domains' : '#atlas'
    case 'hub':
      return `#atlas/${parsed.category}`
    case 'lesson':
      return parsed.step ? `#lesson/${parsed.lesson}/${parsed.step}` : `#lesson/${parsed.lesson}`
    case 'workbench': {
      const subject = sceneState.scene === 'a30' ? sceneState.selected : sceneState.clusterSelected
      const defaultSubject = sceneState.scene === 'a30' ? 'gpu' : 'a30'
      return `#${sceneState.scene}${subject === defaultSubject ? '' : `/${subject}`}`
    }
  }
}

export function extractHtmlRoutes(html: string): string[] {
  const found: string[] = []
  const attrPattern = /\b(?:href|data-route)="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = attrPattern.exec(html)) !== null) {
    const value = match[1]!
    if (value.startsWith('#')) found.push(value)
  }
  return [...new Set(found)]
}

function isStrictValidHash(rawHash: string): { valid: boolean; reason?: string; canonical?: string } {
  if (!rawHash.startsWith('#')) {
    return { valid: false, reason: `Expected hash route starting with '#', got '${rawHash}'` }
  }
  const cleaned = rawHash.slice(1).trim()
  if (!cleaned) return { valid: true, canonical: '#atlas' }

  const segments = cleaned.split('/')
  const [head, tail, third, extra] = segments
  if (extra !== undefined) {
    return { valid: false, reason: `Too many route segments in '${rawHash}'` }
  }

  if (head === 'learn' && segments.length === 1) {
    return { valid: true, canonical: '#learn' }
  }
  if (head === 'resources') {
    if (segments.length === 1) return { valid: true, canonical: resourcesRoute() }
    if (segments.length === 2 && tail && getWorkshopResource(tail)) {
      return { valid: true, canonical: resourcesRoute(tail) }
    }
    return { valid: false, reason: `Unknown workshop materials route '${rawHash}'` }
  }
  if (head === 'practice') {
    if (segments.length === 1) return { valid: true, canonical: '#practice' }
    if (segments.length === 2 && Object.hasOwn(missionLessons, tail!)) {
      return { valid: true, canonical: `#practice/${Number(tail)}` }
    }
    return { valid: false, reason: `Unknown practice mission route '${rawHash}'` }
  }
  if (head === 'weeks') {
    if (segments.length === 1) return { valid: true, canonical: '#weeks' }
    if (segments.length === 2 && weeks.some(w => w.id === tail)) {
      return { valid: true, canonical: `#weeks/${tail}` }
    }
    return { valid: false, reason: `Unknown workshop week route '${rawHash}'` }
  }
  if (head === 'atlas') {
    if (segments.length === 1 || (segments.length === 2 && tail === 'all')) {
      return { valid: true, canonical: '#atlas' }
    }
    if (segments.length === 2 && tail === 'domains') {
      return { valid: true, canonical: '#atlas/domains' }
    }
    if (segments.length === 2 && isCategoryId(tail)) {
      return { valid: true, canonical: `#atlas/${tail}` }
    }
    if (segments.length === 3 && tail === 'concept') {
      const entry = getEntry(third ?? '')
      if (!entry) return { valid: false, reason: `Missing catalog concept '${third}' in '${rawHash}'` }
      if (entry.kind === 'planned') return { valid: false, reason: `Planned entry '${third}' cannot be a concept target` }
      if (entry.kind !== 'subject') return { valid: false, reason: `Entry '${third}' is '${entry.kind}', expected 'subject'` }
      return { valid: true, canonical: `#atlas/concept/${third}` }
    }
    return { valid: false, reason: `Invalid atlas route '${rawHash}'` }
  }
  if (head === 'cluster') {
    if (segments.length === 1) return { valid: true, canonical: '#cluster' }
    if (segments.length === 2 && tail && Object.hasOwn(clusterTopics, tail)) {
      return { valid: true, canonical: tail === 'a30' ? '#cluster' : `#cluster/${tail}` }
    }
    return { valid: false, reason: `Unknown cluster topic in '${rawHash}'` }
  }
  if (head === 'a30') {
    if (segments.length === 1) return { valid: true, canonical: '#a30' }
    if (segments.length === 2 && tail && Object.hasOwn(topics, tail)) {
      return { valid: true, canonical: tail === 'gpu' ? '#a30' : `#a30/${tail}` }
    }
    return { valid: false, reason: `Unknown A30 node topic in '${rawHash}'` }
  }
  if (head === 'lesson') {
    if (!isLessonId(tail)) return { valid: false, reason: `Unknown lesson '${tail ?? ''}' in '${rawHash}'` }
    if (segments.length === 2) return { valid: true, canonical: `#lesson/${tail}` }
    if (segments.length === 3 && third && /^[1-9]\d*$/.test(third)) {
      const stepNum = Number(third)
      const maxStep = LESSON_STEP_COUNTS[tail]
      if (stepNum >= 1 && stepNum <= maxStep) {
        return { valid: true, canonical: `#lesson/${tail}/${stepNum}` }
      }
      return { valid: false, reason: `Step ${stepNum} out of bounds (1..${maxStep}) in '${rawHash}'` }
    }
    return { valid: false, reason: `Invalid lesson step route '${rawHash}'` }
  }
  if (head === 'scenario' && segments.length === 2) {
    if (tail === 'gpu-copy') return { valid: true, canonical: '#lesson/host-to-gpu' }
    if (tail === 'first-job') return { valid: true, canonical: '#lesson/first-job' }
  }
  return { valid: false, reason: `Unrecognized hash route '${rawHash}'` }
}

export function buildLinkGraph(): LinkGraph {
  const nodes: RouteNode[] = []
  const addNode = (route: string, kind: RouteNodeKind, label: string) => {
    nodes.push({ route, kind, label, parsed: parseRoute(route) })
  }

  // 1. Top-level destinations
  addNode('#learn', 'mode-index', 'Guided walkthroughs')
  addNode('#practice', 'mode-index', 'Practice missions')
  addNode('#weeks', 'mode-index', 'Weekly workshops')
  addNode('#atlas', 'mode-index', 'Concept & scenario atlas (All)')
  addNode('#atlas/domains', 'mode-index', 'Explore by domain')
  addNode(resourcesRoute(), 'directory', 'Resources')
  for (const workshop of workshopResources) {
    addNode(resourcesRoute(workshop.id), 'workshop-resources', workshop.title)
  }

  // 2. Domain hubs
  for (const cat of categories) {
    addNode(`#atlas/${cat.id}`, 'domain-hub', cat.name)
  }

  // 3. Practice missions
  for (const level of levels) {
    addNode(`#practice/${level.id}`, 'mission', `Mission ${level.id}: ${level.title}`)
  }

  // 4. Workshop weeks
  for (const week of weeks) {
    addNode(`#weeks/${week.id}`, 'week', week.title)
  }

  // 5. Concept reference sheets
  for (const entry of entries) {
    if (entry.kind === 'subject') {
      addNode(`#atlas/concept/${entry.id}`, 'concept', entry.title)
    }
  }

  // 6. Explore workbench scenes & topics
  for (const topicId of Object.keys(clusterTopics) as ClusterTopicId[]) {
    const route = topicId === 'a30' ? '#cluster' : `#cluster/${topicId}`
    addNode(route, topicId === 'a30' ? 'scene' : 'workbench-topic', `Cluster · ${clusterTopics[topicId].name}`)
  }
  for (const topicId of Object.keys(topics) as TopicId[]) {
    const route = topicId === 'gpu' ? '#a30' : `#a30/${topicId}`
    addNode(route, topicId === 'gpu' ? 'scene' : 'workbench-topic', `A30 · ${topics[topicId].name}`)
  }

  // 7. Scenario lessons & reader-paced steps
  const scenarioEntries = entries.filter((e): e is EntryDef & { target: { type: 'lesson'; lesson: LessonId } } => e.kind === 'scenario')
  for (const entry of scenarioEntries) {
    const lessonId = entry.target.lesson
    addNode(`#lesson/${lessonId}`, 'lesson', entry.title)
    const count = LESSON_STEP_COUNTS[lessonId]
    for (let step = 1; step <= count; step++) {
      addNode(`#lesson/${lessonId}/${step}`, 'lesson-step', `${entry.shortTitle} · Step ${step}`)
    }
  }

  const nodeMap = new Map(nodes.map(node => [node.route, node]))
  const edges: RouteEdge[] = []
  const edgeKeys = new Set<string>()
  const addEdge = (from: string, to: string, source: string, kind: RouteEdge['kind']) => {
    const key = `${from}|${to}|${source}|${kind}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ from, to, source, kind })
  }

  // Mode-level navigation shell from top-level roots
  for (const root of TOP_LEVEL_ROOTS) {
    for (const targetRoot of TOP_LEVEL_ROOTS) {
      if (root !== targetRoot) addEdge(root, targetRoot, 'src/layout.ts:top-modes', 'navigation')
    }
  }

  // Atlas (#atlas) & Domains (#atlas/domains)
  addEdge('#atlas', '#atlas/domains', 'src/layout.ts:data-atlas-mode', 'in-place')
  addEdge('#atlas/domains', '#atlas', 'src/layout.ts:data-atlas-mode', 'in-place')
  for (const cat of categories) {
    addEdge('#atlas', `#atlas/${cat.id}`, 'src/layout.ts:catalog-group-link', 'content')
    addEdge('#atlas/domains', `#atlas/${cat.id}`, 'src/layout.ts:domain-tile', 'content')
  }
  for (const entry of entries) {
    const route = routeForEntry(entry)
    if (!route) continue
    addEdge('#atlas', route, `src/catalog.ts:entry(${entry.id})`, 'content')
    if (entry.kind === 'scenario') {
      addEdge('#atlas/domains', route, `src/layout.ts:featured-scenario(${entry.id})`, 'content')
    }
  }

  // Domain hubs (#atlas/<category>)
  for (const cat of categories) {
    const hubRoute = `#atlas/${cat.id}`
    for (const entry of entriesForCategory(cat.id)) {
      const route = routeForEntry(entry)
      if (route) addEdge(hubRoute, route, `src/layout.ts:hub-tile(${entry.id})`, 'content')
    }
  }

  // Learn index (#learn)
  for (const entry of scenarioEntries) {
    const lessonId = entry.target.lesson
    const lessonRoute = routeForTarget(entry.target)
    if (lessonRoute) addEdge('#learn', lessonRoute, `src/platform/views.ts:learn-card(${lessonId})`, 'content')
    for (const href of extractHtmlRoutes(lessonLinks(lessonId))) {
      addEdge('#learn', href, `src/platform/links.ts:lessonLinks(${lessonId})`, 'content')
    }
  }

  // Practice index (#practice) & missions (#practice/1..6)
  for (const group of practiceGroups) {
    if (group.weekId) {
      addEdge('#practice', `#weeks/${group.weekId}`, `src/practice/workstation.ts:group(${group.id})`, 'content')
    }
    for (const missionId of group.missions) {
      addEdge('#practice', `#practice/${missionId}`, `src/practice/workstation.ts:mission-card(${missionId})`, 'content')
    }
  }
  for (const level of levels) {
    const missionRoute = `#practice/${level.id}`
    for (const lessonId of missionLessons[level.id] ?? []) {
      addEdge(missionRoute, `#lesson/${lessonId}`, `src/practice/workstation.ts:missionLessons(${level.id})`, 'content')
    }
    for (const awardKey of level.cards) {
      const conceptId = conceptForAward(awardKey)
      for (const href of extractHtmlRoutes(entryLink(conceptId))) {
        addEdge(missionRoute, href, `src/practice/workstation.ts:card(${awardKey})`, 'content')
      }
    }
    for (const week of weeks.filter(w => w.missions.includes(level.id))) {
      addEdge(missionRoute, `#weeks/${week.id}`, `src/practice/workstation.ts:week(${week.id})`, 'content')
    }
    const nextRoute = levels.some(item => item.id === level.id + 1) ? `#practice/${level.id + 1}` : '#practice'
    addEdge(missionRoute, nextRoute, `src/practice/workstation.ts:next(${level.id})`, 'content')
  }

  // Weeks index (#weeks) & week detail (#weeks/<id>)
  for (const week of weeks) {
    const weekRoute = `#weeks/${week.id}`
    addEdge('#weeks', weekRoute, `src/platform/views.ts:week-card(${week.id})`, 'content')
    for (const href of extractHtmlRoutes(renderWorkshopMaterialsLink(week.id))) {
      addEdge(weekRoute, href, 'src/platform/resources.ts:renderWorkshopMaterialsLink', 'content')
    }
    for (const lessonId of week.lessons) {
      for (const href of extractHtmlRoutes(entryLink(lessonId))) {
        addEdge(weekRoute, href, `src/platform/views.ts:week.lessons(${lessonId})`, 'content')
      }
    }
    for (const missionId of week.missions) {
      addEdge(weekRoute, `#practice/${missionId}`, `src/platform/views.ts:week.missions(${missionId})`, 'content')
    }
    for (const conceptId of week.concepts) {
      for (const href of extractHtmlRoutes(entryLink(conceptId))) {
        addEdge(weekRoute, href, `src/platform/views.ts:week.concepts(${conceptId})`, 'content')
      }
    }
  }

  // Resources directory and workshop materials
  for (const href of extractHtmlRoutes(renderResourceResults('all').html)) {
    addEdge(resourcesRoute(), href, 'src/platform/resources.ts:renderResourceResults', 'content')
  }
  for (const workshop of workshopResources) {
    for (const href of extractHtmlRoutes(renderWorkshopResources(workshop))) {
      addEdge(resourcesRoute(workshop.id), href, 'src/platform/resources.ts:renderWorkshopResources', 'content')
    }
  }

  // Concept sheets (#atlas/concept/<id>)
  for (const entry of entries) {
    if (entry.kind !== 'subject') continue
    const conceptRoute = `#atlas/concept/${entry.id}`
    if (entry.target.type === 'scene') {
      const sceneTarget = routeForTarget(entry.target)
      if (sceneTarget) {
        addEdge(conceptRoute, sceneTarget, `src/platform/views.ts:concept-scene(${entry.id})`, 'content')
      }
    }
    for (const scenario of scenarioEntries) {
      if (conceptsForLesson(scenario.target.lesson).includes(entry.id)) {
        const scenarioRoute = routeForTarget(scenario.target)
        if (scenarioRoute) {
          addEdge(conceptRoute, scenarioRoute, `src/platform/views.ts:concept-lesson(${entry.id}->${scenario.id})`, 'content')
        }
      }
    }
    for (const level of levels) {
      if (level.cards.some(key => conceptForAward(key) === entry.id)) {
        addEdge(conceptRoute, `#practice/${level.id}`, `src/platform/views.ts:concept-mission(${entry.id}->${level.id})`, 'content')
      }
    }
    for (const week of weeks) {
      if (week.concepts.includes(entry.id)) {
        addEdge(conceptRoute, `#weeks/${week.id}`, `src/platform/views.ts:concept-week(${entry.id}->${week.id})`, 'content')
      }
    }
  }

  // Cluster & A30 workbenches
  const allClusterRoutes = (Object.keys(clusterTopics) as ClusterTopicId[]).map(t => (t === 'a30' ? '#cluster' : `#cluster/${t}`))
  for (const topicId of Object.keys(clusterTopics) as ClusterTopicId[]) {
    const fromRoute = topicId === 'a30' ? '#cluster' : `#cluster/${topicId}`
    for (const toRoute of allClusterRoutes) {
      if (fromRoute !== toRoute) addEdge(fromRoute, toRoute, 'src/main.ts:cluster-subject-picker', 'in-place')
    }
    if (topicId === 'a30') {
      addEdge(fromRoute, '#a30', 'src/main.ts:open-anatomy', 'content')
    }
    const parsed = parseRoute(fromRoute)
    const sceneState = stateForRoute(parsed)
    const activeEntry = activeEntryForState(parsed, sceneState)
    if (activeEntry) {
      const linkedScenario = activeEntry.related
        .map(id => getEntry(id))
        .find((item): item is EntryDef => Boolean(item && item.kind === 'scenario'))
      if (linkedScenario) {
        const scenarioHref = routeForTarget(linkedScenario.target)
        if (scenarioHref) addEdge(fromRoute, scenarioHref, `src/main.ts:inspector-scenario(${activeEntry.id})`, 'content')
      }
      if (activeEntry.kind === 'subject') {
        addEdge(fromRoute, `#atlas/concept/${activeEntry.id}`, `src/main.ts:inspector-reference(${activeEntry.id})`, 'content')
      }
      for (const rel of activeEntry.related.map(id => getEntry(id)).filter((item): item is EntryDef => Boolean(item && item.kind !== 'planned')).slice(0, 4)) {
        const relHref = routeForEntry(rel)
        if (relHref) addEdge(fromRoute, relHref, `src/main.ts:related-strip(${activeEntry.id}->${rel.id})`, 'content')
      }
    }
  }

  const allNodeRoutes = (Object.keys(topics) as TopicId[]).map(t => (t === 'gpu' ? '#a30' : `#a30/${t}`))
  for (const topicId of Object.keys(topics) as TopicId[]) {
    const fromRoute = topicId === 'gpu' ? '#a30' : `#a30/${topicId}`
    for (const toRoute of allNodeRoutes) {
      if (fromRoute !== toRoute) addEdge(fromRoute, toRoute, 'src/main.ts:a30-subject-picker', 'in-place')
    }
    for (const relTopic of topics[topicId].related) {
      const relRoute = relTopic === 'gpu' ? '#a30' : `#a30/${relTopic}`
      addEdge(fromRoute, relRoute, `src/model.ts:topics.${topicId}.related`, 'in-place')
    }
    const parsed = parseRoute(fromRoute)
    const sceneState = stateForRoute(parsed)
    const activeEntry = activeEntryForState(parsed, sceneState)
    const cardId = activeEntry?.kind === 'subject' ? activeEntry.id : topicId === 'gpu' ? 'gpu-device' : undefined
    if (cardId) {
      addEdge(fromRoute, `#atlas/concept/${cardId}`, `src/main.ts:inspector-reference(${cardId})`, 'content')
    }
    if (activeEntry) {
      const linkedScenario = activeEntry.related
        .map(id => getEntry(id))
        .find((item): item is EntryDef => Boolean(item && item.kind === 'scenario'))
      if (linkedScenario) {
        const scenarioHref = routeForTarget(linkedScenario.target)
        if (scenarioHref) addEdge(fromRoute, scenarioHref, `src/main.ts:inspector-scenario(${activeEntry.id})`, 'content')
      }
      for (const rel of activeEntry.related.map(id => getEntry(id)).filter((item): item is EntryDef => Boolean(item && item.kind !== 'planned')).slice(0, 4)) {
        const relHref = routeForEntry(rel)
        if (relHref) addEdge(fromRoute, relHref, `src/main.ts:related-strip(${activeEntry.id}->${rel.id})`, 'content')
      }
    }
  }

  // Scenario lessons (#lesson/<id>) & step deep-links (#lesson/<id>/<step>)
  for (const entry of scenarioEntries) {
    const lessonId = entry.target.lesson
    const baseRoute = `#lesson/${lessonId}`
    const stepCount = LESSON_STEP_COUNTS[lessonId]
    const extraHrefs = extractHtmlRoutes(lessonLinks(lessonId))
    const relatedHrefs = entry.related
      .map(id => getEntry(id))
      .filter((item): item is EntryDef => Boolean(item && item.kind !== 'planned'))
      .slice(0, 4)
      .map(item => routeForEntry(item)!)

    for (let step = 1; step <= stepCount; step++) {
      const stepRoute = `#lesson/${lessonId}/${step}`
      addEdge(baseRoute, stepRoute, `src/stage/player.ts:dispatch(goto:${lessonId}:${step})`, 'step')
      if (step > 1) addEdge(stepRoute, `#lesson/${lessonId}/${step - 1}`, `src/stage/player.ts:dispatch(prev:${lessonId})`, 'step')
      if (step < stepCount) addEdge(stepRoute, `#lesson/${lessonId}/${step + 1}`, `src/stage/player.ts:dispatch(next:${lessonId})`, 'step')
      for (const href of extraHrefs) addEdge(stepRoute, href, `src/platform/links.ts:lessonLinks(${lessonId})`, 'content')
      for (const href of relatedHrefs) addEdge(stepRoute, href, `src/main.ts:related-strip(${lessonId})`, 'content')
    }
    for (const href of extraHrefs) addEdge(baseRoute, href, `src/platform/links.ts:lessonLinks(${lessonId})`, 'content')
    for (const href of relatedHrefs) addEdge(baseRoute, href, `src/main.ts:related-strip(${lessonId})`, 'content')
  }

  // Fallback Think Back edges
  for (const node of nodes) {
    const fallback = fallbackBackTarget(node.parsed, stateForRoute(node.parsed))
    if (fallback) {
      addEdge(node.route, fallback.route, `src/catalog.ts:fallbackBackTarget(${node.route})`, 'fallback-back')
    }
  }

  return {
    roots: TOP_LEVEL_ROOTS,
    nodes,
    nodeMap,
    edges,
  }
}

export function verifyStateMachines(graph: LinkGraph = buildLinkGraph()): VerificationReport {
  const errors: string[] = []

  // Invariant (a): Canonical route round-tripping, outgoing #hash validity, planned target exclusion, legacy alias normalization
  for (const node of graph.nodes) {
    const check = isStrictValidHash(node.route)
    if (!check.valid || check.canonical !== node.route) {
      errors.push(`Canonical node '${node.route}' failed strict validation: ${check.reason ?? `got '${check.canonical}'`}`)
    }
    const roundTrip = canonicalizeParsedRoute(node.parsed, stateForRoute(node.parsed))
    if (roundTrip !== node.route) {
      errors.push(`Canonical node '${node.route}' round-tripped to '${roundTrip}'`)
    }
  }

  for (const edge of graph.edges) {
    if (!graph.nodeMap.has(edge.from)) {
      errors.push(`Edge source '${edge.from}' (${edge.source}) is not a registered canonical route`)
    }
    const check = isStrictValidHash(edge.to)
    if (!check.valid) {
      errors.push(`Outgoing link '${edge.from}' -> '${edge.to}' (${edge.source}) is invalid: ${check.reason}`)
      continue
    }
    if (!graph.nodeMap.has(check.canonical!)) {
      errors.push(`Outgoing link '${edge.from}' -> '${edge.to}' (${edge.source}) resolved to unregistered '${check.canonical}'`)
    }
  }

  // Verify Quick Switcher destinations
  for (const dest of searchDestinations('')) {
    const check = isStrictValidHash(dest.route)
    if (!check.valid || !graph.nodeMap.has(check.canonical!)) {
      errors.push(`Quick Switcher destination '${dest.title}' -> '${dest.route}' is invalid: ${check.reason ?? 'missing node'}`)
    }
  }

  // Verify planned entries never expose routes or search jump targets
  for (const entry of entries) {
    if (entry.kind === 'planned') {
      if (routeForEntry(entry) !== null || routeForTarget(entry.target) !== null) {
        errors.push(`Planned entry '${entry.id}' unexpectedly exposes a route`)
      }
    } else {
      const route = routeForEntry(entry)
      if (!route || !graph.nodeMap.has(route)) {
        errors.push(`Active entry '${entry.id}' (${entry.kind}) lacks a canonical route node (got '${String(route)}')`)
      }
      if (entry.kind === 'scenario') {
        const lessonId = entry.id as LessonId
        if (entry.segments !== LESSON_STEP_COUNTS[lessonId]) {
          errors.push(`Scenario '${lessonId}' declares segments=${entry.segments}, but story has ${LESSON_STEP_COUNTS[lessonId]} steps`)
        }
      }
    }
    for (const relatedId of entry.related) {
      if (!getEntry(relatedId)) {
        errors.push(`Entry '${entry.id}' references unknown related entry '${relatedId}'`)
      }
    }
  }

  // Verify legacy aliases normalize cleanly
  const aliasExpectations: readonly [string, string][] = [
    ['', '#atlas'],
    ['#atlas/all', '#atlas'],
    ['#cluster/a30', '#cluster'],
    ['#a30/gpu', '#a30'],
    ['#scenario/gpu-copy', '#lesson/host-to-gpu'],
    ['#scenario/first-job', '#lesson/first-job'],
  ]
  for (const [alias, expected] of aliasExpectations) {
    const parsed = parseRoute(alias)
    const canonical = canonicalizeParsedRoute(parsed, stateForRoute(parsed))
    if (canonical !== expected || !graph.nodeMap.has(canonical)) {
      errors.push(`Legacy alias '${alias}' normalized to '${canonical}', expected '${expected}'`)
    }
  }
  for (const [queryValue, expectedHash] of [
    ['gpu-copy-sol', '#lesson/host-to-gpu'],
    ['job-walkthrough', '#lesson/first-job'],
    ['lmod', '#lesson/module-load'],
    ['streams', '#lesson/streams'],
  ] as const) {
    const normalized = normalizeLessonUrl(`https://hpc4.example/?lesson=${queryValue}`)
    if (normalized !== `https://hpc4.example/${expectedHash}`) {
      errors.push(`normalizeLessonUrl(?lesson=${queryValue}) returned '${String(normalized)}'`)
    }
  }

  // Invariant (b): Full reachability from top-level modes (excluding fallback-back edges so reachability proves forward discovery)
  const forwardAdj = new Map<string, string[]>()
  for (const node of graph.nodes) forwardAdj.set(node.route, [])
  for (const edge of graph.edges) {
    if (edge.kind === 'fallback-back') continue
    const canonicalTo = isStrictValidHash(edge.to).canonical
    if (canonicalTo && forwardAdj.has(edge.from)) {
      forwardAdj.get(edge.from)!.push(canonicalTo)
    }
  }

  const visited = new Set<string>(graph.roots)
  const queue: string[] = [...graph.roots]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of forwardAdj.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.route)) {
      errors.push(`Orphan canonical route unreachable from top-level modes: '${node.route}' (${node.kind}: ${node.label})`)
    }
  }

  for (const codexId of Object.keys(codex)) {
    const conceptRoute = `#atlas/concept/${codexId}`
    if (!visited.has(conceptRoute)) {
      errors.push(`Codex card '${codexId}' is missing or unreachable at '${conceptRoute}'`)
    }
  }

  // Invariant (c): Think Back fallback & pushTrail / pruneTrailForDestination / popTrail termination and loop-freedom
  let maxFallbackDepth = 0
  for (const node of graph.nodes) {
    let cursor = node.route
    const seen = new Set<string>([cursor])
    let depth = 0
    while (true) {
      const parsed = parseRoute(cursor)
      const fb = fallbackBackTarget(parsed, stateForRoute(parsed))
      if (!fb) {
        if (!TERMINAL_BACK_ROOTS.has(cursor)) {
          errors.push(`Route '${node.route}' terminated fallbackBackTarget at non-root '${cursor}'`)
        }
        break
      }
      if (fb.route === cursor) {
        errors.push(`Self-loop in fallbackBackTarget at '${cursor}'`)
        break
      }
      if (seen.has(fb.route)) {
        errors.push(`Cycle in fallbackBackTarget starting at '${node.route}': revisited '${fb.route}'`)
        break
      }
      if (!graph.nodeMap.has(fb.route)) {
        errors.push(`fallbackBackTarget('${cursor}') points to unknown route '${fb.route}'`)
        break
      }
      seen.add(fb.route)
      cursor = fb.route
      depth++
      if (depth > 8) {
        errors.push(`fallbackBackTarget exceeded max depth 8 from '${node.route}'`)
        break
      }
    }
    if (depth > maxFallbackDepth) maxFallbackDepth = depth
  }

  // Exhaustively verify trail behavior across bounded forward + in-place walks and full Think Back unwinds
  let checkedWalks = 0
  const verifyBackUnwind = (startRoute: string, startTrail: readonly TrailItem[], context: string) => {
    checkedWalks++
    if (startTrail.at(-1)?.route === startRoute) {
      errors.push(`Trail top equals current route '${startRoute}' after ${context}`)
      return
    }
    let current = startRoute
    let stack = [...startTrail]
    let steps = 0
    const maxSteps = stack.length + 4
    while (true) {
      const popped = popTrail(stack)
      if (popped.target) {
        if (popped.target.route === current) {
          errors.push(`popTrail produced self-loop '${current}' during unwind from ${context}`)
          return
        }
        current = popped.target.route
        stack = pruneTrailForDestination(popped.rest, current)
      } else {
        const parsed = parseRoute(current)
        const fb = fallbackBackTarget(parsed, stateForRoute(parsed))
        if (!fb) {
          if (!TERMINAL_BACK_ROOTS.has(current)) {
            errors.push(`Think Back unwind ended at non-hub '${current}' from ${context}`)
          }
          return
        }
        if (fb.route === current) {
          errors.push(`Fallback produced self-loop '${current}' during unwind from ${context}`)
          return
        }
        current = fb.route
      }
      steps++
      if (steps > maxSteps) {
        errors.push(`Think Back unwind failed to terminate within ${maxSteps} steps from ${context}`)
        return
      }
    }
  }

  const advanceNav = (from: string, to: string, edgeKind: RouteEdge['kind'], stack: readonly TrailItem[]): TrailItem[] => {
    if (edgeKind === 'in-place' || edgeKind === 'step') {
      return pruneTrailForDestination(stack, to)
    }
    const parsedFrom = parseRoute(from)
    const snap = trailSnapshotForCurrent(parsedFrom, from, stateForRoute(parsedFrom))
    return pushTrail(stack, snap, to)
  }

  const edgesByFrom = new Map<string, RouteEdge[]>()
  for (const node of graph.nodes) edgesByFrom.set(node.route, [])
  for (const edge of graph.edges) {
    if (edge.kind !== 'fallback-back') edgesByFrom.get(edge.from)?.push(edge)
  }

  for (const node of graph.nodes) {
    // Self-navigation must never push self onto trail
    const selfTrail = advanceNav(node.route, node.route, 'content', [])
    verifyBackUnwind(node.route, selfTrail, `self(${node.route})`)

    for (const e1 of edgesByFrom.get(node.route) ?? []) {
      const t1 = advanceNav(node.route, e1.to, e1.kind, [])
      verifyBackUnwind(e1.to, t1, `${node.route} -> ${e1.to}`)
      // Consecutive duplicate push + ping-pong return + 2nd-hop walk
      const dup = advanceNav(e1.to, e1.to, 'content', t1)
      verifyBackUnwind(e1.to, dup, `${node.route} -> ${e1.to} (dup)`)
      const pingPong = advanceNav(e1.to, node.route, 'content', t1)
      verifyBackUnwind(node.route, pingPong, `${node.route} -> ${e1.to} -> ${node.route}`)
      const inPlaceReturn = advanceNav(e1.to, node.route, 'in-place', t1)
      verifyBackUnwind(node.route, inPlaceReturn, `${node.route} -> ${e1.to} ~in-place~> ${node.route}`)

      for (const e2 of (edgesByFrom.get(e1.to) ?? []).slice(0, 6)) {
        const t2 = advanceNav(e1.to, e2.to, e2.kind, t1)
        verifyBackUnwind(e2.to, t2, `${node.route} -> ${e1.to} -> ${e2.to}`)
      }
    }
  }

  // Verify 12-item trail cap unwinds cleanly
  let longTrail: TrailItem[] = []
  let cursor = '#atlas'
  for (let i = 0; i < 18; i++) {
    const next = (edgesByFrom.get(cursor) ?? [])[i % Math.max(1, (edgesByFrom.get(cursor) ?? []).length)]?.to ?? '#learn'
    longTrail = advanceNav(cursor, next, 'content', longTrail)
    cursor = next
  }
  if (longTrail.length > 12) {
    errors.push(`pushTrail exceeded 12-entry cap (length=${longTrail.length})`)
  }
  verifyBackUnwind(cursor, longTrail, '18-step capped walk')

  // Invariant (d): Bidirectional cross-link consistency (lesson <-> concept, mission <-> concept, lesson <-> mission, week <-> *)
  const lessonIds = entries
    .filter((e): e is EntryDef & { target: { type: 'lesson'; lesson: LessonId } } => e.kind === 'scenario')
    .map(e => e.target.lesson)
  const subjectIds = new Set(entries.filter(e => e.kind === 'subject').map(e => e.id))

  // d1. lesson <-> concept
  for (const lessonId of lessonIds) {
    const linkedConcepts = conceptsForLesson(lessonId)
    if (linkedConcepts.length === 0) {
      errors.push(`Scenario '${lessonId}' has zero linked concepts in conceptsForLesson`)
    }
    for (const conceptId of linkedConcepts) {
      if (!subjectIds.has(conceptId)) {
        errors.push(`conceptsForLesson('${lessonId}') returned non-subject '${conceptId}'`)
        continue
      }
      const hasForward = graph.edges.some(e => e.from === `#lesson/${lessonId}` && e.to === `#atlas/concept/${conceptId}`)
      const hasReverse = graph.edges.some(e => e.from === `#atlas/concept/${conceptId}` && e.to === `#lesson/${lessonId}`)
      if (!hasForward || !hasReverse) {
        errors.push(`Broken bidirectional lesson <-> concept link between '#lesson/${lessonId}' and '#atlas/concept/${conceptId}'`)
      }
    }
  }

  // d2. mission <-> concept
  for (const level of levels) {
    if (level.cards.length === 0) {
      errors.push(`Mission ${level.id} awards zero codex cards`)
    }
    for (const awardKey of level.cards) {
      const conceptId = conceptForAward(awardKey)
      if (!Object.hasOwn(codex, conceptId)) {
        errors.push(`Mission ${level.id} card '${awardKey}' mapped to '${conceptId}', which is absent from codex`)
      }
      if (!subjectIds.has(conceptId)) {
        errors.push(`Mission ${level.id} card '${awardKey}' mapped to '${conceptId}', which is not a catalog subject`)
      }
      const hasForward = graph.edges.some(e => e.from === `#practice/${level.id}` && e.to === `#atlas/concept/${conceptId}`)
      const hasReverse = graph.edges.some(e => e.from === `#atlas/concept/${conceptId}` && e.to === `#practice/${level.id}`)
      if (!hasForward || !hasReverse) {
        errors.push(`Broken bidirectional mission <-> concept link between '#practice/${level.id}' and '#atlas/concept/${conceptId}'`)
      }
    }
  }

  // d3. lesson <-> mission
  for (const level of levels) {
    const mappedLessons = missionLessons[level.id]
    if (!mappedLessons || mappedLessons.length === 0) {
      errors.push(`Mission ${level.id} has no mapped walkthrough in missionLessons`)
      continue
    }
    for (const lessonId of mappedLessons) {
      if (!isLessonId(lessonId)) {
        errors.push(`missionLessons[${level.id}] references invalid lesson '${lessonId}'`)
      }
      const hasForward = graph.edges.some(e => e.from === `#practice/${level.id}` && e.to === `#lesson/${lessonId}`)
      const hasReverse = graph.edges.some(e => e.from === `#lesson/${lessonId}` && e.to === `#practice/${level.id}`)
      if (!hasForward || !hasReverse) {
        errors.push(`Broken bidirectional mission <-> lesson link between '#practice/${level.id}' and '#lesson/${lessonId}'`)
      }
    }
  }

  // d4. week <-> {lesson, mission, concept}
  for (const week of weeks) {
    for (const lessonId of week.lessons) {
      const hasForward = graph.edges.some(e => e.from === `#weeks/${week.id}` && e.to === `#lesson/${lessonId}`)
      const hasReverse = graph.edges.some(e => e.from === `#lesson/${lessonId}` && e.to === `#weeks/${week.id}`)
      if (!hasForward || !hasReverse) {
        errors.push(`Broken bidirectional week <-> lesson link between '#weeks/${week.id}' and '#lesson/${lessonId}'`)
      }
    }
    for (const missionId of week.missions) {
      const hasForward = graph.edges.some(e => e.from === `#weeks/${week.id}` && e.to === `#practice/${missionId}`)
      const hasReverse = graph.edges.some(e => e.from === `#practice/${missionId}` && e.to === `#weeks/${week.id}`)
      if (!hasForward || !hasReverse) {
        errors.push(`Broken bidirectional week <-> mission link between '#weeks/${week.id}' and '#practice/${missionId}'`)
      }
    }
    for (const conceptId of week.concepts) {
      const hasForward = graph.edges.some(e => e.from === `#weeks/${week.id}` && e.to === `#atlas/concept/${conceptId}`)
      const hasReverse = graph.edges.some(e => e.from === `#atlas/concept/${conceptId}` && e.to === `#weeks/${week.id}`)
      if (!hasForward || !hasReverse) {
        errors.push(`Broken bidirectional week <-> concept link between '#weeks/${week.id}' and '#atlas/concept/${conceptId}'`)
      }
    }
  }

  for (const workshop of workshopResources) {
    if (!workshop.weekId) continue
    const weekRoute = `#weeks/${workshop.weekId}`
    const workshopRoute = resourcesRoute(workshop.id)
    const toMaterials = graph.edges.some(edge => edge.from === weekRoute && edge.to === workshopRoute)
    const toWeek = graph.edges.some(edge => edge.from === workshopRoute && edge.to === weekRoute)
    if (!toMaterials || !toWeek) {
      errors.push(`Broken bidirectional week <-> workshop materials link between '${weekRoute}' and '${workshopRoute}'`)
    }
  }

  // Verify every CategoryId has at least one active entry
  for (const cat of categories) {
    const activeInCat = entriesForCategory(cat.id as CategoryId).filter(e => e.kind !== 'planned')
    if (activeInCat.length === 0) {
      errors.push(`Category '${getCategory(cat.id).name}' (${cat.id}) has zero active entries`)
    }
  }

  return {
    ok: errors.length === 0,
    stateMachineCount: STATE_MACHINES.length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    reachableCount: visited.size,
    maxFallbackDepth,
    checkedWalks,
    errors,
  }
}

export function renderMermaidStatecharts(graph: LinkGraph = buildLinkGraph()): string {
  const counts = new Map<RouteNodeKind, number>()
  for (const node of graph.nodes) {
    counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1)
  }

  return [
    '# HPC4 Hub — Explicit State-Machine & Route Graph Charts',
    '',
    '## 1. Mode & Canonical Route Graph (`src/catalog.ts` + `src/main.ts`)',
    '',
    '```mermaid',
    'stateDiagram-v2',
    '  state "Atlas (#atlas, #atlas/domains)" as Atlas',
    `  state "Domain Hubs (#atlas/<cat> · ${counts.get('domain-hub') ?? 0})" as Hubs`,
    `  state "Concept Sheets (#atlas/concept/<id> · ${counts.get('concept') ?? 0})" as Concepts`,
    `  state "Explore Workbenches (#cluster/*, #a30/* · ${(counts.get('scene') ?? 0) + (counts.get('workbench-topic') ?? 0)})" as Workbench`,
    '  state "Learn Index (#learn)" as Learn',
    `  state "Scenario Stage (#lesson/<id>[/<step>] · ${(counts.get('lesson') ?? 0) + (counts.get('lesson-step') ?? 0)})" as Stage`,
    '  state "Practice Index (#practice)" as Practice',
    `  state "Simulated Missions (#practice/1..6 · ${counts.get('mission') ?? 0})" as Missions`,
    '  state "Weeks Index (#weeks)" as Weeks',
    `  state "Workshop Briefs (#weeks/asc01 · ${counts.get('week') ?? 0})" as WeekDetail`,
    '  state "Resources (#resources)" as Resources',
    `  state "Workshop Materials (#resources/<id> · ${counts.get('workshop-resources') ?? 0})" as WorkshopMaterials`,
    '',
    '  [*] --> Atlas',
    '  Atlas --> Hubs: domain shelf / group header',
    '  Atlas --> Concepts: subject tile',
    '  Atlas --> Workbench: scene tile (#cluster, #a30)',
    '  Atlas --> Stage: scenario tile',
    '  Atlas --> Resources: Hub navigation',
    '  Resources --> Atlas: Hub navigation',
    '  Resources --> WorkshopMaterials: open workshop',
    '  WorkshopMaterials --> Resources: Back to directory',
    '  WeekDetail --> WorkshopMaterials: Workshop materials',
    '  WorkshopMaterials --> WeekDetail: Follow in Weeks',
    '  Hubs --> Concepts: domain subject tile',
    '  Hubs --> Workbench: domain scene tile',
    '  Hubs --> Stage: domain scenario tile',
    '  Hubs --> Atlas: Think Back fallback',
    '  Learn --> Stage: open walkthrough',
    '  Learn --> Missions: practice drill link',
    '  Learn --> Concepts: concept chip',
    '  Learn --> WeekDetail: workshop link',
    '  Stage --> Missions: rehearse in Practice',
    '  Stage --> Concepts: lessonLinks & related strip',
    '  Stage --> WeekDetail: accompanying week',
    '  Stage --> Hubs: Think Back fallback',
    '  Practice --> Missions: select mission 1..6',
    '  Practice --> WeekDetail: week brief link',
    '  Missions --> Stage: paired walkthrough',
    '  Missions --> Concepts: awarded codex cards',
    '  Missions --> WeekDetail: workshop week',
    '  Missions --> Practice: Think Back fallback',
    '  Weeks --> WeekDetail: open week',
    '  WeekDetail --> Stage: 01 / Learn',
    '  WeekDetail --> Missions: 02 / Practice',
    '  WeekDetail --> Concepts: 04 / Atlas',
    '  WeekDetail --> Weeks: Think Back fallback',
    '  Concepts --> Workbench: Inspect in scene',
    '  Concepts --> Stage: Learn scenario',
    '  Concepts --> Missions: Practice drill',
    '  Concepts --> WeekDetail: Workshop week',
    '  Concepts --> Hubs: Think Back fallback',
    '  Workbench --> Concepts: permanent reference',
    '  Workbench --> Stage: open linked scenario',
    '  Workbench --> Hubs: Think Back fallback',
    '```',
    '',
    '## 2. Explicit State-Machine Registry Summary',
    '',
    ...STATE_MACHINES.map(
      (sm, idx) =>
        `${idx + 1}. **${sm.name}** (\`${sm.id}\`)\n` +
        `   - Owners: ${sm.ownerFiles.map(f => `\`${f}\``).join(', ')}\n` +
        `   - Formal / Test Coverage: ${[...sm.verification.formalModels, ...sm.verification.scriptsAndTests].map(f => `\`${f}\``).join(', ')}`,
    ),
    '',
  ].join('\n')
}

function runCli(): void {
  const args = new Set(process.argv.slice(2))
  const graph = buildLinkGraph()
  const report = verifyStateMachines(graph)

  if (args.has('--mermaid')) {
    process.stdout.write(`${renderMermaidStatecharts(graph)}\n`)
    if (!report.ok) {
      for (const err of report.errors) process.stderr.write(`ERROR: ${err}\n`)
      process.exitCode = 1
    }
    return
  }

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({ stateMachines: STATE_MACHINES, report }, null, 2)}\n`)
    if (!report.ok) process.exitCode = 1
    return
  }

  const lines = [
    `HPC4 Hub Explicit State-Machine & Link-Graph Verifier`,
    `=====================================================`,
    `Registered state machines : ${report.stateMachineCount}`,
    ...STATE_MACHINES.map((sm, index) => `  ${index + 1}. ${sm.name} (${sm.ownerFiles[0]})`),
    `Canonical route nodes     : ${report.nodeCount}`,
    `Cross-link & back edges   : ${report.edgeCount}`,
    `Reachable from modes      : ${report.reachableCount} / ${report.nodeCount}`,
    `Max fallback Back depth   : ${report.maxFallbackDepth}`,
    `Think Back walks verified : ${report.checkedWalks}`,
    `Status                    : ${report.ok ? 'PASS (0 invariant violations)' : `FAIL (${report.errors.length} violations)`}`,
  ]
  process.stdout.write(`${lines.join('\n')}\n`)
  if (!report.ok) {
    for (const err of report.errors) process.stderr.write(`  - ${err}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
}
