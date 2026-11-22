import { useState, type ReactNode } from 'react'
import type { Entry } from '../types'

type ResData = NonNullable<Entry['base']['reserve']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const ST: Record<string, [string, string]> = { active: ['идёт', '#e0b84a'], done: ['закончена', '#6aaa7a'], failed: ['сорвана', '#d0604a'], pending: ['ждёт подписи', '#b48ad8'] }

/** запас слитков на дату: линейно между точками */
function stockAt(stock: [number, number][], t: number): number {
  if (t <= stock[0][0]) return stock[0][1]
  for (let i = 1; i < stock.length; i++) if (t <= stock[i][0]) { const [a, b] = [stock[i - 1], stock[i]]; return Math.round(a[1] + ((t - a[0]) / (b[0] - a[0])) * (b[1] - a[1])) }
  return stock[stock.length - 1][1]
}

/**
 * «Золотой запас и Грёзы» Павильона Грёз: Сонное Хранилище — стопки слитков по запасу на год, два замка (золотой ключ Хранителя и серебряный Ревизора),
 * семь окон-фонарей по числу действующих Грёз, красная черта порога. Вкладки: «Хранилище» (ползунок лет), «Грёзы», «Ревизии».
 */
export function ReserveView({ data }: { data: ResData; onOpen?: (id: string) => void }) {
  const [tab, setTab] = useState<'vault' | 'dreams' | 'audits'>('vault')
  const [year, setYear] = useState(1010)
  const [sel, setSel] = useState<number | null>(null)
  const t = year + 0.5
  const have = stockAt(data.stock, tab === 'vault' ? t : 1010.5)
  const sleepless = data.sleepless.some((s) => t >= s.from && t <= s.to) || have < data.floor
  const active = data.dreams.filter((d) => d.status !== 'pending' && d.from <= t && (d.to == null || t <= d.to) && d.status !== 'failed' || (d.status === 'failed' && d.from <= t && t <= d.from + 0.8))
  const lit = Math.min(data.windows, active.length)
  const cols = 14, rows = 6, ing = Math.min(cols * rows, Math.ceil(have / 2))
  const floorRow = Math.ceil(data.floor / 2 / cols)
  const status: [string, string] = sleepless ? ['Ночь без сна: ключ у Ревизора', 'bad'] : year === 1010 ? [`Запас ${have} слитков · ждёт подписи Застава Целведеля`, 'due'] : [`Запас ${have} слитков · ключ у Хранителя`, 'ok']
  const picked = sel != null ? data.dreams[sel] : null
  return (
    <div className="rsv">
      <div className="rsv-head">
        <div><small>Павильон Грёз в {year} г.</small><b>Хранитель Натен Россо Сен</b></div>
        <div className={`rsv-status ${status[1]}`}>{status[0]}</div>
      </div>
      <div className="rsv-tabs">{([['vault', 'Хранилище'], ['dreams', 'Грёзы'], ['audits', 'Ревизии']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'vault' && (
        <>
          <svg viewBox="0 0 420 250" className="rsv-pic">
            <rect x="0" y="0" width="420" height="250" rx="8" className="rsv-bg" />
            {Array.from({ length: data.windows }, (_, i) => (
              <g key={i} transform={`translate(${46 + i * 54} 26)`}>
                <rect x="-14" y="0" width="28" height="40" rx="14" className="rsv-win" />
                <rect x="-9" y="5" width="18" height="30" rx="9" className={i < lit ? 'rsv-glow on' : 'rsv-glow'} />
              </g>
            ))}
            <rect x="24" y="84" width="372" height="136" rx="6" className="rsv-vault" />
            {Array.from({ length: ing }, (_, i) => {
              const c = i % cols, r = Math.floor(i / cols)
              return <rect key={i} x={36 + c * 25.2} y={206 - r * 20} width="22" height="16" rx="2" className={sleepless ? 'rsv-ingot dim' : 'rsv-ingot'} />
            })}
            <line x1="30" x2="390" y1={206 - floorRow * 20 + 17} y2={206 - floorRow * 20 + 17} className="rsv-floor" />
            <text x="388" y={206 - floorRow * 20 + 12} textAnchor="end" className="rsv-cap">порог {data.floor}</text>
            <g transform="translate(210 66)">
              <circle r="11" className={sleepless ? 'rsv-lock' : 'rsv-lock keeper'} cx="-26" cy="0" /><text x="-26" y="3.5" textAnchor="middle" className="rsv-lock-t">Х</text>
              <circle r="11" className={sleepless ? 'rsv-lock aud on' : 'rsv-lock aud'} cx="26" cy="0" /><text x="26" y="3.5" textAnchor="middle" className="rsv-lock-t">Р</text>
            </g>
            <text x="210" y="244" textAnchor="middle" className="rsv-cap">{have} слитков · горит окон: {lit} из {data.windows}</text>
          </svg>
          <div className="rsv-slider"><span>979</span><input type="range" min={979} max={1010} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1010</span></div>
          {year === 1010 && <p className="rsv-note">{data.due.note}</p>}
          <div className="rsv-act">{active.map((d, i) => <span key={i} title={d.note}>{d.title} · {d.cost}</span>)}</div>
        </>
      )}
      {tab === 'dreams' && (
        <>
          <div className="rsv-list">
            {data.dreams.map((d, i) => (
              <button key={i} className={sel === i ? 'on' : ''} onClick={() => setSel(sel === i ? null : i)}>
                <small>{Math.floor(d.from)}</small> {d.title}<em style={{ color: ST[d.status]?.[1] }}> · {d.cost} сл. · {d.signed ? 'с подписью Ревизора' : 'один ключ'} · {ST[d.status]?.[0]}</em>
              </button>
            ))}
          </div>
          {picked && <p className="rsv-note">{picked.note}</p>}
        </>
      )}
      {tab === 'audits' && (
        <div className="rsv-list">
          {data.audits.map((a) => <div key={a.year} className={`rsv-audit ${a.kind}`}><b>{a.year}</b> — {a.note}</div>)}
        </div>
      )}
      <div className="rsv-legend">{data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      <ul className="rsv-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
