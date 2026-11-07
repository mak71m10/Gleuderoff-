import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type BroodData = NonNullable<Entry['base']['brood']>
type Child = BroodData['broods'][number]['children'][number]

const FATE: Record<string, string> = { killed: 'пал', given: 'отдан жиле', fled: 'бежал', winner: 'пережил Жатву', alive: 'жив' }
const fateText = (c: Child): string => {
  const f = FATE[c.fate] ?? c.fate
  if (!c.female) return f
  return { killed: 'пала', given: 'отдана жиле', fled: 'бежала', winner: 'пережила Жатву', alive: 'жива' }[c.fate] ?? f
}

/**
 * «Выводок и Жатва» Креита: серебряная стена с именами двенадцати детей ярла. Ползунок идёт по шагам Жатвы —
 * кто пал, кто отдан жиле, кто бежал; цвет полосы — этт матери. Последний выживший получает серебряный венец.
 */
export function BroodView({ data, onOpen }: { data: BroodData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const byId = useMemo(() => new Map(world.entries.map((e) => [e.id, e])), [world.entries])
  // по умолчанию — последняя законченная Жатва
  const [bi, setBi] = useState(() => data.broods.map((b, i) => (b.winner ? i : -1)).filter((i) => i >= 0).pop() ?? 0)
  const brood = data.broods[bi]
  const falls = useMemo(() => brood.children.filter((c) => c.at != null && c.fate !== 'winner').sort((a, b) => a.at! - b.at!), [brood])
  const [step, setStep] = useState<number | null>(null)
  const at = step ?? falls.length
  const doneBy = new Map(falls.slice(0, at).map((c) => [c.name + c.born, c]))
  const last = at > 0 ? falls[at - 1] : null
  const ett = (k: string) => data.etts.find((e) => e.key === k)
  const name = (id: string | null): string => (id ? byId.get(id)?.base.name.replace(/ «.*»$/, '').replace(/ (сын|дочь) .*$/, '') ?? '—' : '—')
  const face = (id: string | null, fallback: string, cls: string) => {
    const src = id ? byId.get(id)?.base.image : ''
    return <span className={cls}>{src ? <img src={assetUrl(src)} alt="" /> : fallback[0]}</span>
  }
  const alive = brood.children.length - [...doneBy.values()].length
  const finished = brood.winner && at === falls.length
  const slots = Array.from({ length: Math.max(data.need, brood.children.length) }, (_, i) => brood.children[i] ?? null)

  return (
    <div className="brood">
      <div className="brood-tabs">
        {data.broods.map((b, i) => (
          <button key={b.key} className={i === bi ? 'on' : ''} onClick={() => { setBi(i); setStep(null) }}>{b.title}</button>
        ))}
      </div>
      <div className="brood-head">
        <button className="brood-father" onClick={() => brood.father && onOpen(brood.father)}>
          {face(brood.father, name(brood.father), 'brood-face father')}
          <span>
            <small>{brood.key === 'ingeborg' ? 'Ярл над Жилами' : 'Выводок ярла'}</small>
            <b>{name(brood.father)}</b>
          </span>
        </button>
        <div className="brood-count">
          {brood.winner ? (
            <><b>{finished ? 1 : alive}</b> из {brood.children.length} {finished ? '— Жатва кончена' : 'ещё в Жатве'}</>
          ) : (
            <><b>{brood.children.length}</b> из {data.need} — выводок не полон</>
          )}
        </div>
      </div>
      <div className="brood-wall">
        {slots.map((c, i) => {
          if (!c) return <div key={`empty-${i}`} className="brood-knife empty" title="Ребёнок ещё не родился"><span className="brood-face">·</span><span className="brood-name">—</span></div>
          const done = doneBy.get(c.name + c.born)
          const e = ett(c.ett)
          const state = done ? done.fate : c.fate === 'winner' && finished ? 'winner' : brood.winner ? 'in' : 'alive'
          const isLast = last && last.name === c.name && last.born === c.born
          return (
            <button key={c.name + c.born} className={`brood-knife ${state} ${isLast ? 'last' : ''}`} style={{ ['--ett' as string]: e?.color ?? '#555', ['--ett2' as string]: e?.light ?? '#ccc' }} onClick={() => (c.id && byId.has(c.id) ? onOpen(c.id) : setStep(done ? falls.indexOf(done) + 1 : step))} title={c.note}>
              {face(c.id && byId.has(c.id) ? c.id : null, c.name, 'brood-face')}
              <span className="brood-name">{c.name}</span>
              <span className="brood-born">{c.born} · {e?.name ?? ''}</span>
              <span className="brood-fate">{done ? `${fateText(done)} ${Math.floor(done.at!)}` : state === 'winner' ? 'ярл' : state === 'in' ? 'в Жатве' : 'жив'}</span>
            </button>
          )
        })}
      </div>
      {falls.length > 0 && (
        <>
          <input className="brood-step" type="range" min={0} max={falls.length} value={at} onChange={(e) => setStep(Number(e.target.value))} />
          <div className="brood-event">
            {last ? (
              <>
                <b>{Math.floor(last.at!)}</b> — {last.name} {fateText(last)}
                {last.by && <> от руки <button className="link-btn" onClick={() => onOpen(last.by!)}>{name(last.by)}</button></>}. <span>{last.note}</span>
              </>
            ) : (
              <span className="muted">{brood.title}: Слушающие нарекли двенадцать детей, Жатва начинается.</span>
            )}
          </div>
          <div className="brood-list">
            {falls.map((c, i) => (
              <button key={c.name + c.born} className={`brood-row ${c.fate} ${i + 1 === at ? 'active' : ''}`} onClick={() => setStep(i + 1)}>
                <b>{Math.floor(c.at!)}</b> {c.name} — {fateText(c)}{c.by ? `, ${name(c.by)}` : ''}
              </button>
            ))}
          </div>
        </>
      )}
      {!brood.winner && <div className="brood-event muted">По закону Выводка ярлу нужно двенадцать наречённых детей. Нарекают в семь лет; ненаречённый не считается.</div>}
    </div>
  )
}
