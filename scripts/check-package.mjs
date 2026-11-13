import { access, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, relative } from 'node:path'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
assert.equal(pkg.name, 'dsh-product-engineering')
assert.equal(pkg.dsh.client.platform, 'web')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
for (const path of ['dist/index.js', 'dist/client.js', 'cordis.patch.yml', 'README.md', 'LICENSE', 'NOTICE.md', 'icon.svg', 'upstream/catalog.json']) {
  assert.ok((await stat(resolve(root, path))).size > 0, `${path} must not be empty`)
}
const catalog = JSON.parse(await readFile(resolve(root, 'upstream/catalog.json'), 'utf8'))
assert.equal(catalog.skills.length, 44, 'Pinned upstream contains 44 skills')
assert.equal(catalog.packs.length, 6, 'Pinned upstream contains six packs')
const names = new Set()
for (const skill of catalog.skills) {
  assert.ok(skill.name.startsWith('pe-'), `Skill name must be isolated: ${skill.name}`)
  assert.ok(!names.has(skill.name), `Duplicate skill ${skill.name}`)
  names.add(skill.name)
  const path = resolve(root, skill.relativePath)
  assert.ok(!relative(root, path).startsWith('..'), `Out of package: ${skill.name}`)
  await access(path)
}
assert.match(catalog.upstream.commit, /^[0-9a-f]{40}$/)
const host = await readFile(resolve(root, 'dist/index.js'), 'utf8')
assert.ok(!host.includes('/Users/howell/'), 'Built host must not embed machine paths')
const client = await readFile(resolve(root, 'dist/client.js'), 'utf8')
assert.ok(client.includes('__ModuleLoader__'), 'Client must use the DSH module loader')
assert.ok(!client.includes('/Users/howell/'), 'Built client must not embed machine paths')
console.log(`Package ready: ${pkg.name}@${pkg.version}; ${catalog.skills.length} skills / ${catalog.packs.length} packs`)
