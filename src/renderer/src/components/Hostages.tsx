import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import { EMBLEMS } from './Heraldry'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['hostages']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const rad = (a: number): number => (a * Math.PI) / 180
const MODE: Record<string, [string, string]> = { full: ['Полный залог', '#6aaa7a'], lean: ['Скудный залог', '#e8b84a'], fall: ['Пустые колыбели', '#d0604a'] }
const fmt = (v: number | null): string => (v == null ? 'по сей день' : String(Math.floor(v)))

/**
 * «Пять Колыбелей» Харнмарка: пять Домов держат в Орельберге по ребёнку; ползунок лет показывает, в каких колыбелях
 * лежит заложник (цветной малыш), в каких пусто (пунктир), счёт года и режим власти князя; в 1010 г. колыбель Грисхольма
 * помечена золотой звездой — заложник старше князя, и девятая статья может вернуться.
 */
export function HostagesView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const Y0 = data.yearFrom, Y1 = data.yearTo
  const cur = data.years.find((r) => r.y === year) ?? data.years[data.years.length - 1]
  const [modeName, modeCol] = MODE[cur.mode]
  const guard = [...data.guardians].reverse().find((g) => g.from <= year + 0.5) ?? data.guardians[0]
  const gImg = guard?.id ? img.get(guard.id) : ''
  const t = year + 0.5
  const pledgeOf = (house: string): Data['pledges'][number] | undefined => data.pledges.find((p) => p.house === house && p.from <= t && (p.to === null || t < p.to))
  const SZ = 360, C = SZ / 2, R = 118
  const shownHouse = sel ? data.houses.find((h) => h.key === sel) ?? data.houses[0] : null
  const shownPledge = shownHouse ? pledgeOf(shownHouse.key) : undefined
  const night = data.nights.find((n) => n.y === year)
  const art9On = year >= data.art9Year
  const scoreArc = (cur.score / data.houses.length) * 360

  return (
    <div className="hm">
      <div className="hm-head">
        <div>
          <small>Колыбельный счёт в {year} г.</small>
          <b>{cur.ruler || 'Харнмарк'}</b>
          <span className="hm-sub">счёт {cur.score} из {data.houses.length} · ополчение {cur.levy.toLocaleString('ru')} мечей</span>
        </div>
        <div className="hm-status" style={{ borderColor: modeCol, color: modeCol }}>{modeName}</div>
      </div>
      <div className="hm-slider">
        <span>{Y0}</span>
        <input type="range" min={Y0} max={Y1} value={year} onChange={(e) => { setYear(+e.target.value); setSel(null) }} />
        <span>{Y1}</span>
      </div>
      <div className="hm-main">
        <svg viewBox={`0 0 ${SZ} ${SZ}`} className="hm-wheel">
          <defs>
            <radialGradient id="hm-glow"><stop offset="0" stopColor="#f0d890" stopOpacity=".5" /><stop offset="1" stopColor="#f0d890" stopOpacity="0" /></radialGradient>
            <clipPath id="hm-face"><circle cx={C} cy={C - 6} r="34" /></clipPath>
          </defs>
          <circle cx={C} cy={C} r="165" fill="#0e1410" stroke="#3a4a3a" />
          <circle cx={C} cy={C} r={R} fill="none" stroke="#2a342a" strokeWidth="1" strokeDasharray="2 5" />
          {data.houses.map((h, i) => {
            const a = -90 + (i * 360) / data.houses.length
            const x = C + Math.cos(rad(a)) * R, y = C + Math.sin(rad(a)) * R
            const d = cur.held[i] ?? '0'
            const on = d !== '0'
            const older = d === '2'
            const p = pledgeOf(h.key)
            const isSel = sel === h.key
            return (
              <g key={h.key} className="hm-cradle" onClick={() => setSel(isSel ? null : h.key)}>
                <circle cx={x} cy={y} r="34" fill={on ? h.bg : '#141a16'} opacity={on ? 0.9 : 0.7} stroke={isSel ? '#fff' : on ? h.color : '#4a4a40'} strokeWidth={isSel ? 2.6 : 1.6} strokeDasharray={on ? undefined : '4 4'} />
                {/* колыбель: дуга-полоз и стенка */}
                <path d={`M${x - 20} ${y + 15} q20 10 40 0`} fill="none" stroke={on ? h.color : '#5a5a4a'} strokeWidth="2.4" strokeLinecap="round" />
                <path d={`M${x - 16} ${y + 12} v-12 h32 v12`} fill="none" stroke={on ? h.color : '#5a5a4a'} strokeWidth="1.8" strokeDasharray={on ? undefined : '3 3'} />
                {on ? (
                  <g className="hm-baby">
                    <circle cx={x} cy={y - 6} r="7.5" fill="#e8d4b0" stroke={h.color} strokeWidth="1.2" />
                    <path d={`M${x - 11} ${y + 11} q11 -14 22 0 z`} fill={h.color} opacity=".9" />
                  </g>
                ) : (
                  <text x={x} y={y + 2} textAnchor="middle" className="hm-void">пусто</text>
                )}
                {older && <path d={`M${x + 22} ${y - 30} l3 7 7.5 .6 -5.7 5 1.8 7.4 -6.6 -4 -6.6 4 1.8 -7.4 -5.7 -5 7.5 -.6 z`} fill="#f0c84a" stroke="#0e1410" strokeWidth=".8" className="hm-star" />}
                <g transform={`translate(${x - 9} ${y - 49}) scale(.18)`}>{EMBLEMS[h.emblem]?.draw(h.color, '#101612')}</g>
                <text x={x} y={y + 47} textAnchor="middle" className="hm-seat">{h.name.replace(/^Дом /, '')}</text>
                {p && <text x={x} y={y + 58} textAnchor="middle" className="hm-kid">{p.name.split(' ')[0]}</text>}
              </g>
            )
          })}
          {/* кольцо счёта */}
          <circle cx={C} cy={C} r="60" fill="#161c18" stroke="#c9a24a" strokeWidth="1.5" />
          <path d={`M${C} ${C - 66} A66 66 0 ${scoreArc > 180 ? 1 : 0} 1 ${(C + Math.sin(rad(scoreArc)) * 66).toFixed(1)} ${(C - Math.cos(rad(scoreArc)) * 66).toFixed(1)}`} fill="none" stroke={modeCol} strokeWidth="4" strokeLinecap="round" opacity={cur.score ? 1 : 0} />
          <circle cx={C} cy={C} r="62" fill="url(#hm-glow)" opacity=".35" pointerEvents="none" />
          {gImg ? <image href={assetUrl(gImg)} x={C - 34} y={C - 40} width="68" height="68" clipPath="url(#hm-face)" preserveAspectRatio="xMidYMid slice" /> : <circle cx={C} cy={C - 6} r="34" fill="#222a24" />}
          <text x={C} y={C + 44} textAnchor="middle" className="hm-year">{year}</text>
          <text x={C} y={C + 56} textAnchor="middle" className="hm-ring-name">счёт {cur.score}</text>
        </svg>
        <div className="hm-card">
          {shownHouse ? (
            <div className="hm-card-text">
              <small>{shownHouse.name} · {shownHouse.seat}</small>
              <b>{shownPledge ? shownPledge.name : 'Колыбель пуста'}</b>
              <span className="hm-years">{shownPledge ? `в Орельберге ${fmt(shownPledge.from)} — ${fmt(shownPledge.to)}` : `в ${year} г. Дом ребёнка не прислал`}</span>
              <p>{shownPledge?.note ?? shownHouse.arms}</p>
              <div className="hm-btns">
                {shownPledge?.id && <button onClick={() => onOpen(shownPledge.id as string)}>заложник</button>}
                <button onClick={() => onOpen(shownHouse.houseId)}>Дом</button>
                {shownHouse.head && <button onClick={() => onOpen(shownHouse.head.id)}>глава: {shownHouse.head.name.split(' ')[0]}</button>}
                <button onClick={() => setSel(null)}>к году</button>
              </div>
            </div>
          ) : (
            <div className="hm-card-text">
              <small>{guard?.house === 'harn' ? 'Дом Харн' : ''} · {fmt(guard?.from ?? null)} — {fmt(guard?.to ?? null)}</small>
              <b>{guard?.name}</b>
              <span className="hm-years" style={{ color: modeCol }}>{modeName}: {cur.mode === 'full' ? 'князь правит один' : cur.mode === 'lean' ? 'налоги только с Советом Пяти Домов' : 'указы нужны с печатями двух Домов'}</span>
              <p>{guard?.note}</p>
              <div className="hm-btns">{guard?.id && <button onClick={() => onOpen(guard.id)}>открыть</button>}</div>
            </div>
          )}
        </div>
      </div>
      {night && <p className="hm-night"><b>{night.title}.</b> {night.note}</p>}
      <div className="hm-legend">
        {data.houses.map((h) => <span key={h.key}><i style={{ background: h.color }} />{h.name}</span>)}
        <span><i className="hm-key hm-key-void" />пустая колыбель</span>
        <span><i className="hm-key hm-key-star" />заложник старше князя</span>
      </div>

      <h4 className="hm-h">Колыбельный счёт по годам</h4>
      <div className="hm-chart" role="list">
        {data.years.map((r) => (
          <button key={r.y} role="listitem" className={`hm-bar ${r.mode} ${r.y === year ? 'on' : ''}`} style={{ height: 8 + r.score * 8 }} onClick={() => { setYear(r.y); setSel(null) }} title={`${r.y}: счёт ${r.score}`} />
        ))}
      </div>

      <h4 className="hm-h">Книга Колыбелей: кто лежал в колыбелях</h4>
      <div className="hm-pledges">
        {data.pledges.map((p, i) => {
          const h = data.houses.find((x) => x.key === p.house)
          const live = p.from <= data.yearTo + 0.5 && p.to === null
          return (
            <div key={i} className={`hm-pledge ${year + 0.5 >= p.from && (p.to === null || year + 0.5 < p.to) ? 'on' : ''}`} onClick={() => { setYear(Math.min(Y1, Math.max(Y0, Math.floor(p.from)))); setSel(p.house) }}>
              <span className="hm-pledge-y">{Math.floor(p.from)}</span>
              <span className="hm-pledge-t"><b>{p.name}</b> · {h?.name}</span>
              <span className="hm-pledge-w">{p.born} г. р. · до {fmt(p.to)}</span>
              <span className="hm-pledge-s" style={{ color: live ? '#e8b84a' : '#8aa0c0', borderColor: live ? '#e8b84a' : '#8aa0c0' }}>{live ? 'в колыбели' : 'ушёл'}</span>
              <small>{p.note}</small>
            </div>
          )
        })}
      </div>

      <p className={`hm-art ${art9On ? 'on' : ''}`}>
        <b>Статья 9 «Обратный залог»</b> {art9On ? 'вымарана в 989 г., но в списке, хранимом Домом Грисхольм, она цела: в 1010 г. Рудольф старше князя, и срок — до 1011 г.' : 'вымарана из Хартии в 989 г. и в этом году никому не нужна.'}
      </p>
      <ul className="hm-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
