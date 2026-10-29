import Feature from 'ol/Feature.js'
import type OlMap from 'ol/Map.js'
import Point from 'ol/geom/Point.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import { Style } from 'ol/style.js'
import { makePinIcon } from './styles'

export interface PickMarkerHandle {
  place: (lat: number, lng: number) => void
  clear: () => void
}

/**
 * Adds a single-pin layer to the map. Note the argument order of `place` is `(lat, lng)`
 * while map coordinates are `[lng, lat]`. Falsy `lat` or `lng` is ignored.
 */
export function createPickMarkerLayer(map: OlMap, color: string): PickMarkerHandle {
  const source = new VectorSource()
  const layer = new VectorLayer({
    source,
    style: new Style({ image: makePinIcon(color, '#2c2c2c', 1) }),
  })
  map.addLayer(layer)
  return {
    place(lat, lng) {
      if (!lat || !lng) return
      source.clear()
      source.addFeature(new Feature({ geometry: new Point([lng, lat]) }))
      map.getView().animate({ center: [lng, lat], duration: 300 })
    },
    clear() {
      source.clear()
    },
  }
}
