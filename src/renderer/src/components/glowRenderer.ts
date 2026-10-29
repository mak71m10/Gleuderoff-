import L from 'leaflet'

/** Дополнительные опции стиля участка для отрисовки «как в Paradox» */
export interface GlowOptions extends L.PolylineOptions {
  /** Ширина внутреннего свечения у границы, в экранных пикселях (0 — без свечения) */
  glowWidth?: number
  glowColor?: string
  glowOpacity?: number
  /** Тёмная окантовка под основной линией границы */
  casingColor?: string
}

const GLOW_PASSES = 5

/**
 * Canvas-рендерер Leaflet с художественной отрисовкой стран:
 * полупрозрачная заливка -> мягкое свечение цвета страны внутри у границы -> тёмная окантовка -> тонкая линия.
 * Свечение рисуется несколькими проходами обводки разной ширины, обрезанными по самому многоугольнику.
 */
export const GlowRenderer = L.Canvas.extend({
  _fillStroke(ctx: CanvasRenderingContext2D, layer: L.Path) {
    const o = layer.options as GlowOptions
    const rule = (o.fillRule as CanvasFillRule) || 'evenodd'

    if (o.fill) {
      ctx.globalAlpha = o.fillOpacity ?? 0.2
      ctx.fillStyle = o.fillColor || o.color || '#888'
      ctx.fill(rule)
    }

    if (o.glowWidth && o.glowWidth > 0) {
      ctx.save()
      ctx.clip(rule)
      ctx.strokeStyle = o.glowColor || o.fillColor || '#fff'
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      for (let i = GLOW_PASSES; i >= 1; i--) {
        ctx.globalAlpha = ((o.glowOpacity ?? 0.5) / GLOW_PASSES) * 1.4
        ctx.lineWidth = (o.glowWidth * 2 * i) / GLOW_PASSES
        ctx.stroke()
      }
      ctx.restore()
    }

    if (o.stroke && o.weight !== 0) {
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      if (ctx.setLineDash) ctx.setLineDash((o as { _dashArray?: number[] })._dashArray || [])
      if (o.casingColor) {
        ctx.globalAlpha = (o.opacity ?? 1) * 0.55
        ctx.lineWidth = (o.weight ?? 1) + 2
        ctx.strokeStyle = o.casingColor
        ctx.stroke()
      }
      ctx.globalAlpha = o.opacity ?? 1
      ctx.lineWidth = o.weight ?? 1
      ctx.strokeStyle = o.color || '#000'
      ctx.stroke()
    }
  }
}) as unknown as new (opts?: L.RendererOptions) => L.Canvas
