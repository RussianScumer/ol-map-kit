import { describe, expect, it } from 'vitest'
import { parseNominatimResult, type NominatimRawResult } from '../nominatim'

describe('parseNominatimResult', () => {
  it('converts string coordinates to numbers', () => {
    const r = parseNominatimResult({ lat: '55.75', lon: '37.62' })
    expect(r.lat).toBe(55.75)
    expect(r.lng).toBe(37.62)
  })

  it('prefers lng over lon', () => {
    expect(parseNominatimResult({ lat: 1, lng: 30.3, lon: 99 }).lng).toBe(30.3)
  })

  it('falls back to lon when lng is falsy', () => {
    expect(parseNominatimResult({ lat: 1, lng: 0, lon: '37.62' }).lng).toBe(37.62)
  })

  it('gives NaN lng when neither lng nor lon is set', () => {
    expect(Number.isNaN(parseNominatimResult({ lat: 1 }).lng)).toBe(true)
  })

  it('copies only the 11 known address keys', () => {
    const raw = { address: { road: 'Main', city: 'X', postcode: '123' } } as NominatimRawResult
    const r = parseNominatimResult(raw)
    expect(r.address.road).toBe('Main')
    expect(r.address.city).toBe('X')
    expect('postcode' in r.address).toBe(false)
    expect(Object.keys(r.address)).toHaveLength(11)
  })

  it('tolerates a missing address', () => {
    const r = parseNominatimResult({ lat: 1, lng: 2 })
    expect(Object.values(r.address).every((v) => v === undefined)).toBe(true)
  })

  it('passes through plain fields', () => {
    const r = parseNominatimResult({ display_name: 'D', address_type: 'T', place_id: 5, osm_id: '7' })
    expect(r.display_name).toBe('D')
    expect(r.address_type).toBe('T')
    expect(r.place_id).toBe(5)
    expect(r.osm_id).toBe('7')
  })
})
