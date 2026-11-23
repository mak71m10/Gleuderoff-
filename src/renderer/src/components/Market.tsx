import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { formatDate } from '../calendar'
import { GOOD, GOODS, fmtMarks, journalAdd, type Good } from '../economy'
import { marketAt, sellable, treasuryAt } from '../econCalc'
import { KAYA_FEE, MONTH, dealSum, type MarketShock, type MarketTrade } from '../market'

const TICKER: Record<Good, string> = { grain: 'ХЛБ', fish: 'РЫБ', cattle: 'СКТ', wood: 'ЛЕС', stone: 'КМН', iron: 'ЖЛЗ', copper: 'МДЬ', silver: 'СРБ', salt: 'СОЛ', coal: 'УГЛ', saltpetre: 'СЛТ', furs: 'МЕХ', horses: 'КОН', cloth: 'ТКН', tools: 'ИНС', arms: 'ОРЖ', powder: 'ПРХ', wine: 'ВИН', luxury: 'РСК', reagents: 'РЕА' }
const pct = (a: number, b: number): number => (b ? Math.round((1000 * (a - b)) / b) / 10 : 0)
const sgn = (v: number): string => `${v > 0 ? '+' : ''}${String(v).replace('.', ',')} %`
const num = (v: number): string => v.toFixed(2).replace('.', ',')

/** линия цены за несколько месяцев (с обычной ценой пунктиром) */
function Chart({ vals, base, w = 100, h = 30, big = false }: { vals: number[]; base?: number; w?: number; h?: number; big?: boolean }) {
  const all = base != null ? [...vals, base] : vals
  const max = Math.max(...all) * 1.04, min = Math.min(...all) * 0.96
  const x = (i: number): number => (i / Math.max(1, vals.length - 1)) * (w - 8) + 4
  const y = (v: number): number => h - 4 - ((v - min) / Math.max(0.0001, max - min)) * (h - 8)
  const up = vals[vals.length - 1] >= vals[0], c = up ? '#3fd07a' : '#f05a4a'
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={big ? 'bx-chart big' : 'bx-chart'} preserveAspectRatio="none">
      {big && [0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="rgba(255,255,255,.06)" />)}
      {base != null && <line x1="0" x2={w} y1={y(base)} y2={y(base)} stroke="rgba(255,255,255,.25)" strokeDasharray="4 4" />}
      <polygon points={`${x(0)},${h} ${pts} ${x(vals.length - 1)},${h}`} fill={c} opacity=".12" />
      <polyline points={pts} fill="none" stroke={c} strokeWidth={big ? 2.5 : 1.6} />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r={big ? 4 : 2.5} fill={c} />
    </svg>
  )
}
/** свеча месяца: открытие — прошлый месяц, закрытие — сейчас, тени — разброс за полгода */
function Candle({ o, c, hi, lo }: { o: number; c: number; hi: number; lo: number }) {
  const max = hi * 1.02, min = lo * 0.98, y = (v: number): number => 26 - ((v - min) / Math.max(0.0001, max - min)) * 22
  const up = c >= o, col = up ? '#3fd07a' : '#f05a4a'
  return (
    <svg viewBox="0 0 14 30" className="bx-candle">
      <line x1="7" x2="7" y1={y(hi)} y2={y(lo)} stroke={col} />
      <rect x="3" width="8" y={Math.min(y(o), y(c))} height={Math.max(1.5, Math.abs(y(o) - y(c)))} fill={col} />
    </svg>
  )
}

/** Биржа Каяи: котировки, индекс, лента, стакан, сделки, договоры, потрясения, правила */
export function MarketView() {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const N = 8
  const hist = useMemo(() => Array.from({ length: N }, (_, i) => marketAt(world, date - (N - 1 - i) * MONTH)), [world, date])
  const now = hist[N - 1], prev = hist[N - 2]
  const [sel, setSel] = useState<Good>('grain')
  const states = useMemo(() => world.states.filter((s) => s.base.econ && s.base.military).sort((a, b) => a.base.name.localeCompare(b.base.name, 'ru')), [world.states])
  const [who, setWho] = useState('')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState(500)
  const [kind, setKind] = useState<'deal' | 'contract'>('deal')
  const [months, setMonths] = useState(3)
  const [shockMult, setShockMult] = useState(1.5)
  const [shockDays, setShockDays] = useState(200)
  const [shockNote, setShockNote] = useState('')
  const [msg, setMsg] = useState('')
  const rows = now.goods.map((g, i) => {
    const series = hist.map((h) => h.goods[i].price)
    return { ...g, series, ch: pct(g.price, prev.goods[i].price), norm: pct(g.price, g.base), hi: Math.max(...series.slice(-6)), lo: Math.min(...series.slice(-6)) }
  })
  const cur = rows.find((r) => r.good === sel)!
  const movers = rows.slice().sort((a, b) => b.ch - a.ch)
  const maxVol = Math.max(1, ...rows.map((r) => r.volume))
  const qtySigned = side === 'buy' ? qty : -qty
  const sum = dealSum(qtySigned, cur.price)
  const impact = Math.max(0.6, Math.min(1.6, 1 + (qtySigned / Math.max(1, cur.supply)) * 1.5 * (kind === 'deal' ? 1 : 0.5)))
  const st = states.find((s) => s.id === who)
  const cash = st ? treasuryAt(world, st, date) : 0
  // продать можно только излишек этого хода
  const canSell = st && side === 'sell' ? sellable(world, st.id, sel, date) : Infinity
  const doTrade = (): void => {
    if (!st) return
    const t: MarketTrade = { id: `t${Date.now().toString(36)}`, stateId: st.id, good: sel, qty: qtySigned, price: cur.price, date, kind, ...(kind === 'contract' ? { months } : {}) }
    mutate((w) => {
      ;((w.market ??= { shocks: [] }).trades ??= []).push(t)
      const s = w.states.find((x) => x.id === st.id)
      if (kind === 'deal' && s?.base.econ) journalAdd(s.base.econ, date, qtySigned > 0 ? -sum : sum, `биржа: ${side === 'buy' ? 'покупка' : 'продажа'} ${qty} «${GOOD[sel].name}»`, 'deal')
      ;(w.vpiLog ??= []).push({ id: `v${Date.now().toString(36)}`, date, at: new Date().toISOString(), state: st.base.name, title: `Биржа Каяи: ${side === 'buy' ? 'покупка' : 'продажа'} ${GOOD[sel].name.toLowerCase()}`, order: '', verdict: '', public: `${st.base.name} ${side === 'buy' ? 'купила' : 'продала'} ${qty} «${GOOD[sel].name}» по ${num(cur.price)}${kind === 'contract' ? ` — договор на ${months} мес.` : ''}.`, changes: [] })
    })
    setMsg(`${st.base.name}: ${side === 'buy' ? 'куплено' : 'продано'} ${qty} «${GOOD[sel].name}» по ${num(cur.price)} — ${fmtMarks(sum)}${kind === "contract" ? " в месяц" : ""}`)
  }
  const shocks: MarketShock[] = world.market?.shocks ?? []
  const deals = (world.market?.trades ?? []).filter((t) => t.good === sel).slice(-8).reverse()
  const idxSeries = hist.map((h) => h.index)

  return (
    <div className="bx">
      <div className="bx-top">
        <div className="bx-title">
          <span className="bx-logo">⚖</span>
          <div><h2>Биржа Каяи</h2><i>{formatDate(world.calendar, date)} · комиссия контор {Math.round(KAYA_FEE * 100)} % · {now.wars} стран воюют</i></div>
        </div>
        <div className="bx-index">
          <span>Индекс Каяи</span>
          <b className={now.index >= prev.index ? 'up' : 'down'}>{now.index}</b>
          <em className={now.index >= prev.index ? 'up' : 'down'}>{now.index >= prev.index ? '▲' : '▼'} {sgn(pct(now.index, prev.index))}</em>
        </div>
        <div className="bx-index-chart"><Chart vals={idxSeries} base={100} w={220} h={44} /></div>
      </div>

      <div className="bx-tape"><div className="bx-tape-in">
        {[...rows, ...rows].map((r, i) => (
          <span key={i} className={r.ch >= 0 ? 'up' : 'down'}><b>{TICKER[r.good]}</b> {num(r.price)} {r.ch >= 0 ? '▲' : '▼'} {sgn(r.ch)}</span>
        ))}
      </div></div>

      <div className="bx-main">
        <div className="bx-table">
          <div className="bx-tr bx-th"><span>Бумага</span><span>Цена</span><span>За месяц</span><span>К норме</span><span>Свеча</span><span>Полгода</span><span>Объём</span></div>
          {rows.map((r) => (
            <button key={r.good} className={`bx-tr${sel === r.good ? ' sel' : ''}`} onClick={() => setSel(r.good)}>
              <span className="bx-name"><i>{GOOD[r.good].icon}</i><b>{TICKER[r.good]}</b><small>{GOOD[r.good].name}</small></span>
              <span className="bx-price">{num(r.price)}</span>
              <span className={r.ch >= 0 ? 'up' : 'down'}>{r.ch >= 0 ? '▲' : '▼'} {sgn(r.ch)}</span>
              <span className={r.norm >= 0 ? 'up dim' : 'down dim'}>{sgn(r.norm)}</span>
              <span><Candle o={r.series[N - 2]} c={r.price} hi={r.hi} lo={r.lo} /></span>
              <span><Chart vals={r.series.slice(-6)} base={r.base} /></span>
              <span className="bx-vol"><i style={{ width: `${(100 * r.volume) / maxVol}%` }} /></span>
            </button>
          ))}
        </div>

        <div className="bx-side">
          <div className="bx-sel-head">
            <span className="bx-big-ico">{GOOD[cur.good].icon}</span>
            <div><h3>{TICKER[cur.good]} · {GOOD[cur.good].name}</h3><i>обычная цена {num(cur.base)} · добыча {cur.supply.toLocaleString('ru-RU')} · спрос {cur.demand.toLocaleString('ru-RU')}</i></div>
            <b className={cur.ch >= 0 ? 'up' : 'down'}>{num(cur.price)}</b>
          </div>
          <Chart vals={cur.series} base={cur.base} w={320} h={110} big />
          {cur.why.length > 0 && <div className="bx-why">{cur.why.map((w2, i) => <span key={i}>{w2}</span>)}</div>}
          <div className="bx-book">
            <div><h4>Продают</h4>{cur.sellers.length ? cur.sellers.map((s) => <div key={s.id} className="bx-book-row sell"><span>{s.name}</span><b>{s.amount.toLocaleString('ru-RU')}</b></div>) : <i className="ew-muted small">никто</i>}</div>
            <div><h4>Покупают</h4>{cur.buyers.length ? cur.buyers.map((s) => <div key={s.id} className="bx-book-row buy"><span>{s.name}</span><b>{Math.abs(s.amount).toLocaleString('ru-RU')}</b></div>) : <i className="ew-muted small">никто</i>}</div>
          </div>
          {deals.length > 0 && (
            <div className="bx-deals"><h4>Сделки</h4>{deals.map((d) => <div key={d.id} className={d.qty > 0 ? 'buy' : 'sell'}><span>{world.states.find((s) => s.id === d.stateId)?.base.name}</span><b>{d.qty > 0 ? 'купила' : 'продала'} {Math.abs(d.qty)}{d.kind === 'contract' ? ` /мес × ${d.months}` : ''}</b><i>по {num(d.price)} · {formatDate(world.calendar, d.date)}</i></div>)}</div>
          )}
          {master && (
            <div className="bx-order">
              <h4>Заявка</h4>
              <select className="ed-select" value={who} onChange={(e) => setWho(e.target.value)}><option value="">— страна —</option>{states.map((s) => <option key={s.id} value={s.id}>{s.base.name}</option>)}</select>
              <div className="bx-seg"><button className={side === 'buy' ? 'on buy' : ''} onClick={() => setSide('buy')}>Купить</button><button className={side === 'sell' ? 'on sell' : ''} onClick={() => setSide('sell')}>Продать</button></div>
              <div className="bx-seg"><button className={kind === 'deal' ? 'on' : ''} onClick={() => setKind('deal')}>Разовая сделка</button><button className={kind === 'contract' ? 'on' : ''} onClick={() => setKind('contract')}>Договор поставки</button></div>
              <label className="bt-field"><span>Количество{kind === 'contract' ? ' в месяц' : ''}</span><input className="dec-text" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} /></label>
              {kind === 'contract' && <label className="bt-field"><span>Месяцев</span><select className="ed-select" value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[1, 2, 3, 5, 10].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>}
              <div className="bx-est">
                <span>{side === 'buy' ? 'Заплатит' : 'Получит'}: <b>{fmtMarks(sum)}</b>{kind === 'contract' ? ' в месяц' : ''}</span>
                <span>Цена сдвинется: <b className={impact >= 1 ? 'up' : 'down'}>×{impact.toFixed(2).replace('.', ',')}</b></span>
                {st && kind === 'deal' && side === 'buy' && cash < sum && <span className="down">В казне только {fmtMarks(cash)}</span>}
                {st && side === 'sell' && <span className={qty > canSell ? 'down' : ''}>Излишек на продажу: {canSell.toLocaleString('ru-RU')}</span>}
              </div>
              <button className="eco-open" disabled={!st || (kind === 'deal' && side === 'buy' && cash < sum) || (side === 'sell' && qty > canSell)} onClick={doTrade}>Провести через конторы Каяи</button>
              {msg && <p className="mil-state">✔ {msg}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="bx-movers">
        <div><h4>▲ Лидеры роста</h4>{movers.slice(0, 5).map((r) => <button key={r.good} onClick={() => setSel(r.good)}><b>{TICKER[r.good]}</b><span>{GOOD[r.good].name}</span><em className="up">{sgn(r.ch)}</em></button>)}</div>
        <div><h4>▼ Лидеры падения</h4>{movers.slice(-5).reverse().map((r) => <button key={r.good} onClick={() => setSel(r.good)}><b>{TICKER[r.good]}</b><span>{GOOD[r.good].name}</span><em className="down">{sgn(r.ch)}</em></button>)}</div>
        <div>
          <h4>⚡ Потрясения</h4>
          {shocks.length === 0 && <i className="ew-muted small">нет</i>}
          {shocks.map((s) => <div key={s.id} className={`bx-shock${s.from <= date && date < s.to ? ' on' : ''}`}><b>{TICKER[s.good]} ×{String(s.mult).replace('.', ',')}</b><span>{s.note}</span><i>до {formatDate(world.calendar, s.to)}</i>{master && <button className="link-btn" onClick={() => mutate((w) => { if (w.market) w.market.shocks = w.market.shocks.filter((x) => x.id !== s.id) })}>×</button>}</div>)}
          {master && (
            <div className="bx-shock-add">
              <select className="ed-select" value={shockMult} onChange={(e) => setShockMult(Number(e.target.value))}>{[0.5, 0.7, 0.85, 1.25, 1.5, 2, 3].map((v) => <option key={v} value={v}>{TICKER[sel]} ×{v}</option>)}</select>
              <select className="ed-select" value={shockDays} onChange={(e) => setShockDays(Number(e.target.value))}>{[50, 100, 200, 500].map((v) => <option key={v} value={v}>{v} дн.</option>)}</select>
              <input className="dec-text" placeholder="неурожай, блокада, новый рудник…" value={shockNote} onChange={(e) => setShockNote(e.target.value)} />
              <button className="mil-go" onClick={() => { mutate((w) => { (w.market ??= { shocks: [] }).shocks.push({ id: `sh${Date.now().toString(36)}`, good: sel, mult: shockMult, from: date, to: date + shockDays, note: shockNote.trim() || (shockMult > 1 ? 'нехватка' : 'избыток') }) }); setShockNote('') }}>Ввести</button>
            </div>
          )}
        </div>
      </div>

      <details className="bx-rules">
        <summary>📖 Как работает рынок и что с ним можно делать</summary>
        <div>
          <p><b>Цена</b> каждого товара считается на дату: сколько его добывают и делают все страны мира и сколько потребляют. Не хватает — дорожает, избыток — дешевеет (в пределах от 0,6 до 1,8 обычной цены).
            Хлеб, рыба и скот дорожают к весне и дешевеют после жатвы. Войны поднимают цены на оружие, коней, порох, железо и ткани. Индекс Каяи — цена всей корзины товаров мира к обычной (100).</p>
          <p><b>Что может игрок</b> (пишет приказом, мастер вносит):</p>
          <ul>
            <li><b>Купить или продать</b> по цене дня через конторы Каяи (комиссия {Math.round(KAYA_FEE * 100)} %). Деньги — сразу из казны или в казну. Купленный хлеб, рыба и скот ложатся в амбары.</li>
            <li><b>Двинуть цену:</b> крупная покупка поднимает цену, сброс — роняет. Влияние сделки тает за месяц. Так можно скупить хлеб перед голодом соседа или обрушить чужое железо.</li>
            <li><b>Договор поставки:</b> столько-то в месяц на N месяцев по сегодняшней цене — строка дохода или расхода в бюджете каждый месяц. Защищает от скачков цены (и лишает выгоды, если цена пошла в твою сторону).</li>
            <li><b>Скупка ради выгоды:</b> купить дёшево после жатвы, продать весной — разница минус комиссия дважды.</li>
            <li><b>Своя добыча:</b> страна с излишком продаёт его соседям и на рынок сама (это уже в «Торговле» её экономики); новые рудники, мануфактуры и мир поднимают предложение.</li>
            <li><b>Война и блокада</b> двигают рынок через потрясения: мастер вводит их на срок (неурожай, блокада порта, сожжённые амбары, открытый рудник).</li>
          </ul>
          <p><b>Ограничения:</b> нельзя продать больше, чем у страны есть излишка (мастер сверяет со «Стаканом» — там видно, кто продаёт и кто покупает); нельзя купить без денег в казне — нужен заём.</p>
        </div>
      </details>
    </div>
  )
}
