import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Style } from 'ol/style'
import {
  dashedLineStyle,
  labeledPinStyle,
  lineStyle,
  makePinIcon,
  markerIcon,
  paletteColor,
  pinStyle,
} from '../src/index'
import { byId } from './dom'
import type { DemoContext } from './dom'

export function setupPreviewDemo({ map }: DemoContext): void {
  const list = byId('pv-palette', HTMLDivElement)
  // Indices 12 and 13 show the wrap-around of the 12-color palette.
  for (let i = 0; i <= 13; i++) {
    const color = paletteColor(i)
    const row = document.createElement('div')
    row.className = 'pv-row'
    const img = document.createElement('img')
    img.src = makePinIcon(color).getSrc() ?? ''
    const text = document.createElement('span')
    text.textContent = `${i}: ${color}`
    row.append(img, text)
    list.append(row)
  }

  const styled = (geometry: Point | LineString, style: Style): Feature => {
    const f = new Feature(geometry)
    f.setStyle(style)
    return f
  }
  const source = new VectorSource({
    features: [
      styled(new Point([37.56, 55.8]), pinStyle('#e6194b')),
      styled(new Point([37.59, 55.8]), labeledPinStyle('#3cb44b', 7)),
      styled(new Point([37.62, 55.8]), labeledPinStyle('#f58231', '3 ×2', { dx: 16 })),
      styled(new Point([37.65, 55.8]), new Style({ image: markerIcon(makePinIcon('#000075').getSrc() ?? '', 1) })),
      styled(
        new LineString([
          [37.56, 55.82],
          [37.6, 55.83],
        ]),
        lineStyle('#008080', 4),
      ),
      styled(
        new LineString([
          [37.62, 55.82],
          [37.66, 55.83],
        ]),
        dashedLineStyle('#911eb4', 6, 10),
      ),
    ],
  })
  const layer = new VectorLayer({ source, visible: false, zIndex: 700 })
  map.addLayer(layer)
  const toggle = byId('pv-layer', HTMLInputElement)
  toggle.addEventListener('change', () => {
    layer.setVisible(toggle.checked)
  })
}
