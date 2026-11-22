import { useState, type ReactNode } from 'react'
import type { Entry } from '../types'

type LedgerData = NonNullable<Entry['base']['ledger']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const fmt = (n: number) => n.toLocaleString('ru')

/**
 * «Сто Долей» Каяя: сто золотых монет на карточном столе, окрашенных по держателям; ползунок лет 908–1010 перекрашивает стол после каждой
 * Ночи Карт. Игрушка: поставить Доли Геральда на кон и посмотреть, у кого будет Старший стол. Ниже — Книга долгов стран.
 */
export function LedgerView({ data }: { data: LedgerData; onOpen: (id: string) => void }) {
  const [yi, setYi] = useState(data.shares.length - 1)
  const [stake, setStake] = useState(0)
  const cur = data.shares[yi]
  const col = new Map(data.holders.map((h) => [h.key, h]))
  const by: Record<string, number> = { ...cur.by }
  if (stake && yi === data.shares.length - 1) { by.gerald = (by.gerald ?? 0) - stake; by.isab = (by.isab ?? 0) + stake }
  const coins: string[] = []
  for (const h of data.holders) for (let i = 0; i < (by[h.key] ?? 0); i++) coins.push(h.key)
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0]
  const maxDebt = Math.max(...data.debts.map((d) => d.marks))
  return (
    <div className="ldg">
      <div className="ldg-head">
        <div>
          <small>Карточный стол в {cur.year} г.</small>
          <b>Старший стол — {col.get(top[0])?.name} ({top[1]} из {data.total})</b>
        </div>
        <div className={`ldg-status ${top[1] >= data.need ? 'calm' : 'edge'}`}>{top[1] >= data.need ? <>💰 {data.need} Долей — решает один</> : <>❗ ни у кого нет {data.need} Долей</>}</div>
      </div>
      <svg viewBox="0 0 420 230" className="ldg-svg">
        <ellipse cx="210" cy="115" rx="204" ry="108" className="ldg-table" />
        {coins.map((k, i) => { const r = Math.floor(i / 10), c = i % 10; return <circle key={i} cx={115 + c * 21} cy={30 + r * 19} r="8.5" fill={col.get(k)?.color} className="ldg-coin" /> })}
      </svg>
      <div className="ldg-slider"><span>{data.shares[0].year}</span><input type="range" min={0} max={data.shares.length - 1} value={yi} onChange={(e) => { setYi(+e.target.value); setStake(0) }} /><span>{data.shares[data.shares.length - 1].year}</span></div>
      <p className="ldg-note">{cur.note}</p>
      {yi === data.shares.length - 1 && (
        <label className="ldg-stake">Ночь Карт 1010: Геральд проигрывает Изабелле <input type="range" min={0} max={by.gerald + stake} value={stake} onChange={(e) => setStake(+e.target.value)} /> <b>{stake}</b> Долей</label>
      )}
      <div className="ldg-legend">{data.holders.filter((h) => (by[h.key] ?? 0) > 0).map((h) => <span key={h.key}><i style={{ background: h.color }} />{h.name} — {by[h.key]}</span>)}</div>
      <h4 className="ldg-h">Книга долгов</h4>
      <div className="ldg-debts">
        {data.debts.map((d) => (
          <div key={d.who} className="ldg-debt" title={d.note}>
            <span className="ldg-who">{d.who}</span>
            <span className="ldg-bar"><i style={{ width: `${Math.max(1, (d.marks / maxDebt) * 100)}%` }} /></span>
            <span className="ldg-sum">{d.marks ? `${fmt(d.marks)} мар.` : 'не берёт'}</span>
            <small>{d.year} · под {d.pledge}</small>
          </div>
        ))}
      </div>
      <ul className="ldg-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
