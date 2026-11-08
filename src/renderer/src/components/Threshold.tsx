import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import { EMBLEMS } from './Heraldry'
import type { Entry } from '../types'

type ThresholdData = NonNullable<Entry['base']['threshold']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const rad = (a: number): number => (a * Math.PI) / 180
const DOOR: Record<string, [string, string]> = { open: ['открыта', '#e8c860'], likely: ['скорее откроет', '#b8a050'], doubt: ['сомневается', '#8a8a6a'], closed: ['закрыта', '#3a3a3a'] }
const KIND: Record<string, string> = { decree: 'указ', tax: 'налог', treaty: 'договор', war: 'война', extradite: 'выдача беглеца' }
const RES: Record<string, [string, string]> = { passed: ['принято', '#6aaa7a'], failed: ['отклонено', '#d0604a'], pending: ['решается', '#c9a24a'], word: ['«слово»', '#b48ad8'] }

/** точка на дуге арки: i-я из n, от левого основания к правому */
function archPt(cx: number, cy: number, r: number, i: number, n: number): [number, number] {
  const a = 180 + (i / (n - 1)) * 180
  return [cx + Math.cos(rad(a)) * r, cy + Math.sin(rad(a)) * r]
}

function KeyIcon({ x, y, color, s = 1 }: { x: number; y: number; color: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-7" r="5" fill="none" stroke={color} strokeWidth="2.2" />
      <rect x="-1.1" y="-2" width="2.2" height="14" fill={color} />
      <rect x="1" y="6" width="4.5" height="2" fill={color} />
      <rect x="1" y="10" width="3.5" height="2" fill={color} />
    </g>
  )
}

/**
 * «Порог» Королевства Темерия: арка двери с семью огнями Очагов, пять Ключей-министров на выбранный год, Мера Крова с Голодным порогом
 * и вкладки: «Двери» (решения Ключей), «Обход» (979 и прогноз для наследников), «Книга Крова» (семьи под кровом по годам и по домам).
 */
export function ThresholdView({ data, onOpen }: { data: ThresholdData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'doors' | 'walk' | 'book'>('doors')
  const [year, setYear] = useState(1010)
  const [di, setDi] = useState(data.decisions.length - 1)
  const [wi, setWi] = useState(0) // 0 — Обход 979, 1.. — прогноз кандидатов
  const Y0 = 979, Y1 = 1010
  const hearthColor = (house: string): string => data.hearths.find((h) => h.name === `Дом ${house}` || h.name === house)?.color ?? '#d8b84a'
  const holderAt = (k: ThresholdData['keys'][number]) => k.holders.find((h) => h.from <= year + 0.5 && (h.to == null || year + 0.5 < h.to)) ?? k.holders[0]
  const series = data.book.series
  const mera = (y: number): number => {
    if (y <= series[0].year) return series[0].families
    for (let i = 1; i < series.length; i++) if (y <= series[i].year) { const a = series[i - 1], b = series[i]; return Math.round(a.families + ((y - a.year) / (b.year - a.year)) * (b.families - a.families)) }
    return series[series.length - 1].families
  }
  const fam = mera(year)
  const maxFam = series[series.length - 1].families
  const dec = data.decisions[Math.min(di, data.decisions.length - 1)]
  const yes = Object.values(dec.votes).filter((v) => v === 'yes').length
  const walkDoors: Record<string, string> = wi === 0 ? data.walk.doors : data.forecast[wi - 1].doors
  const open = Object.values(walkDoors).filter((v) => v === 'open').length
  const likely = Object.values(walkDoors).filter((v) => v === 'likely' || v === 'doubt').length
  const walkTitle = wi === 0 ? `Обход 979 г.: ${data.walk.king}` : `Прогноз: ${data.forecast[wi - 1].name}`
  const walkNote = wi === 0 ? data.walk.note : data.forecast[wi - 1].note
  const status = fam < data.hungry ? 'hungry' : fam >= data.bigMeasure ? 'big' : 'ok'
  const C = 200, CY = 130
  return (
    <div className="thr">
      <div className="thr-head">
        <div>
          <small>Порог в {tab === 'walk' ? walkTitle : `${year} г.`}</small>
          <b>{tab === 'walk' ? (open >= data.needDoors ? 'Дверь открыта' : 'Дверь не открыта') : `Мера Крова: ${fam.toLocaleString('ru')} семей`}</b>
        </div>
        <div className={`thr-status ${tab === 'walk' ? (open >= data.needDoors ? 'big' : likely ? 'ok' : 'hungry') : status}`}>
          {tab === 'walk' ? <>Открыто {open} из {data.doorsTotal} · нужно {data.needDoors}</> : status === 'hungry' ? <>⚠ Голодный порог: «Слова короля» нет</> : status === 'big' ? <>🚪 Двери открыты: Слово короля в силе</> : <>🕯 Слово короля в силе</>}
        </div>
      </div>
      <div className="thr-tabs">
        {([['doors', 'Двери и Ключи'], ['walk', 'Обход Очагов'], ['book', 'Книга Крова']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab !== 'book' && (
        <div className="thr-main">
          <svg viewBox="0 0 400 280" className="thr-arch">
            <defs>
              <radialGradient id="thr-glow" cx="50%" cy="70%" r="70%"><stop offset="0" stopColor="#ffd98a" stopOpacity=".95" /><stop offset="1" stopColor="#6a3a14" stopOpacity=".9" /></radialGradient>
              <linearGradient id="thr-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a5448" /><stop offset="1" stopColor="#2a2620" /></linearGradient>
            </defs>
            {/* арка: камень, проём с тёплым светом, порог */}
            <path d={`M48 270 V${CY} A152 152 0 0 1 352 ${CY} V270 Z`} fill="url(#thr-stone)" stroke="#6a6252" strokeWidth="2" />
            <path d={`M98 270 V${CY + 6} A102 102 0 0 1 302 ${CY + 6} V270 Z`} fill="url(#thr-glow)" />
            <path d={`M98 270 V${CY + 6} A102 102 0 0 1 302 ${CY + 6} V270`} fill="none" stroke="#8a7a58" strokeWidth="3" />
            <rect x="92" y="262" width="216" height="8" rx="2" fill="#4a4234" />
            <path d="M118 262 q0 -40 14 -56 M282 262 q0 -40 -14 -56" stroke="#2a1a0c" strokeWidth="6" fill="none" opacity=".6" />
            <text x={C} y="224" textAnchor="middle" className="thr-door-word">Постучи</text>
            <text x={C} y="244" textAnchor="middle" className="thr-door-sub">{tab === 'walk' ? walkTitle : `${year} год`}</text>
            {/* семь огней Очагов по арке */}
            {data.hearths.map((h, i) => {
              const st = tab === 'walk' ? walkDoors[h.key] ?? 'closed' : h.key === 'brenna' ? 'closed' : 'open'
              const [lx, ly] = archPt(C, CY, 124, i, data.hearths.length)
              const col = DOOR[st][1]
              return (
                <g key={h.key} className={`thr-hearth ${st}`} onClick={() => onOpen(h.houseId)}>
                  <circle cx={lx} cy={ly} r="17" fill="#14100a" stroke={col} strokeWidth={st === 'closed' ? 1 : 2.4} strokeDasharray={st === 'doubt' ? '3 3' : undefined} />
                  {st !== 'closed' && <circle cx={lx} cy={ly} r="24" fill={col} opacity={st === 'open' ? 0.18 : 0.08} className="thr-flame-glow" />}
                  <g transform={`translate(${lx - 10} ${ly - 10}) scale(.2)`} opacity={st === 'closed' ? 0.35 : 1}>{EMBLEMS[h.emblem]?.draw(col, '#14100a')}</g>
                  <text x={lx} y={ly + (ly > CY - 40 ? 32 : -24)} textAnchor="middle" className="thr-seat">{h.name.replace('Дом ', '')}</text>
                </g>
              )
            })}
          </svg>
          <div className="thr-side">
            {tab === 'doors' ? (
              <div className="thr-keys">
                {data.keys.map((k) => {
                  const h = holderAt(k)
                  const src = h.id ? img.get(h.id) : ''
                  const col = hearthColor(h.house)
                  return (
                    <button key={k.key} className="thr-key" style={{ ['--kc' as string]: col }} disabled={!h.id} onClick={() => h.id && onOpen(h.id)}>
                      <svg viewBox="-10 -16 20 32" width="18" height="28"><KeyIcon x={0} y={0} color={col} /></svg>
                      <span className="thr-face">{src ? <img src={assetUrl(src)} alt="" /> : h.name[0]}</span>
                      <span className="thr-key-text"><small>{k.name} · {k.role}</small><b>{h.name}</b><i>Дом {h.house}{h.from > Y0 ? ` · с ${Math.floor(h.from)}` : ''}</i></span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="thr-walk">
                <div className="thr-walk-tabs">
                  <button className={wi === 0 ? 'on' : ''} onClick={() => setWi(0)}>Обход 979</button>
                  {data.forecast.map((f, i) => <button key={f.key} className={wi === i + 1 ? 'on' : ''} onClick={() => setWi(i + 1)}>{f.name.split(' ')[0]}</button>)}
                </div>
                <p className="thr-note">{walkNote}</p>
                <div className="thr-doorlist">
                  {data.hearths.map((h) => {
                    const st = walkDoors[h.key] ?? 'closed'
                    return <button key={h.key} className="thr-door-row" onClick={() => onOpen(h.houseId)}><i style={{ background: DOOR[st][1], boxShadow: st === 'open' ? `0 0 8px ${DOOR[st][1]}` : 'none' }} /><span>{h.name}</span><small>{DOOR[st][0]}</small></button>
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'doors' && (
        <>
          <div className="thr-slider">
            <span>{Y0}</span>
            <input type="range" min={Y0} max={Y1} value={year} onChange={(e) => { const y = +e.target.value; setYear(y); let best = 0; data.decisions.forEach((d, i) => { if (d.year <= y + 0.99) best = i }); setDi(best) }} />
            <span>{Y1}</span>
          </div>
          <div className="thr-jar">
            <span className="thr-jar-bar" title={`${fam} семей`}>
              <i style={{ width: `${(fam / maxFam) * 100}%` }} />
              <em style={{ left: `${(data.hungry / maxFam) * 100}%` }} title="Голодный порог" />
              <em style={{ left: `${(data.bigMeasure / maxFam) * 100}%` }} title="Двери открыты" />
            </span>
            <small>Мера Крова: {fam.toLocaleString('ru')} · метки: {data.hungry.toLocaleString('ru')} и {data.bigMeasure.toLocaleString('ru')}</small>
          </div>
          <h4 className="thr-h">Решения Ключей</h4>
          <div className="thr-decs">
            {data.decisions.map((d, i) => {
              const [lab, col] = RES[d.result] ?? [d.result, '#888']
              return <button key={i} className={i === di ? 'on' : ''} onClick={() => { setDi(i); setYear(Math.min(Y1, Math.max(Y0, Math.floor(d.year)))) }}><small>{Math.floor(d.year)}</small> {d.title} <span style={{ color: col }}>· {lab}</span></button>
            })}
          </div>
          <div className="thr-vote">
            <b>{dec.title}</b>
            <span>{KIND[dec.kind] ?? dec.kind} · нужно ключей: {dec.need} из 5 · за: {yes}</span>
            <div className="thr-vote-keys">
              {data.keys.map((k) => {
                const v = dec.votes[k.key] ?? 'abstain'
                const h = k.holders.find((x) => x.from <= dec.year && (x.to == null || dec.year < x.to)) ?? k.holders[0]
                const col = v === 'yes' ? '#6aaa7a' : v === 'no' ? '#d0604a' : '#8a8a8a'
                return (
                  <div key={k.key} className={`thr-v ${v}`}>
                    <svg viewBox="-10 -16 20 32" width="20" height="32" style={{ transform: v === 'no' ? 'rotate(180deg)' : undefined }}><KeyIcon x={0} y={0} color={col} /></svg>
                    <small>{k.name.replace('Ключ ', '')}</small>
                    <span>{h.name.split(' ')[0]}</span>
                    <i style={{ color: col }}>{v === 'yes' ? 'за' : v === 'no' ? 'против' : 'воздержался'}</i>
                  </div>
                )
              })}
            </div>
            <p className="thr-note">{dec.note}</p>
          </div>
        </>
      )}

      {tab === 'book' && (
        <div className="thr-book">
          <svg viewBox="0 0 420 200" className="thr-chart">
            {(() => {
              const X = (y: number): number => 30 + ((y - Y0) / (Y1 - Y0)) * 370, Yp = (f: number): number => 170 - (f / maxFam) * 150
              return (
                <>
                  {[data.hungry, data.bigMeasure].map((v) => <g key={v}><line x1="30" x2="400" y1={Yp(v)} y2={Yp(v)} className="thr-line-th" /><text x="402" y={Yp(v) + 3} className="thr-axis">{v / 1000}k</text></g>)}
                  <polyline points={series.map((s) => `${X(s.year)},${Yp(s.families)}`).join(' ')} className="thr-line" />
                  {series.map((s) => <g key={s.year}><circle cx={X(s.year)} cy={Yp(s.families)} r="3.5" fill="#e8c860" /><text x={X(s.year)} y="188" textAnchor="middle" className="thr-axis">{s.year}</text></g>)}
                  <circle cx={X(year)} cy={Yp(fam)} r="6" fill="none" stroke="#fff" strokeWidth="1.5" />
                </>
              )
            })()}
          </svg>
          <div className="thr-slider"><span>{Y0}</span><input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{Y1}</span></div>
          <h4 className="thr-h">Кто даёт кров</h4>
          {data.book.shares.map((sh) => {
            const total = Object.values(sh.by).reduce((a, b) => a + b, 0)
            return (
              <div key={sh.year} className="thr-share">
                <span className="thr-share-y">{sh.year}</span>
                <span className="thr-share-bar">
                  {[{ key: 'crown', name: 'Корона', color: '#d8b84a' }, ...data.hearths].map((h) => <i key={h.key} style={{ width: `${((sh.by[h.key] ?? 0) / total) * 100}%`, background: h.color }} title={`${h.name}: ${sh.by[h.key] ?? 0}`} />)}
                </span>
                <small>{total.toLocaleString('ru')}</small>
              </div>
            )
          })}
          <div className="thr-legend">{[{ key: 'crown', name: 'Корона', color: '#d8b84a' }, ...data.hearths].map((h) => <span key={h.key}><i style={{ background: h.color }} />{h.name}</span>)}</div>
        </div>
      )}
      <ul className="thr-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
