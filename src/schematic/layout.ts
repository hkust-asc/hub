import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkExtendedEdge, ElkNode, ElkPoint } from 'elkjs/lib/elk-api'
import type { SchematicNodeSpec, SchematicWireSpec } from './types.ts'

export interface ComputedNodeBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ComputedWireRoute {
  points: readonly ElkPoint[]
  path: string
}

export interface ComputedSchematicLayout<PartId extends string = string, WireId extends string = string> {
  width: number
  height: number
  nodes: Record<PartId, ComputedNodeBox>
  wires: Record<WireId, ComputedWireRoute>
}

export interface SchematicLayoutPair<PartId extends string = string, WireId extends string = string> {
  wide: ComputedSchematicLayout<PartId, WireId>
  compact: ComputedSchematicLayout<PartId, WireId>
}

const elk = new ELK()

const round = (value: number): number => Math.round(value * 10) / 10

export function roundedOrthogonalPath(rawPoints: readonly ElkPoint[], cornerRadius = 8): string {
  const points: ElkPoint[] = []
  for (const pt of rawPoints) {
    const prev = points.at(-1)
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 0.5) {
      points.push(pt)
    }
  }
  if (points.length < 2) return ''
  const first = points[0]!
  const last = points.at(-1)!
  if (points.length === 2) {
    return `M ${round(first.x)} ${round(first.y)} L ${round(last.x)} ${round(last.y)}`
  }

  const segments = [`M ${round(first.x)} ${round(first.y)}`]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const curr = points[i]!
    const next = points[i + 1]!
    const inDx = curr.x - prev.x
    const inDy = curr.y - prev.y
    const outDx = next.x - curr.x
    const outDy = next.y - curr.y
    const inLen = Math.hypot(inDx, inDy)
    const outLen = Math.hypot(outDx, outDy)
    const radius = Math.min(cornerRadius, inLen / 2, outLen / 2)
    const cross = Math.abs(inDx * outDy - inDy * outDx)
    if (radius < 1 || cross < 0.01) {
      segments.push(`L ${round(curr.x)} ${round(curr.y)}`)
      continue
    }
    const enterX = curr.x - (inDx / inLen) * radius
    const enterY = curr.y - (inDy / inLen) * radius
    const exitX = curr.x + (outDx / outLen) * radius
    const exitY = curr.y + (outDy / outLen) * radius
    segments.push(
      `L ${round(enterX)} ${round(enterY)}`,
      `Q ${round(curr.x)} ${round(curr.y)} ${round(exitX)} ${round(exitY)}`,
    )
  }
  segments.push(`L ${round(last.x)} ${round(last.y)}`)
  return segments.join(' ')
}

async function computeModeLayout<PartId extends string, WireId extends string>(
  nodes: readonly SchematicNodeSpec<PartId>[],
  wires: readonly SchematicWireSpec<WireId, PartId>[],
  mode: 'wide' | 'compact',
): Promise<ComputedSchematicLayout<PartId, WireId>> {
  const wide = mode === 'wide'
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': wide ? 'RIGHT' : 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': wide ? '38' : '22',
      'elk.spacing.nodeNode': wide ? '18' : '12',
      'elk.spacing.edgeNode': '12',
      'elk.spacing.edgeEdge': '10',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.padding': '[top=10,left=10,bottom=10,right=10]',
    },
    children: nodes.map(node => ({
      id: node.id,
      width: wide ? node.wide.width : node.compact.width,
      height: wide ? node.wide.height : node.compact.height,
    })),
    edges: wires.map<ElkExtendedEdge>(wire => ({
      id: wire.id,
      sources: [wire.from],
      targets: [wire.to],
    })),
  }

  const laidOut = await elk.layout(graph)
  const nodeBoxes = {} as Record<PartId, ComputedNodeBox>
  for (const child of laidOut.children ?? []) {
    nodeBoxes[child.id as PartId] = {
      x: round(child.x ?? 0),
      y: round(child.y ?? 0),
      width: round(child.width ?? 0),
      height: round(child.height ?? 0),
    }
  }

  const wireRoutes = {} as Record<WireId, ComputedWireRoute>
  for (const edge of laidOut.edges ?? []) {
    const section = edge.sections?.[0]
    const points = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
      : []
    wireRoutes[edge.id as WireId] = {
      points,
      path: roundedOrthogonalPath(points),
    }
  }

  return {
    width: Math.ceil(laidOut.width ?? 800),
    height: Math.ceil(laidOut.height ?? 320),
    nodes: nodeBoxes,
    wires: wireRoutes,
  }
}

export async function computeSchematicLayouts<PartId extends string, WireId extends string>(
  nodes: readonly SchematicNodeSpec<PartId>[],
  wires: readonly SchematicWireSpec<WireId, PartId>[],
): Promise<SchematicLayoutPair<PartId, WireId>> {
  const [wide, compact] = await Promise.all([
    computeModeLayout(nodes, wires, 'wide'),
    computeModeLayout(nodes, wires, 'compact'),
  ])
  return { wide, compact }
}
