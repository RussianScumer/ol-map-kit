# ol-map-kit

[English](README.md) | [Русский](README.ru.md)

Независимое от фреймворка ядро карты на [OpenLayers](https://openlayers.org/): базовая карта на векторных тайлах,
слой кластеров с выделением рамкой по Shift, всплывающее окно, слои одного и нескольких маршрутов, маркер выбранной
точки и разбор ответов Nominatim.

Все функции принимают и возвращают обычные объекты `ol`, поэтому пакет работает с Vue, React, Svelte или без
фреймворка.

## Установка

```sh
pnpm add @korneevecin/ol-map-kit ol ol-mapbox-style
# или
npm install @korneevecin/ol-map-kit ol ol-mapbox-style
```

`ol` (^10.9.0) и `ol-mapbox-style` (^13.4.1) — peer-зависимости.

Один раз подключите стили (оформление всплывающего окна):

```ts
import '@korneevecin/ol-map-kit/style.css'
```

## Координаты

`createBaseMap` вызывает `useGeographic()`, поэтому все координаты в пакете задаются как `[долгота, широта]`
(тип `LngLat`). Единственное исключение — `PickMarkerHandle.place(lat, lng)`.

## Быстрый старт

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
  styleUrl: 'https://example.com/style.json', // JSON-стиль Mapbox/MapLibre
  center: [37.62, 55.75],
  zoom: 10,
})
ready.catch((e) => console.error('Не удалось загрузить стиль', e))

const clusters = createClusterLayer({ distance: 40 })
map.addLayer(clusters.layer)

clusters.source.addFeatures([
  new Feature({ geometry: new Point([37.6, 55.7]), id: 1, selected: false, color: '#e6194b' }),
  new Feature({ geometry: new Point([37.7, 55.8]), id: 2, selected: false }),
])
fitToSource(map, clusters.source, { padding: [40, 40, 40, 40], maxZoom: 15 })

// Рамка по Shift переключает `selected` у объектов внутри неё.
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
  if (members.length) popup.show(`<p class="popup-cluster">${members.length} точек</p>`, e.coordinate)
  else popup.hide()
})

// Позже
selection.dispose()
dispose()
```

## API

### Базовая карта и вид

- `createBaseMap(target, { styleUrl, center, zoom, layers? })` возвращает `{ map, tileLayer, ready, dispose }`.
  Создаёт карту со слоем векторных тайлов, оформленным стилем `styleUrl`. Масштабирование рамкой по Shift
  отключено, чтобы Shift мог использовать слой выделения. `ready` — промис `applyStyle`, ошибки в нём не
  перехватываются: обработайте отказ сами. `dispose` только отсоединяет карту от элемента.
- `fitToSource(map, source, { padding, maxZoom })` подгоняет вид под `source.getExtent()`. Экстент `null`, пустой
  или с NaN пропускается.

### Слой кластеров и выделение

- `createClusterLayer({ resolveFill?, distance? })` возвращает `{ source, clusterSource, layer, refreshStyles }`.
  Объекты добавляются в `source`, `layer` добавляется на карту. Используются свойства объектов `id`, `selected` и
  необязательное `color`. По умолчанию кластер заливается первым непустым `color` среди его объектов, иначе
  красным; чтобы изменить правило, передайте `resolveFill(features) => string`. Кластер, в котором выделен хотя
  бы один объект, получает толстую синюю обводку. После «тихого» изменения свойств
  (`feature.set(key, value, true)`) вызовите `refreshStyles()`.
- `setupSelectionRect(map, source, onSelection, refresh)` возвращает `{ dispose }`. Перетаскивание с Shift рисует
  рамку и переключает `selected` у объектов внутри неё, затем вызывает `refresh()` и `onSelection(changes)` с
  массивом `{ id, selected }[]`.

### Всплывающее окно

- `createPopup(map)` возвращает `{ overlay, show(html, coord), hide() }`. У элемента класс `ol-popup`, стили —
  в `style.css`. `show` записывает `innerHTML`, поэтому экранируйте недоверенные данные.
- `featureAtPixel(map, pixel, layer)` возвращает первый объект слоя `layer` под пикселем или `undefined`.

### Маршруты

- `createRouteLayer({ start, line?, points }, { startColor?, lineColor?, lineWidth?, zIndex? })` возвращает
  `VectorLayer` с меткой старта, необязательной сплошной линией и цветной меткой на каждую точку
  (`{ coord, color }`). Слой не добавляется на карту.
- `createMultiRouteLayer({ routes, unassigned }, { palette?, unassignedColor?, zIndex? })` возвращает
  `VectorLayer` для предпросмотра нескольких черновых маршрутов. Каждый маршрут (`{ geometry, stops }`) получает
  свой цвет палитры, пунктирную линию и нумерованные остановки. Подряд идущие остановки в одной точке
  объединяются, маршруты с общей точкой смещаются в сторону, а каждый следующий маршрут рисуется тоньше и выше,
  чтобы на общих участках дороги были видны все цвета. Нераспределённые точки — серые метки.

### Маркер выбранной точки

- `createPickMarkerLayer(map, color)` возвращает `{ place(lat, lng), clear() }`. Добавляет слой с одной меткой,
  например для точки, выбранной пользователем или найденной геокодером. Обратите внимание на порядок аргументов
  `(lat, lng)`. Пустые (falsy) `lat` или `lng` игнорируются.

### Nominatim

- `parseNominatimResult(raw)` превращает сырой ответ Nominatim (или прокси на бэкенде) в `NominatimResult` с
  числовыми `lat` / `lng` (`lng` берётся из `lon`, если не задан) и фиксированным набором полей `address`.
  Отсутствие `address` допускается.

### Стили

- `pinStyle(color)`, `labeledPinStyle(color, label, { dx?, zIndex? })`, `lineStyle(color, width)`,
  `dashedLineStyle(color, width, zIndex)`, `selectionRectStyle()`.
- `makePinIcon(fill, stroke?, strokeWidth?, scale?, displacement?)` возвращает кэшированную SVG-метку;
  `markerIcon(src, scale?)` — иконку из URL изображения с привязкой к нижнему центру.
- `DEFAULT_PALETTE` — двенадцать различимых цветов; `paletteColor(i, palette?)` выбирает цвет по кругу и бросает
  `RangeError` для пустой палитры.

### Типы

`LngLat`, `FeatureId`, типы `*Options`, `*Input` и `*Handle` всех функций выше, `SelectionChange`, `RoutePoint`,
`MultiRoute`, `NominatimRawResult`, `NominatimAddress` и `NominatimResult`.

## Разработка

```sh
pnpm install
pnpm dev     # интерактивная песочница
pnpm test    # vitest
pnpm lint
pnpm build   # dist/: ESM-сборка, типы и style.css
```

## Лицензия

MIT
