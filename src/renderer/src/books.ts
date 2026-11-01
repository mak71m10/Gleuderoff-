// Книги мира как настоящие книги: оформление каждой книги (обложка, бумага, буквицы, шрифты) и иллюстрации.
// Иллюстрации рисует scripts/book-art.mjs по подсказкам ниже — в resources/default-world/books/<файл>.
import type { Entry } from './types'

export interface BookIllustration {
  /** перед каким заголовком (часть текста) — или 'title' для фронтисписа */
  at: string
  file: string
  caption: string
  /** подсказка для нейросети (scripts/book-art.mjs) */
  prompt: string
}

export interface BookTheme {
  key: string
  /** надпись над названием на титуле и на корешке */
  kind: string
  /** выходные данные на титуле */
  imprint: string
  cover: [string, string]
  coverInk: string
  emblem: string
  ornament: string
  illustrations: BookIllustration[]
}

const ART = 'medieval illuminated manuscript illustration, ink and watercolor on aged parchment, gold leaf accents, fine linework, decorative border'

export const BOOK_THEMES: Record<string, BookTheme> = {
  'lore-book-history': {
    key: 'textbook', kind: 'Общеимперский учебник', imprint: 'Хауссер · Имперская типография · для школ и академий Империи',
    cover: ['#6b1418', '#3a0b0d'], coverInk: '#e2c27a', emblem: 'dragon', ornament: '❦',
    illustrations: [
      { at: 'Глава I', file: 'history-1.webp', caption: 'Дварфы Империи гор и норды Севера.', prompt: 'dwarves in heavy armor and tall northmen meeting in snowy mountains, banners, fortress' },
      { at: 'Северная бойня', file: 'history-2.webp', caption: 'Северная бойня у крепости Ул-гхайм.', prompt: 'dwarf army storming an orc fortress in a snowy valley, battle, smoke' },
      { at: 'Джакаста I', file: 'history-3.webp', caption: 'Джакаста I над горящей столицей пустынь.', prompt: 'desert king standing on top of a great dark cathedral above a burning desert city at night' },
      { at: 'Глава III', file: 'history-4.webp', caption: 'Огненный Дракон у стен.', prompt: 'medieval army with dragon banners besieging a burning walled city at night' },
      { at: 'Глава IV', file: 'history-5.webp', caption: 'Верховный совет в Хауссере.', prompt: 'great medieval council hall with hundreds of nobles and generals on tiered benches' }
    ]
  },
  'lore-book-monstargs': {
    key: 'chronicle', kind: 'Имперская летопись', imprint: 'Список, одобренный цензурой Верховного совета · Хауссер',
    cover: ['#1a1414', '#0b0808'], coverInk: '#c9a45c', emblem: 'dragon', ornament: '✠',
    illustrations: [
      { at: 'title', file: 'monstargs-0.webp', caption: 'Тейбер I Монстарг Великий.', prompt: 'stern bearded warlord emperor on a throne with a black dragon banner, crown, dark crimson' },
      { at: 'Глава I', file: 'monstargs-1.webp', caption: 'Коронация: Святой папа нарекает Тейбера Монстаргом.', prompt: 'coronation of a warrior king by a pope in a cathedral, golden light' },
      { at: 'Глава II', file: 'monstargs-2.webp', caption: 'Годы застоя.', prompt: 'old emperor in a dim library among scrolls, quiet palace' },
      { at: 'Глава III', file: 'monstargs-3.webp', caption: 'Падение: гражданская война.', prompt: 'imperial palace burning, armies fighting on a bridge, civil war' }
    ]
  },
  'lore-book-magic': {
    key: 'grimoire', kind: 'Гримуар второго архимага', imprint: 'Северная Башня · для посвящённых Кругов',
    cover: ['#1d2340', '#0c0f1f'], coverInk: '#9fb8ff', emblem: 'star', ornament: '✦',
    illustrations: [
      { at: 'Глава II', file: 'magic-1.webp', caption: 'Течение маны.', prompt: 'mage in robes channeling glowing blue mana streams from the ground into his hands, runes' },
      { at: 'Глава III', file: 'magic-2.webp', caption: 'Руны Факур.', prompt: 'magic circle with arcane runes drawn on stone floor, glowing, diagram' },
      { at: 'Глава IV', file: 'magic-3.webp', caption: 'Четыре Круга.', prompt: 'four mages of earth water air and fire standing in a circle, elemental symbols' }
    ]
  },
  'lore-book-light': {
    key: 'holy', kind: 'Священное писание Дома Света', imprint: 'Список с Садры, хранимой в Сантарее · благословлено Святым папой',
    cover: ['#efe6cf', '#cdbb8e'], coverInk: '#8a6a1f', emblem: 'sun-eye', ornament: '☩',
    illustrations: [
      { at: 'Глава I', file: 'light-1.webp', caption: 'Сначала был свет.', prompt: 'divine rays of golden light breaking through clouds over the world, angels' },
      { at: 'Глава III', file: 'light-2.webp', caption: 'Слуги господа.', prompt: 'saints and priests in white and gold kneeling before radiant light in a cathedral' }
    ]
  },
  'lore-book-dark': {
    key: 'darkness', kind: 'Писание Дома Тьмы', imprint: 'Список с манускрипта, писанного до смерти последнего дракона',
    cover: ['#141018', '#050307'], coverInk: '#b9b2c9', emblem: 'moon', ornament: '☾',
    illustrations: [
      { at: 'Глава I', file: 'dark-1.webp', caption: 'Матерь Налла.', prompt: 'veiled dark goddess mother in black robes with a crescent moon, stars, dark temple of black marble' },
      { at: 'Глава III', file: 'dark-2.webp', caption: 'Эпоха противостояния.', prompt: 'armies of light and shadow facing each other under an eclipse' }
    ]
  },
  'lore-book-chaos': {
    key: 'forbidden', kind: 'Запретное писание', imprint: 'Список с утраченного оригинала · переписчик неизвестен · хранить под замком',
    cover: ['#2a0a0c', '#0a0203'], coverInk: '#d14a3a', emblem: 'skull', ornament: '⛧',
    illustrations: [
      { at: 'Глава I', file: 'chaos-1.webp', caption: 'Первый мир.', prompt: 'swirling void of chaos with a giant eye and broken stars, eldritch, dark red' }
    ]
  },
  'lore-book-requiem': {
    key: 'almanac', kind: 'Имперский альманах', imprint: 'Ново-Имперский календарь, учреждённый в 500 г.',
    cover: ['#24394a', '#101c26'], coverInk: '#e2d3a8', emblem: 'sun-eye', ornament: '✺',
    illustrations: [
      { at: 'title', file: 'requiem-0.webp', caption: 'Колесо пяти месяцев.', prompt: 'astronomical calendar wheel with five segments, sun and moons, zodiac-like symbols' }
    ]
  },
  'lore-ag-oath': {
    key: 'law', kind: 'Акты Сената Короны', imprint: 'Норерштадт · Палата Короны · заверено хранителем печати',
    cover: ['#26354f', '#121a28'], coverInk: '#dcdde4', emblem: 'crown', ornament: '♛',
    illustrations: [{ at: 'title', file: 'oath-0.webp', caption: 'Клятва на рубиновом кольце.', prompt: 'nobleman kneeling with his hand on a gold ring with a ruby held by a king, blue banners with a silver crown' }]
  },
  'lore-ag-chain-law': {
    key: 'law', kind: 'Уложения Сената Короны', imprint: 'Норерштадт · Палата Короны · список для Цепного суда',
    cover: ['#3a3a40', '#18181c'], coverInk: '#c9c9cf', emblem: 'chain', ornament: '⛓',
    illustrations: [{ at: 'title', file: 'chainlaw-0.webp', caption: 'Цепной рынок Ландвейлера.', prompt: 'medieval market under stone arcades, merchants with ledgers, chains and iron rings on a table, crowd' }]
  }
}

const DEFAULT_THEME: BookTheme = {
  key: 'manuscript', kind: 'Рукопись', imprint: '', cover: ['#4a3420', '#24180c'], coverInk: '#e2c27a', emblem: 'book', ornament: '❧', illustrations: []
}

export const bookTheme = (e: Entry): BookTheme => BOOK_THEMES[e.id] ?? DEFAULT_THEME
export const BOOK_ART_STYLE = ART

// ---------- markdown → блоки страниц ----------
export interface BookBlock {
  kind: 'h1' | 'h2' | 'p' | 'ul' | 'ol' | 'img' | 'quote'
  html: string
  /** абзац, который продолжается со следующей страницы */
  text?: string
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const inlineMd = (s: string): string =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\[\[(.+?)\]\]/g, '<span class="bk-link" data-name="$1">$1</span>')

export function toBlocks(body: string, theme: BookTheme, assetUrl: (p: string) => string): BookBlock[] {
  const out: BookBlock[] = []
  const illus = (heading: string): void => {
    for (const il of theme.illustrations)
      if (il.at !== 'title' && heading.includes(il.at))
        out.push({ kind: 'img', html: `<figure class="bk-figure"><img src="${assetUrl(`books/${il.file}`)}" alt=""><figcaption>${esc(il.caption)}</figcaption></figure>` })
  }
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null
  const flush = (): void => {
    if (list) out.push({ kind: list.kind, html: `<${list.kind}>${list.items.map((i) => `<li>${inlineMd(i)}</li>`).join('')}</${list.kind}>` })
    list = null
  }
  for (const raw of body.split('\n')) {
    const t = raw.trim()
    const ul = /^[-*] (.*)/.exec(t)
    const ol = /^\d+\. (.*)/.exec(t)
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol'
      if (list && list.kind !== kind) flush()
      list ??= { kind, items: [] }
      list.items.push((ul ?? ol)![1])
      continue
    }
    flush()
    if (!t) continue
    if (t.startsWith('# ')) {
      out.push({ kind: 'h1', html: `<h1>${inlineMd(t.slice(2))}</h1>` })
      illus(t.slice(2))
    } else if (t.startsWith('## ') || t.startsWith('### ')) {
      const h = t.replace(/^#+ /, '')
      out.push({ kind: 'h2', html: `<h2>${inlineMd(h)}</h2>` })
      illus(h)
    } else if (t.startsWith('> ')) out.push({ kind: 'quote', html: `<blockquote>${inlineMd(t.slice(2))}</blockquote>` })
    else out.push({ kind: 'p', html: '', text: t })
  }
  flush()
  return out
}
