import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE, paletteColor } from '../styles'

describe('DEFAULT_PALETTE', () => {
  it('has 12 colors, first and last as in the original', () => {
    expect(DEFAULT_PALETTE).toHaveLength(12)
    expect(DEFAULT_PALETTE[0]).toBe('#e6194b')
    expect(DEFAULT_PALETTE[11]).toBe('#bcf60c')
  })
})

describe('paletteColor', () => {
  it('returns palette entries and wraps around', () => {
    expect(paletteColor(0)).toBe('#e6194b')
    expect(paletteColor(11)).toBe('#bcf60c')
    expect(paletteColor(12)).toBe('#e6194b')
    expect(paletteColor(13)).toBe('#3cb44b')
  })

  it('uses a custom palette', () => {
    expect(paletteColor(3, ['a', 'b'])).toBe('b')
  })

  it('throws RangeError for an empty palette', () => {
    expect(() => paletteColor(0, [])).toThrow(RangeError)
  })
})
