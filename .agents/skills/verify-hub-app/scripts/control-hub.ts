#!/usr/bin/env node
import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

interface InstanceMetadata {
  runId: string
  pid: number
  procStartTime: string | null
  port: number
  url: string
  repoRoot: string
  commit: string
  scratchDir: string
  startedAt: string
}

type JourneyName = 'all' | 'modes' | 'search' | 'stage' | 'practice' | 'layout'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')

function getHeadCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

function scratchDirFor(runId: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) {
    throw new Error(`Invalid --run-id '${runId}'. Use ASCII letters, digits, '.', '_', or '-'.`)
  }
  return path.join(os.tmpdir(), `hub-verify-${runId}`)
}

function ensureOwnedScratchDir(scratchDir: string): void {
  try {
    fs.mkdirSync(scratchDir, { mode: 0o700 })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
  }
  const stat = fs.lstatSync(scratchDir)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Scratch path '${scratchDir}' is not a real directory.`)
  }
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
    throw new Error(`Scratch directory '${scratchDir}' is not owned by the current user.`)
  }
  if ((stat.mode & 0o077) !== 0) {
    throw new Error(`Scratch directory '${scratchDir}' has group/other permissions (${(stat.mode & 0o777).toString(8)}); refusing shared access.`)
  }
}

function openLogFileNoFollow(logPath: string): number {
  const noFollow = fs.constants.O_NOFOLLOW ?? 0
  return fs.openSync(logPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | noFollow, 0o600)
}

function instancePathFor(runId: string): string {
  return path.join(scratchDirFor(runId), 'instance.json')
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readProcStartTime(pid: number): string | null {
  const statPath = `/proc/${pid}/stat`
  try {
    const raw = fs.readFileSync(statPath, 'utf8')
    const closeParen = raw.lastIndexOf(')')
    if (closeParen < 0) return null
    const fields = raw.slice(closeParen + 2).trim().split(/\s+/)
    return fields[19] ?? null // Field 22 (1-based) in /proc/<pid>/stat is starttime
  } catch {
    return null
  }
}

function matchesProcessIdentity(pid: number, expectedStartTime: string | null | undefined, expectedCmdToken?: string): boolean {
  if (!isPidAlive(pid)) return false
  if (fs.existsSync('/proc')) {
    if (!expectedStartTime) return false
    const actualStart = readProcStartTime(pid)
    if (!actualStart || actualStart !== expectedStartTime) return false
    if (expectedCmdToken) {
      try {
        const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ')
        if (!cmdline.includes(expectedCmdToken)) return false
      } catch {
        return false
      }
    }
  }
  return true
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function findChromiumBinary(): string {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter((item): item is string => Boolean(item))

  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin
  }

  const pwCache = path.join(os.homedir(), '.cache', 'ms-playwright')
  if (fs.existsSync(pwCache)) {
    for (const entry of fs.readdirSync(pwCache).sort().reverse()) {
      for (const rel of [
        'chrome-linux64/chrome',
        'chrome-linux/chrome',
        'chrome-headless-shell-linux64/chrome-headless-shell',
      ]) {
        const candidate = path.join(pwCache, entry, rel)
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }
  throw new Error('No Chromium/Chrome binary found. Set CHROME_BIN or install chromium-browser.')
}

async function checkServerReady(url: string, timeoutMs = 3_000): Promise<{ ok: boolean; reason?: string }> {
  const boundedMs = Math.max(150, timeoutMs)
  try {
    const rootSignal = AbortSignal.timeout(boundedMs)
    const rootRes = await fetch(`${url}/`, { signal: rootSignal })
    if (!rootRes.ok) return { ok: false, reason: `GET / returned HTTP ${rootRes.status}` }
    const html = await rootRes.text()
    if (!html.includes('id="app"') || !html.includes('/src/entry.ts')) {
      return { ok: false, reason: 'GET / HTML does not match HPC4 Hub index.html' }
    }
    const modSignal = AbortSignal.timeout(boundedMs)
    const modRes = await fetch(`${url}/src/catalog.ts`, { signal: modSignal })
    if (!modRes.ok) return { ok: false, reason: `GET /src/catalog.ts returned HTTP ${modRes.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

async function cmdLaunch(runId: string, preferredPort?: number): Promise<void> {
  if (preferredPort !== undefined && (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535)) {
    throw new Error(`Invalid --port '${preferredPort}'. Expected integer 1..65535.`)
  }
  const scratchDir = scratchDirFor(runId)
  ensureOwnedScratchDir(scratchDir)
  const instFile = instancePathFor(runId)
  if (fs.existsSync(instFile)) {
    const existing = JSON.parse(fs.readFileSync(instFile, 'utf8')) as InstanceMetadata
    if (matchesProcessIdentity(existing.pid, existing.procStartTime, 'vite')) {
      throw new Error(
        `Run '${runId}' is already active (PID ${existing.pid} at ${existing.url}). Run cleanup first or pick a fresh --run-id.`,
      )
    }
  }

  const commit = getHeadCommit()
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite')
  if (!fs.existsSync(viteBin)) {
    execFileSync('npm', ['ci'], { cwd: REPO_ROOT, stdio: 'inherit' })
  }

  const logPath = path.join(scratchDir, 'vite.log')
  const logFd = openLogFileNoFollow(logPath)
  const viteArgs = ['--host', '127.0.0.1', '--port', String(preferredPort ?? 0)]
  if (preferredPort !== undefined) viteArgs.push('--strictPort')

  let spawnErr: Error | undefined
  let child: ChildProcess | undefined
  try {
    child = spawn(viteBin, viteArgs, {
      cwd: REPO_ROOT,
      detached: true,
      stdio: ['ignore', logFd, logFd],
    })
  } finally {
    fs.closeSync(logFd)
  }
  child.on('error', err => {
    spawnErr = err
  })
  child.unref()

  const childPid = child.pid
  if (!childPid) {
    throw spawnErr ?? new Error('Failed to spawn Vite dev server')
  }
  const procStartTime = readProcStartTime(childPid)

  try {
    const deadline = Date.now() + 15_000
    let lastReason = 'waiting for Vite Local URL banner'
    let boundPort: number | undefined

    while (Date.now() < deadline) {
      if (spawnErr) throw spawnErr
      if (!matchesProcessIdentity(childPid, procStartTime, 'vite')) {
        const logTail = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''
        throw new Error(`Vite exited prematurely (PID ${childPid}). Log:\n${logTail}`)
      }
      if (boundPort === undefined && fs.existsSync(logPath)) {
        const logText = fs.readFileSync(logPath, 'utf8').replace(/\x1b\[[0-9;]*m/g, '')
        const match = logText.match(/Local:\s+http:\/\/127\.0\.0\.1:(\d+)\//)
        if (match) {
          boundPort = Number(match[1])
          if (preferredPort !== undefined && boundPort !== preferredPort) {
            throw new Error(`Vite bound port ${boundPort} instead of requested ${preferredPort}`)
          }
        }
      }
      if (boundPort !== undefined) {
        const url = `http://127.0.0.1:${boundPort}`
        const remainingMs = deadline - Date.now()
        if (remainingMs <= 0) break
        const ready = await checkServerReady(url, Math.min(2_500, remainingMs))
        if (ready.ok && matchesProcessIdentity(childPid, procStartTime, 'vite')) {
          const meta: InstanceMetadata = {
            runId,
            pid: childPid,
            procStartTime,
            port: boundPort,
            url,
            repoRoot: REPO_ROOT,
            commit,
            scratchDir,
            startedAt: new Date().toISOString(),
          }
          fs.writeFileSync(instFile, `${JSON.stringify(meta, null, 2)}\n`, { mode: 0o600 })
          process.stdout.write(`${JSON.stringify({ status: 'ready', ...meta }, null, 2)}\n`)
          return
        }
        lastReason = ready.reason ?? 'not ready'
      }
      await sleep(120)
    }

    throw new Error(`Timed out waiting for Vite (PID ${childPid}): ${lastReason}`)
  } catch (err) {
    await terminatePidTree(childPid, procStartTime, 'vite')
    fs.rmSync(instFile, { force: true })
    throw err
  }
}

async function runDoctorCheck(runId: string): Promise<InstanceMetadata> {
  const scratchDir = scratchDirFor(runId)
  ensureOwnedScratchDir(scratchDir)
  const instFile = instancePathFor(runId)
  if (!fs.existsSync(instFile)) {
    throw new Error(`No instance metadata at ${instFile}. Did you run 'launch --run-id ${runId}'?`)
  }
  const meta = JSON.parse(fs.readFileSync(instFile, 'utf8')) as InstanceMetadata
  if (meta.repoRoot !== REPO_ROOT) {
    throw new Error(`Instance repoRoot mismatch: ${meta.repoRoot} !== ${REPO_ROOT}`)
  }
  const headCommit = getHeadCommit()
  if (meta.commit !== headCommit) {
    throw new Error(
      `Instance commit mismatch: server started at ${meta.commit}, current HEAD is ${headCommit}. Run cleanup and launch again.`,
    )
  }
  if (!Number.isInteger(meta.port) || meta.port < 1 || meta.port > 65535) {
    throw new Error(`Invalid port '${String(meta.port)}' in instance metadata`)
  }
  const canonicalUrl = `http://127.0.0.1:${meta.port}`
  if (meta.url !== canonicalUrl) {
    throw new Error(`Instance URL '${meta.url}' does not match loopback '${canonicalUrl}'`)
  }
  if (!matchesProcessIdentity(meta.pid, meta.procStartTime, 'vite')) {
    throw new Error(`Recorded Vite PID ${meta.pid} is no longer alive or no longer matches launched process identity`)
  }
  const ready = await checkServerReady(canonicalUrl, 3_000)
  if (!ready.ok) {
    throw new Error(`HTTP readiness failed at ${canonicalUrl}: ${ready.reason}`)
  }
  return { ...meta, url: canonicalUrl }
}

async function cmdDoctor(runId: string): Promise<void> {
  const meta = await runDoctorCheck(runId)
  process.stdout.write(`${JSON.stringify({ status: 'healthy', ...meta }, null, 2)}\n`)
}

async function terminatePidTree(
  pid: number,
  expectedStartTime: string | null | undefined,
  expectedCmdToken?: string,
): Promise<boolean> {
  if (!matchesProcessIdentity(pid, expectedStartTime, expectedCmdToken)) return false
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      return !matchesProcessIdentity(pid, expectedStartTime, expectedCmdToken)
    }
  }
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline && matchesProcessIdentity(pid, expectedStartTime, expectedCmdToken)) {
    await sleep(80)
  }
  if (matchesProcessIdentity(pid, expectedStartTime, expectedCmdToken)) {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        // already exited
      }
    }
    const killDeadline = Date.now() + 1_500
    while (Date.now() < killDeadline && matchesProcessIdentity(pid, expectedStartTime, expectedCmdToken)) {
      await sleep(50)
    }
  }
  if (matchesProcessIdentity(pid, expectedStartTime, expectedCmdToken)) {
    throw new Error(`Failed to terminate owned process PID ${pid}`)
  }
  return true
}

async function cmdCleanup(runId: string): Promise<void> {
  const scratchDir = scratchDirFor(runId)
  if (fs.existsSync(scratchDir)) {
    ensureOwnedScratchDir(scratchDir)
  }
  const instFile = instancePathFor(runId)
  let stoppedPid: number | null = null
  if (fs.existsSync(instFile)) {
    const meta = JSON.parse(fs.readFileSync(instFile, 'utf8')) as InstanceMetadata
    const signalled = await terminatePidTree(meta.pid, meta.procStartTime, 'vite')
    if (signalled) stoppedPid = meta.pid
  }
  fs.rmSync(scratchDir, { recursive: true, force: true })
  process.stdout.write(
    `${JSON.stringify({ status: 'cleaned', runId, stoppedPid, scratchRemoved: !fs.existsSync(scratchDir) }, null, 2)}\n`,
  )
}

class CdpSession {
  private ws: WebSocket
  private nextId = 1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }>()

  private constructor(ws: WebSocket) {
    this.ws = ws
    const rejectAllPending = (reason: string) => {
      for (const [, entry] of this.pending) {
        clearTimeout(entry.timer)
        entry.reject(new Error(reason))
      }
      this.pending.clear()
    }
    ws.addEventListener('message', event => {
      const msg = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message: string } }
      if (msg.id !== undefined) {
        const entry = this.pending.get(msg.id)
        if (!entry) return
        this.pending.delete(msg.id)
        clearTimeout(entry.timer)
        if (msg.error) entry.reject(new Error(msg.error.message))
        else entry.resolve(msg.result)
      }
    })
    ws.addEventListener('close', () => rejectAllPending('CDP WebSocket closed before command settled'))
    ws.addEventListener('error', () => rejectAllPending('CDP WebSocket encountered an error'))
  }

  static async connect(wsUrl: string): Promise<CdpSession> {
    const ws = new WebSocket(wsUrl)
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true })
      ws.addEventListener('error', () => reject(new Error(`WebSocket error connecting to ${wsUrl}`)), { once: true })
    })
    return new CdpSession(ws)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async send<T = any>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`CDP WebSocket is not open (method: ${method})`)
    }
    const id = this.nextId++
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP command '${method}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async evalJson<T = any>(expression: string): Promise<T> {
    const res = await this.send<{
      result: { value?: T; description?: string }
      exceptionDetails?: { text: string; exception?: { description?: string } }
    }>('Runtime.evaluate', {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    }
    return res.result.value as T
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitFor<T = any>(predicateExpr: string, timeoutMs = 8_000): Promise<T> {
    const deadline = Date.now() + timeoutMs
    let lastErr: unknown
    while (Date.now() < deadline) {
      try {
        const val = await this.evalJson<T>(`return (${predicateExpr})`)
        if (val) return val
      } catch (err) {
        lastErr = err
      }
      await sleep(90)
    }
    throw new Error(`Timed out waiting for (${predicateExpr})${lastErr ? `: ${String(lastErr)}` : ''}`)
  }

  async screenshot(outFile: string): Promise<void> {
    const { data } = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(outFile, Buffer.from(data, 'base64'))
  }

  close(): void {
    this.ws.close()
  }
}

function resolveEffectiveRealPath(targetPath: string): string {
  const abs = path.resolve(targetPath)
  const tailSegments: string[] = []
  let cursor = abs
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    tailSegments.unshift(path.basename(cursor))
    cursor = parent
  }
  const realBase = fs.realpathSync(cursor)
  return path.join(realBase, ...tailSegments)
}

async function withHeadlessPage<T>(scratchDir: string, fn: (cdp: CdpSession) => Promise<T>): Promise<T> {
  const chromeBin = findChromiumBinary()
  const profileDir = path.join(scratchDir, `chrome-profile-${Date.now()}`)
  fs.mkdirSync(profileDir, { mode: 0o700 })

  let child: ChildProcess | undefined
  let chromeStartTime: string | null = null
  try {
    let stderrBuf = ''
    let spawnError: Error | undefined
    child = spawn(
      chromeBin,
      [
        '--headless',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1280,860',
        `--user-data-dir=${profileDir}`,
        '--remote-debugging-port=0',
        'about:blank',
      ],
      {
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )
    if (child.pid) chromeStartTime = readProcStartTime(child.pid)

    const wsEndpoint = await new Promise<string>((resolve, reject) => {
      child!.once('error', err => {
        spawnError = err
        clearTimeout(timer)
        reject(err)
      })
      const timer = setTimeout(
        () => reject(spawnError ?? new Error(`Timed out starting Chromium (${chromeBin}): ${stderrBuf}`)),
        12_000,
      )
      child!.stderr!.on('data', chunk => {
        stderrBuf += String(chunk)
        const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/)
        if (match) {
          clearTimeout(timer)
          resolve(match[1]!)
        }
      })
      child!.once('exit', code => {
        clearTimeout(timer)
        reject(spawnError ?? new Error(`Chromium exited prematurely with code ${String(code)}: ${stderrBuf}`))
      })
    })

    const httpPort = new URL(wsEndpoint).port
    const targets = (await (
      await fetch(`http://127.0.0.1:${httpPort}/json/list`, { signal: AbortSignal.timeout(5_000) })
    ).json()) as Array<{
      type: string
      webSocketDebuggerUrl: string
    }>
    const pageTarget = targets.find(t => t.type === 'page')
    if (!pageTarget) throw new Error('No CDP page target found in headless Chromium')

    const cdp = await CdpSession.connect(pageTarget.webSocketDebuggerUrl)
    try {
      await cdp.send('Page.enable')
      await cdp.send('Runtime.enable')
      await cdp.send('DOM.enable')
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 860,
        deviceScaleFactor: 1,
        mobile: false,
      })
      return await fn(cdp)
    } finally {
      cdp.close()
    }
  } finally {
    if (child?.pid) await terminatePidTree(child.pid, chromeStartTime)
    fs.rmSync(profileDir, { recursive: true, force: true })
  }
}

async function cmdDrive(runId: string, evidenceDir: string, journey: JourneyName): Promise<void> {
  const meta = await runDoctorCheck(runId)
  const resolvedScratch = fs.realpathSync(meta.scratchDir)
  const resolvedEvidenceReal = resolveEffectiveRealPath(evidenceDir)
  if (resolvedEvidenceReal === resolvedScratch || resolvedEvidenceReal.startsWith(`${resolvedScratch}${path.sep}`)) {
    throw new Error(
      `--evidence-dir (${resolvedEvidenceReal}) must live outside the scratch dir (${resolvedScratch}) so cleanup preserves proof artifacts.`,
    )
  }
  const resolvedEvidence = path.resolve(evidenceDir)
  fs.mkdirSync(resolvedEvidence, { recursive: true })
  const createdEvidenceReal = fs.realpathSync(resolvedEvidence)
  if (createdEvidenceReal === resolvedScratch || createdEvidenceReal.startsWith(`${resolvedScratch}${path.sep}`)) {
    throw new Error(`Resolved --evidence-dir (${createdEvidenceReal}) points inside scratch (${resolvedScratch}).`)
  }

  const summary: Record<string, unknown> = {
    runId,
    url: meta.url,
    commit: meta.commit,
    journey,
    capturedAt: new Date().toISOString(),
    checks: {},
    artifacts: [] as string[],
  }
  const checks = summary.checks as Record<string, unknown>
  const artifacts = summary.artifacts as string[]
  const recordArtifact = (filename: string): string => {
    const full = path.join(resolvedEvidence, filename)
    artifacts.push(full)
    return full
  }

  await withHeadlessPage(meta.scratchDir, async cdp => {
    await cdp.send('Page.navigate', { url: `${meta.url}/#atlas` })
    await cdp.waitFor(`document.querySelector('#page-title')?.textContent?.includes('Concept & scenario atlas')`)

    if (journey === 'all' || journey === 'modes') {
      const modeLog: Array<{ mode: string; hash: string; heading: string; ariaCurrent: boolean }> = []
      for (const mode of ['learn', 'practice', 'weeks', 'atlas'] as const) {
        await cdp.evalJson(`document.querySelector('.top-modes [data-mode="${mode}"]').click()`)
        await cdp.waitFor(`location.hash === '#${mode}' && document.querySelector('.top-modes [data-mode="${mode}"]')?.getAttribute('aria-current') === 'location'`)
        if (mode !== 'atlas') {
          await cdp.waitFor(`!document.getElementById('platform-view').hidden && document.getElementById('platform-view').textContent !== 'Loading…'`)
        }
        const snap = await cdp.evalJson<{ hash: string; heading: string; ariaCurrent: boolean }>(`
          return {
            hash: location.hash,
            heading: document.getElementById('page-title').textContent.trim(),
            ariaCurrent: document.querySelector('.top-modes [data-mode="${mode}"]').getAttribute('aria-current') === 'location',
          }
        `)
        modeLog.push({ mode, ...snap })
      }

      // Explore Cluster -> Open anatomy (#a30) -> Explode + Cross-socket -> Reset view -> Think Back
      await cdp.evalJson(`document.querySelector('[data-browse-scene="cluster"]').click()`)
      await cdp.waitFor(`location.hash === '#cluster' && !document.getElementById('workbench').hidden`)
      await cdp.evalJson(`document.querySelector('[data-browse-scene="a30"]').click()`)
      await cdp.waitFor(`location.hash === '#a30' && !document.getElementById('node-view').hidden`)
      await cdp.evalJson(`document.getElementById('explode-button').click(); document.getElementById('remote-button').click();`)
      const a30Changed = await cdp.evalJson<{ exploded: boolean; remote: boolean; backLabel: string }>(`
        return {
          exploded: document.getElementById('explode-button').getAttribute('aria-pressed') === 'true',
          remote: document.getElementById('remote-button').getAttribute('aria-pressed') === 'true',
          backLabel: document.getElementById('think-back-label').textContent.trim(),
        }
      `)
      if (!a30Changed.exploded || !a30Changed.remote) {
        throw new Error('A30 Explode or Cross-socket toggle did not update aria-pressed')
      }
      await cdp.screenshot(recordArtifact('01-a30-cutaway-exploded.png'))
      await cdp.evalJson(`document.getElementById('reset-button').click()`)
      const a30Reset = await cdp.evalJson<{ exploded: boolean; local: boolean }>(`
        return {
          exploded: document.getElementById('explode-button').getAttribute('aria-pressed') === 'true',
          local: document.getElementById('local-button').getAttribute('aria-pressed') === 'true',
        }
      `)
      if (a30Reset.exploded || !a30Reset.local) {
        throw new Error('A30 Reset view failed to restore local un-exploded state')
      }
      await cdp.evalJson(`document.getElementById('think-back').click()`)
      await cdp.waitFor(`location.hash === '#cluster'`)

      checks.modesAndExplore = { modeLog, a30Changed, a30Reset, returnedTo: '#cluster' }
    }

    if (journey === 'all' || journey === 'search') {
      await cdp.evalJson(`
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }))
      `)
      await cdp.waitFor(`document.getElementById('switcher')?.open === true`)
      await cdp.evalJson(`
        const input = document.getElementById('switch-input');
        input.value = 'streams';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      `)
      const searchSnap = await cdp.evalJson<{ hrefs: string[]; countText: string }>(`
        const hrefs = [...document.querySelectorAll('#switch-list [role="option"]')].map(a => a.getAttribute('href'));
        return { hrefs, countText: document.getElementById('switch-count').textContent.trim() };
      `)
      for (const expected of ['#lesson/streams', '#practice/3', '#atlas/concept/standard-streams']) {
        if (!searchSnap.hrefs.includes(expected)) {
          throw new Error(`Search for 'streams' missing '${expected}'; got ${JSON.stringify(searchSnap.hrefs)}`)
        }
      }
      if (searchSnap.hrefs.some(href => href.includes('planned'))) {
        throw new Error(`Search exposed planned route: ${JSON.stringify(searchSnap.hrefs)}`)
      }
      await cdp.screenshot(recordArtifact('02-quick-switcher-streams.png'))
      await cdp.evalJson(`
        document.getElementById('switcher').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      `)
      await cdp.waitFor(`document.getElementById('switcher')?.open === false`)
      checks.quickSwitcher = searchSnap
    }

    if (journey === 'all' || journey === 'stage') {
      await cdp.send('Page.navigate', { url: `${meta.url}/#lesson/host-to-gpu` })
      await cdp.waitFor(`document.querySelector('.stage-workbench[data-scenario="host-to-gpu"]') !== null`)

      await cdp.evalJson(`document.querySelector('[data-stage-next]').click(); document.querySelector('[data-stage-next]').click();`)
      await cdp.waitFor(`document.querySelectorAll('.stage-step-btn')[2]?.getAttribute('aria-current') === 'step'`)
      await cdp.evalJson(`document.querySelector('[data-stage-variant="remote"]').click()`)

      await cdp.evalJson(`document.querySelector('[data-stage-play]').click()`)
      await cdp.waitFor(`document.querySelector('[data-stage-play]')?.getAttribute('aria-pressed') === 'true'`)
      await cdp.evalJson(`document.querySelector('[data-stage-inspect]').click()`)
      await cdp.waitFor(`document.querySelector('[data-stage-inspect]')?.getAttribute('aria-pressed') === 'true' && document.querySelector('[data-stage-play]')?.getAttribute('aria-pressed') === 'false'`)
      await cdp.screenshot(recordArtifact('03-stage-host-to-gpu-inspect.png'))

      await cdp.evalJson(`
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      `)
      const afterEscape = await cdp.evalJson<{ inspecting: boolean; autoplayRestored: boolean; stepIdx: number }>(`
        const steps = [...document.querySelectorAll('.stage-step-btn')];
        return {
          inspecting: document.querySelector('[data-stage-inspect]').getAttribute('aria-pressed') === 'true',
          autoplayRestored: document.querySelector('[data-stage-play]').getAttribute('aria-pressed') === 'true',
          stepIdx: steps.findIndex(b => b.getAttribute('aria-current') === 'step'),
        };
      `)
      if (afterEscape.inspecting || !afterEscape.autoplayRestored || afterEscape.stepIdx !== 2) {
        throw new Error(`Stage Inspect Escape failed invariant: ${JSON.stringify(afterEscape)}`)
      }
      await cdp.evalJson(`document.querySelector('[data-stage-play]').click()`)

      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
      await cdp.evalJson(`document.querySelector('[data-stage-next]').click()`)
      const reducedSnap = await cdp.evalJson<{ stepIdx: number; fillTransform: string; savedStorage: string | null }>(`
        const steps = [...document.querySelectorAll('.stage-step-btn')];
        const idx = steps.findIndex(b => b.getAttribute('aria-current') === 'step');
        const fill = steps[idx].querySelector('.stage-step-fill').style.transform;
        return { stepIdx: idx, fillTransform: fill, savedStorage: localStorage.getItem('hpc4:learning:v1') };
      `)
      if (reducedSnap.fillTransform !== 'scaleX(1)') {
        throw new Error(`Reduced motion did not settle immediately to scaleX(1): got '${reducedSnap.fillTransform}'`)
      }
      if (!reducedSnap.savedStorage) {
        throw new Error('Expected hpc4:learning:v1 bookmark in localStorage, got null')
      }
      const parsedBookmark = JSON.parse(reducedSnap.savedStorage) as {
        last?: string
        lessons?: Record<string, { beat?: number; total?: number; completed?: boolean }>
      }
      if (parsedBookmark.last !== 'host-to-gpu' || parsedBookmark.lessons?.['host-to-gpu']?.beat !== 3) {
        throw new Error(`Unexpected hpc4:learning:v1 bookmark payload: ${reducedSnap.savedStorage}`)
      }
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
      })

      // Navigate to #atlas, perform a full page reload to drop in-memory state, and verify #resume-slot restores lesson + step
      await cdp.evalJson(`document.querySelector('[data-route="#atlas"]').click()`)
      await cdp.waitFor(`location.hash === '#atlas' && !document.getElementById('resume-slot')?.hidden`)
      await cdp.evalJson(`window.__beforeReload = true`)
      await cdp.send('Page.reload', { ignoreCache: false })
      await cdp.waitFor(
        `!window.__beforeReload && location.hash === '#atlas' && document.querySelector('#resume-slot .resume-card') !== null && !document.getElementById('resume-slot').hidden`,
      )
      const resumeSlotText = await cdp.evalJson<string>(`return document.getElementById('resume-slot').textContent.replace(/\\s+/g, ' ').trim()`)
      await cdp.evalJson(`document.querySelector('#resume-slot .resume-card').click()`)
      await cdp.waitFor(
        `location.hash === '#lesson/host-to-gpu' && document.querySelectorAll('.stage-step-btn')[3]?.getAttribute('aria-current') === 'step'`,
      )
      const resumedStepIdx = await cdp.evalJson<number>(
        `return [...document.querySelectorAll('.stage-step-btn')].findIndex(b => b.getAttribute('aria-current') === 'step')`,
      )
      if (resumedStepIdx !== 3) {
        throw new Error(`Expected #resume-slot to restore stepIdx 3, got ${resumedStepIdx}`)
      }

      checks.stageScenario = { afterEscape, reducedSnap, resumeSlotText, resumedStepIdx }
    }

    if (journey === 'all' || journey === 'practice') {
      await cdp.send('Page.navigate', { url: `${meta.url}/#practice/1` })
      await cdp.waitFor(`document.querySelector('input[name="command"]') !== null`)
      for (const cmd of ['ls -a', 'cat .vault/.access_key']) {
        await cdp.evalJson(`
          const input = document.querySelector('input[name="command"]');
          input.value = ${JSON.stringify(cmd)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.closest('form').requestSubmit();
        `)
      }
      await cdp.waitFor(`document.querySelector('[data-outcome]')?.textContent?.includes('Mission complete')`)
      await cdp.screenshot(recordArtifact('04-practice-mission1-complete.png'))
      const practiceProof = await cdp.evalJson<{ outcome: string; stored: string | null }>(`
        return {
          outcome: document.querySelector('[data-outcome]').textContent.trim(),
          stored: localStorage.getItem('hpc4-hub.practice.act1'),
        };
      `)
      if (!practiceProof.stored) {
        throw new Error('Expected hpc4-hub.practice.act1 in localStorage after completing Mission 01, got null')
      }
      const parsedPractice = JSON.parse(practiceProof.stored) as { completed?: number[]; cards?: string[] }
      if (!parsedPractice.completed?.includes(1) || !parsedPractice.cards?.includes('dotfiles')) {
        throw new Error(`Unexpected hpc4-hub.practice.act1 payload: ${practiceProof.stored}`)
      }

      // Navigate to #atlas/concept/dotfiles and reload the page so Practiced ✓ must come from persisted storage rather than an in-memory PracticeDesk
      await cdp.send('Page.navigate', { url: `${meta.url}/#atlas/concept/dotfiles` })
      await cdp.waitFor(`location.hash === '#atlas/concept/dotfiles' && document.querySelector('.concept-sheet') !== null`)
      await cdp.evalJson(`window.__beforeReload = true`)
      await cdp.send('Page.reload', { ignoreCache: false })
      await cdp.waitFor(`!window.__beforeReload && document.querySelector('.concept-sheet .status-pill.is-done')?.textContent?.includes('Practiced') === true`)
      const conceptPracticed = await cdp.evalJson<boolean>(
        `return document.querySelector('.concept-sheet .status-pill.is-done')?.textContent?.includes('Practiced') === true`,
      )
      if (!conceptPracticed) {
        throw new Error('Awarded card dotfiles did not display Practiced pill after reloading #atlas/concept/dotfiles')
      }
      checks.practiceWorkstation = { ...practiceProof, conceptPracticed }
    }

    if (journey === 'all' || journey === 'layout') {
      const widths = [320, 390, 768, 1152, 1440] as const
      const routes = ['#atlas', '#a30', '#lesson/host-to-gpu', '#practice/1'] as const
      const layoutMatrix: Array<{ route: string; width: number; scrollWidth: number; innerWidth: number; overflowPx: number }> = []

      for (const route of routes) {
        await cdp.send('Page.navigate', { url: `${meta.url}/${route}` })
        if (route.startsWith('#lesson/')) {
          await cdp.waitFor(`document.querySelector('.stage-workbench') !== null`)
        } else if (route.startsWith('#practice/')) {
          await cdp.waitFor(`document.querySelector('.terminal-form') !== null`)
        } else {
          await cdp.waitFor(`document.getElementById('page-title')?.textContent?.length > 0`)
        }

        for (const width of widths) {
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width,
            height: 860,
            deviceScaleFactor: 1,
            mobile: width < 768,
          })
          await sleep(80)
          const metrics = await cdp.evalJson<{ scrollWidth: number; innerWidth: number }>(`
            return {
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
            };
          `)
          const overflowPx = Math.max(0, metrics.scrollWidth - metrics.innerWidth)
          layoutMatrix.push({ route, width, ...metrics, overflowPx })
          if (overflowPx > 1) {
            throw new Error(`Horizontal overflow (${overflowPx}px) on ${route} at ${width}px viewport`)
          }
          if (route === '#lesson/host-to-gpu' && (width === 390 || width === 1440)) {
            await cdp.screenshot(recordArtifact(`05-layout-stage-${width}w.png`))
          }
        }
      }
      checks.responsiveLayout = layoutMatrix
    }
  })

  const reportPath = recordArtifact('verification-report.json')
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ status: 'verified', reportPath, artifactCount: artifacts.length }, null, 2)}\n`)
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'run-id': { type: 'string' },
      port: { type: 'string' },
      'evidence-dir': { type: 'string' },
      journey: { type: 'string' },
    },
  })

  const sub = positionals[0]
  const runId = values['run-id'] ?? 'default'

  if (sub === 'launch') {
    const port = values.port ? Number(values.port) : undefined
    await cmdLaunch(runId, port)
    return
  }
  if (sub === 'doctor') {
    await cmdDoctor(runId)
    return
  }
  if (sub === 'drive') {
    const evidenceDir = values['evidence-dir']
    if (!evidenceDir) {
      throw new Error('Missing required --evidence-dir <dir> (must be outside /tmp/hub-verify-<run-id>)')
    }
    const journey = (values.journey ?? 'all') as JourneyName
    if (!['all', 'modes', 'search', 'stage', 'practice', 'layout'].includes(journey)) {
      throw new Error(`Unknown --journey '${journey}'`)
    }
    await cmdDrive(runId, evidenceDir, journey)
    return
  }
  if (sub === 'cleanup') {
    await cmdCleanup(runId)
    return
  }

  process.stderr.write(
    [
      'Usage: node .agents/skills/verify-hub-app/scripts/control-hub.ts <command> [options]',
      '',
      'Commands:',
      '  launch  --run-id <id> [--port <port>]                      Start isolated Vite dev server',
      '  doctor  --run-id <id>                                      Verify PID ownership & HTTP readiness',
      '  drive   --run-id <id> --evidence-dir <dir> [--journey ...] Drive headless Chromium via CDP & save proof',
      '  cleanup --run-id <id>                                      Stop owned Vite PID & delete scratch state',
      '',
    ].join('\n'),
  )
  process.exitCode = 64
}

main().catch(err => {
  process.stderr.write(`control-hub error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
