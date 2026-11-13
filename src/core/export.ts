import { createRemediationPlan } from './remediation.ts'
import type { ExportFormat, ProductExport, ProjectView } from './types.ts'

function plain(text: string): string {
  return text.replace(/[\\`*_{}\[\]()#+.!|~=$-]/g, '\\$&').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function inline(text: string): string {
  return plain(text.replace(/\s+/g, ' '))
}

function authoredMarkdown(text: string): string {
  return text.split(/\r\n?|\n/u).map(line => `> ${line.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}`).join('\n')
}

function appendRemediation(lines: string[], view: ProjectView): void {
  const { steps } = createRemediationPlan(view)
  if (steps.length === 0) return
  lines.push('', '## Remediation plan', '', 'The project owner reviews the evidence and records decisions and check outcomes.')
  for (const step of steps) {
    lines.push('', '### ' + inline(step.title), '',
      '- Blocker: ' + step.blockerKind + ' (' + inline(step.id) + ')',
      '- Reason: ' + step.reason,
      '- Action: ' + step.action,
      '- Suggested skill: ' + step.skillId,
      '- Acceptance: ' + step.acceptance,
      '- Owner judgment required: ' + (step.requiresDecision ? 'yes' : 'no'))
    if (step.recordedNote) lines.push('- Recorded check note: ' + inline(step.recordedNote))
    if (step.options?.length) lines.push('- Recorded options: ' + step.options.map(inline).join(' | '))
    if (step.evidenceRefs.length > 0) {
      lines.push('- Linked evidence:')
      for (const evidence of step.evidenceRefs) {
        lines.push('  - ' + inline(evidence.title) + ' (' + inline(evidence.id) + ') · ' + evidence.kind + ' · ' + evidence.freshness)
        if (evidence.uri) lines.push('    - Reference: ' + inline(JSON.stringify(evidence.uri)))
      }
    }
    if (step.missing.length > 0) lines.push('- Gaps:', ...step.missing.map(gap => '  - ' + inline(gap)))
  }
}

function markdown(view: ProjectView): string {
  const { project, checks, release, nextAction } = view
  const lines = [
    `# ${inline(project.title)}`, '',
    `- Stage: ${project.stage}`,
    `- Project ID: ${project.id}`,
    `- Revision: ${project.revision} (review ${project.reviewRevision})`,
    `- Updated: ${project.updatedAt}`, '',
    plain(project.summary), '', '## Release readiness', '',
    release.ready ? 'Ready for an owner decision.' : 'Release review is blocked.', '',
    ...release.blockers.map(blocker => `- ${inline(blocker.title)} (${blocker.kind}, ${blocker.id})`), '',
    '### Checks', '',
  ]
  for (const check of checks) {
    lines.push(`- **${inline(check.title)}** (${check.id}) · ${check.stale ? `stale (recorded ${check.status})` : check.status}`)
    if (check.note) lines.push(`  - ${inline(check.note)}`)
    if (check.evidenceIds.length > 0) lines.push(`  - Evidence IDs: ${check.evidenceIds.join(', ')}`)
    if (check.staleEvidenceIds.length > 0) lines.push(`  - Changed or unavailable files: ${check.staleEvidenceIds.join(', ')}`)
  }
  lines.push('', '## Next action', '')
  switch (nextAction.kind) {
    case 'add-artifact':
      lines.push(`Add a ${nextAction.artifactType} artifact with ${nextAction.skillId}.`)
      break
    case 'resolve-decision':
      lines.push(`Resolve ${inline(nextAction.title)} (${nextAction.id}).`)
      break
    case 'review-check':
      lines.push(`Review ${inline(nextAction.title)} (${nextAction.id}) with ${nextAction.skillId}.`)
      break
    case 'move-stage':
      lines.push(`Move to ${nextAction.stage}.`)
      break
    case 'collect-evidence':
      lines.push(`Collect evidence with ${nextAction.skillId}.`)
      break
  }
  appendRemediation(lines, view)
  lines.push('', '## Decisions', '')
  for (const decision of project.decisions) {
    lines.push(`### ${inline(decision.title)}`, '', `- ID: ${decision.id}`, `- Status: ${decision.status}`,
      `- Options: ${decision.options.map(inline).join(' | ')}`, '')
    if (decision.choice) lines.push(`- Choice: ${inline(decision.choice)}`)
    if (decision.rationale) lines.push(`- Rationale: ${inline(decision.rationale)}`)
    if (decision.evidenceIds.length > 0) lines.push(`- Evidence IDs: ${decision.evidenceIds.join(', ')}`)
    lines.push(plain(decision.context), '')
  }
  lines.push('## Evidence', '')
  const evidenceFreshness = new Map(view.evidence?.map(item => [item.id, item.freshness]))
  for (const evidence of project.evidence) {
    const origin = evidence.verification === 'snapshot'
      ? 'file snapshot · ' + (evidenceFreshness.get(evidence.id) ?? 'unknown')
      : 'reported reference'
    lines.push(`- **${inline(evidence.title)}** (${evidence.id}) · ${evidence.kind} · ${origin} · ${evidence.actor} · ${evidence.createdAt}`)
    if (evidence.uri) lines.push(`  - Reference: ${inline(evidence.uri)}`)
    if (evidence.digest) lines.push(`  - SHA-256: ${evidence.digest}`)
    lines.push(`  - ${inline(evidence.summary)}`)
  }
  lines.push('', '## Artifacts', '')
  for (const artifact of project.artifacts) {
    lines.push(`### ${inline(artifact.title)}`, '', `- ID: ${artifact.id}`, `- Type: ${artifact.type}`)
    if (artifact.skillId) lines.push(`- Skill: ${artifact.skillId}`)
    if (artifact.evidenceIds.length > 0) lines.push(`- Evidence IDs: ${artifact.evidenceIds.join(', ')}`)
    lines.push('', '> **Authored artifact content — not a verification result.**', '>', authoredMarkdown(artifact.content), '')
  }
  lines.push('## Activity', '')
  for (const entry of project.activity) {
    lines.push(`- r${entry.revision} · ${entry.createdAt} · ${entry.actor} · ${entry.kind} · ${inline(entry.label)}`)
    if (entry.detail) lines.push(`  - ${inline(entry.detail)}`)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/** Export the current projection, including release blockers and freshness. */
export function exportProject(view: ProjectView, format: ExportFormat): ProductExport {
  const slug = view.project.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 60) || 'product-project'
  const stem = `${slug}-${view.project.id.slice(0, 8)}`
  return format === 'json'
    ? { filename: `${stem}.json`, mediaType: 'application/json', content: `${JSON.stringify(view, null, 2)}\n` }
    : { filename: `${stem}.md`, mediaType: 'text/markdown', content: markdown(view) }
}
