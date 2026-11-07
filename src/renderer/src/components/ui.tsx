import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { useStore } from '../store'
import { formatDate, fromParts, toParts } from '../calendar'
import type { WorldDate } from '../types'
import { renderBody } from './prose'

/** Значки кнопок, которые что-то меняют в мире — их прячет режим игрока */
const EDIT_ICONS = new Set<IconName>(['trash', 'plus', 'image', 'pen', 'shield', 'brush'])

export const assetUrl = (rel: string | undefined | null): string => {
  if (!rel) return ''
  // «лист.svg#svgView(viewBox(…))» — кусок листа портретов в веб-сборке: фрагмент после # не кодируем
  const i = rel.indexOf('#')
  const path = i < 0 ? rel : rel.slice(0, i)
  return `${window.api.assetBase}${path.split('/').map(encodeURIComponent).join('/')}${i < 0 ? '' : rel.slice(i)}`
}

/** План города (контуры зданий). В веб-сборке все планы лежат одним файлом: «plans.json#slug» */
const bundles = new Map<string, Promise<Record<string, unknown>>>()
export function loadPlan<T>(rel: string): Promise<T> {
  const [file, key] = rel.split('#')
  if (!key) return fetch(assetUrl(file)).then((r) => r.json())
  if (!bundles.has(file)) bundles.set(file, fetch(assetUrl(file)).then((r) => r.json()))
  return bundles.get(file)!.then((b) => b[key] as T)
}

/** Поле, которое сохраняет значение по потере фокуса — без записи в историю на каждую букву. */
export function TextField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  rows = 4,
  className
}: {
  label?: string
  value: string | undefined
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
  rows?: number
  className?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [editing, setEditing] = useState(false)
  const ro = useStore((s) => !s.masterMode)
  const world = useStore((s) => s.world)
  useEffect(() => setDraft(value ?? ''), [value])
  const commit = (): void => {
    setEditing(false)
    if (draft !== (value ?? '')) onChange(draft)
  }
  // многострочный текст показываем с разметкой (**жирный**, списки, заголовки, [[ссылки]]), а правим — по нажатию
  if (multiline && !editing && draft.trim() && world) {
    const goto = (eid: string): void => {
      const st = useStore.getState()
      const target = st.world?.entries.find((e) => e.id === eid)
      if (!target) return
      st.setView(target.kind)
      st.select({ type: 'entry', id: eid })
    }
    return (
      <div className={`field ${className ?? ''}`}>
        {label && <span className="field-label">{label}</span>}
        <div
          className={`field-text prose${ro ? '' : ' editable'}`}
          title={ro ? undefined : 'Нажмите, чтобы править'}
          onClick={(e) => {
            if (ro || (e.target as HTMLElement).closest('button')) return
            setEditing(true)
          }}
        >
          {renderBody(draft, world, goto)}
        </div>
      </div>
    )
  }
  return (
    <label className={`field ${className ?? ''}`}>
      {label && <span className="field-label">{label}</span>}
      {multiline ? (
        <textarea
          value={draft}
          readOnly={ro}
          rows={rows}
          autoFocus={editing}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          value={draft}
          readOnly={ro}
          placeholder={ro ? '' : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      )}
    </label>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max
}: {
  label?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  const ro = useStore((s) => !s.masterMode)
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <input type="number" disabled={ro} value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const ro = useStore((s) => !s.masterMode)
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <select value={value} disabled={ro} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Button({
  icon,
  children,
  onClick,
  variant = 'default',
  title,
  active,
  disabled
}: {
  icon?: IconName
  children?: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  title?: string
  active?: boolean
  disabled?: boolean
}) {
  const ro = useStore((s) => !s.masterMode)
  // в режиме игрока кнопки правки скрыты
  if (ro && icon && EDIT_ICONS.has(icon)) return null
  return (
    <button
      className={`btn btn-${variant} ${active ? 'active' : ''} ${children ? '' : 'btn-icon'}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={16} />}
      {children && <span>{children}</span>}
    </button>
  )
}

export function ImageField({
  label,
  value,
  folder,
  onChange,
  shape = 'rect'
}: {
  label?: string
  value: string
  folder: string
  onChange: (v: string) => void
  shape?: 'rect' | 'round' | 'flag'
}) {
  const ro = useStore((s) => !s.masterMode)
  const pick = async (): Promise<void> => {
    if (ro) return
    const rel = await window.api.importImage(folder)
    if (rel) onChange(rel)
  }
  return (
    <div className={`image-field image-${shape}`}>
      {label && <span className="field-label">{label}</span>}
      <button className="image-slot" onClick={pick} title="Выбрать изображение">
        {value ? <img src={assetUrl(value)} alt="" /> : <Icon name="image" size={28} />}
      </button>
      {value && !ro && (
        <button className="image-clear" onClick={() => onChange('')} title="Убрать">
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  )
}

/** Выбор даты мира: день, месяц, год и эра. null — «не задано». */
export function DateField({
  label,
  value,
  onChange,
  allowEmpty = true
}: {
  label?: string
  value: WorldDate | null | undefined
  onChange: (v: WorldDate | null) => void
  allowEmpty?: boolean
}) {
  const cal = useStore((s) => s.world!.calendar)
  const current = useStore((s) => s.date)
  const ro = useStore((s) => !s.masterMode)
  const empty = value === null || value === undefined
  const p = toParts(cal, empty ? current : value)
  const set = (patch: Partial<typeof p>): void => onChange(fromParts(cal, { ...p, ...patch }))
  return (
    <div className="field date-field">
      {label && <span className="field-label">{label}</span>}
      {ro ? (
        <div className="date-readonly">{empty ? '—' : formatDate(cal, value!)}</div>
      ) : empty ? (
        <div className="date-empty">
          <span className="muted">не задано</span>
          <button className="link-btn" onClick={() => onChange(current)}>
            задать текущей датой
          </button>
        </div>
      ) : (
        <div className="date-inputs">
          <input
            type="number"
            className="d-day"
            value={p.day}
            min={1}
            max={cal.months[p.month]?.days}
            onChange={(e) => set({ day: Number(e.target.value) })}
          />
          <select value={p.month} onChange={(e) => set({ month: Number(e.target.value) })}>
            {cal.months.map((m, i) => (
              <option key={i} value={i}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="d-year"
            value={Math.abs(p.year)}
            min={1}
            onChange={(e) => set({ year: Math.max(1, Number(e.target.value)) * (p.year < 0 ? -1 : 1) })}
          />
          <select value={p.year < 0 ? 'b' : 'a'} onChange={(e) => set({ year: Math.abs(p.year) * (e.target.value === 'b' ? -1 : 1) })}>
            <option value="a">{cal.eraAfterShort}</option>
            <option value="b">{cal.eraBeforeShort}</option>
          </select>
          {allowEmpty && (
            <button className="icon-btn" onClick={() => onChange(null)} title="Очистить">
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function DateLabel({ date }: { date: WorldDate | null | undefined }) {
  const cal = useStore((s) => s.world!.calendar)
  const setDate = useStore((s) => s.setDate)
  if (date === null || date === undefined) return <span className="muted">—</span>
  return (
    <button className="date-chip" onClick={() => setDate(date)} title="Перейти к дате">
      <Icon name="hourglass" size={12} />
      {formatDate(cal, date)}
    </button>
  )
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`}>
        <button className="modal-close" onClick={onClose}>
          <Icon name="x" />
        </button>
        {children}
      </div>
    </div>
  )
}

export function Section({ title, icon, children, actions }: { title: string; icon?: IconName; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        {icon && <Icon name={icon} size={16} />}
        <h3>{title}</h3>
        <div className="section-actions">{actions}</div>
      </header>
      <div className="section-body">{children}</div>
    </section>
  )
}

/** Выбор из списка сущностей с поиском (простой select). */
export function RefField({
  label,
  value,
  items,
  onChange,
  emptyLabel = '— нет —'
}: {
  label?: string
  value: string
  items: { id: string; name: string }[]
  onChange: (id: string) => void
  emptyLabel?: string
}) {
  const ro = useStore((s) => !s.masterMode)
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <select value={value || ''} disabled={ro} onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {sorted.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name || 'Без названия'}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ColorField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const ro = useStore((s) => !s.masterMode)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <label className="field color-field">
      {label && <span className="field-label">{label}</span>}
      <input type="color" disabled={ro} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onChange(draft)} />
    </label>
  )
}

export function EditModeSwitch() {
  const ro = useStore((s) => !s.masterMode)
  const mode = useStore((s) => s.editMode)
  const setMode = useStore((s) => s.setEditMode)
  const cal = useStore((s) => s.world!.calendar)
  const date = useStore((s) => s.date)
  if (ro) return null
  return (
    <div className="edit-mode" title="Как сохранять правки полей, которые меняются со временем">
      <button className={mode === 'base' ? 'active' : ''} onClick={() => setMode('base')}>
        Правка всегда
      </button>
      <button className={mode === 'dated' ? 'active' : ''} onClick={() => setMode('dated')}>
        Изменение с {formatDate(cal, date)}
      </button>
    </div>
  )
}
