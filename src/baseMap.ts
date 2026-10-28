import { applyStyle } from 'ol-mapbox-style'
import OlMap from 'ol/Map'
import View from 'ol/View'
import VectorTileLayer from 'ol/layer/VectorTile'
import type BaseLayer from 'ol/layer/Base'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import { useGeographic } from 'ol/proj'
import type { LngLat } from './types'

export interface BaseMapOptions {
  /** Mapbox/MapLibre style JSON URL applied to the vector tile layer. Required. */
  styleUrl: string
  center: LngLat
  zoom: number
  /** Extra layers added above the tile layer, in order. */
  layers?: BaseLayer[]
}

export interface BaseMapHandle {
  map: OlMap
  tileLayer: VectorTileLayer
  /** The `applyStyle` promise; rejects when the style cannot be loaded. Callers must handle it. */
  ready: Promise<unknown>
  dispose: () => void
}

/**
 * Creates a map with a vector tile base layer. Enables geographic coordinates globally
 * (`useGeographic()`). `ready` is not caught: the caller must handle its rejection.
 * `dispose` only detaches the map from its target.
 */
export function createBaseMap(target: HTMLElement | string, options: BaseMapOptions): BaseMapHandle {
  const { styleUrl, center, zoom, layers } = options
  useGeographic()
  const tileLayer = new VectorTileLayer({
    updateWhileAnimating: true,
    updateWhileInteracting: true,
    renderMode: 'hybrid',
  })
  const map = new OlMap({
    target,
    layers: [tileLayer, ...(layers ?? [])],
    view: new View({ center: [...center], zoom }),
    interactions: defaultInteractions({ shiftDragZoom: false }),
  })
  const ready: Promise<unknown> = applyStyle(tileLayer, styleUrl)
  return {
    map,
    tileLayer,
    ready,
    dispose: () => {
      map.setTarget(undefined)
    },
  }
}
