import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

export const name = 'product-engineering-headless-acceptance'
export const inject = ['tools', 'skills', 'appReady', 'appExit']

// The installed DSH profile imports this file as a temporary plugin.
export function apply(ctx) {
  ctx.appReady.onReady(() => {
    exercise(ctx).then(() => ctx.appExit(0), error => {
      console.error(error)
      ctx.appExit(1)
    })
  })
}

async function exercise(ctx) {
  const cwd = await realpath(process.cwd())
  const expectedTools = ['product_create', 'product_export', 'product_get', 'product_list', 'product_record']
  const tools = Array.from(ctx.tools.view().visible.keys()).filter(name => name.startsWith('product_')).sort()
  const skills = (await ctx.skills.list({ cwd })).filter(skill => skill.name.startsWith('pe-'))
  const { dir } = ctx.get('profileContext')
  const database = join(dir, 'product-engineering', 'workspace.sqlite3')
  if (process.env.PE_PROBE_UNINSTALLED === '1') {
    assert.deepEqual(tools, [])
    assert.deepEqual(skills, [])
    await access(database)
    console.log('PASS native headless unregisters five tools and 44 skills after uninstall and retains project data')
    return
  }
  assert.deepEqual(tools, expectedTools)
  assert.equal(skills.length, 44)
  const explicitOnly = skills.filter(skill => !skill.invocation.modelInvocable).map(skill => skill.name).sort()
  assert.deepEqual(explicitOnly, ['pe-handover', 'pe-retro', 'pe-ship-check', 'pe-start-here'])
  const startHere = await ctx.skills.get('pe-start-here', { cwd })
  assert.match(startHere?.content ?? '', /Find where the work stands and name its next step and skill/)
  await access(database)
  console.log('PASS native headless loads all 44 skills, five product tools, and project SQLite storage')

  // Exercise registered handlers with a synthetic session header and no model request.
  const exec = workspace => ({ signal: new AbortController().signal, agent: { session: { header: { cwd: workspace } } } })
  const call = (name, args, workspace = cwd) => ctx.tools.get(name).execute(args, exec(workspace))
  const projects = await call('product_list', {})
  const source = process.platform === 'win32' ? 'brief.md' : 'brief.md '
  if (process.env.PE_PROBE_RESTART === '1') {
    assert.equal(projects.length, 1)
    const reopened = await call('product_get', { projectId: projects[0].id })
    assert.equal(reopened.project.artifacts[0].content, '# Brief\n\nRevised requirement.\n')
    assert.equal(reopened.project.revision, 4)
    assert.ok(reopened.evidence.every(item => item.uri === source))
    assert.equal(reopened.project.activity.find(item => item.kind === 'artifact.importFile')?.detail, source)
    assert.ok(reopened.evidence.some(item => item.freshness === 'stale'))
    console.log('PASS a fresh native headless process reads the stored revision, artifact text, and stale evidence')
    return
  }
  assert.deepEqual(projects, [])
  const sibling = join(dirname(cwd), 'other')
  await mkdir(sibling)
  const projectB = await call('product_create', { title: 'Other project' }, sibling)
  assert.deepEqual(await call('product_list', {}), [])
  await assert.rejects(call('product_get', { projectId: projectB.project.id }), { code: 'not-found' })
  await assert.rejects(call('product_export', { projectId: projectB.project.id, format: 'json' }), { code: 'not-found' })

  let current = await call('product_create', { title: 'Native test project' })
  const projectId = current.project.id
  const get = () => call('product_get', { projectId })
  const record = command => call('product_record', { projectId, expectedRevision: current.project.revision, command })
  const content = '# Brief\n\n    Original requirement.\n'
  await writeFile(join(cwd, source), content)
  const importBrief = { kind: 'artifact.importFile', type: 'brief', title: 'Imported brief', path: source }
  await assert.rejects(record({ ...importBrief, path: '../other/private.md' }), { code: 'invalid-input' })
  current = await record(importBrief)
  assert.equal(current.project.revision, 2)
  assert.equal(current.project.artifacts[0].content, content)
  assert.equal(current.evidence[0].freshness, 'current')
  assert.equal(current.evidence[0].uri, source)
  assert.equal(current.project.activity.at(-1).actor, 'agent')
  const previousEvidence = current.evidence[0].id

  await writeFile(join(cwd, source), '# Brief\n\nRevised requirement.\n')
  current = await get()
  assert.equal(current.evidence[0].freshness, 'stale')
  current = await record({ ...importBrief, id: current.project.artifacts[0].id })
  assert.equal(current.project.revision, 3)
  assert.equal(current.project.artifacts.length, 1)
  assert.equal(current.evidence.length, 2)
  assert.ok(!current.project.artifacts[0].evidenceIds.includes(previousEvidence))
  assert.ok(current.evidence.some(item => item.freshness === 'current' && current.project.artifacts[0].evidenceIds.includes(item.id)))

  current = await record({ kind: 'decision.add', title: 'Choose launch scope', context: 'Pilot or full launch', options: ['Pilot', 'Full launch'] })
  const decision = current.project.decisions[0]
  await assert.rejects(record({ kind: 'decision.resolve', id: decision.id, choice: 'Pilot', rationale: 'Requires the owner' }), { code: 'forbidden' })
  await assert.rejects(record({ kind: 'check.set', id: 'tests', status: 'waived', note: 'Requires the owner' }), { code: 'forbidden' })
  await assert.rejects(record({ kind: 'stage.move', stage: 'design' }), { code: 'forbidden' })
  assert.equal((await get()).project.revision, 4)

  const report = await call('product_export', { projectId, format: 'markdown' })
  assert.match(report.content, /^## Remediation plan$/m)
  assert.match(report.content, /Suggested skill: pe-test-harness/)
  assert.match(report.content, /Owner judgment required: yes/)
  const json = await call('product_export', { projectId, format: 'json' })
  assert.equal(JSON.parse(json.content).evidence.find(item => item.id === previousEvidence).freshness, 'stale')
  console.log('PASS installed tool handlers import and refresh file artifacts, reject cross-workspace and owner actions, and export blocker details')
}

async function runAcceptance(tarballArgument) {
  const runFile = promisify(execFile)
  const desktopCli = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh'
  assert.ok(tarballArgument, 'Usage: node tests/acceptance-headless.mjs <package.tgz>')
  const tarball = resolve(tarballArgument)
  await access(tarball)
  const cli = process.env.DSH_ACCEPTANCE_CLI ?? await access(desktopCli).then(() => desktopCli, () => 'dsh')
  const root = await mkdtemp(join(tmpdir(), 'dsh-pe-headless-'))
  try {
    const workspace = join(root, 'workspace')
    const probe = join(root, 'probe.mjs')
    const patch = join(root, 'probe.yml')
    await mkdir(workspace)
    await copyFile(new URL(import.meta.url), probe)
    await writeFile(patch, [
      '- id: session-log-deepseek',
      '  disabled: true',
      '- id: headless',
      '  disabled: true',
      '- insert:',
      '    - id: product-engineering-headless-acceptance',
      '      name: ' + JSON.stringify(probe),
      '',
    ].join('\n'))
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(DSH_|DEEPSEEK_|PE_PROBE_|npm_config_|https?_proxy$|all_proxy$|no_proxy$)/iu.test(key)))
    Object.assign(env, {
      DSH_HOME: join(root, 'dsh'), DSH_AGENTS_HOME: join(root, 'agents'), DSH_TELEMETRY_DISABLED: '1',
      XDG_CACHE_HOME: join(root, 'cache'), XDG_CONFIG_HOME: join(root, 'config'), XDG_DATA_HOME: join(root, 'data'),
      npm_config_cache: join(root, 'npm-cache'), npm_config_offline: 'true', npm_config_update_notifier: 'false', CI: 'true',
    })
    const run = (...args) => runFile(cli, args, { cwd: workspace, env, timeout: 40_000 })
    const { stdout: version } = await run('--version')
    assert.equal(version.trim(), '0.2.1-rc.2')
    for (const profile of ['web', 'headless']) {
      await run('plugin', '--profile', profile, 'add', 'file:' + tarball)
      const { stdout: config } = await run('--profile', profile, '--dump-config')
      assert.match(config, /^# == dsh-product-engineering$/mu)
      if (profile === 'headless') {
        const { stdout } = await run('--profile', profile, '--patch', patch)
        process.stdout.write(stdout)
        env.PE_PROBE_RESTART = '1'
        const restarted = await run('--profile', profile, '--patch', patch)
        process.stdout.write(restarted.stdout)
      }
      await run('plugin', '--profile', profile, 'remove', 'dsh-product-engineering')
      const { stdout: cleaned } = await run('--profile', profile, '--dump-config')
      assert.doesNotMatch(cleaned, /^# == dsh-product-engineering$/mu)
      console.log('PASS DSH ' + version.trim() + ' isolated CLI install and uninstall for ' + profile + ' configuration')
      if (profile === 'headless') {
        env.PE_PROBE_UNINSTALLED = '1'
        const { stdout } = await run('--profile', profile, '--patch', patch)
        process.stdout.write(stdout)
      }
    }
  } catch (error) {
    if (error.stderr) process.stderr.write(error.stderr)
    throw error
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runAcceptance(process.argv[2])
}
