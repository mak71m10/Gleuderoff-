import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { resolve } from '../temporal'
import { formatDate, toParts } from '../calendar'
import { assetUrl } from './ui'
import { Icon } from './Icon'
import type { Bill, Legislature, LegislatureMember } from '../types'
import { CabinetView, ElectionsView } from './Elections'
import { PartyTile, PartyView } from './Party'

type Tab = 'hall' | 'bills' | 'chronicle' | 'factions' | 'elections' | 'cabinet'
const VOTE = { y: { label: 'За', color: '#5f9a4f' }, n: { label: 'Против', color: '#b8433a' }, a: { label: 'Воздержался', color: '#a99c80' }, '-': { label: 'Отсутствовал', color: '#3a3f4a' } } as const
type V = keyof typeof VOTE

/** Места полукруглого зала: ряды от внутреннего к внешнему, места в порядке слева направо. */
function hemicycle(n: number): { x: number; y: number; r: number }[] {
  const rows = Math.max(2, Math.round(Math.sqrt(n / 3.2)))
  const r0 = 150, r1 = 440
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((r1 - r0) * i) / Math.max(1, rows - 1))
  const sum = radii.reduce((s, r) => s + r, 0)
  const per = radii.map((r) => Math.max(1, Math.round((n * r) / sum)))
  let diff = n - per.reduce((s, v) => s + v, 0)
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) {
    per[i] += Math.sign(diff)
    diff -= Math.sign(diff)
  }
  const seat = Math.min(26, (Math.PI * r0) / per[0] / 2.3, (r1 - r0) / Math.max(1, rows - 1) / 2.3)
  const pts: { x: number; y: number; r: number; a: number }[] = []
  radii.forEach((rad, i) => {
    for (let j = 0; j < per[i]; j++) {
      const a = Math.PI - (Math.PI * (j + 0.5)) / per[i]
      pts.push({ x: 500 + rad * Math.cos(a), y: 480 - rad * Math.sin(a), r: seat, a })
    }
  })
  // слева направо по углу, внутри угла — от внутреннего ряда
  return pts.sort((p, q) => q.a - p.a || Math.hypot(p.x - 500, p.y - 480) - Math.hypot(q.x - 500, q.y - 480))
}

export function PowerView({ legislature: L, onClose }: { legislature: Legislature; onClose: () => void }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)
  const cal = world.calendar
  const yearOf = (d: number): number => toParts(cal, d).year
  // «12 Фраул» — день и месяц без года
  const dayMonth = (d: number): string => {
    const p = toParts(cal, d)
    return `${p.day} ${cal.months[p.month]?.name ?? ''}`
  }
  const firstYear = yearOf(L.from)
  const lastYear = Math.max(firstYear, yearOf(L.bills[L.bills.length - 1]?.date ?? L.from))
  const [year, setYear] = useState(() => Math.min(lastYear, Math.max(firstYear, yearOf(date))))
  const [tab, setTab] = useState<Tab>('hall')
  const [member, setMember] = useState<string | null>(null)
  const [billId, setBillId] = useState<string | null>(null)
  const [partyId, setPartyId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const entry = (id: string) => world.entries.find((e) => e.id === id)
  const fac = useMemo(() => new Map(L.factions.map((f) => [f.id, f])), [L])
  const mIndex = useMemo(() => new Map(L.members.map((m, i) => [m.id, i])), [L])
  const bill = L.bills.find((b) => b.id === billId) ?? null
  const yearEnd = cal.months.reduce((s, m) => s + m.days, 0)
  // состав зала: на дату выбранного закона, иначе — на конец выбранного года (или на сегодня)
  const at = bill ? bill.date : date >= L.from && yearOf(date) === year ? date : (year - 1) * yearEnd + yearEnd - 1
  const sitting = useMemo(() => {
    const list = L.members.filter((m) => m.from <= at && (m.to == null || m.to > at))
    const order = (f: string): number => (L.seatOrder.indexOf(f) + 1 || 99)
    return list.sort((a, b) => order(a.faction) - order(b.faction) || (a.group ?? '').localeCompare(b.group ?? '') || a.from - b.from)
  }, [L, at])
  const seats = useMemo(() => hemicycle(Math.max(sitting.length, 1)), [sitting.length])
  const yearBills = L.bills.filter((b) => yearOf(b.date) === year)
  const voteOf = (b: Bill, m: LegislatureMember): V | ' ' => (b.votes ? (b.votes[mIndex.get(m.id)!] as V) : ' ')
  const sel = L.members.find((m) => m.id === member) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // на телефоне карточка депутата или закона стоит под залом — подкручиваем к ней
  useEffect(() => {
    if (!(member || billId) || !window.matchMedia('(max-width: 900px)').matches) return
    document.querySelector('.power .pw-side')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [member, billId])

  const openEntry = (id: string): void => {
    const e = entry(id)
    if (!e) return
    select({ type: 'entry', id })
    setView(e.kind)
    onClose()
  }
  const portrait = (m: LegislatureMember, size = 56): ReactNode => {
    const e = m.entryId ? entry(m.entryId) : null
    const img = e ? resolve(e, date).image : m.image ?? ''
    const color = fac.get(m.faction)?.color ?? '#888'
    // в версии для телефона портреты депутатов собраны листами 10×10: «лист#колонка,строка»
    const sheet = img.match(/^(.+)#(\d+),(\d+)$/)
    return (
      <span className="pw-portrait" style={{ width: size, height: size, borderColor: color }}>
        <span style={{ background: color }}>{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
        {img && (sheet ? <i className="pw-sheet" style={{ backgroundImage: `url(${assetUrl(sheet[1])})`, backgroundPosition: `${(Number(sheet[2]) / 9) * 100}% ${(Number(sheet[3]) / 9) * 100}%` }} /> : <img src={assetUrl(img)} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />)}
      </span>
    )
  }
  const tallyBar = (t: Bill['tally']): ReactNode =>
    t ? (
      <span className="pw-tally" title={`За ${t.y} · против ${t.n} · воздержались ${t.a} · отсутствовали ${t.abs}`}>
        {(['y', 'n', 'a', '-'] as V[]).map((k) => {
          const v = k === '-' ? t.abs : t[k as 'y' | 'n' | 'a']
          return v ? <i key={k} style={{ flex: v, background: VOTE[k].color }} /> : null
        })}
      </span>
    ) : (
      <span className="pw-tally pw-tally-empty">голосование не проводилось</span>
    )
  const outcome = (b: Bill): ReactNode => <span className={`pw-outcome o-${b.outcome === 'принят' ? 'yes' : b.outcome === 'отклонён' ? 'no' : 'wait'}`}>{b.outcome}</span>
  const sponsorName = (b: Bill): string => {
    const m = L.members.find((x) => x.id === b.sponsor)
    if (m) return m.name
    if (b.sponsorEntry) return entry(b.sponsorEntry)?.base.name ?? ''
    return fac.get(b.sponsorFaction)?.name ?? ''
  }
  const stanceBars = (st: number[], color: string): ReactNode => (
    <div className="pw-stances">
      {L.issues.map((is, i) => (
        <div key={is.id} className="pw-stance">
          <div className="pw-stance-name">{is.name}</div>
          <div className="pw-stance-axis">
            <span>{is.minus}</span>
            <div className="pw-stance-track">
              <i className="pw-stance-mid" />
              <b style={{ left: `${((st[i] + 2) / 4) * 100}%`, background: color }} />
            </div>
            <span>{is.plus}</span>
          </div>
        </div>
      ))}
    </div>
  )

  // ---------- панели ----------
  const memberPanel = (m: LegislatureMember): ReactNode => {
    const f = fac.get(m.faction)!
    const record = L.bills.filter((b) => b.votes && b.date >= m.from && (m.to == null || b.date < m.to))
    const withLine = record.filter((b) => {
      const v = voteOf(b, m)
      if (v === '-' || v === ' ') return false
      const same = L.members.filter((x) => x.faction === m.faction && b.votes[mIndex.get(x.id)!] !== ' ' && b.votes[mIndex.get(x.id)!] !== '-')
      const ys = same.filter((x) => b.votes[mIndex.get(x.id)!] === 'y').length
      const ns = same.filter((x) => b.votes[mIndex.get(x.id)!] === 'n').length
      return v === (ys >= ns ? 'y' : 'n')
    }).length
    const shown = record.filter((b) => yearOf(b.date) === year)
    return (
      <div className="pw-panel">
        <div className="pw-person">
          {portrait(m, 84)}
          <div>
            <h2>{m.name}</h2>
            <div className="pw-sub">{m.title}{m.origin ? ` · ${m.origin}` : ''}</div>
            <button className="pw-chip" style={{ borderColor: f.color }} onClick={() => (setPartyId(f.id), setTab('factions'))} title="Открыть страницу партии">
              <i style={{ background: f.color }} /> {f.name}{m.group ? ` · ${m.group}` : ''}{m.race ? ` · ${m.race}` : ''}
            </button>
            <div className="pw-sub">
              В собрании: {formatDate(cal, m.from, false)} — {m.to ? `${formatDate(cal, m.to, false)}${m.left ? ` (${m.left})` : ''}` : 'по сей день'} · род. {m.born} г.
            </div>
          </div>
        </div>
        <p className="pw-bio">{m.bio}</p>
        {m.entryId && (
          <button className="link-btn" onClick={() => openEntry(m.entryId)}>
            Открыть карточку персонажа
          </button>
        )}
        <div className="field-label">Что отстаивает</div>
        {stanceBars(m.stance, f.color)}
        <div className="field-label">
          Голосования за {year} г. · со своей скамьёй в {record.length ? Math.round((withLine / record.length) * 100) : 0}% случаев за всё время
        </div>
        <ul className="pw-record">
          {shown.length ? (
            shown.map((b) => {
              const v = voteOf(b, m)
              return (
                <li key={b.id} onClick={() => (setBillId(b.id), setTab('bills'))}>
                  <span className="pw-vote" style={{ background: VOTE[v as V]?.color ?? 'transparent' }}>{VOTE[v as V]?.label ?? '—'}</span>
                  <span>{b.title}</span>
                  {outcome(b)}
                </li>
              )
            })
          ) : (
            <li className="muted">В этом году голосований с его участием не было.</li>
          )}
        </ul>
      </div>
    )
  }
  const billPanel = (b: Bill): ReactNode => (
    <div className="pw-panel">
      <div className="pw-sub">
        {formatDate(cal, b.date)} · {b.kind}
      </div>
      <h2>{b.title}</h2>
      <div className="pw-bill-head">
        {outcome(b)}
        <span className="pw-sub">Внёс: {sponsorName(b)}</span>
      </div>
      <p className="pw-bio">{b.summary}</p>
      {tallyBar(b.tally)}
      {b.tally && (
        <>
          <div className="pw-legend">
            {(['y', 'n', 'a', '-'] as V[]).map((k) => (
              <span key={k}>
                <i style={{ background: VOTE[k].color }} /> {VOTE[k].label}: {k === '-' ? b.tally!.abs : b.tally![k as 'y' | 'n' | 'a']}
              </span>
            ))}
          </div>
          <div className="pw-sub">{b.kind === 'хартия' ? 'Хартия: нужно две трети присутствующих.' : 'Нужно больше голосов «за», чем «против».'}</div>
          <div className="field-label">По скамьям</div>
          <table className="pw-table">
            <tbody>
              {L.seatOrder.map((fid) => {
                const f = fac.get(fid)!
                const ms = sitting.filter((m) => m.faction === fid)
                if (!ms.length) return null
                const c = { y: 0, n: 0, a: 0, '-': 0 } as Record<V, number>
                for (const m of ms) {
                  const v = voteOf(b, m)
                  if (v !== ' ') c[v]++
                }
                return (
                  <tr key={fid}>
                    <td>
                      <i className="pw-dot" style={{ background: f.color }} /> {f.name}
                    </td>
                    {(['y', 'n', 'a', '-'] as V[]).map((k) => (
                      <td key={k} style={{ color: VOTE[k].color }}>
                        {c[k] || ''}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="field-label">Известные лица</div>
          <ul className="pw-record">
            {sitting
              .filter((m) => m.entryId)
              .map((m) => {
                const v = voteOf(b, m)
                return (
                  <li key={m.id} onClick={() => (setMember(m.id), setTab('hall'))}>
                    <span className="pw-vote" style={{ background: VOTE[v as V]?.color }}>{VOTE[v as V]?.label}</span>
                    <span>{m.name}</span>
                  </li>
                )
              })}
          </ul>
        </>
      )}
    </div>
  )
  const yearPanel = (): ReactNode => {
    const c = L.chronicle.find((x) => x.year === year)
    const counts = new Map<string, number>()
    for (const m of sitting) counts.set(m.faction, (counts.get(m.faction) ?? 0) + 1)
    return (
      <div className="pw-panel">
        <h2>{year} год</h2>
        {c?.convocation && <div className="pw-conv">{c.convocation}</div>}
        {c?.text && <p className="pw-bio">{c.text}</p>}
        {c?.auto && <p className="pw-sub">{c.auto}</p>}
        {L.strikes?.filter((x) => yearOf(x.from) === year).map((x) => (
          <div key={x.title} className="el-incident">
            <b>{x.title}</b> ({x.town}). {x.text}
          </div>
        ))}
        <div className="field-label">Состав — {sitting.length} мест</div>
        <div className="pw-seatbar">
          {L.seatOrder.map((fid) => (counts.get(fid) ? <i key={fid} style={{ flex: counts.get(fid), background: fac.get(fid)!.color }} title={`${fac.get(fid)!.name}: ${counts.get(fid)}`} /> : null))}
        </div>
        <ul className="pw-factlist">
          {L.seatOrder.map((fid) => {
            const f = fac.get(fid)!
            return counts.get(fid) ? (
              <li key={fid}>
                <i className="pw-dot" style={{ background: f.color }} /> {f.name} <b>{counts.get(fid)}</b>
              </li>
            ) : null
          })}
        </ul>
        <div className="field-label">Законы года</div>
        <ul className="pw-record">
          {yearBills.map((b) => (
            <li key={b.id} onClick={() => (setBillId(b.id), setTab('bills'))}>
              <span className="pw-date">{dayMonth(b.date)}</span>
              <span>{b.title}</span>
              {outcome(b)}
            </li>
          ))}
        </ul>
        <p className="hint">Нажмите на место в зале, чтобы увидеть депутата, его взгляды и голоса.</p>
      </div>
    )
  }

  // ---------- зал ----------
  // на телефоне зал шире экрана — открываем его по центру
  const centerHall = (el: HTMLDivElement | null): void => {
    if (el && el.scrollLeft === 0 && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }
  const hall = (
    <div className="pw-hall" ref={centerHall}>
      <svg viewBox="40 20 920 480" className="pw-hemi">
        <defs>
          <radialGradient id="pw-floor" cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="rgba(201,164,92,0.18)" />
            <stop offset="100%" stopColor="rgba(201,164,92,0)" />
          </radialGradient>
        </defs>
        <path d="M60 480 A440 440 0 0 1 940 480 Z" fill="url(#pw-floor)" />
        <rect x="455" y="455" width="90" height="26" rx="4" fill="#2a2f3a" stroke="var(--gold-dim)" />
        <text x="500" y="473" textAnchor="middle" className="pw-tribune">{L.chairTitle}</text>
        {sitting.map((m, i) => {
          const p = seats[i]
          if (!p) return null
          const v = bill ? voteOf(bill, m) : null
          const color = bill ? (v && v !== ' ' ? VOTE[v].color : '#222') : fac.get(m.faction)?.color
          const isSel = m.id === member
          return (
            <circle
              key={m.id}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={color}
              className={`pw-seat ${isSel ? 'sel' : ''} ${m.entryId ? 'known' : ''}`}
              onClick={() => (setMember(m.id), setBillId(bill && tab === 'bills' ? bill.id : null))}
            >
              <title>{`${m.name} — ${fac.get(m.faction)?.name}${v && v !== ' ' ? ` · ${VOTE[v].label}` : ''}`}</title>
            </circle>
          )
        })}
      </svg>
      {bill && (
        <div className="pw-hall-note">
          Цвета — голоса по закону «{bill.title}».{' '}
          <button className="link-btn" onClick={() => setBillId(null)}>
            Показать скамьи
          </button>
        </div>
      )}
    </div>
  )

  const filtered = q.trim() ? L.bills.filter((b) => (b.title + ' ' + b.summary).toLowerCase().includes(q.toLowerCase())) : yearBills
  const chart = useMemo(() => {
    // места фракций по годам — полосы
    const ys = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)
    const rows = ys.map((y) => {
      const d = (y - 1) * yearEnd + yearEnd - 1
      const c = new Map<string, number>()
      for (const m of L.members) if (m.from <= d && (m.to == null || m.to > d)) c.set(m.faction, (c.get(m.faction) ?? 0) + 1)
      return { y, c }
    })
    return { ys, rows }
  }, [L, firstYear, lastYear, yearEnd])

  return createPortal(
    <div className="power">
      <header className="pw-head">
        <div className="pw-title">
          <span>
            {world.states.find((s) => s.id === L.stateId)?.base.name}
            {L.town ? ` · ${L.town}` : ''}
            {L.unofficial ? ' · неофициальный орган' : ''}
          </span>
          <b>{L.name}</b>
        </div>
        <div className="pw-year">
          <button onClick={() => setYear(Math.max(firstYear, year - 1))}>‹</button>
          <input type="range" min={firstYear} max={lastYear} value={year} onChange={(e) => (setYear(Number(e.target.value)), setBillId(null))} />
          <button onClick={() => setYear(Math.min(lastYear, year + 1))}>›</button>
          <span className="pw-year-n">{year} г.</span>
        </div>
        <nav className="pw-tabs">
          {(
            [
              ['hall', 'Зал'],
              ['bills', 'Законы'],
              ['chronicle', 'Хроника'],
              ['factions', 'Партии'],
              ...(L.elections ? [['elections', 'Выборы']] : []),
              ...(L.cabinets ? [['cabinet', 'Кабинет']] : [])
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="modal-close" onClick={onClose} title="Закрыть (Esc)">
          <Icon name="x" size={18} />
        </button>
      </header>

      {tab === 'hall' && (
        <div className="pw-body">
          <div className="pw-main">
            <p className="pw-desc">{L.description}</p>
            {hall}
          </div>
          <aside className="pw-side">{sel ? memberPanel(sel) : bill ? billPanel(bill) : yearPanel()}</aside>
        </div>
      )}

      {tab === 'bills' && (
        <div className="pw-body">
          <div className="pw-main">
            <div className="search pw-search">
              <Icon name="search" size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Поиск по всем законам (${L.bills.length})…`} />
            </div>
            <ul className="pw-bills">
              {filtered.map((b) => (
                <li key={b.id} className={b.id === billId ? 'on' : ''} onClick={() => (setBillId(b.id), setMember(null), setYear(yearOf(b.date)))}>
                  <div className="pw-bill-row">
                    <span className="pw-date">{dayMonth(b.date)} {yearOf(b.date)} г.</span>
                    <span className="pw-kind">{b.kind}</span>
                    {outcome(b)}
                  </div>
                  <div className="pw-bill-title">{b.title}</div>
                  <div className="pw-sub">Внёс: {sponsorName(b)}</div>
                  {tallyBar(b.tally)}
                </li>
              ))}
              {!filtered.length && <li className="muted">Ничего не найдено.</li>}
            </ul>
          </div>
          <aside className="pw-side">
            {bill ? (
              <>
                {hall}
                {billPanel(bill)}
              </>
            ) : (
              <p className="hint pw-panel">Выберите закон — увидите, кто как голосовал.</p>
            )}
          </aside>
        </div>
      )}

      {tab === 'chronicle' && (
        <div className="pw-body pw-body-one">
          <div className="pw-chart">
            <div className="field-label">Места скамей по годам — нажмите на год</div>
            <div className="pw-bars">
              {chart.rows.map((r) => (
                <button key={r.y} className={`pw-bar ${r.y === year ? 'on' : ''}`} onClick={() => setYear(r.y)} title={`${r.y} г.`}>
                  {L.seatOrder.map((fid) => (r.c.get(fid) ? <i key={fid} style={{ flex: r.c.get(fid), background: fac.get(fid)!.color }} /> : null))}
                  <span>{r.y % 5 === 0 || r.y === firstYear ? r.y : ''}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="pw-chron">
            {L.chronicle.map((c) => (
              <section key={c.year} className={`pw-chron-year ${c.year === year ? 'on' : ''}`} onClick={() => setYear(c.year)}>
                <h3>{c.year}</h3>
                <div>
                  {c.convocation && <div className="pw-conv">{c.convocation}</div>}
                  {c.text && <p>{c.text}</p>}
                  <p className="pw-sub">{c.auto}</p>
                  <ul className="pw-chron-bills">
                    {L.bills
                      .filter((b) => yearOf(b.date) === c.year && b.key)
                      .map((b) => (
                        <li key={b.id} onClick={(e) => (e.stopPropagation(), setBillId(b.id), setTab('bills'))}>
                          {outcome(b)} {b.title}
                        </li>
                      ))}
                  </ul>
                </div>
              </section>
            ))}
            {L.archive.length > 0 && (
              <section className="pw-chron-year pw-archive">
                <h3>Архив</h3>
                <div>
                  <p className="pw-sub">Главные акты до революции — поимённые голоса не сохранились.</p>
                  <ul className="pw-chron-bills">
                    {L.archive.map((a) => (
                      <li key={a.title}>
                        <b>{yearOf(a.date)} г.</b> {a.title}. <span className="muted">{a.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'elections' && (
        <div className="pw-body pw-body-one">
          <ElectionsView L={L} year={year} onYear={setYear} onMember={(id) => (setMember(id), setBillId(null), setTab('hall'))} />
        </div>
      )}

      {tab === 'cabinet' && (
        <div className="pw-body pw-body-one">
          <CabinetView L={L} year={year} onYear={setYear} onMember={(id) => (setMember(id), setBillId(null), setTab('hall'))} onEntry={openEntry} portrait={portrait} />
        </div>
      )}

      {tab === 'factions' && (
        <div className="pw-body pw-body-one">
          {partyId && fac.get(partyId) ? (
            <PartyView
              key={partyId}
              L={L}
              f={fac.get(partyId)!}
              year={year}
              onYear={(y) => (setYear(y), setBillId(null))}
              onMember={(id) => (setMember(id), setBillId(null), setTab('hall'))}
              onEntry={openEntry}
              onBill={(id) => {
                const b = L.bills.find((x) => x.id === id)
                setBillId(id)
                setMember(null)
                setTab('bills')
                if (b) setYear(yearOf(b.date))
              }}
              onParty={(id) => (setPartyId(id), document.querySelector('.power .pw-body-one')?.scrollTo({ top: 0 }))}
              onBack={() => setPartyId(null)}
              portrait={portrait}
              stanceBars={stanceBars}
            />
          ) : (
            <>
              <p className="pw-desc">Партии и скамьи собрания — нажмите, чтобы открыть историю, заветы, манифест, устройство и главных лиц.</p>
              <div className="pt-tiles">
                {L.seatOrder.map((fid) => (
                  <PartyTile key={fid} L={L} f={fac.get(fid)!} seats={sitting.filter((m) => m.faction === fid).length} onOpen={() => setPartyId(fid)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}

/** Кнопка «открыть зал» для любого собрания (страна, город, Совет) */
export function PowerButton({ legislature: L, title }: { legislature: Legislature; title?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="power-open" onClick={() => setOpen(true)}>
        <Icon name="balance" size={26} />
        <span>
          <b>{title ?? `${L.name} — зал, законы, голоса по годам`}</b>
          <span>
            {L.seats} мест · {L.bills.length} законов{L.elections ? ` · ${L.elections.length} выборов` : ''}
            {L.cabinets ? ` · ${L.cabinets.length} кабинетов` : ''}
            {L.unofficial ? ' · неофициальный орган' : ''}
          </span>
        </span>
      </button>
      {open && <PowerView legislature={L} onClose={() => setOpen(false)} />}
    </>
  )
}
