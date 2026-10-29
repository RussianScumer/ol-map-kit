# ol-map-kit

[English](README.md) | [Русский](README.ru.md)

Framework-agnostic [OpenLayers](https://openlayers.org/) map core: a vector tile base map, a cluster layer with
shift-drag selection, a popup, single and multi-route layers, a pick marker and Nominatim result parsing.

Every helper takes and returns plain `ol` objects, so it works with Vue, React, Svelte or no framework at all.

## Installation

```sh
pnpm add @korneevecin/ol-map-kit ol ol-mapbox-style
# or
npm install @korneevecin/ol-map-kit ol ol-mapbox-style
```

`ol` (^10.9.0) and `ol-mapbox-style` (^13.4.1) are peer dependencies.

Import the stylesheet once (popup styles):

```ts
import '@korneevecin/ol-map-kit/style.css'
```

## Coordinates

`createBaseMap` calls `useGeographic()`, so every coordinate in the package is `[longitude, latitude]`
(the `LngLat` type). The one exception is `PickMarkerHandle.place(lat, lng)`.

## Quick start

```ts
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import {
  createBaseMap,
  createClusterLayer,
  createPopup,
  featureAtPixel,
  fitToSource,
  setupSelectionRect,
} from '@korneevecin/ol-map-kit'
import '@korneevecin/ol-map-kit/style.css'

const { map, ready, dispose } = createBaseMap('map', {
  styleUrl: 'https://example.com/style.json', // Mapbox/MapLibre style JSON
  center: [37.62, 55.75],
  zoom: 10,
})
ready.catch((e) => console.error('Style failed to load', e))

const clusters = createClusterLayer({ distance: 40 })
map.addLayer(clusters.layer)

clusters.source.addFeatures([
  new Feature({ geometry: new Point([37.6, 55.7]), id: 1, selected: false, color: '#e6194b' }),
  new Feature({ geometry: new Point([37.7, 55.8]), id: 2, selected: false }),
])
fitToSource(map, clusters.source, { padding: [40, 40, 40, 40], maxZoom: 15 })

// Shift-drag toggles `selected` on the features inside the box.
const selection = setupSelectionRect(
  map,
  clusters.source,
  (changes) => console.log(changes), // [{ id, selected }]
  clusters.refreshStyles,
)

const popup = createPopup(map)
map.on('click', (e) => {
  const cluster = featureAtPixel(map, e.pixel, clusters.layer)
  const members = cluster?.get('features') ?? []
  if (members.length) popup.show(`<p class="popup-cluster">${members.length} points</p>`, e.coordinate)
  else popup.hide()
})

// Later
selection.dispose()
dispose()
```

## API

### Base map and view

- `createBaseMap(target, { styleUrl, center, zoom, layers? })` returns `{ map, tileLayer, ready, dispose }`.
  Creates a map with a vector tile layer styled by `styleUrl`. Shift-drag zoom is disabled so the selection box can
  use it. `ready` is the `applyStyle` promise and is not caught: handle its rejection. `dispose` only detaches the
  map from its target.
- `fitToSource(map, source, { padding, maxZoom })` fits the view to `source.getExtent()`. A `null`, empty or NaN
  extent is ignored.

### Cluster layer and selection

- `createClusterLayer({ resolveFill?, distance? })` returns `{ source, clusterSource, layer, refreshStyles }`.
  Add features to `source`; add `layer` to the map. Features use the properties `id`, `selected` and optionally
  `color`. By default a cluster is filled with the first truthy `color` among its members, else red; pass
  `resolveFill(features) => string` to change it. A cluster with any selected member gets a thick blue outline. Call `refreshStyles()` after
  changing properties silently (`feature.set(key, value, true)`).
- `setupSelectionRect(map, source, onSelection, refresh)` returns `{ dispose }`. Shift-drag draws a box and
  toggles `selected` on the features inside it, then calls `refresh()` and `onSelection(changes)` with
  `{ id, selected }[]`.

### Popup

- `createPopup(map)` returns `{ overlay, show(html, coord), hide() }`. The element has the class `ol-popup`,
  styled by `style.css`. `show` sets `innerHTML`, so escape untrusted content.
- `featureAtPixel(map, pixel, layer)` returns the first feature of `layer` under the pixel, or `undefined`.

### Routes

- `createRouteLayer({ start, line?, points }, { startColor?, lineColor?, lineWidth?, zIndex? })` returns a
  `VectorLayer` with a start pin, an optional solid line and a colored pin per point (`{ coord, color }`).
  The layer is not added to the map.
- `createMultiRouteLayer({ routes, unassigned }, { palette?, unassignedColor?, zIndex? })` returns a
  `VectorLayer` previewing several draft routes. Each route (`{ geometry, stops }`) gets its own palette color, a
  dashed line and numbered stops. Consecutive stops at one point are merged, routes sharing a point are shifted
  sideways, and each next route is drawn thinner and higher so shared road segments show every color. Unassigned
  points are grey pins.

### Pick marker

- `createPickMarkerLayer(map, color)` returns `{ place(lat, lng), clear() }`. Adds a single-pin layer, for example
  to show a point picked by the user or found by a geocoder. Note the `(lat, lng)` argument order. Falsy
  `lat` or `lng` is ignored.

### Nominatim

- `parseNominatimResult(raw)` converts a raw Nominatim (or backend proxy) payload into a `NominatimResult` with
  numeric `lat` / `lng` (`lng` falls back to `lon`) and a fixed set of `address` fields. A missing `address` is
  tolerated.

### Styles

- `pinStyle(color)`, `labeledPinStyle(color, label, { dx?, zIndex? })`, `lineStyle(color, width)`,
  `dashedLineStyle(color, width, zIndex)`, `selectionRectStyle()`.
- `makePinIcon(fill, stroke?, strokeWidth?, scale?, displacement?)` returns a cached SVG pin icon;
  `markerIcon(src, scale?)` returns an icon from an image URL anchored at the bottom center.
- `DEFAULT_PALETTE` holds twelve distinct colors; `paletteColor(i, palette?)` picks one with wrap-around and
  throws `RangeError` for an empty palette.

### Types

`LngLat`, `FeatureId`, the `*Options`, `*Input` and `*Handle` types of every helper above, `SelectionChange`,
`RoutePoint`, `MultiRoute`, `NominatimRawResult`, `NominatimAddress` and `NominatimResult`.

## Development

```sh
pnpm install
pnpm dev     # interactive playground
pnpm test    # vitest
pnpm lint
pnpm build   # dist/ with ESM bundle, types and style.css
```

## License

MIT
