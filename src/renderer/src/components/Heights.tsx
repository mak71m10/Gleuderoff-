import { useMemo, useState, type ReactNode } from 'react'
import type { Entry } from '../types'

type HeightsData = NonNullable<Entry['base']['heights']>

/** светлый ли цвет — тогда подпись на нём тёмная */
const light = (hex: string): boolean => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150 }

/** **жирный** → <b> */
const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))

/**
 * «Лестница Высот» Высокогорного Княжества: гора в разрезе с поясами (Венец, Карниз, Террасы, Канатный пояс, Подошва),
 * гербы великих домов на высоте их очага по годам (восхождения и спуски), подъёмники с бадьями, подгорники,
 * которых Вечерний колокол сгоняет вниз, и Совет Венца, где голос весит столько саженей, на какой высоте живёт дом.
 */
export function HeightsView({ data, onOpen }: { data: HeightsData; onOpen: (id: string) => void }) {
  // шаги по годам: всё, что случилось за год, показываем на конец года
  const years = useMemo(() => [...new Set([...data.houses.flatMap((h) => h.path.map((p) => Math.floor(p.year))), ...data.decisions.map((d) => Math.floor(d.year))])].filter((y) => y >= 500).sort((a, b) => a - b), [data])
  const [yi, setYi] = useState(years.length - 1)
  const [sel, setSel] = useState<string | null>(null)
  const [di, setDi] = useState(data.decisions.length - 1)
  const [night, setNight] = useState(false)
  const year = years[Math.min(yi, years.length - 1)]
  const hAt = (key: string, y: number): number | null => {
    const h = data.houses.find((x) => x.key === key)
    if (!h) return null
    let v: number | null = null
    for (const p of h.path) if (Math.floor(p.year) <= y) v = p.h
    return v
  }
  // гора: вершина (320, 40), подножие на y = 440
  const W = 640, TOP = 40, BASE = 440
  // верх горы растянут: на Венце и Карнизе тесно, в Подошве — просторно
  const frac = (h: number): number => Math.pow(Math.max(0, h) / data.peak, 1.6)
  const yOf = (h: number): number => BASE - frac(h) * (BASE - TOP)
  const half = (h: number): number => 26 + (1 - frac(h)) * 272
  const ridge = useMemo(() => {
    const pts: string[] = []
    const n = 22
    for (let i = 0; i <= n; i++) { const h = (i / n) * data.peak; const j = i % 2 ? 8 : -4; pts.push(`${320 - half(h) + j},${yOf(h)}`) }
    pts.push(`${320},${TOP - 6}`)
    for (let i = n; i >= 0; i--) { const h = (i / n) * data.peak; const j = i % 2 ? -6 : 5; pts.push(`${320 + half(h) + j},${yOf(h)}`) }
    return pts.join(' ')
  }, [data])
  const crownH = data.tiers.find((t) => t.key === 'crown')?.from ?? 1300
  const ropeT = data.tiers.find((t) => t.key === 'rope')
  const terrT = data.tiers.find((t) => t.key === 'terrace')
  // гербы: слева и справа от оси горы, выше — теснее
  // гербы раскладываем по сторонам горы: если рядом по высоте уже есть герб — отодвигаем дальше от оси
  const placed: { h: HeightsData['houses'][number]; v: number; x: number; y: number }[] = []
  data.houses
    .map((h) => ({ h, v: hAt(h.key, year) }))
    .filter((x): x is { h: HeightsData['houses'][number]; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v)
    .forEach(({ h, v }, k) => {
      const y = yOf(v)
      if (h.key === 'adler' && v >= data.peak - 30) { placed.push({ h, v, x: 320, y: y + 2 }); return }
      let best = { side: 1, off: 0, score: Infinity }
      for (const side of [-1, 1]) {
        let off = 20
        while (placed.some((p) => Math.sign(p.x - 320) === side && Math.abs(p.y - y) < 17 && Math.abs(p.x - (320 + side * off)) < 125)) off += 125
        const score = off + (k % 2 === (side > 0 ? 1 : 0) ? 0 : 5)
        if (score < best.score) best = { side, off, score }
      }
      placed.push({ h, v, x: 320 + best.side * best.off, y })
    })
  const changed = data.houses.flatMap((h) => h.path.filter((p) => Math.floor(p.year) === year).map((p) => ({ h, p })))
  // подгорники: днём часть гномов-подъёмщиков наверху, после колокола все в Подошве
  const folk = useMemo(() => Array.from({ length: 46 }, (_, i) => {
    const r = (Math.sin(i * 12.9898) * 43758.5453) % 1
    const u = Math.abs(r), w = Math.abs((Math.sin(i * 78.233) * 12543.1) % 1)
    const gnome = i % 4 === 0
    const lowH = 30 + w * 360
    const dayH = gnome && ropeT && terrT ? ropeT.from + u * (terrT.to - ropeT.from - 60) : lowH
    return { i, u, gnome, lowH, dayH }
  }), [data])
  const d = data.decisions[di]
  const weightOf = (key: string): number => hAt(key, Math.floor(d.year)) ?? 0
  const yes = Object.entries(d.votes).filter(([, v]) => v === 'за'), no = Object.entries(d.votes).filter(([, v]) => v === 'против'), abst = Object.entries(d.votes).filter(([, v]) => v === 'воздерж')
  const sum = (l: [string, string][]): number => l.reduce((s, [k]) => s + weightOf(k), 0)
  const yesS = sum(yes), noS = sum(no), maxS = Math.max(yesS, noS, 1)
  const house = (k: string) => data.houses.find((h) => h.key === k)
  const selH = sel ? house(sel) : null
  const lifts = [-1, 1, -0.5]
  return (
    <div className="hts">
      <div className="hts-head">
        <div>
          <small>Право Высоты</small>
          <b>Лестница Высот, {year} г.</b>
        </div>
        <button className={`hts-bell ${night ? 'on' : ''}`} onClick={() => setNight(!night)} title="Вечерний колокол: подгорники уходят ниже Канатного пояса">
          🔔 {night ? 'После колокола' : 'Вечерний колокол'}
        </button>
      </div>
      <svg viewBox={`0 0 ${W} 470`} className="hts-mount">
        <defs>
          <linearGradient id="hts-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={night ? '#0b1428' : '#3d6a96'} />
            <stop offset="1" stopColor={night ? '#1d2a44' : '#c9dbe6'} />
          </linearGradient>
          <clipPath id="hts-clip"><polygon points={ridge} /></clipPath>
        </defs>
        <rect x="0" y="0" width={W} height="470" fill="url(#hts-sky)" className="hts-sky" />
        <polygon points={ridge} fill="#4a4a48" />
        <g clipPath="url(#hts-clip)">
          {data.tiers.map((t) => (
            <rect key={t.key} x="0" y={yOf(t.to)} width={W} height={yOf(t.from) - yOf(t.to)} fill={t.color} opacity={t.key === 'foot' ? 0.55 : 0.42} />
          ))}
          {data.tiers.map((t) => <line key={t.key} x1="0" x2={W} y1={yOf(t.from)} y2={yOf(t.from)} className="hts-tierline" />)}
        </g>
        {/* снег на вершине */}
        <polygon points={`${320 - 24},${yOf(data.peak - 120)} 320,${TOP - 6} ${320 + 22},${yOf(data.peak - 110)} ${320 + 8},${yOf(data.peak - 70)} ${320 - 6},${yOf(data.peak - 95)}`} fill="#f4f6fa" opacity="0.9" />
        {/* Венец: каменная платформа вокруг вершины, дома на ней */}
        <ellipse cx="320" cy={yOf(crownH) + 2} rx={half(crownH) + 26} ry="9" className="hts-ring" />
        {Array.from({ length: 13 }, (_, i) => {
          const x = 320 - half(crownH) - 18 + i * ((half(crownH) * 2 + 36) / 12)
          if (Math.abs(x - 320) < 20) return null
          return <path key={i} d={`M${x - 5} ${yOf(crownH) - 1} v-7 l5 -5 l5 5 v7 z`} className="hts-house" />
        })}
        {/* подъёмники */}
        {lifts.map((s, i) => {
          const x1 = 320 + s * (half(crownH) + 22), y1 = yOf(crownH) + 4
          const x2 = 320 + s * (half(60) - 30), y2 = yOf(60)
          const path = `M${x1} ${y1} Q${(x1 + x2) / 2 + s * 14} ${(y1 + y2) / 2 + 22} ${x2} ${y2}`
          return (
            <g key={i} className="hts-lift">
              <path d={path} fill="none" />
              <rect x="-3" y="-2" width="6" height="5" rx="1">
                <animateMotion dur={`${9 + i * 2}s`} repeatCount="indefinite" path={path} keyPoints={i % 2 ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
              </rect>
            </g>
          )
        })}
        {/* подгорники */}
        {folk.map((f) => {
          const h = night ? f.lowH : f.dayH
          const xr = 320 + (f.u * 2 - 1) * (half(h) - 14)
          return <circle key={f.i} cx={xr} cy={yOf(h)} r={f.gnome ? 2.4 : 2.8} className={`hts-folk ${f.gnome ? 'gnome' : 'dwarf'}`} />
        })}
        {/* очаг князя */}
        <text x="320" y={TOP - 12} textAnchor="middle" className="hts-crown">♛</text>
        {/* подписи поясов */}
        {data.tiers.map((t) => (
          <g key={t.key}>
            <text x="8" y={(yOf(t.to) + yOf(t.from)) / 2 + 4} className="hts-tier">{t.name}</text>
            <text x="8" y={(yOf(t.to) + yOf(t.from)) / 2 + 17} className="hts-tier small">{t.from}–{t.to} саж.</text>
          </g>
        ))}
        {/* гербы домов на высоте очага */}
        {placed.map((p) => (
          <g key={p.h.key} className={`hts-shield ${sel === p.h.key ? 'sel' : ''} ${p.v < 450 ? 'fallen' : ''}`} style={{ transform: `translate(${p.x}px, ${p.y}px)` }} onClick={() => setSel(sel === p.h.key ? null : p.h.key)}>
            <path d="M-9 -12 h18 v9 c0 8 -9 12 -9 12 c0 0 -9 -4 -9 -12 z" fill={p.h.colors[0]} stroke={p.h.colors[1]} strokeWidth="1.6" />
            <path d="M-4 -6 h8 M0 -9 v8" stroke={p.h.colors[1]} strokeWidth="1.4" />
            <text x={p.x < 320 ? -13 : 13} y="-2" textAnchor={p.x < 320 ? 'end' : 'start'} className="hts-lbl" display={p.x === 320 ? 'none' : undefined}>{p.h.name.replace('Дом ', '')} · {p.v}</text>
          </g>
        ))}
      </svg>
      <div className="hts-years" role="tablist">
        {years.map((y, i) => (
          <button key={y} className={i === yi ? 'on' : ''} onClick={() => setYi(i)}>{y}</button>
        ))}
      </div>
      {changed.length > 0 && (
        <ul className="hts-changes">
          {changed.map(({ h, p }) => <li key={h.key}><b style={{ color: h.colors[1] }}>{h.name}</b> → {p.h} саж.: {p.note}</li>)}
        </ul>
      )}
      {selH && (
        <div className="hts-house-card">
          <div className="hts-house-head"><b>{selH.name}</b><button className="link-btn" onClick={() => onOpen(selH.id)}>Открыть карточку</button></div>
          <p>{selH.text}</p>
          <ol className="hts-path">{selH.path.map((p) => <li key={p.year}><b>{Math.floor(p.year)}</b> — {p.h} саж.: {p.note}</li>)}</ol>
        </div>
      )}
      <h4 className="hts-h">Совет Венца: голос по высоте</h4>
      <div className="hts-decs">
        {data.decisions.map((x, i) => (
          <button key={x.year} className={i === di ? 'on' : ''} onClick={() => { setDi(i); const k = years.indexOf(Math.floor(x.year)); if (k >= 0) setYi(k) }}>
            <small>{Math.floor(x.year)}</small> {x.title}
          </button>
        ))}
      </div>
      <div className="hts-vote">
        {([['за', yes, yesS], ['против', no, noS]] as [string, [string, string][], number][]).map(([lbl, list, total]) => (
          <div key={lbl} className="hts-vote-row">
            <span className="hts-vote-lbl">{lbl}</span>
            <span className="hts-vote-bar">
              {list.map(([k]) => {
                const h = house(k)
                return <i key={k} style={{ width: `${(weightOf(k) / maxS) * 100}%`, background: h?.colors[0], borderColor: h?.colors[1], color: light(h?.colors[0] ?? '#000') ? '#1a1a1a' : '#fff', textShadow: light(h?.colors[0] ?? '#000') ? 'none' : undefined }} title={`${h?.name}: ${weightOf(k)} саж.`}>{h?.name.replace('Дом ', '')}</i>
              })}
            </span>
            <b>{total}</b>
          </div>
        ))}
        {abst.length > 0 && <p className="hts-abst">Воздержались: {abst.map(([k]) => house(k)?.name.replace('Дом ', '')).join(', ')}</p>}
        <p className={`hts-result ${d.result === 'принято' ? 'yes' : d.result === 'отклонено' ? 'no' : ''}`}><b>{d.result}</b> — {d.note}</p>
      </div>
      <h4 className="hts-h">Подъёмники</h4>
      <ul className="hts-lifts">{data.lifts.map((l) => <li key={l.name}><b>{l.name}</b> ({l.holder}) — {l.note}</li>)}</ul>
      <ul className="hts-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
      <ul className="hts-tiers">{data.tiers.map((t) => <li key={t.key}><i style={{ background: t.color }} /><b>{t.name}</b> — {t.who}. <span>{t.rights}</span></li>)}</ul>
    </div>
  )
}
