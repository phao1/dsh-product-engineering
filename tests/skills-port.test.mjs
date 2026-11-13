import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { registerSkills } from '../src/skills-provider.ts'
import catalog from '../upstream/catalog.json' with { type: 'json' }
import inventory from '../upstream/source-files.json' with { type: 'json' }

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const explicitNames = ['pe-handover', 'pe-retro', 'pe-ship-check', 'pe-start-here']

test('each pinned skill has a single native entry with the catalog invocation policy', async () => {
  assert.equal(catalog.skills.length, 44)
  assert.equal(catalog.packs.length, 6)
  assert.deepEqual(catalog.skills.filter(skill => !skill.modelInvocable).map(skill => skill.name).sort(), explicitNames)
  const bundleNames = await readdir(join(packageRoot, 'skills'))
  assert.deepEqual(bundleNames.sort(), catalog.skills.map(skill => skill.name).sort())

  for (const skill of catalog.skills) {
    assert.equal(skill.name, `pe-${skill.originalName}`)
    assert.equal(skill.relativePath, `skills/${skill.name}/SKILL.md`)
    assert.equal(skill.resourceBase, `skills/${skill.name}`)
    assert.equal(skill.sourcePath, `${skill.pack}/skills/${skill.originalName}/SKILL.md`)
    const raw = await readFile(join(packageRoot, skill.relativePath), 'utf8')
    const [, header, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(raw) ?? []
    assert.ok(header && body, skill.name)
    const metadata = Object.fromEntries(header.split('\n').map(line => line.split(/: (.*)/u, 2)))
    assert.equal(metadata.name, skill.name)
    assert.equal(JSON.parse(metadata.description), skill.description)
    assert.equal(metadata['user-invocable'], String(skill.userInvocable))
    assert.equal(metadata['disable-model-invocation'] === 'true', !skill.modelInvocable)
    assert.equal(metadata['allowed-tools'], undefined)
    assert.match(body, /## How you can tell it worked/u)
    assert.match(body, /\bproduct_list\b[\s\S]*\bproduct_get\b[\s\S]*\bproduct_record\b/u)
  }
})

test('all pinned supporting files are present and archived vendor guides keep their source bytes', async () => {
  assert.equal(inventory.repository, catalog.upstream.repository)
  assert.equal(inventory.commit, catalog.upstream.commit)
  assert.equal(inventory.files.length, 197)
  assert.equal(new Set(inventory.files.map(file => file.relativePath)).size, inventory.files.length)

  for (const file of inventory.files) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/u)
    assert.equal((await lstat(join(packageRoot, file.relativePath))).isFile(), true, file.relativePath)
    const exactCopy = file.originalCopy ?? (file.relativePath === 'LICENSE' ? file.relativePath : undefined)
    if (exactCopy !== undefined) {
      const bytes = await readFile(join(packageRoot, exactCopy))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, exactCopy)
    }
  }
})

test('the native provider loads a packaged skill body with its resource directory', async () => {
  const lifetime = new AbortController()
  let provider
  const dispose = registerSkills({
    skills: {
      registerProvider(create) {
        provider = create({ signal: lifetime.signal })
        return () => lifetime.abort(new Error('provider disposed'))
      },
    },
  })

  const candidates = await provider.list()
  assert.equal(candidates.length, 44)
  assert.equal(candidates[0].provider, provider.name)
  assert.equal(candidates[0].rank, 600)
  assert.deepEqual(candidates.filter(skill => !skill.invocation.modelInvocable).map(skill => skill.name).sort(), explicitNames)
  assert.ok(candidates.every(skill => skill.invocation.userInvocable))

  const candidate = candidates.find(skill => skill.name === 'pe-code-review')
  assert.ok(candidate)
  const definition = await provider.get(candidate)
  assert.ok(definition)
  assert.equal(definition.name, candidate.name)
  assert.equal(definition.content.split('\n')[0], '# Code Review')
  assert.equal(definition.path, join(packageRoot, 'skills', 'pe-code-review', 'SKILL.md'))
  assert.deepEqual(definition.resourceBase, { kind: 'directory', path: dirname(definition.path) })
  assert.equal((await lstat(join(definition.resourceBase.path, 'references', 'correctness-taxonomy.md'))).isFile(), true)
  assert.equal(await provider.get({ ...candidate, locator: '../outside' }), undefined)

  const caller = new AbortController()
  caller.abort(new Error('caller cancelled'))
  await assert.rejects(provider.get(candidate, { signal: caller.signal }), /caller cancelled/u)
  dispose()
  await assert.rejects(provider.list(), /provider disposed/u)
  await assert.rejects(provider.get(candidate), /provider disposed/u)
})
