// Родословные Болетарии: королевский Дом Белмор (от Балдуина III до внуков Годфрида) и Дом Хальвейн (кровь Ирмелинды).
// Люди-основные (bt-*, bt-k-*) созданы в boletaria.mjs: на них ссылки '@bt-…'.
export const TAG = 'Королевство Болетария'
export const RACE = 'Человек (болетарец)'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, role = 'noble') =>
  [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret]

export const SPECS = [
  {
    dyn: 'bt-house-belmor',
    people: [
      P('btb-gisela', 'Гизела Белмор', 'f', 878, 940, null, null, '@bt-k-baldwin3', 'Королева, жена Балдуина III', 'Урождённая Геринхайм. Привезла в Бельфор сундук молитвенников и не вынула из него ни одной книги, кроме счётной.', 'bt-house-gerin', null),
      P('btb-oda', 'Ода Белмор', 'f', 910, 972, null, null, '@bt-k-lothric1', 'Королева, жена Лотрика I', 'Урождённая Тирер, дочь маркграфа. Сорок лет держала ключ от королевской кладовой и ни разу не дала мужу лишней марки на турнир.', 'bt-house-tirer', null),
      P('btb-oswin', 'Освин Белмор', 'm', 993, 1001, '@bt-lothric2', '@bt-adalheid', null, 'Младший сын Лотрика II', 'Умер восьми лет от горячки. Его маленькая жаровня стоит не в Галерее, а в часовне королевы.', 'bt-house-belmor', 'Адальгейда винит в его смерти лекаря Инквизиции, который не позволил звать врача из Когалыма: «чужеземцу — только торг».', 'child'),
      P('btb-mechtild', 'Мехтильда Белмор', 'f', 955, null, null, null, '@bt-godfrid', 'Жена Годфрида', 'Урождённая Фойен, сестра Великого магистра. Носит на поясе маленький серебряный грифон и говорит о Своде так, будто сама его писала.', 'bt-house-foyen', null),
      P('btb-bertram', 'Бертрам Белмор', 'm', 978, null, '@bt-godfrid', 'btb-mechtild', 'btb-ulrike', 'Рыцарь Ордена Грифона, сын Годфрида', 'Тридцать два года, огромный, в латах дяди-магистра. Второй в очереди на трон после отца. Не любит книги и не любит короля — но любит его сестру Ирму, как брат.', 'bt-house-belmor', null, 'soldier'),
      P('btb-ulrike', 'Ульрика Белмор', 'f', 981, null, null, null, 'btb-bertram', 'Жена Бертрама', 'Урождённая Хальвейн, внучатая племянница Хедды. Её приданое — сорок угольных ям под Балфиерой.', 'bt-house-halwein', null),
      P('btb-alarich', 'Аларик Белмор', 'm', 1004, null, 'btb-bertram', 'btb-ulrike', null, 'Сын Бертрама', 'Шести лет. Уже ходит за дедом Годфридом по Галерее и знает тридцать королей наизусть.', 'bt-house-belmor', null, 'child'),
      P('btb-hildegard', 'Хильдегард Белмор', 'f', 984, null, '@bt-godfrid', 'btb-mechtild', null, 'Дочь Годфрида, послушница Храмов Огня', 'Двадцать шесть лет, коротко острижена под покрывалом. Выбрала второй путь служения и подливает масло в жаровни Галереи.', 'bt-house-belmor', 'Тайком гасит на ночь жаровню Ирмелинды и зажигает до рассвета: «пусть привыкнет».', 'cleric')
    ],
    patch: [
      ['@bt-k-lothric1', { father: '@bt-k-baldwin3', mother: 'btb-gisela', spouse: 'btb-oda' }],
      ['@bt-k-baldwin3', { spouse: 'btb-gisela' }],
      ['@bt-lothric2', { father: '@bt-k-lothric1', mother: 'btb-oda', spouse: '@bt-adalheid' }],
      ['@bt-godfrid', { father: '@bt-k-lothric1', mother: 'btb-oda', spouse: 'btb-mechtild' }],
      ['@bt-adalheid', { spouse: '@bt-lothric2' }],
      ['@bt-lothric3', { father: '@bt-lothric2', mother: '@bt-adalheid' }],
      ['@bt-irma', { father: '@bt-lothric2', mother: '@bt-adalheid' }]
    ]
  },
  {
    dyn: 'bt-house-halwein',
    people: [
      P('bth-ansgar', 'Ансгар Хальвейн', 'm', 945, 999, null, null, '@bt-hedda', 'Глава дома Хальвейн (972–999)', 'Муж Хедды. Расширил угольные ямы вдвое и умер от дыма в собственной яме — так говорят. Хедда носит его перчатки.', 'bt-house-halwein', null, 'merchant'),
      P('bth-wolfram', 'Вольфрам Хальвейн', 'm', 970, null, 'bth-ansgar', '@bt-hedda', 'bth-oda', 'Сын Хедды, хозяин делянок', 'Сорок лет, тихий, с вечным кашлем углежога. Ведёт лесные делянки и делает всё, что скажет мать.', 'bt-house-halwein', null, 'merchant'),
      P('bth-oda', 'Ода Хальвейн', 'f', 973, null, null, null, 'bth-wolfram', 'Жена Вольфрама', 'Урождённая Штайн, младшая сестра Пламенного судьи Бенно Штайна. Через неё хлеб Хальвейнов доходит до судейского стола.', 'bt-house-halwein', null),
      P('bth-greta', 'Грета Хальвейн', 'f', 994, null, 'bth-wolfram', 'bth-oda', null, 'Сестра Эгберта', 'Шестнадцать лет, острая на язык. Единственная в доме говорит вслух, что ворота надо открыть.', 'bt-house-halwein', null)
    ],
    patch: [
      ['@bt-hedda', { spouse: 'bth-ansgar' }],
      ['@bt-egbert', { father: 'bth-wolfram', mother: 'bth-oda' }]
    ]
  }
]
