import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { ProductEngine } from '../src/core/engine.ts'
import { LIMITS } from '../src/core/types.ts'
import { parseRequest } from '../src/core/validation.ts'

const owner = { actor: 'human' }
const catalog = { schemaVersion: 1, upstream: { repository: 'https://example.test', commit: 'fixture' }, packs: [], skills: [] }

function setup(t) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-product-import-')))
  const workspace = join(root, 'product')
  mkdirSync(workspace)
  const dataDirectory = join(root, 'data')
  const engines = []
  const open = () => {
    const engine = new ProductEngine({ dataDirectory, defaultWorkspaceDirectory: workspace, loadCatalog: () => catalog })
    engines.push(engine)
    return engine
  }
  t.after(() => {
    for (const engine of engines) engine.close()
    rmSync(root, { recursive: true, force: true })
  })
  return { root, workspace, database: join(dataDirectory, 'workspace.sqlite3'), engine: open(), open }
}

function get(engine, view, access = owner) {
  return engine.execute({ op: 'get', projectId: view.project.id }, access)
}

function change(engine, view, command, access = owner) {
  return engine.execute(parseRequest({
    op: 'mutate', projectId: view.project.id, expectedRevision: view.project.revision, command,
  }), access)
}

function importFile(path, fields = {}) {
  return { kind: 'artifact.importFile', type: 'brief', title: 'Product brief', path, ...fields }
}

function addFile(uri) {
  return { kind: 'evidence.add', evidenceKind: 'file', title: uri, summary: 'Fixture snapshot.', uri }
}

test('import and reimport preserve exact text and a matching snapshot in one revision', t => {
  const { engine, workspace, open } = setup(t)
  const path = process.platform === 'win32' ? ' brief draft.md' : ' brief draft.md '
  const file = join(workspace, path)
  const text = '\ufeff  产品简介\r\n\r\n    Draft\r\n'
  writeFileSync(file, text)
  let view = engine.execute({ op: 'create', title: 'Import fixture' }, owner)
  view = change(engine, view, { kind: 'evidence.add', evidenceKind: 'note', title: 'Note', summary: 'A reported source.' })
  const reported = view.evidence[0]
  const before = view.project
  const agent = { actor: 'agent', workspacePath: workspace }
  view = change(engine, view, importFile(path, { skillId: 'pe-propose', evidenceIds: [reported.id] }), agent)
  const artifact = view.project.artifacts[0]
  const snapshot = view.evidence[1]
  assert.equal(view.project.revision, before.revision + 1)
  assert.equal(view.project.reviewRevision, before.reviewRevision + 1)
  assert.equal(view.project.activity.at(-1).kind, 'artifact.importFile')
  assert.equal(view.project.activity.at(-1).targetId, artifact.id)
  assert.equal(view.project.activity.at(-1).detail, path)
  assert.equal(artifact.content, text)
  assert.equal(artifact.skillId, 'pe-propose')
  assert.deepEqual(artifact.evidenceIds, [reported.id, snapshot.id])
  assert.equal(snapshot.uri, path)
  assert.equal(snapshot.actor, 'agent')
  assert.equal(snapshot.freshness, 'current')
  assert.equal(snapshot.digest, createHash('sha256').update(readFileSync(file)).digest('hex'))
  assert.equal(view.project.evidence[1].freshness, undefined)
  const peer = open()
  assert.deepEqual(get(peer, view).project, view.project)

  view = change(engine, view, { kind: 'check.set', id: 'tests', status: 'passed', evidenceIds: [snapshot.id] })
  const approved = view.checks.find(check => check.id === 'tests')
  writeFileSync(file, 'Revised brief.\n')
  const staleView = get(peer, view)
  assert.equal(staleView.checks.find(check => check.id === 'tests').stale, true)
  const replaced = change(engine, staleView, importFile(path, { id: artifact.id }))
  assert.equal(replaced.project.revision, staleView.project.revision + 1)
  assert.equal(replaced.project.reviewRevision, staleView.project.reviewRevision + 1)
  assert.equal(replaced.project.artifacts.length, 1)
  assert.equal(replaced.project.artifacts[0].id, artifact.id)
  assert.equal(replaced.project.artifacts[0].createdAt, artifact.createdAt)
  assert.equal(replaced.project.artifacts[0].content, 'Revised brief.\n')
  assert.deepEqual(replaced.evidence.map(item => item.freshness), ['reported', 'stale', 'current'])
  assert.deepEqual(replaced.project.artifacts[0].evidenceIds, [reported.id, replaced.evidence[2].id])
  assert.deepEqual(replaced.checks.find(check => check.id === 'tests'), { ...approved, stale: true, staleEvidenceIds: [snapshot.id] })
  assert.throws(() => change(peer, staleView, importFile(path)), { code: 'conflict' })
  assert.deepEqual(get(peer, replaced), replaced)

  writeFileSync(file, text)
  const restored = get(peer, replaced)
  assert.equal(restored.evidence[1].freshness, 'current')
  assert.equal(restored.checks.find(check => check.id === 'tests').stale, true)
})

test('freshness covers unlinked and failed-check evidence without adding release blockers', t => {
  const { engine, workspace } = setup(t)
  for (const uri of ['unlinked.txt', 'failed.txt', 'pending.txt']) writeFileSync(join(workspace, uri), uri)
  let view = engine.execute({ op: 'create', title: 'Freshness fixture' }, owner)
  for (const uri of ['unlinked.txt', 'failed.txt', 'pending.txt']) view = change(engine, view, addFile(uri))
  view = change(engine, view, { kind: 'check.set', id: 'tests', status: 'failed', evidenceIds: [view.evidence[1].id] })
  view = change(engine, view, { kind: 'check.set', id: 'release-plan', status: 'pending', evidenceIds: [view.evidence[2].id] })
  assert.ok(view.evidence.every(item => item.freshness === 'current'))
  writeFileSync(join(workspace, 'unlinked.txt'), 'changed')
  unlinkSync(join(workspace, 'failed.txt'))
  unlinkSync(join(workspace, 'pending.txt'))
  const stale = get(engine, view)
  assert.equal(stale.project.revision, view.project.revision)
  assert.deepEqual(stale.release.blockers, view.release.blockers)
  assert.ok(stale.evidence.every(item => item.freshness === 'stale'))
  assert.deepEqual(stale.checks.find(check => check.id === 'tests').staleEvidenceIds, [view.evidence[1].id])
  assert.deepEqual(stale.checks.find(check => check.id === 'release-plan').staleEvidenceIds, [view.evidence[2].id])
})

test('import rejects unsafe files and invalid references without changing the aggregate', t => {
  const { root, engine, workspace } = setup(t)
  const outside = join(root, 'private.txt')
  writeFileSync(outside, 'private')
  const files = {
    'malformed.txt': Buffer.from([0xf0, 0x9f, 0x92]),
    'nul.txt': 'hello\0world',
    'empty.txt': '',
    'blank.txt': '  \n',
    'long.txt': '文'.repeat(LIMITS.content + 1),
    'oversize.txt': Buffer.alloc(LIMITS.evidenceFileBytes + 1, 0x61),
    'valid.txt': 'safe',
  }
  for (const [path, content] of Object.entries(files)) writeFileSync(join(workspace, path), content)
  mkdirSync(join(workspace, 'folder'))
  const badPaths = ['../private.txt', outside, 'C:/private.txt', 'folder/../valid.txt', 'folder', 'missing.txt', ...Object.keys(files).filter(path => path !== 'valid.txt')]
  if (process.platform !== 'win32') {
    symlinkSync(outside, join(workspace, 'linked.txt'))
    symlinkSync(join(workspace, 'valid.txt'), join(workspace, 'internal.txt'))
    symlinkSync(root, join(workspace, 'alias'), 'dir')
    badPaths.push('linked.txt', 'internal.txt', 'alias/private.txt')
  }
  const view = get(engine, engine.execute({ op: 'create', title: 'Import rejection fixture' }, owner))
  for (const path of badPaths) assert.throws(() => change(engine, view, importFile(path)), { code: 'invalid-input' }, path)
  assert.throws(() => change(engine, view, importFile('valid.txt', { evidenceIds: [randomUUID()] })), { code: 'invalid-input' })
  assert.throws(() => change(engine, view, importFile('valid.txt', { id: randomUUID() })), { code: 'not-found' })
  const agent = { actor: 'agent', workspacePath: root }
  assert.throws(() => change(engine, view, importFile('valid.txt'), agent), { code: 'not-found' })
  assert.deepEqual(get(engine, view), view)
})

test('a failed SQLite write rolls back the imported artifact and its evidence', t => {
  const { database, engine, workspace } = setup(t)
  writeFileSync(join(workspace, 'brief.md'), 'A valid brief.')
  const created = get(engine, engine.execute({ op: 'create', title: 'Atomicity fixture' }, owner))
  const db = new DatabaseSync(database)
  try {
    db.exec("CREATE TRIGGER reject_import BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'fixture failure'); END")
    assert.throws(() => change(engine, created, importFile('brief.md')), /fixture failure/)
    assert.deepEqual(get(engine, created), created)
    db.exec('DROP TRIGGER reject_import')
    const imported = change(engine, created, importFile('brief.md'))
    assert.equal(imported.project.artifacts.length, 1)
    assert.equal(imported.project.evidence.length, 1)
    assert.equal(imported.project.artifacts[0].evidenceIds[0], imported.project.evidence[0].id)
  } finally {
    db.close()
  }
})
