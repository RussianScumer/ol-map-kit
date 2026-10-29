import type OlMap from 'ol/Map'
import { isEmpty, type Extent } from 'ol/extent'

export interface FitToSourceOptions {
  padding: number[]
  maxZoom: number
}

/**
 * Fits the map view to the source extent. Skips a `null` extent, empty extents (an empty `VectorSource` returns
 * `[Infinity, Infinity, -Infinity, -Infinity]`) and NaN extents (which `isEmpty` does not catch).
 */
export function fitToSource(
  map: OlMap,
  source: { getExtent: () => Extent | null },
  options: FitToSourceOptions,
): void {
  const extent = source.getExtent()
  if (extent === null) return
  if (isEmpty(extent) || extent.some((v) => Number.isNaN(v))) return
  map.getView().fit(extent, { padding: options.padding, maxZoom: options.maxZoom })
}
