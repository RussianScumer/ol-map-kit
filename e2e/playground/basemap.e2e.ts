import type { Page } from '@playwright/test'
import { test, expect, waitForRenderComplete } from '../support/playground'

/** Hides every layer above the base tile layer, then returns the on-screen RGB at the map centre. */
async function centreColour(page: Page): Promise<number[]> {
  await page.evaluate(() => {
    for (const layer of window.__playground!.map.getLayers().getArray().slice(1)) layer.setVisible(false)
  })
  await waitForRenderComplete(page)
  const box = await page.locator('#map').boundingBox()
  if (!box) throw new Error('#map has no bounding box')
  const png = await page.screenshot({
    clip: { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), width: 1, height: 1 },
  })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
  }, png.toString('base64'))
}

function near(actual: number[], expected: number[], tol = 2): boolean {
  return actual.length === expected.length && actual.every((v, i) => Math.abs(v - (expected[i] ?? NaN)) <= tol)
}

test.describe('base map', () => {
  test('loads the light style with all external requests stubbed', async ({ page, net }) => {
    await expect(page.locator('#status')).toHaveText('Style loaded')
    await expect(page.locator('#status')).not.toHaveClass(/error/)
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name))
    expect(resources).toContain('http://localhost:5179/map_style_custom.min.json')
    expect(net.requests).toContain('https://tiles.openfreemap.org/planet')
    await expect
      .poll(
        () => net.requests.filter((u) => /^https:\/\/tiles\.openfreemap\.org\/planet\/\d+\/\d+\/\d+\.pbf$/.test(u)).length,
      )
      .toBeGreaterThan(0)
    const keys = await page.evaluate(() => Object.keys(window.__playground!).sort())
    expect(keys).toEqual(['cluster', 'map', 'multiRouteLayer', 'pickLayer', 'previewLayer', 'routeLayer'])
    expect(net.unexpected).toEqual([])
  })

  test('paints the light style background', async ({ page }) => {
    const colour = await centreColour(page)
    expect(near(colour, [248, 244, 240]), `centre colour ${colour.join(',')}`).toBe(true)
  })

  test('switches to the dark style', async ({ page }) => {
    const res = page.waitForResponse((r) => r.url().endsWith('/map_style_dark_custom.json'))
    await page.locator('#style-dark').check()
    expect((await res).ok()).toBe(true)
    await expect(page.locator('#status')).toHaveText('Style loaded')
    await expect(page.locator('#status')).not.toHaveClass(/error/)
    await expect.poll(async () => near(await centreColour(page), [10, 10, 10])).toBe(true)
  })

  test('applies the package popup CSS', async ({ page }) => {
    await expect(page.locator('.ol-popup')).toHaveCount(1)
    expect(await page.locator('.ol-popup').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('8px')
  })
})
