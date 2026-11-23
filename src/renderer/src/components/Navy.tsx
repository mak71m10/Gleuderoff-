import { useMemo } from 'react'
import { useStore } from '../store'
import { fmtMarks, fmtPeople } from '../economy'
import { ARMAMENT, CREW, SHIP, SHIPS, SHIP_STATS, milesPerDay, squadronPower, squadronStats, type ShipType, type Squadron, type StateNavy } from '../fleet'
import type { StateMilitary } from '../military'
import type { WorldState } from '../types'

/** силуэт корабля: корпус, вёсла, мачты и парус цвета страны */
export function ShipIcon({ shape, c1, c2, size = 64 }: { shape: ShipType['shape']; c1: string; c2: string; size?: number }) {
  const hull = '#5a3a1e', dark = '#2e1d0e'
  return (
    <svg viewBox="0 0 64 44" width={size} height={(size * 44) / 64} className="nv-ship">
      <path d="M2 40 Q32 46 62 40" stroke="#3a6a8a" strokeWidth="2" fill="none" opacity=".6" />
      {shape === 'boat' && (<>
        <path d="M14 34 L50 34 L46 40 L18 40 Z" fill={hull} />
        <line x1="32" y1="34" x2="32" y2="18" stroke={dark} strokeWidth="1.5" />
        <path d="M33 19 L44 31 L33 31 Z" fill={c1} stroke={c2} strokeWidth=".8" />
      </>)}
      {shape === 'longship' && (<>
        <path d="M6 30 Q8 38 16 39 L48 39 Q56 38 58 30 L54 33 L10 33 Z" fill={hull} />
        <path d="M6 30 Q4 24 8 21" stroke={hull} strokeWidth="2.5" fill="none" /><path d="M58 30 Q60 24 56 21" stroke={hull} strokeWidth="2.5" fill="none" />
        {[14, 20, 26, 32, 38, 44, 50].map((x) => <circle key={x} cx={x} cy="33" r="2" fill={x % 12 ? c1 : c2} stroke={dark} strokeWidth=".5" />)}
        <line x1="32" y1="33" x2="32" y2="8" stroke={dark} strokeWidth="1.5" />
        <rect x="21" y="9" width="22" height="17" fill={c1} stroke={c2} strokeWidth="1" />
        <path d="M21 13 H43 M21 18 H43 M21 23 H43" stroke={c2} strokeWidth="1.5" />
      </>)}
      {shape === 'galley' && (<>
        <path d="M4 32 L60 32 L54 39 L12 39 Z" fill={hull} />
        <path d="M60 32 L64 31" stroke={dark} strokeWidth="2" />
        {[12, 18, 24, 30, 36, 42, 48].map((x) => <line key={x} x1={x} y1="36" x2={x - 4} y2="43" stroke={dark} strokeWidth="1" />)}
        <line x1="30" y1="32" x2="30" y2="10" stroke={dark} strokeWidth="1.5" />
        <path d="M30 11 L46 27 L18 27 Z" fill={c1} stroke={c2} strokeWidth="1" />
      </>)}
      {(shape === 'sail' || shape === 'line') && (<>
        <path d="M6 28 L58 28 L52 39 L12 39 Z" fill={hull} />
        <rect x="6" y="22" width="12" height="6" fill={hull} /><rect x="48" y="23" width="10" height="5" fill={hull} />
        {shape === 'line' && [14, 22, 30, 38, 46].map((x) => <rect key={x} x={x} y="31" width="3" height="3" fill="#111" />)}
        <line x1="32" y1="28" x2="32" y2="3" stroke={dark} strokeWidth="1.5" />
        <rect x="22" y="5" width="20" height="10" rx="2" fill={c1} stroke={c2} strokeWidth="1" />
        <rect x="24" y="16" width="16" height="10" rx="2" fill={c1} stroke={c2} strokeWidth="1" />
        {shape === 'line' && <><line x1="46" y1="28" x2="46" y2="8" stroke={dark} strokeWidth="1.2" /><rect x="40" y="10" width="12" height="12" rx="2" fill={c1} stroke={c2} strokeWidth=".8" /></>}
        <path d="M32 3 L38 5 L32 7" fill={c2} />
      </>)}
      {shape === 'fort' && (<>
        <path d="M4 26 L60 26 L56 39 L8 39 Z" fill={hull} />
        <rect x="10" y="12" width="44" height="14" fill="#6a5a48" stroke={dark} />
        {[10, 18, 26, 34, 42, 50].map((x) => <rect key={x} x={x} y="8" width="4" height="4" fill="#6a5a48" />)}
        {[16, 28, 40].map((x) => <rect key={x} x={x} y="17" width="4" height="5" fill="#111" />)}
        <line x1="32" y1="8" x2="32" y2="1" stroke={dark} /><path d="M32 1 L40 3 L32 5" fill={c1} />
      </>)}
      {shape === 'swan' && (<>
        <path d="M8 32 Q20 40 44 38 Q56 36 58 26 Q54 30 48 31 L12 31 Z" fill="#d8d2c0" />
        <path d="M58 26 Q62 16 56 12 Q54 16 57 20" stroke="#d8d2c0" strokeWidth="3" fill="none" />
        <line x1="30" y1="31" x2="30" y2="6" stroke="#8a7a5a" strokeWidth="1.2" />
        <path d="M30 7 Q44 16 30 28 Q18 16 30 7 Z" fill={c1} stroke={c2} strokeWidth=".8" opacity=".9" />
      </>)}
    </svg>
  )
}

function Bars({ stats }: { stats: Record<string, number> }) {
  return (
    <div className="nv-bars">
      {SHIP_STATS.map((s) => (
        <div key={s.key} className="nv-bar" title={s.about}>
          <span>{s.name}</span><div><i style={{ width: `${(100 * stats[s.key]) / 20}%` }} /></div><b>{stats[s.key]}</b>
        </div>
      ))}
    </div>
  )
}

/** Флот страны: флоты, эскадры с силуэтами кораблей, сводка, правка мастером */
export function NavyView({ st, m }: { st: WorldState; m: StateMilitary }) {
  const world = useStore((s) => s.world!)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const date = useStore((s) => s.date)
  const navy = m.navy
  const prov = useMemo(() => new Map((world.provinces ?? []).map((p) => [p.id, p])), [world.provinces])
  const sum = useMemo(() => {
    if (!navy) return null
    let ships = 0, crew = 0, troops = 0, cargo = 0, cost = 0, power = 0, merchant = 0
    for (const s of navy.squadrons) { const r = squadronStats(s); ships += s.count; crew += r.crew; troops += r.troops; cargo += r.cargo; cost += r.cost; power += squadronPower(s); if (s.merchant) merchant += s.count }
    return { ships, crew, troops, cargo, cost, power, merchant }
  }, [navy])
  if (!navy || !sum) return <p className="ew-muted">У страны нет флота: нет выхода к морю или своих кораблей.</p>
  const edit = (id: string, fn: (s: Squadron) => void): void => mutate((w) => { const n = w.states.find((x) => x.id === st.id)?.base.military?.navy as StateNavy | undefined; const s = n?.squadrons.find((x) => x.id === id); if (s) fn(s) })
  const sById = new Map(navy.squadrons.map((s) => [s.id, s]))
  const tech = (st.base.tech?.levels ?? {}) as Record<string, number>
  return (
    <div className="nv">
      <div className="ew-tiles">
        <div className="ew-tile"><span>Кораблей</span><b>{sum.ships}</b><i>{navy.squadrons.length} эскадр{sum.merchant ? ` · ${sum.merchant} торговых по найму` : ''}</i></div>
        <div className="ew-tile"><span>Моряков и гребцов</span><b>{fmtPeople(sum.crew)}</b><i>мореходство {tech.sea ?? 1}/5</i></div>
        <div className="ew-tile"><span>Перевезёт за раз</span><b>{fmtPeople(sum.troops)}</b><i>солдат и {Math.round(sum.cargo).toLocaleString('ru-RU')} т груза</i></div>
        <div className="ew-tile"><span>Содержание</span><b>{fmtMarks(sum.cost)}</b><i>за ход, без утечек</i></div>
        <div className="ew-tile"><span>Сила флота</span><b>{sum.power.toLocaleString('ru-RU')}</b><i>очков</i></div>
      </div>
      <p className="ew-muted small">Галеры, ладьи и речные суда зимой и в шторм стоят в гаванях; парусники с высокой мореходностью ходят круглый год. Ход в милях за день — при попутном ветре.</p>
      {navy.fleets.map((f) => (
        <section key={f.id} className="nv-fleet">
          <div className="nv-fleet-head">
            <h3>⚓ {f.name}</h3>
            <span className="ew-muted">{f.base != null ? `база: ${prov.get(f.base)?.name ?? '—'}` : ''}{f.cmd ? ` · командует ${f.cmd.name} (${f.cmd.trait})` : ''}</span>
          </div>
          {f.note && <p className="mil-lore">{f.note}</p>}
          <div className="nv-sqs">
            {f.squadrons.map((id) => {
              const s = sById.get(id); if (!s) return null
              const t = SHIP[s.ship] ?? SHIPS[0], r = squadronStats(s)
              return (
                <div key={id} className={`nv-sq${s.merchant ? ' merchant' : ''}`}>
                  <div className="nv-sq-pic">
                    <ShipIcon shape={t.shape} c1={s.colors[0]} c2={s.colors[1]} size={84} />
                    <b className="nv-count">×{s.count}</b>
                  </div>
                  <div className="nv-sq-body">
                    <div className="nv-sq-name">{s.name}</div>
                    <div className="ew-muted small">{t.icon} {t.name} · {ARMAMENT[s.arm]?.name ?? s.arm} · команда {CREW[s.crew]?.name ?? s.crew}{s.merchant ? ' · торговые, по найму' : ''}</div>
                    <Bars stats={r.stats} />
                    <div className="nv-sq-facts">
                      <span>⛵ {milesPerDay(r.stats.speed)} миль/день</span>
                      <span>👥 {r.crew.toLocaleString('ru-RU')} моряков</span>
                      {r.troops > 0 && <span>🪖 берёт {r.troops.toLocaleString('ru-RU')} солдат</span>}
                      <span>💰 {fmtMarks(r.cost)}/ход</span>
                      <span>📍 {prov.get(s.base ?? -1)?.name ?? '—'}</span>
                    </div>
                    <div className="ew-muted small">{t.note}. Капитан: {s.cmd.name} ({s.cmd.trait}).</div>
                    {master && (
                      <div className="mil-edit">
                        <label>Кораблей <input type="number" min={0} max={999} value={s.count} title="С этой даты (прошлое не меняется)" onChange={(e) => edit(id, (x) => { const n = Math.max(0, Number(e.target.value) || 0); const ch = (x.changes ??= []); const i = ch.findIndex((c) => c.date === date); if (i >= 0) ch[i].count = n; else ch.push({ date, count: n, note: 'мастер' }) })} /></label>
                        <select value={s.arm} onChange={(e) => edit(id, (x) => { x.arm = e.target.value })}>{Object.entries(ARMAMENT).map(([k, a]) => <option key={k} value={k}>{a.name}</option>)}</select>
                        <select value={s.crew} onChange={(e) => edit(id, (x) => { x.crew = e.target.value })}>{Object.entries(CREW).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}</select>
                        <select value={s.ship} onChange={(e) => edit(id, (x) => { x.ship = e.target.value })}>{SHIPS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
