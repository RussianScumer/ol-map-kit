import type { Page } from '@playwright/test'
import type LineString from 'ol/geom/LineString.js'
import type Point from 'ol/geom/Point.js'
import { test, expect, waitForRenderComplete, setView } from '../support/playground'

const CLICK_DY = -20 // the pin tip at the coordinate is transparent; aim at the pin body
const RENDER_TIMEOUT_MS = 10_000

/** Bounds a support call that waits for `rendercomplete`, which has no timeout of its own. */
async function bounded(what: string, work: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what}: no rendercomplete within ${RENDER_TIMEOUT_MS} ms`)),
      RENDER_TIMEOUT_MS,
    )
  })
  try {
    await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

type LayerKey = 'routeLayer' | 'multiRouteLayer' | 'previewLayer'
type Hit = { type: string; first: number[] }

async function hitsAt(page: Page, key: LayerKey, lngLat: [number, number], dy = 0): Promise<Hit[]> {
  return page.evaluate(
    ({ key: layerKey, lngLat: at, dy: offset }) => {
      const hooks = window.__playground!
      const layer = hooks[layerKey]
      const px = hooks.map.getPixelFromCoordinate(at)
      if (!px) throw new Error('hitsAt: map not rendered')
      const features = hooks.map.getFeaturesAtPixel([px[0]!, px[1]! + offset], { layerFilter: (l) => l === layer })
      const hits: Hit[] = []
      for (const f of features) {
        const geometry = f.getGeometry()
        if (!geometry) continue
        const type = geometry.getType()
        const first =
          type === 'Point' ? (geometry as Point).getCoordinates() : (geometry as LineString).getFirstCoordinate()
        hits.push({ type, first })
      }
      return hits
    },
    { key, lngLat, dy },
  )
}

function has(hits: Hit[], type: string, at: [number, number]): boolean {
  return hits.some(
    (h) => h.type === type && Math.abs((h.first[0] ?? NaN) - at[0]) < 1e-9 && Math.abs((h.first[1] ?? NaN) - at[1]) < 1e-9,
  )
}

async function visibility(page: Page): Promise<{ route: boolean; multi: boolean; preview: boolean }> {
  return page.evaluate(() => {
    const h = window.__playground!
    return {
      route: h.routeLayer.getVisible(),
      multi: h.multiRouteLayer.getVisible(),
      preview: h.previewLayer.getVisible(),
    }
  })
}

type FitState = { view: number[]; source: number[]; center: number[]; zoom: number }

async function fitState(page: Page, key: 'routeLayer' | 'multiRouteLayer'): Promise<FitState> {
  return page.evaluate((layerKey) => {
    const hooks = window.__playground!
    const view = hooks.map.getView()
    const source = hooks[layerKey].getSource()!.getExtent()
    if (!source) throw new Error('fitState: source has no extent')
    return {
      view: view.calculateExtent(hooks.map.getSize()),
      source,
      center: view.getCenter()!,
      zoom: view.getZoom()!,
    }
  }, key)
}

function contains(outer: number[], inner: number[]): boolean {
  return (
    (outer[0] ?? NaN) <= (inner[0] ?? NaN) &&
    (outer[1] ?? NaN) <= (inner[1] ?? NaN) &&
    (outer[2] ?? NaN) >= (inner[2] ?? NaN) &&
    (outer[3] ?? NaN) >= (inner[3] ?? NaN)
  )
}

test.describe('routes and preview', () => {
  test.beforeEach(async ({ page }) => {
    await bounded('initial render', waitForRenderComplete(page))
  })

  test('both route layers are on the map and visible', async ({ page }) => {
    const r = await page.evaluate(() => {
      const h = window.__playground!
      const layers = h.map.getLayers().getArray()
      return {
        onMap: [layers.includes(h.routeLayer), layers.includes(h.multiRouteLayer)],
        counts: [h.routeLayer.getSource()!.getFeatures().length, h.multiRouteLayer.getSource()!.getFeatures().length],
      }
    })
    expect(r.onMap).toEqual([true, true])
    expect(r.counts).toEqual([5, 13])
    expect(await visibility(page)).toMatchObject({ route: true, multi: true })
    await expect(page.locator('#rt-route')).toBeChecked()
    await expect(page.locator('#rt-multi')).toBeChecked()
  })

  test('route toggle hides and shows the route layer', async ({ page }) => {
    await page.locator('#rt-route').uncheck()
    await expect.poll(() => visibility(page)).toMatchObject({ route: false, multi: true })
    await bounded('route hidden', waitForRenderComplete(page))
    expect(await hitsAt(page, 'routeLayer', [37.62, 55.75])).toEqual([])
    await page.locator('#rt-route').check()
    await expect.poll(() => visibility(page)).toMatchObject({ route: true, multi: true })
  })

  test('multi-route toggle hides and shows the multi-route layer', async ({ page }) => {
    await page.locator('#rt-multi').uncheck()
    await expect.poll(() => visibility(page)).toMatchObject({ route: true, multi: false })
    await page.locator('#rt-multi').check()
    await expect.poll(() => visibility(page)).toMatchObject({ route: true, multi: true })
  })

  test('fit buttons bring each source into view', async ({ page }) => {
    const pairs: ['routeLayer' | 'multiRouteLayer', string][] = [
      ['routeLayer', '#rt-route-fit'],
      ['multiRouteLayer', '#rt-multi-fit'],
    ]
    for (const [key, button] of pairs) {
      await bounded('move away', setView(page, [37.0, 55.0], 13))
      const before = await fitState(page, key)
      expect(contains(before.view, before.source)).toBe(false)
      await page.locator(button).click()
      await bounded('after fit', waitForRenderComplete(page))
      const after = await fitState(page, key)
      expect(contains(after.view, after.source)).toBe(true)
      expect(after.zoom).toBeLessThanOrEqual(15)
      const moved = Math.abs((after.center[0] ?? NaN) - 37.0) > 1e-6 || Math.abs((after.center[1] ?? NaN) - 55.0) > 1e-6
      expect(moved).toBe(true)
    }
  })

  test('route hit test finds the line at the start and the start pin above it', async ({ page }) => {
    await expect
      .poll(async () => has(await hitsAt(page, 'routeLayer', [37.62, 55.75]), 'LineString', [37.62, 55.75]))
      .toBe(true)
    await expect
      .poll(async () => has(await hitsAt(page, 'routeLayer', [37.62, 55.75], CLICK_DY), 'Point', [37.62, 55.75]))
      .toBe(true)
  })

  test('style preview palette and layer toggle', async ({ page }) => {
    await expect(page.locator('#pv-palette .pv-row')).toHaveCount(14)
    const prefixes = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLImageElement>('#pv-palette .pv-row img')).map((i) => i.src.slice(0, 18)),
    )
    expect(prefixes).toHaveLength(14)
    for (const p of prefixes) expect(p).toBe('data:image/svg+xml')
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLImageElement>('#pv-palette .pv-row img')).every(
            (i) => i.complete && i.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true)
    const rows = page.locator('#pv-palette .pv-row')
    await expect(rows.nth(0)).toHaveText('0: #e6194b')
    await expect(rows.nth(12)).toHaveText('12: #e6194b')
    await expect(rows.nth(13)).toHaveText('13: #3cb44b')

    await expect(page.locator('#pv-layer')).not.toBeChecked()
    expect((await visibility(page)).preview).toBe(false)
    await page.locator('#pv-layer').check()
    await expect.poll(async () => (await visibility(page)).preview).toBe(true)
    const count = await page.evaluate(() => window.__playground!.previewLayer.getSource()!.getFeatures().length)
    expect(count).toBe(6)
    await expect
      .poll(async () => has(await hitsAt(page, 'previewLayer', [37.56, 55.8], CLICK_DY), 'Point', [37.56, 55.8]))
      .toBe(true)
  })
})
