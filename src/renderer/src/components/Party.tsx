import { useMemo, type ReactNode } from 'react'
import { useStore } from '../store'
import { resolve } from '../temporal'
import { toParts } from '../calendar'
import { assetUrl } from './ui'
import { Icon } from './Icon'
import type { Legislature, LegislatureFaction, LegislatureMember, Party } from '../types'

/** Партия собрания: история, заветы, манифест, устройство, лица и инфографика по годам. */
export function PartyView({
  L,
  f,
  year,
  onYear,
  onMember,
  onEntry,
  onBill,
  onParty,
  onBack,
  portrait,
  stanceBars
}: {
  L: Legislature
  f: LegislatureFaction
  year: number
  onYear: (y: number) => void
  onMember: (id: string) => void
  onEntry: (id: string) => void
  onBill: (id: string) => void
  onParty: (fid: string) => void
  onBack: () => void
  portrait: (m: LegislatureMember, size?: number) => ReactNode
  stanceBars: (st: number[], color: string) => ReactNode
}) {
  const world = useStore((s) => s.world!)
  const masterMode = useStore((s) => s.masterMode)
  const cal = world.calendar
  const yearOf = (d: number): number => toParts(cal, d).year
  const yearEnd = cal.months.reduce((s, m) => s + m.days, 0)
  const endOf = (y: number): number => (y - 1) * yearEnd + yearEnd - 1
  const entry = (id: string) => world.entries.find((e) => e.id === id)
  const fac = new Map(L.factions.map((x) => [x.id, x]))
  // городской парламент пользуется партией Народного собрания своей страны
  const parent = !f.party ? world.legislatures?.find((l) => l.stateId === L.stateId && l.id !== L.id && !l.town && l.factions.some((x) => x.id === f.id && x.party)) : undefined
  const P: Party | undefined = f.party ?? parent?.factions.find((x) => x.id === f.id)?.party
  const firstYear = yearOf(L.from)
  const lastYear = Math.max(firstYear, yearOf(L.bills[L.bills.length - 1]?.date ?? L.from))

  const stats = useMemo(() => {
    const ys = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)
    const seats = ys.map((y) => {
      const d = endOf(y)
      let n = 0
      let all = 0
      for (const m of L.members) if (m.from <= d && (m.to == null || m.to > d)) (all++, m.faction === f.id && n++)
      return { y, n, all }
    })
    // дисциплина и с кем голосует вместе: большинство «за»/«против» каждой скамьи по каждому закону
    const byFac = new Map<string, number[]>()
    L.members.forEach((m, i) => byFac.set(m.faction, [...(byFac.get(m.faction) ?? []), i]))
    const agree = new Map<string, [number, number]>()
    let loyal = 0
    let cast = 0
    for (const b of L.bills) {
      if (!b.votes) continue
      const line = new Map<string, string>()
      for (const [fid, is] of byFac) {
        let y = 0
        let n = 0
        for (const i of is) (b.votes[i] === 'y' ? y++ : b.votes[i] === 'n' ? n++ : 0)
        if (y + n) line.set(fid, y >= n ? 'y' : 'n')
        if (fid === f.id && y + n) (loyal += Math.max(y, n), (cast += y + n))
      }
      const mine = line.get(f.id)
      if (!mine) continue
      for (const [fid, v] of line) {
        if (fid === f.id) continue
        const a = agree.get(fid) ?? [0, 0]
        agree.set(fid, [a[0] + (v === mine ? 1 : 0), a[1] + 1])
      }
    }
    const sponsored = L.bills.filter((b) => b.sponsorFaction === f.id)
    const passed = sponsored.filter((b) => b.outcome === 'принят').length
    const everyone = L.members.filter((m) => m.faction === f.id)
    return {
      seats,
      peak: seats.reduce((a, b) => (b.n > a.n ? b : a), seats[0]),
      agree: [...agree].map(([fid, [s, t]]) => ({ fid, pct: t ? s / t : 0, t })).filter((x) => x.t > 4).sort((a, b) => b.pct - a.pct),
      discipline: cast ? loyal / cast : 0,
      sponsored,
      passed,
      everyone
    }
  }, [L, f.id])

  const now = stats.seats.find((s) => s.y === year) ?? stats.seats[stats.seats.length - 1]
  const sitting = L.members.filter((m) => m.faction === f.id && m.from <= endOf(year) && (m.to == null || m.to > endOf(year)))
  // лица партии: люди из карточек, когда-либо сидевшие за неё, и лидеры
  const figures = [
    ...new Map(
      [
        ...(P?.leaders ?? []).filter((l) => l[3]).map((l) => [l[3], l[0]] as const),
        ...(f.leader ? [[f.leader, 0] as const] : []),
        ...stats.everyone.filter((m) => m.entryId).map((m) => [m.entryId!, m.from] as const)
      ].map(([id]) => [id, entry(id)])
    ).values()
  ].filter(Boolean)

  const elections = L.elections ?? []
  const elRows = elections.map((e) => {
    const sum = Object.values(e.total.votes).reduce((s, v) => s + v, 0) || 1
    const heads = Object.values(e.total.heads).reduce((s, v) => s + v, 0) || 1
    return { e, y: yearOf(e.date), share: (e.total.votes[f.id] ?? 0) / sum, heads: (e.total.heads[f.id] ?? 0) / heads, seats: e.total.seats[f.id] ?? 0 }
  })
  const lastEl = [...elections].reverse().find((e) => yearOf(e.date) <= year) ?? elections[0]

  // отделения в городских парламентах той же страны
  const branches = (world.legislatures ?? [])
    .filter((l) => l.stateId === L.stateId && l.id !== L.id && l.town && l.factions.some((x) => x.id === f.id))
    .map((l) => {
      const d = endOf(Math.min(year, 1010))
      const s = l.members.filter((m) => m.from <= d && (m.to == null || m.to > d))
      return { l, n: s.filter((m) => m.faction === f.id).length, all: s.length }
    })

  const maxSeats = Math.max(...stats.seats.map((s) => s.n), 1)
  const W = 640
  const H = 150
  const xs = (i: number): number => (stats.seats.length > 1 ? (i / (stats.seats.length - 1)) * W : W / 2)
  const ys = (n: number): number => H - (n / maxSeats) * (H - 16)
  const area = `M0 ${H} ` + stats.seats.map((s, i) => `L${xs(i).toFixed(1)} ${ys(s.n).toFixed(1)}`).join(' ') + ` L${W} ${H} Z`
  const line = stats.seats.map((s, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(s.n).toFixed(1)}`).join(' ')
  const yi = stats.seats.findIndex((s) => s.y === year)

  const founded = P ? Math.floor(P.founded) : firstYear
  const tlFrom = Math.min(founded, firstYear)
  const tlTo = Math.max(lastYear, 1010)
  const tx = (y: number): number => ((y - tlFrom) / Math.max(1, tlTo - tlFrom)) * 100
  const initials = f.name.replace(/[«»"]/g, '').split(' ').filter((w) => w.length > 2).map((w) => w[0]).slice(0, 2).join('')

  return (
    <div className="pt" style={{ ['--pc' as string]: f.color }}>
      <button className="pt-back" onClick={onBack}>
        <Icon name="back" size={16} /> Все партии
      </button>

      <header className="pt-hero">
        <div className="pt-emblem">
          <span>{initials}</span>
        </div>
        <div className="pt-titles">
          <div className="pt-kicker">
            {L.name}
            {f.group ? ` · ${f.group}` : ''}
            {parent ? ` · отделение партии` : ''}
          </div>
          <h2>{f.name}</h2>
          {P?.motto && <div className="pt-motto">{P.motto}</div>}
          <div className="pt-ideology">{f.ideology}</div>
        </div>
        <div className="pt-kpis">
          <div>
            <b>{now?.n ?? 0}</b>
            <span>мест в {year} г. из {now?.all ?? L.seats}</span>
          </div>
          <div>
            <b>{stats.peak?.n ?? 0}</b>
            <span>пик — {stats.peak?.y} г.</span>
          </div>
          <div>
            <b>{(stats.discipline * 100).toFixed(1)}%</b>
            <span>дисциплина голосования</span>
          </div>
          <div>
            <b>
              {stats.passed}/{stats.sponsored.length}
            </b>
            <span>законов внесено и принято</span>
          </div>
        </div>
      </header>

      {P && (
        <div className="pt-facts">
          <span>
            <i>Основана</i> {founded} г.
          </span>
          <span>
            <i>Основатель</i> {P.founder}
          </span>
          <span>
            <i>Знак</i> {P.symbol}
          </span>
          <span>
            <i>Печать</i> {P.press}
          </span>
        </div>
      )}

      <section className="pt-card">
        <h3>Места по годам</h3>
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="pt-seats" preserveAspectRatio="none">
          <path d={area} fill="var(--pc)" opacity="0.25" />
          <path d={line} fill="none" stroke="var(--pc)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {stats.seats.map((s, i) => (
            <rect key={s.y} x={xs(i) - W / stats.seats.length / 2} y={0} width={W / stats.seats.length} height={H} fill="transparent" onClick={() => onYear(s.y)}>
              <title>{`${s.y} г.: ${s.n} мест`}</title>
            </rect>
          ))}
          {yi >= 0 && <line x1={xs(yi)} x2={xs(yi)} y1={0} y2={H} stroke="var(--gold-2)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="pt-axis">
          <span>{firstYear}</span>
          <span>нажмите на год — зал перейдёт к нему</span>
          <span>{lastYear}</span>
        </div>
      </section>

      {P && (
        <div className="pt-grid">
          <section className="pt-card pt-story">
            <h3>Как возникла</h3>
            <p>{P.origin}</p>
            <h3>Чего хочет</h3>
            <p>{P.ideal}</p>
            <div className="pt-base">
              <i>Опора</i> {P.base}
            </div>
          </section>
          <section className="pt-card">
            <h3>Заветы</h3>
            <ol className="pt-principles">
              {P.principles.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
            <blockquote className="pt-manifesto">
              <span className="pt-manifesto-k">Из манифеста</span>
              {P.manifesto}
            </blockquote>
          </section>
        </div>
      )}

      <div className="pt-grid">
        <section className="pt-card">
          <h3>Взгляды</h3>
          {stanceBars(f.stance, f.color)}
        </section>
        <section className="pt-card">
          <h3>С кем голосует</h3>
          <div className="pt-agree">
            {stats.agree.map((a) => {
              const o = fac.get(a.fid)!
              return (
                <button key={a.fid} onClick={() => onParty(a.fid)} title={`Совпадение по ${a.t} голосованиям`}>
                  <span className="pt-agree-name">
                    <i style={{ background: o.color }} /> {o.name}
                  </span>
                  <span className="pt-agree-bar">
                    <i style={{ width: `${a.pct * 100}%`, background: o.color }} />
                  </span>
                  <b>{Math.round(a.pct * 100)}%</b>
                </button>
              )
            })}
            {!stats.agree.length && <p className="muted">Поимённых голосований пока нет.</p>}
          </div>
          {P && (P.allies.length > 0 || P.rivals.length > 0) && (
            <div className="pt-rel">
              {P.allies.map((id) => fac.get(id) && (
                <button key={id} className="chip ally" onClick={() => onParty(id)}>
                  союзник: {fac.get(id)!.name}
                </button>
              ))}
              {P.rivals.map((id) => fac.get(id) && (
                <button key={id} className="chip rival" onClick={() => onParty(id)}>
                  соперник: {fac.get(id)!.name}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {elRows.length > 0 && (
        <div className="pt-grid">
          <section className="pt-card">
            <h3>На выборах</h3>
            <div className="pt-elections">
              {elRows.map((r) => (
                <button key={r.y} className={r.y === yearOf(lastEl!.date) ? 'on' : ''} onClick={() => onYear(r.y)}>
                  <span className="pt-el-bars">
                    <i className="w" style={{ height: `${Math.min(100, r.share * 250)}%` }} title={`С весом голоса: ${(r.share * 100).toFixed(1)}%`} />
                    <i className="h" style={{ height: `${Math.min(100, r.heads * 250)}%` }} title={`По головам: ${(r.heads * 100).toFixed(1)}%`} />
                  </span>
                  <b>{r.seats}</b>
                  <small>{r.y}</small>
                </button>
              ))}
            </div>
            <div className="pt-legend">
              <span>
                <i className="w" /> доля голосов с весом
              </span>
              <span>
                <i className="h" /> по головам
              </span>
              <span>число — места</span>
            </div>
          </section>
          {lastEl && (
            <section className="pt-card">
              <h3>Кто голосует — {yearOf(lastEl.date)} г.</h3>
              <div className="pt-classes">
                {lastEl.classes.map((c) => {
                  const share = lastEl.classVotes[c.id]?.[f.id] ?? 0
                  return (
                    <div key={c.id} className="pt-class">
                      <span>
                        {c.name} <small>×{c.weight}</small>
                      </span>
                      <span className="pt-agree-bar">
                        <i style={{ width: `${share * 100}%`, background: 'var(--pc)' }} />
                      </span>
                      <b>{Math.round(share * 100)}%</b>
                    </div>
                  )
                })}
              </div>
              <p className="hint">Доля каждого разряда избирателей, отдавших голос партии.</p>
            </section>
          )}
        </div>
      )}

      {P && (
        <div className="pt-grid">
          <section className="pt-card">
            <h3>Устройство: {P.structure.name}</h3>
            <p className="pt-small">{P.structure.text}</p>
            <div className="pt-pyramid">
              {P.structure.tiers.map(([t, n, d], i) => (
                <div key={t} style={{ width: `${46 + (54 * i) / Math.max(1, P.structure.tiers.length - 1)}%`, opacity: 1 - i * 0.08 }}>
                  <b>{t}</b>
                  <span>{n}</span>
                  {d && <small>{d}</small>}
                </div>
              ))}
            </div>
          </section>
          <section className="pt-card">
            <h3>Лидеры</h3>
            <div className="pt-leaders">
              <div className="pt-leaders-track">
                {P.leaders.map(([a, b, name], i) => (
                  <i key={name + a} style={{ left: `${tx(a)}%`, width: `${Math.max(1.5, tx(b ?? tlTo) - tx(a))}%`, opacity: 0.55 + (i % 2) * 0.3 }} title={name} />
                ))}
                {(() => {
                  const yx = tx(year)
                  return <span className="pt-now" style={{ left: `${yx}%` }} />
                })()}
              </div>
              <div className="pt-axis">
                <span>{tlFrom}</span>
                <span>{tlTo}</span>
              </div>
              <ul>
                {P.leaders.map(([a, b, name, id]) => (
                  <li key={name + a}>
                    <span className="pw-date">
                      {Math.floor(a)}–{b ? Math.floor(b) : 'н. в.'}
                    </span>
                    {id && entry(id) ? (
                      <button className="link-btn" onClick={() => onEntry(id)}>
                        {name}
                      </button>
                    ) : (
                      <span>{name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}

      {P && (
        <section className="pt-card">
          <h3>Вехи</h3>
          <ol className="pt-history">
            {P.history.map(([y, t]) => (
              <li key={y + t} className={Math.floor(y) <= year ? 'past' : ''} onClick={() => Math.floor(y) >= firstYear && Math.floor(y) <= lastYear && onYear(Math.floor(y))}>
                <b>{Math.floor(y)}</b>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {figures.length > 0 && (
        <section className="pt-card">
          <h3>Главные лица</h3>
          <div className="pt-figures">
            {figures.map((e) => {
              const r = resolve(e!, world.calendar.present)
              return (
                <button key={e!.id} onClick={() => onEntry(e!.id)}>
                  <span className="pt-fig-img">{r.image ? <img src={assetUrl(r.image)} alt="" /> : <Icon name="user" size={26} />}</span>
                  <b>{r.name}</b>
                  <small>{r.title}</small>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="pt-card">
        <h3>
          Скамья в {year} г. — {sitting.length}
        </h3>
        <div className="pw-members pt-members">
          {sitting.map((m) => (
            <button key={m.id} onClick={() => onMember(m.id)} title={m.title}>
              {portrait(m, 28)} {m.name}
            </button>
          ))}
          {!sitting.length && <span className="muted">В этом году у партии нет мест.</span>}
        </div>
        {stats.sponsored.filter((b) => b.key).length > 0 && (
          <>
            <div className="field-label">Главные законы партии</div>
            <ul className="pw-chron-bills">
              {stats.sponsored
                .filter((b) => b.key)
                .map((b) => (
                  <li key={b.id} onClick={() => onBill(b.id)}>
                    {yearOf(b.date)} — {b.title} <span className="muted">({b.outcome})</span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>

      {branches.length > 0 && (
        <section className="pt-card">
          <h3>Городские отделения</h3>
          <div className="pt-classes">
            {branches.map((b) => (
              <div key={b.l.id} className="pt-class">
                <span>{b.l.town}</span>
                <span className="pt-agree-bar">
                  <i style={{ width: `${b.all ? (b.n / b.all) * 100 : 0}%`, background: 'var(--pc)' }} />
                </span>
                <b>
                  {b.n}/{b.all}
                </b>
              </div>
            ))}
          </div>
        </section>
      )}

      {P?.secret && masterMode && (
        <div className="secret-box">
          <div className="field-label">Тайна мастера</div>
          {P.secret}
        </div>
      )}
    </div>
  )
}

/** Карточка партии в списке «Партии» */
export function PartyTile({ L, f, seats, onOpen }: { L: Legislature; f: LegislatureFaction; seats: number; onOpen: () => void }) {
  const world = useStore((s) => s.world!)
  const P = f.party ?? world.legislatures?.find((l) => l.stateId === L.stateId && !l.town && l.id !== L.id)?.factions.find((x) => x.id === f.id)?.party
  return (
    <button className="pt-tile" style={{ ['--pc' as string]: f.color }} onClick={onOpen}>
      <span className="pt-tile-seats">{seats}</span>
      <b>{f.name}</b>
      <span className="pt-tile-motto">{P?.motto ?? f.ideology}</span>
      <span className="pt-tile-sub">
        {f.ideology}
        {P ? ` · с ${Math.floor(P.founded)} г.` : ''}
      </span>
    </button>
  )
}
