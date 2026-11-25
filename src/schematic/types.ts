export type SchematicTone = 'neutral' | 'mint' | 'amber' | 'blue' | 'coral'
export type SchematicTextTone = SchematicTone | 'muted'

export type SchematicRow =
  | {
    kind: 'code'
    text: string
    tone?: SchematicTextTone
  }
  | {
    kind: 'kv'
    key: string
    value: string
    tone?: SchematicTextTone
    highlight?: boolean
  }
  | {
    kind: 'pill'
    label: string
    meta?: string
    tone?: SchematicTextTone
    selected?: boolean
    dashed?: boolean
  }

export interface SchematicNodeSpec<PartId extends string = string> {
  id: PartId
  part: {
    name: string
    role: string
    detail: string
  }
  kicker: string
  compactKicker?: string
  title: string
  compactTitle?: string
  wide: { width: number; height: number }
  compact: { width: number; height: number }
  maxRows: number
}

export interface SchematicWireSpec<WireId extends string = string, PartId extends string = string> {
  id: WireId
  from: PartId
  to: PartId
  tone: SchematicTone
}

export interface WireTransferSpec<WireId extends string = string> {
  id: string
  wire: WireId
  badge: string
  tone?: SchematicTone
  startMs: number
  endMs: number
  ease?: string
}

export interface WireRevealSpec<WireId extends string = string> {
  wire: WireId
  startMs: number
  durationMs?: number
  ease?: string
}

export interface NodePulseSpec<PartId extends string = string> {
  node: PartId
  startMs: number
  durationMs?: number
}

export interface SchematicMotionSpec<WireId extends string = string, PartId extends string = string> {
  durationMs: number
  transfers?: readonly WireTransferSpec<WireId>[]
  wireReveals?: readonly WireRevealSpec<WireId>[]
  pulses?: readonly NodePulseSpec<PartId>[]
}

export interface SchematicNodeState {
  hidden?: boolean
  dimmed?: boolean
  emphasis?: boolean
  tone?: SchematicTone
  badge?: string
  title?: string
  kicker?: string
  rows: readonly SchematicRow[]
}

export interface SchematicWireState {
  visible: boolean
  active?: boolean
  dashed?: boolean
  tone?: SchematicTone
}

export interface SchematicFrame<PartId extends string = string, WireId extends string = string> {
  nodes: Record<PartId, SchematicNodeState>
  wires: Record<WireId, SchematicWireState>
  note: {
    anchor: PartId
    title: string
    text: string
    command?: string
  }
}

export interface SchematicSceneSpec<PartId extends string = string, WireId extends string = string> {
  id: string
  svgTitle: string
  svgDesc: string
  nodes: readonly SchematicNodeSpec<PartId>[]
  wires: readonly SchematicWireSpec<WireId, PartId>[]
  motion: SchematicMotionSpec<WireId, PartId>
  frameAt(elapsedMs: number, compact: boolean): SchematicFrame<PartId, WireId>
  describePart?(id: PartId, elapsedMs: number): { name: string; role: string; detail: string }
}
