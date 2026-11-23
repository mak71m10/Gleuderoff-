import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { formatDate } from '../calendar'
import { fmtPeople } from '../economy'
import { stateReport } from '../econCalc'
import { REL, REL_BASE, TREATIES, bordersOf, diploNews, relationsOf, scoreWord, type RelKind, type RelView, type Relation } from '../diplomacy'
import type { WorldState } from '../types'

const kindTag = (k: RelKind) => <span className="dp-tag" style={{ color: REL[k].color, borderColor: REL[k].color }}>{REL[k].icon} {REL[k].name}</span>

/** звезда отношений: страна в центре, вокруг — соседи и те, с кем есть отношения; свежие перемены пульсируют */
function Star({ st, list, sel, onPick }: { st: WorldState; list: RelView[]; sel: string | null; onPick: (id: string) => void }) {
  const shown = list.slice(0, 18)
  const W = 560, H = 440, cx = W / 2, cy = H / 2, R = 170
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dp-star">
      <defs><radialGradient id="dp-glow"><stop offset="0" stopColor={st.base.color} stopOpacity=".35" /><stop offset="1" stopColor={st.base.color} stopOpacity="0" /></radialGradient></defs>
      {[0.45, 0.75, 1].map((k) => <circle key={k} cx={cx} cy={cy} r={R * k + 10} fill="none" stroke="rgba(216,176,64,.07)" strokeDasharray="2 6" />)}
      <circle cx={cx} cy={cy} r={95} fill="url(#dp-glow)" />
      {shown.map((r, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / shown.length
        const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R
        const c = REL[r.rec.kind].color, w = 1.5 + Math.abs(r.score) / 22
        const on = sel === r.other.id
        return (
          <g key={r.other.id} className={`dp-node${r.recent ? ' recent' : ''}`} onClick={() => onPick(r.other.id)}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={c} strokeWidth={on ? w + 2 : w} strokeDasharray={r.rec.kind === 'war' ? '8 5' : r.rec.kind === 'tension' ? '3 4' : undefined} opacity={on || r.recent ? 1 : 0.7} className={r.recent ? 'dp-flow' : undefined} />
            {r.recent && <circle cx={x} cy={y} r={22} fill="none" stroke={c} strokeWidth="2" className="dp-pulse" />}
            <circle cx={x} cy={y} r={on ? 20 : 16} fill={r.other.base.color} stroke={on ? '#f6dc8f' : c} strokeWidth={on ? 3 : 2} />
            <text x={x} y={y + 4} textAnchor="middle" className="dp-ico">{REL[r.rec.kind].icon}</text>
            <text x={x} y={y + (y > cy ? 34 : -24)} textAnchor="middle" className={`dp-label${r.recent ? ' hot' : ''}`}>{r.other.base.name.length > 22 ? `${r.other.base.name.slice(0, 20)}…` : r.other.base.name}</text>
            <text x={x} y={y + (y > cy ? 46 : -12)} textAnchor="middle" className="dp-score" fill={c}>{r.score > 0 ? '+' : ''}{r.score}</text>
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r={34} fill={st.base.color} stroke="#f6dc8f" strokeWidth="3" />
      <text x={cx} y={cy + 56} textAnchor="middle" className="dp-center">{st.base.name}</text>
    </svg>
  )
}

/** Дипломатия страны: сводка, перемены на первом плане, звезда отношений, карточка соседа, вести мира, правила; правка мастером с даты */
export function DiplomacyView({ st }: { st: WorldState }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const rep = useMemo(() => stateReport(world, st, date), [world, st, date])
  const borders = useMemo(() => bordersOf(world, st.id, date), [world, st.id, date])
  const list = useMemo(() => relationsOf(world, st, date, rep, borders), [world, st, date, rep, borders])
  const news = useMemo(() => diploNews(world, date, undefined, 6), [world, date])
  const [sel, setSel] = useState<string | null>(null)
  const cur = list.find((r) => r.other.id === sel) ?? list[0]
  const otherRep = useMemo(() => (cur ? stateReport(world, cur.other, date) : null), [world, cur, date])
  const counts = useMemo(() => { const c: Partial<Record<RelKind, number>> = {}; for (const r of list) c[r.rec.kind] = (c[r.rec.kind] ?? 0) + 1; return c }, [list])
  const recent = list.filter((r) => r.recent)
  const [note, setNote] = useState('')

  // правка «с даты»: запись с той же датой правится, иначе старая закрывается и начинается новая
  const editRel = (fn: (r: Relation) => void): void => {
    if (!cur) return
    mutate((w) => {
      const rs = (w.relations ??= [])
      const old = rs.find((r) => r.id === cur.rec.id)
      if (old && old.from === date && old.source === 'master') { fn(old); return }
      if (old) old.to = date
      const n = { ...(old ? { ...old, treaties: [...old.treaties] } : { a: st.id, b: cur.other.id, kind: 'neutral', base: 0, treaties: [], note: '' }), id: `r${Date.now().toString(36)}`, from: date, source: 'master' } as Relation
      delete (n as Partial<Relation>).to
      fn(n); rs.push(n)
    })
  }
  if (!list.length) return <p className="ew-muted">Отношений нет — страна ни с кем не граничит и не упомянута в лоре.</p>
  const meMen = rep?.ledger?.men ?? 0, otMen = otherRep?.ledger?.men ?? 0
  return (
    <div className="dp">
      <div className="dp-summary">
        {(Object.keys(REL) as RelKind[]).filter((k) => counts[k]).map((k) => <span key={k} className="dp-sum" style={{ borderColor: REL[k].color }}><b style={{ color: REL[k].color }}>{counts[k]}</b> {REL[k].name}</span>)}
      </div>

      {recent.length > 0 && (
        <section className="dp-changes">
          <h4>⚡ Перемены последних месяцев</h4>
          <div className="dp-changes-list">
            {recent.map((r) => (
              <button key={r.other.id} className="dp-change" onClick={() => setSel(r.other.id)} style={{ borderColor: REL[r.rec.kind].color }}>
                <span className="dp-flag sm" style={{ background: r.other.base.color }} />
                <b>{r.other.base.name}</b>
                <span className="dp-arrow">{r.prev ? kindTag(r.prev.kind) : <i>—</i>} <em>⟶</em> {kindTag(r.rec.kind)}</span>
                <i>{formatDate(world.calendar, r.rec.from)}{r.rec.note ? ` · ${r.rec.note.split('\n').at(-1)}` : ''}</i>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="dp-top">
        <div className="dp-left">
          <Star st={st} list={list} sel={cur?.other.id ?? null} onPick={setSel} />
          <div className="dp-legend">{(Object.keys(REL) as RelKind[]).map((k) => <span key={k}><i style={{ background: REL[k].color }} />{REL[k].name}</span>)}</div>
        </div>
        {cur && (
          <div className={`dp-card${cur.recent ? ' hot' : ''}`}>
            <div className="dp-card-head">
              <span className="dp-flag" style={{ background: cur.other.base.color }} />
              <div><h3>{cur.other.base.name}</h3>{kindTag(cur.rec.kind)}{cur.rec.kind === 'vassal' && <i className="ew-muted small"> {cur.rec.overlord === st.id ? 'наш вассал' : 'наш сюзерен'}</i>}</div>
            </div>
            {cur.recent && cur.prev && <div className="dp-banner">Перемена {formatDate(world.calendar, cur.rec.from)}: {REL[cur.prev.kind].name} ({cur.prev.base > 0 ? '+' : ''}{cur.prev.base}) ⟶ {REL[cur.rec.kind].name} ({cur.rec.base > 0 ? '+' : ''}{cur.rec.base})</div>}
            <div className="dp-scale"><i style={{ left: `${50 + cur.score / 2}%`, background: REL[cur.rec.kind].color }} /></div>
            <div className="dp-scale-cap"><span>вражда −100</span><b>{cur.score > 0 ? '+' : ''}{cur.score} · {scoreWord(cur.score)}</b><span>+100 дружба</span></div>
            <h4 className="ed-h4">Откуда оценка</h4>
            <div className="dp-mods">
              <div><span>{cur.rec.source === 'lore' ? 'по лору' : cur.rec.source === 'master' ? 'решения и события' : 'без особых связей'}</span><b>{cur.rec.base > 0 ? '+' : ''}{cur.rec.base}</b></div>
              {cur.mods.map((m, i) => <div key={i}><span>{m.text}</span><b className={m.value >= 0 ? 'up' : 'down'}>{m.value > 0 ? '+' : ''}{m.value}</b></div>)}
            </div>
            {cur.rec.treaties.length > 0 && <div className="chip-list">{cur.rec.treaties.map((t) => <span key={t} className="chip dp-treaty">📜 {TREATIES[t] ?? t}</span>)}</div>}
            <div className="dp-facts">
              <span>🗺 {cur.border ? `граница: ${cur.border} обл.` : 'общей границы нет'}</span>
              <span>⚖ {cur.trade ? `торговля ${Math.round(cur.trade)} мар./ход` : 'торговли нет'}</span>
              <span>⚔ войска: мы {fmtPeople(meMen)} — они {fmtPeople(otMen)}{meMen && otMen ? ` (${meMen > otMen ? '×' + (meMen / otMen).toFixed(1) + ' у нас' : '×' + (otMen / Math.max(1, meMen)).toFixed(1) + ' у них'})` : ''}</span>
              <span>🏛 {cur.other.base.government}</span>
            </div>
            {cur.rec.note && <div className="dp-note">{cur.rec.note.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>}
            <p className="ew-muted small">Действует с {formatDate(world.calendar, cur.rec.from)}.</p>
            {master && (
              <div className="dp-edit">
                <select className="ed-select" value={cur.rec.kind} onChange={(e) => editRel((r) => { r.kind = e.target.value as RelKind; r.base = REL_BASE[r.kind] })}>{(Object.keys(REL) as RelKind[]).map((k) => <option key={k} value={k}>{REL[k].icon} {REL[k].name}</option>)}</select>
                <label className="small">Оценка <input type="range" min={-100} max={100} step={5} value={cur.rec.base} onChange={(e) => editRel((r) => { r.base = Number(e.target.value) })} /> {cur.rec.base}</label>
                <div className="dp-treaties">{Object.entries(TREATIES).map(([k, n]) => <label key={k} className={cur.rec.treaties.includes(k) ? 'on' : ''}><input type="checkbox" checked={cur.rec.treaties.includes(k)} onChange={() => editRel((r) => { r.treaties = r.treaties.includes(k) ? r.treaties.filter((x) => x !== k) : [...r.treaties, k] })} />{n}</label>)}</div>
                <div className="dec-form"><input className="dec-text" placeholder="что случилось: посольство, оскорбление, брак…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="mil-go" disabled={!note.trim()} onClick={() => { editRel((r) => { r.note = `${r.note ? r.note + '\n' : ''}${formatDate(world.calendar, date)}: ${note.trim()}` }); setNote('') }}>Записать событие</button></div>
                <p className="ew-muted small">Правка действует с даты шкалы ({formatDate(world.calendar, date)}) и выходит на первый план на три месяца; прежнее отношение остаётся в истории.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dp-bottom">
        <div className="dp-list">
          {list.map((r) => (
            <button key={r.other.id} className={`dp-row${cur?.other.id === r.other.id ? ' sel' : ''}${r.recent ? ' hot' : ''}`} onClick={() => setSel(r.other.id)}>
              <span className="dp-flag sm" style={{ background: r.other.base.color }} />
              <b>{r.recent ? '⚡ ' : ''}{r.other.base.name}</b>
              <i style={{ color: REL[r.rec.kind].color }}>{REL[r.rec.kind].icon} {REL[r.rec.kind].name}</i>
              <em>{r.score > 0 ? '+' : ''}{r.score}</em>
              <span className="ew-muted small">{r.border ? `граница ${r.border}` : ''}{r.trade ? ` · торговля ${Math.round(r.trade)}` : ''}</span>
            </button>
          ))}
        </div>
        <div className="dp-news">
          <h4>📯 Вести мира</h4>
          {news.length === 0 && <i className="ew-muted small">Пока тихо: перемен в отношениях не было.</i>}
          {news.map((n) => (
            <div key={n.rec.id} className="dp-news-item" style={{ borderColor: REL[n.rec.kind].color }}>
              <b>{n.a} — {n.b}</b>
              <span>{n.prev ? `${REL[n.prev.kind].name} ⟶ ` : ''}<span style={{ color: REL[n.rec.kind].color }}>{REL[n.rec.kind].name}</span></span>
              <i>{formatDate(world.calendar, n.rec.from)}{n.rec.note ? ` · ${n.rec.note.split('\n').at(-1)}` : ''}</i>
            </div>
          ))}
        </div>
      </div>

      <details className="sc-decide">
        <summary>📖 Как устроена дипломатия</summary>
        <div className="dp-rules">
          <p><b>Отношения</b> — у каждой пары стран: вид (война, вражда, напряжённость, перемирие, нейтралитет, торговля, союз, вассалитет) и оценка от −100 до +100.
            Оценка складывается из лора (что написано о соседях) и того, что видно в мире: общая граница (−5: споры о межах), одна вера (+15) или разная (−5), один народ (+10), торговля (до +15), долги (+5), дань.</p>
          <p><b>Договоры</b> — торговый, займы, дань, брачный союз, проход войск, оборонительный союз, перемирие, договор о границе. Они видны на карточке и в досье стран.</p>
          <p><b>Как меняются:</b> игрок пишет приказ (посольство, союз, объявление войны, разрыв), агент страны выносит вердикт — объявление войны и союз проходят через систему власти страны; принятое мастер вносит, и отношение меняется <b>с даты</b>.
            Свежие перемены три месяца стоят на первом плане: пульсируют в звезде, первыми в списке, в «Переменах» и в «Вестях мира». Прежнее отношение остаётся в истории — шкала времени покажет, как было.</p>
          <p><b>Что влияет на игру:</b> война поднимает цены на оружие и коней на бирже, союз и проход войск учитываются в походе и бою по решению мастера, торговля даёт доход в экономике.</p>
        </div>
      </details>
    </div>
  )
}
