import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, symlink, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createInstalledDsh, eventually } from './support/installed-dsh.mjs'

const [, , tarball] = process.argv
assert.ok(tarball, 'Usage: node tests/acceptance-runtime.mjs <package.tgz>')
const harness = await createInstalledDsh(resolve(tarball))
let host
const explicit = ['pe-handover', 'pe-retro', 'pe-ship-check', 'pe-start-here']
const toolNames = ['product_create', 'product_export', 'product_get', 'product_list', 'product_record']

function success(response) {
  assert.equal(response.ok, true, JSON.stringify(response.error))
  return response.data
}

function rejected(response, ...codes) {
  assert.equal(response.ok, false, `Expected ${codes.join(' or ')}`)
  assert.ok(codes.includes(response.error.code), JSON.stringify(response.error))
  return response.error
}

async function assertStatus(response, status) {
  assert.equal(response.status, status, await response.text())
}

function prompt(sessionId, text) {
  return host.rpc('session/prompt', {
    request: { requestId: randomUUID(), sessionId, mode: 'queue', content: [{ type: 'text', text }] },
  })
}

async function modelTool(sessionId, name, input) {
  const id = `pe-acceptance-${randomUUID()}`
  harness.model.script.push({ type: 'tool_use', id, name, input })
  const reply = await prompt(sessionId, `Installed tool exercise ${id}`)
  assert.equal(reply.accepted, true)
  return eventually(() => harness.model.requests
    .flatMap(request => request.messages ?? [])
    .flatMap(message => message.content ?? [])
    .find(block => block.type === 'tool_result' && block.tool_use_id === id), `tool result for ${name}`)
}

try {
  assert.match(harness.config, /^# == dsh-product-engineering$/mu)
  host = await harness.start()
  const page = await host.hostFetch('/')
  assert.equal(page.status, 200)
  const html = await page.text()
  const productClientAsset = Array.from(html.matchAll(/(?:src|href)="(plugins\/\?\?[^"\n]+)"/gu), match => match[1])
    .find(asset => asset.includes('dsh-product-engineering/client.js'))
  assert.ok(productClientAsset, 'DSH startup HTML should preload the installed Client module')
  const asset = await host.hostFetch(productClientAsset.replaceAll('&amp;', '&'))
  assert.equal(asset.status, 200)
  const clientBundle = await asset.text()
  assert.match(clientBundle, /sidebar\.panellist/u)
  assert.match(clientBundle, /product-engineering\/workspace/u)

  const route = '/api/product-engineering/workspace'
  const request = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method: 'product-engineering/workspace', payload: { op: 'list' } }),
  }
  await assertStatus(await fetch(new URL(route, host.origin), request), 401)
  const crossOrigin = { ...request, headers: { ...request.headers, origin: 'https://not-allowed.invalid' } }
  await assertStatus(await host.hostFetch(route, crossOrigin), 403)
  const close = { ...request, headers: { ...request.headers, connection: 'close' } }
  await assertStatus(await host.hostFetch(route, { ...close, headers: { ...close.headers, 'content-type': 'text/plain' } }), 415)
  await assertStatus(await host.hostFetch(route, { ...close, body: '{' }), 400)
  let oversized
  try {
    oversized = await host.hostFetch(route, { ...close, body: ' '.repeat(300 * 1024) })
  } catch (error) {
    // The shipped bridge can terminate a connection while the rejected request body is still unread.
    assert.ok(['UND_ERR_SOCKET', 'ECONNRESET'].includes(error.cause?.cause?.code), String(error.cause))
  }
  if (oversized) await assertStatus(oversized, 413)
  const guest = await host.hostFetch('/api/product-engineering-acceptance/non-owner')
  assert.equal(guest.status, 200)
  assert.deepEqual(await guest.json(), { status: 403 })
  assert.deepEqual(success(await host.product({ op: 'list' })), [])
  console.log('PASS installed bundle, native Web and Client asset loading, and HTTP owner access fence')

  const catalog = success(await host.product({ op: 'catalog' }))
  assert.equal(catalog.packs.length, 6)
  assert.equal(catalog.skills.length, 44)
  assert.equal(new Set(catalog.skills.map(skill => skill.name)).size, 44)
  assert.deepEqual(catalog.skills.filter(skill => !skill.modelInvocable).map(skill => skill.name).sort(), explicit)
  assert.ok(catalog.skills.every(skill => skill.userInvocable))

  const workspaceB = join(dirname(harness.workspace), 'other-workspace')
  await mkdir(workspaceB)
  await host.rpc('workspace/create', { request: { path: harness.workspace } })
  await host.rpc('workspace/create', { request: { path: workspaceB } })
  const workspaceBTitle = 'Separate project visibility sentinel'
  const projectB = success(await host.product({ op: 'create', title: workspaceBTitle, workspacePath: workspaceB })).project
  let current = success(await host.product({
    op: 'create', title: 'Acceptance project', summary: 'Find release evidence gaps', workspacePath: harness.workspace,
  }))
  const projectId = current.project.id
  assert.equal(current.project.stage, 'discover')
  assert.equal(current.project.workspacePath, harness.workspace)
  assert.equal(current.release.ready, false)
  assert.ok(current.checks.filter(check => check.required).length >= 4)
  rejected(await host.product({ op: 'get', projectId: '../other-workspace' }), 'invalid-input')

  const get = () => host.product({ op: 'get', projectId }).then(success)
  const mutation = command => host.product({ op: 'mutate', projectId, expectedRevision: current.project.revision, command })
  const commit = async command => {
    const oldRevision = current.project.revision
    current = success(await mutation(command))
    assert.equal(current.project.revision, oldRevision + 1)
    return current
  }

  const secondHost = await harness.start({ parallel: true })
  let conflict
  try {
    conflict = await Promise.all([
      mutation({ kind: 'project.update', title: 'Acceptance winner A' }),
      secondHost.product({ op: 'mutate', projectId, expectedRevision: current.project.revision,
        command: { kind: 'project.update', title: 'Acceptance winner B' } }),
    ])
  } finally {
    await secondHost.close()
  }
  assert.equal(conflict.filter(result => result.ok).length, 1)
  rejected(conflict.find(result => !result.ok), 'conflict')
  current = await get()
  const projectTitle = current.project.title
  assert.equal(projectTitle, success(conflict.find(result => result.ok)).project.title)
  console.log('PASS concurrent writes from independent DSH Web processes preserve a single revision winner')

  await writeFile(join(workspaceB, 'outside.txt'), 'outside workspace sentinel')
  await symlink(join(workspaceB, 'outside.txt'), join(harness.workspace, 'escaping-link.txt'))
  for (const uri of ['../other-workspace/outside.txt', join(workspaceB, 'outside.txt'), 'escaping-link.txt']) {
    rejected(await mutation({ kind: 'evidence.add', evidenceKind: 'file', title: 'Escaping reference', summary: 'Host should reject', uri }),
      'invalid-input', 'forbidden')
  }
  rejected(await mutation({ kind: 'evidence.add', evidenceKind: 'url', title: 'Disallowed URI', summary: 'Host should reject', uri: 'javascript:alert(1)' }), 'invalid-input')
  assert.equal((await get()).project.revision, current.project.revision)
  await writeFile(join(harness.workspace, 'verification.txt'), 'clean acceptance run\n')
  await commit({ kind: 'evidence.add', evidenceKind: 'file', title: 'Fixture verification', summary: 'Verified local file', uri: 'verification.txt' })
  const evidence = current.project.evidence[0]
  assert.equal(evidence.verification, 'snapshot')
  assert.match(evidence.digest, /^[a-f0-9]{64}$/u)
  await commit({ kind: 'evidence.add', evidenceKind: 'note', title: 'Owner observation', summary: 'Reported result from the pilot.' })
  const observation = current.project.evidence.find(item => item.title === 'Owner observation')
  assert.equal(observation.verification, 'reported')
  assert.equal(observation.digest, undefined)
  assert.equal(current.evidence.find(item => item.id === observation.id)?.freshness, 'reported')
  rejected(await mutation({ kind: 'artifact.save', type: 'launch', title: 'Dangling reference', content: 'Should fail.', evidenceIds: [randomUUID()] }), 'invalid-input')
  await commit({ kind: 'artifact.save', type: 'launch', title: 'Launch plan', content: 'Retain a rollback path.', evidenceIds: [evidence.id] })
  rejected(await mutation({ kind: 'stage.move', stage: 'grow' }), 'blocked')

  const briefPath = 'product-brief.md'
  const briefFile = join(harness.workspace, briefPath)
  const briefContent = '# Product brief\n\n    Help owners see delivery risks.\n'
  await writeFile(briefFile, briefContent)
  await writeFile(join(harness.workspace, 'invalid-utf8.md'), Buffer.from([0xc3, 0x28]))
  const importBrief = { kind: 'artifact.importFile', type: 'brief', title: 'Product brief', path: briefPath }
  for (const path of ['../other-workspace/outside.txt', join(workspaceB, 'outside.txt'), 'escaping-link.txt', 'invalid-utf8.md']) {
    rejected(await mutation({ ...importBrief, path }), 'invalid-input', 'forbidden')
  }
  assert.deepEqual(await get(), current, 'Rejected imports do not add an artifact, evidence, or activity')
  await commit({ ...importBrief, evidenceIds: [observation.id] })
  const brief = current.project.artifacts.find(artifact => artifact.type === 'brief')
  assert.equal(brief.content, briefContent)
  assert.ok(brief.evidenceIds.includes(observation.id))
  const snapshot = current.evidence.find(item => item.uri === briefPath && item.verification === 'snapshot')
  assert.ok(brief.evidenceIds.includes(snapshot.id))
  assert.equal(snapshot.freshness, 'current')
  assert.equal(current.project.activity.at(-1).kind, 'artifact.importFile')

  const revisedBrief = `${briefContent}\nThe pilot adds onboarding feedback.\n`
  await writeFile(briefFile, revisedBrief)
  current = await get()
  assert.equal(current.evidence.find(item => item.id === snapshot.id)?.freshness, 'stale')
  await commit({ ...importBrief, id: brief.id })
  const updatedBrief = current.project.artifacts.find(artifact => artifact.id === brief.id)
  assert.equal(updatedBrief.content, revisedBrief)
  assert.equal(current.project.artifacts.filter(artifact => artifact.type === 'brief').length, 1)
  assert.ok(updatedBrief.evidenceIds.includes(observation.id))
  assert.ok(!updatedBrief.evidenceIds.includes(snapshot.id))
  assert.equal(current.evidence.find(item => item.id === snapshot.id)?.freshness, 'stale')
  assert.ok(current.evidence.some(item => updatedBrief.evidenceIds.includes(item.id) && item.uri === briefPath && item.freshness === 'current'))

  await commit({ kind: 'stage.move', stage: 'design' })
  await commit({ kind: 'artifact.save', type: 'plan', title: 'Build plan', content: 'Record release evidence and decisions.' })
  await commit({ kind: 'stage.move', stage: 'build' })
  await commit({ kind: 'decision.add', title: 'Choose rollout scope', context: 'Start with a small group.', options: ['Pilot', 'All accounts'] })
  const decision = current.project.decisions[0]
  rejected(await mutation({ kind: 'decision.resolve', id: decision.id, choice: 'Unlisted choice', rationale: 'Outside available options' }), 'invalid-input')
  const blocked = rejected(await mutation({ kind: 'stage.move', stage: 'ship' }), 'blocked')
  assert.ok(blocked.blockers.some(blocker => blocker.kind === 'pending-decision' && blocker.id === decision.id))
  const blockedReport = success(await host.product({ op: 'export', projectId, format: 'markdown' })).content
  const plan = blockedReport.split('\n## Remediation plan\n')[1]
  assert.ok(plan, 'Blocked reports include the remediation plan')
  assert.match(plan, /Choose rollout scope/u)
  assert.match(plan, /pe-release-gate/u)
  assert.match(plan, /pe-test-harness/u)
  const required = current.checks.filter(check => check.required)
  rejected(await mutation({ kind: 'check.set', id: required[0].id, status: 'passed' }), 'blocked', 'invalid-input')
  console.log('PASS path confinement, atomic artifact import and refresh, evidence freshness, and release blocker remediation')

  const { sessionId } = await host.rpc('session/create', { request: { cwd: harness.workspace } })
  const { skills } = await host.rpc('skills/list', { request: { sessionId } })
  const installedSkills = skills.filter(skill => skill.name.startsWith('pe-'))
  assert.deepEqual(installedSkills.map(skill => skill.name).sort(), catalog.skills.map(skill => skill.name).sort())
  assert.deepEqual(installedSkills.filter(skill => !skill.modelInvocable).map(skill => skill.name).sort(), explicit)
  await prompt(sessionId, '/pe-start-here The project has a launch plan and one open decision.')
  const nativePrompt = await eventually(() => harness.model.requests[0], 'native skill prompt at the loopback model')
  const modelInput = JSON.stringify(nativePrompt)
  assert.match(modelInput, /Find where the work stands and name its next step and skill/u)
  assert.deepEqual(nativePrompt.tools.filter(tool => tool.name.startsWith('product_')).map(tool => tool.name).sort(), toolNames)
  const catalogText = nativePrompt.messages.flatMap(message => message.content ?? [])
    .map(block => block.text).find(text => text?.includes('<available_skills>'))
  const modelCatalog = /<available_skills>([\s\S]*?)<\/available_skills>/u.exec(catalogText ?? '')?.[1]
  assert.ok(modelCatalog, 'Native available-skills section should reach the model')
  const modelSkillNames = Array.from(modelCatalog.matchAll(/^- `(pe-[a-z0-9-]+)`:/gmu), match => match[1]).sort()
  assert.deepEqual(modelSkillNames, catalog.skills.filter(skill => skill.modelInvocable).map(skill => skill.name).sort())
  const modelSkill = await modelTool(sessionId, 'skill', { name: 'pe-code-review' })
  assert.ok(!modelSkill.is_error, JSON.stringify(modelSkill.content))
  assert.match(JSON.stringify(modelSkill.content), /pe-code-review|review/iu)
  const deniedSkill = await modelTool(sessionId, 'skill', { name: 'pe-start-here' })
  assert.match(JSON.stringify(deniedSkill), /not available for model invocation/iu)
  console.log('PASS 44 native skills, direct user invocation, and model invocation policy using scripted model transport')

  const list = await modelTool(sessionId, 'product_list', {})
  assert.match(JSON.stringify(list.content), new RegExp(projectTitle, 'u'))
  assert.ok(!JSON.stringify(list.content).includes(workspaceBTitle))
  const crossWorkspace = await modelTool(sessionId, 'product_get', { projectId: projectB.id })
  assert.match(JSON.stringify(crossWorkspace), /not-found|forbidden|not found|outside/iu)
  assert.ok(!JSON.stringify(crossWorkspace.content).includes(workspaceBTitle))
  const moved = await modelTool(sessionId, 'working_directory', { cd: workspaceB })
  assert.ok(!moved.is_error, JSON.stringify(moved.content))
  assert.ok(JSON.stringify(moved.content).includes(workspaceB))
  const afterMove = await modelTool(sessionId, 'product_get', { projectId: projectB.id })
  assert.match(JSON.stringify(afterMove), /not-found|forbidden|not found|outside/iu)
  assert.ok(!JSON.stringify(afterMove.content).includes(workspaceBTitle))
  const returned = await modelTool(sessionId, 'working_directory', { cd: harness.workspace })
  assert.ok(!returned.is_error, JSON.stringify(returned.content))
  const agentArtifact = await modelTool(sessionId, 'product_record', {
    projectId, expectedRevision: current.project.revision,
    command: { kind: 'artifact.save', type: 'note', title: 'Agent fixture note', content: 'An agent can draft.' },
  })
  assert.ok(!agentArtifact.is_error, JSON.stringify(agentArtifact.content))
  current = await get()
  assert.ok(current.project.artifacts.some(artifact => artifact.title === 'Agent fixture note'))
  assert.equal(current.project.activity.at(-1).actor, 'agent')
  const beforeDenied = current.project.revision
  for (const command of [
    { kind: 'decision.resolve', id: decision.id, choice: 'Pilot', rationale: 'Agent impersonation attempt' },
    { kind: 'check.set', id: required[0].id, status: 'waived', note: 'Agent waiver attempt' },
    { kind: 'stage.move', stage: 'ship' },
  ]) {
    const denied = await modelTool(sessionId, 'product_record', { projectId, expectedRevision: beforeDenied, command })
    assert.match(JSON.stringify(denied.content), /forbidden|requires a human|requires an owner/iu)
  }
  const forged = await modelTool(sessionId, 'product_record', {
    projectId, expectedRevision: beforeDenied, actor: 'human',
    command: { kind: 'decision.resolve', id: decision.id, choice: 'Pilot', rationale: 'Forged actor in JSON' },
  })
  assert.match(JSON.stringify(forged.content), /forbidden|requires a human|requires an owner|invalid|unrecognized field/iu)
  current = await get()
  assert.equal(current.project.revision, beforeDenied)
  assert.equal(current.project.decisions[0].status, 'pending')
  console.log('PASS real DSH tool dispatch with a simulated model, workspace scoping, and owner-only decisions, waivers, and release actions')

  await commit({ kind: 'decision.resolve', id: decision.id, choice: 'Pilot', rationale: 'Validate with five pilot teams' })
  rejected(await mutation({ kind: 'decision.resolve', id: decision.id, choice: 'All accounts', rationale: 'Replace without reopening' }), 'conflict')
  await commit({ kind: 'decision.reopen', id: decision.id, reason: 'Record the owner confirmation again' })
  assert.equal(current.project.decisions[0].status, 'pending')
  await commit({ kind: 'decision.resolve', id: decision.id, choice: 'Pilot', rationale: 'Validate with five pilot teams' })
  for (const check of required.slice(0, -1)) await commit({ kind: 'check.set', id: check.id, status: 'passed', evidenceIds: [evidence.id] })
  await commit({ kind: 'check.set', id: required.at(-1).id, status: 'waived', note: 'Pilot uses a manual rollback' })
  assert.equal(current.release.ready, true)
  await commit({ kind: 'stage.move', stage: 'ship' })
  assert.equal(current.project.stage, 'ship')
  await writeFile(join(harness.workspace, 'verification.txt'), 'different verification result\n')
  current = await get()
  assert.equal(current.release.ready, false)
  assert.ok(current.checks.some(check => check.stale && check.staleEvidenceIds.includes(evidence.id)))
  assert.ok(current.release.blockers.some(blocker => blocker.kind === 'check-stale'))
  rejected(await mutation({ kind: 'stage.move', stage: 'grow' }), 'blocked')
  await writeFile(join(harness.workspace, 'verification.txt'), 'clean acceptance run\n')
  current = await get()
  assert.equal(current.release.ready, true)
  await commit({ kind: 'artifact.save', type: 'note', title: 'Changes after review', content: 'Pilot rollout now covers ten teams.' })
  assert.equal(current.release.ready, false)
  assert.ok(current.checks.find(check => check.id === required.at(-1).id).stale, 'A waiver belongs to the reviewed product revision')
  const md = success(await host.product({ op: 'export', projectId, format: 'markdown' }))
  assert.equal(md.mediaType, 'text/markdown')
  for (const text of ['Validate with five pilot teams', 'Pilot uses a manual rollback', 'stale']) assert.match(md.content, new RegExp(text, 'iu'))
  const json = success(await host.product({ op: 'export', projectId, format: 'json' }))
  assert.equal(json.mediaType, 'application/json')
  const data = JSON.parse(json.content)
  assert.match(JSON.stringify(data), /check-stale|"stale":true/u)
  assert.equal(data.evidence.find(item => item.id === snapshot.id)?.freshness, 'stale')
  await unlink(join(harness.workspace, 'verification.txt'))
  current = await get()
  assert.ok(current.checks.some(check => check.staleEvidenceIds.includes(evidence.id)), 'Deleting the source invalidates the file snapshot')
  console.log('PASS owner readiness, stale waiver and file invalidation, and evidence-aware Markdown and JSON export')

  host = await harness.start()
  assert.deepEqual(await get(), current)
  const { sessionId: reopenedSessionId } = await host.rpc('session/create', { request: { cwd: harness.workspace } })
  assert.equal((await host.rpc('skills/list', { request: { sessionId: reopenedSessionId } })).skills.filter(skill => skill.name.startsWith('pe-')).length, 44)
  await host.close()
  await harness.run('plugin', '--profile', 'web', 'remove', 'dsh-product-engineering')
  host = await harness.start()
  assert.equal((await host.hostFetch(route, request)).status, 404)
  assert.doesNotMatch(await (await host.hostFetch('/')).text(), /dsh-product-engineering\/client\.js/u)
  const { sessionId: cleanSessionId } = await host.rpc('session/create', { request: { cwd: harness.workspace } })
  assert.equal((await host.rpc('skills/list', { request: { sessionId: cleanSessionId } })).skills.filter(skill => skill.name.startsWith('pe-')).length, 0)
  console.log('PASS persisted state after Web restart and route/skill withdrawal after uninstall')
} catch (error) {
  if (host) console.error(host.getOutput())
  throw error
} finally {
  await harness.close()
}
