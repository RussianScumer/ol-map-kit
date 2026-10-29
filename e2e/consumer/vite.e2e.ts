import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { access, copyFile, cp, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { test } from '@playwright/test'
import type Feature from 'ol/Feature.js'
import type Point from 'ol/geom/Point.js'
import type OlMap from 'ol/Map.js'
import type { ClusterLayerHandle, PopupHandle } from '../../src/index'
import { CLICK_DY, expect, installNetworkStubs } from '../support/playground'
import { prepareConsumer, REPO_ROOT, run, type Consumer } from './setup'

interface ConsumerHooks {
  map: OlMap
  cluster: ClusterLayerHandle
  popup: PopupHandle
  sameOl: boolean
}

declare global {
  interface Window {
    __consumer?: ConsumerHooks
  }
}

const PORT = 5180
const ORIGIN = `http://localhost:${PORT}`
const VITE = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite')
const POINTS = 20

let consumer: Consumer | undefined
let cleanupDir: (() => Promise<void>) | undefined
let preview: ChildProcess | undefined
let previewLog = ''

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

async function assertNothingOnIpv6(): Promise<void> {
  try {
    await fetch(`http://[::1]:${PORT}/`, { signal: AbortSignal.timeout(2000) })
  } catch {
    return
  }
  throw new Error(`something already listens on [::1]:${PORT}; Chromium would hit it instead of the preview`)
}

async function startPreview(appDir: string): Promise<ChildProcess> {
  await assertNothingOnIpv6()
  const child = spawn(
    VITE,
    ['preview', appDir, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: appDir, env: { ...process.env, BROWSER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  preview = child
  const collect = (chunk: Buffer): void => {
    previewLog += chunk.toString()
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  for (let i = 0; i < 150; i++) {
    if (hasExited(child)) throw new Error('vite preview exited early\n' + previewLog)
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`)
      if (res.ok) return child
    } catch {
      // not listening yet
    }
    await sleep(200)
  }
  child.kill('SIGKILL')
  throw new Error('vite preview did not start in 30 s\n' + previewLog)
}

async function stopPreview(child: ChildProcess | undefined): Promise<void> {
  if (child === undefined || hasExited(child)) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  await Promise.race([exited, sleep(5000)])
  if (!hasExited(child)) {
    child.kill('SIGKILL')
    await exited
  }
}

test.beforeAll(async () => {
  test.setTimeout(420_000)
  consumer = await prepareConsumer((c) => {
    cleanupDir = c
  })
  const appDir = path.join(consumer.dir, 'app')
  await cp(path.join(REPO_ROOT, 'e2e', 'consumer', 'app'), appDir, { recursive: true })
  await mkdir(path.join(appDir, 'public'), { recursive: true })
  await copyFile(
    path.join(REPO_ROOT, 'playground', 'public', 'map_style_custom.min.json'),
    path.join(appDir, 'public', 'map_style_custom.min.json'),
  )
  await run(VITE, ['build', appDir], appDir)
  await access(path.join(appDir, 'dist', 'index.html'))
  await startPreview(appDir)
})

test.afterAll(async () => {
  await stopPreview(preview)
  await cleanupDir?.()
})

test('Vite-built consumer page renders the packed package', async ({ page, context }) => {
  test.setTimeout(90_000)
  expect(consumer).toBeDefined()
  expect(preview).toBeDefined()
  const net = await installNetworkStubs(context)
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto(ORIGIN + '/')
  await expect(page.locator('#status'), 'style ready; unexpected: ' + net.unexpected.join(', ')).toHaveText(
    'ready',
    { timeout: 30_000 },
  )
  await page.waitForFunction(() => window.__consumer !== undefined)

  await test.step('single ol copy', async () => {
    expect.soft(await page.evaluate(() => window.__consumer!.sameOl), 'instanceof across app and package').toBe(
      true,
    )
    const olDirs = (await readdir(path.join(consumer!.dir, 'node_modules', '.pnpm'))).filter((n) =>
      /^ol@/.test(n),
    )
    expect.soft(olDirs).toHaveLength(1)
  })

  await test.step('cluster layer renders', async () => {
    let last = { clusters: 0, memberSum: 0, hits: 0 }
    await expect
      .poll(
        async () => {
          last = await page.evaluate((dy) => {
            const { map, cluster } = window.__consumer!
            map.renderSync()
            let clusters = 0
            let memberSum = 0
            let hits = 0
            for (const f of cluster.clusterSource.getFeatures()) {
              clusters++
              const members: unknown = f.get('features')
              if (Array.isArray(members)) memberSum += (members as Feature[]).length
              const px = map.getPixelFromCoordinate((f.getGeometry() as Point).getCoordinates())
              const hit = map.forEachFeatureAtPixel([px[0]!, px[1]! + dy], (h) => h, {
                layerFilter: (l) => l === cluster.layer,
              })
              if (hit === f) hits++
            }
            return { clusters, memberSum, hits }
          }, CLICK_DY)
          return last.hits
        },
        { timeout: 10_000, message: 'no cluster hit' },
      )
      .toBeGreaterThan(0)
    expect.soft(last.memberSum).toBe(POINTS)
    expect.soft(last.clusters).toBeGreaterThanOrEqual(1)
    expect.soft(last.clusters).toBeLessThan(POINTS)
  })

  await test.step('popup uses package css', async () => {
    await page.evaluate(() =>
      window.__consumer!.popup.show('<p class="consumer-popup">consumer popup</p>', [37.62, 55.75]),
    )
    const popupEl = page.locator('.ol-popup')
    await expect.soft(popupEl).toBeVisible()
    await expect.soft(popupEl).toContainText('consumer popup')
    await expect.soft(popupEl).toHaveCSS('border-radius', '8px')
  })

  expect.soft(pageErrors).toEqual([])
  expect(net.unexpected, 'unexpected external requests').toEqual([])
})
