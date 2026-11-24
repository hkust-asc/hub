import type { LessonOptions, LessonScene } from '../timed-lesson/player'
import { frameAt, timeline } from './story'
import type { Channel, Destination, StreamPart } from './story'
import './player.css'

const parts: Record<StreamPart, { name: string; role: string; detail: string }> = {
  process: { name: 'noisy_sensor.sh', role: 'Workshop command', detail: 'The shell normally supplies stdin (0), stdout (1), and stderr (2). This script writes to both output streams.' },
  stdout: { name: 'Port 1: stdout', role: 'Standard output', detail: 'This script writes its passcode here. In this example, > is shorthand for 1> and replaces the target file’s contents.' },
  stderr: { name: 'Port 2: stderr', role: 'Standard error', detail: 'Programs often write warnings and errors here. Redirecting stdout does not redirect stderr.' },
  passcode: { name: 'passcode.txt', role: 'File for standard output', detail: 'The > redirection sends port 1 here. No diagnostics from port 2 are added.' },
  terminal: { name: 'Terminal screen', role: 'Output still sent to the screen', detail: 'Both output streams start out connected to the screen in this example. The shell can redirect each one independently.' },
  errors: { name: 'error.log', role: 'File for standard error', detail: 'The 2> redirection sends port 2 here without changing where port 1 goes.' },
}

const channels = ['stdout', 'stderr'] as const
const destinations = ['terminal', 'passcode', 'errors'] as const

function part(id: StreamPart, content: string): string {
  return `<g data-lesson-part="${id}" role="button" tabindex="-1" aria-label="${parts[id].name}" aria-pressed="false">${content}</g>`
}

function createScene(stage: HTMLElement): LessonScene {
  stage.classList.add('streams-stage')
  stage.innerHTML = `<svg class="story-art streams-art" viewBox="0 0 910 346" role="group" aria-labelledby="streams-title streams-desc">
    <title id="streams-title">Two output streams and their destinations</title>
    <desc id="streams-desc">Follow standard output and standard error as the shell routes them to the screen or separate files.</desc>
    <defs>
      ${channels.map(channel => `<marker id="streams-arrow-${channel}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse"><path class="streams-arrow" data-channel="${channel}" d="M 0 0 L 8 4 L 0 8 Z"/></marker>`).join('')}
    </defs>
    <g aria-hidden="true">
      ${channels.map(channel => `<path class="streams-wire" data-channel="${channel}"/>`).join('')}
    </g>
    ${part('process', `
      <rect class="streams-box"/>
      <text class="streams-kicker">WORKSHOP COMMAND</text>
      <text class="streams-name">noisy_sensor.sh</text>
    `)}
    ${channels.map((channel, i) => `
      <g class="streams-port" data-channel="${channel}" aria-hidden="true"><circle r="13"/><text y="4">${i + 1}</text></g>
      ${part(channel, `
        <g class="streams-gate" data-channel="${channel}">
          <rect x="-45" y="-13" width="90" height="26"/>
          <text class="streams-gate-name" x="-35" y="4">${channel}</text>
          <text class="streams-operator" x="33" y="4" text-anchor="end"></text>
        </g>
      `)}
    `).join('')}
    ${destinations.map(id => part(id, `
      <rect class="streams-box streams-destination"/>
      <text class="streams-name" x="13" y="22">${parts[id].name}</text>
      <path class="streams-rule" d="M 12 31 H 138"/>
      ${[0, 1, 2, 3].map(i => `<text class="streams-line" x="13" y="${48 + i * 15}"></text>`).join('')}
    `)).join('')}
    <g aria-hidden="true">
      ${['ERROR', 'PASSCODE', 'WARN'].map(badge => {
        const width = badge.length * 7 + 12
        return `<g class="streams-packet" data-packet="${badge}" data-channel="${badge === 'PASSCODE' ? 'stdout' : 'stderr'}" hidden><rect x="${-width / 2}" y="-10" width="${width}" height="20"/><text y="4">${badge}</text></g>`
      }).join('')}
    </g>
  </svg>`

  const art = stage.querySelector<SVGSVGElement>('.streams-art')!
  const nodes = new Map([...art.querySelectorAll<SVGGElement>('[data-lesson-part]')]
    .map(node => [node.dataset.lessonPart, node]))
  const partNode = (id: StreamPart) => nodes.get(id)!
  const wires = {
    stdout: art.querySelector<SVGPathElement>('.streams-wire[data-channel="stdout"]')!,
    stderr: art.querySelector<SVGPathElement>('.streams-wire[data-channel="stderr"]')!,
  }
  const ports = {
    stdout: art.querySelector<SVGGElement>('.streams-port[data-channel="stdout"]')!,
    stderr: art.querySelector<SVGGElement>('.streams-port[data-channel="stderr"]')!,
  }
  const operators = {
    stdout: partNode('stdout').querySelector('text.streams-operator')!,
    stderr: partNode('stderr').querySelector('text.streams-operator')!,
  }
  const panels = destinations.map(id => ({
    id, node: partNode(id), lines: [...partNode(id).querySelectorAll('text.streams-line')],
  }))
  const packets = [...art.querySelectorAll<SVGGElement>('[data-packet]')]
  const process = partNode('process')
  const move = (item: SVGElement, x: number, y: number) => item.setAttribute('transform', `translate(${x} ${y})`)
  const size = (item: SVGGElement, width: number, height: number) => {
    const box = item.querySelector('rect')!
    box.setAttribute('width', String(width))
    box.setAttribute('height', String(height))
  }

  let compact = false
  let layoutReady = false
  let routeKey = ''
  const lengths = { stdout: 0, stderr: 0 }

  function resize(): void {
    const narrow = stage.clientWidth < 630
    if (layoutReady && compact === narrow) return
    compact = narrow
    layoutReady = true
    routeKey = ''
    art.setAttribute('viewBox', compact ? '0 0 352 364' : '0 0 910 346')
    move(process, compact ? 38 : 20, compact ? 9 : 117)
    size(process, compact ? 276 : 184, compact ? 55 : 104)
    const kicker = process.querySelector('.streams-kicker')!
    const name = process.querySelector('.streams-name')!
    kicker.setAttribute('x', '16')
    kicker.setAttribute('y', compact ? '19' : '40')
    name.setAttribute('x', '16')
    name.setAttribute('y', compact ? '41' : '66')
    move(ports.stdout, compact ? 110 : 204, compact ? 65 : 147)
    move(ports.stderr, compact ? 242 : 204, compact ? 65 : 198)
    move(partNode('stdout'), compact ? 110 : 320, compact ? 102 : 147)
    move(partNode('stderr'), compact ? 242 : 320, compact ? 102 : 198)
    for (const { id, node } of panels) {
      const terminal = id === 'terminal'
      const x = compact ? id === 'errors' ? 183 : 19 : 591
      const y = compact ? terminal ? 143 : 250 : id === 'passcode' ? 13 : terminal ? 118 : 233
      const width = compact && !terminal ? 150 : 314
      move(node, x, y)
      size(node, width, compact && !terminal ? 104 : terminal ? 103 : 94)
      node.querySelector('.streams-rule')!.setAttribute('d', `M 12 31 H ${width - 12}`)
    }
  }

  function wirePath(channel: Channel, destination: Destination | null): string {
    const standard = channel === 'stdout'
    if (compact) {
      const x = standard ? 110 : 242
      if (destination === 'terminal') return `M ${x} 78 V 143`
      if (!destination) return `M ${x} 78 V 116`
      const edge = standard ? 9 : 343
      const shoulder = x + (standard ? -11 : 11)
      return `M ${x} 78 V 116 Q ${x} 127 ${shoulder} 127 H ${edge} V 293 H ${standard ? 19 : 333}`
    }
    const y = standard ? 147 : 198
    if (destination === 'terminal') return `M 217 ${y} H 591`
    if (!destination) return `M 217 ${y} H 365`
    const toY = standard ? 62 : 275
    const turn = standard ? -12 : 12
    return `M 217 ${y} H 421 Q 433 ${y} 433 ${y + turn} V ${toY - turn} Q 433 ${toY} 445 ${toY} H 591`
  }

  function draw(elapsedMs: number, reduced: boolean) {
    const frame = frameAt(elapsedMs)
    art.classList.toggle('streams-review', frame.reviewing)
    const key = `${frame.route.stdout}:${frame.route.stderr}`
    if (routeKey !== key) {
      routeKey = key
      for (const channel of channels) {
        const destination = frame.route[channel]
        const wire = wires[channel]
        wire.setAttribute('d', wirePath(channel, destination))
        wire.classList.toggle('streams-pending', destination === null)
        if (destination) wire.setAttribute('marker-end', `url(#streams-arrow-${channel})`)
        else wire.removeAttribute('marker-end')
        lengths[channel] = wire.getTotalLength()
        partNode(channel).classList.toggle('streams-diverted', destination !== null && destination !== 'terminal')
        partNode(channel).classList.toggle('streams-predicting', destination === null)
        operators[channel].textContent = destination === null ? '?' : destination === 'terminal' ? '·' : channel === 'stdout' ? '>' : '2>'
      }
    }

    for (const { id, node, lines } of panels) {
      const visible = id === 'terminal' || (id === 'passcode' ? frame.showPasscode : frame.showErrors)
      node.toggleAttribute('hidden', !visible)
      node.classList.toggle('streams-preview', id === 'errors' && frame.predicting)
      const rows = frame.contents[id].flatMap(message => (compact && id === 'errors' ? message.lines : [message.lines.join(' ')])
        .map(text => ({ text, channel: message.channel })))
      for (const [index, line] of lines.entries()) {
        const output = rows[index]
        const value = output?.text ?? (index === 0 && !rows.length
          ? id === 'terminal' && frame.quiet ? 'No screen output' : id === 'errors' && frame.predicting ? 'Pending' : '—'
          : '')
        if (line.textContent !== value) line.textContent = value
        if (line.getAttribute('data-channel') !== (output?.channel ?? null)) {
          if (output) line.setAttribute('data-channel', output.channel)
          else line.removeAttribute('data-channel')
        }
      }
    }
    for (const packet of packets) {
      const flight = frame.inFlight.find(item => item.message.badge === packet.dataset.packet)
      packet.toggleAttribute('hidden', !flight || reduced)
      if (flight && !reduced) {
        const { channel } = flight.message
        const { x, y } = wires[channel].getPointAtLength(lengths[channel] * flight.progress)
        move(packet, x, y)
      }
    }
    const { anchor, ...note } = frame.note
    return {
      ...note, target: partNode(anchor),
      avoid: [process, partNode('stdout'), partNode('stderr'), ...panels.map(panel => panel.node).filter(node => !node.hasAttribute('hidden')), ...Object.values(wires)],
    }
  }

  return {
    art, draw, resize,
    describe(element, elapsedMs) {
      const id = element.dataset.lessonPart as StreamPart
      return id === 'errors' && frameAt(elapsedMs).predicting
        ? { name: parts.errors.name, role: 'File preview', detail: 'Predict what this file and the terminal will show in the next run.' }
        : parts[id]
    },
  }
}

export const lesson: LessonOptions = {
  title: 'Streams & redirection',
  subtitle: 'Separating stdout and stderr',
  diagramLabel: 'Interactive output routing diagram',
  timeline,
  footer: '<p>ASC Week 1 / demo output</p><a href="https://github.com/hkust-asc/ws26-01-linux-git#quest-2-redirect-output-and-use-tmux" target="_blank" rel="noopener noreferrer">Try it in Quest 2</a>',
  createScene,
}
