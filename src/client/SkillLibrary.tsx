import { useState } from 'react'
import { IconSearchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { STAGES, type ProjectSummary, type SkillCatalog, type Stage } from '../core/types.ts'
import type { Translate } from './locales.ts'
import { skillDescription } from './skill-copy.ts'
import { Badge, Button, Empty, localizedSkill, type Skill } from './ui.tsx'

function matches(skill: Skill, query: string, t: Translate): boolean {
  return [skill.title, skill.titleZh, skillDescription(skill, t).text, skill.description, skill.name, skill.originalName, skill.pack]
    .some(value => value.toLocaleLowerCase().includes(query))
}

export function SkillLibrary({ catalog, project, busy, onSkill, onCopy, t }: {
  catalog: SkillCatalog; project?: ProjectSummary; busy: boolean
  onSkill(skill: Skill): void; onCopy(skill: Skill): void; t: Translate
}) {
  const [pack, setPack] = useState('')
  const [stage, setStage] = useState<Stage | ''>('')
  const [search, setSearch] = useState('')
  const query = search.trim().replace(/^\//u, '').toLocaleLowerCase()
  const rows = catalog.skills.filter(skill => (pack === '' || pack === skill.pack)
    && (stage === '' || stage === skill.stage)
    && (query === '' || matches(skill, query, t)))

  function packTitle(id: string): string {
    const pack = catalog.packs.find(item => item.id === id)
    if (!pack) return id
    return t('locale') === 'zh-CN' ? pack.titleZh : pack.title
  }

  return (
    <section className="pe-library" aria-label={t('library')}>
      <div className="pe-library-header">
        <div>
          <h2>{t('library')}</h2>
          <p>{t('skillsIntro')}</p>
        </div>
        {project && <Badge tone="teal">{t('projectContext', { title: project.title })}</Badge>}
      </div>
      <div className="pe-pack-filters" role="group" aria-label={t('skillFilter')}>
        <button type="button" aria-pressed={pack === ''} onClick={() => setPack('')}>
          {t('allPacks')}<span>{catalog.skills.length}</span>
        </button>
        {catalog.packs.map(item => (
          <button key={item.id} type="button" aria-pressed={pack === item.id} onClick={() => setPack(item.id)} title={item.description}>
            {packTitle(item.id)}<span>{catalog.skills.filter(skill => skill.pack === item.id).length}</span>
          </button>
        ))}
      </div>
      <div className="pe-library-tools">
        <div className="pe-search">
          <IconSearchOutlineRegular size={17} />
          <input
            type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder={t('skillSearchHint')} aria-label={t('searchSkills')}
          />
        </div>
        <select aria-label={t('skillStages')} value={stage} onChange={(event) => {
          const next = STAGES.find(item => item === event.target.value)
          setStage(next ?? '')
        }}>
          <option value="">{t('allStages')}</option>
          {STAGES.map(item => <option key={item} value={item}>{t(`stage.${item}`)}</option>)}
        </select>
        <span className="pe-result-count" role="status">{t('skillsCount', { count: rows.length })}</span>
      </div>
      {rows.length === 0
        ? <Empty text={t('noSkillMatches')} />
        : <div className="pe-skill-grid">
            {rows.map(skill => {
              const description = skillDescription(skill, t)
              return (
              <article key={skill.name} className="pe-card pe-skill">
                <div className="pe-skill-meta">
                  <span>{packTitle(skill.pack)}</span>
                  <Badge>{t(`stage.${skill.stage}`)}</Badge>
                </div>
                <h3>{localizedSkill(skill, t)}</h3>
                <code>/{skill.name}</code>
                <p className="pe-skill-description" lang={description.lang}>{description.text}</p>
                <div className="pe-actions pe-skill-actions">
                  <Button disabled={busy || !skill.userInvocable} onClick={() => onSkill(skill)}>
                    {t('skillOpen')}<span aria-hidden="true">↗</span>
                  </Button>
                  <Button variant="quiet" onClick={() => onCopy(skill)}>{t('skillCopy')}</Button>
                </div>
              </article>
              )
            })}
          </div>}
    </section>
  )
}
