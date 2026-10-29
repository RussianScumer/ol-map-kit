import '@korneevecin/ol-map-kit/style.css'
import OlMap from 'ol/Map.js'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import { createBaseMap, createClusterLayer, createPopup } from '@korneevecin/ol-map-kit'

const cluster = createClusterLayer({ distance: 40 })

const handle = createBaseMap('map', {
  styleUrl: '/map_style_custom.min.json',
  center: [37.62, 55.75],
  zoom: 10,
  layers: [cluster.layer],
})

const features = []
let n = 0
for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 4; j++) {
    features.push(
      new Feature({
        geometry: new Point([37.6 + 0.01 * i, 55.74 + 0.01 * j]),
        id: n,
        color: '#e53935',
      }),
    )
    n++
  }
}
cluster.source.addFeatures(features)

const popup = createPopup(handle.map)

const status = document.getElementById('status')
handle.ready.then(
  () => {
    status.textContent = 'ready'
  },
  (err) => {
    status.textContent = 'error: ' + (err instanceof Error ? err.message : String(err))
    status.className = 'error'
  },
)

window.__consumer = {
  map: handle.map,
  cluster,
  popup,
  sameOl: handle.map instanceof OlMap && handle.tileLayer instanceof VectorTileLayer,
}
