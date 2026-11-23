import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { formatDate } from '../calendar'
import { fmtPeople } from '../economy'
import { FORT, KINDS, PLAN, PLANS, TERRAINS, WEATHER, fight, sideForce, type BattleKind, type BattleInput, type SideInput } from '../battle'
import type { StateNavy } from '../fleet'
import type { WorldState } from '../types'

const emptySide = (): SideInput => ({ stateId: '', name: '', formations: [], squadrons: [], plan: 'line', rp: [], home: false })

/** одна сторона: страна, войска или эскадры, замысел, ролевые поправки */
function SidePanel({ title, side, kind, onChange, states }: { title: string; side: SideInput; kind: BattleKind; onChange: (s: SideInput) => void; states: WorldState[] }) {
  const st = states.find((s) => s.id === side.stateId)
  const m = st?.base.military
  const navy = m?.navy as StateNavy | undefined
  const [rpText, setRpText] = useState('')
  const [rpVal, setRpVal] = useState(10)
  const plans = PLANS.filter((p) => p.kinds.includes(kind))
  const units = kind === 'naval' ? (navy?.squadrons ?? []).map((s) => ({ id: s.id, name: `${s.name} (${s.count})` })) : (m?.formations ?? []).filter((f) => f.level !== 'battalion').map((f) => ({ id: f.id, name: `${'· '.repeat(f.level === 'army' ? 0 : f.level === 'corps' ? 1 : 2)}${f.name}` }))
  const chosen = kind === 'naval' ? side.squadrons : side.formations
  const toggle = (id: string): void => { const list = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]; onChange(kind === 'naval' ? { ...side, squadrons: list } : { ...side, formations: list }) }
  const p = PLAN[side.plan]
  return (
    <div className="bt-side">
      <h3>{title}</h3>
      <select className="ed-select" value={side.stateId} onChange={(e) => { const s = states.find((x) => x.id === e.target.value); onChange({ ...emptySide(), stateId: e.target.value, name: s?.base.name ?? '', plan: side.plan, home: side.home }) }}>
        <option value="">— страна —</option>
        {states.map((s) => <option key={s.id} value={s.id}>{s.base.name}</option>)}
      </select>
      {st && (
        <div className="bt-units">
          {units.length === 0 && <span className="ew-muted small">{kind === 'naval' ? 'нет флота' : 'нет войска'}</span>}
          {units.map((u) => <label key={u.id} className={chosen.includes(u.id) ? 'on' : ''}><input type="checkbox" checked={chosen.includes(u.id)} onChange={() => toggle(u.id)} />{u.name}</label>)}
        </div>
      )}
      <label className="bt-field"><span>Замысел</span>
        <select className="ed-select" value={side.plan} onChange={(e) => onChange({ ...side, plan: e.target.value })}>{plans.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
      </label>
      {p && <p className="ew-muted small">{p.text}{p.beats?.length ? ` Бьёт: ${p.beats.map((b) => PLAN[b]?.name).join(', ')}.` : ''}{p.risk ? ` Риск: ${p.risk}.` : ''}</p>}
      <label className="bt-check"><input type="checkbox" checked={side.home} onChange={(e) => onChange({ ...side, home: e.target.checked })} /> Своя земля (проводники, знают местность)</label>
      <div className="bt-rp">
        <span className="bt-rp-title">Ролевые поправки мастера</span>
        {side.rp.map((r, i) => (
          <div key={i} className="bt-rp-item"><b className={r.value >= 0 ? 'up' : 'down'}>{r.value > 0 ? '+' : ''}{r.value} %</b><span>{r.text}</span><button className="link-btn" onClick={() => onChange({ ...side, rp: side.rp.filter((_, j) => j !== i) })}>×</button></div>
        ))}
        <div className="bt-rp-add">
          <input className="dec-text" placeholder="речь короля, знамение, предательство…" value={rpText} onChange={(e) => setRpText(e.target.value)} />
          <select className="ed-select" value={rpVal} onChange={(e) => setRpVal(Number(e.target.value))}>{[-30, -20, -10, -5, 5, 10, 20, 30].map((v) => <option key={v} value={v}>{v > 0 ? '+' : ''}{v} %</option>)}</select>
          <button className="mil-go" disabled={!rpText.trim()} onClick={() => { onChange({ ...side, rp: [...side.rp, { text: rpText.trim(), value: rpVal }] }); setRpText('') }}>Добавить</button>
        </div>
      </div>
    </div>
  )
}

/** Калькулятор сражения мастера: вид боя, стороны, замыслы, условия, удача → ход боя по фазам и исход; «Утвердить» вносит потери */
export function BattleView() {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const states = useMemo(() => world.states.filter((s) => s.base.military).sort((a, b) => a.base.name.localeCompare(b.base.name, 'ru')), [world.states])
  const [kind, setKind] = useState<BattleKind>('field')
  const [a, setA] = useState<SideInput>(emptySide())
  const [b, setB] = useState<SideInput>({ ...emptySide(), home: true })
  const [terrain, setTerrain] = useState(1)
  const [weather, setWeather] = useState('ясно')
  const [fort, setFort] = useState(0)
  const [river, setRiver] = useState(0)
  const [seed, setSeed] = useState(7)
  const [place, setPlace] = useState('')
  const [done, setDone] = useState('')
  const inp: BattleInput = { kind, terrain, weather, fort: kind === 'siege' ? Math.max(1, fort) : fort, river: kind === 'crossing' ? Math.max(1, river) : river, a, b, seed, date, place }
  const stA = world.states.find((s) => s.id === a.stateId), stB = world.states.find((s) => s.id === b.stateId)
  const ready = !!stA && !!stB && (kind === 'naval' ? a.squadrons.length && b.squadrons.length : a.formations.length && b.formations.length)
  const res = useMemo(() => {
    if (!ready) return null
    const fa = sideForce(stA!.base.military, stA!.base.military?.navy as StateNavy, a, date), fb = sideForce(stB!.base.military, stB!.base.military?.navy as StateNavy, b, date)
    return { fa, fb, r: fight(inp, fa, fb) }
  }, [ready, stA, stB, a, b, date, kind, terrain, weather, fort, river, seed]) // eslint-disable-line react-hooks/exhaustive-deps

  const prov = (q: string) => { const s = q.trim().toLowerCase(); if (!s) return undefined; return (world.provinces ?? []).find((p) => p.name.toLowerCase() === s) ?? (world.provinces ?? []).find((p) => p.name.toLowerCase().includes(s)) }
  const placeProv = prov(place)
  const confirm = (): void => {
    if (!res) return
    const { r } = res
    const desc = `**${KINDS[kind].name}, ${formatDate(world.calendar, date)}.** ${a.name} — ${b.name}.\n**Замыслы:** ${PLAN[a.plan]?.name} — ${PLAN[b.plan]?.name}. **Итог:** ${r.word}.\n**Потери:** ${a.name} — ${r.a.lost}${r.a.shipsLost ? ` и ${r.a.shipsLost} кораблей` : ''}, ${b.name} — ${r.b.lost}${r.b.shipsLost ? ` и ${r.b.shipsLost} кораблей` : ''}.\n\n${r.phases.map((p) => `*${p.name}.* ${p.text}`).join(' ')}${[...a.rp, ...b.rp].length ? `\n\nОсобые обстоятельства: ${[...a.rp, ...b.rp].map((x) => x.text).join('; ')}.` : ''}`
    mutate((w) => {
      for (const [side, sr, won] of [[a, r.a, r.winner === 'a'], [b, r.b, r.winner === 'b']] as const) {
        const s = w.states.find((x) => x.id === side.stateId)
        const mil = s?.base.military
        if (!mil) continue
        for (const c of mil.companies) { const loss = sr.byUnit.get(c.id); if (loss) { c.men = Math.max(5, c.men - loss); c.xp += won ? 3 : 1 } }
        const nv = mil.navy
        if (nv && sr.shipsLost) { let left = sr.shipsLost; for (const q of nv.squadrons) { if (!side.squadrons.includes(q.id) || left <= 0) continue; const k = Math.min(q.count, Math.ceil((sr.shipsLost * q.count) / Math.max(1, sr.ships))); q.count -= Math.min(k, left); left -= k } }
      }
      if (placeProv) (w.places ??= []).push({ id: `battle-${Date.now().toString(36)}`, mapId: w.maps.find((x) => x.kind === 'world')?.id ?? 'world', x: placeProv.x, y: placeProv.y, base: { name: `Битва — ${placeProv.name}`, type: 'battle', stateId: '', population: '', ruler: '', image: '', description: desc } as never, history: [], from: date, to: date + 1000 } as never)
      for (const side of [a, b]) (w.vpiLog ??= []).push({ id: `b${Date.now().toString(36)}${side === a ? 'a' : 'b'}`, date, at: new Date().toISOString(), state: side.name, title: `${KINDS[kind].name}: ${a.name} — ${b.name}`, order: '', verdict: desc, public: `${r.word}. Потери: ${a.name} — ${r.a.lost}, ${b.name} — ${r.b.lost}.`, changes: [] })
    })
    setDone(`Внесено: потери роты, опыт выжившим${placeProv ? `, битва на карте — ${placeProv.name}` : ''}, запись в «Приказах и вердиктах» обеих стран.`)
  }

  return (
    <div className="bt">
      <div className="bt-head">
        <h2>⚔ Сражение</h2>
        <p className="ew-muted">Калькулятор мастера: приложение предлагает ход боя по фазам, потери и исход. Замыслы сторон бьют друг друга; ролевые поправки — то, что решает рассказ (речь, знамение, предательство, подкуп).</p>
      </div>
      <div className="bt-kinds">
        {(Object.keys(KINDS) as BattleKind[]).map((k) => (
          <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setA({ ...a, plan: PLANS.find((p) => p.kinds.includes(k))!.key }); setB({ ...b, plan: k === 'siege' ? 'hold' : PLANS.find((p) => p.kinds.includes(k))!.key }) }}>
            <span>{KINDS[k].icon}</span><b>{KINDS[k].name}</b><i>{KINDS[k].text}</i>
          </button>
        ))}
      </div>
      <div className="bt-sides">
        <SidePanel title={kind === 'siege' ? 'Осаждающие' : 'Нападающие'} side={a} kind={kind} onChange={setA} states={states} />
        <div className="bt-cond">
          <h3>Поле боя</h3>
          <label className="bt-field"><span>Где</span><input className="dec-text" placeholder="область (для карты)" value={place} onChange={(e) => { setPlace(e.target.value); const p = prov(e.target.value); if (p && TERRAINS[p.terrain]) setTerrain(p.terrain) }} /></label>
          {placeProv && <span className="ew-muted small">{placeProv.name}: {TERRAINS[placeProv.terrain]?.name}</span>}
          {kind !== 'naval' && <label className="bt-field"><span>Местность</span><select className="ed-select" value={terrain} onChange={(e) => setTerrain(Number(e.target.value))}>{Object.entries(TERRAINS).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select></label>}
          <label className="bt-field"><span>Погода</span><select className="ed-select" value={weather} onChange={(e) => setWeather(e.target.value)}>{Object.keys(WEATHER).map((k) => <option key={k}>{k}</option>)}</select></label>
          {kind !== 'naval' && <label className="bt-field"><span>Укрепления защитника</span><select className="ed-select" value={inp.fort} onChange={(e) => setFort(Number(e.target.value))}>{FORT.map((f, i) => <option key={i} value={i}>{f}</option>)}</select></label>}
          {kind === 'crossing' && <label className="bt-field"><span>Река</span><select className="ed-select" value={inp.river} onChange={(e) => setRiver(Number(e.target.value))}>{['—', 'речка', 'река', 'большая река'].map((f, i) => <option key={i} value={i}>{f}</option>)}</select></label>}
          <div className="bt-dice">
            <button className="mil-go" onClick={() => setSeed(1 + Math.floor(Math.random() * 1e9))}>🎲 Бросить кости</button>
            <span className="ew-muted small">удача: каждая фаза ±15 %</span>
          </div>
          <p className="ew-muted small">Дата — по шкале: {formatDate(world.calendar, date)}.</p>
        </div>
        <SidePanel title={kind === 'siege' ? 'Защитники' : 'Обороняющиеся'} side={b} kind={kind} onChange={setB} states={states} />
      </div>

      {!ready && <p className="ew-muted">Выберите обе стороны и их войска{kind === 'naval' ? ' (эскадры)' : ''}.</p>}
      {res && (
        <section className="bt-result">
          <div className={`bt-word ${res.r.winner ?? 'none'}`}>{res.r.word}</div>
          <div className="bt-forces">
            <span>{a.name}: {fmtPeople(res.fa.men)}{res.fa.ships ? `, ${res.fa.ships} кораблей` : ''}</span>
            <span>{b.name}: {fmtPeople(res.fb.men)}{res.fb.ships ? `, ${res.fb.ships} кораблей` : ''}</span>
          </div>
          <div className="bt-phases">
            {res.r.phases.map((p) => {
              const tot = Math.max(1, p.a + p.b)
              return (
                <div key={p.key} className="bt-phase">
                  <b>{p.name}</b>
                  <div className="bt-bar"><i className="a" style={{ width: `${(100 * p.a) / tot}%` }} /><i className="b" style={{ width: `${(100 * p.b) / tot}%` }} /></div>
                  <span>{p.text}</span>
                </div>
              )
            })}
          </div>
          {res.r.notes.length > 0 && <p className="ew-muted">{res.r.notes.join(' ')}</p>}
          <div className="bt-losses">
            {([[a.name, res.r.a, res.fa.men], [b.name, res.r.b, res.fb.men]] as const).map(([n, s, men]) => (
              <div key={n}>
                <b>{n}</b>
                <span>выбыло {fmtPeople(s.lost)} ({Math.round((100 * s.lost) / Math.max(1, men))} %): убиты ≈ {s.dead}, ранены ≈ {s.wounded}, в плену ≈ {s.captured}{s.shipsLost ? `; кораблей потеряно ${s.shipsLost}` : ''}</span>
              </div>
            ))}
          </div>
          {master && !done && <button className="eco-open" onClick={confirm}>Утвердить исход и внести потери</button>}
          {done && <p className="mil-state">✔ {done}</p>}
        </section>
      )}
    </div>
  )
}
