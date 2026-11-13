import { evidenceViews } from './evidence.ts'
import { REQUIRED_CHECKS, STAGES, type Check, type CheckView, type EvidenceView, type NextAction, type Project, type ProjectView, type ReleaseBlocker, type Stage } from './types.ts'

export function defaultChecks(): Check[] {
  return REQUIRED_CHECKS.map(({ id, title, category }) => ({ id, title, category, required: true, status: 'pending', evidenceIds: [] }))
}

function checkViews(project: Project, evidence: readonly EvidenceView[]): CheckView[] {
  const available = new Set(evidence.filter(item => item.freshness !== 'stale').map(item => item.id))
  return project.checks.map(check => {
    const reviewed = check.status === 'passed' || check.status === 'waived'
    const staleEvidenceIds = check.evidenceIds.filter(id => !available.has(id))
    return {
      ...check,
      stale: reviewed && (check.reviewedRevision !== project.reviewRevision || staleEvidenceIds.length > 0),
      staleEvidenceIds,
    }
  })
}

export function releaseBlockers(project: Project, checks: readonly CheckView[]): ReleaseBlocker[] {
  const blockers: ReleaseBlocker[] = project.decisions.filter(decision => decision.status === 'pending')
    .map(({ id, title }) => ({ kind: 'pending-decision', id, title }))
  for (const { id, title, required, status, evidenceIds, stale } of checks) {
    if (!required) continue
    if (status === 'pending') blockers.push({ kind: 'check-pending', id, title })
    else if (status === 'failed') blockers.push({ kind: 'check-failed', id, title })
    else if (status === 'passed' && evidenceIds.length === 0) blockers.push({ kind: 'check-missing-evidence', id, title })
    else if (stale) blockers.push({ kind: 'check-stale', id, title })
  }
  return blockers
}

function checkAction(blocker: ReleaseBlocker): NextAction {
  if (blocker.kind === 'pending-decision') return { kind: 'resolve-decision', id: blocker.id, title: blocker.title }
  const skillId = REQUIRED_CHECKS.find(check => check.id === blocker.id)?.skillId ?? 'pe-release-gate'
  return { kind: 'review-check', id: blocker.id, title: blocker.title, skillId }
}

function nextAction(project: Project, blockers: readonly ReleaseBlocker[]): NextAction {
  const pendingDecision = blockers.find(blocker => blocker.kind === 'pending-decision')
  if (pendingDecision !== undefined) return checkAction(pendingDecision)
  switch (project.stage) {
    case 'discover':
      return project.artifacts.some(artifact => artifact.type === 'brief')
        ? { kind: 'move-stage', stage: 'design' }
        : { kind: 'add-artifact', artifactType: 'brief', skillId: 'pe-propose' }
    case 'design':
      return project.artifacts.some(artifact => artifact.type === 'prd' || artifact.type === 'plan')
        ? { kind: 'move-stage', stage: 'build' }
        : { kind: 'add-artifact', artifactType: 'plan', skillId: 'pe-app-lifecycle' }
    case 'build':
      return blockers[0] === undefined ? { kind: 'move-stage', stage: 'ship' } : checkAction(blockers[0])
    case 'ship':
      if (blockers[0] !== undefined) return checkAction(blockers[0])
      return project.artifacts.some(artifact => artifact.type === 'launch')
        ? { kind: 'move-stage', stage: 'grow' }
        : { kind: 'add-artifact', artifactType: 'launch', skillId: 'pe-release-gate' }
    case 'grow':
      return blockers[0] === undefined ? { kind: 'collect-evidence', skillId: 'pe-product-analytics' } : checkAction(blockers[0])
  }
}

export function projectView(project: Project): ProjectView {
  const evidence = evidenceViews(project.workspacePath, project.evidence)
  const checks = checkViews(project, evidence)
  const blockers = releaseBlockers(project, checks)
  return { project, evidence, checks, release: { ready: blockers.length === 0, blockers }, nextAction: nextAction(project, blockers) }
}

export function stageAdvance(project: Project, stage: Stage): { message: string; blockers?: ReleaseBlocker[] } | undefined {
  const current = STAGES.indexOf(project.stage)
  const target = STAGES.indexOf(stage)
  if (target === current) return { message: 'Project is already at that stage.' }
  if (target < current) return undefined
  if (target !== current + 1) return { message: 'Advance one stage at a time.' }
  if (stage === 'design' && !project.artifacts.some(artifact => artifact.type === 'brief')) {
    return { message: 'Add a brief before moving to design.' }
  }
  if (stage === 'build' && !project.artifacts.some(artifact => artifact.type === 'prd' || artifact.type === 'plan')) {
    return { message: 'Add a PRD or plan before moving to build.' }
  }
  if (stage === 'ship' || stage === 'grow') {
    const reviewedIds = new Set(project.checks.filter(check => check.status === 'passed' || check.status === 'waived')
      .flatMap(check => check.evidenceIds))
    const evidence = evidenceViews(project.workspacePath, project.evidence.filter(item => reviewedIds.has(item.id)))
    const blockers = releaseBlockers(project, checkViews(project, evidence))
    if (blockers.length > 0) return { message: 'Resolve the open release blockers before advancing.', blockers }
  }
  if (stage === 'grow' && !project.artifacts.some(artifact => artifact.type === 'launch')) {
    return { message: 'Add a launch record before moving to grow.' }
  }
  return undefined
}
