import { useMemo, useState, type ReactNode } from 'react'
import type { Entry } from '../types'

type PData = NonNullable<Entry['base']['pledge']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const pai = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'пай' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'пая' : 'паёв')
const hash = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

/** паи по держателям на дату: последний снимок не позже даты */
function sharesAt(snaps: PData['snaps'], t: number): Record<string, number> {
  const s = [...snaps].reverse().find((x) => x.year <= t) ?? snaps[0]
  return s
}

/**
 * «Лесные паи и Заложенный венец» Таварвайта: лес из сотни деревьев-паёв, каждое окрашено в цвет держателя (король — зелёный, кредиторы — свои цвета);
 * красная черта — пятьдесят один пай: выше — Венец стоит, ниже — Заложенный венец. Вкладки: «Лес» (ползунок лет, клик по держателю выделяет его паи), «Займы».
 */
export function PledgeView({ data }: { data: PData; onOpen?: (id: string) => void }) {
  const [tab, setTab] = useState<'forest' | 'loans'>('forest')
  const [year, setYear] = useState(1010)
  const [hl, setHl] = useState<string | null>(null)
  const t = year + 0.99
  const sh = sharesAt(data.snaps, t)
  const crown = sh.crown ?? 0
  const stands = crown >= data.line
  const order = useMemo(() => Array.from({ length: data.total }, (_, i) => i).sort((a, b) => (hash(`t${a}`) % 9973) - (hash(`t${b}`) % 9973)), [data.total])
  // дерево i принадлежит держателю по номеру в порядке: сначала Венец, потом по очереди кредиторы
  const owner = useMemo(() => {
    const o: string[] = new Array(data.total)
    let k = 0
    for (const h of data.holders) for (let j = 0; j < (sh[h.key] ?? 0); j++) o[order[k++]] = h.key
    return o
  }, [order, sh, data.holders, data.total])
  const col = new Map(data.holders.map((h) => [h.key, h.color]))
  const status: [string, string] = stands ? [`Венец стоит: ${crown} паёв из ${data.total}`, 'ok'] : [`Заложенный венец: у короля ${crown} из ${data.line} нужных`, 'bad']
  const loans = data.loans.filter((l) => l.year <= t)
  return (
    <div className="pld">
      <div className="pld-head">
        <div><small>Таварвайт в {year} г.</small><b>Король Тауртирит</b></div>
        <div className={`pld-status ${status[1]}`}>{status[0]}</div>
      </div>
      <div className="pld-tabs">{([['forest', 'Лес'], ['loans', 'Займы']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'forest' && (
        <>
          <svg viewBox="0 0 420 250" className="pld-pic">
            <rect x="0" y="0" width="420" height="250" rx="8" className="pld-bg" />
            {Array.from({ length: data.total }, (_, i) => {
              const r = Math.floor(i / 20), c = i % 20, x = 22 + c * 19.2 + (r % 2 ? 9 : 0), y = 20 + r * 38, k = owner[i] ?? 'crown'
              const dim = hl && hl !== k
              return (
                <g key={i} transform={`translate(${x} ${y})`} opacity={dim ? 0.2 : 1}>
                  <rect x="-1.5" y="16" width="3" height="9" fill="#5a3a22" />
                  <path d="M0 -6 L8 8 L-8 8 Z" fill={col.get(k)} /><path d="M0 2 L10 17 L-10 17 Z" fill={col.get(k)} opacity=".88" />
                </g>
              )
            })}
            <text x="210" y="244" textAnchor="middle" className="pld-cap">Венец: {crown} паёв · нужно {data.line}</text>
          </svg>
          <div className="pld-bar"><i style={{ width: `${crown}%`, background: col.get('crown') }} /><s style={{ left: `${data.line}%` }} /></div>
          <div className="pld-slider"><span>978</span><input type="range" min={978} max={1010} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1010</span></div>
          <div className="pld-hold">
            {data.holders.map((h) => (
              <button key={h.key} className={hl === h.key ? 'on' : ''} onClick={() => setHl(hl === h.key ? null : h.key)}><i style={{ background: h.color }} />{h.name}: <b>{sh[h.key] ?? 0}</b></button>
            ))}
          </div>
          {year === 1010 && <p className="pld-note">{data.due.note}</p>}
        </>
      )}
      {tab === 'loans' && (
        <div className="pld-loans">
          {data.loans.map((l, i) => (
            <div key={i} className={`pld-loan ${l.year <= t ? '' : 'later'}`} style={{ borderColor: col.get(l.holder) }}>
              <b>{Math.floor(l.year)} · {l.title}</b>
              <span>{data.holders.find((h) => h.key === l.holder)?.name}: {l.shares} {pai(l.shares)} · {l.sum} марок</span>
              <small>{l.why}{l.note ? ` ${l.note}` : ''}</small>
            </div>
          ))}
          {loans.length === 0 && <p className="pld-note">До 984 г. лес целиком принадлежал королю.</p>}
        </div>
      )}
      <ul className="pld-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
