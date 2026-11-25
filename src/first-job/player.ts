import { evidence } from '../model'
import type { LessonOptions, LessonScene } from '../timed-lesson/player'
import { frameAt, timeline } from './story'
import type { JobPart, JobWire } from './story'
import './player.css'

const parts: Record<JobPart, { name: string; role: string; detail: string }> = {
  login: {
    name: 'Login node (login01)',
    role: 'Shared SSH entry shell',
    detail: 'Your SSH session stays on login01 for editing scripts, submitting jobs, and reading results—not heavy computation.',
  },
  slurm: {
    name: 'Slurm scheduler',
    role: 'Queue & resource manager',
    detail: 'Matches #SBATCH requests to free compute resources and launches batch scripts. Application data never flows through Slurm.',
  },
  compute: {
    name: 'Compute node (gpu01)',
    role: 'Scheduled gpu-a30 server',
    detail: 'An HPC4 A30 node pairs two Xeon Gold 6448Y sockets and 512 GB DDR5 RAM with four NVIDIA A30 GPUs.',
  },
  env: {
    name: 'Batch shell & Lmod',
    role: 'Job environment on gpu01',
    detail: 'Each batch job starts a fresh shell on the compute node. module load updates PATH so it finds installed Spack software.',
  },
  gpu: {
    name: 'Allocated GPU (A30 #0)',
    role: 'Reserved 24 GB A30 slice',
    detail: 'Requesting --gpus-per-node=1 allocates one A30 GPU to this job while leaving GPUs 1–3 available for other jobs.',
  },
  home: {
    name: '/home/<user>',
    role: 'Shared & backed-up storage',
    detail: 'Mounted on both login and compute nodes (200 GB quota, 14-day backup window). Keep scripts, source code, and configs here.',
  },
  scratch: {
    name: '/scratch/<user>',
    role: 'High-speed job storage',
    detail: 'Mounted across nodes for large datasets and job output (500 GB quota, 60-day inactivity purge, not backed up).',
  },
}

const wireTones: Record<JobWire, 'control' | 'data'> = {
  submit: 'control',
  allocate: 'control',
  'script-read': 'data',
  'scratch-write': 'data',
  'scratch-read': 'data',
}

const wireIds: readonly JobWire[] = ['submit', 'allocate', 'script-read', 'scratch-write', 'scratch-read']

function partGroup(id: JobPart, content: string, extra = ''): string {
  return `<g data-lesson-part="${id}" role="button" tabindex="-1" aria-label="${parts[id].name}" aria-pressed="false" ${extra}>${content}</g>`
}

function setPlinth(
  edgeEl: SVGPathElement,
  deckEl: SVGPathElement,
  creaseEl: SVGPathElement,
  width: number,
  height: number,
  bevel: number,
  depth: number,
): void {
  edgeEl.setAttribute(
    'd',
    `M 0 ${bevel} H ${width} V ${height - bevel + depth} L ${width - bevel} ${height + depth} H ${bevel} L 0 ${height - bevel + depth} Z`,
  )
  deckEl.setAttribute(
    'd',
    `M 0 ${bevel} L ${bevel} 0 H ${width - bevel} L ${width} ${bevel} V ${height - bevel} L ${width - bevel} ${height} H ${bevel} L 0 ${height - bevel} Z`,
  )
  creaseEl.setAttribute(
    'd',
    `M ${bevel} ${bevel} H ${width - bevel} M ${bevel} ${height} V ${height + depth} M ${width - bevel} ${height} V ${height + depth}`,
  )
}

function createJobScene(stage: HTMLElement): LessonScene {
  stage.classList.add('job-stage')
  stage.innerHTML = `<svg class="story-art job-art" viewBox="0 0 920 398" role="group" aria-labelledby="job-title job-desc">
    <title id="job-title">Batch job lifecycle across login, Slurm, compute node, and shared storage</title>
    <desc id="job-desc">Follow sbatch from login01 to Slurm, resource allocation and module loading on gpu01, direct output to /scratch, and reading results back on login01.</desc>
    <defs>
      <marker id="job-arrow-control" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
        <path class="job-arrow-control" d="M 0 0 L 8 4 L 0 8 Z"/>
      </marker>
      <marker id="job-arrow-data" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
        <path class="job-arrow-data" d="M 0 0 L 8 4 L 0 8 Z"/>
      </marker>
    </defs>

    <g aria-hidden="true">
      <path class="job-control-base" data-base="control"/>
      <path class="job-mount-base" data-base="mounts"/>
      ${wireIds.map(id => `<path class="job-wire" data-wire="${id}" data-tone="${wireTones[id]}" hidden/>`).join('')}
    </g>

    ${partGroup('login', `
      <path class="job-plinth-edge" data-login-edge/>
      <path class="job-plinth-deck" data-login-deck/>
      <path class="job-plinth-crease" data-login-crease/>
      <text class="job-kicker" data-login-kicker></text>
      <circle class="job-online" r="3.6"/>
      <text class="job-title" data-login-title>login01</text>
      <rect class="job-terminal-tile" data-login-terminal/>
      <text class="job-mono" data-login-prompt></text>
      <text class="job-mono-dim" data-login-output></text>
      <text class="job-note" data-login-note>SSH shell stays on login01</text>
    `)}

    ${partGroup('slurm', `
      <rect class="job-control-card"/>
      <path class="job-control-stripe" data-slurm-stripe/>
      <text class="job-kicker" data-slurm-kicker></text>
      <text class="job-title" data-slurm-title>Slurm</text>
      <rect class="job-pill"/>
      <text class="job-pill-text" data-slurm-badge></text>
      <path class="job-rule" data-slurm-rule hidden/>
      <text class="job-mono-dim" data-slurm-summary></text>
      <text class="job-note" data-slurm-note hidden>Control plane only</text>
    `)}

    <g data-job-layout="compute">
      ${partGroup('compute', `
        <path class="job-plinth-edge" data-compute-edge/>
        <path class="job-plinth-deck" data-compute-deck/>
        <path class="job-plinth-crease" data-compute-crease/>
        <text class="job-kicker" data-compute-kicker>COMPUTE · gpu-a30</text>
        <circle class="job-compute-led" data-compute-led r="3.6"/>
        <text class="job-title" data-compute-title>gpu01</text>
        <text class="job-mono-dim" data-compute-status text-anchor="end"></text>
      `)}
      ${partGroup('env', `
        <rect class="job-subcard"/>
        <text class="job-subtitle" x="11" y="18">Batch shell</text>
        <text class="job-mono-dim job-env-badge" data-env-badge text-anchor="end"></text>
        <text class="job-mono-dim" data-env-detail x="11" y="35"></text>
      `)}
      ${partGroup('gpu', `
        <path class="job-gpu-edge" data-gpu-edge/>
        <path class="job-gpu-deck" data-gpu-deck/>
        <path class="job-gpu-crease" data-gpu-crease/>
        <text class="job-subtitle" data-gpu-title>A30 #0</text>
        <text class="job-mono-dim" data-gpu-status-text text-anchor="end"></text>
        <rect class="job-meter-track" height="6"/>
        <rect class="job-meter-fill" width="0" height="6"/>
      `)}
      <g class="job-other-gpus" aria-hidden="true">
        ${[1, 2, 3].map(index => `
          <g data-other-gpu="${index}">
            <path class="job-slot-edge"/>
            <path class="job-slot-deck"/>
            <path class="job-slot-crease"/>
            <text class="job-other-label" y="19">A30 ${index}</text>
            <text class="job-other-label" y="34">free</text>
          </g>
        `).join('')}
      </g>
    </g>

    <g data-job-layout="storage">
      <path class="job-tray-rule" aria-hidden="true"/>
      <text class="job-tray-label" aria-hidden="true">SHARED MOUNTS</text>
      ${partGroup('home', `
        <rect class="job-storage-card"/>
        <path class="job-mount-stripe" data-home-stripe/>
        <text class="job-subtitle" data-home-title></text>
        <text class="job-policy" data-home-policy text-anchor="end">Backed up</text>
        <path class="job-rule" data-home-rule/>
        <text class="job-mono" data-home-files></text>
      `)}
      ${partGroup('scratch', `
        <rect class="job-storage-card"/>
        <path class="job-mount-stripe" data-scratch-stripe/>
        <text class="job-subtitle" data-scratch-title></text>
        <text class="job-policy" data-scratch-policy text-anchor="end"></text>
        <path class="job-rule" data-scratch-rule/>
        <text class="job-mono-dim job-scratch-files" data-scratch-files></text>
      `)}
    </g>

    <g class="job-packet" aria-hidden="true" hidden>
      <rect y="-10" height="20"/>
      <text y="4"></text>
    </g>
  </svg>`

  const find = <T extends Element = SVGGraphicsElement>(selector: string) => stage.querySelector<T>(selector)!
  const art = find<SVGSVGElement>('.job-art')
  const nodes: Record<JobPart, SVGGElement> = {
    login: find('[data-lesson-part="login"]'),
    slurm: find('[data-lesson-part="slurm"]'),
    compute: find('[data-lesson-part="compute"]'),
    env: find('[data-lesson-part="env"]'),
    gpu: find('[data-lesson-part="gpu"]'),
    home: find('[data-lesson-part="home"]'),
    scratch: find('[data-lesson-part="scratch"]'),
  }
  const computeLayout = find<SVGGElement>('[data-job-layout="compute"]')
  const otherGpusGroup = find<SVGGElement>('.job-other-gpus')
  const otherGpus = [...otherGpusGroup.querySelectorAll<SVGGElement>('[data-other-gpu]')]
  const controlBase = find<SVGPathElement>('[data-base="control"]')
  const mountBase = find<SVGPathElement>('[data-base="mounts"]')
  const wires = Object.fromEntries(
    wireIds.map(id => [id, find<SVGPathElement>(`.job-wire[data-wire="${id}"]`)]),
  ) as Record<JobWire, SVGPathElement>
  const wireLengths: Record<JobWire, number> = {
    submit: 0,
    allocate: 0,
    'script-read': 0,
    'scratch-write': 0,
    'scratch-read': 0,
  }

  const packet = find<SVGGElement>('.job-packet')
  const packetRect = packet.querySelector('rect')!
  const packetText = packet.querySelector('text')!
  const meterTrack = find<SVGRectElement>('.job-meter-track')
  const meterFill = find<SVGRectElement>('.job-meter-fill')

  const loginEls = {
    edge: find<SVGPathElement>('[data-login-edge]'),
    deck: find<SVGPathElement>('[data-login-deck]'),
    crease: find<SVGPathElement>('[data-login-crease]'),
    kicker: find('[data-login-kicker]'),
    online: nodes.login.querySelector('circle')!,
    title: find('[data-login-title]'),
    terminal: find<SVGRectElement>('[data-login-terminal]'),
    prompt: find('[data-login-prompt]'),
    output: find('[data-login-output]'),
    note: find('[data-login-note]'),
  }
  const slurmEls = {
    stripe: find<SVGPathElement>('[data-slurm-stripe]'),
    kicker: find('[data-slurm-kicker]'),
    title: find('[data-slurm-title]'),
    pill: nodes.slurm.querySelector<SVGRectElement>('.job-pill')!,
    badge: find('[data-slurm-badge]'),
    rule: find<SVGPathElement>('[data-slurm-rule]'),
    summary: find('[data-slurm-summary]'),
    note: find('[data-slurm-note]'),
  }
  const computeEls = {
    edge: find<SVGPathElement>('[data-compute-edge]'),
    deck: find<SVGPathElement>('[data-compute-deck]'),
    crease: find<SVGPathElement>('[data-compute-crease]'),
    kicker: find('[data-compute-kicker]'),
    led: find<SVGCircleElement>('[data-compute-led]'),
    title: find('[data-compute-title]'),
    status: find('[data-compute-status]'),
  }
  const envBadge = find('[data-env-badge]')
  const envDetail = find('[data-env-detail]')
  const gpuEls = {
    edge: find<SVGPathElement>('[data-gpu-edge]'),
    deck: find<SVGPathElement>('[data-gpu-deck]'),
    crease: find<SVGPathElement>('[data-gpu-crease]'),
    title: find('[data-gpu-title]'),
    statusText: find('[data-gpu-status-text]'),
  }
  const trayRule = find<SVGPathElement>('.job-tray-rule')
  const trayLabel = find('.job-tray-label')
  const homeEls = {
    stripe: find<SVGPathElement>('[data-home-stripe]'),
    title: find('[data-home-title]'),
    policy: find('[data-home-policy]'),
    rule: find<SVGPathElement>('[data-home-rule]'),
    files: find('[data-home-files]'),
  }
  const scratchEls = {
    stripe: find<SVGPathElement>('[data-scratch-stripe]'),
    title: find('[data-scratch-title]'),
    policy: find('[data-scratch-policy]'),
    rule: find<SVGPathElement>('[data-scratch-rule]'),
    files: find('[data-scratch-files]'),
  }

  const move = (el: SVGElement, x: number, y: number) => el.setAttribute('transform', `translate(${x} ${y})`)
  const sizeRect = (group: SVGGElement, width: number, height: number) => {
    const box = group.querySelector('rect')!
    box.setAttribute('width', String(width))
    box.setAttribute('height', String(height))
  }
  const setText = (el: Element, value: string) => {
    if (el.textContent !== value) el.textContent = value
  }

  let compact: boolean | undefined
  let meterMaxWidth = 174
  let gpuBasePos: [number, number] = [16, 106]

  function resize(): void {
    const narrow = stage.clientWidth < 630
    if (compact === narrow) return
    compact = narrow

    if (narrow) {
      art.setAttribute('viewBox', '0 0 376 410')

      // Login 2.5D plinth + recessed flat 2D terminal tile (top-left)
      move(nodes.login, 18, 8)
      setPlinth(loginEls.edge, loginEls.deck, loginEls.crease, 164, 84, 8, 7)
      setText(loginEls.kicker, 'ACCESS')
      loginEls.kicker.setAttribute('x', '11')
      loginEls.kicker.setAttribute('y', '19')
      loginEls.online.setAttribute('cx', '150')
      loginEls.online.setAttribute('cy', '16')
      loginEls.title.setAttribute('x', '11')
      loginEls.title.setAttribute('y', '36')
      loginEls.terminal.setAttribute('x', '9')
      loginEls.terminal.setAttribute('y', '42')
      loginEls.terminal.setAttribute('width', '146')
      loginEls.terminal.setAttribute('height', '35')
      loginEls.prompt.setAttribute('x', '14')
      loginEls.prompt.setAttribute('y', '56')
      loginEls.output.setAttribute('x', '14')
      loginEls.output.setAttribute('y', '71')
      loginEls.note.toggleAttribute('hidden', true)

      // Slurm flat 2D control card (top-right)
      move(nodes.slurm, 200, 8)
      sizeRect(nodes.slurm, 164, 91)
      slurmEls.stripe.setAttribute('d', 'M 0 1.2 H 164')
      setText(slurmEls.kicker, 'SCHEDULER')
      slurmEls.kicker.setAttribute('x', '10')
      slurmEls.kicker.setAttribute('y', '18')
      slurmEls.title.setAttribute('x', '10')
      slurmEls.title.setAttribute('y', '38')
      slurmEls.pill.setAttribute('x', '82')
      slurmEls.pill.setAttribute('y', '22')
      slurmEls.pill.setAttribute('width', '72')
      slurmEls.pill.setAttribute('height', '20')
      slurmEls.badge.setAttribute('x', '118')
      slurmEls.badge.setAttribute('y', '36')
      slurmEls.rule.toggleAttribute('hidden', false)
      slurmEls.rule.setAttribute('d', 'M 10 47 H 154')
      slurmEls.summary.setAttribute('x', '10')
      slurmEls.summary.setAttribute('y', '65')
      slurmEls.note.toggleAttribute('hidden', false)
      slurmEls.note.setAttribute('x', '10')
      slurmEls.note.setAttribute('y', '82')

      // Compute 2.5D plinth (middle)
      move(computeLayout, 18, 118)
      setPlinth(computeEls.edge, computeEls.deck, computeEls.crease, 346, 156, 10, 8)
      computeEls.kicker.setAttribute('x', '13')
      computeEls.kicker.setAttribute('y', '22')
      computeEls.led.setAttribute('cx', '331')
      computeEls.led.setAttribute('cy', '18')
      computeEls.title.setAttribute('x', '13')
      computeEls.title.setAttribute('y', '41')
      computeEls.status.setAttribute('x', '322')
      computeEls.status.setAttribute('y', '40')

      // Flat 2D Batch shell tile inside gpu01
      move(nodes.env, 12, 49)
      sizeRect(nodes.env, 322, 42)
      envBadge.setAttribute('x', '311')
      envBadge.setAttribute('y', '18')

      // 2.5D GPU bricks inside gpu01
      gpuBasePos = [12, 99]
      move(nodes.gpu, gpuBasePos[0], gpuBasePos[1])
      setPlinth(gpuEls.edge, gpuEls.deck, gpuEls.crease, 192, 42, 5, 4)
      gpuEls.title.setAttribute('x', '10')
      gpuEls.title.setAttribute('y', '19')
      gpuEls.statusText.setAttribute('x', '182')
      gpuEls.statusText.setAttribute('y', '19')
      meterMaxWidth = 172
      meterTrack.setAttribute('x', '10')
      meterTrack.setAttribute('y', '28')
      meterTrack.setAttribute('width', String(meterMaxWidth))
      meterFill.setAttribute('x', '10')
      meterFill.setAttribute('y', '28')

      move(otherGpusGroup, 212, 99)
      for (const [idx, slot] of otherGpus.entries()) {
        move(slot, idx * 42, 0)
        setPlinth(
          slot.querySelector<SVGPathElement>('.job-slot-edge')!,
          slot.querySelector<SVGPathElement>('.job-slot-deck')!,
          slot.querySelector<SVGPathElement>('.job-slot-crease')!,
          38,
          42,
          4,
          4,
        )
        for (const label of slot.querySelectorAll('text')) label.setAttribute('x', '19')
      }

      // Flat 2D Shared storage cards (bottom)
      trayRule.setAttribute('d', 'M 18 313 H 364')
      trayLabel.setAttribute('x', '20')
      trayLabel.setAttribute('y', '308')

      move(nodes.home, 18, 323)
      sizeRect(nodes.home, 164, 68)
      homeEls.stripe.setAttribute('d', 'M 1.2 0 V 68')
      setText(homeEls.title, '/home')
      homeEls.title.setAttribute('x', '11')
      homeEls.title.setAttribute('y', '21')
      homeEls.policy.setAttribute('x', '154')
      homeEls.policy.setAttribute('y', '20')
      homeEls.rule.setAttribute('d', 'M 11 30 H 154')
      homeEls.files.setAttribute('x', '11')
      homeEls.files.setAttribute('y', '50')
      setText(homeEls.files, 'job.sh  train.py')

      move(nodes.scratch, 200, 323)
      sizeRect(nodes.scratch, 164, 68)
      scratchEls.stripe.setAttribute('d', 'M 1.2 0 V 68')
      setText(scratchEls.title, '/scratch')
      scratchEls.title.setAttribute('x', '11')
      scratchEls.title.setAttribute('y', '21')
      setText(scratchEls.policy, '60d purge')
      scratchEls.policy.setAttribute('x', '154')
      scratchEls.policy.setAttribute('y', '20')
      scratchEls.rule.setAttribute('d', 'M 11 30 H 154')
      scratchEls.files.setAttribute('x', '11')
      scratchEls.files.setAttribute('y', '50')

      // Wires (compact)
      const submitPath = 'M 182 48 H 200'
      const allocatePath = 'M 282 99 V 118'
      const scriptReadPath = 'M 162 323 V 282'
      const scratchWritePath = 'M 282 282 V 323'
      const scratchReadPath = 'M 232 323 V 298 Q 232 293 227 293 H 13 Q 8 293 8 288 V 68 Q 8 63 13 63 H 18'

      controlBase.setAttribute('d', `${submitPath} ${allocatePath}`)
      mountBase.setAttribute('d', `M 18 48 H 8 V 357 H 18 ${scriptReadPath} ${scratchWritePath}`)
      wires.submit.setAttribute('d', submitPath)
      wires.allocate.setAttribute('d', allocatePath)
      wires['script-read'].setAttribute('d', scriptReadPath)
      wires['scratch-write'].setAttribute('d', scratchWritePath)
      wires['scratch-read'].setAttribute('d', scratchReadPath)
    } else {
      art.setAttribute('viewBox', '0 0 920 398')

      // Login 2.5D plinth + recessed flat 2D terminal tile (left)
      move(nodes.login, 14, 98)
      setPlinth(loginEls.edge, loginEls.deck, loginEls.crease, 238, 140, 12, 10)
      setText(loginEls.kicker, 'ACCESS · SHARED')
      loginEls.kicker.setAttribute('x', '16')
      loginEls.kicker.setAttribute('y', '25')
      loginEls.online.setAttribute('cx', '218')
      loginEls.online.setAttribute('cy', '21')
      loginEls.title.setAttribute('x', '16')
      loginEls.title.setAttribute('y', '45')
      loginEls.terminal.setAttribute('x', '14')
      loginEls.terminal.setAttribute('y', '53')
      loginEls.terminal.setAttribute('width', '210')
      loginEls.terminal.setAttribute('height', '57')
      loginEls.prompt.setAttribute('x', '22')
      loginEls.prompt.setAttribute('y', '73')
      loginEls.output.setAttribute('x', '22')
      loginEls.output.setAttribute('y', '95')
      loginEls.note.toggleAttribute('hidden', false)
      loginEls.note.setAttribute('x', '16')
      loginEls.note.setAttribute('y', '128')

      // Slurm flat 2D control card (top-center)
      move(nodes.slurm, 332, 10)
      sizeRect(nodes.slurm, 256, 74)
      slurmEls.stripe.setAttribute('d', 'M 0 1.2 H 256')
      setText(slurmEls.kicker, 'SCHEDULER · CONTROL')
      slurmEls.kicker.setAttribute('x', '14')
      slurmEls.kicker.setAttribute('y', '21')
      slurmEls.title.setAttribute('x', '14')
      slurmEls.title.setAttribute('y', '44')
      slurmEls.pill.setAttribute('x', '156')
      slurmEls.pill.setAttribute('y', '24')
      slurmEls.pill.setAttribute('width', '86')
      slurmEls.pill.setAttribute('height', '22')
      slurmEls.badge.setAttribute('x', '199')
      slurmEls.badge.setAttribute('y', '39')
      slurmEls.rule.toggleAttribute('hidden', true)
      slurmEls.summary.setAttribute('x', '14')
      slurmEls.summary.setAttribute('y', '63')
      slurmEls.note.toggleAttribute('hidden', true)

      // Compute 2.5D plinth (right)
      move(computeLayout, 530, 92)
      setPlinth(computeEls.edge, computeEls.deck, computeEls.crease, 376, 164, 13, 11)
      computeEls.kicker.setAttribute('x', '16')
      computeEls.kicker.setAttribute('y', '25')
      computeEls.led.setAttribute('cx', '356')
      computeEls.led.setAttribute('cy', '21')
      computeEls.title.setAttribute('x', '16')
      computeEls.title.setAttribute('y', '45')
      computeEls.status.setAttribute('x', '346')
      computeEls.status.setAttribute('y', '44')

      // Flat 2D Batch shell tile inside gpu01
      move(nodes.env, 16, 54)
      sizeRect(nodes.env, 344, 44)
      envBadge.setAttribute('x', '332')
      envBadge.setAttribute('y', '18')

      // 2.5D GPU bricks inside gpu01
      gpuBasePos = [16, 106]
      move(nodes.gpu, gpuBasePos[0], gpuBasePos[1])
      setPlinth(gpuEls.edge, gpuEls.deck, gpuEls.crease, 196, 42, 5, 5)
      gpuEls.title.setAttribute('x', '11')
      gpuEls.title.setAttribute('y', '19')
      gpuEls.statusText.setAttribute('x', '185')
      gpuEls.statusText.setAttribute('y', '19')
      meterMaxWidth = 174
      meterTrack.setAttribute('x', '11')
      meterTrack.setAttribute('y', '28')
      meterTrack.setAttribute('width', String(meterMaxWidth))
      meterFill.setAttribute('x', '11')
      meterFill.setAttribute('y', '28')

      move(otherGpusGroup, 220, 106)
      for (const [idx, slot] of otherGpus.entries()) {
        move(slot, idx * 48, 0)
        setPlinth(
          slot.querySelector<SVGPathElement>('.job-slot-edge')!,
          slot.querySelector<SVGPathElement>('.job-slot-deck')!,
          slot.querySelector<SVGPathElement>('.job-slot-crease')!,
          44,
          42,
          4,
          5,
        )
        for (const label of slot.querySelectorAll('text')) label.setAttribute('x', '22')
      }

      // Flat 2D Shared storage cards (bottom)
      trayRule.setAttribute('d', 'M 14 310 H 906')
      trayLabel.setAttribute('x', '16')
      trayLabel.setAttribute('y', '304')

      move(nodes.home, 44, 322)
      sizeRect(nodes.home, 340, 62)
      homeEls.stripe.setAttribute('d', 'M 1.2 0 V 62')
      setText(homeEls.title, '/home/<user>')
      homeEls.title.setAttribute('x', '15')
      homeEls.title.setAttribute('y', '22')
      homeEls.policy.setAttribute('x', '326')
      homeEls.policy.setAttribute('y', '21')
      homeEls.rule.setAttribute('d', 'M 15 31 H 326')
      homeEls.files.setAttribute('x', '15')
      homeEls.files.setAttribute('y', '49')
      setText(homeEls.files, 'job.sh   train.py')

      move(nodes.scratch, 524, 322)
      sizeRect(nodes.scratch, 370, 62)
      scratchEls.stripe.setAttribute('d', 'M 1.2 0 V 62')
      setText(scratchEls.title, '/scratch/<user>')
      scratchEls.title.setAttribute('x', '15')
      scratchEls.title.setAttribute('y', '22')
      setText(scratchEls.policy, '60-day purge')
      scratchEls.policy.setAttribute('x', '356')
      scratchEls.policy.setAttribute('y', '21')
      scratchEls.rule.setAttribute('d', 'M 15 31 H 356')
      scratchEls.files.setAttribute('x', '15')
      scratchEls.files.setAttribute('y', '49')

      // Wires (wide)
      const submitPath = 'M 132 98 V 56 Q 132 47 141 47 H 332'
      const allocatePath = 'M 588 47 H 703 Q 712 47 712 56 V 92'
      const scriptReadPath = 'M 336 322 V 296 Q 336 290 342 290 H 584 Q 590 290 590 284 V 267'
      const scratchWritePath = 'M 728 267 V 322'
      const scratchReadPath = 'M 564 322 V 284 Q 564 278 558 278 H 204 Q 198 278 198 272 V 248'

      controlBase.setAttribute('d', `${submitPath} ${allocatePath}`)
      mountBase.setAttribute('d', `M 132 248 V 322 ${scriptReadPath} ${scratchWritePath} M 564 322 V 278 H 198 V 248`)
      wires.submit.setAttribute('d', submitPath)
      wires.allocate.setAttribute('d', allocatePath)
      wires['script-read'].setAttribute('d', scriptReadPath)
      wires['scratch-write'].setAttribute('d', scratchWritePath)
      wires['scratch-read'].setAttribute('d', scratchReadPath)
    }

    for (const id of wireIds) {
      wireLengths[id] = wires[id].getTotalLength()
    }
  }

  function draw(elapsedMs: number, reduced: boolean) {
    const frame = frameAt(elapsedMs)
    const isNarrow = Boolean(compact)

    // Login
    nodes.login.dataset.loginReading = String(frame.login.activity === 'reading')
    setText(loginEls.prompt, isNarrow ? frame.login.compactPrompt : frame.login.widePrompt)
    setText(loginEls.output, isNarrow ? frame.login.compactOutput : frame.login.wideOutput)

    // Slurm
    nodes.slurm.dataset.slurmStatus = frame.slurm.status
    setText(slurmEls.badge, frame.slurm.badge)
    setText(slurmEls.summary, isNarrow ? frame.slurm.compactSummary : frame.slurm.wideSummary)

    // Compute, Env & GPU
    computeLayout.dataset.allocated = String(frame.compute.allocated)
    computeLayout.dataset.released = String(frame.compute.released)
    setText(
      computeEls.status,
      frame.compute.allocated
        ? isNarrow ? 'Job 1405015' : 'Allocated · Job 1405015'
        : frame.compute.released
          ? 'Released'
          : 'Idle',
    )

    nodes.env.dataset.envStatus = frame.env.status
    setText(envBadge, frame.env.badge)
    setText(envDetail, isNarrow ? frame.env.compactDetail : frame.env.wideDetail)

    nodes.gpu.dataset.gpuStatus = frame.gpu.status
    const gpuLift = !reduced && (frame.gpu.status === 'allocated' || frame.gpu.status === 'running') ? -2 : 0
    move(nodes.gpu, gpuBasePos[0], gpuBasePos[1] + gpuLift)
    const pct = `${Math.round(frame.gpu.progress * 100)}%`
    const gpuLabel = frame.gpu.status === 'running'
      ? `Run ${pct}`
      : frame.gpu.status === 'allocated'
        ? 'Allocated'
        : frame.gpu.status === 'done'
          ? 'Done'
          : frame.gpu.status === 'released'
            ? 'Freed'
            : 'Free'
    setText(gpuEls.statusText, gpuLabel)
    meterFill.setAttribute('width', String(meterMaxWidth * frame.gpu.progress))

    // Scratch output
    nodes.scratch.dataset.hasOutput = String(frame.scratchOutput)
    setText(
      scratchEls.files,
      frame.scratchOutput
        ? isNarrow ? 'result.pt  .out' : 'result.pt   slurm-1405015.out'
        : isNarrow ? '— (empty)' : '— (no job output yet)',
    )

    // Focus highlight on anchored part
    for (const [id, group] of Object.entries(nodes) as [JobPart, SVGGElement][]) {
      group.classList.toggle('job-focus', id === frame.note.anchor)
    }

    // Active wire & directional arrow
    for (const id of wireIds) {
      const wire = wires[id]
      const active = frame.activeWire === id
      wire.toggleAttribute('hidden', !active)
      if (active) {
        wire.setAttribute('marker-end', `url(#job-arrow-${wireTones[id]})`)
      } else {
        wire.removeAttribute('marker-end')
      }
    }

    // Traveling packet
    const showPacket = Boolean(frame.packet) && !reduced
    packet.toggleAttribute('hidden', !showPacket)
    if (frame.packet && !reduced) {
      const { wire, badge, progress } = frame.packet
      const tone = wireTones[wire]
      packet.dataset.tone = tone
      const badgeWidth = badge.length * 7.2 + 14
      packetRect.setAttribute('x', String(-badgeWidth / 2))
      packetRect.setAttribute('width', String(badgeWidth))
      setText(packetText, badge)
      const pt = wires[wire].getPointAtLength(wireLengths[wire] * progress)
      move(packet, pt.x, pt.y)
    }

    const activeWireEl = frame.activeWire ? wires[frame.activeWire] : null
    const { anchor, ...note } = frame.note
    return {
      ...note,
      target: nodes[anchor],
      avoid: [
        nodes.login,
        nodes.slurm,
        nodes.compute,
        nodes.home,
        nodes.scratch,
        ...(activeWireEl ? [activeWireEl] : []),
      ],
    }
  }

  return {
    art,
    draw,
    resize,
    describe(element, elapsedMs) {
      const id = element.dataset.lessonPart as JobPart
      const info = parts[id]
      const frame = frameAt(elapsedMs)
      if (id === 'login' && frame.login.activity === 'reading') {
        return { ...info, role: 'Reading shared output' }
      }
      if (id === 'slurm') {
        const role = frame.slurm.status === 'pending'
          ? 'Queued: Job 1405015 (PD)'
          : frame.slurm.status === 'running'
            ? 'Allocated: Job 1405015 on gpu01'
            : frame.slurm.status === 'completed'
              ? 'Completed: resources released'
              : info.role
        return { ...info, role }
      }
      if (id === 'compute') {
        const role = frame.compute.allocated
          ? 'Hosting Job 1405015 (gpu-a30)'
          : frame.compute.released
            ? 'Allocation released'
            : info.role
        return { ...info, role }
      }
      if (id === 'env') {
        const role = frame.env.status === 'loaded'
          ? 'Environment ready (Lmod)'
          : frame.env.status === 'starting'
            ? 'Fresh non-interactive shell'
            : frame.env.status === 'closed'
              ? 'Exited when job finished'
              : 'Starts after allocation'
        return { ...info, role }
      }
      if (id === 'gpu') {
        const role = frame.gpu.status === 'running'
          ? 'Executing train.py'
          : frame.gpu.status === 'allocated'
            ? 'Reserved by --gpus-per-node=1'
            : frame.gpu.status === 'done'
              ? 'Kernel work complete'
              : frame.gpu.status === 'released'
                ? 'Freed for next job'
                : '1 of 4 node GPUs'
        return { ...info, role }
      }
      if (id === 'scratch' && frame.scratchOutput) {
        return { ...info, role: 'Holds job output (shared)' }
      }
      return info
    },
  }
}

export const lesson: LessonOptions = {
  title: 'Job walkthrough',
  subtitle: 'Login shell, Slurm allocation, compute node, and shared storage',
  diagramLabel: 'Interactive HPC4 batch job diagram',
  timeline,
  footer: `<p>HPC4 batch workflow / compressed queue time</p><a href="${evidence.handbook}" target="_blank" rel="noopener noreferrer">HPC handbook</a>`,
  createScene: createJobScene,
}
