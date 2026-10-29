import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const REPO_ROOT: string = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))

export interface Consumer {
  dir: string
  tarball: string
  cleanup: () => Promise<void>
}

export async function run(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
      encoding: 'utf8',
    })
    return { stdout, stderr }
  } catch (err) {
    const e = err as { stdout?: unknown; stderr?: unknown; message?: unknown }
    const text = (v: unknown): string => (typeof v === 'string' ? v : '')
    throw new Error(
      `Command failed: ${cmd} ${JSON.stringify(args)} (cwd ${cwd})\n` +
        `${text(e.message)}\n--- stdout ---\n${text(e.stdout)}\n--- stderr ---\n${text(e.stderr)}`,
    )
  }
}

async function installedVersion(pkg: string): Promise<string> {
  const raw = await readFile(path.join(REPO_ROOT, 'node_modules', pkg, 'package.json'), 'utf8')
  const version = (JSON.parse(raw) as { version?: unknown }).version
  if (typeof version !== 'string' || version === '') {
    throw new Error(`Cannot read installed version of ${pkg}`)
  }
  return version
}

export async function prepareConsumer(): Promise<Consumer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ol-map-kit-consumer-'))
  const cleanup = (): Promise<void> => rm(dir, { recursive: true, force: true })
  try {
    const olVersion = await installedVersion('ol')
    const omsVersion = await installedVersion('ol-mapbox-style')

    const storePath = (await run('pnpm', ['store', 'path'], REPO_ROOT)).stdout.trim()
    const storeDir = storePath.replace(/[\\/]v\d+$/, '')

    await run('pnpm', ['pack', '--pack-destination', dir], REPO_ROOT)
    const tgz = (await readdir(dir)).filter((f) => f.endsWith('.tgz'))
    if (tgz.length !== 1) {
      throw new Error(`Expected exactly one .tgz in ${dir}, found: ${JSON.stringify(tgz)}`)
    }
    const [tgzName] = tgz
    if (tgzName === undefined) throw new Error('unreachable')
    const tarball = path.join(dir, tgzName)

    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'ol-map-kit-consumer', private: true, type: 'module' }, null, 2) + '\n',
    )

    await run(
      'pnpm',
      ['add', tarball, `ol@${olVersion}`, `ol-mapbox-style@${omsVersion}`, '--offline', '--store-dir', storeDir],
      dir,
    )

    return { dir, tarball, cleanup }
  } catch (err) {
    await cleanup()
    throw err
  }
}
