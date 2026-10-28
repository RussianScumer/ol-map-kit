import type Feature from 'ol/Feature'
import type { FeatureLike } from 'ol/Feature'
import VectorSource from 'ol/source/Vector'
import Cluster from 'ol/source/Cluster'
import VectorLayer from 'ol/layer/Vector'
import { Fill, Stroke, Style, Text } from 'ol/style'
import { makePinIcon } from './styles'

/** Default fill rule: the first truthy `color` property among the members, else red. */
export function defaultResolveFill(features: readonly Feature[]): string {
  for (const f of features) {
    const color: unknown = f.get('color')
    if (typeof color === 'string' && color !== '') return color
  }
  return 'red'
}

export interface ClusterAppearance {
  fill: string
  selected: boolean
  count: number
  key: string
}

/** Pure appearance and cache key of a cluster; null for an empty one. */
export function clusterAppearance(
  members: readonly Feature[],
  resolveFill: (features: Feature[]) => string = defaultResolveFill,
): ClusterAppearance | null {
  if (members.length === 0) return null
  const fill = resolveFill([...members])
  const selected = members.some((f) => Boolean(f.get('selected')))
  const count = members.length
  return { fill, selected, count, key: `${fill}|${selected}|${count}` }
}

function makeClusterStyle(fill: string, selected: boolean, count: number): Style {
  return new Style({
    image: makePinIcon(fill, selected ? 'blue' : '#2c2c2c', selected ? 3 : 1),
    text:
      count > 1
        ? new Text({
            text: String(count),
            offsetY: -25,
            offsetX: 0,
            fill: new Fill({ color: 'white' }),
            stroke: new Stroke({ color: 'black', width: 3 }),
            font: 'bold 16px Arial',
          })
        : undefined,
  })
}

export type ClusterLayerOptions = {
  resolveFill?: (features: Feature[]) => string
  distance?: number
}

export type ClusterLayerHandle = {
  source: VectorSource
  clusterSource: Cluster
  layer: VectorLayer<Cluster>
  refreshStyles: () => void
}

/** Cluster layer over a plain vector source; the caller adds `layer` to a map. */
export function createClusterLayer({
  resolveFill = defaultResolveFill,
  distance = 0,
}: ClusterLayerOptions = {}): ClusterLayerHandle {
  const source = new VectorSource()
  const clusterSource = new Cluster({ source, distance })
  const cache = new Map<string, Style>()

  const style = (feature: FeatureLike): Style | undefined => {
    const members: unknown = feature.get('features')
    if (!Array.isArray(members)) return undefined
    const appearance = clusterAppearance(members as Feature[], resolveFill)
    if (!appearance) return undefined
    let cached = cache.get(appearance.key)
    if (!cached) {
      cached = makeClusterStyle(appearance.fill, appearance.selected, appearance.count)
      cache.set(appearance.key, cached)
    }
    return cached
  }

  const layer = new VectorLayer({
    source: clusterSource,
    style,
    updateWhileAnimating: true,
    updateWhileInteracting: true,
  })

  return {
    source,
    clusterSource,
    layer,
    refreshStyles: () => {
      layer.changed()
    },
  }
}
