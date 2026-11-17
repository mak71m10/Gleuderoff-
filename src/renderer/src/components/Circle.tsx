import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type CircleData = NonNullable<Entry['base']['circle']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const FRUIT: [string, string][] = [['пусто', '#6b5a4a'], ['скудно', '#d2a446'], ['полно', '#7fc47a']]
const MODE: Record<string, [string, string]> = { full: ['Полный Круг: Печать Листа у Хранителя', 'calm'], lean: ['Скудный Круг: Печать спит', 'edge'], fall: ['Падалица: правит Совет Опекунов', 'root'] }

/**
 * «Круг Плодов» Сильвленда: колесо пяти Великих Матерей-деревьев (по месяцу на каждую). Ползунок лет 981–1010:
 * сектор зеленеет (полно), желтеет (скудно) или темнеет (пусто); в центре — Мерка года и состояние Печати Листа.
 * Вкладки: «Круг», «Матери и Дома», «Падалицы и Хранители».
 */
export function CircleView({ data, onOpen }: { data: CircleData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'wheel' | 'mothers' | 'levy' | 'nights'>('wheel')
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const cur = data.years.find((y) => y.y === year) ?? data.years[data.years.length - 1]
  const house = sel ? data.houses.find((h) => h.key === sel) : null
  const n = data.houses.length
  const W = 420, H = 330, cx = 210, cy = 165, R1 = 62, R2 = 138
  const pt = (a: number, r: number) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r] as const
  const wedge = (i: number) => {
    const a0 = (i / n) * Math.PI * 2 + 0.03, a1 = ((i + 1) / n) * Math.PI * 2 - 0.03
    const [x0, y0] = pt(a0, R2), [x1, y1] = pt(a1, R2), [x2, y2] = pt(a1, R1), [x3, y3] = pt(a0, R1)
    return `M${x0} ${y0} A${R2} ${R2} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R1} ${R1} 0 0 0 ${x3} ${y3}z`
  }
  const sx = (y: number) => 30 + ((y - data.yearFrom) / (data.yearTo - data.yearFrom)) * 340
  const sy = (v: number) => 118 - v * 9.4
  const guardian = data.guardians.find((g) => year >= g.from && (g.to === null || year < g.to))
  const [modeText, modeCls] = MODE[cur.mode]
  const silentNames = cur.silent.map((k) => data.houses.find((h) => h.key === k)?.month).filter(Boolean)
  return (
    <div className="wil crc">
      <div className="wil-head">
        <div>
          <small>Круг Плодов в {year} г.</small>
          <b>Мерка года {cur.score} из {n * 2}{cur.ruler ? ` · ${cur.ruler}` : ''}</b>
        </div>
        <div className={`wil-status ${modeCls}`}>{modeText}</div>
      </div>
      <div className="wil-tabs">
        {([['wheel', 'Круг'], ['mothers', 'Матери и Дома'], ['levy', 'Повинность'], ['nights', 'Падалицы и Хранители']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'wheel' && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="wil-svg">
            <rect x="0" y="0" width={W} height={H} rx="8" className="wil-bg" />
            {data.houses.map((h, i) => {
              const f = cur.fruit[h.key] ?? 0
              const am = ((i + 0.5) / n) * Math.PI * 2
              const [tx, ty] = pt(am, (R1 + R2) / 2 + 4)
              const [lx, ly] = pt(am, R2 + 16)
              const on = sel === h.key
              return (
                <g key={h.key} className="wil-branch" onClick={() => setSel(on ? null : h.key)}>
                  <path d={wedge(i)} fill={FRUIT[f][1]} fillOpacity={f === 0 ? 0.45 : 0.85} stroke={on ? '#fff' : h.color} strokeWidth={on ? 3 : 1.6} />
                  {Array.from({ length: 2 }, (_, k) => (
                    <circle key={k} cx={tx + (k - 0.5) * 16} cy={ty + 14} r="5" fill={k < f ? '#f4d06a' : 'none'} stroke="#0c1210" strokeWidth="1.4" opacity={k < f ? 1 : 0.5} />
                  ))}
                  <text x={tx} y={ty - 4} textAnchor="middle" className="wil-name" fill="#0c1210" style={{ fontSize: 11 }}>{h.tree}</text>
                  <text x={lx} y={ly + 3} textAnchor="middle" className="wil-axis">{h.month}</text>
                </g>
              )
            })}
            <circle cx={cx} cy={cy} r={R1 - 6} className="wil-bg" />
            <text x={cx} y={cy - 4} textAnchor="middle" className="wil-ruler" style={{ fontSize: 30 }}>{cur.score}</text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="wil-axis">{cur.mode === 'full' ? 'Печать у Хранителя' : cur.mode === 'lean' ? 'Печать спит' : 'Печать сложена'}</text>
            <text x={cx} y={H - 8} textAnchor="middle" className="wil-axis">{guardian ? `Хранитель: ${guardian.name}` : ''}</text>
          </svg>
          <svg viewBox="0 0 400 140" className="wil-chart">
            <rect x="0" y="0" width="400" height="140" rx="6" className="wil-bg" />
            <line x1="30" x2="370" y1={sy(data.fullScore)} y2={sy(data.fullScore)} className="wil-thr" />
            <text x="372" y={sy(data.fullScore) + 3} className="wil-axis">{data.fullScore}</text>
            <line x1="30" x2="370" y1={sy(data.leanScore)} y2={sy(data.leanScore)} className="wil-thr root" />
            <text x="372" y={sy(data.leanScore) + 3} className="wil-axis">{data.leanScore}</text>
            <polyline points={data.years.map((p) => `${sx(p.y)},${sy(p.score)}`).join(' ')} className="wil-line" />
            {data.years.map((p) => <circle key={p.y} cx={sx(p.y)} cy={sy(p.score)} r="2.6" fill={p.mode === 'fall' ? '#d0604a' : p.mode === 'lean' ? '#d2a446' : '#7fc47a'} />)}
            <line x1={sx(year)} x2={sx(year)} y1="8" y2="122" className="wil-cur" />
            <text x="30" y="134" className="wil-axis">Мерка года (сумма плодов пяти Матерей)</text>
          </svg>
          <div className="wil-slider"><span>{data.yearFrom}</span><input type="range" min={data.yearFrom} max={data.yearTo} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{data.yearTo}</span></div>
          {silentNames.length > 0 && (
            <ul className="wil-signs"><li><b>Молчащая Мать</b> в месяц: {silentNames.join(', ')} — по ст. 5 решения Хранителя в этот месяц ничтожны, спросить Корень вправе Корневой Ряд сильвы, но голос держит Опекун.</li></ul>
          )}
          {house && (
            <div className="wil-card" style={{ ['--bc' as string]: house.color }}>
              <b>Мать {house.tree}</b> <small>· {house.place} · месяц {house.month}</small>
              <p>{house.name}. Урожай {year} г.: <b style={{ color: FRUIT[cur.fruit[house.key] ?? 0][1] }}>{FRUIT[cur.fruit[house.key] ?? 0][0]}</b>.</p>
              <div className="wil-card-btns">
                <button onClick={() => onOpen(house.houseId)}>Открыть Дом</button>
                {house.head && <button onClick={() => onOpen(house.head!.id)}>{house.head.name}</button>}
              </div>
            </div>
          )}
          <div className="wil-legend">{FRUIT.map(([l, c]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>
        </>
      )}

      {tab === 'mothers' && (
        <div className="wil-cards">
          {data.houses.map((h) => {
            const f = cur.fruit[h.key] ?? 0
            const src = h.head ? img.get(h.head.id) : undefined
            return (
              <button key={h.key} className={`wil-hcard ${f === 2 ? 'g' : f === 1 ? 'd' : 'b'}`} style={{ ['--bc' as string]: h.color, ['--bg' as string]: h.bg }} onClick={() => onOpen(h.houseId)}>
                <span className="wil-face">{src ? <img src={assetUrl(src)} alt="" /> : h.tree[0]}</span>
                <b>{h.name}</b>
                <small>Мать {h.tree} · {h.place}</small>
                <small style={{ color: FRUIT[f][1] }}>{h.month}: {FRUIT[f][0]} ({year})</small>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'levy' && (
        <div className="wil-nights">
          <div className="wil-night"><b>{year} · Повинность Урожая</b><small>Мерка: {cur.score}</small><p>Родилось сильва: {cur.born ?? 0}. Плоды сдают в Чертог Урожаев: {cur.levyDays ?? 0} дн. в неделю на корнях Опекуна, остаток — на выкуп метки корня. Корневой Ряд сильвы совещается, но голос держит эльф-Опекун.</p></div>
          {data.years.filter((p) => p.y >= year - 4 && p.y <= year).map((p) => <div key={p.y} className="wil-night"><b>{p.y}</b><small>рождено {p.born ?? 0} · повинность {p.levyDays ?? 0} дн.</small></div>)}
        </div>
      )}

      {tab === 'nights' && (
        <>
          <div className="wil-nights">
            {data.nights.map((nt) => <div key={nt.y} className="wil-night"><b>{nt.y} · {nt.title}</b><small>Мерка: {nt.score}</small><p>{nt.note}</p></div>)}
          </div>
          <div className="wil-guards">
            {data.guardians.map((g) => {
              const src = img.get(g.id)
              return (
                <button key={g.id} className="wil-guard" onClick={() => onOpen(g.id)}>
                  <span className="wil-face">{src ? <img src={assetUrl(src)} alt="" /> : g.name[0]}</span>
                  <span><b>{g.name}</b><small>{g.from}–{g.to ?? 'ныне'}{g.house ? ` · ${data.houses.find((h) => h.key === g.house)?.name}` : ''}</small><small>{g.note}</small></span>
                </button>
              )
            })}
          </div>
        </>
      )}
      <ul className="wil-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
