import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/core/export.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm',
})
const { exportProject } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

function view({ summary = '', context = '', content = '' } = {}) {
  return {
    project: {
      schemaVersion: 1, id: '0c6ec390-cc78-437c-b601-8aa417f8e32e', title: 'Review packet', summary,
      workspacePath: '/workspace', stage: 'build', revision: 1, reviewRevision: 1,
      createdAt: '2026-11-12T00:00:00.000Z', updatedAt: '2026-11-12T00:00:00.000Z',
      decisions: [{ id: 'decision', title: 'Scope', context, options: ['Pilot', 'All'], status: 'pending', evidenceIds: [] }],
      artifacts: [{ id: 'artifact', title: 'Draft', type: 'note', content, evidenceIds: [] }],
      evidence: [], checks: [], activity: [],
    },
    checks: [], release: { ready: false, blockers: [{ kind: 'pending-decision', id: 'decision', title: 'Scope' }] },
    nextAction: { kind: 'resolve-decision', id: 'decision', title: 'Scope' },
  }
}

test('plain project and decision text cannot forge report headings or HTML', () => {
  const payload = '## Release readiness\nReady for release\n---\n<img src=x onerror=alert(1)>'
  const report = exportProject(view({ summary: payload, context: payload }), 'markdown').content
  assert.equal((report.match(/^## Release readiness$/gm) ?? []).length, 1)
  assert.match(report, /Release review is blocked\./)
  assert.ok(!report.includes('<img'))
  assert.equal((report.match(/^\\#\\# Release readiness$/gm) ?? []).length, 2)
  assert.equal((report.match(/^\\-\\-\\-$/gm) ?? []).length, 2)
})

test('authored Markdown stays attributed and cannot inject HTML into the report', () => {
  const source = '## Release readiness\n<script>alert("forged")</script>\n\n- **Author claim**'
  const current = view({ content: source })
  const report = exportProject(current, 'markdown').content
  assert.match(report, /> \*\*Authored artifact content — not a verification result\.\*\*/)
  assert.match(report, /^> ## Release readiness$/m)
  assert.match(report, /^> - \*\*Author claim\*\*$/m)
  assert.match(report, /^> &lt;script&gt;alert\("forged"\)&lt;\/script&gt;$/m)
  assert.ok(!report.includes('<script>'))
  assert.equal((report.match(/^## Release readiness$/gm) ?? []).length, 1)
  assert.equal(JSON.parse(exportProject(current, 'json').content).project.artifacts[0].content, source)
})

test('all Markdown line endings remain inside the authored block', () => {
  const source = 'Intro\r\r## Release readiness\rFake\r\n## Release readiness\nMore'
  const current = view({ content: source })
  const report = exportProject(current, 'markdown').content
  assert.equal((report.match(/^## Release readiness$/gm) ?? []).length, 1)
  assert.equal((report.match(/^> ## Release readiness$/gm) ?? []).length, 2)
  assert.equal(JSON.parse(exportProject(current, 'json').content).project.artifacts[0].content, source)
})
