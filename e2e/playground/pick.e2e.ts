import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import type Point from 'ol/geom/Point.js'
import { parseNominatimResult } from '../../src/nominatim'
import type { NominatimRawResult } from '../../src/nominatim'
import {
  test,
  expect,
  waitForRenderComplete,
  pixelOf,
  bounded,
  waitViewIdle,
  CLICK_GAP_MS,
  EMPTY_SPOT,
} from '../support/playground'

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

type Target = { x: number; y: number; lngLat: [number, number] }

async function targetAt(page: Page, mx: number, my: number): Promise<Target> {
  await waitViewIdle(page)
  return page.evaluate(
    ({ mx: px, my: py }) => {
      const rect = document.getElementById('map')!.getBoundingClientRect()
      const c = window.__playground!.map.getCoordinateFromPixel([px, py])
      if (typeof c?.[0] !== 'number' || typeof c[1] !== 'number') throw new Error('targetAt: map not rendered')
      return { x: rect.left + px, y: rect.top + py, lngLat: [c[0], c[1]] as [number, number] }
    },
    { mx, my },
  )
}

async function pickCoords(page: Page): Promise<number[][]> {
  return page.evaluate(() =>
    window.__playground!.pickLayer.getSource()!
      .getFeatures()
      .map((f) => (f.getGeometry() as Point).getCoordinates()),
  )
}

function near(a: number[] | undefined, b: number[], tol = 1e-4): boolean {
  return a !== undefined && a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? NaN)) <= tol)
}

function fmt(c: number[]): string {
  return `${(c[0] ?? NaN).toFixed(5)}, ${(c[1] ?? NaN).toFixed(5)}`
}

async function pickAt(page: Page, mx: number, my: number): Promise<number[]> {
  const t = await targetAt(page, mx, my)
  await page.mouse.click(t.x, t.y)
  await expect
    .poll(async () => {
      const cs = await pickCoords(page)
      return cs.length === 1 && near(cs[0], t.lngLat)
    })
    .toBe(true)
  const [c] = await pickCoords(page)
  if (c === undefined) throw new Error('pickAt: no pick feature')
  await expect(page.locator('#pk-coord')).toHaveText(fmt(c))
  return c
}

async function loadFixture(): Promise<NominatimRawResult> {
  const text = await readFile(new URL('../fixtures/nominatim-reverse.json', import.meta.url), 'utf8')
  return JSON.parse(text) as NominatimRawResult
}

test.describe('pick marker and Nominatim', () => {
  test.beforeEach(async ({ page }) => {
    await bounded('initial render', waitForRenderComplete(page))
  })

  test('pick mode places and moves one marker', async ({ page }) => {
    await expect(page.locator('#pk-coord')).toHaveText('none')
    await expect(page.locator('#pk-geocode')).toBeDisabled()
    expect(await pickCoords(page)).toEqual([])

    await page.locator('#mode-pick').check()
    const first = await pickAt(page, 300, 400)
    await expect(page.locator('#pk-geocode')).toBeEnabled()
    await page.waitForTimeout(CLICK_GAP_MS)
    const second = await pickAt(page, 640, 260)

    expect(Math.abs((second[0] ?? NaN) - (first[0] ?? NaN))).toBeGreaterThan(1e-3)
    expect(await pickCoords(page)).toHaveLength(1)
  })

  test('cluster mode does not pick', async ({ page }) => {
    await expect(page.locator('#mode-cluster')).toBeChecked()
    const p = await pixelOf(page, EMPTY_SPOT)
    await page.mouse.click(p.x, p.y)
    await bounded('after cluster-mode click', waitForRenderComplete(page))
    expect(await pickCoords(page)).toEqual([])
    await expect(page.locator('#pk-coord')).toHaveText('none')
    await expect(page.locator('#pk-geocode')).toBeDisabled()

    await page.waitForTimeout(CLICK_GAP_MS)
    await page.locator('#mode-pick').check()
    await page.mouse.click(p.x, p.y)
    await expect.poll(async () => (await pickCoords(page)).length).toBe(1)
  })

  test('reverse geocode succeeds and is rate limited', async ({ page, net }) => {
    const raw = await loadFixture()
    await page.locator('#mode-pick').check()
    const c = await pickAt(page, 300, 400)

    const reverseCount = () => net.requests.filter((u) => u.startsWith(`${NOMINATIM_REVERSE}?`)).length
    expect(reverseCount()).toBe(0)
    const reqP = page.waitForRequest((r) => r.url().startsWith(`${NOMINATIM_REVERSE}?`))
    await page.locator('#pk-geocode').click()
    const req = await reqP
    const q = new URL(req.url()).searchParams
    expect(q.get('format')).toBe('jsonv2')
    expect(q.get('addressdetails')).toBe('1')
    expect(Number(q.get('lat'))).toBe(c[1])
    expect(Number(q.get('lon'))).toBe(c[0])

    await expect(page.locator('#status')).toHaveText('Nominatim: done')
    await expect(page.locator('#status')).not.toHaveClass(/error/)
    // second press must land within 1100 ms of the first, so do it before the slower assertions
    await page.locator('#pk-geocode').click()
    await expect(page.locator('#status')).toHaveText('Nominatim: wait a moment between requests')
    expect(reverseCount()).toBe(1)
    expect(await page.locator('#pk-parsed').textContent()).toBe(JSON.stringify(parseNominatimResult(raw), null, 2))
    expect(await page.locator('#pk-raw').textContent()).toBe(JSON.stringify(raw, null, 2))
    await expect.poll(reverseCount).toBe(1)
  })

  test('reverse geocode reports HTTP 500', async ({ page }) => {
    let hits = 0
    await page.route(
      (url) => url.origin === 'https://nominatim.openstreetmap.org' && url.pathname === '/reverse',
      async (route) => {
        hits += 1
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'boom',
          headers: { 'access-control-allow-origin': '*' },
        })
      },
    )
    await page.locator('#mode-pick').check()
    await pickAt(page, 300, 400)
    await page.locator('#pk-geocode').click()

    await expect(page.locator('#status')).toHaveText('Nominatim: HTTP 500')
    await expect(page.locator('#status')).toHaveClass(/error/)
    expect(hits).toBe(1)
    await expect(page.locator('#pk-parsed')).toHaveText('')
    await expect(page.locator('#pk-geocode')).toBeEnabled()
  })

  test('clear removes the marker', async ({ page }) => {
    await page.locator('#mode-pick').check()
    await pickAt(page, 300, 400)
    await page.locator('#pk-clear').click()

    await expect.poll(() => pickCoords(page)).toEqual([])
    await expect(page.locator('#pk-coord')).toHaveText('none')
    await expect(page.locator('#pk-geocode')).toBeDisabled()
  })
})
