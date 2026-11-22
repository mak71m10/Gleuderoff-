// Родословные Уунааша: Дом Яффе (князья) и Дом Мелькер (Филь). Люди-основные (uu-*) созданы в uunaash.mjs — ссылки '@uu-…'.
export const TAG = 'Уунааш'
export const RACE = 'Человек (уунаашевец)'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, role = 'noble') =>
  [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret]

export const SPECS = [
  {
    dyn: 'uu-house-yaffe',
    people: [
      P('uuy-tamar', 'Тамар Яффе', 'f', 912, 980, null, null, '@uu-samuel', 'Жена Самуила', 'Вела счёт обозам Исхода: сколько семей, сколько хлеба, сколько ключей. Умерла в Авеле через три года после Хартии и велела похоронить себя лицом к Стене Ключей.', 'uu-house-yaffe', null, 'merchant'),
      P('uuy-sara', 'Сара Яффе', 'f', 940, 1002, null, null, '@uu-abram', 'Жена Абрама, княгиня', 'Лекарка из Мангена, вышла за Абрама в изгнании. В Зимний переход 987 г. открыла княжеские амбары, и к князю пришло больше дымов, чем ушло.', 'uu-house-yaffe', null, 'cleric'),
      P('uuy-yudit', 'Юдит Бенар, урождённая Яффе', 'f', 941, 1006, '@uu-samuel', 'uuy-tamar', null, 'Сестра Абрама, жена горного владетеля', 'Вышла за отца Леви Бенара в 960 г.; благодаря ей горцы Айно всегда присягали Яффе.', 'uu-house-benar', null),
      P('uuy-dina', 'Дина Яффе, урождённая Варбург', 'f', 966, null, null, null, '@uu-david', 'Вдова наследника Давида', 'Из семьи Варбург в Ландштадте, сестра Леи. После шторма 1004 г. носит чёрное и держит дом в Лаяно у самого мола.', 'uu-house-yaffe', 'Уверена, что Давида послали в шторм нарочно; ищет письмо, которое лежит у Ханы Тальман.'),
      P('uuy-benjamin', 'Беньямин Ашер', 'm', 960, 987, null, null, '@uu-miriam', 'Муж Мирьям, писец Книги', 'Погиб в давке у Стены Ключей в голодный День Ворот 987 г., защищая Книгу Дымов.', 'uu-house-yaffe', null, 'scholar'),
      P('uuy-ester', 'Эстер Ашер', 'f', 986, null, 'uuy-benjamin', '@uu-miriam', null, 'Дочь Мирьям, младший писец', 'Двадцать четыре года, переписывает вторую книгу матери по ночам и знает, какие дальние дымы фальшивы.', 'uu-house-yaffe', null, 'scholar'),
    ],
    patch: [
      ['@uu-samuel', { spouse: 'uuy-tamar' }],
      ['@uu-abram', { father: '@uu-samuel', mother: 'uuy-tamar', spouse: 'uuy-sara' }],
      ['@uu-david', { father: '@uu-abram', mother: 'uuy-sara', spouse: 'uuy-dina' }],
      ['@uu-miriam', { father: '@uu-abram', mother: 'uuy-sara', spouse: 'uuy-benjamin' }],
      ['@uu-natan', { father: '@uu-david', mother: 'uuy-dina' }],
    ],
  },
  {
    dyn: 'uu-house-melker',
    people: [
      P('uum-joel', 'Йоэль Мелькер', 'm', 925, 990, null, null, null, 'Отец Элиаса, сапожник', 'Сапожник из Республики; в 976 г. пошёл за обозами Яффе с одной колодкой и двумя сыновьями.', 'uu-house-melker', null, 'folk'),
      P('uum-naomi', 'Наоми Мелькер', 'f', 958, null, null, null, '@uu-elias', 'Жена Элиаса', 'Держит суконный ряд Филя и знает цену каждому локтю. Не любит, когда муж говорит о ключе.', 'uu-house-melker', null, 'merchant'),
      P('uum-matias', 'Матиас Мелькер', 'm', 984, null, '@uu-elias', 'uum-naomi', null, 'Наследник Филя, глава конторы дальних дымов', 'Двадцать шесть лет, круглолицый, всегда с пером за ухом. Ведёт контору, где записывают семьи из-за границы, и сам верит, что все записи настоящие.', 'uu-house-melker', null, 'merchant'),
    ],
    patch: [
      ['@uu-elias', { father: 'uum-joel', spouse: 'uum-naomi' }],
      ['@uu-rachel', { father: '@uu-elias', mother: 'uum-naomi' }],
    ],
  },
]
