import type { StateTech } from './tech'
import type { AreaEcon, ProvinceRes, StateEcon } from './economy'
import type { StateMilitary } from './military'

/** Дата мира — целое число дней от 1-го дня 1-го года после смерти последнего дракона (день 0). */
export type WorldDate = number

/** Изменение, вступающее в силу с указанной даты. */
export interface Change<T> {
  id: string
  date: WorldDate
  patch: Partial<T>
  note?: string
}

/** Сущность, у которой поля меняются со временем. */
export interface Temporal<T> {
  base: T
  history: Change<T>[]
  /** С какой даты существует (основан, рождён). Пусто — всегда. */
  from?: WorldDate | null
  /** До какой даты существует (разрушен, умер). Пусто — до сих пор. */
  to?: WorldDate | null
}

export interface Month {
  name: string
  days: number
}

export interface Calendar {
  /** Название календаря */
  name?: string
  /** Часов в сутках */
  hoursPerDay?: number
  /** Эпохи: с какого года начинается каждая */
  eras?: { name: string; from: number }[]
  months: Month[]
  weekdays: string[]
  eraAfter: string
  eraBefore: string
  eraAfterShort: string
  eraBeforeShort: string
  /** «Настоящее время» лора */
  present: WorldDate
  /** Видимый диапазон шкалы, в годах */
  rangeFrom: number
  rangeTo: number
}

export interface MapDef {
  id: string
  name: string
  kind: 'world' | 'city' | 'region'
  /** Путь к картинке внутри папки мира */
  image: string
  /** Логический размер карты (координаты меток и границ) */
  width: number
  height: number
  /** Место, к которому привязана карта (для карт городов) */
  placeId?: string
  /** Картинка-калька (например, старая политическая карта) */
  reference?: string
  /** Карта провинций: PNG, номер провинции = R·256+G, местность в B */
  provinceMap?: string
  /** Рельеф: R высота, G класс местности ×40, B реки, A суша */
  terrainMap?: string
  /** План города (генератор Watabou, переработанный city-maps.mjs): контуры зданий для выбора на карте */
  plan?: string
  /** Плитки высокого разрешения: {path}/{z}/{x}_{y}.webp, на уровне z ширина = width × 2^z */
  tiles?: { path: string; minZoom: number; maxZoom: number; size: number }
}

export interface StateFields {
  name: string
  fullName: string
  color: string
  flag: string
  motto: string
  ruler: string
  rulerTitle: string
  rulerId: string
  government: string
  ideology: string
  religion: string
  religionId: string
  capitalId: string
  population: string
  army: string
  navy: string
  economy: string
  treasury: string
  laws: string
  culture: string
  languages: string
  stability: number
  description: string
  dynastyId: string
  overlordId: string
  diplomacy: string
  /** Тайное знание мастера */
  secret?: string
  /** Флаг и герб, собранные генератором (если нет картинки) */
  heraldry?: Heraldry
  customFields: { label: string; value: string }[]
  /** Экономика: подати и долги, торговля, деньги и банки (вкладка «Экономика») */
  taxes?: string
  trade?: string
  banks?: string
  /** Технологии страны в Век Шестерни (src/renderer/src/tech.ts, docs/технологии.md) */
  tech?: StateTech
  /** Экономика ВПИ: монета, сословия, казна, подати, беды и сильные стороны, летопись */
  econ?: StateEcon
  /** Войско ВПИ: лестница, закон призыва, уставы рот, роты и соединения (docs/впи-армия.md) */
  military?: StateMilitary
  /** решения власти: подати, набор, меры по войску, ревизия, устав, война (decisions.ts) */
  decisions?: import('./decisions').Decision[]
}

export type FlagLayout =
  | 'plain'
  | 'bicolor-h'
  | 'bicolor-v'
  | 'tricolor-h'
  | 'tricolor-v'
  | 'cross'
  | 'saltire'
  | 'border'
  | 'chevron'
  | 'quarters'
  | 'diagonal'

export interface Heraldry {
  layout: FlagLayout
  /** Основные цвета поля: до трёх */
  colors: string[]
  emblem: string
  emblemColor: string
}

export interface Faction {
  id: string
  name: string
  leader: string
  ideology: string
  influence: number
  description: string
}

/** Ручное положение подписи страны на карте (как на исходной карте), в логических координатах */
export interface StateLabel {
  x: number
  y: number
  /** Угол поворота в градусах */
  angle: number
  /** Высота букв в логических единицах карты */
  size: number
}

export interface WorldState extends Temporal<StateFields> {
  id: string
  factions: Faction[]
  label?: StateLabel
}

/** Участок территории. Принадлежность меняется по датам. */
export interface Region {
  id: string
  mapId: string
  name?: string
  /** Набор колец полигона в логических координатах карты: [[x,y], ...] */
  rings: [number, number][][]
  owners: { date: WorldDate | null; stateId: string | null }[]
  from?: WorldDate | null
  to?: WorldDate | null
}

export type PlaceType =
  | 'capital'
  | 'city'
  | 'town'
  | 'village'
  | 'castle'
  | 'temple'
  | 'ruins'
  | 'dungeon'
  | 'port'
  | 'tower'
  | 'landmark'
  | 'battle'
  | 'memorial'
  | 'treasury'
  | 'assembly'
  | 'gallows'
  | 'strike'

export interface PlaceFields {
  name: string
  type: PlaceType
  stateId: string
  population: string
  ruler: string
  description: string
  image: string
}

export interface Place extends Temporal<PlaceFields> {
  id: string
  mapId: string
  x: number
  y: number
  /** Карта этого города/подземелья */
  innerMapId?: string
  /** Номер здания на плане города, если место — здание */
  building?: number
  /** Своя объёмная модель вместо модели по типу (например, «grandport») */
  model?: string
}

export type EntryKind =
  | 'character'
  | 'god'
  | 'religion'
  | 'dynasty'
  | 'people'
  | 'organization'
  | 'event'
  | 'artifact'
  | 'note'

export interface EntryFields {
  name: string
  title: string
  image: string
  summary: string
  body: string
  tags: string[]
  /** Произвольные поля для конкретного вида записи */
  props: Record<string, string>
  /** Связи с другими записями по id */
  links: Record<string, string>
  /** Тайное знание мастера — видно только в режиме мастера */
  secret?: string
  /** Герб (у династий и домов) */
  heraldry?: Heraldry
  /** Совет, выбирающий правителя из рода (у династий с выборной властью) */
  council?: SuccessionCouncil
  /** Советники при правителе: карточки с портретами на странице органа власти */
  advisors?: { id: string; office: string }[]
  /** Сабельная ставка (Имперские изгнанники): сабли генералов по годам, местоблюстители, набеги */
  stavka?: { years: number[]; members: { id: string; name: string; sabres: number[] }[]; locum: { id: string; from: number; to: number | null }[]; raids: { year: number; title: string; by: string; target: string; loot: number; note: string }[] }
  ting?: { years: number[]; need: number; clans: { key: string; name: string; nick: string; seat: string; color: string; light: string; elders: { id: string; from: number; to: number | null }[] }[]; heads: { id: string; from: number; to: number | null; clan: string; how: string }[]; challenges: { year: number; by: string | null; against: string | null; stones: string[]; kind: 'election' | 'duel' | 'denied'; winner: string | null; note: string }[] }
  brood?: { need: number; etts: { key: string; name: string; seat: string; color: string; light: string }[]; broods: { key: string; title: string; father: string | null; from: number; to: number | null; winner: string | null; children: { id: string | null; name: string; female: boolean; born: number; ett: string; fate: 'killed' | 'given' | 'fled' | 'winner' | 'alive'; at: number | null; by: string | null; note: string }[] }[] }
  vault?: { chambers: { key: string; name: string; who: string; color: string; light: string }[]; counts: { year: number; title: string; seats: Record<string, number>; note: string }[]; elections: { year: number; title: string; winner: string; candidates: { id: string | null; name: string; race: string; votes: Record<string, number> }[]; note: string }[]; rules: string[] }
  /** Лестница Высот (Высокогорное Княжество): ранг дома — высота очага; голос в Совете Венца весит высоту */
  heights?: { peak: number; tiers: { key: string; name: string; from: number; to: number; who: string; color: string; rights: string }[]; houses: { key: string; id: string; name: string; colors: string[]; emblem: string; path: { year: number; h: number; note: string }[]; text: string }[]; decisions: { year: number; title: string; by: string; votes: Record<string, string>; result: string; note: string }[]; lifts: { name: string; from: string; holder: string; note: string }[]; rules: string[] }
  /** Совет Двадцати и Соляная урна (Республика Чеафарал): члены по годам, выборы протектора по кругам белыми шарами */
  urn?: { need: number; factions: { key: string; name: string; who: string; color: string; light: string }[]; members: { id: string | null; name: string; faction: string; from: number; to: number | null }[]; elections: { year: number; title: string; winner: string; note: string; candidates: { key: string; id: string | null; name: string; faction: string }[]; rounds: { votes: Record<string, Record<string, number>>; note: string }[] }[]; rules: string[] }
  /** Рейд и Верховный адмирал (Крайдонианская Лига): Коллегия Флагов, колонны кораблей по вахтам, два ветра, салюты Смотра */
  fleet?: { needFlags: number; needPennants: number; sides: { key: string; name: string; who: string; color: string; light: string }[]; college: { id: string | null; name: string; office: string; kind: 'admiral' | 'captain' | 'rank'; side: string; from: number; to: number | null }[]; elections: { year: number; title: string; winner: string; note: string; candidates: { key: string; id: string | null; name: string; side: string; flagship: string }[]; watches: { n: number; flags: Record<string, number>; pennants: Record<string, number>; note: string }[] }[]; salutes: { year: number; admiral: string; percent: number; note: string }[]; rules: string[] }
  lantern?: { turnYears: number; needCandles: number; order: { key: string; name: string; seat: string; house: string; houseId: string; color: string; emblem: string; side: string }[]; sides: { key: string; name: string; who: string; color: string }[]; turns: { n: number; round: number; from: number; to: number; seat: string; seatIdx: number; ruler: string; rulerId: string; house: string; by: 'own' | 'pledge' | 'skip' | 'dark' | 'future'; note: string }[]; pledges: { year: number; seat: string; turn: number; from: string; to: string; price: string; reason: string; status: string }[]; removals: { year: number; seat: string; target: string; votes: Record<string, 'out' | 'keep' | 'none'>; passed: boolean; note: string }[]; dark: { year: number; seat: string; note: string }[]; chain: { house: string; held: number[]; need: number; note: string }; rules: string[] }
  /** «Разрядная книга» Харнмарка: ступени шести Домов, роспись мест у княжьего стола по годам, споры о местах. */
  razryad?: {
    yearFrom: number; yearTo: number; seats: number; levyTotal: number; comeOfAge: number
    houses: { key: string; name: string; seat: string; houseId: string; color: string; bg: string; emblem: string; arms: string; levy: number; head: { id: string; name: string } | null }[]
    years: { y: number; order: string[]; why: string; steps: Record<string, number>; sitters: Record<string, string | null>; disputes: number; mode: 'even' | 'crooked' | 'broken'; marched: number; ruler: string }[]
    steps: { house: string; from: number; step: number; note: string }[]
    disputes: { from: number; to: number | null; plaintiff: string; defendant: string; seat: number; result: 'won' | 'lost' | 'open'; note: string }[]
    guardians: { from: number; to: number | null; name: string; id: string; house: string; houseId: string; note: string }[]
    rules: string[]
  }
  threshold?: { needDoors: number; doorsTotal: number; hungry: number; bigMeasure: number; sides: { key: string; name: string; who: string; color: string }[]; hearths: { key: string; name: string; seat: string; side: string; color: string; emblem: string; houseId: string }[]; keys: { key: string; name: string; role: string; desc: string; holders: { name: string; id: string | null; house: string; from: number; to: number | null }[] }[]; walk: { year: number; king: string; note: string; doors: Record<string, string> }; forecast: { key: string; name: string; id: string; doors: Record<string, string>; note: string }[]; decisions: { year: number; title: string; kind: string; need: number; votes: Record<string, string>; result: string; note: string }[]; book: { series: { year: number; families: number }[]; shares: { year: number; by: Record<string, number> }[] }; rules: string[] }
  ash?: { need: number; judgesTotal: number; generations: number; sides: { key: string; name: string; who: string; color: string }[]; kings: { key: string; name: string; female: boolean; born: number; from: number; to: number | null; statutes: number; line: string; fate: string; note: string; id: string }[]; trials: { year: number; by: string; target: string; yes: number | null; result: string; note: string }[]; judges: { id: string; name: string; seat: string; vote: string; note: string }[]; book: { year: number; alive: number }[]; rules: string[] }
  chalice?: { limit: number; sides: { key: string; name: string; who: string; color: string }[]; castes: { key: string; name: string; eighths: string; color: string; rights: string; bans: string }[]; years: { year: number; pureAdults: number; by: Record<string, number> }[]; challenges: { year: number; by: string; target: string; result: string; note: string }[]; heirs: { name: string; id: string; eighths: number; note: string }[]; rules: string[] }
  belt?: { knots: number; councilAge: number; councilNeed: number; sides: { key: string; name: string; who: string; color: string }[]; eldest: { id: string; name: string; born: number; died: number | null; from: number; to: number | null; origin: string; note: string }[]; princes: { id: string; name: string; born: number; from: number; to: number | null; by: string; end: string; note: string }[]; ladder: { id: string; name: string; born: number; branch: string; note: string }[]; knotsByYear: { year: number; left: number }[]; rules: string[] }
  sentence?: { first: string; sides: { key: string; name: string; who: string; color: string }[]; lines: { key: string; name: string; years: number; from: number; ends: number; note: string }[]; rules: string[] }
  silence?: { sides: { key: string; name: string; who: string; color: string }[]; priors: { id: string; name: string; parish: string; since: number; side: string; note: string }[]; words: { year: number; who: string; lost: number; note: string }[]; rules: string[] }
  ledger?: { total: number; need: number; sides: { key: string; name: string; who: string; color: string }[]; holders: { key: string; name: string; color: string }[]; shares: { year: number; by: Record<string, number>; note: string }[]; debts: { who: string; marks: number; pledge: string; year: number; note: string }[]; rules: string[] }
  keys?: { sides: { key: string; name: string; who: string; color: string }[]; tribute: { year: number; toFlame: string; flame: string; toGold: string; gold: string; note: string }[]; rules: string[] }
  /** «Ива» Эльфборна: двенадцать ветвей Домов, знаки, Ночи Голых Ветвей */
  willow?: {
    yearFrom: number; yearTo: number; needGreen: number; rootGreen: number
    houses: { key: string; name: string; side: string; race: string; houseId: string; color: string; bg: string; emblem: string; arms: string; head: { id: string; name: string } | null }[]
    sides: { key: string; name: string; who: string; color: string }[]
    years: { y: number; green: number; states: Record<string, 'g' | 'd' | 'b'>; ruler: string }[]
    signs: { y: number; house: string; kind: string; note: string }[]
    guardians: { from: number; to: number | null; name: string; id: string; house: string; houseId: string; note: string }[]
    nights: { y: number; title: string; green: number; note: string }[]
    rules: string[]
  }
  /** «Запреты Опушки» Сильвленда: шнуры пяти Опекунов, узлы-запреты по годам, Хранитель Опушки, сломанные запреты. */
  bans?: {
    yearFrom: number; yearTo: number; maxKnots: number; needKnots: number; graceDays: number
    houses: { key: string; name: string; tree: string; month: string; place: string; race: string; houseId: string; color: string; bg: string; emblem: string; arms: string }[]
    people: Record<string, string>
    years: { y: number; knots: Record<string, number>; holder: string | null; mode: 'held' | 'quiet'; keepers: Record<string, string | null>; ruler: string }[]
    bans: { house: string; text: string; on: 'sylva' | 'stranger' | 'land'; since: number }[]
    broken: { y: number; house: string; ban: string; by: string; result: 'fell' | 'held' | 'open' | 'untied' | 'lapsed'; fell: number; note: string }[]
    guardians: { from: number; to: number | null; name: string; id: string; house: string; houseId: string; note: string }[]
    rules: string[]
  }
  /** «Колодец и Лестница» Братства Бездны: наборы-ступени, живые братья по годам, Магистр по стажу */
  descent?: {
    yearFrom: number; yearTo: number; period: number; fullShare: number
    classes: { key: string; year: number; name: string; taken: number; text: string; stair: string; color: string }[]
    years: { y: number; alive: Record<string, number>; total: number; elder: string | null; ruler: string; rulerId: string }[]
    losses: { y: number; share: number; name: string }[]
    nights: { y: number; title: string; note: string }[]
    rulers: { from: number; to: number | null; name: string; id: string; note: string }[]
    rules: string[]
  }
  /** «Великое испытание» Северной Башни: двенадцать кафедр, баллы испытаний, Магистр и Хранитель Ключа */
  tower?: {
    yearFrom: number; yearTo: number; maxScore: number; passScore: number; floors: number
    chairs: { key: string; name: string; floor: number; color: string; desc: string; holder: string | null }[]
    exams: { y: number; title: string; kind: string; top: { id: string | null; name: string; score: number }[]; note: string; pending?: boolean; passed: boolean }[]
    years: { y: number; ruler: string; rulerId: string }[]
    rulers: { from: number; to: number | null; name: string; id: string; note: string }[]
    rules: string[]
  }
  /** «Стяг Саренто и чистая вода» Гренинсворда: пять полисов, чистые дни гаваней, доля года, Набаты, Белый год */
  ice?: {
    yearFrom: number; yearTo: number; whiteLimit: number; yearDays: number; needBells: number
    polis: { key: string; name: string; color: string; bg: string; fg: string; emblem: string; arms: string; text: string; consul: string | null }[]
    years: { y: number; days: Record<string, number>; share: Record<string, number>; white: boolean; skipped: string[]; top: string }[]
    bells: { y: number; against: string; rung: string[]; note: string; passed: boolean }[]
    rulers: { from: number; to: number | null; name: string; id: string; note: string }[]
    nights: { y: number; title: string; note: string }[]
    rules: string[]
  }
  /** «Ворота и дымы» Уунааша: шесть владетелей, живые и дальние дымы по годам, присяга князю, переносы Дня Ворот */
  smoke?: {
    yearFrom: number; yearTo: number; farWeight: number; winterShare: number
    sides: { key: string; name: string; color: string; who: string }[]
    lords: { key: string; name: string; seat: string; side: string; color: string; bg: string; emblem: string; arms: string; houseId: string; head: string | null }[]
    years: { y: number; lords: Record<string, { live: number; far: number }>; oath: string[]; live: number; far: number; prince: number; total: number; open: boolean; winter: boolean; ruler: string; rulerId: string }[]
    passes: { y: number; title: string; moved: number; note: string }[]
    rulers: { from: number; to: number | null; name: string; id: string; note: string }[]
    rules: string[]
  }
  /** «Белая нить» Олекохта: девять сфер совета, узлы нерешённых жалоб Ясного дня, тёмные сферы, нить Эрэдама */
  knots?: {
    yearFrom: number; yearTo: number; darkLimit: number; sphereLimit: number; crownLimit: number; perTroupe: number
    sides: { key: string; name: string; color: string; who: string }[]
    spheres: { key: string; name: string; desc: string; holders: { from: number; to: number | null; name: string; id: string | null; side: string }[] }[]
    troupes: { key: string; name: string; color: string; side: string; text: string; head: string }[]
    years: { y: number; spheres: Record<string, { holder: string; id: string | null; side: string; knots: number }>; dark: number; crown: number; ruler: string; rulerId: string; staged: Record<string, number> }[]
    nights: { y: number; title: string; note: string }[]
    rulers: { from: number; to: number | null; name: string; id: string; note: string }[]
    rules: string[]
  }
  ford?: { needLaw: number; needWar: number; threshold: number; houses: { key: string; name: string; who: string; color: string; ford: string }[]; series: { year: number; cast: number; share: number; top: string; broken: string[]; note: string }[]; wards: { id: string; house: string; host: string; since: number }[]; decisions: { year: number; title: string; kind: string; need: number; yes: number; no: number; abstain: number; result: string; note: string }[]; rules: string[] }
  star?: { sides: { key: string; name: string; who: string; color: string }[]; bridges: { key: string; name: string; seat: string; note: string }[]; rolls: { year: number; men: Record<string, { name: string; id: string | null; side: string }> }[]; nights: { year: number; seen: Record<string, string>; result: string; note: string }[]; closures: { year: number; bridge: string; kind: string; note: string }[]; kings: { from: number; to: number; name: string; id: string }[]; rules: string[] }
  reserve?: { sides: { key: string; name: string; who: string; color: string }[]; floor: number; wake: number; windows: number; stock: [number, number][]; dreams: { from: number; to: number | null; title: string; cost: number; signed: boolean; status: string; side: string; note: string }[]; audits: { year: number; kind: string; note: string }[]; sleepless: { from: number; to: number }[]; due: { year: number; have: number; note: string }; rules: string[] }
  pledge?: { sides: { key: string; name: string; who: string; color: string }[]; holders: { key: string; name: string; color: string }[]; total: number; line: number; redeem: number; snaps: ({ year: number } & Record<string, number>)[]; loans: { year: number; title: string; holder: string; shares: number; sum: number; why: string; status: string; note: string }[]; pledged: { from: number; to: number }[]; due: { year: number; shares: number; note: string }; rules: string[] }
  ridge?: { sides: { key: string; name: string; who: string; color: string }[]; total: number; needed: number; crowned: number; tribes: { key: string; name: string; seat: string; color: string }[]; stones: { year: number; tribe: string; kind: string; note: string }[]; chiefs: { from: number; to: number; name: string; id: string; how: string }[]; festival: { year: number; note: string }; rules: string[] }
  auction?: { sides: { key: string; name: string; who: string; color: string }[]; spears: [number, number][]; auctions: { year: number; title: string; kind: string; floor: number | null; spears: number; note: string; bids: { name: string; id: string | null; side: string; price: number; note: string; won: boolean }[] }[]; reigns: { from: number; to: number; name: string; id: string; side: string; price: number; spears: number; paid: number[]; missed: number[]; end: string }[]; due: { year: number; sum: number; have: number; note: string }; rules: string[] }
  wall?: { total: number; needLaw: number; needWar: number; needAccept: number; sides: { key: string; name: string; who: string; color: string }[]; centuries: { key: string; n: number; name: string; seat: string; side: string; leader: string; leaderId: string | null; alive: Record<string, number> }[]; snap: number[]; assemblies: { year: number; title: string; kind: string; need: number; yes: number; abstain: number; votes: Record<string, string>; result: string; note: string }[]; inscriptions: { year: number; count: number; note: string }[]; rules: string[] }
  cart?: { seats: number; needLaw: number; needWar: number; sides: { key: string; name: string; who: string; color: string }[]; burdens: { key: string; name: string; desc: string; color: string }[]; series: { year: number; pull: number; load: number; stalled: boolean; note: string; seats: Record<string, number> }[]; pullers: { id: string; burden: string; tally: number; since: number }[]; decisions: { year: number; title: string; kind: string; need: number; yes: number; no: number; abstain: number; result: string; note: string }[]; rules: string[] }
}

/** Кресло в совете рода: кто сидит, сколько голосов, за кого голосует и кто его второй выбор */
export interface CouncilSeat {
  id: string
  role: string
  holderId: string
  weight: number
  vote: string
  second: string
}

export interface CouncilCandidate {
  id: string
  note: string
  /** Избирается только всеми голосами (например, дочь по Оговорке Ортрун) */
  unanimous?: boolean
  /** false — сейчас не может быть избран (послушник и т.п.) */
  eligible?: boolean
}

export interface SuccessionCouncil {
  name: string
  /** Доля голосов для победы, например 2/3 */
  threshold: number
  rounds: number
  /** Если никто не набрал: старший из оставшихся или никто */
  fallback: 'eldest' | 'none'
  fallbackLabel: string
  rules: string
  seats: CouncilSeat[]
  candidates: CouncilCandidate[]
}

export interface Entry extends Temporal<EntryFields> {
  id: string
  kind: EntryKind
}

export interface WorldEvent {
  id: string
  date: WorldDate
  title: string
  description: string
  importance: 1 | 2 | 3
  linkedIds: string[]
}

export type MapLabelKind = 'sea' | 'mountain' | 'river' | 'forest' | 'desert' | 'region' | 'continent'

/** Подпись географии на карте: море, хребет, река, лес, историческая земля */
export interface MapLabel {
  id: string
  mapId: string
  text: string
  kind: MapLabelKind
  x: number
  y: number
  angle: number
  /** Высота букв в логических единицах карты */
  size: number
  note?: string
}

/** Провинция — неделимая единица карты (как у Paradox) */
export interface Province {
  id: number
  name: string
  /** Площадь в пикселях карты провинций */
  px: number
  /** Центр в логических координатах карты */
  x: number
  y: number
  /** Страна, к которой провинция относится сейчас (по исходной карте) */
  state: string | null
  culture: string
  /** 1 равнины, 2 леса, 3 холмы, 4 горы, 5 снега, 6 пустыня */
  terrain: number
  areaId: string
  neighbors: number[]
  /** связь с соседом: дорога p/d/t (тракт, грунтовка, тропа) или река без моста r1–r3 (scripts/province-links.mjs) */
  links?: Record<number, string>
  coastal?: boolean
  /** Поселение-столица провинции (объёмная модель на карте) */
  settlement?: { type: 'village' | 'fishing' | 'town' | 'city' | 'capital' | 'castle' | 'port' | 'temple' | 'ruins' | 'tower'; x: number; y: number } | null
  /** Описание поселения/провинции */
  description?: string
  /** Карта города этой провинции */
  cityMapId?: string
  /** Экономика ВПИ: промысел провинции и сколько в ней живёт (docs/впи-экономика.md) */
  res?: ProvinceRes
  pop?: number
  /** Особое место (например, «aurhafen» — поселение заменено местом автора) */
  landmark?: string
  /** Владельцы по датам: [дата | null, id страны | null] */
  owners: [number | null, string | null][]
}

/** Уровни деления карты: континент → регион → область */
export interface AdminRegion {
  id: string
  level: 'continent' | 'region' | 'area'
  name: string
  parentId: string | null
  culture?: string
  /** Великий дом, держащий регион (id записи династии) */
  houseId?: string
  description?: string
  descAuto?: boolean
  /** Экономика области (только у level = 'area'): население по расам и сословиям, довольство, амбар, постройки */
  econ?: AreaEcon
}

export interface Army {
  id: string
  name: string
  mapId: string
  stateId: string
  color: string
  /** path — проложенный путь от предыдущей точки до этой (по дорогам и местности, scripts/army-routes.mjs); без него — по прямой */
  waypoints: { x: number; y: number; date: WorldDate; path?: [number, number][] }[]
}

/** Законодательное собрание (Верховный совет, Сенат): состав по годам, законы и поимённые голоса */
/** Скамья или партия собрания; party — история, манифест и устройство (может отсутствовать) */
export interface LegislatureFaction {
  id: string
  name: string
  group: string
  color: string
  ideology: string
  leader: string
  stance: number[]
  party?: Party
}

export interface Party {
  founded: number
  founder: string
  motto: string
  symbol: string
  press: string
  base: string
  origin: string
  ideal: string
  principles: string[]
  manifesto: string
  structure: { name: string; text: string; tiers: [string, string, string][] }
  leaders: [number, number | null, string, string][]
  history: [number, string][]
  allies: string[]
  rivals: string[]
  secret?: string
  draft?: boolean
}

export interface Legislature {
  id: string
  stateId: string
  name: string
  entryId: string
  chairTitle: string
  seats: number
  from: WorldDate
  description: string
  groups: string[]
  seatOrder: string[]
  issues: { id: string; name: string; minus: string; plus: string }[]
  factions: LegislatureFaction[]
  convocations: { date: WorldDate; name: string; note: string; seats: Record<string, number> }[]
  members: LegislatureMember[]
  bills: Bill[]
  chronicle: { year: number; text: string; auto: string; convocation: string }[]
  archive: { date: WorldDate; title: string; text: string }[]
  /** выборы по весу голоса (Республика) */
  elections?: Election[]
  /** кабинеты министров по годам */
  cabinets?: Cabinet[]
  /** глава государства над собранием (канцлер) */
  head?: { title: string; entryId: string }
  /** неофициальный орган (Совет рабочих) */
  unofficial?: boolean
  strikes?: { from: WorldDate; to: WorldDate; town: string; title: string; text: string }[]
  /** городской парламент: город и провинция */
  town?: string
  provinceId?: number
  hall?: string
}

export interface Election {
  date: WorldDate
  name: string
  system: string
  constituent: boolean
  note: string
  /** разряды избирателей и вес их голоса */
  classes: { id: string; name: string; weight: number; who: string }[]
  districts: {
    name: string
    seats: number
    /** точки провинций округа для карты */
    pts: [number, number][]
    voters: Record<string, number>
    turnout: Record<string, number>
    /** голоса с учётом веса и по головам */
    votes: Record<string, number>
    heads: Record<string, number>
    seatsBy: Record<string, number>
    winner: string
  }[]
  voters: Record<string, number>
  came: Record<string, number>
  total: { votes: Record<string, number>; heads: Record<string, number>; seats: Record<string, number> }
  /** доля голосов каждой фракции внутри разряда */
  classVotes: Record<string, Record<string, number>>
  incidents: { district: string; text: string }[]
}

export interface Cabinet {
  id: string
  name: string
  from: WorldDate
  to: WorldDate | null
  coalition: string[]
  end: string
  ministers: { post: string; memberId: string; entryId: string; name: string; faction: string }[]
}

export interface LegislatureMember {
  id: string
  name: string
  /** карточка персонажа, если есть */
  entryId: string
  faction: string
  group: string
  title: string
  origin: string
  born: number
  from: WorldDate
  to: WorldDate | null
  /** взгляды по вопросам собрания, −2…+2 */
  stance: number[]
  bio: string
  left: string
  gender: string
  /** округ (Республика) */
  district?: string
  race?: string
  cls?: string
  image?: string
}

export interface Bill {
  id: string
  date: WorldDate
  title: string
  kind: string
  /** направление закона по вопросам собрания */
  w: number[]
  sponsor: string
  sponsorEntry: string
  sponsorFaction: string
  summary: string
  /** ключевой закон эпохи (из лора), а не рядовой */
  key?: boolean
  outcome: 'принят' | 'отклонён' | 'отложен'
  /** голос каждого члена (по порядку members): y за, n против, a воздержался, - отсутствовал, пробел — не член */
  votes: string
  tally: { y: number; n: number; a: number; abs: number } | null
}

export interface WorldData {
  /** Верховный совет, Сенат и другие собрания */
  legislatures?: Legislature[]
  version: number
  provinces?: Province[]
  adminRegions?: AdminRegion[]
  mapLabels?: MapLabel[]
  /** Походы армий: знамя движется по точкам маршрута между датами */
  armies?: Army[]
  /** ВПИ: приказы игроков и вердикты (scripts/vpi.mjs внести) */
  vpiLog?: { id: string; date: WorldDate; at: string; state: string; title: string; order: string; verdict: string; public: string; changes: string[] }[]
  /** ВПИ: текущая дата игры */
  vpi?: { date?: WorldDate }
  /** дипломатия: отношения пар стран на даты (diplomacy.ts) */
  relations?: import('./diplomacy').Relation[]
  /** живой рынок: потрясения мастера (неурожай, блокада, рудник) — market.ts */
  market?: { shocks: import('./market').MarketShock[]; trades?: import('./market').MarketTrade[] }
  name: string
  calendar: Calendar
  maps: MapDef[]
  states: WorldState[]
  regions: Region[]
  places: Place[]
  entries: Entry[]
  events: WorldEvent[]
}
