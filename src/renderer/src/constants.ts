import type { EntryKind, PlaceType } from './types'
import type { IconName } from './components/Icon'

export interface PlaceTypeMeta {
  label: string
  /** С какого приближения видна метка */
  minZoom: number
  group: 'cities' | 'settlements' | 'poi'
  glyph: string
  size: number
}

// Глифы — пути SVG 24×24
export const PLACE_TYPES: Record<PlaceType, PlaceTypeMeta> = {
  capital: { label: 'Столица', minZoom: -3, group: 'cities', size: 26, glyph: 'M4 18h16l-1-9-4 3-3-6-3 6-4-3zM12 3l1 2-1 1-1-1z' },
  city: { label: 'Город', minZoom: -1.75, group: 'cities', size: 22, glyph: 'M4 20V10l4-3 4 3v-5l4-2 4 2v15zM8 20v-4M16 20v-4' },
  town: { label: 'Посёлок', minZoom: -0.75, group: 'settlements', size: 18, glyph: 'M4 20v-8l5-5 5 5v8zM14 20v-6l3-3 3 3v6' },
  village: { label: 'Деревня', minZoom: 0, group: 'settlements', size: 16, glyph: 'M5 20v-7l7-6 7 6v7zM10 20v-4h4v4' },
  castle: { label: 'Крепость', minZoom: -1, group: 'cities', size: 20, glyph: 'M4 20V6h3v3h3V6h4v3h3V6h3v14zM10 20v-5h4v5' },
  port: { label: 'Порт', minZoom: -0.75, group: 'settlements', size: 18, glyph: 'M12 3v17M8 7h8M5 13c0 4 3 7 7 7s7-3 7-7M12 3a2 2 0 100 0' },
  temple: { label: 'Храм', minZoom: -0.25, group: 'poi', size: 18, glyph: 'M12 3l9 6H3zM5 9v10M9 9v10M15 9v10M19 9v10M3 20h18' },
  tower: { label: 'Башня', minZoom: -1, group: 'poi', size: 18, glyph: 'M8 21l1-13h6l1 13zM7 8V4h2v2h2V4h2v2h2V4h2v4z' },
  ruins: { label: 'Руины', minZoom: 0, group: 'poi', size: 16, glyph: 'M4 20h16M6 20v-9h3v9M15 20v-6h3v6M10 8l3-3 2 2' },
  dungeon: { label: 'Подземелье', minZoom: 0, group: 'poi', size: 16, glyph: 'M4 20c0-8 4-14 8-14s8 6 8 14zM9 20v-5a3 3 0 016 0v5' },
  landmark: { label: 'Достопримечательность', minZoom: 0, group: 'poi', size: 16, glyph: 'M12 2l3 7h7l-6 4 2 8-6-5-6 5 2-8-6-4h7z' },
  battle: { label: 'Место битвы', minZoom: -2.6, group: 'poi', size: 20, glyph: 'M5 5l14 14M19 5L5 19M5 5v4M5 5h4M19 5v4M19 5h-4' }
}

export const PLACE_TYPE_OPTIONS = (Object.keys(PLACE_TYPES) as PlaceType[]).map((t) => ({
  value: t,
  label: PLACE_TYPES[t].label
}))

export interface PropDef {
  key: string
  label: string
  multiline?: boolean
}

export interface LinkDef {
  key: string
  label: string
  /** На какие записи может ссылаться; 'state' — государство */
  target: EntryKind | 'state' | 'place'
}

export interface KindMeta {
  label: string
  plural: string
  icon: IconName
  props: PropDef[]
  links: LinkDef[]
  /** Подписи для дат существования */
  fromLabel: string
  toLabel: string
}

export const KINDS: Record<EntryKind, KindMeta> = {
  character: {
    label: 'Персонаж',
    plural: 'Персонажи',
    icon: 'user',
    fromLabel: 'Родился',
    toLabel: 'Умер',
    props: [
      { key: 'race', label: 'Раса' },
      { key: 'gender', label: 'Пол' },
      { key: 'occupation', label: 'Род занятий / класс' },
      { key: 'alignment', label: 'Мировоззрение' },
      { key: 'appearance', label: 'Внешность', multiline: true },
      { key: 'personality', label: 'Характер', multiline: true }
    ],
    links: [
      { key: 'dynasty', label: 'Династия', target: 'dynasty' },
      { key: 'father', label: 'Отец', target: 'character' },
      { key: 'mother', label: 'Мать', target: 'character' },
      { key: 'spouse', label: 'Супруг(а)', target: 'character' },
      { key: 'state', label: 'Государство', target: 'state' },
      { key: 'religion', label: 'Вера', target: 'religion' },
      { key: 'people', label: 'Народ', target: 'people' },
      { key: 'organization', label: 'Организация', target: 'organization' }
    ]
  },
  god: {
    label: 'Божество',
    plural: 'Боги',
    icon: 'sun',
    fromLabel: 'Появление',
    toLabel: 'Гибель / заточение',
    props: [
      { key: 'rank', label: 'Статус (первозданное, верховное, божество, низшее, полубог)' },
      { key: 'domains', label: 'Аспект' },
      { key: 'houseRole', label: 'Роль в Доме' },
      { key: 'symbol', label: 'Символ / облик кратко' },
      { key: 'worshippers', label: 'Почитатели' },
      { key: 'cult', label: 'Культ и служение', multiline: true },
      { key: 'war', label: 'Война богов', multiline: true }
    ],
    links: [
      { key: 'religion', label: 'Дом', target: 'religion' },
      { key: 'parent', label: 'Создатель / родитель', target: 'god' },
      { key: 'sibling', label: 'Брат / сестра', target: 'god' },
      { key: 'consort', label: 'Супруг(а) / спутник', target: 'god' },
      { key: 'enemy', label: 'Заклятый враг', target: 'god' },
      { key: 'people', label: 'Народ-почитатель', target: 'people' }
    ]
  },
  religion: {
    label: 'Религия',
    plural: 'Религии',
    icon: 'flame',
    fromLabel: 'Основана',
    toLabel: 'Исчезла',
    props: [
      { key: 'type', label: 'Тип (монотеизм, пантеон, культ...)' },
      { key: 'head', label: 'Глава' },
      { key: 'center', label: 'Святой центр' },
      { key: 'followers', label: 'Последователи' },
      { key: 'rites', label: 'Обряды и праздники', multiline: true },
      { key: 'tenets', label: 'Учение', multiline: true }
    ],
    links: [
      { key: 'parentReligion', label: 'Ответвление от', target: 'religion' },
      { key: 'founder', label: 'Основатель', target: 'character' }
    ]
  },
  dynasty: {
    label: 'Династия',
    plural: 'Династии',
    icon: 'tree',
    fromLabel: 'Основана',
    toLabel: 'Угасла',
    props: [
      { key: 'motto', label: 'Девиз' },
      { key: 'seat', label: 'Родовое гнездо' }
    ],
    links: [
      { key: 'founder', label: 'Основатель', target: 'character' },
      { key: 'state', label: 'Правит в', target: 'state' },
      { key: 'parentDynasty', label: 'Ветвь династии', target: 'dynasty' }
    ]
  },
  people: {
    label: 'Народ',
    plural: 'Народы и расы',
    icon: 'people',
    fromLabel: 'Появление',
    toLabel: 'Исчезновение',
    props: [
      { key: 'race', label: 'Раса / группа' },
      { key: 'stats', label: 'Рост, вес, продолжительность жизни' },
      { key: 'features', label: 'Особенности', multiline: true },
      { key: 'origin', label: 'История появления', multiline: true },
      { key: 'appearance', label: 'Внешность', multiline: true },
      { key: 'lifestyle', label: 'Образ жизни и обитание', multiline: true },
      { key: 'language', label: 'Язык' },
      { key: 'traits', label: 'Черты характера', multiline: true },
      { key: 'customs', label: 'Обычаи', multiline: true },
      { key: 'gameBonus', label: 'Игровые бонусы (из старой ролевой)', multiline: true }
    ],
    links: [
      { key: 'parent', label: 'Ветвь народа', target: 'people' },
      { key: 'homeland', label: 'Родина / государство', target: 'state' },
      { key: 'religion', label: 'Основная вера', target: 'religion' },
      { key: 'god', label: 'Бог-покровитель', target: 'god' }
    ]
  },
  organization: {
    label: 'Организация',
    plural: 'Организации',
    icon: 'shield',
    fromLabel: 'Основана',
    toLabel: 'Распущена',
    props: [
      { key: 'type', label: 'Тип (орден, гильдия, культ...)' },
      { key: 'leader', label: 'Глава' },
      { key: 'headquarters', label: 'Штаб' },
      { key: 'members', label: 'Численность' },
      { key: 'goals', label: 'Цели', multiline: true }
    ],
    links: [
      { key: 'state', label: 'Покровитель', target: 'state' },
      { key: 'religion', label: 'Вера', target: 'religion' }
    ]
  },
  event: {
    label: 'Событие',
    plural: 'Хроники',
    icon: 'scroll',
    fromLabel: 'Начало',
    toLabel: 'Окончание',
    props: [
      { key: 'type', label: 'Тип (война, битва, договор...)' },
      { key: 'participants', label: 'Участники', multiline: true },
      { key: 'outcome', label: 'Итог', multiline: true }
    ],
    links: [{ key: 'place', label: 'Место', target: 'place' }]
  },
  artifact: {
    label: 'Артефакт',
    plural: 'Артефакты',
    icon: 'gem',
    fromLabel: 'Создан',
    toLabel: 'Уничтожен',
    props: [
      { key: 'type', label: 'Тип' },
      { key: 'rarity', label: 'Редкость' },
      { key: 'properties', label: 'Свойства', multiline: true }
    ],
    links: [
      { key: 'creator', label: 'Создатель', target: 'character' },
      { key: 'owner', label: 'Владелец', target: 'character' }
    ]
  },
  note: {
    label: 'Статья',
    plural: 'Книги и статьи',
    icon: 'note',
    fromLabel: 'С',
    toLabel: 'По',
    props: [],
    links: []
  }
}

export const KIND_ORDER: EntryKind[] = ['character', 'dynasty', 'god', 'religion', 'people', 'organization', 'event', 'artifact', 'note']

export const GOVERNMENTS = [
  'Абсолютная монархия',
  'Конституционная монархия',
  'Империя',
  'Теократия',
  'Республика',
  'Олигархия',
  'Торговая республика',
  'Феодальная раздробленность',
  'Племенной союз',
  'Орда',
  'Магократия',
  'Протекторат',
  'Конфедерация / лига'
]
