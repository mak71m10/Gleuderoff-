import { useState } from 'react'
import { EconDashboard } from './EconDashboard'
import { EconWindow } from './EconWindow'
import type { WorldState } from '../types'

/**
 * Вкладка «Экономика» карточки страны: экономика на дату хронологии (EconDashboard) и кнопка окна во весь экран.
 * Править экономику мастер может прямо здесь (ставки податей), остальное считает econCalc.ts.
 */
export function EconomyView({ st }: { st?: WorldState }) {
  const [win, setWin] = useState(false)
  if (!st) return null
  return (
    <div className="eco">
      <div className="eco-bar">
        <button className="eco-open" onClick={() => setWin(true)}>Открыть во весь экран</button>
      </div>
      <EconDashboard st={st} />
      {win && <EconWindow st={st} onClose={() => setWin(false)} />}
    </div>
  )
}
