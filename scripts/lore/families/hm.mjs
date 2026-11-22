// Родословные Харнмарка: Дом Харн и пять Домов Разрядной книги (Ройвен, Зигмарк, Грисхольм, Эльмин, Эшенхольм).
// Кортеж как в el.mjs; помощник P заполняет роль и порядок полей. Люди-основные (hm-*) уже созданы в harnmark.mjs: на них ссылки '@hm-…'.
export const TAG = 'Княжество Харнмарк'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, role = 'noble') =>
  [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret]

export const SPECS = [
  {
    dyn: 'hm-house-harn',
    people: [
      P('hmh-ottilie', 'Оттилия фон Харн', 'f', 935, 985, null, null, '@hm-erich1', 'Жена Эриха I, княгиня', 'Оттилия вышла за маршала двадцати лет и тридцать лет следовала за его обозом. Умерла в Орельберге за три года до Ночи пустой колыбели, не увидев, как рушится залог.', 'hm-house-harn', null),
      P('hmh-brunhild', 'Брунгильда фон Харн', 'f', 965, null, null, null, '@hm-gugo', 'Жена маршала Гуго', 'Брунгильда держит двор маршала и тихо вышивает знамёна стражи. Отговаривает Гуго от писем в Империю, но он её не слушает.', 'hm-house-harn', 'Прочла письмо Гуго послу Империи о «маршальской опеке» над юным князем, сожгла его и никому не сказала.'),
      P('hmh-albrecht', 'Альбрехт фон Харн', 'm', 990, null, '@hm-gugo', 'hmh-brunhild', null, 'Сотник Дворцовой стражи, сын Гуго', 'Двадцатилетний Альбрехт, широкоплечий и румяный, делит караул с Фолькером. Мечтает о походе и боится отца.', 'hm-house-harn', null, 'soldier'),
      P('hmh-karl', 'Карл фон Харн', 'm', 992, 994, '@hm-fridrich', '@hm-adelgunda', null, 'Старший сын Фридриха', 'Первенец Фридриха умер двух лет от кори; после него Адельгунда лечила Эриха от каждого чиха.', 'hm-house-harn', null, 'child'),
    ],
    patch: [
      ['@hm-erich1', { spouse: 'hmh-ottilie' }],
      ['@hm-fridrich', { father: '@hm-erich1', mother: 'hmh-ottilie', spouse: '@hm-adelgunda' }],
      ['@hm-gugo', { father: '@hm-erich1', mother: 'hmh-ottilie', spouse: 'hmh-brunhild' }],
      ['@hm-adelgunda', { father: '@hm-verner', spouse: '@hm-fridrich' }],
      ['@hm-erich2', { father: '@hm-fridrich', mother: '@hm-adelgunda' }],
      ['@hm-liselotte', { father: '@hm-fridrich', mother: '@hm-adelgunda' }],
    ],
  },
  {
    dyn: 'hm-house-royven',
    people: [
      P('hmr-mathilde', 'Матильда Ройвен', 'f', 925, 970, null, null, '@hm-ulrich', 'Жена Ульриха, княгиня Ройвена', 'Матильда родила князю сына и умерла молодой; Ульрих ставил за неё свечу каждый Лаций до самой смерти.', 'hm-house-royven', null),
      P('hmr-gisela', 'Гизела Ройвен', 'f', 955, 990, null, null, '@hm-otto', 'Первая жена Отто', 'Гизела родила Берту и пережила её на два года. После Ночи пустой колыбели она перестала выходить из дома и умерла от тоски.', 'hm-house-royven', null),
      P('hmr-hedwig', 'Хедвиг Ройвен, урождённая фон Харн', 'f', 963, null, '@hm-erich1', 'hmh-ottilie', '@hm-otto', 'Вторая жена Отто, дочь Эриха I', 'Хедвиг вышла за Отто через пять лет после смерти Гизелы, и это был первый брак Харнов с Ройвеном. Любит сына Герхарда и ненавидит, что он подаёт кубок за столом, где его отец сидит ниже её брата.', 'hm-house-royven', 'Тайком передаёт брату Гуго всё, что Герхард слышит за столом, минуя мужа.'),
      P('hmr-mathilde2', 'Матильда Ройвен (младшая)', 'f', 999, null, '@hm-otto', 'hmr-hedwig', null, 'Дочь Отто, внучка Эриха I', 'Одиннадцатилетняя Матильда носит бабушкино имя и орлиный нос; воспитывается дома и спрашивает, когда вернётся брат.', 'hm-house-royven', null, 'child'),
    ],
    patch: [
      ['@hm-ulrich', { spouse: 'hmr-mathilde' }],
      ['@hm-otto', { father: '@hm-ulrich', mother: 'hmr-mathilde', spouse: 'hmr-hedwig' }],
      ['@hm-berta', { father: '@hm-otto', mother: 'hmr-gisela' }],
      ['@hm-gerhard', { father: '@hm-otto', mother: 'hmr-hedwig' }],
    ],
  },
  {
    dyn: 'hm-house-zigmark',
    people: [
      P('hmz-irmgard', 'Ирмгард Зигмарк', 'f', 940, 1000, null, null, '@hm-verner', 'Жена Вернера', 'Ирмгард вырастила Адельгунду и научила её считать на пальцах. Умерла в 1000-м; Адельгунда не успела приехать из Орельберга на похороны.', 'hm-house-zigmark', null),
      P('hmz-katharina', 'Катарина Зигмарк', 'f', 972, null, null, null, '@hm-anselm', 'Жена Ансельма', 'Катарина потеряла сына Лукаса после пира выдачи 1005 г. и с тех пор держит в Зигинхольме свои глаза и уши. Ей не говорят, что Ансельм подозревает яд.', 'hm-house-zigmark', 'Нашла в вещах Лукаса пустой пузырёк и спрятала его.'),
      P('hmz-lukas', 'Лукас Зигмарк', 'm', 996, 1005, '@hm-anselm', 'hmz-katharina', null, 'Стольник князя (1003–1005)', 'Девятилетний Лукас подавал кубки на пиру, где его отца выдали головою Ройвенам, и через месяц умер «от лихорадки». Рисовал волков на полях росписи мест.', 'hm-house-zigmark', 'Перед смертью шепнул монахине Агнес, что «вино было горьким».', 'child'),
    ],
    patch: [
      ['@hm-verner', { spouse: 'hmz-irmgard' }],
      ['@hm-anselm', { father: '@hm-verner', mother: 'hmz-irmgard', spouse: 'hmz-katharina' }],
      ['@hm-konrad-z', { father: '@hm-anselm', mother: 'hmz-katharina' }],
    ],
  },
  {
    dyn: 'hm-house-grishold',
    people: [
      P('hmg-gero', 'Геро Грисхольм', 'm', 920, 985, null, null, 'hmg-walburga', 'Старый граф Грисхольма', 'Геро держал Унтерельхольм как крепость и не признавал ни Империю, ни Республику. Умер, не дожив до Ночи пустой колыбели.', 'hm-house-grishold', null),
      P('hmg-walburga', 'Вальбурга Грисхольм', 'f', 925, 990, null, null, 'hmg-gero', 'Мать Дитмара', 'Вальбурга пережила мужа на пять лет и успела проклясть Харна за то, что дети Грисхольма живут в Орельберге.', 'hm-house-grishold', null),
      P('hmg-sieglinde', 'Зиглинда Грисхольм', 'f', 958, null, null, null, '@hm-ditmar', 'Жена Дитмара', 'Зиглинда молчит за столом и слушает за дверью; тайком ездит в Орельберг повидать сына-рынду, пока Дитмар в отъезде. Считает, что Дом заплатил за честь слишком дорого.', 'hm-house-grishold', 'Знает, что Ганс ездил в Орельберг в 1003 г., но не знает, зачем.'),
      P('hmg-greta', 'Грета Грисхольм', 'f', 992, null, '@hm-ditmar', 'hmg-sieglinde', null, 'Дочь Дитмара', 'Восемнадцатилетняя Грета ждёт сватов и мечтает уехать подальше от Унтерельхольма.', 'hm-house-grishold', null),
    ],
    patch: [
      ['@hm-ditmar', { father: 'hmg-gero', mother: 'hmg-walburga', spouse: 'hmg-sieglinde' }],
      ['@hm-rudolf', { father: '@hm-ditmar', mother: 'hmg-sieglinde' }],
    ],
  },
  {
    dyn: 'hm-house-elmin',
    people: [
      P('hme-bertram', 'Бертрам Эльмин', 'm', 925, 990, null, null, null, 'Корабельщик, отец Маренны', 'Бертрам построил первые три судна Дома и вывел его в Хартию. Умер на палубе, не доехав до порта.', 'hm-house-elmin', null),
      P('hme-johann', 'Иоганн Эльмин', 'm', 955, null, null, null, '@hm-marenna', 'Муж Маренны, купец', 'Иоганн торгует перевальной солью и ведёт бумаги жены. Тише и осторожнее её, любит рыбу и шахматы.', 'hm-house-elmin', 'Знает, кому именно Маренна продаёт хлеб, и не рассказывает об этом никому.'),
      P('hme-hartmut', 'Хартмут Эльмин', 'm', 985, null, '@hm-marenna', 'hme-johann', null, 'Капитан «Белой чайки»', 'Двадцатипятилетний Хартмут водит хлебные суда в Таварвайт и обратно. Любит рассказывать, что видит больше матери.', 'hm-house-elmin', null, 'soldier'),
    ],
    patch: [
      ['@hm-marenna', { father: 'hme-bertram', spouse: 'hme-johann' }],
      ['@hm-lizbet', { father: 'hme-johann', mother: '@hm-marenna' }],
    ],
  },
  {
    dyn: 'hm-house-eschen',
    people: [
      P('hms-ursula', 'Урсула Эшенхольм', 'f', 955, 995, null, null, '@hm-kaspar', 'Жена Каспара', 'Урсула умерла через семь лет после смерти сына; Каспар до сих пор носит в кармане ленту от её косы.', 'hm-house-eschen', null),
      P('hms-matthaus', 'Маттеус Эшенхольм', 'm', 976, null, '@hm-kaspar', 'hms-ursula', 'hms-greta', 'Наследник Дома Эшенхольм', 'Маттеус командует заставой у перевала и ненавидит отца за лирийское золото. Служит в строю, а не при дворе.', 'hm-house-eschen', 'Считает, что взятое золото принадлежит Дому, а не Каспару, и копит доказательства.', 'soldier'),
      P('hms-greta', 'Грета Эшенхольм', 'f', 980, null, null, null, 'hms-matthaus', 'Жена Маттеуса', 'Грета родила Вальтера и дочь Анну; в Гостином доме ходит к сыну чаще, чем разрешено.', 'hm-house-eschen', null),
      P('hms-anna', 'Анна Эшенхольм', 'f', 1004, null, 'hms-matthaus', 'hms-greta', null, 'Дочь Маттеуса', 'Шестилетняя Анна упрямо просит у отца деревянного коня, как у брата, не зная о Конраде.', 'hm-house-eschen', null, 'child'),
    ],
    patch: [
      ['@hm-kaspar', { spouse: 'hms-ursula' }],
      ['@hm-konrad-e', { father: '@hm-kaspar', mother: 'hms-ursula' }],
      ['@hm-valter', { father: 'hms-matthaus', mother: 'hms-greta' }],
    ],
  },
]
