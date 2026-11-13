import { useId, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react'
import { IconCloseOutlineRegular, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Check, ProductExport, SkillCatalog } from '../core/types.ts'
import type { Key, Translate } from './locales.ts'

export type Skill = SkillCatalog['skills'][number]
export type Tone = 'neutral' | 'teal' | 'success' | 'warning' | 'error'

export function Button({
  variant = 'secondary', type = 'button', className = '', ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button {...props} type={type} className={`pe-button pe-button--${variant} ${className}`} />
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`pe-badge pe-badge--${tone}`}>{children}</span>
}

export function Feedback({ loading, error, onRetry, t }: {
  loading?: boolean; error?: Key; onRetry?: () => void; t: Translate
}) {
  if (error) {
    return (
      <div className="pe-feedback pe-feedback--error" role="alert">
        <span>{t(error)}</span>
        {onRetry && <Button onClick={onRetry}><IconRefreshOutlineRegular size={14} />{t('retry')}</Button>}
      </div>
    )
  }
  return loading ? <div className="pe-feedback" role="status"><span className="pe-spinner" aria-hidden="true" />{t('loading')}</div> : null
}

export function Dialog({ title, busy, error, onClose, t, children }: {
  title: string; busy: boolean; error?: Key; onClose(): void; t: Translate; children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const node = dialog.current
    node?.showModal()
    return () => { node?.close() }
  }, [])
  return (
    <dialog
      ref={dialog} className="pe-dialog" data-dsh-pe="" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    >
      <div className="pe-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="quiet" className="pe-icon-button" disabled={busy} aria-label={t('close')} onClick={onClose}>
          <IconCloseOutlineRegular size={17} />
        </Button>
      </div>
      <div className="pe-dialog-body">
        <Feedback error={error} t={t} />
        {children}
      </div>
    </dialog>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="pe-field">
      <span className="pe-field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="pe-section-empty">{text}</p>
}

export function localizedSkill(skill: Skill, t: Translate): string {
  return t('locale') === 'zh-CN' ? skill.titleZh : skill.title
}

export function checkLabel(check: Pick<Check, 'id' | 'title'>, t: Translate): string {
  switch (check.id) {
    case 'product-scope':
    case 'tests':
    case 'independent-review':
    case 'release-plan':
      return t(`check.${check.id}`)
    default:
      return check.title
  }
}

export function formatDate(value: string, t: Translate): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(t('locale'), { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function webHref(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export function download(file: ProductExport): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: `${file.mediaType};charset=utf-8` }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Retain the object until the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
