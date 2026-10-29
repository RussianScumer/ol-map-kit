import { readFile } from 'node:fs/promises'
import { test as base, expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
// Type-only: brings `PlaygroundHooks` and the `Window.__playground` augmentation into this program.
import type { PlaygroundHooks } from '../../playground/hooks'

export { expect }

type NetLog = { requests: string[]; unexpected: string[] }
type Stub = { contentType: string; body: Buffer | string }
type Files = { tileJson: Buffer; sprite: Buffer; png: Buffer; nominatim: Buffer }

const fixture = (name: string): Promise<Buffer> => readFile(new URL(`../fixtures/${name}`, import.meta.url))

function isLocal(url: URL): boolean {
  return url.protocol === 'http:' && url.hostname === 'localhost'
}

function stubFor(url: URL, files: Files): Stub | undefined {
  const { hostname, pathname } = url
  if (hostname === 'tiles.openfreemap.org') {
    if (pathname === '/planet') return { contentType: 'application/json', body: files.tileJson }
    if (/^\/planet\/\d+\/\d+\/\d+\.pbf$/.test(pathname)) return { contentType: 'application/x-protobuf', body: '' }
    if (pathname.startsWith('/natural_earth/') && pathname.endsWith('.png')) {
      return { contentType: 'image/png', body: files.png }
    }
    if (pathname.startsWith('/sprites/') && pathname.endsWith('.json')) {
      return { contentType: 'application/json', body: files.sprite }
    }
    if (pathname.startsWith('/sprites/') && pathname.endsWith('.png')) {
      return { contentType: 'image/png', body: files.png }
    }
    if (pathname.startsWith('/fonts/')) return { contentType: 'application/x-protobuf', body: '' }
  }
  if (hostname === 'cdn.jsdelivr.net' && pathname.startsWith('/npm/@fontsource/')) {
    return { contentType: 'text/css', body: '' }
  }
  if (hostname === 'nominatim.openstreetmap.org' && pathname === '/reverse') {
    return { contentType: 'application/json', body: files.nominatim }
  }
  return undefined
}

export async function installNetworkStubs(context: BrowserContext): Promise<NetLog> {
  const [tileJson, sprite, png, nominatim] = await Promise.all([
    fixture('tilejson-planet.json'),
    fixture('sprite.json'),
    fixture('tile.png'),
    fixture('nominatim-reverse.json'),
  ])
  const files: Files = { tileJson, sprite, png, nominatim }
  const net: NetLog = { requests: [], unexpected: [] }
  const headers = { 'access-control-allow-origin': '*' }
  await context.route(
    (url) => !isLocal(url),
    async (route) => {
      const href = route.request().url()
      net.requests.push(href)
      const stub = stubFor(new URL(href), files)
      if (stub) {
        await route.fulfill({ status: 200, contentType: stub.contentType, body: stub.body, headers })
        return
      }
      net.unexpected.push(href)
      await route.fulfill({ status: 404, contentType: 'text/plain', body: '', headers })
    },
  )
  return net
}

export const test = base.extend<{ net: NetLog }>({
  net: [
    async ({ context }, use) => {
      const net = await installNetworkStubs(context)
      await use(net)
      expect(net.unexpected, 'unexpected external requests').toEqual([])
    },
    { auto: true },
  ],
  page: async ({ page, net }, use, testInfo) => {
    testInfo.setTimeout(testInfo.timeout + 30_000)
    await page.goto('/')
    await expect(page.locator('#status'), `status; unexpected requests: ${net.unexpected.join(', ')}`).toHaveText(
      'Style loaded',
      { timeout: 30_000 },
    )
    await page.waitForFunction(() => window.__playground !== undefined)
    await use(page)
  },
})

export async function waitForRenderComplete(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const map = window.__playground!.map
        map.once('rendercomplete', () => resolve())
        map.render()
      }),
  )
}

export async function pixelOf(page: Page, lngLat: [number, number]): Promise<{ x: number; y: number }> {
  return page.evaluate((coord) => {
    const hooks: PlaygroundHooks = window.__playground!
    const px = hooks.map.getPixelFromCoordinate(coord)
    const x = px?.[0]
    const y = px?.[1]
    if (x === undefined || y === undefined) throw new Error('pixelOf: map not rendered')
    const box = document.getElementById('map')!.getBoundingClientRect()
    return { x: box.left + x, y: box.top + y }
  }, lngLat)
}

export async function setView(page: Page, center: [number, number], zoom: number): Promise<void> {
  await page.evaluate(
    ({ c, z }) => {
      const view = window.__playground!.map.getView()
      view.cancelAnimations()
      view.setCenter(c)
      view.setZoom(z)
    },
    { c: center, z: zoom },
  )
  await waitForRenderComplete(page)
}
