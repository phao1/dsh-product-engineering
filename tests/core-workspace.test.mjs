import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ProductEngine } from '../src/core/engine.ts'
import { canonicalWorkspace, sessionWorkspace } from '../src/core/evidence.ts'
import { parseRequest } from '../src/core/validation.ts'
import { fetchOwnerRequest, ownerRequest, PRODUCT_ENDPOINT, PRODUCT_PATH } from '../src/host/requests.ts'

const owner = { actor: 'human' }
const catalog = { schemaVersion: 1, upstream: { repository: 'https://example.test', commit: 'fixture' }, packs: [], skills: [] }

function setup(t) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-product-core-')))
  const workspace = join(root, 'product')
  mkdirSync(workspace)
  const options = { dataDirectory: join(root, 'data'), defaultWorkspaceDirectory: workspace, loadCatalog: () => catalog }
  const engines = []
  const open = () => {
    const engine = new ProductEngine(options)
    engines.push(engine)
    return engine
  }
  t.after(() => {
    for (const engine of engines) engine.close()
    rmSync(root, { recursive: true, force: true })
  })
  return { root, workspace, engine: open(), open }
}

function change(engine, view, command, access = owner) {
  return engine.execute({ op: 'mutate', projectId: view.project.id, expectedRevision: view.project.revision, command }, access)
}

function artifact(type, content = 'Reviewed draft.') {
  return { kind: 'artifact.save', type, title: type, content }
}

test('project updates from two connections use revision checks and preserve the full artifact body', t => {
  const { engine, open } = setup(t)
  const peer = open()
  const created = engine.execute({ op: 'create', title: 'Product' }, owner)
  const content = '    verbatim code\n\nFollow-up paragraph.\n'
  const saved = change(engine, created, artifact('brief', content))
  assert.throws(() => change(peer, created, artifact('note')), { code: 'conflict' })
  const latest = peer.execute({ op: 'get', projectId: created.project.id }, owner)
  assert.equal(latest.project.artifacts[0].content, content)
  assert.equal(latest.project.revision, saved.project.revision)
  assert.equal(latest.project.activity.at(-1).revision, saved.project.revision)
  assert.equal(latest.nextAction.stage, 'design')
})

test('release readiness follows current evidence, scope, decisions, and documented waivers', t => {
  const { engine, workspace } = setup(t)
  const file = join(workspace, 'test-output.txt')
  writeFileSync(file, 'test passed')
  let view = engine.execute({ op: 'create', title: 'Evidence demo' }, owner)
  assert.throws(() => change(engine, view, { kind: 'stage.move', stage: 'grow' }), { code: 'blocked' })
  view = change(engine, view, artifact('brief'))
  view = change(engine, view, { kind: 'stage.move', stage: 'design' })
  view = change(engine, view, artifact('prd'))
  view = change(engine, view, { kind: 'stage.move', stage: 'build' })
  view = change(engine, view, { kind: 'decision.add', title: 'Audience', context: 'First launch audience.', options: ['Private', 'Public'] })
  assert.throws(() => change(engine, view, { kind: 'stage.move', stage: 'ship' }), error =>
    error.code === 'blocked' && error.blockers.some(blocker => blocker.kind === 'pending-decision'))
  const decision = view.project.decisions[0]
  view = change(engine, view, { kind: 'decision.resolve', id: decision.id, choice: 'Private', rationale: 'Use the early-access cohort.' })
  view = change(engine, view, { kind: 'evidence.add', evidenceKind: 'file', title: 'Test report', uri: 'test-output.txt', summary: 'Suite output.' })
  const first = view.project.evidence[0]
  assert.equal(first.verification, 'snapshot')
  assert.match(first.digest, /^[a-f0-9]{64}$/)
  view = change(engine, view, { kind: 'check.set', id: 'tests', status: 'passed', evidenceIds: [first.id] })
  view = change(engine, view, { kind: 'evidence.add', evidenceKind: 'command', title: 'Review report', uri: 'review --read-only', summary: 'Owner reported review results.' })
  assert.equal(view.project.evidence[1].verification, 'reported')
  assert.equal(view.checks.find(check => check.id === 'tests').stale, false)
  assert.throws(() => change(engine, view, { kind: 'check.set', id: 'release-plan', status: 'waived' }), { code: 'invalid-input' })
  for (const id of ['product-scope', 'independent-review', 'release-plan']) {
    view = change(engine, view, { kind: 'check.set', id, status: 'waived', evidenceIds: id === 'product-scope' ? [first.id] : [], note: 'Fixture waiver applies to the reviewed revision.' })
  }
  assert.equal(view.release.ready, true)
  writeFileSync(file, 'new result!')
  view = engine.execute({ op: 'get', projectId: view.project.id }, owner)
  assert.deepEqual(view.release.blockers.map(blocker => [blocker.id, blocker.kind]), [['product-scope', 'check-stale'], ['tests', 'check-stale']])
  assert.throws(() => change(engine, view, { kind: 'check.set', id: 'tests', status: 'passed', evidenceIds: [first.id] }), { code: 'blocked' })
  const exported = engine.execute({ op: 'export', projectId: view.project.id, format: 'json' }, owner)
  assert.equal(JSON.parse(exported.content).release.ready, false)
  view = change(engine, view, { kind: 'evidence.add', evidenceKind: 'file', title: 'New test report', uri: 'test-output.txt', summary: 'Refreshed result.' })
  view = change(engine, view, { kind: 'check.set', id: 'tests', status: 'passed', evidenceIds: [view.project.evidence.at(-1).id] })
  view = change(engine, view, { kind: 'check.set', id: 'product-scope', status: 'waived', evidenceIds: [], note: 'Fixture waiver applies independently of the test result.' })
  view = change(engine, view, { kind: 'stage.move', stage: 'ship' })
  assert.equal(view.project.stage, 'ship')
  view = change(engine, view, artifact('launch'))
  assert.equal(view.release.ready, false)
  assert.ok(view.release.blockers.every(blocker => blocker.kind === 'check-stale'))
  view = change(engine, view, { kind: 'decision.reopen', id: decision.id, reason: 'The public launch has a new constraint.' })
  assert.equal(view.project.decisions[0].status, 'pending')
  assert.equal(view.project.decisions[0].choice, undefined)
  assert.match(view.project.activity.find(item => item.kind === 'decision.resolve').detail, /Private/)
})

test('original session scope preserves distinct filesystem identities and refuses mutable aliases', t => {
  const { engine, root, workspace } = setup(t)
  const spaced = process.platform === 'win32' ? `${workspace}-other` : `${workspace} `
  mkdirSync(spaced)
  const one = engine.execute({ op: 'create', title: 'First workspace' }, owner)
  const two = engine.execute(parseRequest({ op: 'create', title: 'Second workspace', workspacePath: spaced }), owner)
  assert.equal(two.project.workspacePath, spaced)
  assert.equal(canonicalWorkspace(spaced), spaced)
  const agent = { actor: 'agent', workspacePath: sessionWorkspace(spaced) }
  assert.deepEqual(engine.execute({ op: 'list' }, agent).map(project => project.id), [two.project.id])
  assert.equal(engine.execute({ op: 'get', projectId: two.project.id }, agent).project.workspacePath, spaced)
  assert.throws(() => engine.execute({ op: 'get', projectId: one.project.id }, agent), { code: 'not-found' })
  assert.throws(() => change(engine, two, { kind: 'stage.move', stage: 'design' }, agent), { code: 'forbidden' })
  if (process.platform !== 'win32') {
    const alias = join(root, 'workspace-alias')
    symlinkSync(workspace, alias, 'dir')
    assert.throws(() => sessionWorkspace(alias), { code: 'forbidden' })
    unlinkSync(alias)
    symlinkSync(spaced, alias, 'dir')
    assert.throws(() => sessionWorkspace(alias), { code: 'forbidden' })
    writeFileSync(join(root, 'private.txt'), 'outside workspace')
    symlinkSync(join(root, 'private.txt'), join(spaced, 'linked.txt'))
    for (const uri of ['../private.txt', 'linked.txt', join(root, 'private.txt')]) {
      assert.throws(() => change(engine, two, { kind: 'evidence.add', evidenceKind: 'file', title: 'Link', uri, summary: 'Fixture' }, agent), { code: 'invalid-input' })
    }
  }
})

test('owner transport validates the carrier and ignores actor claims in request data', async t => {
  const { engine } = setup(t)
  const reportError = error => assert.fail(String(error))
  const signal = new AbortController().signal
  const forged = { op: 'create', title: 'Unauthorized', actor: 'human' }
  for (const principal of [undefined, 'api', 'remote']) {
    const response = ownerRequest(engine, PRODUCT_ENDPOINT, forged, signal, principal, reportError)
    assert.equal(response.error.code, 'forbidden')
  }
  assert.deepEqual(engine.execute({ op: 'list' }, owner), [])
  const dispatch = body => fetchOwnerRequest(engine, new Request(`http://localhost${PRODUCT_PATH}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), reportError)
  const wrongMedia = new Request(`http://localhost${PRODUCT_PATH}`, { method: 'POST', body: 'unsupported text' })
  assert.equal((await fetchOwnerRequest(engine, wrongMedia, reportError)).status, 415)
  assert.equal(wrongMedia.bodyUsed, true)
  assert.equal((await dispatch({ type: 'client-request', rpcId: 'bad', method: 'other', payload: forged })).status, 400)
  assert.equal((await dispatch({ padding: 'x'.repeat(300_000) })).status, 413)
  const response = await dispatch({ type: 'client-request', rpcId: 'correlation', method: PRODUCT_ENDPOINT, payload: forged })
  assert.deepEqual(await response.json(), {
    type: 'server-response', rpcId: 'correlation', result: {
      ok: true, value: { ok: false, error: { code: 'invalid-input', message: 'The request contains an unrecognized field.' } },
    },
  })
})
