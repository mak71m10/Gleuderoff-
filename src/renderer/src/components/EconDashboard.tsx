import { useMemo } from 'react'
import { useStore } from '../store'
import { GOOD, GOODS, ROLES, fmtMarks, fmtPeople, type Role } from '../economy'
import { SEASONS, TAX_MULT, foodByMonth, stateReport } from '../econCalc'
import { TECH_LINES } from '../tech'
import { decreeAt, taxesAt } from '../decisions'
import { formatDate } from '../calendar'
import type { WorldState } from '../types'

const round = (v: number): string => Math.round(v).toLocaleString('ru-RU')
const word = (c: number): string => (c >= 75 ? 'довольны' : c >= 60 ? 'спокойны' : c >= 45 ? 'ропщут' : c >= 30 ? 'злы' : 'на грани бунта')
const BY: Record<string, string> = { 'суша': '⛰ по суше', 'море': '⚓ морем', 'рынок Каяи': '⚖ через конторы Каяи' }
const KIND_ICON: Record<string, string> = { war: '⚔', raid: '🔥', unrest: '✊', disaster: '☠', boom: '⚒', deal: '🤝' }
const LEVELS = Object.keys(TAX_MULT)

/**
 * Экономика страны на дату хронологии: всё считается заново при смене месяца (econCalc.ts).
 * full — во весь экран (окно), иначе — во вкладке карточки.
 */
export function EconDashboard({ st, full }: { st: WorldState; full?: boolean }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const r = useMemo(() => stateReport(world, st, date), [world, st, date])
  const e = st.base.econ
  const taxNow = useMemo(() => taxesAt(st, date), [st, date])
  // продовольствие по месяцам этого года
  const months = useMemo(() => foodByMonth(world, st, date), [world, st, date])
  if (!e || !r) return <p className="ew-muted">На эту дату у страны нет земли — экономики нет.</p>

  const setTax = (role: Role, level: string): void =>
    mutate((w) => { const s = w.states.find((x) => x.id === st.id); if (s?.base.econ) decreeAt(s, { kind: 'tax', role, level }, date) })
  const incomeSum = r.income.reduce((x, l) => x + l.amount, 0), expenseSum = r.expense.reduce((x, l) => x + l.amount, 0)
  const avgContent = Math.round(Object.entries(r.content).reduce((s, [k, c]) => s + c! * (r.byRole[k as Role] ?? 0), 0) / Math.max(1, r.pop))
  const debt = e.debts.reduce((s, d) => s + d.sum, 0)
  const owedToUs = world.states.flatMap((s) => (s.base.econ?.debts ?? []).filter((d) => d.to === st.base.name).map((d) => ({ who: s.base.name, ...d })))
  const turnover = r.trade.reduce((s, p) => s + p.value, 0)
  const maxTrade = Math.max(1, ...r.trade.map((p) => p.value))
  const roleTax = (role: Role): number => r.income.find((l) => l.name === `Подати: ${e.estates[role]}`)?.amount ?? 0
  const balance = GOODS.map((g) => ({ g, made: r.production[g.key] ?? 0, used: r.consumption[g.key] ?? 0 })).filter((x) => x.made > 0.5 || x.used > 0.5).sort((a, b) => (b.made - b.used) * b.g.price - (a.made - a.used) * a.g.price)
  const banks = (world.adminRegions ?? []).filter((a) => a.econ?.buildings.includes('банк') && (world.provinces ?? []).some((p) => p.areaId === a.id && p.owners?.at(-1)?.[1] === st.id)).map((a) => a.name)
  const money = st.base.tech?.levels.money ?? 0
  const races = Object.entries(r.byRace).sort((a, b) => b[1] - a[1])

  return (
    <div className={`ed ${full ? 'ed-full' : ''}`}>
      <div className="ed-when">
        <b>{r.season.name} {r.year} г.</b> — {r.season.season}. <span className="ew-muted">{r.season.note}</span>
      </div>

      <div className="ew-tiles">
        <div className="ew-tile"><span>Население</span><b>{fmtPeople(r.pop)}</b><i>{r.provinces} провинций, {r.areas} областей</i></div>
        <div className="ew-tile"><span>Казна</span><b>{fmtMarks(r.treasury)}</b><i className={r.net < 0 ? 'neg' : 'pos'}>{r.net >= 0 ? '+' : ''}{fmtMarks(r.net)} за ход</i></div>
        <div className={`ew-tile ${r.food.yearPct < 100 ? 'bad' : ''}`}><span>Продовольствие за год</span><b>{r.food.yearPct >= 100 ? `хватает (${r.food.yearPct} %)` : `своего ${r.food.yearPct} %`}</b><i>в амбарах {round(r.food.stock)} мер</i></div>
        <div className={`ew-tile ${avgContent < e.threshold + 5 ? 'bad' : ''}`}><span>Довольство</span><b>{avgContent} — {word(avgContent)}</b><i>порог терпения {e.threshold}</i></div>
        <div className={`ew-tile ${debt ? 'bad' : ''}`}><span>Долг</span><b>{debt ? fmtMarks(debt) : 'нет'}</b><i>{e.debts.length ? `${e.debts.length} долговых печатей` : 'никому не должна'}</i></div>
        <div className="ew-tile"><span>Монета</span><b>{e.coin.name}</b><i>1 = {String(e.coin.perMark).replace('.', ',')} марки</i></div>
      </div>

      {r.events.length > 0 && (
        <div className="ed-events">
          {r.events.slice(0, 5).map((ev) => (
            <span key={ev.id} className={`ed-ev ed-ev-${ev.kind}`} title={ev.age > 0 ? `началось в ${ev.year} г., след ещё виден` : 'идёт сейчас'}>
              {KIND_ICON[ev.kind]} {ev.word}: {ev.name}{ev.age > 0 ? ` (${ev.year})` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="ed-grid">
        <section className="ew-sec">
          <h3>Бюджет хода</h3>
          <div className="ew-budget">
            <div>
              <h4>Доходы · {fmtMarks(incomeSum)}</h4>
              {r.income.map((l, i) => <div key={i} className="ew-bl" title={l.note}><span>{l.name}</span><b>+{fmtMarks(l.amount)}</b></div>)}
            </div>
            <div>
              <h4>Расходы · {fmtMarks(expenseSum)}</h4>
              {r.expense.map((l, i) => <div key={i} className="ew-bl" title={l.note}><span>{l.name}</span><b>−{fmtMarks(l.amount)}</b></div>)}
            </div>
          </div>
          <div className={`ew-net ${r.net < 0 ? 'neg' : 'pos'}`}>Итог хода: {r.net >= 0 ? '+' : ''}{fmtMarks(r.net)}{r.net < 0 && r.treasury > 0 ? ` — казны хватит на ${Math.floor(r.treasury / -r.net)} ходов` : ''}</div>
        </section>

        {(e.journal?.length ?? 0) > 0 && (
          <section className="ew-sec">
            <h3>Журнал казны</h3>
            <p className="ew-muted small">Начальная казна {fmtMarks(e.treasury)} + записи до этой даты: итоги ходов, сделки, займы, набор.</p>
            {e.journal!.filter((x) => x.date <= date).slice(-12).reverse().map((x, i) => <div key={i} className="ew-bl"><span>{formatDate(world.calendar, x.date)} · {x.note}</span><b className={x.amount < 0 ? 'neg' : 'pos'}>{x.amount >= 0 ? '+' : ''}{fmtMarks(x.amount)}</b></div>)}
          </section>
        )}

        <section className="ew-sec">
          <h3>Сословия и подати</h3>
          <table className="ew-table">
            <thead><tr><th>Сословие</th><th>Людей</th><th>Подати</th><th>Дают</th><th>Довольство</th></tr></thead>
            <tbody>
              {ROLES.filter((x) => e.estates[x.key] && r.byRole[x.key]).map((x) => {
                const c = r.content[x.key] ?? 50
                return (
                  <tr key={x.key} title={x.does}>
                    <td><b>{e.estates[x.key]}</b><div className="ew-muted small">{x.name}</div></td>
                    <td>{fmtPeople(r.byRole[x.key]!)}</td>
                    <td>{master ? <select className="ed-select" value={taxNow[x.key] ?? 'обычные'} title="С этой даты (распоряжением; прошлое не меняется)" onChange={(ev) => setTax(x.key, ev.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select> : taxNow[x.key] ?? 'обычные'}</td>
                    <td>{roleTax(x.key) ? `+${fmtMarks(roleTax(x.key))}` : '—'}</td>
                    <td className={c < e.threshold ? 'bad' : ''}><div className="ed-content"><i style={{ width: `${c}%` }} className={c < e.threshold ? 'bad' : ''} /><em style={{ left: `${e.threshold}%` }} /></div>{c} · {word(c)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {master && <p className="ew-muted small">Тяжёлые подати дают больше денег, но снижают довольство; ниже порога два хода подряд — волнение.</p>}
        </section>

        <section className="ew-sec ed-trade">
          <h3>Торговля · оборот {fmtMarks(turnover)} за ход</h3>
          {r.trade.length ? r.trade.map((p) => (
            <div key={p.id} className="ed-tp">
              <div className="ed-tp-head">
                <span className="swatch" style={{ background: p.color }} />
                <b>{p.name}</b>
                <span className="ew-muted small">{BY[p.by]}</span>
                <span className="ed-tp-val">{fmtMarks(p.value)}</span>
              </div>
              <div className="ew-bar gold"><i style={{ width: `${(100 * p.value) / maxTrade}%` }} /></div>
              <div className="ed-tp-goods">
                {p.exports.length > 0 && <span className="out">→ {p.exports.map((x) => `${GOOD[x.good].icon} ${GOOD[x.good].name.toLowerCase()} ${round(x.amount)}`).join(', ')}</span>}
                {p.imports.length > 0 && <span className="in">← {p.imports.map((x) => `${GOOD[x.good].icon} ${GOOD[x.good].name.toLowerCase()} ${round(x.amount)}`).join(', ')}</span>}
              </div>
            </div>
          )) : <p className="ew-muted">Торгует только на местных ярмарках.</p>}
          <p className="ew-muted small">→ вывоз, ← ввоз, в мерах за ход. Пошлины с оборота — в бюджете.</p>
        </section>

        <section className="ew-sec">
          <h3>Деньги и банки</h3>
          <div className="ed-coin">
            <div className="ed-coin-face">🪙</div>
            <div>
              <b>{e.coin.name}</b>
              <div className="ew-muted small">1 {e.coin.name} = {String(e.coin.perMark).replace('.', ',')} имперской марки · 1 марка = 20 серебряников = 240 медяков</div>
            </div>
          </div>
          <div className="eco-level"><span className="eco-level-name">Деньги и торговля</span><span className="tech-dots">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= money ? 'on' : ''} />)}</span><span className="eco-level-text">{TECH_LINES.find((l) => l.key === 'money')!.levels[money]}</span></div>
          {banks.length > 0 && <p className="small">Банки и меняльные дома: {banks.join(', ')}.</p>}
          <h4 className="ed-h4">Долговые печати страны</h4>
          {e.debts.length ? e.debts.map((d, i) => (
            <div key={i} className="ed-seal"><span>⚫ {d.to}</span><b>{fmtMarks(d.sum)}</b><span className="ew-muted small">{(d.rate * 100).toFixed(1).replace('.', ',')} % за ход · срок {d.due} г.</span></div>
          )) : <p className="ew-muted small">Страна никому не должна.</p>}
          {owedToUs.length > 0 && (
            <>
              <h4 className="ed-h4">Должны стране</h4>
              {owedToUs.map((d, i) => <div key={i} className="ed-seal good"><span>⚪ {d.who}</span><b>{fmtMarks(d.sum)}</b><span className="ew-muted small">{(d.rate * 100).toFixed(1).replace('.', ',')} % за ход · срок {d.due} г.</span></div>)}
            </>
          )}
        </section>

        <section className="ew-sec">
          <h3>Продовольствие по месяцам</h3>
          <div className="ed-months">
            {SEASONS.map((s, m) => (
              <div key={s.name} className={`ed-month ${m === r.month ? 'cur' : ''}`}>
                <div className="ed-month-bar"><i style={{ height: `${Math.min(100, months[m] / 3)}%` }} className={months[m] < 100 ? 'low' : ''} /></div>
                <b>{s.name}</b><span>{months[m]} %</span>
              </div>
            ))}
          </div>
          <p className="ew-muted small">Свой выпуск еды за месяц к нужде. Зимой и весной едят из амбаров, в Лаций — урожай года.</p>
          {r.food.kinds.map((k) => <div key={k.good} className="ew-row"><span>{GOOD[k.good].icon} {GOOD[k.good].name}</span><div className="ew-bar gold"><i style={{ width: `${Math.min(100, (100 * k.amount) / Math.max(1, r.food.need))}%` }} /></div><span className="ew-num">{round(k.amount)}</span></div>)}
        </section>

        <section className="ew-sec">
          <h3>Товары за ход</h3>
          <table className="ew-table">
            <thead><tr><th>Товар</th><th>Делают</th><th>Тратят</th><th>Остаток</th></tr></thead>
            <tbody>{balance.slice(0, full ? 30 : 12).map(({ g, made, used }) => { const d = made - used; return <tr key={g.key}><td>{g.icon} {g.name}</td><td>{round(made)}</td><td>{round(used)}</td><td className={d < 0 ? 'bad' : 'good'}>{d >= 0 ? '+' : ''}{round(d)}</td></tr> })}</tbody>
          </table>
        </section>

        <section className="ew-sec">
          <h3>Народы</h3>
          {races.slice(0, 8).map(([race, n]) => <div key={race} className="ew-row"><span>{race}</span><div className="ew-bar"><i style={{ width: `${(100 * n) / Math.max(1, r.pop)}%` }} /></div><span className="ew-num">{Math.round((100 * n) / Math.max(1, r.pop))} %</span></div>)}
          <h3 className="ew-h-gap">Беды</h3>
          <ul className="ew-list bad">{e.troubles.map((t, i) => <li key={i}>{t}</li>)}</ul>
          <h3 className="ew-h-gap">Сильные стороны</h3>
          <ul className="ew-list good">{e.strengths.map((t, i) => <li key={i}>{t}</li>)}</ul>
          {(e.special ?? []).length > 0 && (
            <>
              <h3 className="ew-h-gap">Особое хозяйство</h3>
              <ul className="ew-list">{e.special!.map((sp, i) => <li key={i}><b>{sp.name}</b> — {sp.kind === 'income' ? '+' : '−'}{fmtMarks(sp.amount)} за ход. <span className="ew-muted">{sp.text}</span></li>)}</ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
