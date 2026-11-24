import type { LessonOptions, LessonScene } from '../timed-lesson/player'
import { frameAt, timeline } from './story'
import type { FsPart } from './story'
import './player.css'

const parts: Record<FsPart, { name: string; label: string; role: string; detail: string }> = {
  root: { name: '/ (root)', label: '/', role: 'Start of absolute paths', detail: 'The top of the directory tree visible to this shell; every absolute path starts here.' },
  home: { name: '/home', label: '/home', role: 'User directories', detail: 'A common location for personal directories. This example mounts a shared filesystem here.' },
  'user-home': { name: '/home/asc01 (~)', label: 'asc01  ~', role: 'Example home directory', detail: 'The login in this example starts here. The shell expands ~ to your home directory.' },
  workspace: { name: '~/workspace', label: 'workspace', role: 'Workshop working folder', detail: 'From your home directory, cd workspace is relative. cd ~/workspace works from elsewhere too.' },
  dotfile: { name: '.bashrc', label: '.bashrc', role: 'Hidden shell configuration file', detail: 'The leading dot keeps it out of a plain ls listing. The file still exists; use ls -a to list it.' },
  opt: { name: '/opt', label: '/opt', role: 'Optional software and tools', detail: 'A common place for add-on tools and, in the workshop, the exercise scripts.' },
  quest: { name: '/opt/asc_quest', label: 'asc_quest', role: 'Workshop materials', detail: 'The workshop uses this directory to provide files and scripts for the exercises.' },
  tmp: { name: '/tmp', label: '/tmp', role: 'Temporary files', detail: 'In this example it is a directory on the node’s root disk. Other systems may give /tmp a separate filesystem.' },
  scratch: { name: '/scratch', label: '/scratch', role: 'Working data for jobs', detail: 'This example mounts shared scratch here. Whether scratch is local or shared, and when it is cleaned up, depends on the system.' },
  'local-disk': { name: 'Local root disk', label: 'Local disk', role: 'Backs / on this node', detail: 'Folders without a separate mount under /, including /tmp in this example, use the root filesystem.' },
  'shared-storage': { name: 'Shared storage', label: 'Shared storage', role: 'Mounts at /home and /scratch', detail: 'A mount attaches a filesystem to a path in the tree. Each node with the same shared filesystem mounted can see the same files.' },
}

const tree = ['root', 'home', 'opt', 'tmp', 'scratch', 'user-home', 'quest', 'workspace', 'dotfile'] as const
type TreePart = typeof tree[number]
const storage = ['local-disk', 'shared-storage'] as const
const children: Partial<Record<TreePart, readonly TreePart[]>> = {
  root: ['home', 'opt', 'tmp', 'scratch'],
  home: ['user-home'],
  opt: ['quest'],
  'user-home': ['workspace', 'dotfile'],
}
type Position = readonly [centerX: number, top: number, width: number]
const wide: Record<FsPart, Position> = {
  root: [459, 49, 108], home: [150, 117, 118], opt: [355, 117, 118], tmp: [560, 117, 118], scratch: [766, 117, 118],
  'user-home': [150, 180, 118], quest: [355, 180, 136], workspace: [90, 237, 130], dotfile: [226, 237, 108],
  'local-disk': [266, 327, 196], 'shared-storage': [655, 327, 223],
}
const narrow: Record<FsPart, Position> = {
  root: [195, 50, 78], home: [56, 114, 76], opt: [151, 114, 76], tmp: [244, 114, 76], scratch: [336, 114, 96],
  'user-home': [63, 173, 100], quest: [173, 173, 110], workspace: [68, 229, 114], dotfile: [190, 229, 100],
  'local-disk': [100, 317, 148], 'shared-storage': [292, 317, 166],
}

function part(id: FsPart, content: string): string {
  return `<g data-lesson-part="${id}" role="button" tabindex="-1" aria-label="${parts[id].name}" aria-pressed="false">${content}</g>`
}

function createScene(stage: HTMLElement): LessonScene {
  stage.classList.add('fs-stage')
  stage.innerHTML = `<svg class="story-art fs-art" viewBox="0 0 918 387" role="group" aria-labelledby="fs-title fs-desc">
    <title id="fs-title">Linux paths in one directory tree</title>
    <desc id="fs-desc">Follow the current directory when resolving paths, then compare the directory tree with the storage mounted behind it.</desc>
    <g class="fs-branches" aria-hidden="true">
      ${Object.entries(children).map(([id]) => `<path data-parent="${id}"/>`).join('')}
      <path class="fs-trace" pathLength="1" hidden/>
    </g>
    <g class="fs-mount-wires" aria-hidden="true" hidden>
      <path class="fs-root-mount"/>
      <path class="fs-shared-mount" hidden/>
    </g>
    <g class="fs-compare" aria-hidden="true">
      <text class="fs-small" y="21">Windows</text>
      <rect x="76" y="2" width="57" height="27"/><text class="fs-letter" x="104.5" y="21">C:\\</text>
      <rect x="141" y="2" width="57" height="27"/><text class="fs-letter" x="169.5" y="21">D:\\</text>
    </g>
    ${tree.map(id => part(id, `
      <rect class="fs-node" height="40"/>
      <text class="fs-name" y="25">${parts[id].label}</text>
      <text class="fs-backed-by" y="32" hidden></text>
    `)).join('')}
    <g class="fs-pwd" aria-hidden="true" hidden>
      <rect width="47" height="19"/>
      <circle cx="9" cy="9.5" r="2.5"/><text x="16" y="13">pwd</text>
    </g>
    <g class="fs-tray" hidden>
      <path class="fs-tray-rule" aria-hidden="true"/><text class="fs-small">Example backing storage</text>
      ${storage.map(id => part(id, `
        <rect class="fs-storage" height="50"/>
        <text class="fs-storage-name" x="12" y="22">${parts[id].label}</text>
        <text class="fs-small" x="12" y="39">${id === 'local-disk' ? 'Root filesystem' : '/home and /scratch'}</text>
      `)).join('')}
    </g>
  </svg>`

  const art = stage.querySelector<SVGSVGElement>('.fs-art')!
  const node = (id: FsPart) => art.querySelector<SVGGElement>(`[data-lesson-part="${id}"]`)!
  const trace = art.querySelector<SVGPathElement>('.fs-trace')!
  const wires = art.querySelector<SVGGElement>('.fs-mount-wires')!
  const rootMount = art.querySelector<SVGPathElement>('.fs-root-mount')!
  const sharedMount = art.querySelector<SVGPathElement>('.fs-shared-mount')!
  const compare = art.querySelector<SVGGElement>('.fs-compare')!
  const pwd = art.querySelector<SVGGElement>('.fs-pwd')!
  const tray = art.querySelector<SVGGElement>('.fs-tray')!
  const move = (item: SVGElement, x: number, y: number) => item.setAttribute('transform', `translate(${x} ${y})`)
  const cards = [...tree, ...storage].map(id => ({
    id, group: node(id), box: node(id).querySelector('rect')!,
    name: node(id).querySelector('text.fs-name'), backing: node(id).querySelector('text.fs-backed-by'),
  }))

  let positions = wide
  let compact: boolean | undefined
  let traceKey: string | undefined

  function branch(parent: TreePart, children: readonly TreePart[]): string {
    const [x, y] = positions[parent]
    const childX = children.map(id => positions[id][0])
    const targetY = positions[children[0]!][1]
    const junction = (y + 40 + targetY) / 2
    return `M ${x} ${y + 40} V ${junction} M ${Math.min(x, ...childX)} ${junction} H ${Math.max(x, ...childX)} ` +
      children.map(id => `M ${positions[id][0]} ${junction} V ${positions[id][1]}`).join(' ')
  }

  function resize(): void {
    const small = stage.clientWidth < 630
    if (small === compact) return
    compact = small
    positions = small ? narrow : wide
    traceKey = undefined
    art.setAttribute('viewBox', small ? '0 0 392 377' : '0 0 918 387')
    move(compare, positions.root[0] - 99, 8)
    for (const { id, group, box, name, backing } of cards) {
      const [x, y, width] = positions[id]
      move(group, x - width / 2, y)
      box.setAttribute('width', String(width))
      name?.setAttribute('x', String(width / 2))
      backing?.setAttribute('x', String(width / 2))
    }
    for (const path of art.querySelectorAll<SVGPathElement>('[data-parent]')) {
      const parent = path.dataset.parent as TreePart
      path.setAttribute('d', branch(parent, children[parent]!))
    }

    const [rootX, rootY, rootWidth] = positions.root
    const [homeX, homeY, homeWidth] = positions.home
    const [scratchX, scratchY] = positions.scratch
    const [localX, storageY] = positions['local-disk']
    const [sharedX] = positions['shared-storage']
    const railY = storageY - 42
    const homeDropX = small ? 130 : 246
    rootMount.setAttribute('d', `M ${localX} ${storageY} V ${railY} H 6 V ${rootY + 20} H ${rootX - rootWidth / 2}`)
    sharedMount.setAttribute('d', `M ${sharedX - 37} ${storageY} V ${railY + 4} H ${homeDropX} V ${homeY + 20} H ${homeX + homeWidth / 2}
      M ${sharedX + 40} ${storageY} V ${railY + 4} H ${scratchX} V ${scratchY + 40}`)
    tray.querySelector('.fs-tray-rule')!.setAttribute('d', `M 25 ${storageY - 16} H ${small ? 365 : 887}`)
    const label = tray.querySelector('text.fs-small')!
    label.setAttribute('x', '28')
    label.setAttribute('y', String(storageY - 20))
  }

  function tracePath(route: 'home' | 'relative' | 'absolute'): string {
    const chain = route === 'home' ? ['root', 'home', 'user-home'] as const
      : route === 'relative' ? ['user-home', 'workspace'] as const : ['root', 'opt', 'quest'] as const
    const [x, y] = positions[chain[0]]
    return `M ${x} ${y + 40} ` + chain.slice(1).map((id, i) => {
      const [previousX, previousY] = positions[chain[i]!]
      const [targetX, targetY] = positions[id]
      const junction = (previousY + 40 + targetY) / 2
      return `V ${junction} ${previousX === targetX ? '' : `H ${targetX}`} V ${i === chain.length - 2 ? targetY : targetY + 40}`
    }).join(' ')
  }

  function draw(elapsedMs: number, reduced: boolean) {
    const frame = frameAt(elapsedMs)
    const layoutKey = `${frame.trace?.kind ?? ''}:${frame.cwd ?? ''}`
    if (layoutKey !== traceKey) {
      traceKey = layoutKey
      if (frame.trace) trace.setAttribute('d', tracePath(frame.trace.kind))
      if (frame.cwd) {
        const [x, y, width] = positions[frame.cwd]
        move(pwd, x + width / 2 - 42, y - 10)
      }
    }
    trace.toggleAttribute('hidden', !frame.trace)
    if (frame.trace) {
      trace.dataset.trace = frame.trace.kind
      trace.setAttribute('stroke-dasharray', `${reduced ? 1 : frame.trace.progress} 1`)
    }
    const showComparison = frame.comparisonOpacity > 0
    compare.toggleAttribute('hidden', !showComparison)
    compare.setAttribute('opacity', String(reduced ? 1 : frame.comparisonOpacity))
    pwd.toggleAttribute('hidden', !frame.cwd)
    wires.toggleAttribute('hidden', frame.mounts === 'none')
    sharedMount.toggleAttribute('hidden', frame.mounts !== 'shared')
    tray.toggleAttribute('hidden', frame.mounts === 'none')
    node('shared-storage').toggleAttribute('hidden', frame.mounts !== 'shared')

    for (const { id, group, name, backing } of cards) {
      const kind = frame.mounts !== 'none' && (id === 'root' || id === 'tmp') ? 'local'
        : frame.mounts === 'shared' && (id === 'home' || id === 'scratch') ? 'shared' : null
      const status = kind === 'local' ? id === 'root' ? 'Local mount' : 'Local here' : kind === 'shared' ? 'Shared mount' : ''
      group.classList.toggle('fs-focus', id === frame.note.anchor || id === frame.cwd)
      group.classList.toggle('fs-dot-muted', id === 'dotfile' && !frame.showDotfile)
      group.classList.toggle('fs-backed-local', kind === 'local')
      group.classList.toggle('fs-backed-shared', kind === 'shared')
      if (backing && backing.textContent !== status) {
        backing.textContent = status
        backing.toggleAttribute('hidden', !status)
        name!.setAttribute('y', status ? '17' : '25')
      }
    }
    art.dataset.cwd = frame.cwd ?? ''

    const { anchor, ...note } = frame.note
    const occupied = cards.map(card => card.group).filter(group => !group.closest('[hidden]'))
    return {
      ...note, target: node(anchor),
      avoid: [...occupied, ...(frame.cwd ? [pwd] : []), ...(showComparison ? [compare] : [])],
    }
  }

  return {
    art, draw, resize,
    describe(element, elapsedMs) {
      const id = element.dataset.lessonPart as FsPart
      const { name, role, detail } = parts[id]
      return { name, role: id === frameAt(elapsedMs).cwd ? 'Current directory (pwd)' : role, detail }
    },
  }
}

export const lesson: LessonOptions = {
  title: 'Linux filesystem',
  subtitle: 'Directories, paths, and mount points',
  diagramLabel: 'Interactive Linux directory tree',
  timeline,
  footer: '<p>ASC Week 1 / example mounts</p><a href="https://github.com/hkust-asc/ws26-01-linux-git#quest-1-connect-and-explore" target="_blank" rel="noopener noreferrer">Try it in Quest 1</a>',
  createScene,
}
