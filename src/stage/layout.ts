import type {
  LayoutMode,
  PortAnchor,
  PortSide,
  SchematicStageSpec,
  StageBox,
  StageEntitySpec,
  StageWireSpec,
  StageWireState,
} from './types.ts'

export interface Point2D {
  readonly x: number
  readonly y: number
}

export interface ViewBoxRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface ResolvedWireRoute {
  readonly points: readonly Point2D[]
  readonly path: string
  readonly midpoint: Point2D
}

const round = (v: number): number => Math.round(v * 10) / 10

export function roundedOrthogonalPath(rawPoints: readonly Point2D[], cornerRadius = 8): string {
  const points: Point2D[] = []
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

export function resolveEntityWorldBoxes<EntityId extends string>(
  entities: readonly StageEntitySpec<EntityId>[],
  mode: LayoutMode,
  overrides?: Partial<Record<EntityId, { readonly x: number; readonly y: number }>>,
): Record<EntityId, StageBox> {
  const specMap = new Map(entities.map(entity => [entity.id, entity]))
  const resolved = {} as Record<EntityId, StageBox>

  function getWorldBox(id: EntityId): StageBox {
    if (resolved[id]) return resolved[id]
    const spec = specMap.get(id)
    if (!spec) throw new Error(`Unknown stage entity: ${id}`)
    const base = mode === 'compact' ? spec.compact : spec.wide
    const customPos = overrides?.[id]
    const localX = customPos?.x ?? base.x
    const localY = customPos?.y ?? base.y
    if (!spec.parent) {
      const box = { x: round(localX), y: round(localY), w: round(base.w), h: round(base.h) }
      resolved[id] = box
      return box
    }
    const parentBox = getWorldBox(spec.parent)
    const box = {
      x: round(parentBox.x + localX),
      y: round(parentBox.y + localY),
      w: round(base.w),
      h: round(base.h),
    }
    resolved[id] = box
    return box
  }

  for (const entity of entities) getWorldBox(entity.id)
  return resolved
}

export function portPoint<EntityId extends string>(
  boxes: Record<EntityId, StageBox>,
  anchor: PortAnchor<EntityId>,
): Point2D {
  const box = boxes[anchor.id]
  const off = anchor.offset ?? 0
  switch (anchor.port) {
    case 'n':
      return { x: round(box.x + box.w / 2 + off), y: box.y }
    case 's':
      return { x: round(box.x + box.w / 2 + off), y: round(box.y + box.h) }
    case 'w':
      return { x: box.x, y: round(box.y + box.h / 2 + off) }
    case 'e':
      return { x: round(box.x + box.w), y: round(box.y + box.h / 2 + off) }
    case 'center':
      return { x: round(box.x + box.w / 2 + off), y: round(box.y + box.h / 2) }
  }
}

function autoOrthogonalWaypoints(
  start: Point2D,
  fromSide: PortSide,
  end: Point2D,
  toSide: PortSide,
): Point2D[] {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8) {
    return [start, end]
  }

  const fromHoriz = fromSide === 'e' || fromSide === 'w'
  const toHoriz = toSide === 'e' || toSide === 'w'

  if (fromHoriz && toHoriz) {
    const midX = round((start.x + end.x) / 2)
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
  }
  if (!fromHoriz && !toHoriz) {
    const midY = round((start.y + end.y) / 2)
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
  }
  if (fromHoriz && !toHoriz) {
    return [start, { x: end.x, y: start.y }, end]
  }
  return [start, { x: start.x, y: end.y }, end]
}

function polylineMidpoint(points: readonly Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!
  let total = 0
  const segLengths: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y)
    segLengths.push(len)
    total += len
  }
  let target = total / 2
  for (let i = 0; i < segLengths.length; i++) {
    const seg = segLengths[i]!
    if (target <= seg || i === segLengths.length - 1) {
      const ratio = seg > 0 ? target / seg : 0
      return {
        x: round(points[i]!.x + (points[i + 1]!.x - points[i]!.x) * ratio),
        y: round(points[i]!.y + (points[i + 1]!.y - points[i]!.y) * ratio),
      }
    }
    target -= seg
  }
  return points[0]!
}

export function resolveWireRoute<WireId extends string, EntityId extends string>(
  wire: StageWireSpec<WireId, EntityId>,
  boxes: Record<EntityId, StageBox>,
  mode: LayoutMode,
  state?: StageWireState,
): ResolvedWireRoute {
  const fromAnchor = (state?.fromOverride as PortAnchor<EntityId> | undefined) ?? wire.from
  const toAnchor = (state?.toOverride as PortAnchor<EntityId> | undefined) ?? wire.to
  const start = portPoint(boxes, fromAnchor)
  const end = portPoint(boxes, toAnchor)
  const via = mode === 'compact'
    ? (state?.compactViaOverride ?? wire.compactVia)
    : (state?.wideViaOverride ?? wire.wideVia)
  const points: Point2D[] = via && via.length > 0
    ? [start, ...via.map(([x, y]) => ({ x: round(x), y: round(y) })), end]
    : autoOrthogonalWaypoints(start, fromAnchor.port, end, toAnchor.port)
  return {
    points,
    path: roundedOrthogonalPath(points),
    midpoint: polylineMidpoint(points),
  }
}

export function planCameraViewBox<EntityId extends string>(options: {
  sceneSize: { readonly w: number; readonly h: number }
  boxes: Record<EntityId, StageBox>
  focus?: readonly EntityId[]
  fitOverride?: boolean
  minScale?: number
  pad?: number
}): { rect: ViewBoxRect; zoomed: boolean } {
  const { sceneSize, boxes, focus, fitOverride } = options
  const full: ViewBoxRect = { x: 0, y: 0, w: sceneSize.w, h: sceneSize.h }
  if (fitOverride || !focus || focus.length === 0) return { rect: full, zoomed: false }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of focus) {
    const box = boxes[id]
    if (!box) continue
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.w)
    maxY = Math.max(maxY, box.y + box.h)
  }
  if (!Number.isFinite(minX)) return { rect: full, zoomed: false }

  const pad = options.pad ?? 30
  const minScale = options.minScale ?? 0.72
  const aspect = sceneSize.w / sceneSize.h

  let targetW = Math.max(sceneSize.w * minScale, (maxX - minX) + pad * 2)
  let targetH = Math.max(sceneSize.h * minScale, (maxY - minY) + pad * 2)

  if (targetW / targetH > aspect) {
    targetH = targetW / aspect
  } else {
    targetW = targetH * aspect
  }

  if (targetW >= sceneSize.w * 0.95 || targetH >= sceneSize.h * 0.95) {
    return { rect: full, zoomed: false }
  }

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const x = Math.max(0, Math.min(sceneSize.w - targetW, cx - targetW / 2))
  const y = Math.max(0, Math.min(sceneSize.h - targetH, cy - targetH / 2))

  return {
    rect: {
      x: round(x),
      y: round(y),
      w: round(targetW),
      h: round(targetH),
    },
    zoomed: true,
  }
}

export function boxesOverlap(a: StageBox, b: StageBox, margin = 1): boolean {
  return (
    a.x + margin < b.x + b.w &&
    a.x + a.w - margin > b.x &&
    a.y + margin < b.y + b.h &&
    a.y + a.h - margin > b.y
  )
}

export function validateStageSpec<
  EntityId extends string,
  WireId extends string,
  TrayId extends string,
  VariantId extends string,
>(
  spec: SchematicStageSpec<EntityId, WireId, TrayId, VariantId>,
  stepCount: number,
  variants: readonly VariantId[],
): string[] {
  const issues: string[] = []
  for (const mode of ['wide', 'compact'] as const) {
    const isCompact = mode === 'compact'
    const size = isCompact ? spec.compactSize : spec.wideSize

    for (const variant of variants) {
      for (let step = 0; step < stepCount; step++) {
        const frame = spec.evaluate(step, 1, variant, isCompact)
        const overrides: Partial<Record<EntityId, { x: number; y: number }>> = {}
        for (const entity of spec.entities) {
          const ov = frame.entities[entity.id]?.overridePos
          const pos = isCompact ? ov?.compact : ov?.wide
          if (pos) overrides[entity.id] = pos
        }

        const worldBoxes = resolveEntityWorldBoxes(spec.entities, mode, overrides)
        const visibleEntities = spec.entities.filter(e => !frame.entities[e.id]?.hidden)

        for (const entity of visibleEntities) {
          const box = worldBoxes[entity.id]
          if (box.x < -1 || box.y < -1 || box.x + box.w > size.w + 1 || box.y + box.h > size.h + 1) {
            issues.push(`${spec.id} [${mode}/${variant}/step ${step}]: entity "${entity.id}" exceeds canvas bounds`)
          }
          if (entity.parent) {
            const pBox = worldBoxes[entity.parent]
            if (
              box.x < pBox.x ||
              box.y < pBox.y ||
              box.x + box.w > pBox.x + pBox.w + 1 ||
              box.y + box.h > pBox.y + pBox.h + 1
            ) {
              issues.push(`${spec.id} [${mode}/${variant}/step ${step}]: child "${entity.id}" overflows parent "${entity.parent}"`)
            }
          }
        }

        for (let i = 0; i < visibleEntities.length; i++) {
          for (let j = i + 1; j < visibleEntities.length; j++) {
            const a = visibleEntities[i]!
            const b = visibleEntities[j]!
            if ((a.parent ?? null) !== (b.parent ?? null)) continue
            if (boxesOverlap(worldBoxes[a.id], worldBoxes[b.id], 1)) {
              issues.push(`${spec.id} [${mode}/${variant}/step ${step}]: siblings "${a.id}" and "${b.id}" overlap`)
            }
          }
        }

        for (const wire of spec.wires) {
          const state = frame.wires[wire.id]
          const route = resolveWireRoute(wire, worldBoxes, mode, state)
          if (!route.path || route.points.length < 2) {
            issues.push(`${spec.id} [${mode}/${variant}/step ${step}]: wire "${wire.id}" failed to route`)
          }
        }
      }
    }
  }
  return issues
}
