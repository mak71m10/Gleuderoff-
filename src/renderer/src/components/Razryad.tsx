import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import { EMBLEMS } from './Heraldry'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['razryad']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const MODE: Record<string, [string, string, string]> = {
  even: ['Ровный стол', '#6aaa7a', 'споров нет: совет собирается, поход выходит всеми Домами'],
  crooked: ['Кривой стол', '#e8b84a', 'один спор: поход выходит без спорящего Дома'],
  broken: ['Сорванный стол', '#d0604a', 'поход не выходит, совет не собирается, пока суд не рассудит'],
}
const RES: Record<string, [string, string]> = { won: ['истец прав', '#6aaa7a'], lost: ['истец выдан головою', '#d0604a'], open: ['не решён', '#e8b84a'] }
const fy = (v: number | null): string => (v == null ? 'ныне' : String(Math.floor(v)))
const STEP = ['', 'наместник', 'воевода', 'тысяцкий', 'сотник', 'судья', 'без службы']

/**
 * «Разрядная книга» Харнмарка: княжий стол на шесть мест сверху. Ползунок лет 989–1010: Дома пересаживаются по росписи,
 * у каждого места — ступень Дома в книге; Дом, посаженный ниже того, кто ниже его по книге, «обижен»; открытые споры —
 * красные нити между местами, спорщик встаёт из-за стола. Справа — лестница ступеней книги.
 */
export function RazryadView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const name = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.name])), [world.entries])
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const Y0 = data.yearFrom, Y1 = data.yearTo
  const cur = data.years.find((r) => r.y === year) ?? data.years[data.years.length - 1]
  const [modeName, modeCol, modeNote] = MODE[cur.mode]
  const house = new Map(data.houses.map((h) => [h.key, h]))
  const guard = [...data.guardians].reverse().find((g) => g.from <= year + 0.5) ?? data.guardians[0]
  const gImg = guard ? img.get(guard.id) : ''
  const open = data.disputes.filter((d) => d.from < year + 1 && (d.to === null || d.to > year))
  const fresh = data.disputes.filter((d) => Math.floor(d.from) === year || (d.to !== null && Math.floor(d.to) === year && d.to !== d.from))
  const out = new Set(open.map((d) => d.plaintiff))
  // обида: Дом посажен ниже того, чья ступень хуже (больше)
  const hurt = new Set<string>()
  cur.order.forEach((k, j) => { for (let i = 0; i < j; i++) if (cur.steps[cur.order[i]] > cur.steps[k]) hurt.add(k) })
  const W = 380, H = 380, cx = 190
  const seatXY = (pos: number): [number, number] => [cx + (pos % 2 === 0 ? 88 : -88), 118 + Math.floor(pos / 2) * 82]
  const pos = new Map(cur.order.map((k, i) => [k, i]))
  const shown = sel ? house.get(sel) : null
  const shownSitter = sel ? cur.sitters[sel] : null
  const shownPos = sel ? (pos.get(sel) ?? -1) : -1
  const ladder = [1, 2, 3, 4, 5, 6].map((s) => ({ s, hs: data.houses.filter((h) => cur.steps[h.key] === s) }))
  const art7On = year >= 1009

  return (
    <div className="hm rzr">
      <div className="hm-head">
        <div>
          <small>Роспись мест в {year} г.</small>
          <b>{cur.ruler || 'Харнмарк'}</b>
          <span className="hm-sub">споров {cur.disputes} · в поход вышло {cur.marched.toLocaleString('ru')} из {data.levyTotal.toLocaleString('ru')} мечей</span>
        </div>
        <div className="hm-status" style={{ borderColor: modeCol, color: modeCol }}>{modeName}</div>
      </div>
      <div className="hm-slider">
        <span>{Y0}</span>
        <input type="range" min={Y0} max={Y1} value={year} onChange={(e) => { setYear(+e.target.value); setSel(null) }} />
        <span>{Y1}</span>
      </div>
      <div className="hm-main">
        <svg viewBox={`0 0 ${W} ${H}`} className="hm-wheel rzr-table">
          <defs>
            <clipPath id="rzr-prince"><circle cx={cx} cy={40} r="24" /></clipPath>
            {cur.order.map((k, i) => { const [x, y] = seatXY(i); return <clipPath key={k} id={`rzr-f-${k}`}><circle cx={x} cy={y} r="22" /></clipPath> })}
          </defs>
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="10" className="rzr-bg" />
          {/* стол */}
          <rect x={cx - 46} y={78} width="92" height={H - 112} rx="6" className="rzr-board" />
          <rect x={cx - 40} y={84} width="80" height={H - 124} rx="4" className="rzr-cloth" />
          {/* князь во главе */}
          <circle cx={cx} cy={40} r="28" className="rzr-throne" />
          {gImg ? <image href={assetUrl(gImg)} x={cx - 24} y={16} width="48" height="48" clipPath="url(#rzr-prince)" preserveAspectRatio="xMidYMid slice" onClick={() => guard && onOpen(guard.id)} style={{ cursor: 'pointer' }} /> : <circle cx={cx} cy={40} r="24" fill="#2a1c1c" />}
          <text x={cx} y={80} textAnchor="middle" className="rzr-prince">{year >= 1003.3 ? 'князь Эрих II' : year >= 991.6 ? 'князь Фридрих' : 'князь Эрих I'}</text>
          {/* нити споров */}
          {open.filter((d) => d.seat > 0).map((d, i) => {
            const a = pos.get(d.plaintiff), b = pos.get(d.defendant)
            if (a == null || b == null) return null
            const [x1, y1] = seatXY(a), [x2, y2] = seatXY(b)
            const bend = x1 === x2 ? (x1 > cx ? 60 : -60) : 0
            return <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2 + bend} ${(y1 + y2) / 2} ${x2} ${y2}`} className="rzr-thread" />
          })}
          {cur.order.map((k, i) => {
            const h = house.get(k)!
            const [x, y] = seatXY(i)
            const sid = cur.sitters[k]
            const src = sid ? img.get(sid) : ''
            const away = out.has(k)
            const sore = hurt.has(k)
            const isSel = sel === k
            const right = i % 2 === 0
            return (
              <g key={k} className={`rzr-seat ${away ? 'away' : ''}`} onClick={() => setSel(k)}>
                <line x1={x} y1={y} x2={right ? cx + 40 : cx - 40} y2={y} className="rzr-arm" />
                <circle cx={x} cy={y} r="27" fill={h.bg} stroke={isSel ? '#fff' : sore ? '#e8a040' : h.color} strokeWidth={isSel ? 3 : sore ? 3 : 1.8} strokeDasharray={away ? '4 4' : undefined} />
                {src ? <image href={assetUrl(src)} x={x - 22} y={y - 22} width="44" height="44" clipPath={`url(#rzr-f-${k})`} preserveAspectRatio="xMidYMid slice" opacity={away ? 0.35 : 1} /> : <circle cx={x} cy={y} r="22" fill="#1c1414" />}
                <g transform={`translate(${x + (right ? 18 : -36)} ${y - 34}) scale(.18)`}>{EMBLEMS[h.emblem]?.draw(h.color, h.bg)}</g>
                <text x={x} y={y + 40} textAnchor="middle" className="rzr-name">{i + 1}. {h.name.replace(/^Дом (фон )?/, '')}</text>
                <text x={x} y={y + 51} textAnchor="middle" className="rzr-step">ступень {cur.steps[k]}{away ? ' · бьёт челом' : sore ? ' · обида' : ''}</text>
              </g>
            )
          })}
          <text x={cx} y={H - 14} textAnchor="middle" className="rzr-foot">правая рука — справа · места 1–6 сверху вниз</text>
        </svg>
        <div className="hm-card">
          {shown ? (
            <div className="hm-card-text">
              <small>{shown.name} · {shown.seat}</small>
              <b>{shownSitter ? name.get(shownSitter) : shown.name}</b>
              <span className="hm-years">место {shownPos + 1} из {data.seats} · ступень {cur.steps[shown.key]} ({STEP[cur.steps[shown.key]]}) · ополчение {shown.levy.toLocaleString('ru')}</span>
              <p>{out.has(shown.key) ? 'Дом в споре о месте: за стол не садится, полк не выводит.' : hurt.has(shown.key) ? 'Посажен ниже Дома, который стоит в книге ниже: вправе бить челом.' : 'Сидит по книге.'} {shown.arms}.</p>
              <div className="hm-btns">
                {shownSitter && <button onClick={() => onOpen(shownSitter)}>за столом</button>}
                <button onClick={() => onOpen(shown.houseId)}>Дом</button>
                {shown.head && shown.head.id !== shownSitter && <button onClick={() => onOpen(shown.head!.id)}>глава: {shown.head.name.split(' ')[0]}</button>}
                <button onClick={() => setSel(null)}>к книге</button>
              </div>
            </div>
          ) : (
            <div className="hm-card-text">
              <small>Разрядная книга · {year} г.</small>
              <b>Ступени Домов</b>
              <div className="rzr-ladder">
                {ladder.map(({ s, hs }) => (
                  <div key={s} className="rzr-rung">
                    <span className="rzr-rung-n">{s}</span>
                    <span className="rzr-rung-t">{STEP[s]}</span>
                    <span className="rzr-rung-h">{hs.map((h) => <button key={h.key} style={{ background: h.bg, color: h.color, borderColor: h.color }} onClick={() => setSel(h.key)}>{h.name.replace(/^Дом (фон )?/, '')}</button>)}</span>
                  </div>
                ))}
              </div>
              <span className="hm-years" style={{ color: modeCol }}>{modeName}: {modeNote}</span>
              <p>{cur.why}</p>
            </div>
          )}
        </div>
      </div>
      {fresh.map((d, i) => (
        <p key={i} className="hm-night" style={{ borderColor: RES[d.result][1] }}><b>{house.get(d.plaintiff)?.name} против {house.get(d.defendant)?.name}{d.seat ? ` (место ${d.seat})` : ' (стольники)'}.</b> {d.note}</p>
      ))}
      <div className="hm-legend">
        <span><i style={{ background: '#e8a040' }} />обида: посажен ниже того, кто ниже по книге</span>
        <span><i className="rzr-key-away" />бьёт челом — не служит</span>
        <span><i style={{ background: '#d0604a' }} />нить спора</span>
      </div>

      <h4 className="hm-h">Сколько мечей вышло в поход</h4>
      <div className="hm-chart" role="list">
        {data.years.map((r) => (
          <button key={r.y} role="listitem" className={`hm-bar ${r.mode === 'even' ? 'full' : r.mode === 'crooked' ? 'lean' : 'fall'} ${r.y === year ? 'on' : ''}`} style={{ height: 6 + (r.marched / data.levyTotal) * 48 }} onClick={() => { setYear(r.y); setSel(null) }} title={`${r.y}: ${MODE[r.mode][0]}, вышло ${r.marched}`} />
        ))}
      </div>

      <h4 className="hm-h">Споры о местах</h4>
      <div className="hm-pledges">
        {data.disputes.map((d, i) => {
          const on = open.includes(d)
          return (
            <div key={i} className={`hm-pledge ${on ? 'on' : ''}`} onClick={() => { setYear(Math.min(Y1, Math.max(Y0, Math.floor(d.from)))); setSel(d.plaintiff) }}>
              <span className="hm-pledge-y">{Math.floor(d.from)}</span>
              <span className="hm-pledge-t"><b>{house.get(d.plaintiff)?.name}</b> против <b>{house.get(d.defendant)?.name}</b></span>
              <span className="hm-pledge-w">{d.seat ? `место ${d.seat}${d.seat <= 2 ? ', большое' : ''}` : 'стольники'} · {fy(d.from)}–{fy(d.to)}</span>
              <span className="hm-pledge-s" style={{ color: RES[d.result][1], borderColor: RES[d.result][1] }}>{RES[d.result][0]}</span>
              <small>{d.note}</small>
            </div>
          )
        })}
      </div>

      <h4 className="hm-h">Князья</h4>
      <div className="hm-pledges">
        {data.guardians.map((g) => (
          <div key={g.id} className={`hm-pledge ${g === guard ? 'on' : ''}`} onClick={() => onOpen(g.id)}>
            <span className="hm-pledge-y">{Math.floor(g.from)}</span>
            <span className="hm-pledge-t"><b>{g.name}</b></span>
            <span className="hm-pledge-w">{fy(g.from)}–{fy(g.to)}</span>
            <span className="hm-pledge-s" style={{ color: '#c9a24a', borderColor: '#c9a24a' }}>открыть</span>
            <small>{g.note}</small>
          </div>
        ))}
      </div>

      <p className={`hm-art ${art7On ? 'on' : ''}`}>
        <b>Статья 7 «Без мест»</b> {art7On ? `ни разу не объявлялась. Регенту она не дана; князю Эриху II шестнадцать исполнится в Ячори ${data.comeOfAge} г., а Империя ждёт три тысячи мечей до Ячори 1011 г.` : 'есть в Хартии, но совершеннолетний князь ни разу не клал руку на книгу.'}
      </p>
      <ul className="hm-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
