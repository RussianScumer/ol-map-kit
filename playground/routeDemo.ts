import { createMultiRouteLayer, createRouteLayer, fitToSource } from '../src/index'
import type VectorLayer from 'ol/layer/Vector.js'
import type VectorSource from 'ol/source/Vector.js'
import { registerHooks } from './hooks'
import { byId } from './dom'
import type { DemoContext } from './dom'
import { MULTI_ROUTE_SAMPLE, ROUTE_SAMPLE } from './sampleData'

export function setupRouteDemo({ map }: DemoContext): void {
  const wire = (layer: VectorLayer<VectorSource>, toggleId: string, fitId: string): void => {
    map.addLayer(layer)
    const toggle = byId(toggleId, HTMLInputElement)
    toggle.addEventListener('change', () => {
      layer.setVisible(toggle.checked)
    })
    byId(fitId, HTMLButtonElement).addEventListener('click', () => {
      const source = layer.getSource()
      if (source === null) return
      fitToSource(map, source, { padding: [40, 40, 40, 40], maxZoom: 15 })
    })
  }
  const routeLayer = createRouteLayer(ROUTE_SAMPLE)
  const multiRouteLayer = createMultiRouteLayer(MULTI_ROUTE_SAMPLE)
  wire(routeLayer, 'rt-route', 'rt-route-fit')
  wire(multiRouteLayer, 'rt-multi', 'rt-multi-fit')
  registerHooks({ routeLayer, multiRouteLayer })
}
