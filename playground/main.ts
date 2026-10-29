import 'ol/ol.css'
import '../src/style.css'
import './playground.css'
import { applyBackground, applyStyle } from 'ol-mapbox-style'
import { createBaseMap } from '../src/index'
import { byId, errorMessage, setStatus } from './dom'
import type { ClickMode, DemoContext } from './dom'
import { setupClusterDemo } from './clusterDemo'
import { setupRouteDemo } from './routeDemo'
import { setupPickDemo } from './pickDemo'
import { setupPreviewDemo } from './previewDemo'
import { registerHooks } from './hooks'

const STYLE_URLS = {
  light: '/map_style_custom.min.json',
  dark: '/map_style_dark_custom.json',
} as const

function reportError(what: string, err: unknown): void {
  console.warn(what, err)
  setStatus(`${what}: ${errorMessage(err)}`, true)
}

const base = createBaseMap(byId('map', HTMLDivElement), {
  styleUrl: STYLE_URLS.light,
  center: [37.62, 55.75],
  zoom: 10,
})
registerHooks({ map: base.map })

base.ready.then(() => setStatus('Style loaded')).catch((err: unknown) => reportError('Style failed', err))
applyBackground(base.tileLayer, STYLE_URLS.light).catch((err: unknown) => reportError('Background failed', err))

function setStyle(url: string): void {
  applyStyle(base.tileLayer, url)
    .then(() => setStatus('Style loaded'))
    .catch((err: unknown) => reportError('Style failed', err))
  applyBackground(base.tileLayer, url).catch((err: unknown) => reportError('Background failed', err))
}

const styleLight = byId('style-light', HTMLInputElement)
const styleDark = byId('style-dark', HTMLInputElement)
styleLight.addEventListener('change', () => {
  if (styleLight.checked) setStyle(STYLE_URLS.light)
})
styleDark.addEventListener('change', () => {
  if (styleDark.checked) setStyle(STYLE_URLS.dark)
})

const modePick = byId('mode-pick', HTMLInputElement)
const getMode = (): ClickMode => (modePick.checked ? 'pick' : 'cluster')

const ctx: DemoContext = { map: base.map, getMode }
setupClusterDemo(ctx)
setupRouteDemo(ctx)
setupPickDemo(ctx)
setupPreviewDemo(ctx)
