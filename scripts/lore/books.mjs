// Книги, собранные из лора мира Gleuderoff (весь мир, не только Лора): этнографический атлас народов, гербовник великих домов, хроника гражданской войны
// и путеводитель по землям. Текст берётся из уже написанных записей (описания, свойства, события) — без тайн мастера
// и без новых фактов; от составителя — только короткие вступления. Оформление и иллюстрации — src/renderer/src/books.ts.
// Вызывается в конце scripts/seed-lore.mjs, когда все записи уже собраны.
const strip = (t) => String(t ?? '').replace(/\n*_черновик_\s*$/g, '').replace(/\n*_[^_\n]*черновик[^_\n]*_\s*$/g, '').trim()
const year = (d) => (d == null ? null : Math.floor(d / 500) + 1)

const PEOPLE_GROUPS = [
  ['Глава I. Люди', ['Люди', 'Имперцы', 'Гладры', 'Норды', 'Ярмолы', 'Нарги', 'Дукулиты', 'Гордолы', 'Юты', 'Синти и Рома', 'Момиты', 'Фьяли', 'Зиггауцы', 'Эшландцы', 'Веринцы', 'Беглецы из-за перевалов', 'Цепной народ', 'Кальтранцы', 'Ционы']],
  ['Глава II. Подгорные и лесные народы', ['Дварфы', 'Дварфы доков', 'Гномы', 'Эльфы', 'Высшие эльфы', 'Лесные эльфы', 'Тёмные эльфы', 'Сребролистые', 'Сильва', 'Элеоны', 'Элуины']],
  ['Глава III. Дети тени и огня', ['Далорианцы', 'Тифлинги', 'Демоны', 'Вампиры', 'Скугга', 'Рейг-Зироги', 'Нежить', 'Древние']],
  ['Глава IV. Великаны, звери и диковины', ['Голиафы', 'Орки', 'Северные орки', 'Огры', 'Тролли', 'Ологи', 'Гремлины', 'Драконорождённые', 'Людоящеры', 'Табакси', 'Ааракокры', 'Хуманцацеры', 'Илутсы', 'Мироны', 'Феи']]
]

export default function books({ E, entries, world }) {
  const lore = (kind) => entries.filter((e) => e.kind === kind)

  // ---------- Народы Лоры ----------
  {
    const people = lore('people')
    const byName = new Map(people.map((e) => [e.base.name, e]))
    const used = new Set()
    const card = (e) => {
      used.add(e.base.name)
      const p = e.base.props ?? {}
      const lines = [`## ${e.base.name}`]
      if (e.base.title) lines.push(`*${e.base.title}*`)
      if (e.base.summary) lines.push(e.base.summary)
      if (p.stats) lines.push(`**Сложение.** ${p.stats}`)
      if (p.features) lines.push(`**Приметы.** ${p.features}`)
      const body = strip(e.base.body)
      if (body && body !== e.base.summary) lines.push(body.replace(/^#+ /gm, '**').replace(/^(\*\*[^*\n]+)$/gm, '$1**'))
      return lines.join('\n\n')
    }
    const parts = ['Этот атлас составлен для писцов, послов и купцов, которым по долгу службы приходится иметь дело со всеми народами мира — от Лоры до Лизы, Эльзы и островов. Здесь собрано то, что известно о каждом народе: каков он с виду, чем живёт и где его искать. Писцы старались не прибавлять ничего от себя.']
    for (const [title, names] of PEOPLE_GROUPS) {
      const list = names.map((n) => byName.get(n)).filter(Boolean)
      if (!list.length) continue
      parts.push(`# ${title}`, ...list.map(card))
    }
    const rest = people.filter((e) => !used.has(e.base.name))
    if (rest.length) parts.push('# Глава V. Прочие народы', ...rest.map(card))
    E('book-peoples', 'note', 'Народы Gleuderoff', {
      title: 'Этнографический атлас для писцов и послов', summary: `Все ${people.length} народов, о которых знают в мире: облик, обычаи, места обитания.`,
      body: parts.join('\n\n'), tags: ['книги', 'народы']
    })
  }

  // ---------- Гербовник великих домов ----------
  {
    const houses = lore('dynasty').filter((e) => e.base.tags.includes('Великие дома'))
    const parts = ['Великие дома Империи — опора трона и его соперники. В этом гербовнике для каждого дома записаны щит, девиз, чью сторону он держал в гражданской войне и что о нём говорят. Порядок — тот, в каком дома записаны в списках Верховного совета.', '# Гербы и девизы']
    for (const h of houses) {
      const p = h.base.props ?? {}
      const lines = [`## ${h.base.name}`]
      if (h.base.title) lines.push(`*${h.base.title}*`)
      if (p.arms && !/\*\*Герб\.\*\*/.test(h.base.body ?? '')) lines.push(`**Герб.** ${p.arms}`)
      if (p.motto && !/\*\*Девиз\.\*\*/.test(h.base.body ?? '')) lines.push(`**Девиз.** ${p.motto}`)
      if (p.side) lines.push(`**В войну 975–980 гг.** ${p.side}`)
      lines.push(strip(h.base.body).replace(/^## /gm, '**').replace(/^(\*\*[^*\n]+)$/gm, '$1.**'))
      parts.push(lines.join('\n\n'))
    }
    // великие кланы Севера — отдельной главой: у них не дома, а кланы, и в войну 975–980 гг. они восставали против всех
    const clans = lore('dynasty').filter((e) => e.base.tags.includes('кланы'))
    if (clans.length) {
      parts.push('# Великие кланы Севера', 'На севере нет великих домов: есть девять великих кланов, и каждый держит свою землю и свой город. Их щиты — северный крест на поле цвета клана.')
      for (const h of clans) parts.push([`## ${h.base.name}`, h.base.title ? `*${h.base.title}*` : '', `**Герб.** ${h.base.props?.arms ?? ''}`, strip(h.base.body).replace(/^## /gm, '**').replace(/^(\*\*[^*\n]+)$/gm, '$1.**')].filter(Boolean).join('\n\n'))
    }
    E('book-houses', 'note', 'Гербовник великих домов', {
      title: 'Щиты, девизы и судьбы великих домов Империи', summary: `${houses.length} великих домов и ${clans.length} кланов Севера: гербы, девизы, сторона в гражданской войне.`,
      body: parts.join('\n\n'), tags: ['книги', 'Великие дома']
    })
  }

  // ---------- Хроника гражданской войны ----------
  {
    const evs = lore('event').filter((e) => e.from != null && year(e.from) >= 975 && year(e.from) <= 980).sort((a, b) => a.from - b.from)
    // одно и то же событие бывает записано дважды (как событие страны и как битва) — берём то, где больше текста
    const best = new Map()
    for (const e of evs) {
      const cur = best.get(e.base.name)
      const len = (x) => (x.base.body ?? '').length + (x.base.summary ?? '').length
      if (!cur || len(e) > len(cur)) best.set(e.base.name, e)
    }
    const list = [...best.values()].sort((a, b) => a.from - b.from)
    const parts = ['Пять лет, за которые Империя потеряла четыре пятых своих земель. Составитель собрал по годам то, что записано в летописях Империи, Республики, Короны Аргус, Святой церкви и графств; где летописи расходятся, приведено то, что известно наверняка.']
    let y = 0
    for (const e of list) {
      const ey = year(e.from)
      if (ey !== y) {
        y = ey
        parts.push(`# ${y} год`)
      }
      const p = e.base.props ?? {}
      const lines = [`## ${e.base.name}`]
      const meta = [p.type, p.participants, p.outcome].filter(Boolean).join(' · ')
      if (meta) lines.push(`*${meta}*`)
      const body = strip(e.base.body)
      lines.push(body || e.base.summary || '')
      parts.push(lines.filter(Boolean).join('\n\n'))
    }
    E('book-war', 'note', 'Хроника гражданской войны 975–980', {
      title: 'Пять лет распада Империи — по годам и событиям', summary: `${list.length} событий от самосозыва Верховного совета до Чёрной комнаты.`,
      body: parts.join('\n\n'), tags: ['книги', 'война']
    })
  }

  // ---------- Земли Лоры: путеводитель ----------
  {
    const states = world.states.filter((s) => !String(s.id).startsWith('hist-') && strip(s.base.description))
    const parts = ['Путеводитель для тех, кто впервые пускается в дорогу: какие государства лежат на континентах и островах мира, кто ими правит и чего там ждать. Сведения записаны так, как их рассказывают на постоялых дворах и в посольских канцеляриях.']
    const order = ['Империя', 'Корона Аргус', 'Графство Мангениум', 'Графство Штирия', 'Республика', 'Святая церковь']
    states.sort((a, b) => ((order.indexOf(a.base.name) + 1 || 99) - (order.indexOf(b.base.name) + 1 || 99)) || a.base.name.localeCompare(b.base.name, 'ru'))
    parts.push('# Великие державы')
    let split = false
    for (const s of states) {
      if (!split && !order.includes(s.base.name)) {
        parts.push('# Прочие земли')
        split = true
      }
      const b = s.base
      const lines = [`## ${b.name}`]
      if (b.fullName && b.fullName !== b.name) lines.push(`*${b.fullName}*`)
      const facts = [b.government && `**Правление.** ${b.government}`, b.ruler && `**Правитель.** ${b.ruler}`, b.population && `**Население.** ${b.population}`, b.religion && `**Вера.** ${b.religion}`, b.motto && `**Девиз.** ${b.motto}`].filter(Boolean)
      lines.push(...facts)
      lines.push(strip(b.description))
      parts.push(lines.join('\n\n'))
    }
    E('book-lands', 'note', 'Земли Gleuderoff', {
      title: 'Путеводитель по государствам мира для путешественников и послов', summary: `${states.length} государств и земель: правление, правители, вера и нравы.`,
      body: parts.join('\n\n'), tags: ['книги', 'география']
    })
  }
}
