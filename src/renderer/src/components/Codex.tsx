import { useMemo, useState, type ReactNode } from 'react'
import { useStore, applyTemporal } from '../store'
import { existsAt, resolve } from '../temporal'
import { KINDS } from '../constants'
import { formatDate, toParts, formatYear } from '../calendar'
import { newEntry, newState, randomColor } from '../model'
import { Button, DateField, EditModeSwitch, ImageField, RefField, TextField, assetUrl } from './ui'
import { HistoryList } from './Inspector'
import { Icon } from './Icon'
import { CoatOfArms, Flag, defaultHeraldry } from './Heraldry'
import { SuccessionCouncilView } from './Council'
import { Fullscreen, PanZoom } from './PanZoom'
import { DynastyTree } from './DynastyTree'
import { BookReader } from './BookReader'
import { TingView } from './Ting'
import { BroodView } from './Brood'
import { VaultView } from './Vault'
import { HeightsView } from './Heights'
import { UrnView } from './Urn'
import { FleetView } from './Fleet'
import { LanternView } from './Lantern'
import { ThresholdView } from './Threshold'
import { WallView } from './Wall'
import { CartView } from './Cart'
import { FordsView } from './Fords'
import { WillowView } from './Willow'
import { StavkaView } from './Stavka'
import { AdvisorsGrid } from './Advisors'
import { renderBody } from './prose'
import { PowerView } from './PowerView'
import { bookTheme } from '../books'
import type { Entry, EntryFields, EntryKind, WorldData } from '../types'

export function StatesView() {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mutate = useStore((s) => s.mutate)
  const openCard = useStore((s) => s.openStateCard)
  const [q, setQ] = useState('')
  const [showDead, setShowDead] = useState(false)
  const list = world.states
    .map((s) => ({ s, f: resolve(s, date), alive: existsAt(s, date) }))
    .filter((x) => (showDead || x.alive) && x.f.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.f.name.localeCompare(b.f.name, 'ru'))

  return (
    <div className="page">
      <header className="page-head">
        <h1>Государства</h1>
        <div className="search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск..." />
        </div>
        <label className="check">
          <input type="checkbox" checked={showDead} onChange={(e) => setShowDead(e.target.checked)} /> показывать несуществующие на эту дату
        </label>
        <Button
          icon="plus"
          variant="primary"
          onClick={() => {
            const st = newState('Новое государство', randomColor())
            mutate((w) => {
              w.states.push(st)
            })
            openCard(st.id)
          }}
        >
          Государство
        </Button>
      </header>
      <div className="state-grid">
        {list.map(({ s, f, alive }) => {
          const ruler = world.entries.find((e) => e.id === f.rulerId)
          return (
            <button key={s.id} className={`state-tile ${alive ? '' : 'dead'}`} onClick={() => openCard(s.id)} style={{ ['--state' as string]: f.color }}>
              <div className="st-flag">{f.flag ? <img src={assetUrl(f.flag)} alt="" /> : <Flag heraldry={f.heraldry ?? defaultHeraldry(s, f.color)} width={66} />}</div>
              <div className="st-text">
                <div className="st-name">{f.name}</div>
                <div className="st-sub">{f.government || 'строй не указан'}</div>
                <div className="st-sub">
                  {f.rulerTitle || 'Правитель'}: {ruler ? resolve(ruler, date).name : f.ruler || '—'}
                </div>
              </div>
            </button>
          )
        })}
        {!list.length && <p className="muted">Нет государств. Нажмите «+ Государство».</p>}
      </div>
    </div>
  )
}

export function CodexView({ kind }: { kind: EntryKind }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mutate = useStore((s) => s.mutate)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const meta = KINDS[kind]
  const [q, setQ] = useState('')
  const list = world.entries
    .filter((e) => e.kind === kind)
    .map((e) => ({ e, f: resolve(e, date) }))
    .filter(({ f }) => (f.name + ' ' + f.title + ' ' + f.tags.join(' ')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (kind === 'event' ? (a.e.from ?? 0) - (b.e.from ?? 0) : a.f.name.localeCompare(b.f.name, 'ru')))
  const picked = selection?.type === 'entry' && world.entries.find((e) => e.id === selection.id)?.kind === kind
  const selectedId = picked ? selection.id : list[0]?.e.id

  // на телефоне список и карточка — отдельные экраны: выбранная запись открывается поверх списка
  return (
    <div className={`codex ${picked ? 'picked' : ''}`}>
      <aside className="codex-list">
        <header>
          <h1>
            <Icon name={meta.icon} /> {meta.plural}
          </h1>
          <button
            className="add-btn"
            title={`Добавить: ${meta.label.toLowerCase()}`}
            onClick={() => {
              const e = newEntry(kind, `${meta.label} без имени`)
              if (kind === 'event') e.from = date
              mutate((w) => {
                w.entries.push(e)
              })
              select({ type: 'entry', id: e.id })
            }}
          >
            <Icon name="plus" />
          </button>
        </header>
        <div className="search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск..." />
        </div>
        <div className="codex-items">
          {grouped(kind, list, world).map(({ e, f, group, sub }) => (
            <div key={e.id}>
            {group && <div className="codex-group">{group}</div>}
            <button className={`codex-item ${sub ? 'sub' : ''} ${e.id === selectedId ? 'active' : ''} ${existsAt(e, date) ? '' : 'dead'}`} onClick={() => select({ type: 'entry', id: e.id })}>
              <span className="ci-thumb">{f.image ? <img src={assetUrl(f.image)} alt="" /> : <Icon name={meta.icon} size={16} />}</span>
              <span className="ci-text">
                <span className="ci-name">{f.name}</span>
                <span className="ci-sub">{kind === 'event' ? formatDate(world.calendar, e.from) : f.title}</span>
              </span>
            </button>
            </div>
          ))}
          {!list.length && <p className="muted pad">Пусто. Нажмите «+», чтобы добавить.</p>}
        </div>
      </aside>
      <main className="codex-detail">
        <button className="codex-back" onClick={() => select(null)}>
          <Icon name="back" size={16} /> {KINDS[kind].plural}
        </button>
        {selectedId ? <EntryEditor key={selectedId} id={selectedId} /> : <EmptyCodex kind={kind} />}
      </main>
    </div>
  )
}

const GOD_RANK = ['первозданн', 'верховн', 'божество', 'низш', 'дух', 'полу']
const rankIndex = (r: string): number => {
  const i = GOD_RANK.findIndex((k) => r.toLowerCase().includes(k))
  return i < 0 ? 9 : i
}

/** Боги — по Домам и статусу, народы — ветви под родительским народом. */
function grouped(kind: EntryKind, list: { e: Entry; f: EntryFields }[], world: WorldData) {
  type Row = { e: Entry; f: EntryFields; group?: string; sub?: boolean }
  if (kind === 'god') {
    const houseName = (id: string): string => world.entries.find((x) => x.id === id)?.base.name ?? 'Вне Домов'
    const sorted = [...list].sort(
      (a, b) =>
        houseName(a.f.links.religion ?? '').localeCompare(houseName(b.f.links.religion ?? ''), 'ru') ||
        rankIndex(a.f.props.rank ?? '') - rankIndex(b.f.props.rank ?? '') ||
        a.f.name.localeCompare(b.f.name, 'ru')
    )
    let last = ''
    return sorted.map((r): Row => {
      const g = houseName(r.f.links.religion ?? '')
      const row: Row = { ...r, group: g !== last ? g : undefined }
      last = g
      return row
    })
  }
  if (kind === 'people') {
    const ids = new Set(list.map((r) => r.e.id))
    const roots = list.filter((r) => !r.f.links.parent || !ids.has(r.f.links.parent))
    const out: Row[] = []
    for (const r of roots) {
      out.push(r)
      for (const c of list.filter((x) => x.f.links.parent === r.e.id)) out.push({ ...c, sub: true })
    }
    return out
  }
  return list as Row[]
}

function EmptyCodex({ kind }: { kind: EntryKind }) {
  return (
    <div className="empty">
      <Icon name={KINDS[kind].icon} size={48} />
      <p>Здесь будут {KINDS[kind].plural.toLowerCase()} вашего мира.</p>
    </div>
  )
}

function refItems(world: WorldData, date: number, target: EntryKind | 'state' | 'place') {
  if (target === 'state') return world.states.map((s) => ({ id: s.id, name: resolve(s, date).name }))
  if (target === 'place') return world.places.map((p) => ({ id: p.id, name: resolve(p, date).name }))
  return world.entries.filter((e) => e.kind === target).map((e) => ({ id: e.id, name: resolve(e, date).name }))
}

function EntryEditor({ id }: { id: string }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mode = useStore((s) => s.editMode)
  const mutate = useStore((s) => s.mutate)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)
  const entry = world.entries.find((e) => e.id === id)
  const [preview, setPreview] = useState(() => Boolean(entry?.base.body))
  const [reading, setReading] = useState(false)
  const [powerOpen, setPowerOpen] = useState(false)
  const masterMode = useStore((s) => s.masterMode)
  if (!entry) return null
  const meta = KINDS[entry.kind]
  const f = resolve(entry, date)
  const cal = world.calendar

  const set = (patch: Partial<EntryFields>): void =>
    mutate((w) => {
      const e = w.entries.find((x) => x.id === id)
      if (e) applyTemporal(e, patch, date, mode)
    })
  const setRaw = (patch: Partial<Pick<Entry, 'from' | 'to'>>): void =>
    mutate((w) => {
      const e = w.entries.find((x) => x.id === id)
      if (e) Object.assign(e, patch)
    })

  const backlinks = world.entries.filter((e) => e.id !== id && Object.values(resolve(e, date).links).includes(id))
  const age =
    entry.kind === 'character' && entry.from != null
      ? Math.floor(((entry.to != null && entry.to < date ? entry.to : date) - entry.from) / cal.months.reduce((s, m) => s + m.days, 0))
      : null

  const goto = (eid: string): void => {
    const target = world.entries.find((e) => e.id === eid)
    if (!target) return
    setView(target.kind)
    select({ type: 'entry', id: eid })
  }

  return (
    <article className={`entry entry-${entry.kind}`}>
      <header className="entry-head">
        <div className="entry-media">
          <ImageField value={f.image} folder={entry.kind} shape={entry.kind === 'character' || entry.kind === 'god' ? 'round' : 'rect'} onChange={(image) => set({ image })} />
          {f.heraldry && <CoatOfArms heraldry={f.heraldry} size={96} />}
        </div>
        <div className="entry-titles">
          <div className="entry-kicker">
            {meta.label}
            {!existsAt(entry, date) && <span className="badge danger">не существует на {formatDate(cal, date)}</span>}
            {age !== null && age >= 0 && <span className="badge">{age} лет</span>}
          </div>
          <TextField value={f.name} onChange={(name) => set({ name })} className="entry-name" />
          <TextField value={f.title} placeholder="Титул / подзаголовок" onChange={(title) => set({ title })} className="entry-title" />
          <TextField value={f.summary} placeholder="Кратко в одну строку" onChange={(summary) => set({ summary })} className="entry-summary" />
        </div>
        <EditModeSwitch />
      </header>

      <div className="entry-grid">
        <div className="entry-main">
          {entry.kind === 'note' && f.body && (
            <button className="book-open" onClick={() => setReading(true)}>
              <span className="book-open-cover" style={{ background: `linear-gradient(135deg, ${bookTheme(entry).cover[0]}, ${bookTheme(entry).cover[1]})`, color: bookTheme(entry).coverInk }}>
                {bookTheme(entry).ornament}
              </span>
              <span>
                <b>Открыть книгу</b>
                <span>{bookTheme(entry).kind} — листайте страницы мышью</span>
              </span>
            </button>
          )}
          {reading && <BookReader entry={entry} onClose={() => setReading(false)} />}
          {world.legislatures?.some((l) => l.entryId === entry.id) && (
            <button className="power-open" onClick={() => setPowerOpen(true)}>
              <Icon name="balance" size={26} />
              <span>
                <b>Открыть зал — состав, законы и голоса по годам</b>
                <span>На весь экран: каждый член собрания, его взгляды и голосования</span>
              </span>
            </button>
          )}
          {powerOpen && <PowerView legislature={world.legislatures!.find((l) => l.entryId === entry.id)!} onClose={() => setPowerOpen(false)} />}
          <div className="body-head">
            <span className="field-label">Описание и история</span>
            <button className="link-btn" onClick={() => setPreview(!preview)}>
              {preview ? 'Редактировать' : 'Просмотр'}
            </button>
          </div>
          {preview || !masterMode ? (
            <div className="parchment prose">{renderBody(f.body, world, goto)}</div>
          ) : (
            <TextField
              multiline
              rows={22}
              value={f.body}
              onChange={(body) => set({ body })}
              placeholder="Пишите свободно. [[Имя]] — ссылка на другую запись. Пустая строка — новый абзац. # Заголовок"
              className="parchment-input"
            />
          )}
          {meta.props
            .filter((p) => p.multiline)
            .map((p) => (
              <TextField
                key={p.key}
                label={p.label}
                multiline
                rows={Math.min(14, Math.max(3, Math.ceil((f.props[p.key] ?? '').length / 110) + 1))}
                value={f.props[p.key] ?? ''}
                onChange={(v) => set({ props: { ...f.props, [p.key]: v } })}
                className="long-prop"
              />
            ))}
          {masterMode && (
            <div className="secret-box">
              <TextField label="Тайное — знание мастера (не видно в режиме игрока)" multiline rows={4} value={f.secret ?? ''} onChange={(secret) => set({ secret })} />
            </div>
          )}
          {f.stavka && <StavkaView data={f.stavka} onOpen={goto} />}
          {f.ting && <TingView data={f.ting} onOpen={goto} />}
          {f.brood && <BroodView data={f.brood} onOpen={goto} />}
                {f.vault && <VaultView data={f.vault} onOpen={goto} />}
                {f.heights && <HeightsView data={f.heights} onOpen={goto} />}
                {f.urn && <UrnView data={f.urn} onOpen={goto} />}
                {f.fleet && <FleetView data={f.fleet} onOpen={goto} />}
                {f.lantern && <LanternView data={f.lantern} onOpen={goto} />}
                {f.threshold && <ThresholdView data={f.threshold} onOpen={goto} />}
                {f.wall && <WallView data={f.wall} onOpen={goto} />}
                {f.cart && <CartView data={f.cart} onOpen={goto} />}
                {f.ford && <FordsView data={f.ford} onOpen={goto} />}
                {f.willow && <WillowView data={f.willow} onOpen={goto} />}
          {f.advisors && f.advisors.length > 0 && <AdvisorsGrid advisors={f.advisors} onOpen={goto} />}
          {entry.kind === 'dynasty' && <DynastyTree dynastyId={id} onOpen={goto} />}
          {entry.kind === 'dynasty' && f.council && <SuccessionCouncilView council={f.council} onOpen={goto} rules={renderBody(f.council.rules, world, goto)} />}
        </div>

        <aside className="entry-side">
          <div className="grid-2">
            <DateField label={meta.fromLabel} value={entry.from} onChange={(from) => setRaw({ from })} />
            <DateField label={meta.toLabel} value={entry.to} onChange={(to) => setRaw({ to })} />
          </div>
          {meta.props.filter((p) => !p.multiline).map((p) => (
            <TextField
              key={p.key}
              label={p.label}
              multiline={p.multiline}
              rows={3}
              value={f.props[p.key] ?? ''}
              onChange={(v) => set({ props: { ...f.props, [p.key]: v } })}
            />
          ))}
          {meta.links.map((l) => (
            <div key={l.key} className="link-field">
              <RefField label={l.label} value={f.links[l.key] ?? ''} items={refItems(world, date, l.target).filter((i) => i.id !== id)} onChange={(v) => set({ links: { ...f.links, [l.key]: v } })} />
              {f.links[l.key] && l.target !== 'state' && l.target !== 'place' && (
                <button className="icon-btn" onClick={() => goto(f.links[l.key])} title="Открыть">
                  <Icon name="next" size={14} />
                </button>
              )}
            </div>
          ))}
          <TextField
            label="Теги (через запятую)"
            value={f.tags.join(', ')}
            onChange={(v) => set({ tags: v.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
          {backlinks.length > 0 && (
            <div className="inspector-block">
              <div className="field-label">Упоминается в</div>
              <div className="chip-list">
                {backlinks.map((b) => (
                  <button key={b.id} className="chip" onClick={() => goto(b.id)}>
                    {KINDS[b.kind].label}: {resolve(b, date).name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <HistoryList
            items={entry.history.map((c) => ({ id: c.id, date: c.date, text: Object.keys(c.patch).join(', ') }))}
            onDelete={(cid) =>
              mutate((w) => {
                const e = w.entries.find((x) => x.id === id)
                if (e) e.history = e.history.filter((c) => c.id !== cid)
              })
            }
          />
          <Button
            icon="trash"
            variant="danger"
            onClick={() => {
              if (!confirm(`Удалить «${f.name}»?`)) return
              mutate((w) => {
                w.entries = w.entries.filter((e) => e.id !== id)
              })
              select(null)
            }}
          >
            Удалить
          </Button>
        </aside>
      </div>
    </article>
  )
}
