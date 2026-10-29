import { createMultiRouteLayer, createRouteLayer } from '../src/index'
import type VectorLayer from 'ol/layer/Vector'
import type VectorSource from 'ol/source/Vector'
import { byId, fitSource } from './dom'
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
      fitSource(map, source)
    })
  }
  wire(createRouteLayer(ROUTE_SAMPLE), 'rt-route', 'rt-route-fit')
  wire(createMultiRouteLayer(MULTI_ROUTE_SAMPLE), 'rt-multi', 'rt-multi-fit')
}
