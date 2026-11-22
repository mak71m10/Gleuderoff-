import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { GOODS, GOOD, ROLES, fmtMarks, fmtPeople, type Good, type Role } from '../economy'
import { stateReport, FOOD } from '../econCalc'
import type { WorldState } from '../types'

/** сколько продовольствия съедает один человек за ход (месяц): мера кормит 20 человек */
const EAT = 0.05
const round = (v: number): string => Math.round(v).toLocaleString('ru-RU')

const word = (c: number): string => (c >= 75 ? 'довольны' : c >= 60 ? 'спокойны' : c >= 45 ? 'ропщут' : c >= 30 ? 'злы' : 'на грани бунта')

/**
 * Окно экономики страны (во весь экран): главные показатели, сословия с местными названиями, расы,
 * промыслы провинций, области, беды и сильные стороны. Данные — states[].base.econ, adminRegions[].econ,
 * provinces[].res/pop (scripts/econ-seed.mjs). Летопись по годам и бюджет хода появятся с расчётом хода.
 */
export function EconWindow({ st, onClose }: { st: WorldState; onClose: () => void }) {
  const world = useStore((s) => s.world!)
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  const b = st.base, e = b.econ

  const data = useMemo(() => {
    const provs = (world.provinces ?? []).filter((p) => p.owners?.at(-1)?.[1] === st.id)
    const areaIds = [...new Set(provs.map((p) => p.areaId))]
    const areas = areaIds.map((id) => world.adminRegions?.find((a) => a.id === id)).filter((a) => a?.econ) as NonNullable<typeof world.adminRegions>[number][]
    const byRole: Partial<Record<Role, number>> = {}, byRace: Record<string, number> = {}, contentW: Partial<Record<Role, number>> = {}
    let pop = 0, granary = 0
    for (const a of areas) {
      for (const [race, row] of Object.entries(a.econ!.pop)) for (const [r, n] of Object.entries(row) as [Role, number][]) {
        byRole[r] = (byRole[r] ?? 0) + n; byRace[race] = (byRace[race] ?? 0) + n; pop += n
        contentW[r] = (contentW[r] ?? 0) + n * (a.econ!.content[r] ?? 50)
      }
      granary += a.econ!.granary
    }
    const res: Partial<Record<Good, { n: number; rich: number }>> = {}
    for (const p of provs) if (p.res) { const x = (res[p.res.good] ??= { n: 0, rich: 0 }); x.n++; x.rich += p.res.rich }
    const areaRows = areas.map((a) => {
      const ap = provs.filter((p) => p.areaId === a.id)
      const n = Object.values(a.econ!.pop).reduce((s, row) => s + Object.values(row).reduce((x, y) => x + (y ?? 0), 0), 0)
      const cnt: Record<string, number> = {}; for (const p of ap) if (p.res) cnt[p.res.good] = (cnt[p.res.good] ?? 0) + p.res.rich
      const top = Object.entries(cnt).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([g]) => g as Good)
      return { a, n, top, months: a.econ!.granary / Math.max(1, n * EAT) }
    }).sort((x, y) => y.n - x.n)
    const content = Object.fromEntries(Object.entries(contentW).map(([r, w]) => [r, Math.round(w! / Math.max(1, byRole[r as Role] ?? 1))])) as Partial<Record<Role, number>>
    return { pop, granary, byRole, byRace, res, areaRows, content }
  }, [world, st.id])

  const rep = useMemo(() => stateReport(world, st), [world, st])
  if (!e || !rep) return null
  const debt = e.debts.reduce((s, d) => s + d.sum, 0)
  const avgContent = Math.round(Object.entries(data.content).reduce((s, [r, c]) => s + c! * (data.byRole[r as Role] ?? 0), 0) / Math.max(1, data.pop))
  const foodPct = Math.round((100 * rep.food.produced) / Math.max(1, rep.food.need))
  const foodMonths = rep.food.months
  const incomeSum = rep.income.reduce((x, l) => x + l.amount, 0), expenseSum = rep.expense.reduce((x, l) => x + l.amount, 0)
  const balance = GOODS.map((g) => ({ g, made: rep.production[g.key] ?? 0, used: (rep.consumption[g.key] ?? 0) + (FOOD[g.key] ? rep.food.need * (rep.food.kinds.find((k) => k.good === g.key)?.amount ?? 0) / Math.max(1, rep.food.produced) / (FOOD[g.key] ?? 1) : 0) })).filter((x) => x.made > 0.5 || x.used > 0.5)
  const resList = (Object.entries(data.res) as [Good, { n: number; rich: number }][]).sort((x, y) => y[1].rich - x[1].rich)
  const maxRich = Math.max(1, ...resList.map(([, v]) => v.rich))
  const races = Object.entries(data.byRace).sort((x, y) => y[1] - x[1])

  return createPortal(
    <div className="econ-win-back" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="econ-win">
        <header className="ew-head">
          <div>
            <div className="ew-title">Экономика: {b.name}</div>
            <div className="ew-sub">{b.fullName || b.government}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </header>

        <div className="ew-tiles">
          <div className="ew-tile"><span>Население</span><b>{fmtPeople(data.pop)}</b></div>
          <div className="ew-tile"><span>Казна</span><b>{fmtMarks(e.treasury)}</b><i className={rep.net < 0 ? 'neg' : 'pos'}>{rep.net >= 0 ? '+' : ''}{fmtMarks(rep.net)} за ход</i></div>
          <div className={`ew-tile ${foodPct < 100 ? 'bad' : ''}`}><span>Продовольствие</span><b>{foodPct >= 100 ? `хватает (${foodPct} %)` : `своего ${foodPct} %`}</b><i>{foodPct >= 100 ? `запас ${round(rep.food.stock)} мер` : `запаса на ${foodMonths.toFixed(1).replace('.', ',')} хода`}</i></div>
          <div className={`ew-tile ${avgContent < e.threshold + 5 ? 'bad' : ''}`}><span>Довольство</span><b>{avgContent} — {word(avgContent)}</b><i>порог терпения {e.threshold}</i></div>
          <div className="ew-tile"><span>Долг</span><b>{debt ? fmtMarks(debt) : 'нет'}</b></div>
          <div className="ew-tile"><span>Монета</span><b>{e.coin.name}</b><i>1 = {String(e.coin.perMark).replace('.', ',')} марки</i></div>
        </div>

        <div className="ew-grid">
          <section className="ew-sec">
            <h3>Сословия</h3>
            <table className="ew-table">
              <thead><tr><th>В стране зовут</th><th>Роль</th><th>Людей</th><th>Доля</th><th>Довольство</th><th>Подати</th></tr></thead>
              <tbody>
                {ROLES.filter((r) => e.estates[r.key]).map((r) => {
                  const n = data.byRole[r.key] ?? 0, c = data.content[r.key] ?? 0
                  return (
                    <tr key={r.key} title={r.does}>
                      <td><b>{e.estates[r.key]}</b></td>
                      <td className="ew-muted">{r.name}</td>
                      <td>{fmtPeople(n)}</td>
                      <td><div className="ew-bar"><i style={{ width: `${(100 * n) / Math.max(1, data.pop)}%` }} /></div></td>
                      <td className={c < e.threshold ? 'bad' : ''}>{c} · {word(c)}</td>
                      <td>{e.taxes[r.key] ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="ew-sec">
            <h3>Народы</h3>
            {races.map(([race, n]) => (
              <div key={race} className="ew-row">
                <span>{race}</span>
                <div className="ew-bar"><i style={{ width: `${(100 * n) / Math.max(1, data.pop)}%` }} /></div>
                <span className="ew-num">{Math.round((100 * n) / Math.max(1, data.pop))} %</span>
              </div>
            ))}
            <h3 className="ew-h-gap">Беды</h3>
            <ul className="ew-list bad">{e.troubles.map((t, i) => <li key={i}>{t}</li>)}</ul>
            <h3 className="ew-h-gap">Сильные стороны</h3>
            <ul className="ew-list good">{e.strengths.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>

          <section className="ew-sec">
            <h3>Промыслы провинций</h3>
            {resList.map(([g, v]) => (
              <div key={g} className="ew-row" title={`${v.n} провинций, богатство ${v.rich}`}>
                <span>{GOOD[g].icon} {GOOD[g].name}</span>
                <div className="ew-bar gold"><i style={{ width: `${(100 * v.rich) / maxRich}%` }} /></div>
                <span className="ew-num">{v.n} пров.</span>
              </div>
            ))}
          </section>

          <section className="ew-sec">
            <h3>Бюджет хода</h3>
            <div className="ew-budget">
              <div>
                <h4>Доходы · {fmtMarks(incomeSum)}</h4>
                {rep.income.map((l, i) => <div key={i} className="ew-bl" title={l.note}><span>{l.name}</span><b>+{fmtMarks(l.amount)}</b></div>)}
              </div>
              <div>
                <h4>Расходы · {fmtMarks(expenseSum)}</h4>
                {rep.expense.map((l, i) => <div key={i} className="ew-bl" title={l.note}><span>{l.name}</span><b>−{fmtMarks(l.amount)}</b></div>)}
              </div>
            </div>
            <div className={`ew-net ${rep.net < 0 ? 'neg' : 'pos'}`}>Итог хода: {rep.net >= 0 ? '+' : ''}{fmtMarks(rep.net)}{rep.net < 0 && e.treasury > 0 ? ` — казны хватит на ${Math.floor(e.treasury / -rep.net)} ходов` : ''}</div>
          </section>

          <section className="ew-sec">
            <h3>Продовольствие</h3>
            <div className="ew-row"><span>Нужно за ход</span><div /><span className="ew-num">{round(rep.food.need)}</span></div>
            {rep.food.kinds.map((k) => (
              <div key={k.good} className="ew-row"><span>{GOOD[k.good].icon} {GOOD[k.good].name}</span><div className="ew-bar gold"><i style={{ width: `${Math.min(100, (100 * k.amount) / Math.max(1, rep.food.need))}%` }} /></div><span className="ew-num">{round(k.amount)}</span></div>
            ))}
            <div className={`ew-net ${foodPct < 100 ? 'neg' : 'pos'}`}>{foodPct >= 100 ? `Излишек ${round(rep.food.produced - rep.food.need)} мер за ход — на продажу` : `Нехватка ${round(rep.food.need - rep.food.produced)} мер за ход — покупать или голодать`}</div>
            <p className="ew-muted">В амбарах {round(rep.food.stock)} мер. Хлеб приходит с жатвой (Лаций), рыба — круглый год, скот — осенью (Драгос).</p>
            {(e.special ?? []).length > 0 && (
              <>
                <h3 className="ew-h-gap">Особое хозяйство страны</h3>
                <ul className="ew-list">{e.special!.map((sp, i) => <li key={i}><b>{sp.name}</b> — {sp.kind === 'income' ? '+' : '−'}{fmtMarks(sp.amount)} за ход. <span className="ew-muted">{sp.text}</span></li>)}</ul>
              </>
            )}
          </section>

          <section className="ew-sec">
            <h3>Товары за ход</h3>
            <table className="ew-table">
              <thead><tr><th>Товар</th><th>Делают</th><th>Тратят</th><th>Остаток</th></tr></thead>
              <tbody>
                {balance.map(({ g, made, used }) => {
                  const d = made - used
                  return <tr key={g.key}><td>{g.icon} {g.name}</td><td>{round(made)}</td><td>{round(used)}</td><td className={d < 0 ? 'bad' : 'good'}>{d >= 0 ? '+' : ''}{round(d)}</td></tr>
                })}
              </tbody>
            </table>
          </section>

          <section className="ew-sec ew-wide">
            <h3>Области ({data.areaRows.length})</h3>
            <table className="ew-table">
              <thead><tr><th>Область</th><th>Жителей</th><th>Главные промыслы</th><th>Хлеб</th><th>Постройки</th></tr></thead>
              <tbody>
                {data.areaRows.map(({ a, n, top, months }) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b></td>
                    <td>{fmtPeople(n)}</td>
                    <td>{top.map((g) => `${GOOD[g].icon} ${GOOD[g].name}`).join(', ')}</td>
                    <td className={months < 2 ? 'bad' : ''}>на {months.toFixed(1).replace('.', ',')} хода</td>
                    <td className="ew-muted">{a.econ!.buildings.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ew-sec ew-wide">
            <h3>Летопись экономики</h3>
            {e.history.length ? (
              <table className="ew-table">
                <tbody>{e.history.map((h, i) => <tr key={i}><td>{h.year} г.</td><td><b>{h.title}</b></td><td>{fmtPeople(h.pop)}</td><td>{fmtMarks(h.treasury)}</td><td className="ew-muted">{h.note}</td></tr>)}</tbody>
              </table>
            ) : <p className="ew-muted">Летопись с основания страны появится следующим шагом.</p>}
          </section>
        </div>
        <p className="ew-foot ew-muted">Товаров в мире: {GOODS.length}. Цены и рынок Каяи — с расчётом хода.</p>
      </div>
    </div>,
    document.body
  )
}
