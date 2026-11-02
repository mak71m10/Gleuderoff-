import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { assetUrl } from './ui'
import { formatDate, toParts } from '../calendar'
import { useStore } from '../store'
import type { Cabinet, Election, Legislature, LegislatureMember } from '../types'

// цвета разрядов избирателей — от простолюдинов к знати
const CLASS_COLOR: Record<string, string> = { common: '#8a7a64', owner: '#a8935a', burgher: '#6f8fa8', learned: '#4f9a8a', money: '#c9a45c', noble: '#9a5ab8' }
const pct = (x: number): string => `${Math.round(x * 1000) / 10}%`
const num = (x: number): string => Math.round(x).toLocaleString('ru-RU')
const sum = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0)

/** Человечки: вес голоса наглядно */
function People({ n, color }: { n: number; color: string }): ReactNode {
  return (
    <span className="el-people" aria-label={`вес ${n}`}>
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 10 16" style={{ fill: color }}>
          <circle cx="5" cy="3.2" r="2.6" />
          <path d="M1 16V9.5C1 7.5 2.6 6.5 5 6.5S9 7.5 9 9.5V16z" />
        </svg>
      ))}
    </span>
  )
}

/** Полукруг итогов выборов (меньше, чем зал) */
function ResultArc({ seats, order, color }: { seats: Record<string, number>; order: string[]; color: (f: string) => string }): ReactNode {
  const total = sum(seats)
  let a0 = Math.PI
  return (
    <svg viewBox="0 0 220 120" className="el-arc">
      {order
        .filter((f) => seats[f])
        .map((f) => {
          const a1 = a0 - (Math.PI * seats[f]) / total
          const p = (a: number, r: number): string => `${110 + r * Math.cos(a)} ${110 - r * Math.sin(a)}`
          const d = `M${p(a0, 100)} A100 100 0 0 1 ${p(a1, 100)} L${p(a1, 55)} A55 55 0 0 0 ${p(a0, 55)} Z`
          a0 = a1
          return (
            <path key={f} d={d} fill={color(f)} stroke="var(--bg)" strokeWidth="1">
              <title>{`${f}: ${seats[f]}`}</title>
            </path>
          )
        })}
      <text x="110" y="104" textAnchor="middle" className="el-arc-n">
        {total}
      </text>
    </svg>
  )
}

export function ElectionsView({
  L,
  year,
  onYear,
  onMember
}: {
  L: Legislature
  year: number
  onYear: (y: number) => void
  onMember: (id: string) => void
}): ReactNode {
  const world = useStore((s) => s.world!)
  const cal = world.calendar
  const yearOf = (d: number): number => toParts(cal, d).year
  const els = L.elections ?? []
  const fac = useMemo(() => new Map(L.factions.map((f) => [f.id, f])), [L])
  const color = (f: string): string => fac.get(f)?.color ?? '#777'
  const fname = (f: string): string => fac.get(f)?.name ?? f
  const idx = Math.max(0, els.map((e) => yearOf(e.date) <= year).lastIndexOf(true))
  const [pickedIdx, setPicked] = useState<number | null>(null)
  const ei = pickedIdx ?? idx
  const el: Election = els[ei]
  const prev = els[ei - 1]
  const [district, setDistrict] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  if (!el) return <p className="hint">Выборов не было.</p>
  const order = L.seatOrder.filter((f) => el.total.seats[f] != null)
  const d = el.districts.find((x) => x.name === district) ?? (el.districts.length === 1 ? el.districts[0] : null)
  const totalVoters = sum(el.voters)
  const totalCame = sum(el.came)
  const weighted = Object.fromEntries(el.classes.map((c) => [c.id, el.came[c.id] * c.weight]))
  const totalW = sum(weighted)
  const heads = sum(el.total.heads)
  const votes = sum(el.total.votes)
  const choose = (i: number): void => {
    setPicked(i)
    setDistrict(null)
    onYear(yearOf(els[i].date))
  }

  // карта округов: точки провинций
  const map = useMemo(() => {
    const pts = el.districts.flatMap((x) => x.pts)
    if (el.districts.length < 2 || !pts.length) return null
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    const pad = Math.max(60, (Math.max(...xs) - Math.min(...xs)) * 0.12)
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad
    const w = x1 - x0, h = y1 - y0
    return { x0, y0, w, h, r: Math.max(6, Math.min(Math.sqrt((w * h) / pts.length) * 0.36, w / 40)), fs: Math.max(w, h) / 34 }
  }, [el])
  const shade = (dist: Election['districts'][number]): string => {
    if (!focus) return color(dist.winner)
    const share = (dist.votes[focus] ?? 0) / Math.max(1, sum(dist.votes))
    return `color-mix(in srgb, ${color(focus)} ${Math.min(100, Math.round(share * 220))}%, #20242c)`
  }

  return (
    <div className="el">
      <div className="el-strip">
        {els.map((e, i) => (
          <button key={e.date} className={i === ei ? 'on' : ''} onClick={() => choose(i)}>
            <b>{yearOf(e.date)}</b>
            <span className="el-strip-bar">
              {L.seatOrder.map((f) => (e.total.seats[f] ? <i key={f} style={{ flex: e.total.seats[f], background: color(f) }} /> : null))}
            </span>
          </button>
        ))}
      </div>

      <section className="el-head">
        <div>
          <div className="pw-sub">
            {formatDate(cal, el.date)} · {el.constituent ? 'по девяти областям Освобождения' : el.districts.length > 1 ? `по ${el.districts.length} округам` : 'один округ — весь город'} · вес голоса по закону {el.system} г.
          </div>
          <h2>{el.name}</h2>
          {el.note && <p className="pw-bio">{el.note}</p>}
          <div className="el-kpis">
            <div><b>{num(totalVoters)}</b><span>избирателей</span></div>
            <div><b>{pct(totalCame / totalVoters)}</b><span>явка по головам</span></div>
            <div><b>{num(votes)}</b><span>голосов с учётом веса</span></div>
            <div><b>{L.seats}</b><span>мест</span></div>
          </div>
        </div>
        <div className="el-result">
          <ResultArc seats={el.total.seats} order={order} color={color} />
          <table className="pw-table el-table">
            <tbody>
              {order.map((f) => {
                const s = el.total.seats[f] ?? 0
                const ch = prev ? s - (prev.total.seats[f] ?? 0) : null
                return (
                  <tr key={f} className={focus === f ? 'on' : ''} onClick={() => setFocus(focus === f ? null : f)}>
                    <td><i className="pw-dot" style={{ background: color(f) }} /> {fname(f)}</td>
                    <td>{s}</td>
                    <td className={ch == null ? '' : ch > 0 ? 'up' : ch < 0 ? 'down' : ''}>{ch == null ? '' : ch > 0 ? `+${ch}` : ch || '='}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="el-card">
        <h3>Вес голоса: кто голосует и чей голос считается</h3>
        <div className="el-bars">
          <div className="el-bar-label">Пришли на участки — по головам</div>
          <div className="el-bar">
            {el.classes.map((c) => (
              <i key={c.id} style={{ flex: el.came[c.id], background: CLASS_COLOR[c.id] }} title={`${c.name}: ${pct(el.came[c.id] / totalCame)}`}>
                {el.came[c.id] / totalCame > 0.07 ? pct(el.came[c.id] / totalCame) : ''}
              </i>
            ))}
          </div>
          <div className="el-bar-label">Их голоса — с учётом веса</div>
          <div className="el-bar">
            {el.classes.map((c) => (
              <i key={c.id} style={{ flex: weighted[c.id], background: CLASS_COLOR[c.id] }} title={`${c.name}: ${pct(weighted[c.id] / totalW)}`}>
                {weighted[c.id] / totalW > 0.07 ? pct(weighted[c.id] / totalW) : ''}
              </i>
            ))}
          </div>
        </div>
        <div className="el-classes">
          {el.classes.map((c) => (
            <div key={c.id} className="el-class" style={{ borderColor: CLASS_COLOR[c.id] }}>
              <div className="el-class-head">
                <b>{c.name}</b>
                <span className="el-weight" style={{ background: CLASS_COLOR[c.id] }}>×{c.weight}</span>
              </div>
              <People n={c.weight} color={CLASS_COLOR[c.id]} />
              <div className="pw-sub">{c.who}</div>
              <div className="el-class-nums">
                <span>{pct(el.voters[c.id] / totalVoters)} избирателей</span>
                <span>явка {pct(el.came[c.id] / Math.max(1, el.voters[c.id]))}</span>
                <span><b>{pct(weighted[c.id] / totalW)}</b> голосов</span>
              </div>
            </div>
          ))}
        </div>
        <p className="pw-sub">
          Простолюдины — {pct(el.came.common / totalCame)} пришедших, но лишь {pct(weighted.common / totalW)} голосов. Знать и денежные люди вместе — {pct((el.came.noble + el.came.money) / totalCame)} пришедших и {pct((weighted.noble + weighted.money) / totalW)} голосов.
        </p>
      </section>

      <section className="el-card">
        <h3>Если бы голос был один на человека</h3>
        <p className="pw-sub">Доля каждой партии: по головам, по весу и в местах. Разница — то, что делает с выборами вес голоса.</p>
        <div className="el-compare">
          {order.map((f) => {
            const h = (el.total.heads[f] ?? 0) / heads
            const w = (el.total.votes[f] ?? 0) / votes
            const s = (el.total.seats[f] ?? 0) / L.seats
            const max = 0.55
            return (
              <div key={f} className="el-cmp-row">
                <span className="el-cmp-name"><i className="pw-dot" style={{ background: color(f) }} /> {fname(f)}</span>
                <span className="el-cmp-bars">
                  <i className="h" style={{ width: `${(h / max) * 100}%`, background: color(f) }} title={`по головам ${pct(h)}`} />
                  <i className="w" style={{ width: `${(w / max) * 100}%`, background: color(f) }} title={`по весу ${pct(w)}`} />
                  <i className="s" style={{ width: `${(s / max) * 100}%`, background: color(f) }} title={`места ${pct(s)}`} />
                </span>
                <span className="el-cmp-n">{pct(h)} → {pct(w)} → <b>{el.total.seats[f] ?? 0}</b></span>
              </div>
            )
          })}
        </div>
        <div className="pw-legend el-cmp-legend">
          <span><i className="lg h" /> по головам</span>
          <span><i className="lg w" /> по весу</span>
          <span><i className="lg s" /> места</span>
        </div>
      </section>

      <div className="el-grid">
        {map && (
          <section className="el-card">
            <h3>{el.constituent ? 'Области' : 'Округа'} — {focus ? `сила «${fname(focus)}»` : 'кто победил по голосам'}</h3>
            <svg viewBox={`${map.x0} ${map.y0} ${map.w} ${map.h}`} className="el-map">
              {el.districts.map((x) => (
                <g key={x.name} className={`el-dist ${district === x.name ? 'on' : ''}`} onClick={() => setDistrict(district === x.name ? null : x.name)}>
                  {x.pts.map(([px, py], i) => (
                    <circle key={i} cx={px} cy={py} r={map.r} fill={shade(x)} />
                  ))}
                  <title>{`${x.name}: ${x.seats} мест`}</title>
                </g>
              ))}
              {el.districts.map((x) => {
                const cx = x.pts.reduce((s, p) => s + p[0], 0) / x.pts.length
                const cy = x.pts.reduce((s, p) => s + p[1], 0) / x.pts.length
                return (
                  <g key={x.name} className="el-map-label" pointerEvents="none">
                    <text x={cx} y={cy} fontSize={map.fs} textAnchor="middle">
                      {x.name.replace('Округ ', '')}
                    </text>
                    <text x={cx} y={cy + map.fs * 1.1} fontSize={map.fs * 0.8} textAnchor="middle">
                      {x.seats} мест
                    </text>
                  </g>
                )
              })}
            </svg>
            <p className="hint">Нажмите на округ — подробности; на партию в таблице итогов — её сила по округам.</p>
          </section>
        )}

        <section className="el-card">
          {d ? (
            <>
              <h3>{d.name}</h3>
              <div className="pw-sub">
                {d.seats} мест · избирателей {num(sum(d.voters))} · голосов с весом {num(sum(d.votes))}
              </div>
              <div className="pw-seatbar">
                {L.seatOrder.map((f) => (d.seatsBy[f] ? <i key={f} style={{ flex: d.seatsBy[f], background: color(f) }} title={`${fname(f)}: ${d.seatsBy[f]}`} /> : null))}
              </div>
              <table className="pw-table el-table">
                <thead>
                  <tr><td /><td>по головам</td><td>с весом</td><td>места</td></tr>
                </thead>
                <tbody>
                  {order.filter((f) => d.votes[f]).map((f) => (
                    <tr key={f}>
                      <td><i className="pw-dot" style={{ background: color(f) }} /> {fname(f)}</td>
                      <td>{pct((d.heads[f] ?? 0) / sum(d.heads))}</td>
                      <td>{pct((d.votes[f] ?? 0) / sum(d.votes))}</td>
                      <td>{d.seatsBy[f] || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="field-label">Явка по разрядам</div>
              <div className="el-turnout">
                {el.classes.map((c) => (
                  <span key={c.id}>
                    <i style={{ height: `${(d.turnout[c.id] ?? 0) * 100}%`, background: CLASS_COLOR[c.id] }} />
                    <b>{pct(d.turnout[c.id] ?? 0)}</b>
                    <small>{c.name.split(' ')[0]}</small>
                  </span>
                ))}
              </div>
              {el.incidents.filter((x) => x.district === d.name).map((x) => (
                <div key={x.text} className="el-incident">{x.text}</div>
              ))}
              <div className="field-label">Избраны</div>
              <div className="pw-members">
                {L.members
                  .filter((m) => m.district === d.name && m.from >= el.date && m.from < el.date + 200)
                  .map((m) => (
                    <button key={m.id} onClick={() => onMember(m.id)} title={m.origin}>
                      <i className="pw-dot" style={{ background: color(m.faction) }} /> {m.name}
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <h3>Нарушения и происшествия</h3>
              {el.incidents.length ? el.incidents.map((x) => (
                <div key={x.text} className="el-incident"><b>{x.district}.</b> {x.text}</div>
              )) : <p className="pw-sub">Выборы прошли тихо — по меркам Республики.</p>}
            </>
          )}
        </section>
      </div>

      <section className="el-card">
        <h3>Кто за кого голосует</h3>
        <div className="el-matrix" style={{ gridTemplateColumns: `160px repeat(${order.length}, minmax(34px, 1fr))` }}>
          <span />
          {order.map((f) => (
            <span key={f} className="el-mx-h" title={fname(f)} style={{ color: color(f) }}>{fname(f).split(' ').map((w) => w[0]).join('').slice(0, 3)}</span>
          ))}
          {el.classes.map((c) => (
            <Fragment key={c.id}>
              <span className="el-mx-r">{c.name}</span>
              {order.map((f) => {
                const v = el.classVotes[c.id]?.[f] ?? 0
                return (
                  <span key={c.id + f} className="el-mx-c" style={{ background: `color-mix(in srgb, ${color(f)} ${Math.round(Math.min(1, v * 2.2) * 100)}%, transparent)` }} title={`${c.name} → ${fname(f)}: ${pct(v)}`}>
                    {v >= 0.05 ? Math.round(v * 100) : ''}
                  </span>
                )
              })}
            </Fragment>
          ))}
        </div>
        <p className="hint">Доля голосов разряда (по головам), отданных каждой партии, %. Наведите на клетку, чтобы увидеть название.</p>
      </section>

      <section className="el-card">
        <h3>Все выборы</h3>
        <div className="el-history">
          {els.map((e, i) => (
            <button key={e.date} className={i === ei ? 'on' : ''} onClick={() => choose(i)}>
              <span className="el-hist-col">
                {L.seatOrder.map((f) => (e.total.seats[f] ? <i key={f} style={{ flex: e.total.seats[f], background: color(f) }} title={`${fname(f)}: ${e.total.seats[f]}`} /> : null))}
              </span>
              <b>{yearOf(e.date)}</b>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export function CabinetView({
  L,
  year,
  onYear,
  onMember,
  onEntry,
  portrait
}: {
  L: Legislature
  year: number
  onYear: (y: number) => void
  onMember: (id: string) => void
  onEntry: (id: string) => void
  portrait: (m: LegislatureMember, size?: number) => ReactNode
}): ReactNode {
  const world = useStore((s) => s.world!)
  const cal = world.calendar
  const yearOf = (d: number): number => toParts(cal, d).year
  const cabs = L.cabinets ?? []
  const fac = new Map(L.factions.map((f) => [f.id, f]))
  const color = (f: string): string => fac.get(f)?.color ?? '#777'
  const yearEnd = cal.months.reduce((s, m) => s + m.days, 0)
  const d = (year - 1) * yearEnd + yearEnd / 2
  const auto = cabs.findIndex((c) => c.from <= d && (c.to == null || c.to > d))
  const [picked, setPicked] = useState<number | null>(null)
  const ci = picked ?? (auto < 0 ? cabs.length - 1 : auto)
  const cab: Cabinet | undefined = cabs[ci]
  const head = L.head ? world.entries.find((e) => e.id === L.head!.entryId) : null
  const t0 = cabs[0]?.from ?? 0
  const end = Math.max(...cabs.map((c) => c.to ?? (1010 - 1) * yearEnd + yearEnd), t0 + 1)
  if (!cab) return <p className="hint">Кабинетов нет.</p>
  const seatsAt = (f: string): number => L.members.filter((m) => m.faction === f && m.from <= cab.from + 1 && (m.to == null || m.to > cab.from + 1)).length
  const member = (id: string) => L.members.find((m) => m.id === id)
  return (
    <div className="el">
      {head && (
        <div className="cab-head" onClick={() => onEntry(head.id)}>
          <span className="cab-head-t">{L.head!.title} — несменяем, пока его переизбирают</span>
          <b>{head.base.name}</b>
          <span className="pw-sub">{head.base.title}</span>
        </div>
      )}
      <div className="cab-line">
        {cabs.map((c, i) => {
          const chief = c.ministers[0]
          const to = c.to ?? end
          return (
            <button
              key={c.id}
              className={i === ci ? 'on' : ''}
              style={{ flex: Math.max(to - c.from, 120), background: color(chief?.faction || c.coalition[0]) }}
              onClick={() => (setPicked(i), onYear(yearOf(c.from)))}
              title={`${c.name} (${yearOf(c.from)}–${c.to ? yearOf(c.to) : 'н. в.'})`}
            >
              <span>{c.name.replace(/^Кабинет /, '').replace(/^(Первый|Второй|Третий) кабинет /, (m) => m.split(' ')[0].slice(0, 1) + '. ')}</span>
            </button>
          )
        })}
      </div>
      <div className="cab-years">
        <span>{yearOf(t0)}</span>
        <span>{yearOf(end)}</span>
      </div>
      <section className="el-card">
        <div className="pw-sub">
          {formatDate(cal, cab.from, false)} — {cab.to ? formatDate(cal, cab.to, false) : 'по сей день'}
        </div>
        <h2>{cab.name}</h2>
        <div className="cab-coal">
          Коалиция:
          {cab.coalition.map((f) => (
            <span key={f} className="pw-chip" style={{ borderColor: color(f) }}>
              <i style={{ background: color(f) }} /> {fac.get(f)?.name}{cab.from >= L.from ? ` · ${seatsAt(f)}` : ''}
            </span>
          ))}
          {cab.from >= L.from ? <span className="pw-sub">— {cab.coalition.reduce((s, f) => s + seatsAt(f), 0)} мест из {L.seats}</span> : <span className="pw-sub">— до первого собрания</span>}
        </div>
        {cab.end && <div className="el-incident">Чем кончился: {cab.end}.</div>}
        <div className="cab-grid">
          {cab.ministers.map((x) => {
            const m = x.memberId ? member(x.memberId) : null
            const e = x.entryId ? world.entries.find((q) => q.id === x.entryId) : null
            return (
              <button key={x.post} className="cab-min" onClick={() => (m ? onMember(m.id) : e ? onEntry(e.id) : null)}>
                {m ? portrait(m, 54) : <span className="pw-portrait" style={{ width: 54, height: 54, borderColor: '#888' }}>{e?.base.image ? <img src={assetUrl(e.base.image)} alt="" /> : <span style={{ background: '#555' }}>{x.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}</span>}
                <span>
                  <small>{x.post}</small>
                  <b>{x.name}</b>
                  {x.faction && (
                    <span className="pw-sub">
                      <i className="pw-dot" style={{ background: color(x.faction) }} /> {fac.get(x.faction)?.name}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      <section className="el-card">
        <h3>Все кабинеты</h3>
        <ul className="pw-record">
          {cabs.map((c, i) => (
            <li key={c.id} onClick={() => (setPicked(i), onYear(yearOf(c.from)))} className={i === ci ? 'on' : ''}>
              <span className="pw-date">{yearOf(c.from)}–{c.to ? yearOf(c.to) : 'н. в.'}</span>
              <span>
                <b>{c.name}</b> — {c.ministers[0]?.name}
                {c.end ? <span className="muted"> · {c.end}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
