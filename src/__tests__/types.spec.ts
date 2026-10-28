import { describe, expect, expectTypeOf, it } from 'vitest'

import type { FeatureId, LngLat } from '../index'

describe('public types', () => {
  it('LngLat is a [longitude, latitude] pair', () => {
    const point: LngLat = [37.62, 55.75]
    expect(point).toHaveLength(2)
    expectTypeOf<LngLat>().toEqualTypeOf<[number, number]>()
  })

  it('FeatureId accepts strings and numbers', () => {
    expectTypeOf<FeatureId>().toEqualTypeOf<string | number>()
  })
})
