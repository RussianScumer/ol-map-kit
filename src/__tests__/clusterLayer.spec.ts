import Feature from 'ol/Feature'
import { describe, expect, it, vi } from 'vitest'
import { clusterAppearance, defaultResolveFill } from '../clusterLayer'

describe('defaultResolveFill', () => {
  it('returns the first truthy member color', () => {
    const members = [
      new Feature({ color: '' }),
      new Feature({}),
      new Feature({ color: '#abc' }),
      new Feature({ color: '#def' }),
    ]
    expect(defaultResolveFill(members)).toBe('#abc')
  })

  it('returns red when no member has a color', () => {
    expect(defaultResolveFill([new Feature({ id: 1 })])).toBe('red')
    expect(defaultResolveFill([])).toBe('red')
  })
})

describe('clusterAppearance', () => {
  it('is null for an empty cluster', () => {
    expect(clusterAppearance([])).toBeNull()
  })

  it('builds the fill|selected|count key', () => {
    const members = [
      new Feature({ id: 1, color: '#abc', selected: true }),
      new Feature({ id: 2, color: '#abc' }),
    ]
    expect(clusterAppearance(members)).toEqual({
      fill: '#abc',
      selected: true,
      count: 2,
      key: '#abc|true|2',
    })
  })

  it('is not selected when no member is', () => {
    const members = [new Feature({ id: 1, color: '#123456' }), new Feature({ id: 2 })]
    const a = clusterAppearance(members)
    expect(a?.selected).toBe(false)
    expect(a?.key.endsWith('|false|2')).toBe(true)
  })

  it('uses a custom resolveFill once, with the members', () => {
    const members = [new Feature({ id: 1 }), new Feature({ id: 2 })]
    const resolveFill = vi.fn(() => '#ffc656')
    const a = clusterAppearance(members, resolveFill)
    expect(resolveFill).toHaveBeenCalledTimes(1)
    expect(resolveFill).toHaveBeenCalledWith(members)
    expect(a?.fill).toBe('#ffc656')
    expect(a?.key.startsWith('#ffc656|')).toBe(true)
  })

  it('changes the key when a member selection changes', () => {
    const f = new Feature({ id: 1, color: '#abc' })
    const before = clusterAppearance([f])?.key
    f.set('selected', true)
    const after = clusterAppearance([f])?.key
    expect(before).toBe('#abc|false|1')
    expect(after).toBe('#abc|true|1')
  })
})
