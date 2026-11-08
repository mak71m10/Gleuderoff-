import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../store'
import { existsAt, resolve } from '../temporal'
import { formatYear, toParts } from '../calendar'
import { Button, assetUrl } from './ui'
import { Icon } from './Icon'
import { Fullscreen, PanZoom } from './PanZoom'
import type { Entry } from '../types'

const BRANCH = ['#6aaa7a', '#6a90d0', '#c8503a', '#b48ad8', '#e08a3a', '#4fb0b0', '#d06a9a', '#9ab06a', '#c9a24a', '#8a96a8']
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const RULER = /(Король|Королева|Император|Императрица|Герцог|Герцогиня|Граф|Графиня|Князь|Княгиня|Конунг|Ярл|Протектор|Верховный адмирал|Светочедерж|Правител|Папа|Султан|Царь|Хёвдинг|Ярл)/
const SPOUSE_KEYS = ['spouse', 'spouse2', 'spouse3']

type Role = 'blood' | 'spouse' | 'foreign'

/**
 * Родословное древо династии: крупные карточки с портретами, супруги и браки, дети по ветвям (цвет ветви идёт сверху вниз),
 * поколения римскими цифрами, правители помечены короной, потомки дочерей — в соседних домах. Строится из ссылок
 * «отец», «мать», «супруг» (и «супруг 2», «супруг 3») у персонажей.
 */
export function DynastyTree({ dynastyId, onOpen }: { dynastyId: string; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const cal = world.calendar
  const [full, setFull] = useState(false)

  const model = useMemo(() => {
    const chars = world.entries.filter((e) => e.kind === 'character')
    const byId = new Map(chars.map((c) => [c.id, c]))
    const dynNames = new Map(world.entries.filter((e) => e.kind === 'dynasty').map((d) => [d.id, d.base.name]))
    const members = chars.filter((c) => c.base.links.dynasty === dynastyId)
    const inDyn = new Set(members.map((m) => m.id))
    const childMap = new Map<string, Entry[]>()
    const spouseMap = new Map<string, string[]>()
    const addSp = (a: string, b: string): void => { const l = spouseMap.get(a) ?? []; if (!l.includes(b)) { l.push(b); spouseMap.set(a, l) } }
    for (const c of chars) {
      for (const p of [c.base.links.father, c.base.links.mother]) if (p && byId.has(p)) childMap.set(p, [...(childMap.get(p) ?? []), c])
      for (const k of SPOUSE_KEYS) { const s = c.base.links[k]; if (s && byId.has(s)) { addSp(c.id, s); addSp(s, c.id) } }
    }
    const hasParentIn = (m: Entry): boolean => [m.base.links.father, m.base.links.mother].some((p) => p && inDyn.has(p))
    // тот, у кого в династии есть родители, рисуется ребёнком; его супруг — рядом с ним, а не отдельным корнем
    const allRoots = members.filter((m) => !hasParentIn(m) && !(spouseMap.get(m.id) ?? []).some((s) => inDyn.has(s) && hasParentIn(byId.get(s)!)))
    const roots = allRoots.filter((m, i) => {
      const sps = spouseMap.get(m.id) ?? []
      return !allRoots.some((r, j) => j < i && sps.includes(r.id))
    })
    return { byId, dynNames, inDyn, childMap, spouseMap, roots, members, hasParentIn }
  }, [world.entries, dynastyId])

  const { byId, dynNames, inDyn, childMap, spouseMap, roots, members, hasParentIn } = model
  const dyn = world.entries.find((e) => e.id === dynastyId)
  const dynName = dyn?.base.name ?? ''

  const year = (v: number | null | undefined): string => (v != null ? formatYear(cal, toParts(cal, v).year) : '')
  const years = (e: Entry): string => {
    const a = year(e.from) || '?', b = year(e.to)
    return b ? `${a} — ${b}` : `р. ${a}`
  }

  const stats = useMemo(() => {
    const seen = new Set<string>()
    let depth = 0, count = 0, rulers = 0
    const walk = (e: Entry, g: number, foreign: boolean): void => {
      if (seen.has(e.id)) return
      seen.add(e.id); count++; depth = Math.max(depth, g + 1)
      if (RULER.test(e.base.title ?? '')) rulers++
      const spouses = (spouseMap.get(e.id) ?? []).map((id) => byId.get(id)).filter((x): x is Entry => !!x && !seen.has(x.id) && !hasParentIn(x))
      for (const s of spouses) { seen.add(s.id); count++ }
      if (foreign) return
      const kidIds = new Set<string>()
      for (const p of [e, ...spouses]) for (const k of childMap.get(p.id) ?? []) kidIds.add(k.id)
      for (const kid of kidIds) { const k = byId.get(kid)!; if (inDyn.has(k.id) || inDyn.has(k.base.links.father ?? '') || inDyn.has(k.base.links.mother ?? '')) walk(k, g + 1, !inDyn.has(k.id)) }
    }
    for (const r of roots) walk(r, 0, false)
    return { count, depth, rulers }
  }, [roots, spouseMap, childMap, byId, inDyn])

  const span = useMemo(() => {
    const xs = members.map((m) => m.from).filter((v): v is number => v != null)
    const ys = members.map((m) => m.to ?? m.from).filter((v): v is number => v != null)
    return xs.length ? `${year(Math.min(...xs))} — ${year(Math.max(...ys))}` : ''
  }, [members]) // eslint-disable-line react-hooks/exhaustive-deps

  const Card = ({ e, role, gen, color, tag }: { e: Entry; role: Role; gen: number; color: string; tag?: string }): ReactNode => {
    const f = resolve(e, date)
    const house = role !== 'blood' && e.base.links.dynasty ? dynNames.get(e.base.links.dynasty) : ''
    const ruler = RULER.test(f.title ?? '')
    const dead = !existsAt(e, date)
    return (
      <button className={`ft-card ${role} ${ruler ? 'ruler' : ''} ${dead ? 'dead' : ''} ${f.props?.gender === 'Женский' ? 'fem' : ''}`} style={{ ['--bc' as string]: color } as CSSProperties} onClick={() => onOpen(e.id)}>
        <span className="ft-gen">{ROMAN[Math.min(gen, ROMAN.length - 1)]}</span>
        {ruler && <span className="ft-crown" title="Правитель">♛</span>}
        <span className="ft-portrait">{f.image ? <img src={assetUrl(f.image)} alt="" /> : <Icon name="user" size={30} />}</span>
        <span className="ft-name">{f.name}</span>
        <span className="ft-years">{years(e)}</span>
        {f.title && <span className="ft-title">{f.title}</span>}
        {house && <span className="ft-house">{house}</span>}
        {tag && <span className="ft-tag">{tag}</span>}
      </button>
    )
  }

  const render = (e: Entry, gen: number, color: string, seen: Set<string>, role: Role, branchOf: (i: number) => string, top: boolean, tag?: string): ReactNode => {
    if (seen.has(e.id)) return null
    seen.add(e.id)
    const spouses = (spouseMap.get(e.id) ?? []).map((id) => byId.get(id)).filter((x): x is Entry => !!x && !seen.has(x.id) && !hasParentIn(x))
    for (const s of spouses) seen.add(s.id)
    // дети обоих родителей, по рождению; потомки дочерей показываются лишь на одно колено
    const kidSet = new Map<string, Entry>()
    for (const p of [e, ...spouses]) for (const k of childMap.get(p.id) ?? []) kidSet.set(k.id, k)
    const female = e.base.props?.gender === 'Женский'
    const kids = role === 'foreign' ? [] : [...kidSet.values()].filter((k) => !seen.has(k.id) && (inDyn.has(k.id) || !female || inDyn.has(k.base.links.mother ?? '') || inDyn.has(k.base.links.father ?? ''))).sort((a, b) => (a.from ?? 0) - (b.from ?? 0))
    const multi = spouses.length > 1
    return (
      <li key={e.id} style={{ ['--bc' as string]: color } as CSSProperties}>
        <div className="ft-couple">
          <Card e={e} role={role} gen={gen} color={color} tag={tag} />
          {spouses.map((s) => (
            <span key={s.id} className="ft-with">
              <span className="ft-ring">⚭</span>
              <Card e={s} role="spouse" gen={gen} color={color} />
            </span>
          ))}
        </div>
        {kids.length > 0 && (
          <ul>
            {kids.map((k, i) => {
              const kid = inDyn.has(k.id) ? 'blood' : 'foreign'
              const parentTag = multi ? (() => { const m = byId.get(k.base.links.mother ?? '') ?? byId.get(k.base.links.father ?? ''); return m && m.id !== e.id ? `от ${resolve(m, date).name.split(' ')[0]}` : undefined })() : undefined
              return render(k, gen + 1, top ? branchOf(i) : color, seen, kid, branchOf, false, parentTag)
            })}
          </ul>
        )}
      </li>
    )
  }

  const tree = (): ReactNode => {
    const seen = new Set<string>()
    const branchOf = (i: number): string => BRANCH[i % BRANCH.length]
    return <ul className="ftree">{roots.map((r) => render(r, 0, '#d8b84a', seen, 'blood', branchOf, true))}</ul>
  }

  // легенда ветвей: дети корня
  const legend = useMemo(() => {
    const out: { name: string; color: string }[] = []
    for (const r of roots.slice(0, 1)) {
      const kidSet = new Map<string, Entry>()
      for (const p of [r, ...(spouseMap.get(r.id) ?? []).map((id) => byId.get(id)).filter((x): x is Entry => !!x && !hasParentIn(x))]) for (const k of childMap.get(p.id) ?? []) kidSet.set(k.id, k)
      ;[...kidSet.values()].sort((a, b) => (a.from ?? 0) - (b.from ?? 0)).forEach((k, i) => { if (inDyn.has(k.id) || inDyn.has(k.base.links.mother ?? '')) out.push({ name: k.base.name.split(' ')[0], color: BRANCH[i % BRANCH.length] }) })
    }
    return out
  }, [roots, spouseMap, childMap, byId, inDyn])

  return (
    <div className="dynasty-tree">
      <div className="tree-head">
        <div className="field-label">Родословное древо</div>
        {roots.length > 0 && <Button icon="tree" variant="ghost" onClick={() => setFull(true)}>На весь экран</Button>}
      </div>
      {roots.length ? (
        <>
          <div className="ft-stats">
            <span><b>{stats.count}</b> человек</span>
            <span><b>{stats.depth}</b> {stats.depth === 1 ? 'поколение' : stats.depth < 5 ? 'поколения' : 'поколений'}</span>
            {stats.rulers > 0 && <span><b>{stats.rulers}</b> правителей</span>}
            {span && <span>{span}</span>}
            {legend.length > 1 && <span className="ft-legend">{legend.map((l) => <em key={l.name}><i style={{ background: l.color }} />ветвь {l.name}</em>)}</span>}
          </div>
          <p className="hint">Тяните мышью, приближайте колесом с Ctrl или кнопками справа. ♛ — правитель, ⚭ — брак; цвет линии — ветвь.</p>
          <PanZoom inline resetKey={dynastyId}>{tree()}</PanZoom>
          {full && <Fullscreen title={`Родословное древо — ${dynName}`} onClose={() => setFull(false)}><PanZoom resetKey={dynastyId}>{tree()}</PanZoom></Fullscreen>}
        </>
      ) : (
        <p className="hint">Укажите у персонажей эту династию, а также отца и мать, и древо построится само.</p>
      )}
    </div>
  )
}
