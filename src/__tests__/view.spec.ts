import { describe, expect, it, vi } from 'vitest'
import type OlMap from 'ol/Map.js'
import type { Extent } from 'ol/extent.js'
import { fitToSource } from '../view'

const options = { padding: [50, 50, 50, 50], maxZoom: 7 }

function setup(extent: Extent | null) {
  const fit = vi.fn()
  const map = { getView: () => ({ fit }) } as unknown as OlMap
  fitToSource(map, { getExtent: () => extent }, options)
  return fit
}

describe('fitToSource', () => {
  it('fits a valid extent with padding and maxZoom', () => {
    const fit = setup([30, 50, 40, 60])
    expect(fit).toHaveBeenCalledTimes(1)
    expect(fit).toHaveBeenCalledWith([30, 50, 40, 60], { padding: [50, 50, 50, 50], maxZoom: 7 })
  })

  it('skips an empty extent', () => {
    expect(setup([Infinity, Infinity, -Infinity, -Infinity])).not.toHaveBeenCalled()
  })

  it('skips a null extent', () => {
    expect(setup(null)).not.toHaveBeenCalled()
  })

  it('skips NaN extents', () => {
    expect(setup([NaN, NaN, NaN, NaN])).not.toHaveBeenCalled()
    expect(setup([30, NaN, 40, 60])).not.toHaveBeenCalled()
  })
})
