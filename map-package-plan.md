# Extract map core into a standalone TypeScript npm package

## Context

`frontend/src/lib/map/` (16 files, ~2.2k lines, plain JS) mixes generic OpenLayers code with logistics
business logic: `@/api/*` calls, `Notify`, `$l`, the route-sheet Pinia store, `@/assets/colors.js`,
cargo statuses (`status === 3` → yellow pin), Russian UI strings, cargo popup HTML. The user wants the map
logic in a separate package that knows nothing about the app, written in TypeScript.

Decisions taken with the user:
- **Separate npm package** in its own repo, published like `@korneevecin/vue3-dialogs-lib`
  (repo `~/PycharmProjects/vue-dialog-lib` is the template for tooling).
- **Only the package is TypeScript.** The app stays JS and consumes the package's `.d.ts`.
- **UI controls stay in the app** (`LayerControlOL`, `RouteSheetControlOL`, `CargoStatsControlOL`,
  `SelectedCargoBtnOL`). The package is the map core only.

## Package: `@korneevecin/ol-map-kit` (name is a default, rename freely)

Repo: `~/PycharmProjects/ol-map-kit`. No Vue dependency — pure OpenLayers, framework-agnostic.

Tooling (copy from `vue-dialog-lib`, minus Vue): TypeScript, Vite lib mode (ESM only), `tsc -p
tsconfig.lib.json --emitDeclarationOnly` for `dist/types`, ESLint flat + typescript-eslint, vitest, `files: ["dist"]`,
`exports` with `types`/`import` and `./style.css`, `sideEffects: ["*.css"]`, `publishConfig.access: public`.
`index.ts` does not import CSS, so Vite emits none: a `build-css` script copies `src/style.css` to
`dist/style.css` (same as the template's `build-css`). The repo starts with `git init`.

**`ol` and `ol-mapbox-style` are `peerDependencies` and marked `external` in the Vite build config**
(`external: [/^ol(\/|$)/, /^ol-mapbox-style/]`; the template is on Vite 8, which still accepts
`build.rollupOptions`). Bundling a second copy of `ol` breaks `instanceof` checks, the global
`useGeographic()` projection state and layer/feature interop with the app's `ol`.

### Module layout (`src/`)

| Module | Source in app | Generic API |
|---|---|---|
| `baseMap.ts` | `useOlMap.js` init + `useMapModalOL.js` init (duplicated today) | `createBaseMap(target, {styleUrl, center, zoom, layers?})` → `{map, tileLayer, ready, dispose()}`; `styleUrl` is required (no default in the package); `ready` is the `applyStyle` promise instead of swallowing it with `.catch(console.warn)`; calls `useGeographic()`, `defaultInteractions({shiftDragZoom:false})` |
| `styles.ts` | `OLStyle.js` | `makePinIcon`, `markerIcon`, `pinStyle(color)`, `labeledPinStyle(color, label, {dx?, zIndex?})` (covers both `previewStopStyle`, zIndex 100 + dx, and `unassignedMarkerStyle`, zIndex 90 + optional label), `lineStyle`, `dashedLineStyle(color, width, zIndex)`, `selectionRectStyle`, `DEFAULT_PALETTE` + `paletteColor(i, palette?)` (was `shipmentColor`). Colors like the green start pin and grey `#7d7d7d` unassigned pin are layer option defaults, not hardcoded in styles |
| `clusterLayer.ts` | cluster part of `useOlMap.js` + cluster style cache in `OLStyle.js` | `createClusterLayer({resolveFill?: (features) => string, distance?})` → `{source, clusterSource, layer, refreshStyles()}`. Feature keys are generic: `id`, `selected`, `color`. The cargo "status 3 → `#ffc656`, else red" rule moves to the app as `resolveFill`. Cache redesign: the style function computes the `fill|selected|count` key on every call and caches only the `Style` per key, per layer instance (today's module-level `clusterKeyCache` keyed by member ids goes stale and needs manual `preCacheClusterStyle`/`clearClusterCache` calls). `refreshStyles()` is `layer.changed()`; no precache or clear API. Drop the stray `console.log`s |
| `popup.ts` | `Popup.js` overlay part + popup CSS injected in `useOlMap.js` | `createPopup(map)` → `{overlay, show(html, coord), hide()}`; `featureAtPixel(map, pixel, layer)`. CSS moves to `src/style.css` (shipped as `./style.css`), no DOM injection |
| `selectionRect.ts` | `SelectionRect.js` | `setupSelectionRect(map, source, onSelection(affected: {id, selected}[]), refresh)` → `{dispose()}` — shift-drag box, toggles `selected` silently on features, then calls `refresh` (the cluster handle's `refreshStyles`) instead of taking a bare layer; `cargoId` becomes `id` |
| `routeLayer.ts` | `RouteSheetLayer.js` | `createRouteLayer({start, line?, points: {coord, color}[]})` with `[lng, lat]` coords; app maps route-sheet DTO to it (GeoJSON `route.geometry.coordinates` → `line`; pickup color stays `paletteColor(i)` with `i` the original shipment index, counting shipments without pickup) |
| `multiRouteLayer.ts` | `PlanPreviewLayer.js` | `createMultiRouteLayer({routes: {geometry: [lng,lat][], stops: [lng,lat][]}[], unassigned: [lng,lat][]})`. Keeps `mergeVisits` (now only merges consecutive equal coords), side-offset and per-route width logic. The `pickup`/`delivery` filter and the `u.delivery` unwrapping move to the app adapter |
| `pickMarker.ts` | `useMapModalOL.js` marker part | `createPickMarkerLayer(map, color)` → `{place(lat, lng), clear()}` |
| `nominatim.ts` | `nominatim_wraps.js` | `NominatimResult`/`NominatimAddress` types + `parseNominatimResult(data)` (classes used only in `useMapModalOL.js`, no `instanceof` anywhere; keep the `lng = data.lng \|\| data.lon` fallback) |
| `view.ts` | repeated `getExtent()` + NaN check + `fit` in `useRouteSheets.js` | `fitToSource(map, source, {padding, maxZoom})` |
| `index.ts` | — | re-exports |

Strings in the package: none. Popup HTML, cluster text ("Грузов: N") and all labels are built by the app.
Russian comments in `OLStyle.js`/`PlanPreviewLayer.js` are translated to English when ported.

Unit tests (vitest, no DOM): `paletteColor`, `mergeVisits` + side offset, `parseNominatimResult`,
cluster fill resolution.

## App side (stays JS)

Move business code out of `src/lib/map/` to `src/views/MapProto/map/` (next to its only consumers
`MapMain.vue`, `MapModal.vue`, `dialogs/RoutePlanDialog.vue`), then delete `src/lib/map/`.

- Keep, rewritten on top of the package: `useMapPageOL.js`, `useCargoMarkers.js` (owns `resolveFill`,
  `generateCargoPopup`, cluster popup text, ctrl-click toggle), `useDbLayers.js`, `useRouteSheets.js`,
  `useMapModalOL.js` (keeps `MapApi.address__geocode` + `Notify`; fix the `catch { Notify.error(e) }`
  ReferenceError while there; keep the re-open branch that reuses the existing map with `setTarget` +
  `updateSize`, calling `createBaseMap` only on first init).
- Keep unchanged: the 4 controls.
- New thin adapters: `routeSheetToRoute(rsData)` and `suggestionToRoutes(suggestion)` (filters
  `pickup`/`delivery` stops) feeding `createRouteLayer` / `createMultiRouteLayer`.
- `RoutePlanDialog.vue`: `shipmentColor` → `paletteColor` from the package.
- Map views (`MapMain.vue`, `MapModal.vue`), not `main.js`: `import 'ol/ol.css'` and
  `import '@korneevecin/ol-map-kit/style.css'`, so the CSS stays in the lazy map chunks as it is today.
- `frontend/vite.config.js`: `resolve.dedupe: ['ol', 'ol-mapbox-style']`. Without it the `link:` package
  resolves `ol` from `ol-map-kit/node_modules` (its devDependency) and the app gets two copies of `ol`.
  Keep it after the switch to the published version; it is harmless.
- Dependency during development: `"@korneevecin/ol-map-kit": "link:../../ol-map-kit"`; after the first
  publish switch to a version and add the name to `minimumReleaseAgeExclude` in
  `frontend/pnpm-workspace.yaml`.
- `frontend/CLAUDE.md`: note that the map core lives in the external TS package and app-side map code is in
  `src/views/MapProto/map/`.

## Tasks (order)

1. **Package scaffold** — `git init`, `package.json`, tsconfigs, vite lib config with `ol` external, `build-css` script, eslint, vitest, empty `index.ts`; `pnpm build` produces `dist/*.js` + `dist/types` + `dist/style.css`.
2. **Port core modules** — `baseMap`, `styles`, `clusterLayer`, `popup` + `style.css`, `selectionRect`, `view`, `nominatim` with strict types and their unit tests.
3. **Port route layers** — `routeLayer`, `multiRouteLayer`, `pickMarker`, with `mergeVisits` tests.
4. **Rewire app** — link package, `resolve.dedupe` in `vite.config.js`, move app code to `src/views/MapProto/map/`, adapters, update 3 consumers, delete `src/lib/map/`. Commit `[FR] map core moved to ol-map-kit package`.
5. **Publish** — `npm publish`, switch link to version, update `pnpm-workspace.yaml` and `frontend/CLAUDE.md`.

Steps 1–3 are one boundary (package repo), step 4–5 the other (logistic frontend).

## Verification

- Package: `pnpm build`, `tsc --noEmit` and `pnpm test` clean; `dist/` contains no `ol` code: `ol` stays
  as bare imports (`grep -oE "from ?\"ol[^\"]*\"" dist/*.js` lists them) and the bundle is small
  (under ~30 kB; a bundled `ol` would be hundreds of kB). `dist/style.css` exists.
- Package purity: `grep -rE "@/|cargo|Notify|\\$l|[А-Яа-я]" src/` in the package → no hits.
- App: `pnpm lint` (no new warnings), `pnpm build` succeeds.
- Manual in `pnpm dev` (`/map` page): tiles load; cargo pins + clusters with counts; status-3 cargos yellow,
  layer colors applied; click → popup, ctrl-click → select toggle, shift-drag → rectangle select; stats
  control updates; DB layers toggle/color/add; route sheet show/hide fits view; plan preview draws dashed
  routes with numbered stops; MapModal pick → marker + reverse geocode.
