import { access, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { prepareConsumer, run, type Consumer } from './setup'

let consumer: Consumer | undefined
let cleanupDir: (() => Promise<void>) | undefined

const EXPECTED_EXPORTS: Record<string, string> = {
  DEFAULT_PALETTE: 'object',
  createBaseMap: 'function',
  createClusterLayer: 'function',
  createMultiRouteLayer: 'function',
  createPickMarkerLayer: 'function',
  createPopup: 'function',
  createRouteLayer: 'function',
  dashedLineStyle: 'function',
  featureAtPixel: 'function',
  fitToSource: 'function',
  labeledPinStyle: 'function',
  lineStyle: 'function',
  makePinIcon: 'function',
  markerIcon: 'function',
  paletteColor: 'function',
  parseNominatimResult: 'function',
  pinStyle: 'function',
  selectionRectStyle: 'function',
  setupSelectionRect: 'function',
}

const PROBE = `const m = await import('@korneevecin/ol-map-kit'); console.log(JSON.stringify({ exports: Object.fromEntries(Object.keys(m).sort().map((k) => [k, typeof m[k]])), main: import.meta.resolve('@korneevecin/ol-map-kit'), css: import.meta.resolve('@korneevecin/ol-map-kit/style.css') }))`

const TARBALL_ENTRY = /^package\/(dist\/.+|package\.json|README[^/]*|LICENSE)$/

test.beforeAll(async () => {
  test.setTimeout(300_000)
  consumer = await prepareConsumer((c) => {
    cleanupDir = c
  })
})

test.afterAll(async () => {
  await cleanupDir?.()
})

test('packed package installs offline and imports under Node ESM', async () => {
  test.setTimeout(60_000)
  expect(consumer).toBeDefined()
  const c = consumer!

  const out = (await run(process.execPath, ['--input-type=module', '-e', PROBE], c.dir)).stdout
  const lastLine = out.split('\n').filter((l) => l.trim() !== '').pop() ?? ''
  const probe = JSON.parse(lastLine) as { exports: Record<string, string>; main: string; css: string }
  const mainPath = fileURLToPath(probe.main)
  const cssPath = fileURLToPath(probe.css)

  await test.step('exports', () => {
    expect.soft(probe.exports).toEqual(EXPECTED_EXPORTS)
  })

  await test.step('resolution', async () => {
    const prefix = path.join(await realpath(c.dir), 'node_modules') + path.sep
    expect.soft(mainPath.startsWith(prefix)).toBe(true)
    expect.soft(cssPath.startsWith(prefix)).toBe(true)
    expect.soft(mainPath.endsWith(path.join('dist', 'ol-map-kit.js'))).toBe(true)
    expect.soft(cssPath.endsWith(path.join('dist', 'style.css'))).toBe(true)
    await expect.soft(access(cssPath)).resolves.toBeUndefined()
  })

  await test.step('tarball contents', async () => {
    const entries = (await run('tar', ['-tzf', c.tarball], c.dir)).stdout.split('\n').filter(Boolean)
    expect.soft(entries.filter((e) => !TARBALL_ENTRY.test(e))).toEqual([])
    for (const required of [
      'package/package.json',
      'package/dist/ol-map-kit.js',
      'package/dist/style.css',
      'package/dist/types/index.d.ts',
    ]) {
      expect.soft(entries, required).toContain(required)
    }
  })

  await test.step('ol stays external', async () => {
    const code = await readFile(mainPath, 'utf8')
    const specifiers = [...code.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g)].map(
      (m) => m[1] ?? m[2] ?? '',
    )
    expect.soft(specifiers.length).toBeGreaterThan(0)
    expect.soft(specifiers.some((s) => s.startsWith('ol/'))).toBe(true)
    expect.soft(specifiers.filter((s) => !/^(ol\/[\w./-]+\.js|ol-mapbox-style)$/.test(s))).toEqual([])
    expect.soft(/\bimport\s*\(/.test(code)).toBe(false)
    expect.soft(code).not.toContain('ol-viewport')
    expect.soft(code).not.toContain('ol-overlaycontainer')
  })
})
