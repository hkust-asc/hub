export type Point3 = readonly [horizontal: number, depth: number, height: number]
export type Point2 = readonly [x: number, y: number]
export type IsoShade = readonly [top: string, front: string, side: string]

export const isoPalettes = {
  // Architectural chassis & board surfaces
  board: ['#e6eee9', '#cad8d1', '#b4c6bd'],
  frame: ['#e6eaee', '#cbd2d9', '#b1bac3'],
  slot: ['#a3b0b0', '#7c9190', '#637b79'],
  chip: ['#4d6468', '#364b4e', '#28393c'],

  // Semantic hardware & domain tones (top / front / side)
  cpu: ['#e3b47d', '#c78d51', '#a87540'],
  cpuTop: ['#f4dbc0', '#d7aa76', '#b58c5e'],
  amber: ['#f5dec3', '#d59d62', '#b07b43'],
  amberDeep: ['#e9c59b', '#be8448', '#986734'],

  memory: ['#70a596', '#427d6d', '#346455'],
  green: ['#cce6dd', '#66a090', '#447c6d'],
  greenDeep: ['#9ecbc0', '#488373', '#356558'],

  gpu: ['#91a8db', '#6681b8', '#4f6798'],
  gpuTop: ['#d9e3f6', '#aec0e5', '#8b9ec5'],
  blue: ['#dae4f7', '#7b97cf', '#5875ae'],
  blueDeep: ['#adc2ea', '#5c7ab8', '#466199'],

  network: ['#b5beca', '#8d9baa', '#718394'],
  slate: ['#dde3e9', '#94a4b3', '#738596'],
  coral: ['#fad5cd', '#dd7462', '#b95545'],
} as const satisfies Record<string, IsoShade>

export type IsoPaletteName = keyof typeof isoPalettes

export interface IsoProjectorOptions {
  originX: number
  originY: number
  scale: number
  roundTo?: number
}

export interface IsoBoxStyle {
  className?: string
  stroke?: string
  strokeWidth?: number
}

export interface IsoProjector {
  project(point: Point3): Point2
  points(vertices: readonly Point3[]): string
  polygon(pts: readonly Point2[], fill: string): string
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    palette: IsoPaletteName,
    style?: IsoBoxStyle,
  ): string
  polyline(vertices: readonly Point3[], className: string, attributes?: string): string
  depthKey(x: number, y: number, w?: number, d?: number): number
}

export function createIsoProjector(options: IsoProjectorOptions): IsoProjector {
  const { originX, originY, scale, roundTo } = options
  const halfScale = scale / 2
  const fmt = roundTo !== undefined
    ? (v: number) => Math.round(v * roundTo) / roundTo
    : (v: number) => v

  function project([horizontal, depth, height]: Point3): Point2 {
    return [
      fmt(originX + (horizontal - depth) * scale),
      fmt(originY + (horizontal + depth) * halfScale - height),
    ]
  }

  function points(vertices: readonly Point3[]): string {
    return vertices.map(vertex => project(vertex).join(',')).join(' ')
  }

  function polygon(pts: readonly Point2[], fill: string): string {
    return `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}"/>`
  }

  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    palette: IsoPaletteName,
    style: IsoBoxStyle = {},
  ): string {
    const [top, front, side] = isoPalettes[palette]
    const tl = project([x, y, z + h])
    const tr = project([x + w, y, z + h])
    const br = project([x + w, y + d, z + h])
    const bl = project([x, y + d, z + h])
    const fbl = project([x, y + d, z])
    const fbr = project([x + w, y + d, z])
    const sbr = project([x + w, y, z])
    const cls = style.className ? ` class="${style.className}"` : ''
    const stroke = style.stroke ? ` stroke="${style.stroke}"` : ''
    const strokeWidth = ` stroke-width="${style.strokeWidth ?? 1}"`
    return `<g${cls}${stroke}${strokeWidth} stroke-linejoin="round">${polygon([bl, br, fbr, fbl], front)}${polygon([tr, br, fbr, sbr], side)}${polygon([tl, tr, br, bl], top)}</g>`
  }

  function polyline(vertices: readonly Point3[], className: string, attributes = ''): string {
    const d = vertices.map((vertex, index) => `${index === 0 ? 'M' : 'L'} ${project(vertex).join(' ')}`).join(' ')
    const extra = attributes ? ` ${attributes}` : ''
    return `<path d="${d}" class="${className}"${extra} />`
  }

  function depthKey(x: number, y: number, w = 0, d = 0): number {
    return (x + w / 2) + (y + d / 2)
  }

  return { project, points, polygon, box, polyline, depthKey }
}
