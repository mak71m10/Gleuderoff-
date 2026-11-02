import { PowerButton } from './PowerView'
import { useStore, applyTemporal, uid } from '../store'
import { existsAt, regionOwner, resolve } from '../temporal'
import { PLACE_TYPE_OPTIONS } from '../constants'
import { Button, DateField, DateLabel, EditModeSwitch, ImageField, RefField, SelectField, TextField, assetUrl } from './ui'
import { Icon } from './Icon'
import { formatDate } from '../calendar'
import { CULTURE_INFO, TERRAIN_INFO, ownerAt } from '../provinces'
import type { PlaceFields, PlaceType } from '../types'
import { newPlace } from '../model'

export function Inspector() {
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  if (!selection || selection.type === 'entry') return null
  return (
    <aside className="inspector">
      <button className="inspector-close" onClick={() => select(null)} title="Закрыть">
        <Icon name="x" />
      </button>
      {selection.type === 'place' && <PlaceInspector id={selection.id} />}
      {selection.type === 'region' && <RegionInspector id={selection.id} />}
      {selection.type === 'state' && <StateSummary id={selection.id} />}
      {selection.type === 'label' && <LabelInspector id={selection.id} />}
      {selection.type === 'province' && <ProvinceInspector id={selection.id} />}
    </aside>
  )
}

function useStateOptions() {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  return world.states.filter((s) => existsAt(s, date)).map((s) => ({ id: s.id, name: resolve(s, date).name }))
}

function PlaceInspector({ id }: { id: string }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mode = useStore((s) => s.editMode)
  const mutate = useStore((s) => s.mutate)
  const select = useStore((s) => s.select)
  const openMap = useStore((s) => s.openMap)
  const states = useStateOptions()
  const place = world.places.find((p) => p.id === id)
  if (!place) return null
  const f = resolve(place, date)
  const set = (patch: Partial<PlaceFields>): void =>
    mutate((w) => {
      const p = w.places.find((x) => x.id === id)
      if (p) applyTemporal(p, patch, date, mode)
    })
  const setRaw = (patch: { from?: number | null; to?: number | null }): void =>
    mutate((w) => {
      const p = w.places.find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    })
  const innerMap = place.innerMapId ? world.maps.find((m) => m.id === place.innerMapId) : undefined

  const attachMap = async (): Promise<void> => {
    const rel = await window.api.importImage('maps')
    if (!rel) return
    const img = new Image()
    img.src = assetUrl(rel)
    await img.decode()
    const mapId = uid()
    mutate((w) => {
      w.maps.push({ id: mapId, name: f.name, kind: 'city', image: rel, width: img.naturalWidth, height: img.naturalHeight, placeId: id })
      const p = w.places.find((x) => x.id === id)
      if (p) p.innerMapId = mapId
    })
  }

  return (
    <div className="inspector-body">
      <div className="inspector-kicker">Место на карте</div>
      <TextField value={f.name} onChange={(name) => set({ name })} className="title-input" />
      {f.image && <img className="inspector-hero" src={assetUrl(f.image)} alt="" />}
      <EditModeSwitch />
      {world.legislatures?.filter((l) => l.town === f.name && l.stateId === f.stateId).map((l) => <PowerButton key={l.id} legislature={l} title={`${l.name} — городской парламент`} />)}
      <div className="grid-2">
        <SelectField label="Тип" value={f.type} options={PLACE_TYPE_OPTIONS} onChange={(type) => set({ type: type as PlaceType })} />
        <RefField label="Принадлежит" value={f.stateId} items={states} onChange={(stateId) => set({ stateId })} />
        <TextField label="Население" value={f.population} onChange={(population) => set({ population })} />
        <TextField label="Правитель / глава" value={f.ruler} onChange={(ruler) => set({ ruler })} />
      </div>
      <TextField label="Описание" multiline rows={6} value={f.description} onChange={(description) => set({ description })} />
      <ImageField label="Иллюстрация" value={f.image} folder="places" onChange={(image) => set({ image })} />
      <div className="grid-2">
        <DateField label="Основан" value={place.from} onChange={(from) => setRaw({ from })} />
        <DateField label="Разрушен / исчез" value={place.to} onChange={(to) => setRaw({ to })} />
      </div>
      <div className="inspector-block">
        <div className="field-label">Карта места</div>
        {innerMap ? (
          <div className="row">
            <Button icon="map" variant="primary" onClick={() => openMap(innerMap.id)}>
              Открыть карту
            </Button>
            <Button icon="image" onClick={attachMap} title="Заменить картинку">
              Заменить
            </Button>
          </div>
        ) : (
          <Button icon="image" onClick={attachMap}>
            Загрузить карту города
          </Button>
        )}
        <p className="hint">Например, из генератора городов Watabou. Внутри можно ставить свои метки.</p>
      </div>
      <HistoryList
        items={place.history.map((c) => ({ id: c.id, date: c.date, text: Object.keys(c.patch).join(', ') }))}
        onDelete={(cid) =>
          mutate((w) => {
            const p = w.places.find((x) => x.id === id)
            if (p) p.history = p.history.filter((c) => c.id !== cid)
          })
        }
      />
      <Button
        icon="trash"
        variant="danger"
        onClick={() => {
          if (!confirm(`Удалить «${f.name}»?`)) return
          mutate((w) => {
            w.places = w.places.filter((p) => p.id !== id)
          })
          select(null)
        }}
      >
        Удалить место
      </Button>
    </div>
  )
}

function RegionInspector({ id }: { id: string }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mutate = useStore((s) => s.mutate)
  const select = useStore((s) => s.select)
  const openCard = useStore((s) => s.openStateCard)
  const vertexEdit = useStore((s) => s.vertexEdit)
  const setVertexEdit = useStore((s) => s.setVertexEdit)
  const cal = world.calendar
  const states = useStateOptions()
  const allStates = world.states.map((s) => ({ id: s.id, name: resolve(s, date).name }))
  const region = world.regions.find((r) => r.id === id)
  if (!region) return null
  const owner = regionOwner(region, date)
  const ownerState = world.states.find((s) => s.id === owner)
  const sortedOwners = region.owners.map((o, i) => ({ ...o, i })).sort((a, b) => (a.date ?? -Infinity) - (b.date ?? -Infinity))

  const edit = (fn: (r: (typeof world.regions)[number]) => void): void =>
    mutate((w) => {
      const r = w.regions.find((x) => x.id === id)
      if (r) fn(r as never)
    })

  return (
    <div className="inspector-body">
      <div className="inspector-kicker">Участок территории</div>
      <TextField value={region.name ?? ''} placeholder="Название провинции (необязательно)" onChange={(name) => edit((r) => (r.name = name))} className="title-input" />
      <div className="owner-now">
        <span className="swatch big" style={{ background: ownerState ? resolve(ownerState, date).color : '#555' }} />
        <div>
          <div className="muted small">Владелец на {formatDate(cal, date)}</div>
          <div className="owner-name">{ownerState ? resolve(ownerState, date).name : 'Ничья земля'}</div>
        </div>
        {ownerState && (
          <Button icon="crown" onClick={() => openCard(ownerState.id)}>
            Карточка
          </Button>
        )}
      </div>
      <Button icon="pen" active={vertexEdit} onClick={() => setVertexEdit(!vertexEdit)}>
        {vertexEdit ? 'Закончить правку границы' : 'Править границу'}
      </Button>

      <div className="inspector-block">
        <div className="field-label">История владения</div>
        {sortedOwners.map((o) => (
          <div key={o.i} className="owner-row">
            {o.date === null ? (
              <span className="muted small owner-date">изначально</span>
            ) : (
              <DateField value={o.date} allowEmpty={false} onChange={(d) => edit((r) => (r.owners[o.i].date = d))} />
            )}
            <RefField value={o.stateId ?? ''} items={allStates} emptyLabel="Ничья земля" onChange={(sid) => edit((r) => (r.owners[o.i].stateId = sid || null))} />
            {region.owners.length > 1 && (
              <button className="icon-btn" onClick={() => edit((r) => r.owners.splice(o.i, 1))}>
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        ))}
        <Button
          icon="plus"
          onClick={() =>
            edit((r) => {
              if (!r.owners.some((o) => o.date === date)) r.owners.push({ date, stateId: owner })
            })
          }
        >
          Смена владельца с {formatDate(cal, date)}
        </Button>
        {!states.length && <p className="hint">Сначала создайте государства в разделе «Государства».</p>}
      </div>
      <div className="grid-2">
        <DateField label="Существует с" value={region.from} onChange={(from) => edit((r) => (r.from = from))} />
        <DateField label="Существует до" value={region.to} onChange={(to) => edit((r) => (r.to = to))} />
      </div>
      <p className="hint">
        Если граница сама меняет форму, задайте старому участку дату «до», а новый нарисуйте с этой же даты.
      </p>
      <Button
        icon="trash"
        variant="danger"
        onClick={() => {
          if (!confirm('Удалить участок?')) return
          mutate((w) => {
            w.regions = w.regions.filter((r) => r.id !== id)
          })
          select(null)
        }}
      >
        Удалить участок
      </Button>
    </div>
  )
}

const SETTLEMENT_NAMES: Record<string, string> = {
  village: 'деревня',
  fishing: 'рыбацкая деревня',
  town: 'городок',
  city: 'город',
  capital: 'столица',
  castle: 'замок',
  port: 'порт',
  temple: 'храм',
  ruins: 'руины',
  tower: 'башня'
}
const SETTLEMENT_PLACE: Record<string, PlaceType> = {
  village: 'village',
  fishing: 'village',
  town: 'town',
  city: 'city',
  capital: 'capital',
  castle: 'castle',
  port: 'port',
  temple: 'temple',
  ruins: 'ruins',
  tower: 'tower'
}

function ProvinceInspector({ id }: { id: number }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mutate = useStore((s) => s.mutate)
  const openCard = useStore((s) => s.openStateCard)
  const select = useStore((s) => s.select)
  const setTool = useStore((s) => s.setTool)
  const cal = world.calendar
  const p = world.provinces?.find((x) => x.id === id)
  if (!p) return null
  const admin = world.adminRegions ?? []
  const area = admin.find((a) => a.id === p.areaId)
  const region = admin.find((a) => a.id === area?.parentId)
  const continent = admin.find((a) => a.id === region?.parentId)
  const owner = ownerAt(p, date)
  const st = world.states.find((s) => s.id === owner)
  const sf = st ? resolve(st, date) : null
  const stateName = (sid: string | null): string => {
    const s = world.states.find((x) => x.id === sid)
    return s ? resolve(s, date).name : 'Ничья земля'
  }
  const setView = useStore((s) => s.setView)
  const house = (hid: string): string | undefined => world.entries.find((e) => e.id === hid)?.base.name
  const openEntry = (eid: string): void => {
    const e = world.entries.find((x) => x.id === eid)
    if (!e) return
    setView(e.kind)
    select({ type: 'entry', id: eid })
  }
  const renameAdmin = (aid: string, name: string): void =>
    mutate((w) => {
      const a = w.adminRegions?.find((x) => x.id === aid)
      if (a) a.name = name
    })
  return (
    <div className="inspector-body">
      <div className="inspector-kicker">Провинция</div>
      <TextField value={p.name} onChange={(name) => mutate((w) => void (w.provinces!.find((x) => x.id === id)!.name = name))} className="title-input" />
      <div className="crumbs">
        <b>{continent?.name}</b> › <b>{region?.name}</b> › <b>{area?.name}</b>
      </div>
      <div className="owner-now">
        <span className="swatch big" style={{ background: sf?.color ?? '#555' }} />
        <div>
          <div className="muted small">Владелец на {formatDate(cal, date)}</div>
          <div className="owner-name">{sf?.name ?? 'Ничья земля'}</div>
        </div>
        {st && (
          <Button icon="crown" onClick={() => openCard(st.id)}>
            Карточка
          </Button>
        )}
      </div>
      <div className="grid-2">
        <div className="field">
          <span className="field-label">Культура</span>
          <span>{CULTURE_INFO[p.culture]?.name ?? p.culture}</span>
        </div>
        <div className="field">
          <span className="field-label">Местность</span>
          <span>{TERRAIN_INFO[p.terrain]?.name}</span>
        </div>
      </div>
      {world.legislatures?.filter((l) => l.provinceId === p.id).map((l) => <PowerButton key={l.id} legislature={l} title={`${l.name} — городской парламент`} />)}
      {p.settlement && (
        <div className="inspector-block">
          <div className="field-label">Поселение</div>
          <div>
            <b>{p.name}</b> <span className="muted">· {SETTLEMENT_NAMES[p.settlement.type] ?? p.settlement.type}</span>
          </div>
          <TextField
            value={p.description ?? ''}
            multiline
            rows={5}
            placeholder="Описание поселения"
            onChange={(description) => mutate((w) => void (w.provinces!.find((x) => x.id === id)!.description = description))}
          />
          <Button
            icon="pin"
            onClick={() => {
              // поселение становится полноценным местом: своя статья, правитель, население, своя карта
              const sp = p.settlement!
              const place = newPlace('world', sp.x, sp.y, SETTLEMENT_PLACE[sp.type] ?? 'village')
              place.base.name = p.name
              place.base.stateId = owner ?? ''
              mutate((w) => {
                w.places.push(place)
                w.provinces!.find((x) => x.id === id)!.settlement = null
              })
              select({ type: 'place', id: place.id })
            }}
          >
            Сделать точкой интереса
          </Button>
        </div>
      )}
      {!p.settlement && p.description && <p className="muted">{p.description}</p>}
      {[area, region].map(
        (a) =>
          a &&
          (a.description || a.houseId) && (
            <div key={a.id} className="inspector-block">
              <div className="field-label">{a.level === 'area' ? 'Округ' : 'Регион'} · {a.name}</div>
              {a.houseId && house(a.houseId) && (
                <button className="link-btn" onClick={() => openEntry(a.houseId!)}>
                  {house(a.houseId)}
                </button>
              )}
              <TextField
                value={a.description ?? ''}
                multiline
                rows={3}
                placeholder="Описание"
                onChange={(description) =>
                  mutate((w) => {
                    const x = w.adminRegions?.find((y) => y.id === a.id)
                    if (x) {
                      x.description = description
                      x.descAuto = false
                    }
                  })
                }
              />
            </div>
          )
      )}
      <div className="inspector-block">
        <div className="field-label">История владения</div>
        <div className="owner-hist">
          {p.owners.map(([d, o], i) => (
            <div key={i} className="row">
              <span>
                {d === null ? <span className="muted small">изначально</span> : <DateLabel date={d} />} {stateName(o)}
              </span>
              {i > 0 && (
                <button
                  className="icon-btn"
                  title="Убрать эту смену"
                  onClick={() => mutate((w) => void w.provinces!.find((x) => x.id === id)!.owners.splice(i, 1))}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <Button icon="brush" onClick={() => setTool({ kind: 'paint', stateId: owner })}>
          Кисть: передавать провинции
        </Button>
        <p className="hint">Кистью можно провести по карте. Shift — вся область, Ctrl — весь регион. В режиме «Изменение с даты» передача запишется в историю.</p>
      </div>
      {area && <TextField label="Название области" value={area.name} onChange={(n) => renameAdmin(area.id, n)} />}
      {region && <TextField label="Название региона" value={region.name} onChange={(n) => renameAdmin(region.id, n)} />}
      <Button icon="x" variant="ghost" onClick={() => select(null)}>
        Закрыть
      </Button>
    </div>
  )
}

const LABEL_KINDS = [
  { value: 'sea', label: 'Море, океан, залив' },
  { value: 'mountain', label: 'Горы, хребет' },
  { value: 'river', label: 'Река' },
  { value: 'forest', label: 'Лес, джунгли' },
  { value: 'desert', label: 'Пустыня, степь' },
  { value: 'region', label: 'Земля, область' },
  { value: 'continent', label: 'Континент' }
] as const

function LabelInspector({ id }: { id: string }) {
  const world = useStore((s) => s.world!)
  const mutate = useStore((s) => s.mutate)
  const select = useStore((s) => s.select)
  const lb = world.mapLabels?.find((l) => l.id === id)
  if (!lb) return null
  const set = (patch: Partial<typeof lb>): void =>
    mutate((w) => {
      const l = w.mapLabels?.find((x) => x.id === id)
      if (l) Object.assign(l, patch)
    })
  return (
    <div className="inspector-body">
      <div className="inspector-kicker">Подпись на карте</div>
      <TextField value={lb.text} onChange={(text) => set({ text })} className="title-input" />
      <SelectField label="Что это" value={lb.kind} options={LABEL_KINDS.map((k) => ({ value: k.value, label: k.label }))} onChange={(kind) => set({ kind })} />
      <label className="field">
        <span className="field-label">Размер букв: {Math.round(lb.size)}</span>
        <input type="range" min={14} max={400} value={lb.size} onChange={(e) => set({ size: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span className="field-label">Наклон: {lb.angle}°</span>
        <input type="range" min={-90} max={90} value={lb.angle} onChange={(e) => set({ angle: Number(e.target.value) })} />
      </label>
      <TextField label="Заметка" multiline rows={4} value={lb.note ?? ''} onChange={(note) => set({ note })} />
      <p className="hint">Подпись можно перетащить мышью.</p>
      <Button
        icon="trash"
        variant="danger"
        onClick={() => {
          mutate((w) => {
            w.mapLabels = (w.mapLabels ?? []).filter((l) => l.id !== id)
          })
          select(null)
        }}
      >
        Удалить подпись
      </Button>
    </div>
  )
}

function StateSummary({ id }: { id: string }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const openCard = useStore((s) => s.openStateCard)
  const st = world.states.find((s) => s.id === id)
  if (!st) return null
  const f = resolve(st, date)
  return (
    <div className="inspector-body">
      <div className="inspector-kicker">Государство</div>
      <h2 className="inspector-title" style={{ color: f.color }}>
        {f.name}
      </h2>
      <p className="muted">{f.government || 'Строй не указан'}</p>
      <Button icon="crown" variant="primary" onClick={() => openCard(id)}>
        Открыть карточку
      </Button>
      <p className="hint">Инструмент «Перо» нарисует новый участок, он сразу будет принадлежать этому государству.</p>
    </div>
  )
}

export function HistoryList({ items, onDelete }: { items: { id: string; date: number; text: string }[]; onDelete: (id: string) => void }) {
  if (!items.length) return null
  return (
    <div className="inspector-block">
      <div className="field-label">Изменения во времени</div>
      {[...items]
        .sort((a, b) => a.date - b.date)
        .map((c) => (
          <div key={c.id} className="history-row">
            <DateLabel date={c.date} />
            <span className="muted small">{c.text}</span>
            <button className="icon-btn" onClick={() => onDelete(c.id)} title="Удалить изменение">
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
    </div>
  )
}
