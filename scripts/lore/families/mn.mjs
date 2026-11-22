// Родословная Магнолии: королевский дом Оттект от Каэльта (712) до тайного сына наследника. Основные люди (mn-*) — в magnolia.mjs.
export const TAG = 'Магнолия'
export const RACE = 'Сумеречный эльф (Магнолия)'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, role = 'noble') =>
  [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret]

export const SPECS = [
  {
    dyn: 'mn-house-ottekt',
    people: [
      P('mno-sair', 'Сайр Кан Оттект', 'm', 713, 862, '@mn-kaelt', '@mn-niara', 'mno-lais', 'Князь Двух Берегов, сын Каэльта', 'Первым родился уже в Союзе: ребёнок обоих берегов. Погиб, прикрывая уход жриц с Чашей, когда горели храмы в 862 г.', 'mn-house-ottekt', null),
      P('mno-lais', 'Лаэс Ир Наэрат', 'f', 712, 900, null, null, 'mno-sair', 'Жена Сайра, жрица', 'Унесла Чашу Наллы в пещеру под Гливином и до смерти не сказала, где тайник, никому, кроме дочери.', 'mn-house-naerat', null, 'cleric'),
      P('mno-velt', 'Вэлтор Кан Оттект', 'm', 750, 931, 'mno-sair', 'mno-lais', null, 'Вождь подполья', 'Сто лет водил «серые тени» по дорогам Веринландии. Отец Арнама. Убит легионерами у Гливина.', 'mn-house-ottekt', null, 'soldier'),
      P('mno-marta', 'Марта из Альена', 'f', 970, null, null, null, null, 'Служанка замка Альен', 'Сорок лет, человек. Мать Дена. Работает на кухне, где растёт её сын, и никогда не поднимает глаз на господина.', 'mn-house-ottekt', 'Каэрон каждую зиму присылает ей серебро без записки.', 'folk')
    ],
    patch: [
      ['@mn-kaelt', { spouse: '@mn-niara' }],
      ['@mn-niara', { spouse: '@mn-kaelt' }],
      ['@mn-arnam', { father: 'mno-velt', spouse: '@mn-ilsae' }],
      ['@mn-ilsae', { spouse: '@mn-arnam' }],
      ['@mn-kaeron', { father: '@mn-arnam', mother: '@mn-ilsae' }],
      ['@mn-inne', { father: '@mn-arnam', mother: '@mn-ilsae' }],
      ['@mn-den', { father: '@mn-kaeron', mother: 'mno-marta' }]
    ]
  }
]
