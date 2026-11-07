// Простая разметка текста мира (описания, законы, экономика…): общая для кодекса, карточки государства и всех многострочных полей
import type { ReactNode } from 'react'
import type { WorldData } from '../types'

/** Простая разметка: # и ## заголовки, абзацы, списки «- », **жирный**, [[ссылка]] и [[ссылка|текст]] */
export function renderBody(body: string, world: WorldData, goto: (id: string) => void): ReactNode {
  const byName = new Map(world.entries.map((e) => [e.base.name.toLowerCase(), e.id]))
  const inline = (text: string, key: string): ReactNode[] =>
    text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith('[[')) {
        const [target, label] = part.slice(2, -2).split('|')
        const eid = byName.get(target.trim().toLowerCase())
        return eid ? (
          <button key={key + i} className="wiki-link" onClick={() => goto(eid)}>
            {label ?? target}
          </button>
        ) : (
          <span key={key + i} className="wiki-link missing" title="Запись не найдена">
            {label ?? target}
          </span>
        )
      }
      if (part.startsWith('**')) return <b key={key + i}>{part.slice(2, -2)}</b>
      return part
    })
  return body.split(/\n\s*\n/).flatMap((block, i) => {
    const lines = block.trim().split('\n')
    const out: ReactNode[] = []
    let list: string[] = []
    const flush = (k: string): void => {
      if (list.length) out.push(<ul key={k}>{list.map((l, j) => <li key={j}>{inline(l, `${k}-${j}`)}</li>)}</ul>)
      list = []
    }
    let para: string[] = []
    const flushPara = (k: string): void => {
      if (para.length) out.push(<p key={k}>{inline(para.join(' '), k)}</p>)
      para = []
    }
    lines.forEach((raw, j) => {
      const t = raw.trim()
      const k = `${i}-${j}`
      if (t.startsWith('- ')) {
        flushPara(`p${k}`)
        list.push(t.slice(2))
        return
      }
      flush(`l${k}`)
      if (t.startsWith('## ')) {
        flushPara(`p${k}`)
        out.push(<h3 key={k}>{inline(t.slice(3), k)}</h3>)
      } else if (t.startsWith('# ')) {
        flushPara(`p${k}`)
        out.push(<h2 key={k}>{inline(t.slice(2), k)}</h2>)
      } else if (t) {
        // строка, начатая с **жирного** («**Право круга** — …»), — отдельный пункт, а не продолжение абзаца
        if (t.startsWith('**')) flushPara(`p${k}`)
        para.push(t)
      }
    })
    flush(`l${i}-end`)
    flushPara(`p${i}-end`)
    return out
  })
}

