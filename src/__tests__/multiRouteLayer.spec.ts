import { describe, expect, it } from 'vitest'
import { groupByPoint, layoutMultiRoute, mergeVisits, routeWidth, sideOffset } from '../multiRouteLayer'
import { DEFAULT_PALETTE } from '../styles'
import type { LngLat } from '../types'

const A: LngLat = [37.6, 55.7]
const B: LngLat = [30.3, 59.9]
const C: LngLat = [49.1, 55.8]

describe('mergeVisits', () => {
  it('returns an empty list for no stops', () => {
    expect(mergeVisits([])).toEqual([])
  })

  it('merges consecutive equal points only', () => {
    expect(mergeVisits([A, A, B, A])).toEqual([
      { key: '37.6,55.7', coord: A, count: 2 },
      { key: '30.3,59.9', coord: B, count: 1 },
      { key: '37.6,55.7', coord: A, count: 1 },
    ])
  })
})

describe('sideOffset', () => {
  it('alternates sides with growing distance', () => {
    expect([0, 1, 2, 3, 4].map(sideOffset)).toEqual([0, 16, -16, 32, -32])
    expect(sideOffset(0)).toBe(0)
  })
})

describe('routeWidth', () => {
  it('shrinks per route down to 3', () => {
    expect([0, 1, 2, 3, 10].map(routeWidth)).toEqual([8, 6, 4, 3, 3])
  })
})

describe('groupByPoint', () => {
  it('groups all equal points in first-seen order', () => {
    expect(groupByPoint([A, B, A])).toEqual([
      { coord: A, count: 2 },
      { coord: B, count: 1 },
    ])
  })
})

describe('layoutMultiRoute', () => {
  it('offsets stops only at shared points', () => {
    const layout = layoutMultiRoute({
      routes: [
        { geometry: [A, B], stops: [A, B] },
        { geometry: [A], stops: [A] },
        { geometry: [], stops: [A, C] },
      ],
      unassigned: [],
    })
    expect(layout.lines).toEqual([{ coords: [A, B], color: DEFAULT_PALETTE[0], width: 8, zIndex: 10 }])
    expect(layout.stops).toEqual([
      { coord: A, color: DEFAULT_PALETTE[0], label: '1', dx: 0 },
      { coord: B, color: DEFAULT_PALETTE[0], label: '2', dx: 0 },
      { coord: A, color: DEFAULT_PALETTE[1], label: '1', dx: 16 },
      { coord: A, color: DEFAULT_PALETTE[2], label: '1', dx: -16 },
      { coord: C, color: DEFAULT_PALETTE[2], label: '2', dx: 0 },
    ])
  })

  it('labels merged stops with a count', () => {
    const layout = layoutMultiRoute({ routes: [{ geometry: [], stops: [A, A, B] }], unassigned: [] })
    expect(layout.stops.map((s) => s.label)).toEqual(['1 ×2', '2'])
  })

  it('sets width and zIndex per route index', () => {
    const route = { geometry: [A, B], stops: [] }
    const layout = layoutMultiRoute({ routes: [route, route, route, route], unassigned: [] })
    expect(layout.lines.map((l) => l.width)).toEqual([8, 6, 4, 3])
    expect(layout.lines.map((l) => l.zIndex)).toEqual([10, 11, 12, 13])
  })

  it('uses a custom palette', () => {
    const layout = layoutMultiRoute(
      {
        routes: [
          { geometry: [], stops: [A] },
          { geometry: [], stops: [B] },
        ],
        unassigned: [],
      },
      ['x', 'y'],
    )
    expect(layout.stops.map((s) => s.color)).toEqual(['x', 'y'])
  })

  it('groups unassigned points', () => {
    const layout = layoutMultiRoute({ routes: [], unassigned: [A, B, A] })
    expect(layout.unassigned).toEqual([
      { coord: A, label: '×2' },
      { coord: B, label: '' },
    ])
  })
})
