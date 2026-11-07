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
  coastal?: boolean
  /** Поселение-столица провинции (объёмная модель на карте) */
  settlement?: { type: 'village' | 'fishing' | 'town' | 'city' | 'capital' | 'castle' | 'port' | 'temple' | 'ruins' | 'tower'; x: number; y: number } | null
  /** Описание поселения/провинции */
  description?: string
  /** Карта города этой провинции */
  cityMapId?: string
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
  name: string
  calendar: Calendar
  maps: MapDef[]
  states: WorldState[]
  regions: Region[]
  places: Place[]
  entries: Entry[]
  events: WorldEvent[]
}
