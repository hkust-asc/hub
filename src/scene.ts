type Point3 = [number, number, number]
type Point2 = [number, number]
type Palette = [string, string, string]
import type { ClusterTopicId } from './model'

const palettes: Record<string, Palette> = {
  board: ['#e4ebe8', '#c6d4cd', '#b1c3ba'],
  frame: ['#e2e5e8', '#c6ccd2', '#aeb7c0'],
  cpu: ['#e3b47d', '#c78d51', '#a87540'],
  cpuTop: ['#f4dbc0', '#d7aa76', '#b58c5e'],
  memory: ['#70a596', '#427d6d', '#346455'],
  chip: ['#40575a', '#304345', '#26383a'],
  gpu: ['#91a8db', '#6681b8', '#4f6798'],
  gpuTop: ['#d9e3f6', '#aec0e5', '#8b9ec5'],
  network: ['#b5beca', '#8d9baa', '#718394'],
  slot: ['#a3b0b0', '#7c9190', '#637b79'],
}

function project([horizontal, depth, height]: Point3): Point2 {
  return [410 + (horizontal - depth) * 0.88, 108 + (horizontal + depth) * 0.44 - height]
}

function points(vertices: Point3[]): string {
  return vertices.map(vertex => project(vertex).join(',')).join(' ')
}

function block(horizontal: number, depth: number, height: number, width: number, length: number, thickness: number, palette: string): string {
  const [top, front, side] = palettes[palette]!
  const farLeft: Point3 = [horizontal, depth, height + thickness]
  const farRight: Point3 = [horizontal + width, depth, height + thickness]
  const nearRight: Point3 = [horizontal + width, depth + length, height + thickness]
  const nearLeft: Point3 = [horizontal, depth + length, height + thickness]
  return `<g class="solid" stroke-width="1" stroke-linejoin="round">
    <polygon points="${points([nearLeft, nearRight, [horizontal + width, depth + length, height], [horizontal, depth + length, height]])}" fill="${front}" />
    <polygon points="${points([farRight, nearRight, [horizontal + width, depth + length, height], [horizontal + width, depth, height]])}" fill="${side}" />
    <polygon points="${points([farLeft, farRight, nearRight, nearLeft])}" fill="${top}" />
  </g>`
}

function line(vertices: Point3[], className: string, attributes = ''): string {
  const path = vertices.map((vertex, index) => `${index === 0 ? 'M' : 'L'} ${project(vertex).join(' ')}`).join(' ')
  return `<path d="${path}" class="${className}" ${attributes} />`
}

function part(topic: string, name: string, contents: string, lift: number, extra = ''): string {
  return `<g class="part ${extra}" data-topic="${topic}" tabindex="0" role="button" aria-label="${name}" aria-pressed="false" style="--lift: ${lift}px"><title>${name}</title>${contents}</g>`
}

function cpu(horizontal: number, depth: number, socket: number): string {
  let contents = block(horizontal - 6, depth - 6, 6, 112, 112, 5, 'slot')
  contents += block(horizontal, depth, 11, 100, 100, 11, 'cpu')
  contents += block(horizontal + 13, depth + 13, 22, 74, 74, 3, 'cpuTop')
  for (let pin = 0; pin < 8; pin++) {
    contents += line([[horizontal + 8 + pin * 12, depth, 23], [horizontal + 8 + pin * 12, depth + 8, 23]], 'processor-pin')
  }
  const [textHorizontal, textDepth] = project([horizontal + 50, depth + 50, 26])
  contents += `<text x="${textHorizontal}" y="${textDepth - 4}" class="chip-word" text-anchor="middle">CPU ${socket}</text>
    <text x="${textHorizontal}" y="${textDepth + 12}" class="chip-detail" text-anchor="middle">XEON</text>`
  return part('cpu', `CPU socket ${socket}`, contents, -26, `socket-${socket}`)
}

function memoryBank(horizontal: number, depth: number, bank: number): string {
  let contents = ''
  for (let module = 0; module < 4; module++) {
    const row = depth + module * 17
    contents += block(horizontal - 2, row - 2, 5, 104, 10, 5, 'slot')
    contents += block(horizontal, row, 10, 100, 5, 31, 'memory')
    for (let chip = 0; chip < 5; chip++) contents += block(horizontal + 6 + chip * 18, row + 5, 23, 13, 3, 12, 'chip')
    const [contactHorizontal, contactDepth] = project([horizontal + 3, row + 6, 12])
    contents += `<path d="M ${contactHorizontal} ${contactDepth} l 82 41" class="memory-contact" />`
  }
  return part('memory', `Host memory near socket ${bank}`, contents, -39, `bank-${bank}`)
}

function gpu(horizontal: number, depth: number, index: number): string {
  let contents = block(horizontal - 3, depth - 3, 5, 86, 76, 5, 'slot')
  contents += block(horizontal, depth, 10, 80, 70, 21, 'gpu')
  contents += block(horizontal + 8, depth + 8, 31, 64, 54, 3, 'gpuTop')
  for (let fin = 0; fin < 5; fin++) {
    contents += line([[horizontal + 13 + fin * 12, depth + 14, 35], [horizontal + 13 + fin * 12, depth + 55, 35]], 'gpu-fin')
  }
  const [textHorizontal, textDepth] = project([horizontal + 40, depth + 37, 36])
  contents += `<rect x="${textHorizontal - 19}" y="${textDepth - 10}" width="38" height="20" rx="3" class="gpu-label-bg" />
    <text x="${textHorizontal}" y="${textDepth + 4}" class="gpu-word" text-anchor="middle">A30</text>
    <circle cx="${project([horizontal + 70, depth + 58, 35])[0]}" cy="${project([horizontal + 70, depth + 58, 35])[1]}" r="2.7" class="device-led" />`
  return part('gpu', `GPU ${index}, NVIDIA A30, 24 GB device memory`, contents, -48, `gpu-unit gpu-${index}`)
}

function annotation(horizontal: number, depth: number, text: string, detail: string, topic: string, side: 'start' | 'end' = 'start'): string {
  return `<g class="annotation" data-annotation="${topic}" aria-hidden="true">
    <text x="${horizontal}" y="${depth}" text-anchor="${side}" class="annotation-name">${text}</text>
    <text x="${horizontal}" y="${depth + 17}" text-anchor="${side}" class="annotation-detail">${detail}</text>
  </g>`
}

export function createScene(): string {
  const transferLinks = [
    { id: 'memory-local', vertices: [[370, 224, 8], [370, 202, 8], [328, 202, 8]] },
    { id: 'memory-remote', vertices: [[130, 224, 8], [130, 202, 8], [170, 202, 8]] },
    { id: 'socket-link', vertices: [[170, 202, 8], [190, 202, 8], [190, 188, 8], [308, 188, 8], [308, 202, 8], [328, 202, 8]] },
    { id: 'pcie-link', vertices: [[328, 202, 8], [300, 202, 8], [300, 310, 8], [350, 310, 8], [350, 340, 8]] },
    { id: 'gpu-link', vertices: [[350, 340, 8], [410, 340, 8], [410, 352, 8]] },
  ]
  const copperTraces = [
    [[190, 134, 6], [230, 134, 6], [230, 94, 6], [270, 94, 6]],
    [[184, 142, 6], [240, 142, 6], [240, 103, 6], [270, 103, 6]],
    [[160, 300, 6], [160, 308, 6], [80, 308, 6], [80, 350, 6]],
    [[166, 300, 6], [166, 316, 6], [190, 316, 6], [190, 350, 6]],
    [[420, 300, 6], [420, 317, 6], [300, 317, 6], [300, 350, 6]],
  ]
  const transferMarkup = transferLinks.map(connection => line(connection.vertices as Point3[], 'transfer-link', `data-link="${connection.id}"`)).join('')
  let devices = cpu(80, 100, 0) + cpu(320, 100, 1)
  devices += memoryBank(80, 230, 0) + memoryBank(320, 230, 1)
  devices += [50, 160, 270, 380].map((horizontal, index) => gpu(horizontal, 350, index === 3 ? 0 : index + 1)).join('')
  let nic = block(385, 32, 7, 86, 36, 13, 'network')
  nic += block(438, 35, 20, 24, 25, 4, 'chip')
  nic += block(390, 34, 20, 19, 12, 4, 'frame')
  nic += block(414, 34, 20, 19, 12, 4, 'frame')

  const diagram = `<svg class="node-diagram" viewBox="0 0 900 570" xmlns="http://www.w3.org/2000/svg" aria-labelledby="diagram-title diagram-description">
    <title id="diagram-title">Inside an HPC4 A30 GPU node, illustrative topology</title>
    <desc id="diagram-description">An isometric schematic with two CPU sockets, host memory, four NVIDIA A30 GPUs and a network interface. Published hardware counts are factual; component positions, memory-module counts, affinities and wiring are illustrative. Select a component for its explanation.</desc>
    <defs>
      <filter id="board-shadow" x="-25%" y="-25%" width="150%" height="170%"><feGaussianBlur stdDeviation="13" /></filter>
    </defs>
    <ellipse cx="462" cy="390" rx="288" ry="102" fill="#203f33" opacity="0.1" filter="url(#board-shadow)" />
    <g class="motherboard">
      ${block(0, 0, -22, 520, 460, 13, 'frame')}
      ${block(10, 10, -9, 500, 440, 12, 'board')}
      <polygon points="${points([[20, 20, 5], [250, 20, 5], [250, 330, 5], [20, 330, 5]])}" class="locality-zone zone-0" />
      <polygon points="${points([[260, 20, 5], [500, 20, 5], [500, 330, 5], [260, 330, 5]])}" class="locality-zone zone-1" />
      ${copperTraces.map(vertices => line(vertices as Point3[], 'board-trace')).join('')}
      ${transferMarkup}
      ${line([[80, 202, 7], [15, 202, 7], [15, 180, 7]], 'board-trace')}
      ${line([[438, 78, 7], [438, 210, 7], [470, 210, 7], [470, 320, 7]], 'network-trace')}
      ${[25, 490].flatMap(horizontal => [25, 430].map(depth => {
        const [positionHorizontal, positionDepth] = project([horizontal, depth, 5])
        return `<circle cx="${positionHorizontal}" cy="${positionDepth}" r="4" class="mount-hole" />`
      })).join('')}
      ${devices}
      ${part('nic', 'Network interface, connection to the cluster fabric', nic, -20)}
    </g>
    <g class="diagram-connectors" aria-hidden="true">
      <path d="M 455 172 L 459 143 L 500 143" />
      <path d="M 324 268 L 245 246 L 158 246" />
      <path d="M 571 396 L 641 418 L 688 418" />
      <path d="M 747 283 L 780 250 L 790 250" />
    </g>
    ${annotation(506, 131, 'CPU SOCKETS', '2 x Intel Xeon Gold', 'cpu')}
    ${annotation(154, 231, 'HOST RAM', '512 GB per node', 'memory', 'end')}
    ${annotation(691, 405, 'GPU ARRAY', '4 x A30 / 24 GB each', 'gpu')}
    ${annotation(790, 228, 'NETWORK', 'RoCE fabric', 'nic', 'end')}
    <g class="socket-label" aria-hidden="true"><text x="245" y="365">SOCKET 0</text><text x="452" y="268">SOCKET 1</text></g>
    <g class="bus-target" data-topic="numa" role="button" tabindex="0" aria-label="NUMA locality and the inter-socket link" aria-pressed="false">
      ${line([[170, 202, 10], [190, 202, 10], [190, 188, 10], [308, 188, 10], [308, 202, 10], [328, 202, 10]], 'bus-hit')}
      <title>NUMA and inter-socket locality</title>
    </g>
    <g class="bus-target" data-topic="pcie" role="button" tabindex="0" aria-label="PCI Express host-to-device path" aria-pressed="false">
      ${line([[300, 220, 10], [300, 310, 10], [350, 310, 10], [350, 340, 10], [410, 340, 10]], 'bus-hit')}
      <title>PCI Express</title>
    </g>
    <g class="motion-layer" aria-hidden="true">${transferLinks.map(connection => line(connection.vertices as Point3[], 'transfer-flow', `data-flow="${connection.id}"`)).join('')}</g>
    <g class="buffer-markers" aria-hidden="true">
      <g class="host-marker host-marker-local"><path d="M 562 289 L 533 320" /><circle cx="562" cy="276" r="19" /><text x="562" y="284" text-anchor="middle">H</text></g>
      <g class="host-marker host-marker-remote"><path d="M 351 185 L 322 216" /><circle cx="351" cy="172" r="19" /><text x="351" y="180" text-anchor="middle">H</text></g>
      <g class="device-marker"><path d="M 484 463 L 461 433" /><circle cx="484" cy="477" r="19" /><text x="484" y="485" text-anchor="middle">D</text></g>
    </g>
    <g class="diagram-scale" aria-hidden="true"><path d="M 84 484 H 153 M 84 480 V 488 M 153 480 V 488" /><text x="84" y="508">SCHEMATIC / NOT TO SCALE</text></g>
    <g class="allocation-label" aria-hidden="true"><rect x="602" y="466" width="138" height="28" rx="4" /><text x="671" y="484" text-anchor="middle">GPU 0 / ALLOCATED</text></g>
  </svg>`
  return diagram
}

function rackGlyph(horizontal: number, vertical: number, palette: string): string {
  let contents = block(0, 0, 0, 72, 42, 74, 'frame')
  for (let shelf = 0; shelf < 3; shelf++) {
    contents += block(7, 43, 10 + shelf * 20, 58, 2, 13, palette)
    const [indicatorHorizontal, indicatorVertical] = project([58, 46, 16 + shelf * 20])
    contents += `<circle cx="${indicatorHorizontal}" cy="${indicatorVertical}" r="2" class="device-led" />`
  }
  return `<g transform="translate(${horizontal - 410} ${vertical - 108})">${contents}</g>`
}

export function createClusterScene(): string {
  const families: { id: ClusterTopicId; name: string; subtitle: string; horizontal: number; palette: string }[] = [
    { id: 'login', name: 'LOGIN', subtitle: 'Access + preparation', horizontal: 105, palette: 'network' },
    { id: 'cpu-nodes', name: 'CPU NODES', subtitle: 'Intel / AMD', horizontal: 315, palette: 'cpu' },
    { id: 'a30', name: 'A30 NODES', subtitle: '4 GPUs per node', horizontal: 495, palette: 'gpu' },
    { id: 'rtx4090d', name: 'RTX 4090D', subtitle: '6 GPUs per node', horizontal: 675, palette: 'gpu' },
    { id: 'other-gpus', name: 'L20 / RTX 5880', subtitle: 'Other GPU families', horizontal: 855, palette: 'gpu' },
  ]
  return `<svg class="cluster-diagram" viewBox="0 0 1000 530" xmlns="http://www.w3.org/2000/svg" aria-labelledby="cluster-title cluster-description">
    <title id="cluster-title">HPC4 system overview, schematic connectivity</title>
    <desc id="cluster-description">Login systems, CPU-node families, A30, RTX 4090D, and other GPU families. A shared RoCE line denotes internode connectivity, not switch wiring. Shared storage appears separately with logical file-system access, not a verified network route. Each glyph represents a family, not an individual rack or node count.</desc>
    <text x="62" y="77" class="cluster-group-label">ACCESS</text><text x="285" y="77" class="cluster-group-label">COMPUTE NODE FAMILIES</text>
    <path d="M 120 294 V 326 H 870 V 294" class="cluster-fabric-line" />
    ${families.map(family => `<path d="M ${family.horizontal + 15} 259 V 326" class="cluster-family-link" data-family-link="${family.id}" />`).join('')}
    ${families.map(family => `<g class="cluster-part" data-cluster-topic="${family.id}" role="button" tabindex="0" aria-label="${family.name === 'LOGIN' ? 'Login nodes' : family.id === 'a30' ? 'A30 compute nodes' : family.id === 'rtx4090d' ? 'RTX 4090D compute nodes' : family.id === 'cpu-nodes' ? 'CPU compute nodes' : 'Other GPU compute nodes'}" aria-pressed="false"><title>${family.name}</title>${rackGlyph(family.horizontal, 196, family.palette)}<text x="${family.horizontal + 15}" y="268" text-anchor="middle" class="cluster-part-name">${family.name}</text><text x="${family.horizontal + 15}" y="285" text-anchor="middle" class="cluster-part-detail">${family.subtitle}</text>${family.id === 'a30' ? '<text x="510" y="111" text-anchor="middle" class="cluster-detail-marker">DETAIL SCENE</text>' : ''}</g>`).join('')}
    <g class="cluster-part fabric-subject" data-cluster-topic="fabric" role="button" tabindex="0" aria-label="Internode fabric, 200 Gbps RoCE" aria-pressed="false"><rect x="354" y="309" width="291" height="34" rx="4" /><text x="500" y="330" text-anchor="middle" class="cluster-fabric-text">200 Gbps RoCE / internode fabric</text></g>
    <path d="M 510 355 V 387" class="storage-access-link" /><text x="527" y="377" class="cluster-access-label">SHARED FILE-SYSTEM ACCESS</text>
    <g class="cluster-part storage-subject" data-cluster-topic="storage" role="button" tabindex="0" aria-label="Shared storage, home project and scratch" aria-pressed="false">${rackGlyph(495, 453, 'memory')}<text x="590" y="420" class="cluster-part-name">SHARED STORAGE</text><text x="590" y="441" class="cluster-part-detail">/home /project /scratch</text><text x="590" y="461" class="cluster-access-label">Storage-network route not modeled</text></g>
    <text x="62" y="491" class="cluster-access-label">FAMILY GLYPHS / NOT AN INVENTORY OR SWITCH MAP</text>
  </svg>`
}