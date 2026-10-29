import type OlMap from 'ol/Map.js'
import MapBrowserEvent from 'ol/MapBrowserEvent.js'
import { listen, unlistenByKey } from 'ol/events.js'
import type { EventsKey } from 'ol/events.js'
import type { Coordinate } from 'ol/coordinate.js'
import { boundingExtent } from 'ol/extent.js'
import type { Extent } from 'ol/extent.js'
import Feature from 'ol/Feature.js'
import { fromExtent } from 'ol/geom/Polygon.js'
import VectorSource from 'ol/source/Vector.js'
import VectorLayer from 'ol/layer/Vector.js'
import { selectionRectStyle } from './styles'
import type { FeatureId } from './types'

export type SelectionChange = { id: FeatureId; selected: boolean }
export type SelectionRectHandle = { dispose: () => void }

/** Shift-drag box that toggles `selected` on the source features inside it. */
export function setupSelectionRect(
  map: OlMap,
  source: VectorSource,
  onSelection: (affected: SelectionChange[]) => void,
  refresh: () => void,
): SelectionRectHandle {
  const boxSource = new VectorSource()
  const boxLayer = new VectorLayer({ source: boxSource, style: selectionRectStyle() })
  map.addLayer(boxLayer)

  let dragging = false
  let start: Coordinate | null = null
  let box: Extent | null = null

  // `pointerdown`/`pointerup` are real map events but missing from ol's typed `on` overloads,
  // so the untyped `listen` is used and the event is narrowed at runtime.
  let moveKey: EventsKey | null = null
  const stopMove = (): void => {
    if (moveKey) unlistenByKey(moveKey)
    moveKey = null
  }

  const onPointerDown = (e: unknown): void => {
    if (!(e instanceof MapBrowserEvent) || !(e.originalEvent as PointerEvent).shiftKey) return
    dragging = true
    start = e.coordinate
    box = null
    stopMove()
    moveKey = listen(map, 'pointermove', onPointerMove)
  }

  const onPointerMove = (e: unknown): void => {
    if (!(e instanceof MapBrowserEvent) || !dragging || !start) return
    box = boundingExtent([start, e.coordinate])
    boxSource.clear()
    boxSource.addFeature(new Feature(fromExtent(box)))
  }

  const onPointerUp = (): void => {
    if (!dragging) return
    dragging = false
    stopMove()
    boxSource.clear()
    const extent = box
    box = null
    start = null
    if (!extent) return
    const affected: SelectionChange[] = []
    source.forEachFeatureInExtent(extent, (f) => {
      const id: unknown = f.get('id')
      if (typeof id !== 'string' && typeof id !== 'number') return
      const selected = !f.get('selected')
      f.set('selected', selected, true)
      affected.push({ id, selected })
    })
    refresh()
    onSelection(affected)
  }

  const downKey = listen(map, 'pointerdown', onPointerDown)
  const upKey = listen(map, 'pointerup', onPointerUp)

  return {
    dispose: () => {
      unlistenByKey(downKey)
      stopMove()
      unlistenByKey(upKey)
      map.removeLayer(boxLayer)
    },
  }
}
