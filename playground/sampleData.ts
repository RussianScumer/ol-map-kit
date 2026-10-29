import { DEFAULT_PALETTE, paletteColor } from '../src/index'
import type { LngLat, MultiRouteInput, RouteLayerInput } from '../src/index'
import type Feature from 'ol/Feature.js'

export interface SamplePoint {
  id: number
  coord: LngLat
  color?: string
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seeded random points around Moscow; every 10th point repeats the previous coordinate. */
export function generatePoints(count: number, seed: number, perPointColors: boolean): SamplePoint[] {
  const rand = mulberry32(seed)
  const points: SamplePoint[] = []
  for (let id = 1; id <= count; id++) {
    const prev = points[id - 2]
    const coord: LngLat =
      id % 10 === 0 && prev ? [...prev.coord] : [37.35 + rand() * 0.55, 55.55 + rand() * 0.4]
    points.push(perPointColors ? { id, coord, color: paletteColor(id - 1) } : { id, coord })
  }
  return points
}

const [c0 = 'red', c1 = 'red', c2 = 'red'] = DEFAULT_PALETTE

export const ROUTE_SAMPLE: RouteLayerInput = {
  start: [37.62, 55.75],
  line: [
    [37.62, 55.75],
    [37.66, 55.77],
    [37.7, 55.76],
    [37.74, 55.79],
  ],
  points: [
    { coord: [37.66, 55.77], color: c0 },
    { coord: [37.7, 55.76], color: c1 },
    { coord: [37.74, 55.79], color: c2 },
  ],
}

const S: LngLat = [37.55, 55.7]

export const MULTI_ROUTE_SAMPLE: MultiRouteInput = {
  routes: [
    {
      geometry: [[37.45, 55.65], [37.5, 55.68], S, [37.6, 55.72]],
      stops: [[37.5, 55.68], S, S, [37.6, 55.72]],
    },
    {
      geometry: [[37.45, 55.75], S, [37.58, 55.66]],
      stops: [S, [37.58, 55.66]],
    },
    {
      geometry: [[37.65, 55.7], S, [37.5, 55.62]],
      stops: [[37.65, 55.7], S, [37.5, 55.62]],
    },
  ],
  unassigned: [
    [37.4, 55.7],
    [37.4, 55.7],
    [37.42, 55.6],
  ],
}

/** Custom `resolveFill`: the most frequent member color, ties to the first seen, else grey. */
export function majorityResolveFill(features: Feature[]): string {
  const counts = new Map<string, number>()
  for (const f of features) {
    const color: unknown = f.get('color')
    if (typeof color === 'string') counts.set(color, (counts.get(color) ?? 0) + 1)
  }
  let best = '#555555'
  let bestCount = 0
  for (const [color, n] of counts) {
    if (n > bestCount) {
      best = color
      bestCount = n
    }
  }
  return best
}
