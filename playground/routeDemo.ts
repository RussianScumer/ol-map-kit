import { createMultiRouteLayer, createRouteLayer, fitToSource } from '../src/index'
import type VectorLayer from 'ol/layer/Vector.js'
import type VectorSource from 'ol/source/Vector.js'
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
  wire(createRouteLayer(ROUTE_SAMPLE), 'rt-route', 'rt-route-fit')
  wire(createMultiRouteLayer(MULTI_ROUTE_SAMPLE), 'rt-multi', 'rt-multi-fit')
}
