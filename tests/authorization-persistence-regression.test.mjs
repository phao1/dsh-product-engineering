import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { ProductEngine } from '../src/core/engine.ts'
import { parseRequest } from '../src/core/validation.ts'

const owner = { actor: 'human' }
const loadCatalog = () => ({ schemaVersion: 1, upstream: { repository: 'https://example.test', commit: 'fixture' }, packs: [], skills: [] })

function setup(t) {
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-pe-regression-')))
  const workspaceA = join(directory, 'workspace-a')
  const workspaceB = join(directory, 'workspace-b')
  mkdirSync(workspaceA)
  mkdirSync(workspaceB)
  const dataDirectory = join(directory, 'data')
  const open = () => new ProductEngine({ dataDirectory, loadCatalog })
  const databasePath = join(dataDirectory, 'workspace.sqlite3')
  const cleanup = []
  t.after(() => {
    for (const close of cleanup.reverse()) close()
    rmSync(directory, { recursive: true, force: true })
  })
  return { workspaceA, workspaceB, dataDirectory, databasePath, open, cleanup }
}

function perform(engine, request, access = owner) {
  return engine.execute(parseRequest(request), access)
}

function mutate(engine, { project }, command, access) {
  return perform(engine, { op: 'mutate', projectId: project.id, expectedRevision: project.revision, command }, access)
}

test('agent access remains scoped across operations and owner commands leave the stored revision intact', t => {
  const { workspaceA, workspaceB, open, cleanup } = setup(t)
  const engine = open()
  cleanup.push(() => engine.close())
  const agent = { actor: 'agent', workspacePath: workspaceA }
  const projectA = perform(engine, { op: 'create', title: 'Workspace A', workspacePath: workspaceA })
  const projectB = perform(engine, { op: 'create', title: 'Workspace B', workspacePath: workspaceB })
  const proposal = mutate(engine, projectA, {
    kind: 'decision.add', title: 'Rollout', context: 'Decide the launch audience.', options: ['Pilot', 'Everyone'],
  }, agent)
  assert.equal(proposal.project.activity.at(-1).actor, 'agent')
  const decisionId = proposal.project.decisions[0].id
  const read = projectId => perform(engine, { op: 'get', projectId })
  const before = [projectA, projectB].map(({ project }) => read(project.id))

  assert.deepEqual(perform(engine, { op: 'list' }, agent).map(({ id }) => id), [projectA.project.id])
  for (const op of ['get', 'export']) {
    const args = op === 'export' ? { format: 'json' } : {}
    assert.throws(() => perform(engine, { op, projectId: projectB.project.id, ...args }, agent), { code: 'not-found' })
  }
  assert.throws(() => mutate(engine, projectB, { kind: 'project.update', summary: 'Cross-workspace edit' }, agent), { code: 'not-found' })
  assert.throws(() => perform(engine, { op: 'create', title: 'Cross-workspace creation', workspacePath: workspaceB }, agent), { code: 'forbidden' })
  for (const command of [
    { kind: 'decision.resolve', id: decisionId, choice: 'Pilot', rationale: 'Owner review required.' },
    { kind: 'decision.reopen', id: decisionId, reason: 'Owner review required.' },
    { kind: 'check.set', id: 'tests', status: 'waived', note: 'Owner review required.' },
    { kind: 'stage.move', stage: 'design' },
  ]) {
    assert.throws(() => mutate(engine, proposal, command, agent), { code: 'forbidden' })
  }
  assert.deepEqual([projectA, projectB].map(({ project }) => read(project.id)), before)
})

test('an unsupported database version and a corrupt stored document fail without overwriting state', t => {
  const { workspaceA, databasePath, open, cleanup } = setup(t)
  const engine = open()
  let projectId
  try {
    projectId = perform(engine, { op: 'create', title: 'Preserve me', workspacePath: workspaceA }).project.id
  } finally {
    engine.close()
  }

  const db = new DatabaseSync(databasePath)
  cleanup.push(() => db.close())
  const stored = () => db.prepare('SELECT revision, document FROM projects WHERE id = ?').get(projectId)
  const original = stored()
  const { user_version: version } = db.prepare('PRAGMA user_version').get()
  db.exec(`PRAGMA user_version = ${version + 1}`)
  assert.throws(open, { code: 'unavailable', message: /unsupported format/ })
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, version + 1)
  assert.deepEqual(stored(), original)

  db.exec(`PRAGMA user_version = ${version}`)
  const corrupt = JSON.stringify({ ...JSON.parse(original.document), revision: original.revision + 1 })
  db.prepare('UPDATE projects SET document = ? WHERE id = ?').run(corrupt, projectId)
  const reopened = open()
  cleanup.push(() => reopened.close())
  assert.throws(() => perform(reopened, { op: 'get', projectId }), { code: 'unavailable', message: /Stored project data/ })
  assert.throws(() => perform(reopened, {
    op: 'mutate', projectId, expectedRevision: original.revision, command: { kind: 'project.update', title: 'Overwrite' },
  }), { code: 'unavailable' })
  assert.equal(stored().document, corrupt)
  assert.equal(stored().revision, original.revision)
})

const writerProgram = `
import { ProductEngine } from ${JSON.stringify(new URL('../src/core/engine.ts', import.meta.url).href)}
const [dataDirectory, projectId, revision, title] = process.argv.slice(1)
const engine = new ProductEngine({ dataDirectory, loadCatalog: () => { throw new Error('Unexpected catalog call') } })
process.once('message', () => {
  let result
  try {
    const { project } = engine.execute({ op: 'mutate', projectId, expectedRevision: Number(revision),
      command: { kind: 'project.update', title } }, { actor: 'human' })
    result = { title: project.title, revision: project.revision }
  } catch (error) {
    result = { code: error.code }
  } finally {
    engine.close()
  }
  process.send(result, () => process.disconnect())
})
process.send('ready')
`

function startWriter(cleanup, args) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', writerProgram, ...args], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] })
  cleanup.push(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  })
  const message = () => new Promise((resolve, reject) => {
    function received(value) {
      child.off('exit', exited)
      child.off('error', failed)
      resolve(value)
    }
    function exited(code, signal) {
      failed(new Error(`SQLite writer stopped before reporting its result (${signal ?? code}).`))
    }
    function failed(error) {
      child.off('message', received)
      child.off('exit', exited)
      child.off('error', failed)
      reject(error)
    }
    child.once('message', received)
    child.once('exit', exited)
    child.once('error', failed)
  })
  return { child, ready: message(), message }
}

test('independent SQLite writers commit exactly one shared revision and a new engine reads that winner', { timeout: 15_000 }, async t => {
  const { workspaceA, dataDirectory, open, cleanup } = setup(t)
  const engine = open()
  let original
  try {
    original = perform(engine, { op: 'create', title: 'Before race', workspacePath: workspaceA }).project
  } finally {
    engine.close()
  }
  const writers = ['Writer A', 'Writer B'].map(title => startWriter(cleanup, [dataDirectory, original.id, String(original.revision), title]))
  assert.deepEqual(await Promise.all(writers.map(({ ready }) => ready)), ['ready', 'ready'])
  const results = await Promise.all(writers.map(({ child, message }) => {
    const report = message()
    const stopped = once(child, 'exit')
    child.send('write')
    return Promise.all([report, stopped]).then(([result, exit]) => {
      assert.deepEqual(exit, [0, null])
      return result
    })
  }))
  assert.equal(results.filter(result => result.code === 'conflict').length, 1)
  const winner = results.find(result => result.title !== undefined)
  assert.ok(winner)
  assert.equal(winner.revision, original.revision + 1)
  const reopened = open()
  cleanup.push(() => reopened.close())
  const { project } = perform(reopened, { op: 'get', projectId: original.id })
  assert.equal(project.title, winner.title)
  assert.equal(project.revision, winner.revision)
  assert.equal(project.activity.length, winner.revision)
  assert.equal(project.activity.at(-1).label, winner.title)
})
