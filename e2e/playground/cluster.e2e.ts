import type { Page } from '@playwright/test'
import type Feature from 'ol/Feature.js'
import type Point from 'ol/geom/Point.js'
import { test, expect, waitForRenderComplete, setView } from '../support/playground'

const CLICK_GAP_MS = 300 // OL turns two clicks within 250 ms into a zooming `dblclick`
const CLICK_DY = -20 // the pin tip at the cluster pixel is transparent; aim at the pin body
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

type ClusterStats = { sourceCount: number; clusterCount: number; memberSum: number; distinct: number }

async function clusterStats(page: Page): Promise<ClusterStats> {
  return page.evaluate(() => {
    const handle = window.__playground!.cluster()
    const sourceFeatures = handle.source.getFeatures()
    const clusters = handle.clusterSource.getFeatures()
    let memberSum = 0
    for (const f of clusters) {
      const raw: unknown = f.get('features')
      memberSum += Array.isArray(raw) ? (raw as Feature[]).length : 0
    }
    const coords = new Set<string>()
    for (const f of sourceFeatures) {
      const [x, y] = (f.getGeometry() as Point).getCoordinates()
      coords.add(`${x},${y}`)
    }
    return { sourceCount: sourceFeatures.length, clusterCount: clusters.length, memberSum, distinct: coords.size }
  })
}

type ClickTarget = { x: number; y: number; count: number; ids: number[] }

async function findCluster(page: Page, kind: 'multi' | 'single'): Promise<ClickTarget> {
  const target = await page.evaluate(
    ({ kind: wanted, dy }) => {
      const { map, cluster } = window.__playground!
      const handle = cluster()
      const [width, height] = map.getSize()!
      const rect = document.getElementById('map')!.getBoundingClientRect()
      for (const f of handle.clusterSource.getFeatures()) {
        const raw: unknown = f.get('features')
        const members = Array.isArray(raw) ? (raw as Feature[]) : []
        if (wanted === 'multi' ? members.length < 2 : members.length !== 1) continue
        const px = map.getPixelFromCoordinate((f.getGeometry() as Point).getCoordinates())
        const cx = px[0]!
        const cy = px[1]! + dy
        if (cx < 150 || cx > width! - 150 || cy < 150 || cy > height! - 40) continue
        const hit = map.forEachFeatureAtPixel([cx, cy], (hf) => hf, { layerFilter: (l) => l === handle.layer })
        if (hit !== f) continue
        const ids = members.map((m) => m.get('id') as number).sort((a, b) => a - b)
        return { x: rect.left + cx, y: rect.top + cy, count: members.length, ids }
      }
      return null
    },
    { kind, dy: CLICK_DY },
  )
  if (!target) throw new Error(`no clickable ${kind} cluster in view`)
  return target
}

async function selectedIds(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    window
      .__playground!.cluster()
      .source.getFeatures()
      .filter((f) => f.get('selected') === true)
      .map((f) => f.get('id') as number)
      .sort((a, b) => a - b),
  )
}

async function waitViewIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => !window.__playground!.map.getView().getAnimating())
}

async function ctrlClick(page: Page, x: number, y: number): Promise<void> {
  await page.keyboard.down('Control')
  try {
    await page.mouse.click(x, y)
  } finally {
    await page.keyboard.up('Control')
  }
}

test.describe('cluster layer', () => {
  test.beforeEach(async ({ page }) => {
    await bounded('initial render', waitForRenderComplete(page))
  })

  test('renders clusters at zoom 10', async ({ page }) => {
    const s = await clusterStats(page)
    expect(s.sourceCount).toBe(300)
    expect(s.clusterCount).toBeGreaterThan(0)
    expect(s.clusterCount).toBeLessThan(300)
    expect(s.memberSum).toBe(300)
    await expect(page.locator('#cl-distance-value')).toHaveText('40')
  })

  test('splits clusters when zooming in', async ({ page }) => {
    const before = (await clusterStats(page)).clusterCount
    await bounded('zoom 13', setView(page, [37.62, 55.75], 13))
    const after = await clusterStats(page)
    expect(after.clusterCount).toBeGreaterThan(before)
    expect(after.memberSum).toBe(300)
  })

  test('distance 0 leaves one cluster per distinct coordinate', async ({ page }) => {
    await page.locator('#cl-distance').fill('0')
    await expect(page.locator('#cl-distance-value')).toHaveText('0')
    await bounded('distance 0', waitForRenderComplete(page))
    const s = await clusterStats(page)
    expect(s.clusterCount).toBe(s.distinct)
    // generatePoints repeats every 10th coordinate and OL's Cluster merges identical coordinates even at distance 0
    expect(s.distinct).toBe(270)
    expect(s.memberSum).toBe(300)
  })

  test('shows a cluster popup and hides it on an empty click', async ({ page }) => {
    const t = await findCluster(page, 'multi')
    await page.mouse.click(t.x, t.y)
    await expect(page.locator('.ol-popup')).toBeVisible()
    await expect(page.locator('.ol-popup .popup-cluster')).toHaveText(`${t.count} points`)
    await waitViewIdle(page)

    const empty = await page.evaluate(() => {
      const { map, cluster } = window.__playground!
      const handle = cluster()
      const px = map.getPixelFromCoordinate([37.2, 55.75])
      const rect = document.getElementById('map')!.getBoundingClientRect()
      const x = rect.left + px[0]!
      const y = rect.top + px[1]!
      const hit = map.forEachFeatureAtPixel(px, (f) => f, { layerFilter: (l) => l === handle.layer })
      const covered = document.elementFromPoint(x, y)?.closest('.ol-overlay-container') ?? null
      return { x, y, noHit: hit === undefined, uncovered: covered === null }
    })
    expect(empty.noHit).toBe(true)
    expect(empty.uncovered).toBe(true)
    await page.waitForTimeout(CLICK_GAP_MS)
    await page.mouse.click(empty.x, empty.y)
    await expect(page.locator('.ol-popup')).toBeHidden()
  })

  test('shows a point popup for a single-member cluster', async ({ page }) => {
    await bounded('zoom 12', setView(page, [37.62, 55.75], 12))
    const t = await findCluster(page, 'single')
    await page.mouse.click(t.x, t.y)
    await expect(page.locator('.ol-popup')).toBeVisible()
    await expect(page.locator('.ol-popup h4')).toHaveText(`Point #${t.ids[0]}`)
  })

  test('ctrl-click toggles selection of all cluster members', async ({ page }) => {
    const t = await findCluster(page, 'multi')
    expect(t.count).toBeLessThanOrEqual(100)
    await ctrlClick(page, t.x, t.y)
    await expect(page.locator('#cl-selected')).toHaveText(`${t.count} selected\n${t.ids.join(', ')}`)
    await expect(page.locator('.ol-popup')).toBeHidden()
    expect(await selectedIds(page)).toEqual(t.ids)

    await page.waitForTimeout(CLICK_GAP_MS)
    await ctrlClick(page, t.x, t.y)
    await expect(page.locator('#cl-selected')).toHaveText('0 selected')
    expect(await selectedIds(page)).toEqual([])
  })

  test('shift-drag selects the features inside the box', async ({ page }) => {
    const box = await page.evaluate(() => {
      const { map, cluster } = window.__playground!
      const rect = document.getElementById('map')!.getBoundingClientRect()
      const a = [370, 300]
      const b = [570, 500]
      const ca = map.getCoordinateFromPixel(a)
      const cb = map.getCoordinateFromPixel(b)
      const minX = Math.min(ca[0]!, cb[0]!)
      const maxX = Math.max(ca[0]!, cb[0]!)
      const minY = Math.min(ca[1]!, cb[1]!)
      const maxY = Math.max(ca[1]!, cb[1]!)
      const expected = cluster()
        .source.getFeatures()
        .filter((f) => {
          const [x, y] = (f.getGeometry() as Point).getCoordinates() as [number, number]
          return x >= minX && x <= maxX && y >= minY && y <= maxY
        })
        .map((f) => f.get('id') as number)
        .sort((p, q) => p - q)
      return {
        a: { x: rect.left + a[0]!, y: rect.top + a[1]! },
        b: { x: rect.left + b[0]!, y: rect.top + b[1]! },
        expected,
      }
    })
    expect(box.expected.length).toBeGreaterThan(0)

    await page.keyboard.down('Shift')
    try {
      await page.mouse.move(box.a.x, box.a.y)
      await page.mouse.down()
      await page.mouse.move(box.b.x, box.b.y, { steps: 10 })
      await page.mouse.up()
    } finally {
      await page.keyboard.up('Shift')
    }

    await expect.poll(async () => (await page.locator('#cl-last-change').textContent()) ?? '').not.toBe('')
    const lines = ((await page.locator('#cl-last-change').textContent()) ?? '').split('\n')
    for (const line of lines) expect(line).toMatch(/^\d+: true$/)
    const ids = lines.map((l) => Number.parseInt(l, 10)).sort((p, q) => p - q)
    expect(ids).toEqual(box.expected)
    await expect(page.locator('#cl-selected')).toHaveText(new RegExp(`^${box.expected.length} selected`))
    expect(await selectedIds(page)).toEqual(box.expected)
  })

  test('fit brings the whole source into view', async ({ page }) => {
    await bounded('move away', setView(page, [37.0, 55.0], 13))
    await page.locator('#cl-fit').click()
    await bounded('after fit', waitForRenderComplete(page))
    const r = await page.evaluate(() => {
      const { map, cluster } = window.__playground!
      const view = map.getView()
      const src = cluster().source.getExtent()
      if (!src) throw new Error('cluster source has no extent')
      return {
        view: view.calculateExtent(map.getSize()),
        src,
        zoom: view.getZoom()!,
      }
    })
    expect(r.view[0]).toBeLessThanOrEqual(r.src[0]!)
    expect(r.view[1]).toBeLessThanOrEqual(r.src[1]!)
    expect(r.view[2]).toBeGreaterThanOrEqual(r.src[2]!)
    expect(r.view[3]).toBeGreaterThanOrEqual(r.src[3]!)
    expect(r.zoom).toBeLessThanOrEqual(15)
    expect(r.zoom).not.toBe(13)
  })
})
