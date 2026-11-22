import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { TECH_LINES } from '../tech'
import { TextField } from './ui'
import { EconWindow } from './EconWindow'
import { fmtMarks } from '../economy'
import type { StateFields, WorldState } from '../types'

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))

/** «**Товар** — пояснение. **Ещё** — …» → карточки товаров; остальное — вступление */
function goods(text: string): { intro: string; items: { name: string; text: string }[] } {
  const items: { name: string; text: string }[] = []
  const re = /\*\*([^*]+)\*\*\s*[—–-]?\s*([\s\S]*?)(?=\*\*[^*]+\*\*\s*[—–-]|$)/g
  const first = text.search(/\*\*[^*]+\*\*\s*[—–-]/)
  const intro = first > 0 ? text.slice(0, first).trim() : first < 0 ? text.trim() : ''
  if (first >= 0) for (const m of text.slice(first).matchAll(re)) items.push({ name: m[1].trim(), text: m[2].trim() })
  return { intro, items }
}

function Level({ line, value }: { line: 'money' | 'sea'; value: number }) {
  const l = TECH_LINES.find((x) => x.key === line)!
  return (
    <div className="eco-level">
      <span className="eco-level-name">{l.name}</span>
      <span className="tech-dots">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= value ? 'on' : ''} />)}</span>
      <span className="eco-level-text">{l.levels[value]}</span>
    </div>
  )
}

/**
 * Вкладка «Экономика» карточки страны: товары и доходы (из текста экономики — **Товар** — пояснение),
 * казна и подати, торговля, деньги и банки (уровни «Деньги и торговля» и «Мореходство» из Века Шестерни).
 */
export function EconomyView({ f, set, st }: { f: StateFields; set: (p: Partial<StateFields>) => void; st?: WorldState }) {
  const master = useStore((s) => s.masterMode)
  const [win, setWin] = useState(false)
  const g = goods(f.economy ?? '')
  return (
    <div className="eco">
      {f.econ && (
        <div className="eco-sec eco-top">
          <div className="eco-top-facts">
            <span>Монета: <b>{f.econ.coin.name}</b> (1 = {String(f.econ.coin.perMark).replace('.', ',')} марки)</span>
            <span>Казна: <b>{fmtMarks(f.econ.treasury)}</b></span>
            <span>Сословия: <b>{Object.values(f.econ.estates).join(', ')}</b></span>
          </div>
          {st && <button className="eco-open" onClick={() => setWin(true)}>Открыть окно экономики</button>}
          {win && st && <EconWindow st={st} onClose={() => setWin(false)} />}
        </div>
      )}
      <section className="eco-sec">
        <h3>Товары и доходы</h3>
        {g.intro && <p className="eco-intro">{bold(g.intro)}</p>}
        {g.items.length > 0 ? (
          <div className="eco-goods">
            {g.items.map((it, i) => (
              <div key={i} className="eco-good">
                <b>{it.name}</b>
                <span>{bold(it.text)}</span>
              </div>
            ))}
          </div>
        ) : (
          !g.intro && <p className="eco-empty">Пока не описано.</p>
        )}
        {master && <TextField label="Экономика, ресурсы (**Товар** — пояснение)" multiline rows={6} value={f.economy} onChange={(economy) => set({ economy })} />}
      </section>

      <section className="eco-sec">
        <h3>Казна и подати</h3>
        <TextField label="Казна" value={f.treasury} onChange={(treasury) => set({ treasury })} />
        <TextField label="Подати, налоги и долги" multiline rows={3} value={f.taxes ?? ''} placeholder="Чем платят подданные, кому должна казна" onChange={(taxes) => set({ taxes })} />
      </section>

      <section className="eco-sec">
        <h3>Торговля</h3>
        <TextField label="С кем торгует, что везёт и покупает, торговые пути" multiline rows={4} value={f.trade ?? ''} placeholder="Пока не описано" onChange={(trade) => set({ trade })} />
        {f.tech && <Level line="sea" value={f.tech.levels.sea} />}
      </section>

      <section className="eco-sec">
        <h3>Деньги и банки</h3>
        {f.tech ? <Level line="money" value={f.tech.levels.money} /> : <p className="eco-empty">Уровень не задан — см. «Технологический прогресс».</p>}
        <TextField label="Монета, векселя, банки и меняльные дома" multiline rows={3} value={f.banks ?? ''} placeholder="Пока не описано" onChange={(banks) => set({ banks })} />
      </section>
    </div>
  )
}
