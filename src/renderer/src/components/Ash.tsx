import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type AshData = NonNullable<Entry['base']['ash']>
type King = AshData['kings'][number]

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const VOTE: Record<string, [string, string]> = { yes: ['за', '#e0a040'], no: ['против', '#6a7a90'], silent: ['молчит', '#8a7a6a'] }
const RESULT: Record<string, [string, string]> = { condemned: ['осуждён: статьи сожжены', '#d0503a'], fire: ['оправдан огнём: статьи Огненные', '#e8c050'], pending: ['ждёт Дня Пепла', '#c8a0d0'] }
const fy = (y: number) => Math.floor(y)

/**
 * «Галерея Предков» Болетарии: тридцать один король в нишах собора, высота статуи — число живых статей; осуждённые Пепельным судом
 * стоят лицом к стене с погасшей жаровней, оправданные огнём — в золотой кайме. Ползунок 118–1010. Вкладки: «Галерея», «Суды», «День Пепла 1010».
 */
export function AshView({ data, onOpen }: { data: AshData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'hall' | 'trials' | 'court'>('hall')
  const [year, setYear] = useState(1010)
  const [sel, setSel] = useState<string | null>('irmelinda')
  const [votes, setVotes] = useState<Record<string, string>>(() => Object.fromEntries(data.judges.map((j) => [j.id, j.vote])))
  const [blood, setBlood] = useState(false)

  const fate = (k: King): 'none' | 'alive' | 'reigning' | 'lit' | 'condemned' | 'fire' | 'root' => {
    if (k.from > year + 0.999) return 'none'
    if (k.to === null || k.to > year) return 'reigning'
    if (k.fate === 'root') return 'root'
    const tr = data.trials.find((t) => t.target === k.key && t.result !== 'pending' && fy(t.year) <= year)
    if (tr) return tr.result === 'condemned' ? 'condemned' : 'fire'
    return 'lit'
  }
  const alive = data.kings.reduce((s, k) => { const f = fate(k); return s + (f === 'lit' || f === 'fire' || f === 'root' ? k.statutes : 0) }, 0)
  const ruler = data.kings.find((k) => k.from <= year && (k.to === null || k.to > year))
  const nit = year === 894
  const king = sel ? data.kings.find((k) => k.key === sel) : null
  const kTrial = king ? data.trials.find((t) => t.target === king.key) : null
  const yearTrials = data.trials.filter((t) => fy(t.year) === year)

  // ---- зал ----
  const W = 720, H = 330
  const rows = [data.kings.slice(0, 16), data.kings.slice(16)]
  const maxS = Math.max(...data.kings.map((k) => k.statutes))
  const statue = (k: King, x: number, base: number) => {
    const f = fate(k)
    const h = 16 + (Math.sqrt(k.statutes) / Math.sqrt(maxS)) * 50
    const on = sel === k.key
    const dark = f === 'condemned'
    const body = f === 'none' ? '#1a1612' : dark ? '#2a2420' : f === 'reigning' ? '#5a4a3a' : '#9a8f84'
    const lit = f === 'lit' || f === 'fire' || f === 'root'
    return (
      <g key={k.key} className="ash-k" onClick={() => setSel(on ? null : k.key)}>
        <path d={`M${x - 19} ${base} V${base - 90} Q${x} ${base - 112} ${x + 19} ${base - 90} V${base}z`} className={`ash-niche ${on ? 'on' : ''} ${f === 'fire' ? 'fire' : ''} ${f === 'root' ? 'root' : ''}`} />
        {f !== 'none' && f !== 'reigning' && (
          <>
            <path d={`M${x - 8} ${base} L${x - 6} ${base - h + 10} Q${x} ${base - h + 6} ${x + 6} ${base - h + 10} L${x + 8} ${base}z`} fill={body} />
            <circle cx={x} cy={base - h + 3} r="5" fill={body} />
            {!dark && <path d={`M${x - 5} ${base - h - 1} l2 -4 2 3 1 -4 1 4 2 -3 2 4z`} fill={k.female ? '#d8c8a0' : '#e0b860'} />}
            {dark && <line x1={x - 4} x2={x + 4} y1={base - h + 3} y2={base - h + 3} stroke="#120e0c" strokeWidth="2" />}
          </>
        )}
        {f === 'reigning' && <text x={x} y={base - 30} textAnchor="middle" className="ash-live">жив</text>}
        <path d={`M${x - 7} ${base - 96} h14 l-3 5 h-8z`} fill="#3a2e24" />
        {lit && <path d={`M${x} ${base - 110} q-6 8 -3 14 q3 2 6 0 q3 -6 -3 -14z`} className="ash-flame" />}
        {f === 'reigning' && <path d={`M${x} ${base - 106} q-4 5 -2 10 q2 1 4 0 q2 -4 -2 -10z`} className="ash-flame small" />}
        <text x={x} y={base + 11} textAnchor="middle" className={`ash-kn ${f}`}>{k.name.split(' ')[0].slice(0, 7)}</text>
        <text x={x} y={base + 21} textAnchor="middle" className="ash-ks">{f === 'none' ? '' : f === 'reigning' ? '—' : f === 'condemned' ? '✕' : k.statutes}</text>
      </g>
    )
  }

  // ---- суд 1010 ----
  const tally = { yes: 0, no: 0, silent: 0 } as Record<string, number>
  for (const j of data.judges) tally[votes[j.id]] = (tally[votes[j.id]] ?? 0) + 1
  const irm = data.kings.find((k) => k.key === 'irmelinda')
  const verdict = blood ? 'blood' : tally.yes >= data.need ? 'condemned' : tally.yes + tally.silent < data.need ? 'fire' : 'open'
  const cycle = (id: string) => setVotes((v) => ({ ...v, [id]: v[id] === 'yes' ? 'no' : v[id] === 'no' ? 'silent' : 'yes' }))
  const sx = (y: number) => 30 + ((y - 118) / (1010 - 118)) * 340
  const sy = (v: number) => 118 - (v / 1400) * 104

  return (
    <div className="ash">
      <div className="ash-head">
        <div>
          <small>Галерея Предков в {year} г.</small>
          <b>Живых статей {alive.toLocaleString('ru')}{ruler ? ` · ${ruler.name}` : ''}</b>
        </div>
        <div className={`ash-status ${nit ? 'hot' : year === 1010 ? 'edge' : 'calm'}`}>
          {nit ? <>⚠ Оборванная нить: указы скрепляет Инквизиция</> : year === 1010 ? <>❗ День Пепла: суд над Ирмелиндой, нужно {data.need} из {data.judgesTotal}</> : <>🔥 Свод держит страну</>}
        </div>
      </div>
      <div className="ash-tabs">
        {([['hall', 'Галерея'], ['trials', 'Пепельные суды'], ['court', 'День Пепла 1010']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'hall' && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="ash-svg">
            <rect x="0" y="0" width={W} height={H} rx="8" className="ash-bg" />
            {rows.map((r, ri) => r.map((k, i) => statue(k, 30 + i * 44 + (ri ? 22 : 0), ri ? 300 : 140)))}
          </svg>
          <div className="ash-slider"><span>118</span><input type="range" min={118} max={1010} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1010</span></div>
          <div className="ash-jumps">{data.trials.map((t) => <button key={t.year} className={fy(t.year) === year ? 'on' : ''} onClick={() => { setYear(fy(t.year)); setSel(t.target) }}>{fy(t.year)}</button>)}<button onClick={() => setYear(977)}>977</button></div>
          <svg viewBox="0 0 400 140" className="ash-chart">
            <rect x="0" y="0" width="400" height="140" rx="6" className="ash-bg" />
            <polyline points={data.book.map((p) => `${sx(p.year)},${sy(p.alive)}`).join(' ')} className="ash-line" />
            {data.trials.filter((t) => t.result !== 'pending').map((t) => <circle key={t.year} cx={sx(t.year)} cy="14" r="4" fill={RESULT[t.result][1]} />)}
            <line x1={sx(year)} x2={sx(year)} y1="8" y2="122" className="ash-cur" />
            <text x="30" y="134" className="ash-axis">живые статьи Свода · точки — Пепельные суды</text>
          </svg>
          {yearTrials.length > 0 && <ul className="ash-notes">{yearTrials.map((t) => <li key={t.year}>{bold(t.note)}</li>)}</ul>}
          {king && (
            <div className="ash-card">
              <span className="ash-face">{img.get(king.id) ? <img src={assetUrl(img.get(king.id)!)} alt="" /> : '🔥'}</span>
              <div>
                <b>{king.name}</b> <small>· {fy(king.from)}–{king.to ? fy(king.to) : 'ныне'} · {king.line === 'side' ? 'боковая ветвь' : 'прямая линия'}</small>
                <p>{king.note}</p>
                <p>Статей: <b>{king.statutes}</b>{kTrial ? <> · суд {fy(kTrial.year)}: <b style={{ color: RESULT[kTrial.result][1] }}>{RESULT[kTrial.result][0]}</b>{kTrial.yes !== null ? ` (${kTrial.yes} из 7)` : ''}</> : ''}</p>
                <button onClick={() => onOpen(king.id)}>Открыть</button>
              </div>
            </div>
          )}
          <div className="ash-legend"><span><i className="lit" />горит — статьи живы</span><span><i className="fire" />Огненные — суду не подлежат</span><span><i className="dead" />лицом к стене — осуждён</span></div>
        </>
      )}

      {tab === 'trials' && (
        <div className="ash-trials">
          {data.trials.map((t) => {
            const by = data.kings.find((k) => k.key === t.by), tg = data.kings.find((k) => k.key === t.target)
            return (
              <div key={t.year} className="ash-trial" style={{ ['--rc' as string]: RESULT[t.result][1] }}>
                <b>{fy(t.year)} · {tg?.name}</b>
                <small>созвал {by?.name} · {RESULT[t.result][0]}</small>
                <div className="ash-dots">{Array.from({ length: 7 }, (_, i) => <i key={i} className={t.yes === null ? 'q' : i < t.yes ? 'y' : 'n'} />)}<span>{t.yes === null ? '?' : t.yes} / 7, нужно 5</span></div>
                <p>{bold(t.note)}</p>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'court' && (
        <>
          <p className="ash-hint">Нажмите на судью, чтобы поменять его голос, — и посмотрите, чем кончится День Пепла.</p>
          <svg viewBox="0 0 420 236" className="ash-court">
            <rect x="0" y="0" width="420" height="236" rx="8" className="ash-bg" />
            <path d="M150 214 q60 -40 120 0z" className="ash-urn" />
            <text x="210" y="200" textAnchor="middle" className="ash-irm">{irm?.name}</text>
            <text x="210" y="226" textAnchor="middle" className="ash-axis">{irm?.statutes} статей · Затворённые ворота</text>
            {data.judges.map((j, i) => {
              const a = Math.PI * (0.04 + (0.92 * i) / (data.judges.length - 1))
              const x = 210 - Math.cos(a) * 178, y = 168 - Math.sin(a) * 128
              const v = votes[j.id]
              return (
                <g key={j.id} className="ash-judge" onClick={() => cycle(j.id)}>
                  <ellipse cx={x} cy={y} rx="17" ry="21" fill={VOTE[v][1]} stroke={i === 0 ? '#fff' : '#2a2018'} strokeWidth={i === 0 ? 2.5 : 1.5} />
                  <path d={`M${x - 10} ${y - 4} q5 -4 8 0 M${x + 2} ${y - 4} q5 -4 8 0`} stroke="#2a2018" strokeWidth="2" fill="none" />
                  <path d={`M${x - 5} ${y + 9} q5 3 10 0`} stroke="#2a2018" strokeWidth="1.6" fill="none" />
                  <text x={x} y={y + 34} textAnchor="middle" className="ash-jn">{j.name.split(' ')[0]}</text>
                  <text x={x} y={y + 44} textAnchor="middle" className="ash-axis">{VOTE[v][0]}</text>
                </g>
              )
            })}
          </svg>
          <div className="ash-tally"><span style={{ color: VOTE.yes[1] }}>за {tally.yes}</span><span style={{ color: VOTE.no[1] }}>против {tally.no}</span><span style={{ color: VOTE.silent[1] }}>молчат {tally.silent}</span><span>нужно {data.need}</span></div>
          <label className="ash-blood"><input type="checkbox" checked={blood} onChange={(e) => setBlood(e.target.checked)} /> Хальвейны требуют <b>Права крови</b>: Эгберт проходит Огненный коридор</label>
          <div className={`ash-verdict ${verdict}`}>
            {verdict === 'blood' && <>Эгберт Хальвейн прошёл восемь шагов и не обгорел. Суд распущен, Ирмелинда <b>оправдана огнём</b>: 212 статей станут Огненными навсегда, а у Лотрика III больше не будет Пепельного суда.</>}
            {verdict === 'condemned' && <>Пять голосов. Ирмелинду поворачивают лицом к стене, <b>212 статей сгорают</b> — ворота открыты, но сгорают и её статьи о хлебных амбарах и вдовьей доле. Живых статей станет {(1318 - 212).toLocaleString('ru')}.</>}
            {verdict === 'fire' && <>Даже если все молчащие скажут «за», пяти не будет. Ирмелинда <b>оправдана огнём</b>: Затворённые ворота — навсегда, а король должен Каяя 400 000 марок без торга.</>}
            {verdict === 'open' && <>Пока не решено: всё зависит от тех, кто молчит. Великий Инквизитор скажет последним.</>}
          </div>
          <div className="ash-judges">
            {data.judges.map((j) => (
              <button key={j.id} className="ash-jcard" onClick={() => onOpen(j.id)}>
                <span className="ash-face">{img.get(j.id) ? <img src={assetUrl(img.get(j.id)!)} alt="" /> : j.name[0]}</span>
                <span><b>{j.name}</b><small>{j.seat} · <i style={{ color: VOTE[j.vote][1] }}>{VOTE[j.vote][0]}</i></small><small>{j.note}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
      <ul className="ash-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
