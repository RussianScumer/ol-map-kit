import type OlMap from 'ol/Map.js'
import type VectorLayer from 'ol/layer/Vector.js'
import type VectorSource from 'ol/source/Vector.js'
import type { ClusterLayerHandle } from '../src/index'

/** Test hooks read by the Playwright specs in `e2e/`; the playground is never published. */
export interface PlaygroundHooks {
  map: OlMap
  cluster: () => ClusterLayerHandle
  routeLayer: VectorLayer<VectorSource>
  multiRouteLayer: VectorLayer<VectorSource>
  pickLayer: VectorLayer<VectorSource>
  previewLayer: VectorLayer<VectorSource>
}

declare global {
  interface Window {
    __playground?: PlaygroundHooks
  }
}

/** Merges into `window.__playground`; complete once every demo has registered its part. */
export function registerHooks(partial: Partial<PlaygroundHooks>): void {
  window.__playground = { ...window.__playground, ...partial } as PlaygroundHooks
}
