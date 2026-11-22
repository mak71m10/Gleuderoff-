// Родословные Северной Башни: семьи Вейд и Аск. Люди-основные (nt-*) созданы в ntower.mjs — ссылки '@nt-…'. «Династия» — Коллегия (nt-house-*).
export const TAG = 'Северная Башня'
export const RACE = 'Человек (норд)'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, role = 'noble') =>
  [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret]

export const SPECS = [
  {
    dyn: 'nt-house-veid',
    people: [
      P('ntv-ragnhild', 'Рагнхильд Вейд', 'f', 935, 1000, null, null, '@nt-hjalmar', 'Жена Хьялмара', 'Варила на маяке похлёбку для всей стражи Тореоса и не верила в магию мужа.', 'nt-house-veid', null, 'folk'),
      P('ntv-sunniva', 'Суннива Вейд', 'f', 962, null, null, null, '@nt-ulrik', 'Жена Ульрика', 'Держит дом Хранителя в Тореосе и не знает, чем её муж платит за дрова.', 'nt-house-veid', 'Знает, что муж берёт серебро, и ведёт счёт отдельной книгой — на случай суда.', 'merchant'),
    ],
    patch: [
      ['@nt-hjalmar', { spouse: 'ntv-ragnhild' }],
      ['@nt-ulrik', { father: '@nt-hjalmar', mother: 'ntv-ragnhild', spouse: 'ntv-sunniva' }],
      ['@nt-lisa', { father: '@nt-ulrik', mother: 'ntv-sunniva' }],
    ],
  },
  {
    dyn: 'nt-house-ask',
    people: [
      P('nta-bodil', 'Бодил Аск', 'f', 912, 985, null, null, null, 'Мать Герд, повитуха', 'Приняла роды у половины Тореоса.', 'nt-house-ask', null, 'folk'),
    ],
    patch: [
      ['@nt-gerd', { mother: 'nta-bodil' }],
      ['@nt-torbjorn', { mother: '@nt-gerd' }],
    ],
  },
]
