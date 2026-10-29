import VectorLayer from 'ol/layer/Vector.js'
import type VectorSource from 'ol/source/Vector.js'
import { createPickMarkerLayer, parseNominatimResult } from '../src/index'
import type { NominatimRawResult } from '../src/index'
import { byId, errorMessage, setStatus } from './dom'
import { registerHooks } from './hooks'
import type { DemoContext } from './dom'

const MIN_INTERVAL_MS = 1100

export function setupPickDemo({ map, getMode }: DemoContext): void {
  const marker = createPickMarkerLayer(map, '#911eb4')
  // `PickMarkerHandle` does not expose its layer; `createPickMarkerLayer` has just appended it.
  const layers = map.getLayers()
  const pickLayer = layers.item(layers.getLength() - 1)
  if (!(pickLayer instanceof VectorLayer)) throw new Error('playground: pick marker layer not found')
  registerHooks({ pickLayer: pickLayer as VectorLayer<VectorSource> })
  const coordEl = byId('pk-coord', HTMLSpanElement)
  const parsedEl = byId('pk-parsed', HTMLPreElement)
  const rawEl = byId('pk-raw', HTMLPreElement)
  const geocodeBtn = byId('pk-geocode', HTMLButtonElement)

  let picked: { lat: number; lng: number } | null = null
  let inFlight = false
  let lastStart = 0

  map.on('click', (e) => {
    if (getMode() !== 'pick') return
    const [lng, lat] = e.coordinate
    if (lng === undefined || lat === undefined) return
    marker.place(lat, lng)
    picked = { lat, lng }
    coordEl.textContent = `${lng.toFixed(5)}, ${lat.toFixed(5)}`
    geocodeBtn.disabled = inFlight
  })

  byId('pk-clear', HTMLButtonElement).addEventListener('click', () => {
    marker.clear()
    picked = null
    coordEl.textContent = 'none'
    geocodeBtn.disabled = true
  })

  async function reverseGeocode(): Promise<void> {
    if (!picked) return
    if (inFlight || Date.now() - lastStart < MIN_INTERVAL_MS) {
      setStatus('Nominatim: wait a moment between requests')
      return
    }
    const { lat, lng } = picked
    inFlight = true
    lastStart = Date.now()
    geocodeBtn.disabled = true
    try {
      setStatus('Nominatim: requesting…')
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`,
        { headers: { Accept: 'application/json' } },
      )
      if (!res.ok) {
        setStatus(`Nominatim: HTTP ${res.status}`, true)
        return
      }
      const data: unknown = await res.json()
      if (typeof data === 'object' && data !== null && 'error' in data) {
        setStatus(`Nominatim: ${String(data.error)}`, true)
        return
      }
      const result = parseNominatimResult(data as NominatimRawResult)
      parsedEl.textContent = JSON.stringify(result, null, 2)
      rawEl.textContent = JSON.stringify(data, null, 2)
      setStatus('Nominatim: done')
    } catch (err) {
      console.warn('Nominatim request failed', err)
      setStatus(`Nominatim failed: ${errorMessage(err)}`, true)
    } finally {
      inFlight = false
      geocodeBtn.disabled = picked === null
    }
  }

  geocodeBtn.addEventListener('click', () => {
    void reverseGeocode()
  })
}
