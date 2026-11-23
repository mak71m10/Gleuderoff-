import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { formatDate } from '../calendar'
import { MEASURES } from '../armyLedger'
import { TOPICS, actTitle, decideProfile, forecast, kindWord, type Act, type Decision, type Topic } from '../decisions'
import type { MeasureKind } from '../military'
import type { Role } from '../economy'
import type { WorldState } from '../types'

const TAX_LEVELS = ['лёгкие', 'обычные', 'тяжёлые', 'разорительные']
const LEVELS = ['мир', 'сбор', 'великий сбор', 'всеобщий призыв']
const ROLES: Role[] = ['feeders', 'makers', 'rulers', 'servants', 'learned', 'unfree']

/** внести решение (общая функция: окно решений и «Казна войска») */
export function useProposeDecision(st: WorldState) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const mutate = useStore((s) => s.mutate)
  return (topic: Topic, act: Act, title: string): void => {
    const body = decideProfile(world, st)[topic]
    const d: Decision = { id: `d${Date.now().toString(36)}`, topic, title, act, proposed: date, due: date + body.days, body: body.name, status: 'внесено' }
    const f = forecast(world, st, d, date)
    d.forecast = `${f.word} (${Math.round(f.chance * 100)} %)`
    mutate((w) => { const s = w.states.find((x) => x.id === st.id); if (s) (s.base.decisions ??= []).push(d) })
  }
}

/** Решения власти страны: порядок решений, внести решение с прогнозом, летопись решений */
export function DecisionsView({ st }: { st: WorldState }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const propose = useProposeDecision(st)
  const profile = useMemo(() => decideProfile(world, st), [world, st])
  const mil = st.base.military
  const fName = (id: string): string => mil?.formations.find((f) => f.id === id)?.name ?? id
  const estates = st.base.econ?.estates ?? {}

  const [topic, setTopic] = useState<Topic>('budget')
  const [measure, setMeasure] = useState<MeasureKind>('billet')
  const [scope, setScope] = useState('')
  const [role, setRole] = useState<Role>('feeders')
  const [tax, setTax] = useState('тяжёлые')
  const [level, setLevel] = useState('сбор')
  const [text, setText] = useState('')

  const act: Act | null =
    topic === 'budget' ? { kind: 'measure', measure, scope: measure === 'settle' && mil ? [scope || mil.roots[0]] : undefined }
    : topic === 'audit' ? { kind: 'measure', measure: 'audit' }
    : topic === 'tax' ? { kind: 'tax', role, level: tax }
    : topic === 'levy' ? { kind: 'level', level }
    : text.trim() ? { kind: 'text', text: text.trim() } : null
  const draft: Decision | null = act ? { id: 'draft', topic, title: actTitle(act, st, fName), act, proposed: date, due: date + profile[topic].days, body: profile[topic].name, status: 'внесено' } : null
  const fc = draft ? forecast(world, st, draft, date) : null

  const list = [...(st.base.decisions ?? [])].sort((a, b) => b.proposed - a.proposed)
  const setStatus = (id: string, status: Decision['status']): void => mutate((w) => { const d = w.states.find((x) => x.id === st.id)?.base.decisions?.find((x) => x.id === id); if (d) d.status = status })
  const remove = (id: string): void => mutate((w) => { const s = w.states.find((x) => x.id === st.id); if (s?.base.decisions) s.base.decisions = s.base.decisions.filter((x) => x.id !== id) })
  // указ проходит всегда: бросок решает, будет ли сопротивление
  const roll = (d: Decision): void => {
    const f = forecast(world, st, d, d.due), ok = Math.random() < f.chance
    if (f.decree) mutate((w) => { const x = w.states.find((s) => s.id === st.id)?.base.decisions?.find((y) => y.id === d.id); if (x) { x.status = 'принято'; x.resisted = !ok } })
    else setStatus(d.id, ok ? 'принято' : 'отклонено')
  }

  return (
    <div className="dec">
      <section className="eco-sec">
        <h4 className="ed-h4">Как решает страна</h4>
        <div className="dec-profile">
          {(Object.keys(TOPICS) as Topic[]).map((k) => (
            <div key={k} className="dec-row">
              <span>{TOPICS[k].icon} {TOPICS[k].name}</span>
              <b>{profile[k].name}</b>
              <i>{kindWord(profile[k].kind)} · {profile[k].days} дн.</i>
            </div>
          ))}
        </div>
        <p className="ew-muted">{profile.budget.how}</p>
      </section>

      {master && (
        <section className="eco-sec">
          <h4 className="ed-h4">Внести решение</h4>
          <div className="dec-form">
            <select className="ed-select" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
              {(Object.keys(TOPICS) as Topic[]).map((k) => <option key={k} value={k}>{TOPICS[k].icon} {TOPICS[k].name}</option>)}
            </select>
            {topic === 'budget' && (
              <select className="ed-select" value={measure} onChange={(e) => setMeasure(e.target.value as MeasureKind)}>
                {(Object.keys(MEASURES) as MeasureKind[]).filter((k) => k !== 'audit').map((k) => <option key={k} value={k}>{MEASURES[k].icon} {MEASURES[k].name}</option>)}
              </select>
            )}
            {topic === 'budget' && measure === 'settle' && mil && (
              <select className="ed-select" value={scope || mil.roots[0]} onChange={(e) => setScope(e.target.value)}>
                {mil.formations.filter((f) => f.level !== 'battalion').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            {topic === 'tax' && (
              <>
                <select className="ed-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.filter((r) => estates[r]).map((r) => <option key={r} value={r}>{estates[r]}</option>)}
                </select>
                <select className="ed-select" value={tax} onChange={(e) => setTax(e.target.value)}>
                  {TAX_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </>
            )}
            {topic === 'levy' && (
              <select className="ed-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {(topic === 'rearm' || topic === 'war') && (
              <input className="dec-text" placeholder={topic === 'war' ? 'Объявить войну… / заключить мир…' : 'Ввести в легионах построение каре…'} value={text} onChange={(e) => setText(e.target.value)} />
            )}
          </div>
          {draft && fc && (
            <div className={`dec-fc c${Math.round(fc.chance * 4)}`}>
              <div className="dec-fc-head"><b>{fc.word}</b><span>{Math.round(fc.chance * 100)} %</span></div>
              <div className="dec-fc-bar"><i style={{ width: `${fc.chance * 100}%` }} /></div>
              <div>{fc.text}</div>
              {fc.against.length > 0 && <div className="ew-muted">Против: {fc.against.join(', ')}</div>}
              <div className="ew-muted">Решится {formatDate(world.calendar, draft.due)} и с этого дня вступит в силу.</div>
              <button className="mil-go" onClick={() => { propose(topic, act!, draft.title); setText('') }}>Внести: {draft.title}</button>
            </div>
          )}
        </section>
      )}

      <section className="eco-sec">
        <h4 className="ed-h4">Решения</h4>
        {list.length === 0 && <p className="eco-empty">Решений пока не вносили.</p>}
        {list.map((d) => {
          const waiting = d.status === 'внесено'
          const f = waiting ? forecast(world, st, d, Math.min(date, d.due)) : null
          const live = d.status === 'принято' && d.due <= date
          return (
            <div key={d.id} className={`dec-item s-${d.status === 'принято' ? 'yes' : d.status === 'отклонено' ? 'no' : 'wait'}`}>
              <div className="dec-item-head">
                <span>{TOPICS[d.topic].icon}</span>
                <b>{d.title}</b>
                <em>{d.status}{live ? ' · действует' : d.status === 'принято' ? ' · вступит в силу' : ''}{d.resisted ? ' · встретил сопротивление' : ''}</em>
              </div>
              <div className="ew-muted">
                {d.body} · внесено {formatDate(world.calendar, d.proposed)} · решится {formatDate(world.calendar, d.due)}
                {f ? ` · прогноз: ${f.word} (${Math.round(f.chance * 100)} %)` : d.forecast ? ` · прогноз был: ${d.forecast}` : ''}
              </div>
              {master && (
                <div className="dec-actions">
                  {waiting && <button className="link-btn" onClick={() => setStatus(d.id, 'принято')}>Принять</button>}
                  {waiting && <button className="link-btn" onClick={() => setStatus(d.id, 'отклонено')}>Отклонить</button>}
                  {waiting && <button className="link-btn" onClick={() => roll(d)}>Решить по прогнозу</button>}
                  {!waiting && <button className="link-btn" onClick={() => setStatus(d.id, 'внесено')}>Вернуть на рассмотрение</button>}
                  <button className="link-btn" onClick={() => remove(d.id)}>Убрать</button>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
