import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { resolve } from '../temporal'
import { Button, assetUrl } from './ui'
import { Icon } from './Icon'
import type { CouncilCandidate, SuccessionCouncil } from '../types'

type Round = { round: number; tally: [string, number][]; note: string }

/** Интерактивный совет рода: голоса можно переставить и провести выборы по его правилам. Мир от этого не меняется. */
export function SuccessionCouncilView({ council, onOpen, rules }: { council: SuccessionCouncil; onOpen: (id: string) => void; rules?: ReactNode }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const byId = useMemo(() => new Map(world.entries.map((e) => [e.id, e])), [world.entries])
  const name = (id: string): string => (byId.has(id) ? resolve(byId.get(id)!, date).name : '—')
  const birth = (id: string): number => byId.get(id)?.from ?? 0
  const cand = (id: string): CouncilCandidate | undefined => council.candidates.find((c) => c.id === id)
  const initial = (): Record<string, string> => Object.fromEntries(council.seats.map((s) => [s.id, s.vote]))
  const [votes, setVotes] = useState<Record<string, string>>(initial)
  const [admitted, setAdmitted] = useState<Record<string, boolean>>({})
  const [log, setLog] = useState<Round[] | null>(null)
  const total = council.seats.reduce((s, x) => s + x.weight, 0)
  const need = Math.ceil(total * council.threshold - 1e-9)
  const eligible = (c: CouncilCandidate): boolean => admitted[c.id] ?? c.eligible !== false
  const enough = (id: string, n: number): boolean => n >= need && (!cand(id)?.unanimous || n === total)

  // голос кресла: за своего кандидата, если тот ещё в списке, иначе — за второй выбор
  const tallyOf = (active: Set<string>): [string, number][] => {
    const t = new Map<string, number>([...active].map((id) => [id, 0]))
    for (const seat of council.seats) {
      const v = active.has(votes[seat.id]) ? votes[seat.id] : active.has(seat.second) ? seat.second : ''
      if (v) t.set(v, (t.get(v) ?? 0) + seat.weight)
    }
    return [...t].sort((a, b) => b[1] - a[1])
  }
  const live = new Map(tallyOf(new Set(council.candidates.filter(eligible).map((c) => c.id))))

  const run = (): void => {
    const active = new Set(council.candidates.filter(eligible).map((c) => c.id))
    const out: Round[] = []
    for (let r = 1; r <= council.rounds && active.size; r++) {
      const tally = tallyOf(active)
      const win = tally.find(([id, n]) => enough(id, n))
      if (win) {
        out.push({ round: r, tally, note: `Избран(а): ${name(win[0])} — ${win[1]} из ${total}.` })
        setLog(out)
        return
      }
      const blocked = tally.find(([id, n]) => n >= need && cand(id)?.unanimous)
      const why = blocked ? `${name(blocked[0])} набирает ${blocked[1]}, но нужны все ${total}. ` : `Никто не набрал ${need}. `
      if (r === council.rounds || active.size === 1) {
        out.push({ round: r, tally, note: why })
        break
      }
      // выбывает слабейший; при равенстве — младший
      const weakest = [...tally].sort((a, b) => a[1] - b[1] || birth(b[0]) - birth(a[0]))[0][0]
      active.delete(weakest)
      out.push({ round: r, tally, note: `${why}Выбывает ${name(weakest)}.` })
    }
    if (council.fallback === 'eldest') {
      // старший из всех допущенных, кроме тех, кого можно избрать только единогласно
      const eldest = council.candidates.filter((c) => eligible(c) && !c.unanimous).map((c) => c.id).sort((a, b) => birth(a) - birth(b))[0]
      out.push({ round: 0, tally: [], note: eldest ? `${council.fallbackLabel}: ${name(eldest)}.` : 'Совет расходится без правителя.' })
    }
    setLog(out)
  }

  return (
    <div className="council">
      <div className="field-label">{council.name} — интерактивные выборы</div>
      <p className="hint">
        Переставьте голоса или допустите кандидата и нажмите «Провести выборы». Нужно {need} из {total}. Мир от этого не меняется.
      </p>
      <div className="council-grid">
        <div className="council-seats">
          {council.seats.map((seat) => {
            const holder = byId.get(seat.holderId)
            const f = holder ? resolve(holder, date) : null
            return (
              <div key={seat.id} className="council-seat">
                <button className="cs-who" onClick={() => holder && onOpen(holder.id)}>
                  <span className="tn-portrait">{f?.image ? <img src={assetUrl(f.image)} alt="" /> : <Icon name="user" size={18} />}</span>
                  <span className="cs-text">
                    <span className="cs-name">{f?.name ?? '—'}</span>
                    <span className="cs-role">
                      {seat.role} · {seat.weight === 1 ? '1 голос' : `${seat.weight} голоса`}
                    </span>
                  </span>
                </button>
                <select
                  value={votes[seat.id]}
                  onChange={(e) => {
                    setVotes({ ...votes, [seat.id]: e.target.value })
                    setLog(null)
                  }}
                >
                  <option value="">воздержаться</option>
                  {council.candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {name(c.id)}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
        <div className="council-cands">
          {council.candidates.map((c) => {
            const n = live.get(c.id) ?? 0
            const ok = eligible(c)
            return (
              <div key={c.id} className={`council-cand ${ok ? '' : 'out'}`}>
                <div className="cc-head">
                  <button className="link-btn" onClick={() => onOpen(c.id)}>
                    {name(c.id)}
                  </button>
                  <span className="cc-n">{ok ? `${n} из ${total}` : 'не избирается'}</span>
                </div>
                <div className="cc-bar">
                  <span style={{ width: `${(n / total) * 100}%` }} className={enough(c.id, n) ? 'win' : ''} />
                  <i style={{ left: `${((c.unanimous ? total : need) / total) * 100}%` }} />
                </div>
                <div className="cc-note">{c.note}</div>
                {c.eligible === false && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={ok}
                      onChange={(e) => {
                        setAdmitted({ ...admitted, [c.id]: e.target.checked })
                        setLog(null)
                      }}
                    />{' '}
                    допустить
                  </label>
                )}
              </div>
            )
          })}
          <div className="council-actions">
            <Button icon="balance" variant="primary" onClick={run}>
              Провести выборы
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setVotes(initial())
                setAdmitted({})
                setLog(null)
              }}
            >
              Как сейчас в мире
            </Button>
          </div>
          {log && (
            <ol className="council-log">
              {log.map((l, i) => (
                <li key={i}>
                  {l.round > 0 && <b>Круг {l.round}. </b>}
                  {l.tally.length > 0 && <span className="muted">{l.tally.map(([id, n]) => `${name(id)} — ${n}`).join(', ')}. </span>}
                  {l.note}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {rules && <div className="council-rules">{rules}</div>}
    </div>
  )
}
