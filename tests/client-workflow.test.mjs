import assert from 'node:assert/strict'
import test from 'node:test'
import {
  artifactCommand, checkEvidenceSelection, evidenceUri, lastImportPath, readRemediationStep, replacedImportEvidence,
} from '../src/client/workflow.ts'
import { en, zh } from '../src/client/locales.ts'

const filePath = ' notes/launch.md '
const stale = {
  id: 'older-file', kind: 'file', title: 'Earlier launch notes', uri: filePath, verification: 'snapshot', freshness: 'stale',
}
const current = {
  id: 'current-file', kind: 'file', title: 'Current launch notes', uri: filePath, verification: 'snapshot', freshness: 'current',
}
const reported = {
  id: 'reported-test', kind: 'command', title: 'Unit tests', uri: 'npm test', verification: 'reported', freshness: 'reported',
}

test('the artifact editor preserves authored Markdown and exact import paths', () => {
  const data = new FormData()
  data.set('title', ' Launch notes ')
  data.set('type', 'launch')
  data.set('source', 'file')
  data.set('path', filePath)
  data.append('evidence', 'review')
  data.append('evidence', stale.id)
  assert.deepEqual(artifactCommand(data, 'artifact-id', 'pe-release-gate'), {
    kind: 'artifact.importFile', id: 'artifact-id', type: 'launch', title: 'Launch notes',
    path: filePath, skillId: 'pe-release-gate', evidenceIds: ['review', stale.id],
  })
  assert.equal(replacedImportEvidence(stale, filePath), true)
  assert.equal(replacedImportEvidence(stale, filePath.trim()), false)
  assert.equal(replacedImportEvidence(reported, reported.uri), false)
  data.delete('path')
  assert.equal(artifactCommand(data), undefined)

  const content = '    code block\n\nNew paragraph.\n'
  data.set('source', 'content')
  data.set('content', content)
  data.set('skillId', '')
  assert.deepEqual(artifactCommand(data, 'artifact-id', 'pe-release-gate'), {
    kind: 'artifact.save', id: 'artifact-id', type: 'launch', title: 'Launch notes', content, evidenceIds: ['review', stale.id],
  })
})

test('file evidence submission keeps whitespace in an existing snapshot path', () => {
  const data = new FormData()
  data.set('uri', filePath)
  assert.equal(evidenceUri(data, 'file'), filePath)
  data.set('uri', ' https://example.test ')
  assert.equal(evidenceUri(data, 'url'), 'https://example.test')
})

test('reimport prefills the latest saved path for the selected artifact', () => {
  const activity = [
    { kind: 'artifact.importFile', targetId: 'artifact', detail: 'first.md' },
    { kind: 'artifact.importFile', targetId: 'artifact', detail: filePath },
    { kind: 'artifact.importFile', targetId: 'other', detail: 'other.md' },
    { kind: 'artifact.save', targetId: 'artifact' },
  ]
  assert.equal(lastImportPath(activity, 'artifact'), filePath)
  assert.equal(lastImportPath(activity, 'manual'), '')
})

test('a check can select recaptured evidence and still see its earlier stale link', () => {
  const unlinked = { ...stale, id: 'unlinked-file' }
  const selection = checkEvidenceSelection([stale, unlinked, current, reported], [stale.id, reported.id])
  assert.deepEqual(selection, { available: [current, reported], initial: [reported.id], stale: [stale] })
})

function projectView(revision, blockers) {
  return {
    project: { id: 'project', title: 'Launch notes', revision, decisions: [] },
    checks: [{ id: 'tests', title: 'Tests and verification', status: 'failed', evidenceIds: [stale.id], staleEvidenceIds: [stale.id] }],
    evidence: [stale, current],
    release: { ready: blockers.length === 0, blockers },
  }
}

test('the check draft is prepared from a fresh read and a cleared blocker has no draft', async () => {
  const requests = []
  let result = projectView(8, [{ kind: 'check-failed', id: 'tests', title: 'Tests and verification' }])
  const request = async input => { requests.push(input); return result }
  const prepare = await readRemediationStep(request, 'project', 'tests', key => zh[key])
  assert.equal(prepare.latest, result)
  assert.equal(prepare.step.skillId, 'pe-test-harness')
  assert.match(prepare.step.prompt, /product_get/u)
  assert.match(prepare.step.prompt, /"revision": 8/u)
  assert.match(prepare.step.prompt, /"freshness": "stale"/u)

  result = projectView(9, [])
  assert.deepEqual(await readRemediationStep(request, 'project', 'tests', key => en[key]), { latest: result, step: undefined })
  assert.deepEqual(requests, [{ op: 'get', projectId: 'project' }, { op: 'get', projectId: 'project' }])
})
