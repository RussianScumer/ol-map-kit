import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import type MapBrowserEvent from 'ol/MapBrowserEvent.js'
import {
  createClusterLayer,
  DEFAULT_PALETTE,
  createPopup,
  featureAtPixel,
  fitToSource,
  paletteColor,
  setupSelectionRect,
} from '../src/index'
import type { ClusterLayerHandle, LngLat, SelectionChange, SelectionRectHandle } from '../src/index'
import { byId, setStatus } from './dom'
import type { DemoContext } from './dom'
import { registerHooks } from './hooks'
import { generatePoints, majorityResolveFill } from './sampleData'

const SELECTED_LIST_LIMIT = 100

export function setupClusterDemo({ map, getMode }: DemoContext): void {
  const countEl = byId('cl-count', HTMLInputElement)
  const seedEl = byId('cl-seed', HTMLInputElement)
  const colorsEl = byId('cl-colors', HTMLInputElement)
  const distanceEl = byId('cl-distance', HTMLInputElement)
  const distanceValueEl = byId('cl-distance-value', HTMLSpanElement)
  const customFillEl = byId('cl-custom-fill', HTMLInputElement)
  const selectedEl = byId('cl-selected', HTMLPreElement)
  const lastChangeEl = byId('cl-last-change', HTMLPreElement)
  const popup = createPopup(map)

  let handle: ClusterLayerHandle
  let selectionRect: SelectionRectHandle

  function renderSelected(): void {
    const ids: number[] = []
    for (const f of handle.source.getFeatures()) {
      const id: unknown = f.get('id')
      if (f.get('selected') === true && typeof id === 'number') ids.push(id)
    }
    ids.sort((a, b) => a - b)
    const shown = ids.slice(0, SELECTED_LIST_LIMIT).join(', ')
    selectedEl.textContent = `${ids.length} selected\n${shown}${ids.length > SELECTED_LIST_LIMIT ? ' …' : ''}`
  }

  function onSelection(affected: SelectionChange[]): void {
    lastChangeEl.textContent = affected.map((a) => `${a.id}: ${a.selected}`).join('\n')
    renderSelected()
  }

  function build(): void {
    handle = createClusterLayer({
      // `defaultResolveFill` is not exported from the package entry, so omitting `resolveFill` selects it.
      ...(customFillEl.checked ? { resolveFill: majorityResolveFill } : {}),
      distance: Number(distanceEl.value),
    })
    map.addLayer(handle.layer)
    selectionRect = setupSelectionRect(map, handle.source, onSelection, handle.refreshStyles)
  }

  function load(): void {
    handle.source.clear()
    const points = generatePoints(Math.min(5000, Math.max(1, Math.trunc(Number(countEl.value)) || 1)), Number(seedEl.value), colorsEl.checked)
    handle.source.addFeatures(
      points.map(({ id, coord, color }) => {
        const f = new Feature({ geometry: new Point(coord), id, selected: false })
        if (color !== undefined) f.set('color', color, true)
        return f
      }),
    )
    popup.hide()
    renderSelected()
    lastChangeEl.textContent = ''
  }

  build()
  load()
  registerHooks({ cluster: () => handle })

  byId('cl-regenerate', HTMLButtonElement).addEventListener('click', load)

  // `resolveFill` is fixed at creation, so the layer is rebuilt; the features (and selection) stay.
  customFillEl.addEventListener('change', () => {
    const old = handle
    selectionRect.dispose()
    map.removeLayer(old.layer)
    const features = old.source.getFeatures()
    old.source.clear(true)
    build()
    handle.source.addFeatures(features)
  })

  distanceEl.addEventListener('input', () => {
    const value = Number(distanceEl.value)
    handle.clusterSource.setDistance(value)
    distanceValueEl.textContent = String(value)
  })

  byId('cl-recolor', HTMLButtonElement).addEventListener('click', () => {
    for (const f of handle.source.getFeatures()) {
      f.set('color', paletteColor(Math.floor(Math.random() * DEFAULT_PALETTE.length)), true)
    }
    setStatus('Colors changed silently: press refreshStyles()')
  })
  byId('cl-refresh', HTMLButtonElement).addEventListener('click', () => {
    handle.refreshStyles()
  })
  byId('cl-clear', HTMLButtonElement).addEventListener('click', () => {
    for (const f of handle.source.getFeatures()) f.set('selected', false, true)
    handle.refreshStyles()
    renderSelected()
  })
  byId('cl-fit', HTMLButtonElement).addEventListener('click', () => {
    fitToSource(map, handle.source, { padding: [40, 40, 40, 40], maxZoom: 15 })
  })

  map.on('click', (e: MapBrowserEvent) => {
    if (getMode() !== 'cluster') return
    const original = e.originalEvent as MouseEvent
    if (original.shiftKey) {
      popup.hide()
      return
    }
    const clicked = featureAtPixel(map, e.pixel, handle.layer)
    const raw: unknown = clicked?.get('features')
    const members = Array.isArray(raw) ? (raw as Feature[]) : []
    if (members.length === 0) {
      popup.hide()
      return
    }
    if (original.ctrlKey) {
      const selected = !members.some((f) => Boolean(f.get('selected')))
      for (const f of members) f.set('selected', selected, true)
      handle.refreshStyles()
      renderSelected()
      popup.hide()
      return
    }
    const first = members[0]
    const geometry = first?.getGeometry()
    if (members.length > 1) {
      popup.show(`<p class="popup-cluster">${members.length} points</p>`, e.coordinate as LngLat)
    } else if (first && geometry instanceof Point) {
      const [lng = 0, lat = 0] = geometry.getCoordinates()
      const color: unknown = first.get('color')
      const id: unknown = first.get('id')
      popup.show(
        `<h4>Point #${String(id)}</h4><p>color: ${typeof color === 'string' ? color : 'default'}</p><p>${lng.toFixed(5)}, ${lat.toFixed(5)}</p>`,
        e.coordinate as LngLat,
      )
    } else {
      popup.hide()
    }
  })
}
