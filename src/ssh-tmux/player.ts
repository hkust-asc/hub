import type { LessonOptions, LessonScene } from '../timed-lesson/player'
import { frameAt, timeline } from './story'
import type { SshPart } from './story'
import './player.css'

const parts: Record<SshPart, { name: string; role: string; detail: string }> = {
  laptop: { name: 'Your laptop', role: 'Local terminal', detail: 'The SSH client sends your input and displays output. The task runs on the other machine.' },
  connection: { name: 'SSH connection', role: 'Encrypted connection', detail: 'SSH carries input and output between machines. A new login opens a new connection.' },
  server: { name: 'Training server', role: 'Remote machine', detail: 'The server gives the task CPU time and holds its files, even while the laptop is offline.' },
  shell: { name: 'SSH shell', role: 'Remote terminal session', detail: 'A foreground task tied to this terminal can stop when a hangup closes it.' },
  tmux: { name: 'tmux session: sim', role: 'Server-side terminal', detail: 'tmux keeps the session on this server after you detach. For heavy cluster compute, request resources through Slurm.' },
  process: { name: 'long_sim.sh', role: 'Workshop task running remotely', detail: 'This workshop script waits, then writes a result. The demo compresses the wait.' },
  file: { name: '~/sim_result.txt', role: 'File on the training server', detail: 'The script writes this file when it finishes, whether or not you are attached.' },
}

function part(id: SshPart, content: string, extra = ''): string {
  return `<g data-lesson-part="${id}" role="button" tabindex="-1" aria-label="${parts[id].name}" aria-pressed="false" ${extra}>${content}</g>`
}

function createSshScene(stage: HTMLElement): LessonScene {
  stage.classList.add('ssh-lesson-stage')
  stage.innerHTML = `<svg class="story-art ssh-art" viewBox="0 0 920 416" role="group" aria-labelledby="ssh-diagram-title ssh-diagram-desc">
    <title id="ssh-diagram-title">Laptop, SSH connection, and training server</title>
    <desc id="ssh-diagram-desc">Two runs of the same task show what happens to the connection, terminal and process when Wi-Fi drops.</desc>
    <g data-ssh-layout="server">
      ${part('server', `
        <path class="ssh-plinth-edge" d="M 0 15 H 474 V 267 L 458 280 H 16 L 0 267 Z"/>
        <path class="ssh-plinth" d="M 0 15 L 16 0 H 458 L 474 15 V 250 L 458 265 H 16 L 0 250 Z"/>
        <path class="ssh-face-line" d="M 16 15 H 458 M 16 251 H 114"/>
        <text x="22" y="39" class="ssh-label">Training server</text>
        <circle cx="443" cy="34" r="4" class="ssh-online-light"/>`)}
      <path class="ssh-attach" d="M 182 93 H 209" pathLength="1" hidden/>
      <path class="ssh-shell-tether" d="M 102 131 V 151" hidden/>
      ${part('shell', `
        <rect class="ssh-tile" x="22" y="55" width="158" height="77"/>
        <text class="ssh-label" x="36" y="84">SSH shell</text>
        <text class="ssh-secondary" data-ssh-text="shell" x="36" y="111"></text>`)}
      ${part('tmux', `
        <rect class="ssh-session" x="210" y="55" width="243" height="148"/>
        <text class="ssh-label" x="225" y="84">tmux: sim</text>
        <text class="ssh-secondary" data-ssh-text="tmux" x="225" y="108"></text>`, 'hidden')}
      <path class="ssh-file-line" d="M 320 189 V 213" hidden/>
      ${part('process', `
        <rect class="ssh-tile ssh-process-tile" width="207" height="69"/>
        <text class="ssh-code" x="12" y="23">long_sim.sh</text>
        <rect class="ssh-meter-track" x="12" y="33" width="183" height="6"/>
        <rect class="ssh-meter-fill" x="12" y="33" width="0" height="6"/>
        <text class="ssh-secondary" data-ssh-text="process" x="12" y="58"></text>`, 'hidden')}
      ${part('file', `
        <rect class="ssh-file" x="232" y="214" width="207" height="34"/>
        <path class="ssh-file-icon" d="M 247 220 h 9 l 4 4 v 17 h -13 z M 250 229 h 7 m -7 5 h 7"/>
        <text class="ssh-code" x="268" y="237">~/sim_result.txt</text>`, 'hidden')}
    </g>
    ${part('connection', `
      <path class="ssh-wire-hit" pathLength="1"/>
      <path class="ssh-wire-base" pathLength="1"/>
      <path class="ssh-wire" pathLength="1"/>
      <g class="ssh-break" aria-hidden="true" hidden>
        <circle r="11"/><path d="M -4.5 -4.5 L 4.5 4.5 M 4.5 -4.5 L -4.5 4.5"/>
      </g>`)}
    <g data-ssh-layout="laptop">
      ${part('laptop', `
        <path class="ssh-laptop-frame" d="M 16 7 H 172 L 182 17 V 92 H 6 V 17 Z"/>
        <path class="ssh-screen" d="M 16 18 H 172 V 83 H 16 Z"/>
        <path class="ssh-laptop-depth" d="M 0 108 H 200 V 116 L 190 122 H 10 L 0 116 Z"/>
        <path class="ssh-laptop-deck" d="M 6 92 H 182 L 200 108 H 0 Z"/>
        <path class="ssh-face-line" d="M 78 104 H 113"/>
        <text class="ssh-label" x="29" y="45">Your laptop</text>
        <text class="ssh-secondary" data-ssh-text="laptop" x="29" y="70"></text>`)}
    </g>
  </svg>`
  const find = <T extends Element = SVGGraphicsElement>(selector: string) => stage.querySelector<T>(selector)!
  const art = find<SVGSVGElement>('.ssh-art')
  const shapes = {
    laptop: find('[data-lesson-part="laptop"]'),
    connection: find('[data-lesson-part="connection"]'),
    server: find('[data-lesson-part="server"]'),
    shell: find('[data-lesson-part="shell"]'),
    tmux: find('[data-lesson-part="tmux"]'),
    process: find('[data-lesson-part="process"]'),
    file: find('[data-lesson-part="file"]'),
  }
  const wire = find<SVGPathElement>('.ssh-wire')
  const wirePaths = [...shapes.connection.querySelectorAll<SVGPathElement>(':scope > path')]
  const breakMark = find('.ssh-break')
  const attach = find('.ssh-attach')
  const tether = find('.ssh-shell-tether')
  const fileLine = find('.ssh-file-line')
  const meter = find('.ssh-meter-fill')
  const labels = {
    laptop: find('[data-ssh-text="laptop"]'),
    shell: find('[data-ssh-text="shell"]'),
    tmux: find('[data-ssh-text="tmux"]'),
    process: find('[data-ssh-text="process"]'),
  }
  const text = (item: SVGGraphicsElement, value: string) => {
    if (item.textContent !== value) item.textContent = value
  }

  let compact: boolean | undefined
  function resize(): void {
    const narrow = stage.clientWidth < 630
    if (compact === narrow) return
    compact = narrow
    art.setAttribute('viewBox', narrow ? '0 0 502 460' : '0 0 920 416')
    find('[data-ssh-layout="laptop"]').setAttribute('transform', narrow ? 'translate(24 10)' : 'translate(56 111)')
    find('[data-ssh-layout="server"]').setAttribute('transform', narrow ? 'translate(14 161)' : 'translate(385 82)')
    const path = narrow ? 'M 119 132 V 216' : 'M 238 175 H 407'
    for (const element of wirePaths) element.setAttribute('d', path)
    breakMark.setAttribute('transform', narrow ? 'translate(119 174)' : 'translate(322.5 175)')
  }

  function draw(elapsedMs: number, reduced: boolean) {
    const frame = frameAt(elapsedMs)
    const down = frame.connection.status === 'lost'
    shapes.connection.classList.toggle('ssh-lost', down)
    shapes.laptop.classList.toggle('ssh-offline', down)
    breakMark.toggleAttribute('hidden', !down)
    wire.setAttribute('stroke-dasharray', down ? '.38 .24 .38' : `${reduced ? 1 : frame.connection.progress} 1`)
    text(labels.laptop, down ? 'Offline' : frame.connection.status === 'connected' ? 'SSH connected' : 'Connecting')

    shapes.shell.classList.toggle('ssh-offline', frame.shell !== 'open')
    text(labels.shell, frame.shell === 'open' ? 'Shell open' : frame.shell === 'closed' ? 'Terminal closed' : 'Waiting for SSH')
    shapes.tmux.toggleAttribute('hidden', frame.tmux === 'absent')
    attach.toggleAttribute('hidden', frame.tmux === 'absent' || frame.shell !== 'open')
    attach.classList.toggle('ssh-detached', frame.tmux === 'detached')
    text(labels.tmux, frame.tmux === 'attached' ? 'Attached' : 'Detached')

    const job = frame.process
    shapes.process.toggleAttribute('hidden', !job)
    tether.toggleAttribute('hidden', job?.terminal !== 'shell')
    tether.classList.toggle('ssh-stopped', job?.status === 'stopped')
    if (job) {
      shapes.process.setAttribute('transform', job.terminal === 'shell' ? 'translate(22 150)' : 'translate(225 120)')
      shapes.process.dataset.status = job.status
      meter.setAttribute('width', String(183 * job.progress))
      const progress = `${Math.floor(job.progress * 100 + 1e-6)}%`
      text(labels.process, `${job.status === 'stopped' ? 'Stopped' : job.status === 'done' ? 'Done' : 'Running'} / ${progress}`)
    }
    shapes.file.toggleAttribute('hidden', !frame.file)
    fileLine.toggleAttribute('hidden', !frame.file)
    return {
      ...frame.note,
      target: frame.note.anchor === 'connection' ? wire : shapes[frame.note.anchor],
      avoid: [shapes.laptop, shapes.shell, shapes.tmux, shapes.process, shapes.file].filter(element => !element.hasAttribute('hidden')),
    }
  }

  return {
    art, draw, resize,
    describe(element, elapsedMs) {
      const key = element.dataset.lessonPart as SshPart
      const partInfo = parts[key]
      const frame = frameAt(elapsedMs)
      if (key === 'connection' && frame.connection.status === 'lost') return { ...partInfo, role: 'Disconnected' }
      if (key === 'tmux' && frame.tmux === 'detached') return { ...partInfo, role: 'Detached on the training server' }
      if (key === 'process' && frame.process?.status !== 'running') return { ...partInfo, role: frame.process?.status === 'done' ? 'Finished on the server' : 'Stopped' }
      return partInfo
    },
  }
}

export const lesson: LessonOptions = {
  title: 'SSH & tmux',
  subtitle: 'What survives a disconnect?',
  diagramLabel: 'Interactive SSH and tmux diagram',
  timeline,
  footer: '<p>ASC Week 1 / compressed timing</p><a href="https://github.com/hkust-asc/ws26-01-linux-git#quest-2-redirect-output-and-use-tmux" target="_blank" rel="noopener noreferrer">Try it in Quest 2</a>',
  createScene: createSshScene,
}
