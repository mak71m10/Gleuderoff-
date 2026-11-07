import { useStore } from '../store'
import { assetUrl } from './ui'
import { Icon } from './Icon'

/** Советники при правителе (Совет Десяти графа и т. п.): портрет, имя и должность, клик — карточка */
export function AdvisorsGrid({ advisors, onOpen }: { advisors: { id: string; office: string }[]; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  return (
    <div className="advisors">
      {advisors.map((a) => {
        const m = world.entries.find((x) => x.id === a.id)
        if (!m) return null
        return (
          <button key={a.id} className="tree-node" onClick={() => onOpen(a.id)}>
            <span className="tn-portrait">{m.base.image ? <img src={assetUrl(m.base.image)} alt="" /> : <Icon name="user" size={18} />}</span>
            <span className="tn-name">{m.base.name}</span>
            <span className="tn-years">{a.office}</span>
          </button>
        )
      })}
    </div>
  )
}
