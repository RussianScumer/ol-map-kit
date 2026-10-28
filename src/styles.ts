import { Fill, Icon, Stroke, Style, Text } from 'ol/style'

function pinSvg(fill: string, stroke: string, strokeWidth: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="36" height="48">
    <path d="M12 2C5.9 2 1 6.9 1 13c0 8.6 11 21 11 21s11-12.4 11-21C23 6.9 18.1 2 12 2z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    <circle cx="12" cy="13" r="5" fill="white" opacity="1" stroke="black"/>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

const iconCache = new Map<string, Icon>()

/** Pin icon with the given colors, cached per distinct option set. */
export function makePinIcon(
  fill: string,
  stroke = 'white',
  strokeWidth = 2,
  scale = 0.8,
  displacement: [number, number] = [0, 0],
): Icon {
  const key = `${fill}|${stroke}|${strokeWidth}|${scale}|${displacement[0]},${displacement[1]}`
  let icon = iconCache.get(key)
  if (!icon) {
    icon = new Icon({
      src: pinSvg(fill, stroke, strokeWidth),
      anchor: [0.5, 1],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
      scale,
      displacement,
      crossOrigin: 'anonymous',
    })
    iconCache.set(key, icon)
  }
  return icon
}

/** Icon from an image URL, anchored at the bottom center. */
export function markerIcon(src: string, scale = 0.5): Icon {
  return new Icon({
    src,
    anchor: [0.5, 1],
    anchorXUnits: 'fraction',
    anchorYUnits: 'fraction',
    scale,
    crossOrigin: 'anonymous',
  })
}

/** Plain colored pin. */
export function pinStyle(color: string): Style {
  return new Style({ image: makePinIcon(color) })
}

/** Colored pin with an optional label above it; `dx` shifts both horizontally. */
export function labeledPinStyle(
  color: string,
  label: string | number,
  { dx = 0, zIndex }: { dx?: number; zIndex?: number } = {},
): Style {
  const text =
    String(label) === ''
      ? undefined
      : new Text({
          text: String(label),
          offsetX: dx,
          offsetY: -32,
          fill: new Fill({ color: 'white' }),
          stroke: new Stroke({ color: 'black', width: 3 }),
          font: 'bold 14px Arial',
        })
  return new Style({ image: makePinIcon(color, 'white', 2, 0.8, [dx, 0]), text, zIndex })
}

/** Solid line. */
export function lineStyle(color: string, width: number): Style {
  return new Style({ stroke: new Stroke({ color, width }) })
}

/**
 * Dashed line: a draft suggestion, not a saved route. Callers shrink the width with the
 * route index so shared road segments show every color.
 */
export function dashedLineStyle(color: string, width: number, zIndex: number): Style {
  return new Style({ stroke: new Stroke({ color, width, lineDash: [4, 25] }), zIndex })
}

/** Style of the shift-drag selection box. */
export function selectionRectStyle(): Style {
  return new Style({
    fill: new Fill({ color: 'rgba(51, 136, 255, 0.15)' }),
    stroke: new Stroke({ color: 'blue', width: 0.9 }),
  })
}

/** Twelve distinct colors for telling routes apart. */
export const DEFAULT_PALETTE: readonly string[] = [
  '#e6194b',
  '#3cb44b',
  '#f58231',
  '#911eb4',
  '#008080',
  '#f032e6',
  '#9a6324',
  '#46f0f0',
  '#800000',
  '#808000',
  '#000075',
  '#bcf60c',
]

/** Palette color for index `i`, wrapping around; throws RangeError when there is none. */
export function paletteColor(i: number, palette: readonly string[] = DEFAULT_PALETTE): string {
  const color = palette[i % palette.length]
  if (color === undefined) throw new RangeError(`paletteColor: no color for index ${i}`)
  return color
}
