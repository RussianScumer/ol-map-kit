import type OlMap from 'ol/Map'

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

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
