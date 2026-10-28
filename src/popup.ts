import Overlay from 'ol/Overlay'
import type OlMap from 'ol/Map'
import type { FeatureLike } from 'ol/Feature'
import type { Pixel } from 'ol/pixel'
import type BaseLayer from 'ol/layer/Base'
import type { LngLat } from './types'

export type PopupHandle = {
  overlay: Overlay
  show: (html: string, coord: LngLat) => void
  hide: () => void
}

/** Create a popup overlay (element class `ol-popup`) and add it to the map. */
export function createPopup(map: OlMap): PopupHandle {
  const element = document.createElement('div')
  element.className = 'ol-popup'
  const overlay = new Overlay({
    element,
    autoPan: { animation: { duration: 250 } },
    positioning: 'bottom-center',
    offset: [0, -10],
  })
  map.addOverlay(overlay)
  return {
    overlay,
    show: (html, coord) => {
      element.innerHTML = html
      overlay.setPosition(coord)
    },
    hide: () => {
      overlay.setPosition(undefined)
    },
  }
}

/** First feature of `layer` under the pixel, if any. */
export function featureAtPixel(map: OlMap, pixel: Pixel, layer: BaseLayer): FeatureLike | undefined {
  return map.forEachFeatureAtPixel(pixel, (f) => f, { layerFilter: (l) => l === layer })
}
