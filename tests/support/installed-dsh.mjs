import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const runFile = promisify(execFile)
const desktopCli = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh'
const fakeKey = 'product-engineering-local-acceptance'

async function defaultCli() {
  try {
    await access(desktopCli)
    return desktopCli
  } catch {
    return 'dsh'
  }
}

function redact(output) {
  return output.replace(/([?&]token=)[^\s&]+/gu, '$1[redacted]')
}

function messagesResponse(index, block) {
  const events = [
    { type: 'message_start', message: { id: `pe-acceptance-${index}`, model: 'deepseek-v4-flash', usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: block },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: block.type === 'tool_use' ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]
  return events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')
}

async function listenForModel() {
  const requests = []
  const script = []
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, 'POST')
      assert.match(request.url, /\/messages$/u)
      assert.equal(request.headers['x-api-key'] ?? request.headers.authorization, fakeKey)
      let body = ''
      for await (const chunk of request) body += chunk.toString()
      const parsed = JSON.parse(body)
      const title = JSON.stringify(parsed.messages).includes('Generate the session title from this JSON array of human messages')
      let block = { type: 'text', text: 'Product engineering acceptance' }
      if (!title) {
        requests.push(parsed)
        const next = script.shift()
        if (next) block = next
      }
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end(messagesResponse(requests.length, block))
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' })
      response.end(error.message)
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    requests,
    script,
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
      server.closeAllConnections()
    }),
  }
}

function launchWeb(cli, env, cwd, patch) {
  const child = spawn(cli, ['web', '--patch', patch, '--no-open', '--port', '0'], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  let settled = false
  const launchUrl = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`DSH Web startup timed out.\n${redact(output)}`)), 30_000)
    function collect(chunk) {
      output += chunk.toString()
      const match = /dsh web: (http:\/\/[^\s]+)\r?\n/u.exec(output)
      if (!settled && match) {
        settled = true
        clearTimeout(timeout)
        resolve(new URL(match[1]))
      }
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code, signal) => {
      clearTimeout(timeout)
      reject(new Error(`DSH Web exited before startup (${signal ?? code}).\n${redact(output)}`))
    })
  })
  const close = () => {
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return Promise.resolve()
    return new Promise(resolve => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 7000)
      child.once('close', () => {
        clearTimeout(timeout)
        resolve()
      })
      child.kill('SIGTERM')
    })
  }
  return { launchUrl, close, getOutput: () => redact(output) }
}

export async function eventually(predicate, label, timeout = 15_000) {
  const deadline = Date.now() + timeout
  do {
    const result = await predicate()
    if (result) return result
    await new Promise(resolve => setTimeout(resolve, 50))
  } while (Date.now() < deadline)
  throw new Error(`Timed out waiting for ${label}`)
}

export async function createInstalledDsh(tarball, cli = process.env.DSH_ACCEPTANCE_CLI) {
  cli ??= await defaultCli()
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'dsh-pe-acceptance-')))
  const workspace = join(directory, 'workspace')
  let model
  const webProcesses = new Set()
  const stopWeb = () => Promise.all(Array.from(webProcesses, web => web.close()))
  const close = async () => {
    try {
      await stopWeb()
    } finally {
      try {
        await model?.close()
      } finally {
        await rm(directory, { force: true, recursive: true })
      }
    }
  }
  try {
    await mkdir(workspace)
    const patch = join(directory, 'acceptance.patch.yml')
    const peerProbe = join(directory, 'non-owner-peer.mjs')
    // Keep the probe outside the package so DSH never discovers the product Client through its test row.
    await copyFile(new URL('./non-owner-peer.mjs', import.meta.url), peerProbe)
    await writeFile(patch, [
      '- id: session-log-deepseek',
      '  disabled: true',
      '- id: directory-picker',
      '  disabled: true',
      '- insert:',
      '    - id: directory-picker-browse',
      "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
      '    - id: ui-directory-picker-browse',
      "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'",
      '    - id: product-engineering-non-owner-acceptance',
      `      name: ${JSON.stringify(peerProbe)}`,
      '',
    ].join('\n'))
    model = await listenForModel()
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(DSH_|DEEPSEEK_|npm_config_|https?_proxy$|all_proxy$|no_proxy$)/iu.test(key)))
    Object.assign(env, {
      DSH_HOME: join(directory, 'dsh'),
      DSH_AGENTS_HOME: join(directory, 'agents'),
      DSH_TELEMETRY_DISABLED: '1',
      XDG_CACHE_HOME: join(directory, 'cache'),
      XDG_CONFIG_HOME: join(directory, 'config'),
      XDG_DATA_HOME: join(directory, 'data'),
      DEEPSEEK_API_KEY: fakeKey,
      DEEPSEEK_BASE_URL: model.origin,
      npm_config_cache: join(directory, 'npm-cache'),
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
      CI: 'true',
    })
    const run = (...args) => runFile(cli, args, { cwd: workspace, env, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 })
    const { stdout: version } = await run('--version')
    assert.equal(version.trim(), '0.2.1-rc.2')
    await run('plugin', '--profile', 'web', 'add', `file:${tarball}`)
    const { stdout: config } = await run('--profile', 'web', '--dump-config')
    async function start({ parallel = false } = {}) {
      if (!parallel) {
        await stopWeb()
        webProcesses.clear()
      }
      const web = launchWeb(cli, env, workspace, patch)
      webProcesses.add(web)
      const launchUrl = await web.launchUrl
      const response = await fetch(launchUrl, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
      assert.equal(response.status, 303)
      const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
      assert.ok(cookie, 'DSH Web should set a first-party session cookie')
      const origin = launchUrl.origin
      const hostFetch = async (path, init = {}) => {
        try {
          return await fetch(new URL(path, origin), {
            ...init,
            headers: { cookie, ...init.headers },
            signal: init.signal ?? AbortSignal.timeout(5000),
          })
        } catch (cause) {
          throw new Error(`${init.method ?? 'GET'} ${path.slice(0, 120)} failed to reach installed DSH`, { cause })
        }
      }
      const call = async (channel, method, payload) => {
        const rpcId = randomUUID()
        const remote = await hostFetch(`${channel}/${method}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
        })
        assert.equal(remote.status, 200, `${method} failed with HTTP ${remote.status}`)
        const envelope = await remote.json()
        assert.equal(envelope.rpcId, rpcId)
        const { result } = envelope
        assert.ok(result.ok, `${method}: ${result.error?.message}`)
        return result.value
      }
      const rpc = (method, args) => call('/api', method, { args })
      const product = request => call('/api', 'product-engineering/workspace', request)
      const closeWeb = async () => {
        await web.close()
        webProcesses.delete(web)
      }
      return { origin, launchUrl, hostFetch, rpc, product, close: closeWeb, getOutput: web.getOutput }
    }
    return { close, config, model, run, start, workspace }
  } catch (error) {
    await close()
    throw error
  }
}
