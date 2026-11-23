import { useState } from 'react'
import { useStore, applyTemporal, uid } from '../store'
import { existsAt, regionOwner, resolve } from '../temporal'
import { GOVERNMENTS, PLACE_TYPES } from '../constants'
import { formatDate, formatYear, toParts } from '../calendar'
import { ringArea } from '../model'
import { ownerAt } from '../provinces'
import { Button, ColorField, DateField, EditModeSwitch, ImageField, Modal, RefField, TextField, assetUrl } from './ui'
import { HistoryList } from './Inspector'
import { DynastyTree } from './DynastyTree'
import { SuccessionCouncilView } from './Council'
import { PowerButton } from './PowerView'
import { TingView } from './Ting'
import { BroodView } from './Brood'
import { VaultView } from './Vault'
import { HeightsView } from './Heights'
import { UrnView } from './Urn'
import { FleetView } from './Fleet'
import { LanternView } from './Lantern'
import { RazryadView } from './Razryad'
import { ThresholdView } from './Threshold'
import { AshView } from './Ash'
import { ChaliceView } from './Chalice'
import { BeltView } from './Belt'
import { SentenceView } from './Sentence'
import { SilenceView } from './Silence'
import { LedgerView } from './Ledger'
import { KeysView } from './Keys'
import { WallView } from './Wall'
import { AuctionView } from './Auction'
import { RidgeView } from './Ridge'
import { PledgeView } from './Pledge'
import { ReserveView } from './Reserve'
import { StarView } from './Star'
import { CartView } from './Cart'
import { FordsView } from './Fords'
import { WillowView } from './Willow'
import { BansView } from './Bans'
import { KnotsView } from './Knots'
import { SmokeView } from './Smoke'
import { IceView } from './Ice'
import { ExamView } from './Exam'
import { WellView } from './Well'
import { StavkaView } from './Stavka'
import { AdvisorsGrid } from './Advisors'
import { CoatOfArms, Flag, HeraldryEditor, defaultHeraldry } from './Heraldry'
import { Icon, type IconName } from './Icon'
import { TechView } from './Tech'
import { EconomyView } from './Economy'
import { ArmyView } from './Army'
import { fmtMarks } from '../economy'
import type { Faction, StateFields, WorldData, WorldDate, WorldState } from '../types'

type Tab = 'overview' | 'power' | 'economy' | 'military' | 'diplomacy' | 'tech'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Обзор', icon: 'eye' },
  { id: 'power', label: 'Власть и законы', icon: 'crown' },
  { id: 'economy', label: 'Экономика', icon: 'coins' },
  { id: 'military', label: 'Армия', icon: 'sword' },
  { id: 'diplomacy', label: 'Дипломатия', icon: 'balance' },
  { id: 'tech', label: 'Технологический прогресс', icon: 'gear' }
]

export function StateCard() {
  const id = useStore((s) => s.stateCardOpen)
  const close = useStore((s) => s.openStateCard)
  if (!id) return null
  return (
    <Modal wide onClose={() => close(null)}>
      <StateCardBody id={id} />
    </Modal>
  )
}

function StateCardBody({ id }: { id: string }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mode = useStore((s) => s.editMode)
  const mutate = useStore((s) => s.mutate)
  const close = useStore((s) => s.openStateCard)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)
  const [tab, setTab] = useState<Tab>('overview')
  const [heraldryOpen, setHeraldryOpen] = useState(false)
  // шапку (статы, панель мастера, полное название) можно свернуть — больше места под вкладки
  const [compact, setCompactRaw] = useState(() => {
    try {
      return localStorage.getItem('sc-compact') === '1'
    } catch {
      return false
    }
  })
  const setCompact = (v: boolean): void => {
    setCompactRaw(v)
    try {
      localStorage.setItem('sc-compact', v ? '1' : '0')
    } catch {
      /* без памяти — не страшно */
    }
  }
  const masterMode = useStore((s) => s.masterMode)
  const st = world.states.find((s) => s.id === id)
  if (!st) return null
  const f = resolve(st, date)
  const cal = world.calendar
  const changedHere = new Set(st.history.filter((c) => c.date === date).flatMap((c) => Object.keys(c.patch)))

  const set = (patch: Partial<StateFields>): void =>
    mutate((w) => {
      const s = w.states.find((x) => x.id === id)
      if (s) applyTemporal(s, patch, date, mode)
    })
  const edit = (fn: (s: (typeof world.states)[number]) => void): void =>
    mutate((w) => {
      const s = w.states.find((x) => x.id === id)
      if (s) fn(s as never)
    })

  const chars = world.entries.filter((e) => e.kind === 'character').map((e) => ({ id: e.id, name: e.base.name }))
  const dynasties = world.entries.filter((e) => e.kind === 'dynasty').map((e) => ({ id: e.id, name: e.base.name }))
  const legislatures = world.legislatures?.filter((l) => l.stateId === id) ?? []
  const dynastyEntry = world.entries.find((e) => e.id === f.dynastyId)
  const dynastyCouncil = dynastyEntry ? resolve(dynastyEntry, date).council : undefined
  // органы власти без парламента (Сабельная ставка, Совет Десяти графа): организации этой страны с пометкой «Государственный орган»
  const organs = world.entries.filter((e) => e.kind === 'organization' && existsAt(e, date) && e.base.tags.includes(f.name) && !legislatures.some((l) => l.entryId === e.id) && (e.base.stavka || e.base.ting || e.base.brood || e.base.vault || e.base.heights || e.base.urn || e.base.fleet || e.base.lantern || e.base.razryad || e.base.threshold || e.base.wall || e.base.auction || e.base.ridge || e.base.pledge || e.base.reserve || e.base.star || e.base.cart || e.base.ford || e.base.willow || e.base.bans || e.base.knots || e.base.smoke || e.base.ice || e.base.tower || e.base.descent || e.base.ash || e.base.chalice || e.base.belt || e.base.sentence || e.base.silence || e.base.ledger || e.base.keys || e.base.advisors?.length || e.base.props?.type === 'Государственный орган'))
  const religions = world.entries.filter((e) => e.kind === 'religion').map((e) => ({ id: e.id, name: e.base.name }))
  const otherStates = world.states.filter((s) => s.id !== id).map((s) => ({ id: s.id, name: resolve(s, date).name }))
  const places = world.places.filter((p) => existsAt(p, date) && resolve(p, date).stateId === id)
  const placeItems = world.places.filter((p) => p.mapId === 'world').map((p) => ({ id: p.id, name: resolve(p, date).name }))
  // места внутри планов городов («Хоф», «Гавань»…) не показываем поштучно — одна кнопка на город, ведёт в его план
  const worldPlaces = places.filter((p) => p.mapId === 'world')
  const shownMaps = new Set(worldPlaces.map((p) => p.innerMapId).filter(Boolean))
  const cityMaps = [...new Set(places.filter((p) => p.mapId !== 'world').map((p) => p.mapId))]
    .filter((m) => !shownMaps.has(m))
    .map((m) => {
      const def = world.maps.find((x) => x.id === m)
      const owner = world.places.find((p) => p.innerMapId === m)
      return { id: m, name: owner ? resolve(owner, date).name : (def?.name ?? m).replace(/\s*—\s*план города$/, '') }
    })
  const capital = world.places.find((p) => p.id === f.capitalId)
  const rulerChar = world.entries.find((e) => e.id === f.rulerId)
  const dynasty = world.entries.find((e) => e.id === f.dynastyId)
  const religion = world.entries.find((e) => e.id === f.religionId)
  const overlord = world.states.find((s) => s.id === f.overlordId)
  const vassals = world.states.filter((s) => existsAt(s, date) && resolve(s, date).overlordId === id)
  const regions = world.regions.filter((r) => existsAt(r, date) && regionOwner(r, date) === id)
  const area = regions.reduce((s, r) => s + r.rings.reduce((a, ring) => a + ringArea(ring), 0), 0)
  const alive = existsAt(st, date)

  const mark = (k: keyof StateFields): string => (changedHere.has(k) ? 'changed-here' : '')

  return (
    <div className={`state-card${compact ? ' sc-compact' : ''}`} style={{ ['--state' as string]: f.color }}>
      <header className="sc-header">
        <div className="sc-banner" />
        <button className="sc-back" title="Назад" onClick={() => close(null)}>
          <Icon name="back" size={22} />
        </button>
        {f.flag ? (
          <ImageField value={f.flag} folder="flags" shape="flag" onChange={(flag) => set({ flag })} />
        ) : (
          <button className="sc-heraldry" onClick={() => masterMode && setHeraldryOpen(true)} title="Изменить флаг и герб">
            <CoatOfArms heraldry={f.heraldry ?? defaultHeraldry(st, f.color)} size={86} />
            <Flag heraldry={f.heraldry ?? defaultHeraldry(st, f.color)} width={120} />
          </button>
        )}
        {heraldryOpen && (
          <HeraldryEditor value={f.heraldry ?? defaultHeraldry(st, f.color)} onSave={(heraldry) => set({ heraldry })} onClose={() => setHeraldryOpen(false)} />
        )}
        <div className="sc-titles">
          <div className="sc-kicker">
            {f.government || 'Государство'} · сведения на {formatDate(cal, date)}
            {!alive && <span className="badge danger">не существует на эту дату</span>}
          </div>
          <TextField value={f.name} onChange={(name) => set({ name })} className={`sc-name ${mark('name')}`} />
          <TextField value={f.fullName} placeholder="Полное официальное название" onChange={(fullName) => set({ fullName })} className="sc-fullname" />
          <TextField value={f.motto} placeholder="Девиз" onChange={(motto) => set({ motto })} className="sc-motto" />
        </div>
        <div className="sc-ruler">
          <div className="sc-portrait">
            {rulerChar?.base.image ? <img src={assetUrl(rulerChar.base.image)} alt="" /> : <Icon name="crown" size={34} />}
          </div>
          <div className="sc-ruler-text">
            <div className="muted small">{f.rulerTitle || 'Правитель'}</div>
            <div className="sc-ruler-name">{rulerChar ? resolve(rulerChar, date).name : f.ruler || '—'}</div>
            {dynasty && <div className="muted small">дом {dynasty.base.name}</div>}
          </div>
        </div>
      </header>

      <div className="sc-stats">
        <Stat icon="coins" label="Казна" value={f.econ ? fmtMarks(f.econ.treasury) : f.treasury} />
        <Stat
          icon="pin"
          label="Столица"
          value={capital ? resolve(capital, date).name : ''}
          title={capital?.innerMapId ? 'Открыть план столицы' : undefined}
          onClick={
            capital?.innerMapId && world.maps.some((m) => m.id === capital.innerMapId)
              ? () => {
                  useStore.getState().openMap(capital.innerMapId!)
                  setView('map')
                  close(null)
                }
              : undefined
          }
        />
        <div className="stat stability">
          <div className="stat-label">
            <Icon name="balance" size={14} /> Стабильность
          </div>
          <div className="stab-bar">
            <div style={{ width: `${f.stability}%` }} />
          </div>
          <input type="range" min={0} max={100} disabled={!masterMode} value={f.stability} onChange={(e) => set({ stability: Number(e.target.value) })} />
        </div>
      </div>

      <div className="sc-toolbar">
        <EditModeSwitch />
        <ColorField label="Цвет на карте" value={f.color} onChange={(color) => set({ color })} />
        <Button icon="shield" onClick={() => setHeraldryOpen(true)}>
          Флаг и герб
        </Button>
        {!f.flag && (
          <Button
            icon="image"
            onClick={async () => {
              const rel = await window.api.importImage('flags')
              if (rel) set({ flag: rel })
            }}
          >
            Свой флаг (картинка)
          </Button>
        )}
        <Button
          icon="map"
          onClick={() => {
            select({ type: 'state', id })
            setView('map')
            close(null)
          }}
        >
          Показать на карте
        </Button>
      </div>

      <nav className="sc-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
        <button className="sc-collapse" title={compact ? 'Развернуть шапку' : 'Свернуть шапку'} onClick={() => setCompact(!compact)}>
          {compact ? '▼ шапка' : '▲ свернуть'}
        </button>
      </nav>

      <div className="sc-content">
        {tab === 'overview' && (
          <div className="sc-cols">
            <div className="parchment">
              <TextField label="Описание" multiline rows={12} value={f.description} onChange={(description) => set({ description })} className={mark('description')} />
              {masterMode && (
                <div className="secret-box">
                  <TextField label="Тайное — знание мастера" multiline rows={4} value={f.secret ?? ''} onChange={(secret) => set({ secret })} />
                </div>
              )}
            </div>
            <div className="sc-side">
              <TextField label="Идеология / национальная идея" value={f.ideology} onChange={(ideology) => set({ ideology })} className={mark('ideology')} />
              <RefField label="Государственная религия" value={f.religionId} items={religions} onChange={(religionId) => set({ religionId })} />
              {!religion && <TextField label="Религия (текстом)" value={f.religion} onChange={(religion) => set({ religion })} />}
              <TextField label="Культура и народы" value={f.culture} onChange={(culture) => set({ culture })} className={mark('culture')} />
              <TextField label="Языки" value={f.languages} onChange={(languages) => set({ languages })} />
              <RefField label="Столица" value={f.capitalId} items={placeItems} onChange={(capitalId) => set({ capitalId })} />
              <TextField label="Население" value={f.population} onChange={(population) => set({ population })} className={mark('population')} />
              <div className="mini-facts">
                <div>
                  {world.provinces?.length ? (
                    <>
                      <b>{world.provinces.filter((p) => ownerAt(p, date) === id).length}</b> провинций
                    </>
                  ) : (
                    <>
                      <b>{regions.length}</b> участков территории · площадь ≈ {Math.round(area / 1000)} тыс. ед.
                    </>
                  )}
                </div>
                <div>
                  <b>{worldPlaces.length}</b> поселений и мест
                </div>
              </div>
              <div className="chip-list">
                {worldPlaces.slice(0, 30).map((p) => {
                  const pf = resolve(p, date)
                  return (
                    <span key={p.id} style={{ display: 'contents' }}>
                      <button
                        className="chip"
                        onClick={() => {
                          select({ type: 'place', id: p.id })
                          setView('map')
                          close(null)
                        }}
                      >
                        {PLACE_TYPES[pf.type]?.label}: {pf.name}
                      </button>
                      {p.innerMapId && world.maps.some((m) => m.id === p.innerMapId) && (
                        <button
                          className="chip"
                          title="Открыть план города"
                          onClick={() => {
                            useStore.getState().openMap(p.innerMapId!)
                            setView('map')
                            close(null)
                          }}
                        >
                          План: {pf.name}
                        </button>
                      )}
                    </span>
                  )
                })}
                {cityMaps.slice(0, 30).map((m) => (
                  <button
                    key={m.id}
                    className="chip"
                    title="Открыть план города"
                    onClick={() => {
                      useStore.getState().openMap(m.id)
                      setView('map')
                      close(null)
                    }}
                  >
                    План: {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'power' && legislatures.map((l) => <PowerButton key={l.id} legislature={l} title={l.town ? `${l.name} (${l.town})` : undefined} />)}
        {/* органы власти, которые не парламент: Сабельная ставка, Совет Десяти графа и другие государственные органы */}
        {tab === 'power' &&
          organs.map((o) => {
            const of = resolve(o, date)
            const open = (id: string): void => {
              const e = world.entries.find((x) => x.id === id)
              select({ type: 'entry', id })
              setView(e?.kind ?? 'character')
              close(null)
            }
            return (
              <section key={o.id} className="sc-organ">
                <div className="sc-organ-head">
                  <h3>{of.name}</h3>
                  <button className="link-btn" onClick={() => open(o.id)}>Открыть карточку</button>
                </div>
                {of.summary && <p className="sc-organ-summary">{of.summary}</p>}
                {of.stavka && <StavkaView data={of.stavka} onOpen={open} />}
                {of.ting && <TingView data={of.ting} onOpen={open} />}
                {of.brood && <BroodView data={of.brood} onOpen={open} />}
                {of.vault && <VaultView data={of.vault} onOpen={open} />}
                {of.heights && <HeightsView data={of.heights} onOpen={open} />}
                {of.urn && <UrnView data={of.urn} onOpen={open} />}
                {of.fleet && <FleetView data={of.fleet} onOpen={open} />}
                {of.lantern && <LanternView data={of.lantern} onOpen={open} />}
                {of.threshold && <ThresholdView data={of.threshold} onOpen={open} />}
                {of.wall && <WallView data={of.wall} onOpen={open} />}
                {of.auction && <AuctionView data={of.auction} onOpen={open} />}
                {of.ridge && <RidgeView data={of.ridge} onOpen={open} />}
                {of.pledge && <PledgeView data={of.pledge} onOpen={open} />}
                {of.reserve && <ReserveView data={of.reserve} onOpen={open} />}
                {of.star && <StarView data={of.star} onOpen={open} />}
                {of.cart && <CartView data={of.cart} onOpen={open} />}
                {of.ford && <FordsView data={of.ford} onOpen={open} />}
                {of.willow && <WillowView data={of.willow} onOpen={open} />}
                {of.ash && <AshView data={of.ash} onOpen={open} />}
                {of.chalice && <ChaliceView data={of.chalice} onOpen={open} />}
                {of.belt && <BeltView data={of.belt} onOpen={open} />}
                {of.sentence && <SentenceView data={of.sentence} onOpen={open} />}
                {of.silence && <SilenceView data={of.silence} onOpen={open} />}
                {of.ledger && <LedgerView data={of.ledger} onOpen={open} />}
                {of.keys && <KeysView data={of.keys} onOpen={open} />}
                {of.advisors && of.advisors.length > 0 && <AdvisorsGrid advisors={of.advisors} onOpen={open} />}
              </section>
            )
          })}
        {tab === 'power' && (
          <div className="sc-cols">
            <div className="sc-side">
              <label className="field">
                <span className="field-label">Политический строй</span>
                <input list="gov-list" value={f.government} onChange={(e) => set({ government: e.target.value })} className={mark('government')} />
                <datalist id="gov-list">
                  {GOVERNMENTS.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                {f.government.length > 30 && <span className="sc-gov-full">{f.government}</span>}
              </label>
              <TextField label="Титул правителя" value={f.rulerTitle} onChange={(rulerTitle) => set({ rulerTitle })} className={mark('rulerTitle')} />
              <RefField label="Правитель (персонаж)" value={f.rulerId} items={chars} onChange={(rulerId) => set({ rulerId })} />
              <TextField label="Правитель (если нет карточки)" value={f.ruler} onChange={(ruler) => set({ ruler })} className={mark('ruler')} />
              <RefField label="Правящая династия" value={f.dynastyId} items={dynasties} onChange={(dynastyId) => set({ dynastyId })} />
              <p className="hint">
                Чтобы правитель сменился в определённый день, переключитесь в режим «Изменение с даты», выставьте дату на шкале и
                выберите нового правителя.
              </p>
            </div>
            <div className="parchment">
              <TextField label="Законы и устройство власти" multiline rows={14} value={f.laws} onChange={(laws) => set({ laws })} className={mark('laws')} />
            </div>
          </div>
        )}
        {tab === 'power' && (
          <div className="sc-cols sc-cols-wide">
            <div>
              <div className="field-label">Правители во времени</div>
              <RulerList
                state={st}
                world={world}
                date={date}
                onOpen={(id) => {
                  select({ type: 'entry', id })
                  setView('character')
                  close(null)
                }}
              />
            </div>
            <div>
              {f.dynastyId ? (
                <DynastyTree
                  dynastyId={f.dynastyId}
                  onOpen={(id) => {
                    const e = world.entries.find((x) => x.id === id)
                    select({ type: 'entry', id })
                    setView(e?.kind ?? 'character')
                    close(null)
                  }}
                />
              ) : (
                <p className="hint">Укажите правящую династию — здесь появится её родословное древо.</p>
              )}
            </div>
          </div>
        )}
        {/* органы власти, которые не парламент: Сабельная ставка, Совет Десяти графа и другие государственные органы */}
        {tab === 'power' &&
          organs.map((o) => {
            const of = resolve(o, date)
            const open = (id: string): void => {
              const e = world.entries.find((x) => x.id === id)
              select({ type: 'entry', id })
              setView(e?.kind ?? 'character')
              close(null)
            }
            return (
              <section key={o.id} className="sc-organ">
                <div className="sc-organ-head">
                  <h3>{of.name}</h3>
                  <button className="link-btn" onClick={() => open(o.id)}>Открыть карточку</button>
                </div>
                {of.summary && <p className="hint">{of.summary}</p>}
                {of.stavka && <StavkaView data={of.stavka} onOpen={open} />}
                {of.ting && <TingView data={of.ting} onOpen={open} />}
                {of.brood && <BroodView data={of.brood} onOpen={open} />}
                {of.vault && <VaultView data={of.vault} onOpen={open} />}
                {of.heights && <HeightsView data={of.heights} onOpen={open} />}
                {of.urn && <UrnView data={of.urn} onOpen={open} />}
                {of.fleet && <FleetView data={of.fleet} onOpen={open} />}
                {of.lantern && <LanternView data={of.lantern} onOpen={open} />}
                {of.razryad && <RazryadView data={of.razryad} onOpen={open} />}
                {of.threshold && <ThresholdView data={of.threshold} onOpen={open} />}
                {of.wall && <WallView data={of.wall} onOpen={open} />}
                {of.auction && <AuctionView data={of.auction} onOpen={open} />}
                {of.ridge && <RidgeView data={of.ridge} onOpen={open} />}
                {of.pledge && <PledgeView data={of.pledge} onOpen={open} />}
                {of.reserve && <ReserveView data={of.reserve} onOpen={open} />}
                {of.star && <StarView data={of.star} onOpen={open} />}
                {of.cart && <CartView data={of.cart} onOpen={open} />}
                {of.ford && <FordsView data={of.ford} onOpen={open} />}
                {of.willow && <WillowView data={of.willow} onOpen={open} />}
                {of.bans && <BansView data={of.bans} onOpen={open} />}
                {of.knots && <KnotsView data={of.knots} onOpen={open} />}
                {of.smoke && <SmokeView data={of.smoke} onOpen={open} />}
                {of.ice && <IceView data={of.ice} onOpen={open} />}
                {of.tower && <ExamView data={of.tower} onOpen={open} />}
                {of.descent && <WellView data={of.descent} onOpen={open} />}
                {of.ash && <AshView data={of.ash} onOpen={open} />}
                {of.chalice && <ChaliceView data={of.chalice} onOpen={open} />}
                {of.belt && <BeltView data={of.belt} onOpen={open} />}
                {of.sentence && <SentenceView data={of.sentence} onOpen={open} />}
                {of.silence && <SilenceView data={of.silence} onOpen={open} />}
                {of.ledger && <LedgerView data={of.ledger} onOpen={open} />}
                {of.keys && <KeysView data={of.keys} onOpen={open} />}
                {of.advisors && of.advisors.length > 0 && <AdvisorsGrid advisors={of.advisors} onOpen={open} />}
              </section>
            )
          })}
        {tab === 'power' && dynastyCouncil && (
          <SuccessionCouncilView
            council={dynastyCouncil}
            onOpen={(id) => {
              const e = world.entries.find((x) => x.id === id)
              select({ type: 'entry', id })
              setView(e?.kind ?? 'character')
              close(null)
            }}
          />
        )}

        {tab === 'tech' && <TechView tech={f.tech} onChange={(tech) => set({ tech })} />}

        {tab === 'economy' && <EconomyView st={st} />}

        {tab === 'military' && <ArmyView st={st} />}

        {tab === 'power' && (
          <div className="sc-part" data-title="Фракции и парламент">
            <div className="faction-grid">
              {st.factions.map((fa, i) => (
                <div key={fa.id} className="faction-card">
                  <TextField value={fa.name} onChange={(v) => edit((s) => (s.factions[i].name = v))} className="faction-name" />
                  <div className="grid-2">
                    <TextField label="Лидер" value={fa.leader} onChange={(v) => edit((s) => (s.factions[i].leader = v))} />
                    <TextField label="Идеология" value={fa.ideology} onChange={(v) => edit((s) => (s.factions[i].ideology = v))} />
                  </div>
                  <label className="field">
                    <span className="field-label">Влияние: {fa.influence}%</span>
                    <input type="range" min={0} max={100} disabled={!masterMode} value={fa.influence} onChange={(e) => edit((s) => (s.factions[i].influence = Number(e.target.value)))} />
                  </label>
                  <TextField label="Описание" multiline rows={3} value={fa.description} onChange={(v) => edit((s) => (s.factions[i].description = v))} />
                  <Button icon="trash" variant="ghost" onClick={() => edit((s) => s.factions.splice(i, 1))}>
                    Удалить
                  </Button>
                </div>
              ))}
              <button
                className="faction-add"
                onClick={() => edit((s) => s.factions.push({ id: uid(), name: 'Новая фракция', leader: '', ideology: '', influence: 20, description: '' }))}
              >
                <Icon name="plus" size={28} />
                Добавить фракцию
              </button>
            </div>
            {st.factions.length > 0 && <Hemicycle factions={st.factions} title={/республик|парламент|совет/i.test(f.government) ? 'Парламент' : 'Расклад сил'} />}
            {st.factions.length > 0 && (
              <div className="influence-bar">
                {st.factions.map((fa, i) => (
                  <div key={fa.id} style={{ flex: fa.influence || 0.01, background: `hsl(${(i * 67) % 360} 40% 42%)` }} title={`${fa.name}: ${fa.influence}%`}>
                    {fa.influence >= 8 ? fa.name : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'diplomacy' && (
          <div className="sc-cols">
            <div className="sc-side">
              <RefField label="Сюзерен" value={f.overlordId} items={otherStates} emptyLabel="— независимо —" onChange={(overlordId) => set({ overlordId })} />
              {overlord && <p className="muted">Вассал: {resolve(overlord, date).name}</p>}
              <div className="field-label">Вассалы</div>
              <div className="chip-list">
                {vassals.length ? vassals.map((v) => <button key={v.id} className="chip" onClick={() => close(v.id)}>{resolve(v, date).name}</button>) : <span className="muted">нет</span>}
              </div>
            </div>
            <div className="parchment">
              <TextField label="Союзы, войны, договоры, отношения" multiline rows={14} value={f.diplomacy} onChange={(diplomacy) => set({ diplomacy })} className={mark('diplomacy')} />
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <div className="custom-fields sc-part" data-title="Свои поля">
            {f.customFields.map((cf, i) => (
              <div key={i} className="custom-row">
                <TextField
                  value={cf.label}
                  placeholder="Название поля"
                  onChange={(label) => set({ customFields: f.customFields.map((x, j) => (j === i ? { ...x, label } : x)) })}
                />
                <TextField
                  value={cf.value}
                  placeholder="Значение"
                  multiline
                  rows={2}
                  onChange={(value) => set({ customFields: f.customFields.map((x, j) => (j === i ? { ...x, value } : x)) })}
                />
                <button className="icon-btn" onClick={() => set({ customFields: f.customFields.filter((_, j) => j !== i) })}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
            <Button icon="plus" onClick={() => set({ customFields: [...f.customFields, { label: '', value: '' }] })}>
              Добавить поле
            </Button>
          </div>
        )}

        {tab === 'overview' && (
          <div className="sc-cols sc-part" data-title="Хроника">
            <div className="sc-side">
              <DateField label="Основано" value={st.from} onChange={(from) => edit((s) => (s.from = from))} />
              <DateField label="Пало / распалось" value={st.to} onChange={(to) => edit((s) => (s.to = to))} />
              <Button
                icon="trash"
                variant="danger"
                onClick={() => {
                  if (!confirm(`Удалить государство «${f.name}» целиком? Участки станут ничьими.`)) return
                  mutate((w) => {
                    w.states = w.states.filter((s) => s.id !== id)
                    for (const r of w.regions) for (const o of r.owners) if (o.stateId === id) o.stateId = null
                  })
                  close(null)
                }}
              >
                Удалить государство
              </Button>
            </div>
            <div>
              <HistoryList
                items={st.history.map((c) => ({
                  id: c.id,
                  date: c.date,
                  text: Object.entries(c.patch)
                    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v)?.slice(0, 40)}`)
                    .join('; ')
                }))}
                onDelete={(cid) => edit((s) => (s.history = s.history.filter((c) => c.id !== cid)))}
              />
              {!st.history.length && <p className="muted">Изменений во времени пока нет. Их создаёт режим «Изменение с даты».</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value, onClick, title }: { icon: IconName; label: string; value: string; onClick?: () => void; title?: string }) {
  return (
    <div className="stat" title={title} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="stat-label">
        <Icon name={icon} size={14} /> {label}
      </div>
      <div className="stat-value">{value || '—'}</div>
    </div>
  )
}

const FACTION_HUE = (i: number): string => `hsl(${(i * 67) % 360} 40% 46%)`

/** Полукруг парламента: места распределены по влиянию фракций */
function Hemicycle({ factions, title }: { factions: Faction[]; title: string }) {
  const total = factions.reduce((s, f) => s + (f.influence || 0), 0) || 1
  const SEATS = 101
  const radii = Array.from({ length: 6 }, (_, i) => 40 + i * 12)
  const radSum = radii.reduce((s, x) => s + x, 0)
  const seats: { x: number; y: number; a: number }[] = []
  radii.forEach((r) => {
    const n = Math.round((SEATS * r) / radSum)
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (Math.PI * (k + 0.5)) / n
      seats.push({ x: 110 + r * Math.cos(a), y: 110 - r * Math.sin(a), a })
    }
  })
  seats.sort((p, q) => q.a - p.a)
  const counts = factions.map((f) => Math.round(((f.influence || 0) / total) * seats.length))
  const colors: string[] = []
  counts.forEach((c, i) => colors.push(...Array<string>(c).fill(FACTION_HUE(i))))
  return (
    <div className="hemicycle">
      <div className="field-label">{title}</div>
      <svg width="320" height="170" viewBox="0 0 220 118">
        {seats.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4.2" fill={colors[i] ?? '#3a3f4a'} stroke="#0008" strokeWidth="0.6" />
        ))}
      </svg>
      <div className="hemicycle-legend">
        {factions.map((f, i) => (
          <span key={f.id}>
            <span className="swatch" style={{ background: FACTION_HUE(i) }} /> {f.name} — {counts[i]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Список правителей: базовый правитель и все смены правителя во времени */
function RulerList({ state, world, date, onOpen }: { state: WorldState; world: WorldData; date: WorldDate; onOpen: (id: string) => void }) {
  const cal = world.calendar
  const rows: { date: WorldDate | null; rulerId: string; ruler: string; title: string }[] = []
  let cur = { rulerId: state.base.rulerId, ruler: state.base.ruler, title: state.base.rulerTitle }
  const firstChange = Math.min(...state.history.filter((c) => c.patch.rulerId !== undefined || c.patch.ruler !== undefined).map((c) => c.date))
  // базовый правитель не показывается, если смена правителя наступает сразу с основания
  if ((cur.rulerId || cur.ruler) && !(state.from != null && firstChange <= state.from)) rows.push({ date: state.from ?? null, ...cur })
  for (const c of [...state.history].sort((a, b) => a.date - b.date)) {
    const p = c.patch
    if (p.rulerId === undefined && p.ruler === undefined && p.rulerTitle === undefined) continue
    cur = { rulerId: p.rulerId ?? cur.rulerId, ruler: p.ruler ?? cur.ruler, title: p.rulerTitle ?? cur.title }
    const last = rows[rows.length - 1]
    if (last && last.rulerId === cur.rulerId && last.ruler === cur.ruler) {
      last.title = cur.title
      continue
    }
    rows.push({ date: c.date, ...cur })
  }
  if (!rows.length) return <p className="hint">Правители не указаны. Смены правителя в режиме «Изменение с даты» появятся здесь списком.</p>
  const nowIdx = rows.reduce((best, r, i) => ((r.date ?? -Infinity) <= date ? i : best), -1)
  const y = (d: WorldDate | null | undefined): string => (d == null ? '…' : formatYear(cal, toParts(cal, d).year))
  return (
    <div className="rulers">
      {rows.map((r, i) => {
        const ch = world.entries.find((e) => e.id === r.rulerId)
        const next = rows[i + 1]?.date
        return (
          <button key={i} className={`ruler-row ${i === nowIdx ? 'now' : ''}`} onClick={() => ch && onOpen(ch.id)} disabled={!ch}>
            <span className="rr-date">
              {y(r.date)} — {next != null ? y(next) : 'н. в.'}
            </span>
            <span>
              <span className="rr-name">{ch ? ch.base.name : r.ruler || '—'}</span>
              <br />
              <span className="rr-title">{r.title}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
