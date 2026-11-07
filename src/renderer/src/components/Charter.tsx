import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { resolve } from '../temporal'
import { formatDate } from '../calendar'
import { CoatOfArms, defaultHeraldry } from './Heraldry'
import type { Bill, Legislature } from '../types'

/**
 * Закон, договор, указ или булла собрания — как настоящая грамота: пергамент, герб государства, номер и место,
 * преамбула по роду документа, статьи, итог голосования, подписи и печать (или штамп «Отклонено»).
 * Статьи — из краткого содержания закона; концовки — обычные формулы канцелярии, без новых фактов о мире.
 */
const KIND_TITLE: Record<string, string> = {
  договор: 'Договор', закон: 'Закон', указ: 'Указ', булла: 'Булла', хартия: 'Хартия', резолюция: 'Резолюция', бюджет: 'Роспись доходов и расходов',
  приговор: 'Приговор', требование: 'Требование', декрет: 'Декрет', акт: 'Акт', устав: 'Устав', обвинение: 'Обвинительный акт', стачка: 'Воззвание',
  'тайное решение': 'Тайное решение', тайное: 'Тайное решение', 'выборы канцлера': 'Протокол избрания', выборы: 'Протокол выборов'
}
const ENDINGS: Record<string, string[]> = {
  договор: ['Договор вступает в силу со дня скрепления печатями обеих сторон.', 'Сторона, нарушившая договор, возмещает ущерб в двойном размере.', 'Споры по сему договору разрешает третейский суд из равного числа доверенных лиц.', 'Договор составлен в двух списках равной силы, по одному для каждой стороны.'],
  указ: ['Указ исполнить немедленно и огласить на площадях.', 'Неисполнение карается по всей строгости.'],
  булла: ['Да будет так во славу Дома Света.', 'Оглашать во всех храмах в ближайший праздничный день.'],
  приговор: ['Приговор окончателен и обжалованию не подлежит.', 'Исполнение возлагается на стражу.'],
  'тайное решение': ['Решение в списки не вносится и огласке не подлежит.'],
  default: ['Вступает в силу с первого дня следующего месяца.', 'Исполнение возлагается на канцелярию собрания.', 'Прежние установления, противоречащие сему, отменяются.']
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function Charter({ L, bill: b, number, sponsor, onClose }: { L: Legislature; bill: Bill; number: number; sponsor: string; onClose: () => void }) {
  const world = useStore((s) => s.world!)
  const cal = world.calendar
  const st = world.states.find((s) => s.id === L.stateId)
  const sf = st ? resolve(st, b.date) : null
  const heraldry = sf?.heraldry ?? (st && sf ? defaultHeraldry(st, sf.color) : null)
  const head = L.head ? world.entries.find((e) => e.id === L.head!.entryId) : null
  const kind = KIND_TITLE[b.kind] ?? b.kind[0].toUpperCase() + b.kind.slice(1)
  const place = L.hall ?? L.town ?? ''
  const preamble =
    b.kind === 'договор' ? `Мы, нижеподписавшиеся, действуя от имени ${sf?.fullName || sf?.name || 'государства'} и с ведома ${L.name}, заключили сей договор о нижеследующем:`
    : b.kind === 'указ' || b.kind === 'декрет' ? `${L.chairTitle || 'Глава государства'} по совету ${L.name} повелевает:`
    : b.kind === 'булла' ? 'Святой отец, раб рабов Света, всем верным во всех землях — мир и благословение. Возвещаем:'
    : b.kind === 'приговор' ? `${L.name}, рассмотрев дело по всей справедливости, выносит приговор:`
    : b.kind === 'требование' || b.kind === 'стачка' ? `${L.name} от имени своих членов требует:`
    : `${L.name}, собравшись в заседании, ${b.kind === 'резолюция' ? 'выражает волю' : 'постановляет'}:`
  // статьи: по предложениям краткого содержания, затем обычные концовки канцелярии
  const sentences = b.summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim())
  let h = 0
  for (const ch of b.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0
  const pool = ENDINGS[b.kind] ?? ENDINGS.default
  const endings = pool.filter((_, i) => (h >> i) & 1 || i === 0).slice(0, 2)
  const articles = [...sentences, ...endings]
  const t = b.tally
  const sealColor = sf?.color ?? '#8f2f2f'
  const rejected = b.outcome === 'отклонён'
  const pending = b.outcome === 'отложен'
  return createPortal(
    <div className="charter-wrap" onClick={onClose}>
      <article className={`charter charter-${b.kind === 'булла' ? 'bull' : b.kind === 'договор' ? 'treaty' : 'act'}`} onClick={(e) => e.stopPropagation()}>
        <button className="charter-close" onClick={onClose} title="Закрыть">×</button>
        <header>
          {heraldry && <div className="charter-arms"><CoatOfArms heraldry={heraldry} size={74} /></div>}
          <div className="charter-state">{sf?.fullName || sf?.name}</div>
          <div className="charter-body-name">{L.name}</div>
          <h1>{kind}</h1>
          <div className="charter-no">
            № {number} · {place ? `дано в ${place}, ` : ''}{formatDate(cal, b.date)}
          </div>
          <h2>«{b.title}»</h2>
        </header>
        <p className="charter-preamble">{preamble}</p>
        <ol className="charter-articles">
          {articles.map((a, i) => (
            <li key={i}>
              <b>Статья {ROMAN[i] ?? i + 1}.</b> {a}
            </li>
          ))}
        </ol>
        <div className="charter-vote">
          {t ? (
            <>
              {rejected ? 'Отклонено' : pending ? 'Отложено' : 'Принято'} голосами: за — {t.y}, против — {t.n}, воздержались — {t.a}
              {t.abs ? `, не явились — ${t.abs}` : ''}.
            </>
          ) : (
            <>{rejected ? 'Отклонено' : pending ? 'Отложено' : 'Утверждено'} без голосования.</>
          )}
        </div>
        <footer className="charter-signs">
          <div>
            <span className="charter-ink">{sponsor || '—'}</span>
            <small>внёс</small>
          </div>
          <div>
            <span className="charter-ink">{head?.base.name ?? L.chairTitle}</span>
            <small>{L.head?.title ?? L.chairTitle}</small>
          </div>
        </footer>
        {rejected || pending ? (
          <div className={`charter-stamp ${pending ? 'wait' : ''}`}>{rejected ? 'Отклонено' : 'Отложено'}</div>
        ) : (
          <div className={`charter-seal ${b.kind === 'булла' ? 'lead' : ''}`} style={{ ['--seal' as string]: sealColor }}>
            {heraldry && <CoatOfArms heraldry={heraldry} size={46} />}
          </div>
        )}
        {b.kind === 'договор' && !rejected && <div className="charter-ribbon" style={{ ['--seal' as string]: sealColor }} />}
      </article>
    </div>,
    document.body
  )
}
