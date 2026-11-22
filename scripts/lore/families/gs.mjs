// Родословные Берегов Гренинсворда: семьи консулов Этнора (де-Вран) и Дрогенмау (Дроге), лоцманы Тинд.
// «Династии» здесь — полисы (gs-polis-*); люди-основные (gs-*) созданы в greninsword.mjs — ссылки '@gs-…'.
export const TAG = 'Объединённые Берега Гренинсворда'
export const RACE = 'Человек (норд залива)'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, role = 'noble') =>
  [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret]

export const SPECS = [
  {
    dyn: 'gs-polis-etnor',
    people: [
      P('gse-anna', 'Анна де-Вран', 'f', 944, 1001, null, null, '@gs-oskar', 'Жена корабела Оскара', 'Шила паруса для коггов войны 976 г. и пережила мужа на два года.', 'gs-polis-etnor', null, 'folk'),
      P('gse-eirik', 'Эйрик Сельм', 'm', 968, 1005, null, null, '@gs-maria', 'Муж Марии, шкипер', 'Водил когги Этнора к Гарефорду через Орхайм. Погиб в 1005 г., когда лёд раздавил его ког у самой гавани.', 'gs-polis-etnor', 'Его ког стоял у Этнора, потому что гавань Дрогенмау в ту зиму «была открыта» — Эйрик шёл туда, поверив Ледовой книге.', 'soldier'),
      P('gse-oskar2', 'Оскар де-Вран (младший)', 'm', 998, null, '@gs-eirik', '@gs-maria', null, 'Сын Марии, ученик на верфи', 'Двенадцать лет, строгает модели коггов и мечтает о ледоколе, как у Дрогенмау.', 'gs-polis-etnor', null, 'child'),
    ],
    patch: [
      ['@gs-oskar', { spouse: 'gse-anna' }],
      ['@gs-maria', { father: '@gs-oskar', mother: 'gse-anna', spouse: 'gse-eirik' }],
    ],
  },
  {
    dyn: 'gs-polis-drogen',
    people: [
      P('gsd-sigrid', 'Сигрид Дроге', 'f', 962, null, null, null, '@gs-gunnar', 'Жена Гуннара', 'Держит дом консула и считает пайки гарнизона. Не любит саней-ледоколов: они гремят под окнами по ночам.', 'gs-polis-drogen', null, 'merchant'),
      P('gsd-tord', 'Торд Дроге', 'm', 982, null, '@gs-gunnar', 'gsd-sigrid', null, 'Капитан плавучей крепости', 'Двадцать восемь лет, такой же огромный, как отец; командует «Скалой», самой большой крепостью флота.', 'gs-polis-drogen', null, 'soldier'),
    ],
    patch: [['@gs-gunnar', { spouse: 'gsd-sigrid' }]],
  },
  {
    dyn: 'gs-polis-drogen',
    people: [
      P('gst-arne', 'Арне Тинд', 'm', 960, 989, '@gs-ulvar', null, null, 'Лоцман, сын Ульвара', 'Погиб на причале Этнора в Набег Сигрунгов 989 г., отводя лодки от горящих драккаров.', 'gs-polis-drogen', null, 'folk'),
    ],
    patch: [['@gs-ragna', { father: 'gst-arne' }]],
  },
]
