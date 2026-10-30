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

export interface WorldData {
  version: number
  provinces?: Province[]
  adminRegions?: AdminRegion[]
  mapLabels?: MapLabel[]
  name: string
  calendar: Calendar
  maps: MapDef[]
  states: WorldState[]
  regions: Region[]
  places: Place[]
  entries: Entry[]
  events: WorldEvent[]
}
