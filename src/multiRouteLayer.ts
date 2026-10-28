import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { DEFAULT_PALETTE, dashedLineStyle, labeledPinStyle, paletteColor } from './styles'
import type { LngLat } from './types'

/** One draft route: its line and its ordered stops. */
export interface MultiRoute {
  geometry: readonly LngLat[]
  stops: readonly LngLat[]
}

/** Input of the multi-route preview. */
export interface MultiRouteInput {
  routes: readonly MultiRoute[]
  unassigned: readonly LngLat[]
}

/** Appearance options of the multi-route layer. */
export interface MultiRouteLayerOptions {
  /** Route colors by route index; must not be empty. */
  palette?: readonly string[]
  unassignedColor?: string
  zIndex?: number
}

/** A stop visit: consecutive stops at one point merged. */
export interface Visit {
  key: string
  coord: LngLat
  count: number
}

/** Consecutive stops at the same point are one visit (several loads at one address). */
export function mergeVisits(stops: readonly LngLat[]): Visit[] {
  const visits: Visit[] = []
  for (const [lng, lat] of stops) {
    const key = `${lng},${lat}`
    const last = visits.at(-1)
    if (last?.key === key) {
      last.count += 1
    } else {
      visits.push({ key, coord: [lng, lat], count: 1 })
    }
  }
  return visits
}

/** Pixel offset of route `i` at a point shared by several routes: 0, +16, -16, +32, -32, ... */
export function sideOffset(i: number): number {
  if (i === 0) return 0
  return (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 16
}

/** Each next route is thinner and drawn higher, so shared road segments show every color. */
export function routeWidth(i: number): number {
  return Math.max(8 - i * 2, 3)
}

/** Groups all equal points (not only consecutive ones), in first-seen order. */
export function groupByPoint(coords: readonly LngLat[]): { coord: LngLat; count: number }[] {
  const groups = new Map<string, { coord: LngLat; count: number }>()
  for (const [lng, lat] of coords) {
    const key = `${lng},${lat}`
    const group = groups.get(key)
    if (group) {
      group.count += 1
    } else {
      groups.set(key, { coord: [lng, lat], count: 1 })
    }
  }
  return [...groups.values()]
}

/** Everything the multi-route layer draws, computed without any `ol` object. */
export interface MultiRouteLayout {
  lines: { coords: LngLat[]; color: string; width: number; zIndex: number }[]
  stops: { coord: LngLat; color: string; label: string; dx: number }[]
  unassigned: { coord: LngLat; label: string }[]
}

/** Pure layout: coordinates, colors, labels, side offsets, widths and z-indexes. */
export function layoutMultiRoute(
  input: MultiRouteInput,
  palette: readonly string[] = DEFAULT_PALETTE,
): MultiRouteLayout {
  const routeVisits = input.routes.map((r) => mergeVisits(r.stops))

  // How many visits each point has over all routes; only shared points get a side offset.
  const pointUsage = new Map<string, number>()
  for (const visits of routeVisits) {
    for (const visit of visits) {
      pointUsage.set(visit.key, (pointUsage.get(visit.key) ?? 0) + 1)
    }
  }

  const lines: MultiRouteLayout['lines'] = []
  const stops: MultiRouteLayout['stops'] = []
  input.routes.forEach((route, i) => {
    const color = paletteColor(i, palette)
    if (route.geometry.length > 1) {
      lines.push({
        coords: route.geometry.map(([lng, lat]): LngLat => [lng, lat]),
        color,
        width: routeWidth(i),
        zIndex: 10 + i,
      })
    }
    ;(routeVisits[i] ?? []).forEach((visit, n) => {
      const dx = (pointUsage.get(visit.key) ?? 0) > 1 ? sideOffset(i) : 0
      const label = visit.count > 1 ? `${n + 1} ×${visit.count}` : String(n + 1)
      stops.push({ coord: visit.coord, color, label, dx })
    })
  })

  // Unassigned points are grouped so they do not stack.
  const unassigned = groupByPoint(input.unassigned).map(({ coord, count }) => ({
    coord,
    label: count > 1 ? `×${count}` : '',
  }))

  return { lines, stops, unassigned }
}

/**
 * Preview of several draft routes: per route its own palette color, a dashed line and numbered
 * stops; unassigned points as grey pins. Not tied to any saved route.
 */
export function createMultiRouteLayer(
  input: MultiRouteInput,
  { palette = DEFAULT_PALETTE, unassignedColor = '#7d7d7d', zIndex = 600 }: MultiRouteLayerOptions = {},
): VectorLayer<VectorSource> {
  const layout = layoutMultiRoute(input, palette)
  const source = new VectorSource()

  for (const { coords, color, width, zIndex: lineZ } of layout.lines) {
    const feature = new Feature(new LineString(coords))
    feature.setStyle(dashedLineStyle(color, width, lineZ))
    source.addFeature(feature)
  }
  for (const { coord, color, label, dx } of layout.stops) {
    const feature = new Feature(new Point(coord))
    feature.setStyle(labeledPinStyle(color, label, { dx, zIndex: 100 }))
    source.addFeature(feature)
  }
  for (const { coord, label } of layout.unassigned) {
    const feature = new Feature(new Point(coord))
    feature.setStyle(labeledPinStyle(unassignedColor, label, { zIndex: 90 }))
    source.addFeature(feature)
  }

  return new VectorLayer({ source, zIndex })
}
