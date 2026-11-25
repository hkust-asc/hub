export type StageTone = 'slate' | 'green' | 'amber' | 'blue' | 'coral'
export type StageTextTone = StageTone | 'muted'
export type HudSeverity = 'neutral' | 'good' | 'warn' | 'bad'
export type LayoutMode = 'wide' | 'compact'

export interface StageBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type PortSide = 'n' | 's' | 'e' | 'w' | 'center'

export interface PortAnchor<EntityId extends string = string> {
  readonly id: EntityId
  readonly port: PortSide
  readonly offset?: number
}

export type StageCardRow =
  | {
    readonly kind: 'code'
    readonly text: string
    readonly tone?: StageTextTone
  }
  | {
    readonly kind: 'kv'
    readonly key: string
    readonly value: string
    readonly tone?: StageTextTone
    readonly highlight?: boolean
  }
  | {
    readonly kind: 'pill'
    readonly label: string
    readonly meta?: string
    readonly tone?: StageTextTone
    readonly selected?: boolean
    readonly dashed?: boolean
  }
  | {
    readonly kind: 'meter'
    readonly value: number
    readonly label?: string
    readonly tone?: StageTone
  }

export interface StagePartInfo {
  readonly name: string
  readonly role: string
  readonly detail: string
}

export type StageEntityKind = 'plinth' | 'brick' | 'card' | 'tile' | 'port'

export interface StageEntitySpec<EntityId extends string = string> {
  readonly id: EntityId
  readonly kind: StageEntityKind
  readonly parent?: EntityId
  readonly kicker?: string
  readonly compactKicker?: string
  readonly title: string
  readonly compactTitle?: string
  readonly portNumber?: number
  readonly maxRows?: number
  readonly stripeSide?: 'left' | 'top'
  readonly bevel?: number
  readonly depth?: number
  readonly wide: StageBox
  readonly compact: StageBox
  readonly part?: StagePartInfo
}

export type StageWireKind = 'control' | 'data' | 'fault' | 'mount' | 'tree'

export interface StageWireSpec<WireId extends string = string, EntityId extends string = string> {
  readonly id: WireId
  readonly kind: StageWireKind
  readonly tone?: StageTone
  readonly from: PortAnchor<EntityId>
  readonly to: PortAnchor<EntityId>
  readonly wideVia?: readonly (readonly [number, number])[]
  readonly compactVia?: readonly (readonly [number, number])[]
  readonly baseTrack?: boolean
  readonly arrow?: boolean
  readonly part?: StagePartInfo
}

export interface StageTraySpec<TrayId extends string = string> {
  readonly id: TrayId
  readonly label: string
  readonly wide: { readonly x: number; readonly y: number; readonly w: number }
  readonly compact: { readonly x: number; readonly y: number; readonly w: number }
}

export interface StageEntityState {
  readonly hidden?: boolean
  readonly dimmed?: boolean
  readonly emphasis?: boolean
  readonly dashed?: boolean
  readonly opacity?: number
  readonly tone?: StageTone
  readonly kicker?: string
  readonly title?: string
  readonly subtitle?: string
  readonly badge?: string
  readonly led?: 'on' | 'active' | 'warn' | 'off'
  readonly operator?: string
  readonly meter?: { readonly value: number; readonly tone?: StageTone }
  readonly rows?: readonly StageCardRow[]
  readonly overridePos?: {
    readonly wide?: { readonly x: number; readonly y: number }
    readonly compact?: { readonly x: number; readonly y: number }
  }
}

export interface StageWireState {
  readonly visible: boolean
  readonly active?: boolean
  readonly dashed?: boolean
  readonly faultMark?: boolean
  readonly drawProgress?: number
  readonly tone?: StageTone
  readonly fromOverride?: PortAnchor<string>
  readonly toOverride?: PortAnchor<string>
  readonly wideViaOverride?: readonly (readonly [number, number])[]
  readonly compactViaOverride?: readonly (readonly [number, number])[]
}

export interface StagePacketState<WireId extends string = string> {
  readonly id: string
  readonly wire: WireId
  readonly badge: string
  readonly tone?: StageTone
  readonly progress: number
  readonly reverse?: boolean
}

export interface StagePinState<EntityId extends string = string> {
  readonly id: string
  readonly target: EntityId
  readonly label: string
  readonly tone?: StageTone
  readonly align?: 'top-right' | 'top-center' | 'bottom-center'
}

export interface StageStepDelta {
  readonly kind: 'add' | 'remove' | 'change'
  readonly text: string
}

export interface StageHudChip {
  readonly label: string
  readonly value: string
  readonly tone?: HudSeverity
}

export interface StageCodePanel {
  readonly label?: string
  readonly command?: string
  readonly lines?: readonly { readonly text: string; readonly tone?: StageTextTone }[]
}

export interface StageStepNarrative {
  readonly eyebrow?: string
  readonly title: string
  readonly body: string
  readonly panel?: StageCodePanel
  readonly changes: readonly StageStepDelta[]
  readonly hud: readonly StageHudChip[]
}

export interface SchematicStageFrame<
  EntityId extends string = string,
  WireId extends string = string,
  TrayId extends string = string,
> extends StageStepNarrative {
  readonly entities: Record<EntityId, StageEntityState>
  readonly wires: Record<WireId, StageWireState>
  readonly trays?: Partial<Record<TrayId, boolean>>
  readonly packets?: readonly StagePacketState<WireId>[]
  readonly pins?: readonly StagePinState<EntityId>[]
  readonly cameraFocus?: readonly EntityId[]
}

export interface SchematicStageSpec<
  EntityId extends string = string,
  WireId extends string = string,
  TrayId extends string = string,
  VariantId extends string = string,
> {
  readonly id: string
  readonly svgTitle: string
  readonly svgDesc: string
  readonly wideSize: { readonly w: number; readonly h: number }
  readonly compactSize: { readonly w: number; readonly h: number }
  readonly trays?: readonly StageTraySpec<TrayId>[]
  readonly entities: readonly StageEntitySpec<EntityId>[]
  readonly wires: readonly StageWireSpec<WireId, EntityId>[]
  readonly maxPackets?: readonly string[]
  readonly maxPins?: readonly string[]
  evaluate(
    stepIndex: number,
    beatProgress: number,
    variant: VariantId,
    compact: boolean,
  ): SchematicStageFrame<EntityId, WireId, TrayId>
  describeEntity?(id: EntityId, stepIndex: number, variant: VariantId): StagePartInfo
  describeWire?(id: WireId, stepIndex: number, variant: VariantId): StagePartInfo
}

export interface StageStepDef {
  readonly id: string
  readonly label: string
  readonly beatDurationMs?: number
  readonly dwellMs?: number
}

export interface StageVariantGroup<VariantId extends string = string> {
  readonly label: string
  readonly defaultId: VariantId
  readonly options: readonly { readonly id: VariantId; readonly label: string }[]
}

export interface StageSceneController<VariantId extends string = string> {
  readonly art: SVGSVGElement
  render(options: {
    stepIndex: number
    beatProgress: number
    variant: VariantId
    reducedMotion: boolean
    fitOverride: boolean
    dtMs: number
  }): {
    narrative: StageStepNarrative
    animatingLayout: boolean
    hasCameraZoom: boolean
  }
  resize(): void
  describePart(element: SVGGraphicsElement, stepIndex: number, variant: VariantId): StagePartInfo | null
  destroy?(): void
}

export interface StageScenarioOptions<VariantId extends string = string> {
  readonly id: string
  readonly title: string
  readonly subtitle: string
  readonly diagramLabel: string
  readonly steps: readonly StageStepDef[]
  readonly variants?: StageVariantGroup<VariantId>
  readonly footer: {
    readonly note: string
    readonly sourceLabel: string
    readonly sourceHref: string
  }
  mountScene(canvas: HTMLElement): StageSceneController<VariantId>
}

export interface StageScenarioHost {
  readonly container: HTMLElement
  readonly initialStep?: number
  readonly onProgress?: (stepIndex: number, stepCount: number, completed: boolean) => void
}

export interface MountedStageScenario {
  pause(): void
  goToStep(stepIndex: number): void
  destroy(): void
}
