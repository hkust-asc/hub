const widthCache = new Map<string, number>()
let measureCtx: CanvasRenderingContext2D | null | undefined

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx
  if (typeof document === 'undefined') {
    measureCtx = null
    return null
  }
  const canvas = document.createElement('canvas')
  measureCtx = canvas.getContext('2d')
  return measureCtx
}

function fallbackTextWidth(text: string, sizePx: number, mono: boolean): number {
  if (mono) return text.length * sizePx * 0.61
  let units = 0
  for (const ch of text) {
    if ('ilI1.,:;!|\'` '.includes(ch)) units += 0.34
    else if ('MW@#%&QGO'.includes(ch)) units += 0.78
    else if (ch >= 'A' && ch <= 'Z') units += 0.66
    else units += 0.56
  }
  return units * sizePx
}

export function measureTextWidth(
  text: string,
  options: { sizePx: number; weight?: number; mono?: boolean } = { sizePx: 11, mono: true },
): number {
  if (!text) return 0
  const weight = options.weight ?? 500
  const mono = options.mono ?? true
  const family = mono ? '"IBM Plex Mono", monospace' : '"IBM Plex Sans", sans-serif'
  const key = `${weight}:${options.sizePx}:${mono ? 'm' : 's'}:${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached

  const ctx = getCanvasContext()
  let measured: number
  if (ctx) {
    ctx.font = `${weight} ${options.sizePx}px ${family}`
    measured = ctx.measureText(text).width
    if (!Number.isFinite(measured) || measured <= 0) {
      measured = fallbackTextWidth(text, options.sizePx, mono)
    }
  } else {
    measured = fallbackTextWidth(text, options.sizePx, mono)
  }

  const rounded = Math.ceil(measured * 10) / 10
  widthCache.set(key, rounded)
  return rounded
}

export function measurePillWidth(
  text: string,
  options: { sizePx?: number; weight?: number; mono?: boolean; padX?: number; minWidth?: number } = {},
): number {
  const sizePx = options.sizePx ?? 10
  const padX = options.padX ?? 14
  const minWidth = options.minWidth ?? 38
  const textW = measureTextWidth(text, {
    sizePx,
    weight: options.weight ?? 600,
    mono: options.mono ?? true,
  })
  return Math.max(minWidth, Math.ceil(textW + padX))
}
