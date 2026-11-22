import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type ChaliceData = NonNullable<Entry['base']['chalice']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const fmt = (n: number) => n.toLocaleString('ru')

/**
 * «Чаша Наллы» Магнолии: обсидиановая чаша, налитая слоями пяти каст (толщина слоя — по числу людей, в логарифме),
 * справа — шестьдесят мест «Чистых мечей» с чертой Предела Тридцати Трёх. Ползунок по годам 712–1010.
 * Вкладки: «Чаша», «Вызовы чашей», «Наследники».
 */
export function ChaliceView({ data, onOpen }: { data: ChaliceData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'cup' | 'calls' | 'heirs'>('cup')
  const [yi, setYi] = useState(data.years.length - 1)
  const [sel, setSel] = useState<string | null>('day')
  const cur = data.years[yi]
  const total = Object.values(cur.by).reduce((s, v) => s + v, 0)
  const caste = data.castes.find((c) => c.key === sel)
  const danger = cur.pureAdults - data.limit

  // чаша: слои снизу вверх — дневные … чистые; толщина по log10
  const order = [...data.castes].reverse()
  const th = order.map((c) => Math.log10((cur.by[c.key] ?? 0) + 1))
  const sum = th.reduce((s, v) => s + v, 0) || 1
  const top = 34, bot = 196, H = bot - top
  const half = (y: number) => 120 * (1 - Math.pow((y - top) / H, 2.2)) + 14
  let yAcc = bot
  const bands = order.map((c, i) => {
    const h = (th[i] / sum) * H
    const y1 = yAcc, y0 = yAcc - h
    yAcc = y0
    return { c, y0, y1 }
  })
  const bandPath = (y0: number, y1: number) => {
    const pts: string[] = []
    for (let k = 0; k <= 8; k++) { const y = y0 + ((y1 - y0) * k) / 8; pts.push(`${160 - half(y)},${y}`) }
    for (let k = 8; k >= 0; k--) { const y = y0 + ((y1 - y0) * k) / 8; pts.push(`${160 + half(y)},${y}`) }
    return `M${pts.join(' L')}z`
  }
  const swords = 60

  return (
    <div className="chl">
      <div className="chl-head">
        <div>
          <small>Чаша Наллы в {cur.year} г.</small>
          <b>Чистых взрослых {cur.pureAdults} · всего {fmt(total)}</b>
        </div>
        <div className={`chl-status ${danger <= 0 ? 'hot' : danger <= 10 ? 'edge' : 'calm'}`}>
          {danger <= 0 ? <>⚠ Пересчёт капель: Чистых меньше {data.limit}</> : <>до Предела Тридцати Трёх — {danger}</>}
        </div>
      </div>
      <div className="chl-tabs">
        {([['cup', 'Чаша'], ['calls', 'Вызовы чашей'], ['heirs', 'Наследники']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'cup' && (
        <>
          <div className="chl-row">
            <svg viewBox="0 0 320 270" className="chl-cup">
              <rect x="0" y="0" width="320" height="270" rx="8" className="chl-bg" />
              {bands.map(({ c, y0, y1 }) => (
                <g key={c.key} className="chl-band" onClick={() => setSel(c.key)}>
                  <path d={bandPath(y0, y1)} fill={c.color} opacity={sel === c.key ? 1 : 0.78} stroke={sel === c.key ? '#fff' : '#0a0610'} strokeWidth={sel === c.key ? 1.6 : 0.8} />
                  {y1 - y0 > 11 && <text x="160" y={(y0 + y1) / 2 + 4} textAnchor="middle" className="chl-bt">{c.name} · {fmt(cur.by[c.key] ?? 0)}</text>}
                </g>
              ))}
              <path d={`M150 ${bot + 2} h20 l-3 34 h-14z`} className="chl-stem" />
              <path d={`M118 ${bot + 40} h84 l-8 -6 h-68z`} className="chl-stem" />
              <text x="160" y="262" textAnchor="middle" className="chl-axis">толщина слоя — число людей (по степеням десяти)</text>
            </svg>
            <svg viewBox="0 0 200 270" className="chl-swords">
              <rect x="0" y="0" width="200" height="270" rx="8" className="chl-bg" />
              <text x="100" y="18" textAnchor="middle" className="chl-axis">Чистые мечи</text>
              {Array.from({ length: swords }, (_, i) => {
                const col = i % 6, row = Math.floor(i / 6)
                const x = 24 + col * 30, y = 34 + row * 22
                const on = i < cur.pureAdults
                return <path key={i} d={`M${x} ${y + 14} l0 -12 l-3 -2 h6 l-3 2 M${x - 4} ${y + 4} h8`} className={`chl-sw ${on ? 'on' : ''} ${i === data.limit - 1 ? 'lim' : ''}`} />
              })}
              <line x1="10" x2="190" y1={34 + 5.5 * 22 + 12} y2={34 + 5.5 * 22 + 12} className="chl-limit" />
              <text x="100" y="262" textAnchor="middle" className="chl-axis">красная черта — {data.limit}-й меч</text>
            </svg>
          </div>
          <div className="chl-slider"><span>{data.years[0].year}</span><input type="range" min={0} max={data.years.length - 1} value={yi} onChange={(e) => setYi(+e.target.value)} /><span>{data.years[data.years.length - 1].year}</span></div>
          <div className="chl-years">{data.years.map((y, i) => <button key={y.year} className={i === yi ? 'on' : ''} onClick={() => setYi(i)}>{y.year}</button>)}</div>
          {caste && (
            <div className="chl-card" style={{ ['--cc' as string]: caste.color }}>
              <b>{caste.name}</b> <small>· восьмушек: {caste.eighths} · {fmt(cur.by[caste.key] ?? 0)} в {cur.year} г.</small>
              <p><b>Можно:</b> {caste.rights}</p>
              <p><b>Нельзя:</b> {caste.bans}</p>
            </div>
          )}
          <div className="chl-legend">{data.sides.map((s) => <span key={s.key} title={s.who}><i style={{ background: s.color }} />{s.name}</span>)}</div>
        </>
      )}

      {tab === 'calls' && (
        <div className="chl-calls">
          {data.challenges.map((c) => (
            <div key={c.year} className={`chl-call ${c.result}`}>
              <b>{Math.floor(c.year)} · {c.by} → {c.target}</b>
              <small>{c.result === 'muddy' ? 'Мутная чаша: вызванный упал в касте' : 'чаша чиста'}</small>
              <p>{bold(c.note)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'heirs' && (
        <div className="chl-heirs">
          {data.heirs.map((h) => (
            <button key={h.id} className="chl-heir" onClick={() => onOpen(h.id)}>
              <span className="chl-face">{img.get(h.id) ? <img src={assetUrl(img.get(h.id)!)} alt="" /> : h.name[0]}</span>
              <span>
                <b>{h.name}</b>
                <span className="chl-dots">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < h.eighths ? 'on' : ''} />)}</span>
                <small>{h.note}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <ul className="chl-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
