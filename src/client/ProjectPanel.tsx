import { useEffect, useRef } from 'react'
import {
  IconCheckOutlineRegular, IconChecklistOutlineRegular, IconDownloadOutlineRegular, IconLinkOutlineRegular,
  IconPlusOutlineRegular, IconWorkspaceTreeOutlineMedium,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  STAGES, type CheckView, type EvidenceView, type ExportFormat, type NextAction, type ProjectView, type SkillCatalog,
} from '../core/types.ts'
import { createRemediationPlan } from '../core/remediation.ts'
import type { Modal } from './Forms.tsx'
import type { Key, Translate } from './locales.ts'
import { Badge, Button, Empty, checkLabel, formatDate, localizedSkill, webHref, type Skill, type Tone } from './ui.tsx'
import { remediationLocale } from './workflow.ts'

const sections = ['overview', 'artifacts', 'evidence', 'decisions', 'checks', 'activity'] as const
export type Section = typeof sections[number]

export interface ProjectPanelProps {
  view: ProjectView
  catalog?: SkillCatalog
  section: Section
  focusEvidence?: string
  busy: boolean
  onSection(section: Section): void
  onEvidence(id: string): void
  onOpen(modal: Modal): void
  onLibrary(): void
  onSkill(skill: Skill): void
  onRemediate(checkId: string): void
  onExport(format: ExportFormat): void
  t: Translate
}

function StageRail({ view, t }: { view: ProjectView; t: Translate }) {
  const current = STAGES.indexOf(view.project.stage)
  return (
    <section className="pe-stage-panel">
      <div className="pe-section-heading">
        <h3>{t('stage')}</h3>
        <span className="pe-muted pe-stage-hint">{t('stageRailHint')}</span>
      </div>
      <ol className="pe-stages">
        {STAGES.map((stage, index) => (
          <li
            key={stage}
            className={index === current ? 'pe-stage-current' : index < current ? 'pe-stage-done' : ''}
            aria-current={index === current ? 'step' : undefined}
          >
            <span className="pe-stage-dot" aria-hidden="true">
              {index < current ? <IconCheckOutlineRegular size={12} /> : index + 1}
            </span>
            <span className="pe-stage-name">{t(`stage.${stage}`)}</span>
            <small>{t(`stage.${stage}.description`)}</small>
          </li>
        ))}
      </ol>
    </section>
  )
}

function nextPresentation(action: NextAction, t: Translate): {
  title: string; detail: string; label: Key; modal: Modal
} {
  switch (action.kind) {
    case 'add-artifact':
      return {
        title: t('nextArtifact', { type: t(`artifact.${action.artifactType}`) }), detail: t('nextArtifactHelp'),
        label: 'addArtifact', modal: { kind: 'artifact', artifactType: action.artifactType, skillId: action.skillId },
      }
    case 'collect-evidence':
      return {
        title: t('nextEvidence'), detail: t('nextEvidenceHelp'), label: 'addEvidence', modal: { kind: 'evidence' },
      }
    case 'resolve-decision':
      return {
        title: t('nextDecision', { title: action.title }), detail: t('nextDecisionHelp'),
        label: 'resolveDecision', modal: { kind: 'resolve', id: action.id },
      }
    case 'review-check':
      return {
        title: t('nextCheck', { title: checkLabel(action, t) }), detail: t('nextCheckHelp'),
        label: 'checkEdit', modal: { kind: 'check', id: action.id },
      }
    case 'move-stage':
      return {
        title: t('advance', { stage: t(`stage.${action.stage}`) }), detail: t('nextStageHelp'),
        label: 'stageMove', modal: { kind: 'stage', stage: action.stage },
      }
  }
}

function Overview({ view, catalog, busy, onOpen, onLibrary, onSkill, onSection, onRemediate, t }: ProjectPanelProps) {
  const { project, nextAction } = view
  const plan = createRemediationPlan(view, remediationLocale(t))
  const next = nextPresentation(nextAction, t)
  const preferredId = 'skillId' in nextAction ? nextAction.skillId : undefined
  const preferred = catalog?.skills.find(item => item.name === preferredId)
  const matching = (catalog?.skills ?? []).filter(item => item.stage === project.stage && item.name !== preferredId)
  const recommendations = (preferred ? [preferred, ...matching] : matching).slice(0, 3)
  return (
    <div className="pe-overview">
      <StageRail view={view} t={t} />
      <div className="pe-overview-grid">
        <section className="pe-next">
          <div className="pe-next-kicker"><IconWorkspaceTreeOutlineMedium size={16} />{t('nextAction')}</div>
          <h3>{next.title}</h3>
          <p>{next.detail}</p>
          <div className="pe-actions">
            <Button variant="primary" disabled={busy} onClick={() => onOpen(next.modal)}>
              {t(next.label)}<span aria-hidden="true">→</span>
            </Button>
            {preferred && (
              <Button disabled={busy} onClick={() => onSkill(preferred)}>
                {t('skillOpen')}
              </Button>
            )}
          </div>
        </section>
        <section className="pe-card pe-release">
          <div className="pe-section-heading">
            <h3>{t('release')}</h3>
            <IconChecklistOutlineRegular size={18} />
          </div>
          <p>{t('releaseDescription')}</p>
          {plan.ready
            ? <Badge tone="success">{t('releaseReady')}</Badge>
            : <Badge tone="warning">{t('releaseBlocked', { count: plan.steps.length })}</Badge>}
          <Button variant="quiet" disabled={busy} onClick={() => onSection('checks')}>{t('openChecks')}<span aria-hidden="true">→</span></Button>
        </section>
      </div>
      {plan.steps.length > 0 && (
        <section className="pe-card" aria-label={t('remediationPlan')}>
          <div className="pe-section-heading"><h3>{t('remediationPlan')}</h3></div>
          <ul className="pe-remediation-steps">
            {plan.steps.map(step => {
              const decision = step.kind === 'decision'
              return (
                <li key={`${step.kind}:${step.id}`}>
                  <div>
                    <h4>{decision ? step.title : checkLabel(step, t)}</h4>
                    <p>{step.reason}</p>
                    <p>{step.action}</p>
                  </div>
                  <Button disabled={busy} onClick={() => {
                    if (decision) onOpen({ kind: 'resolve', id: step.id })
                    else onRemediate(step.id)
                  }}>
                    {t(decision ? 'resolveDecision' : 'remediationOpenDraft')}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <section className="pe-card pe-recommendations">
        <div className="pe-section-heading">
          <h3>{t('recommend')}</h3>
          <Button variant="quiet" disabled={busy} onClick={onLibrary}>{t('allSkills')}<span aria-hidden="true">→</span></Button>
        </div>
        {recommendations.length === 0
          ? <Empty text={t(catalog ? 'stageSkillsEmpty' : 'loading')} />
          : <div className="pe-recommendation-grid">
              {recommendations.map(skill => (
                <button key={skill.name} type="button" className="pe-recommendation" disabled={busy} onClick={() => onSkill(skill)}>
                  <span>{localizedSkill(skill, t)}</span>
                  <code>/{skill.name}</code>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>}
      </section>
    </div>
  )
}

function EvidenceLinks({ ids, evidence, onEvidence, t }: {
  ids: string[]; evidence: EvidenceView[]; onEvidence(id: string): void; t: Translate
}) {
  const linked = ids.map(id => evidence.find(item => item.id === id)).filter((item): item is EvidenceView => item !== undefined)
  if (linked.length === 0) return null
  return (
    <ul className="pe-linked-evidence" aria-label={t('evidenceLinks')}>
      {linked.map(item => (
        <li key={item.id}>
          <button type="button" title={t('linkToEvidence', { title: item.title })} onClick={() => onEvidence(item.id)}>
            <IconLinkOutlineRegular size={12} /><span>{item.title}</span>
            {item.freshness === 'stale' && <span className="pe-evidence-link-stale">{t('evidenceStaleShort')}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

const evidenceStates: Record<EvidenceView['freshness'], { tone: Tone; label: Key }> = {
  current: { tone: 'teal', label: 'evidenceSnapshot' },
  reported: { tone: 'neutral', label: 'evidenceReported' },
  stale: { tone: 'warning', label: 'evidenceStale' },
}

function EvidenceLedger({ evidence, focusEvidence, busy, onOpen, t }: {
  evidence: EvidenceView[]; focusEvidence?: string; busy: boolean; onOpen(modal: Modal): void; t: Translate
}) {
  const target = useRef<HTMLElement>(null)
  useEffect(() => {
    if (focusEvidence && target.current) {
      target.current.focus({ preventScroll: true })
      target.current.scrollIntoView({ block: 'nearest' })
    }
  }, [focusEvidence])
  return (
    <div className="pe-record-list">
      {[...evidence].reverse().map(item => {
        const href = item.kind === 'url' ? webHref(item.uri) : undefined
        const state = evidenceStates[item.freshness]
        return (
          <article
            key={item.id} className="pe-record"
            ref={item.id === focusEvidence ? target : undefined}
            tabIndex={item.id === focusEvidence ? -1 : undefined}
          >
            <div className="pe-record-heading">
              <h4>{item.title}</h4>
              <div className="pe-badges">
                <Badge>{t(`evidence.${item.kind}`)}</Badge>
                <Badge tone={state.tone}>{t(state.label)}</Badge>
              </div>
            </div>
            <p className="pe-record-text">{item.summary}</p>
            {item.uri && (
              href
                ? <a className="pe-evidence-url" href={href} target="_blank" rel="noreferrer"><IconLinkOutlineRegular size={14} />{item.uri}</a>
                : <code className="pe-evidence-path">{item.uri}</code>
            )}
            {item.digest && (
              <details className="pe-record-details">
                <summary>{t('evidenceDigest')}</summary>
                <code>{item.digest}</code>
              </details>
            )}
            <time dateTime={item.createdAt}>{formatDate(item.createdAt, t)}</time>
            {item.freshness === 'stale' && item.kind === 'file' && item.uri && (
              <div className="pe-actions">
                <Button disabled={busy} onClick={() => onOpen({ kind: 'evidence', recaptureId: item.id })}>{t('evidenceRecapture')}</Button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

const checkTones: Record<CheckView['status'], Tone> = {
  pending: 'neutral', passed: 'success', failed: 'error', waived: 'warning',
}

function Records(props: ProjectPanelProps) {
  const { view, catalog, section, focusEvidence, busy, onOpen, onEvidence, t } = props
  const { project, checks, evidence } = view
  const evidenceProps = { evidence, onEvidence, t }
  const title = t(section)
  let add: { modal: Modal; label: Key } | undefined
  let body
  switch (section) {
    case 'artifacts':
      add = { modal: { kind: 'artifact' }, label: 'addArtifact' }
      body = project.artifacts.length === 0 ? <Empty text={t('artifactEmpty')} /> : (
        <div className="pe-record-list">
          {[...project.artifacts].reverse().map(item => {
            const skill = catalog?.skills.find(candidate => candidate.name === item.skillId)
            return (
              <article key={item.id} className="pe-record">
                <div className="pe-record-heading">
                  <h4>{item.title}</h4>
                  <Button disabled={busy} onClick={() => onOpen({ kind: 'artifact', id: item.id })}>{t('editArtifact')}</Button>
                </div>
                <div className="pe-badges">
                  <Badge>{t(`artifact.${item.type}`)}</Badge>
                  {item.skillId && <Badge tone="teal">{skill ? localizedSkill(skill, t) : item.skillId}</Badge>}
                </div>
                <details className="pe-record-details">
                  <summary>{t('artifactContent')}</summary>
                  <p className="pe-record-text">{item.content}</p>
                </details>
                <EvidenceLinks ids={item.evidenceIds} {...evidenceProps} />
                <time dateTime={item.updatedAt}>{formatDate(item.updatedAt, t)}</time>
              </article>
            )
          })}
        </div>
      )
      break
    case 'evidence':
      add = { modal: { kind: 'evidence' }, label: 'addEvidence' }
      body = evidence.length === 0
        ? <Empty text={t('evidenceEmpty')} />
        : <EvidenceLedger evidence={evidence} focusEvidence={focusEvidence} busy={busy} onOpen={onOpen} t={t} />
      break
    case 'decisions':
      add = { modal: { kind: 'decision' }, label: 'addDecision' }
      body = project.decisions.length === 0 ? <Empty text={t('decisionEmpty')} /> : (
        <div className="pe-record-list">
          {[...project.decisions].reverse().map(item => (
            <article key={item.id} className="pe-record">
              <div className="pe-record-heading">
                <h4>{item.title}</h4>
                <Badge tone={item.status === 'pending' ? 'warning' : 'success'}>{t(`decision.${item.status}`)}</Badge>
              </div>
              <p className="pe-record-text">{item.context}</p>
              {item.status === 'pending'
                ? <ul className="pe-options">{item.options.map(option => <li key={option}>{option}</li>)}</ul>
                : <div className="pe-form-context"><strong>{item.choice}</strong><p>{item.rationale}</p></div>}
              <EvidenceLinks ids={item.evidenceIds} {...evidenceProps} />
              <div className="pe-actions">
                <Button disabled={busy} onClick={() => onOpen({ kind: item.status === 'pending' ? 'resolve' : 'reopen', id: item.id })}>
                  {t(item.status === 'pending' ? 'resolveDecision' : 'reopenDecision')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )
      break
    case 'checks':
      body = <>
        <p className="pe-muted pe-section-caption">{t('checkHelp')}</p>
        <div className="pe-record-list">
          {checks.map(item => (
            <article key={item.id} className="pe-record">
              <div className="pe-record-heading">
                <h4>{checkLabel(item, t)}</h4>
                <Badge tone={item.stale ? 'warning' : checkTones[item.status]}>
                  {t(item.stale ? 'check.stale' : `check.${item.status}`)}
                </Badge>
              </div>
              <small>{t(`category.${item.category}`)}</small>
              {item.stale && <p className="pe-form-warning">{t('staleHelp')}</p>}
              {item.note && <p className="pe-record-text">{item.note}</p>}
              <EvidenceLinks ids={item.evidenceIds} {...evidenceProps} />
              <div className="pe-actions">
                <Button disabled={busy} onClick={() => onOpen({ kind: 'check', id: item.id })}>{t('checkEdit')}</Button>
              </div>
            </article>
          ))}
        </div>
      </>
      break
    case 'activity':
      body = project.activity.length === 0 ? <Empty text={t('activityEmpty')} /> : (
        <ol className="pe-activity">
          {[...project.activity].reverse().map(item => (
            <li key={item.id}>
              <div><strong>{t(`activity.${item.kind}`)}</strong><span>{item.label}</span></div>
              <div>
                <Badge>{t(item.actor === 'human' ? 'activityHuman' : 'activityAgent')}</Badge>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt, t)}</time>
              </div>
              {item.detail && <p className="pe-activity-detail">{item.detail}</p>}
            </li>
          ))}
        </ol>
      )
      break
    case 'overview':
      return null
  }

  return (
    <section className="pe-card pe-records" aria-label={title}>
      <div className="pe-section-heading">
        <h3>{title}</h3>
        {add && <Button variant="primary" disabled={busy} onClick={() => onOpen(add.modal)}><IconPlusOutlineRegular size={14} />{t(add.label)}</Button>}
      </div>
      {body}
    </section>
  )
}

export function ProjectPanel(props: ProjectPanelProps) {
  const { view, section, busy, onSection, onOpen, onExport, t } = props
  const { project } = view
  return (
    <section className="pe-project-panel" aria-label={t('projectDetails')}>
      <div className="pe-project-header">
        <div className="pe-project-heading">
          <div className="pe-project-meta">
            <Badge tone="teal">{t(`stage.${project.stage}`)}</Badge>
            <span>{t('revision', { revision: project.revision })}</span>
          </div>
          <h2>{project.title}</h2>
          <p>{project.summary || t('noSummary')}</p>
          <div className="pe-project-location">
            <code title={project.workspacePath}>{project.workspacePath}</code>
            <span aria-hidden="true">·</span>
            <time dateTime={project.updatedAt}>{t('updated', { date: formatDate(project.updatedAt, t) })}</time>
          </div>
        </div>
        <div className="pe-project-actions">
          <Button disabled={busy} onClick={() => onOpen({ kind: 'project' })}>{t('editProject')}</Button>
          <details className="pe-export">
            <summary className="pe-button pe-button--secondary" aria-disabled={busy}><IconDownloadOutlineRegular size={15} />{t('export')}</summary>
            <div className="pe-export-actions">
              <Button variant="quiet" disabled={busy} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onExport('markdown') }}>{t('exportMarkdown')}</Button>
              <Button variant="quiet" disabled={busy} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); onExport('json') }}>{t('exportJson')}</Button>
            </div>
          </details>
        </div>
      </div>
      <nav className="pe-project-tabs" aria-label={t('projectDetails')}>
        {sections.map(item => (
          <button key={item} type="button" aria-current={section === item ? 'page' : undefined} disabled={busy} onClick={() => onSection(item)}>
            {t(item)}
          </button>
        ))}
      </nav>
      {section === 'overview' ? <Overview {...props} /> : <Records {...props} />}
    </section>
  )
}
