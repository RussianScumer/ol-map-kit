import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { lineStyle, pinStyle } from './styles'
import type { LngLat } from './types'

/** A colored pin at a route point. */
export interface RoutePoint {
  coord: LngLat
  color: string
}

/** Input of a single route: start, optional line and the point pins. */
export interface RouteLayerInput {
  start: LngLat
  line?: readonly LngLat[]
  points: readonly RoutePoint[]
}

/** Appearance options of a single route layer. */
export interface RouteLayerOptions {
  startColor?: string
  lineColor?: string
  lineWidth?: number
  zIndex?: number
}

/**
 * Single route: start pin, optional solid line, colored point pins.
 * The layer is not added to any map.
 */
export function createRouteLayer(
  { start, line, points }: RouteLayerInput,
  { startColor = 'green', lineColor = 'blue', lineWidth = 4, zIndex = 500 }: RouteLayerOptions = {},
): VectorLayer<VectorSource> {
  const source = new VectorSource()

  const startFeature = new Feature(new Point([...start]))
  startFeature.setStyle(pinStyle(startColor))
  source.addFeature(startFeature)

  if (line !== undefined && line.length > 1) {
    const lineFeature = new Feature(new LineString(line.map((c) => [...c])))
    lineFeature.setStyle(lineStyle(lineColor, lineWidth))
    source.addFeature(lineFeature)
  }

  for (const { coord, color } of points) {
    const feature = new Feature(new Point([...coord]))
    feature.setStyle(pinStyle(color))
    source.addFeature(feature)
  }

  return new VectorLayer({ source, zIndex })
}
