import type OlMap from 'ol/Map'
import type VectorSource from 'ol/source/Vector'
import { createEmpty } from 'ol/extent'
import { fitToSource } from '../src/index'

export type ClickMode = 'cluster' | 'pick'

export interface DemoContext {
  map: OlMap
  getMode: () => ClickMode
}

/** Typed element lookup; throws when the element is absent or of another type. */
export function byId<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const el = document.getElementById(id)
  if (!(el instanceof ctor)) throw new Error(`playground: #${id} missing or not a ${ctor.name}`)
  return el
}

export function setStatus(text: string, isError = false): void {
  const el = byId('status', HTMLDivElement)
  el.textContent = text
  el.classList.toggle('error', isError)
}

/**
 * `fitToSource` types `getExtent` as returning `Extent`, but `VectorSource#getExtent` may return
 * `null`; an empty extent is passed instead, which `fitToSource` skips.
 */
export function fitSource(map: OlMap, source: VectorSource): void {
  fitToSource(map, { getExtent: () => source.getExtent() ?? createEmpty() }, { padding: [40, 40, 40, 40], maxZoom: 15 })
}
