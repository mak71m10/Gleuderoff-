// Родословные Высокогорного Княжества, Фарвольской лиги и Креита: родители, жёны и мужья, дети и внуки; связи Выводка Креита.
// Кортеж: [ключ, имя, пол(m|f), родился, умер, отец, мать, супруг, должность/суть, текст, образ, дом, тайна]
export const TAG = 'Высокогорное Княжество'
export const MODULES = [
  {
    tag: 'Высокогорное Княжество',
    specs: [
      {
        dyn: 'hl-house-adler',
        people: [
          ['hA-ulr', 'Ульрих Адлерхорн', 'm', 900, 965, null, null, 'hA-ber', 'Маркграф Высоты при Империи', 'Последний маркграф Высоты по императорской грамоте. Держал перевалы и ни разу не спустился в долину без дела.', 'noble'],
          ['hA-ber', 'Берта Адлерхорн', 'f', 905, 975, null, null, 'hA-ulr', 'Маркграфиня Высоты', 'Дочь горного рыцаря. Первой стала подниматься на Химмельскранц пешком, а не в корзине.', 'noble'],
          ['hA-lis', 'Лисбет Адлерхорн', 'f', 935, 990, null, null, '@hl-sigmund', 'Жена Зигмунда', 'Родила троих детей на высоте и ни одного не спустила вниз до пяти лет: «Пусть привыкают».', 'noble'],
          ['hA-ger', 'Герхард Адлерхорн', 'm', 960, 1001, '@hl-sigmund', 'hA-lis', null, 'Младший сын Зигмунда', 'Командир Горной стражи. Погиб на перевале, так и не став князем, но дав племяннику урок.', 'soldier'],
          ['hA-ada', 'Аделинда Адлерхорн', 'f', 964, null, '@hl-sigmund', 'hA-lis', null, 'Сестра князя Альбрехта', 'Игуменья горного монастыря. Не любит Вечерний колокол — говорит, что он звонит слишком по расписанию.', 'cleric'],
          ['hA-ele', 'Элеонора Адлерхорн', 'f', 989, null, '@hl-albrecht', '@hl-kunigunde', null, 'Сестра князя Максимилиана', 'Двадцать один год. Живёт в Химмельскранце, учится у матери править и нетерпелива, как отец.', 'noble'],
          ['hA-fri', 'Фридрих Адлерхорн', 'm', 992, null, '@hl-albrecht', '@hl-kunigunde', null, 'Младший брат князя', 'Восемнадцать лет, оруженосец Горной стражи. Если с братом что-то случится, наследует Высоту он.', 'soldier']
        ],
        patch: [
          ['@hl-sigmund', { father: 'hA-ulr', mother: 'hA-ber', spouse: 'hA-lis' }],
          ['@hl-albrecht', { father: '@hl-sigmund', mother: 'hA-lis', spouse: '@hl-kunigunde' }],
          ['@hl-kunigunde', { spouse: '@hl-albrecht' }],
          ['@hl-max', { father: '@hl-albrecht', mother: '@hl-kunigunde' }]
        ]
      },
      {
        dyn: 'hl-house-schnee',
        people: [
          ['hS-vil', 'Вильгельм Шнееберг', 'm', 925, 990, null, null, 'hS-mar', 'Хранитель Великого Ворота', 'Первым в роду получил ключи от Великого Ворота и повесил их над дверью как семейное украшение.', 'noble'],
          ['hS-mar', 'Маргарета Шнееберг', 'f', 930, 995, null, null, 'hS-vil', 'Хозяйка Шнееберга', 'Держала дом на высоте и знала, чей подъёмник работает, а чей — только числится.', 'noble'],
          ['hS-ing', 'Ингеборг Шнееберг', 'f', 960, null, null, null, '@hl-eberhard', 'Жена Эберхарда', 'Дочь горного рыцаря. Ведёт хозяйство замка Шнееберг и подписывает ключевые бумаги вместе с мужем.', 'noble'],
          ['hS-hug', 'Гуго Шнееберг', 'm', 985, null, '@hl-eberhard', 'hS-ing', null, 'Наследник Шнееберга', 'Двадцать пять лет, надзиратель подъёмников. Мечтает о том дне, когда Великий Ворот станет его.', 'noble'],
          ['hS-eli', 'Элиза Шнееберг', 'f', 990, null, '@hl-eberhard', 'hS-ing', null, 'Дочь Эберхарда', 'Двадцать лет. Шьёт знамёна для Вечернего колокола и поёт, пока шьёт.', 'noble']
        ],
        patch: [
          ['@hl-eberhard', { father: 'hS-vil', mother: 'hS-mar', spouse: 'hS-ing' }],
          ['@hl-kunigunde', { father: 'hS-vil', mother: 'hS-mar' }]
        ]
      }
    ]
  },
  {
    tag: 'Фарвольская лига',
    race: 'Гном',
    specs: [
      {
        dyn: 'fv-iron',
        people: [
          ['fI-mei', 'Мейвис Железная', 'f', 820, 990, null, null, '@fv-uldrich', 'Жена Ульдриха', 'Гномка-кузнец, первая принявшая титул «Железной вдовы»; от неё в роду идёт обычай, что жена кует печать мужа.', 'folk'],
          ['fI-hag', 'Хаммонд Железный', 'm', 865, 985, '@fv-uldrich', 'fI-mei', 'fI-hel', 'Брат Ортвина', 'Мастер Горнила. Отец нынешнего Первого Молота и самый молчаливый из Железных.', 'folk'],
          ['fI-oto', 'Оттис Железный', 'm', 868, 990, '@fv-uldrich', 'fI-mei', 'fI-ber', 'Брат Ортвина', 'Мастер весов Лиги. Отец Фенвика, державший счёт щитов до первой переписи.', 'folk'],
          ['fI-ode', 'Одилия Железная', 'f', 870, 1005, null, null, '@fv-ortwin', 'Жена Ортвина', 'Мать Тибора. Пережила сына, и последние годы жизни перечитывала его письма.', 'folk'],
          ['fI-hel', 'Хельга Железная', 'f', 870, 985, null, null, 'fI-hag', 'Жена Хаммонда', 'Мать Гилдартса. Единственная, кто мог упрекнуть Первого Молота и остаться при месте.', 'folk'],
          ['fI-ber', 'Берна Железная', 'f', 872, 995, null, null, 'fI-oto', 'Жена Оттиса', 'Мать Фенвика. Вела ломбард при Переписи Наковальни.', 'folk'],
          ['fI-gre', 'Грета Железная', 'f', 930, null, null, null, '@fv-gildarts', 'Жена Гилдартса', 'Хозяйка Норг-Бада. Умеет договариваться с торговыми домами лучше мужа и не отказывается от этого.', 'folk'],
          ['fI-gal', 'Гальвин Железный', 'm', 955, null, '@fv-gildarts', 'fI-gre', null, 'Посол Лиги', 'Сын Гилдартса. Пятьдесят пять лет, ведёт переговоры с Лигой и Чеафаралом.', 'folk'],
          ['fI-ilm', 'Ильма Железная', 'f', 960, null, '@fv-gildarts', 'fI-gre', null, 'Дочь Первого Молота', 'Пятьдесят лет, хранит документы Палаты Шестерни.', 'folk']
        ],
        patch: [
          ['@fv-uldrich', { spouse: 'fI-mei' }],
          ['@fv-ortwin', { father: '@fv-uldrich', mother: 'fI-mei', spouse: 'fI-ode' }],
          ['@fv-tibor', { father: '@fv-ortwin', mother: 'fI-ode' }],
          ['@fv-gildarts', { father: 'fI-hag', mother: 'fI-hel', spouse: 'fI-gre' }],
          ['@fv-fenwick', { father: 'fI-oto', mother: 'fI-ber' }]
        ]
      }
    ]
  },
  {
    tag: 'Графство Штирия',
    specs: [{ dyn: 'house-styria', people: [], patch: [
          ['@sty-gottfried', { father: '@sty-ulrich' }],
          ['@sty-adelheid', { father: '@sty-gottfried' }],
          ['@sty-wolfram', { mother: '@sty-adelheid' }],
          ['@sty-ruprecht', { father: '@sty-wolfram' }],
          ['@sty-sieghild', { father: '@sty-ruprecht' }],
          ['@sty-lothar', { mother: '@sty-sieghild' }],
          ['@sty-anselm', { father: '@sty-lothar' }],
          ['@sty-mathilda', { father: '@sty-anselm' }],
          ['@sty-bertold', { mother: '@sty-mathilda' }],
          ['@sty-dietmar', { father: '@sty-bertold' }],
          ['@sty-otto', { father: '@sty-dietmar' }],
          ['@sty-heinrich', { father: '@sty-otto' }],
          ['@sty-leopold', { father: '@sty-heinrich' }],
          ['@sty-august', { father: '@sty-leopold' }],
          ['@sty-gisela', { father: '@sty-august' }],
          ['@styria-now', { mother: '@sty-gisela' }],
          ['@sty-sibylla', { father: '@styria-now' }],
          ['@sty-ludwig', { father: '@styria-now' }]
    ] }]
  },
  {
    tag: 'Креит',
    race: 'Человек (креитский норд)',
    specs: [
      {
        dyn: 'kr-ett-malm',
        people: [],
        patch: [
          ['@kr-grimkel', { spouse: '@kr-vigdis' }],
          ['@kr-b1-ragnvald', { father: '@kr-grimkel' }]
        ]
      }
    ]
  }
]
