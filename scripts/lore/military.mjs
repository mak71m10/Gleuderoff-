// Армии стран ВПИ (docs/впи-армия.md): названия ступеней, законы призыва, уставные роты по культурам,
// свои рода войск стран, имена командиров и названия частей. Используется scripts/military-seed.mjs.
// Устав роты: [id, название, род войск, { слот: деталь }, [снаряжение и магия], заметка]

const tpl = (id, name, arm, parts, kit = [], note = '') => ({ id, name, arm, parts, kit, note })

// ---------- лестницы: рота, батальон, полк, корпус, армия ----------
export const LADDER = {
  imperial: ['центурия', 'когорта', 'легион', 'крыло', 'армия'],
  nordic: ['сотня', 'хирд', 'дружина ярла', 'ополчение кланов', 'великий поход'],
  dwarven: ['щит', 'стена', 'чертог', 'гора', 'войско Камня'],
  romance: ['компания', 'баталия', 'кондотта', 'терция', 'армата'],
  eleon: ['вымпел', 'отряд', 'полк', 'эскадра суши', 'армия Лиги'],
  elven: ['ветвь', 'роща', 'дубрава', 'лес', 'воинство Ивы'],
  eluin: ['очаг', 'круг', 'род', 'племя', 'сбор Эрэдама'],
  church: ['копьё', 'знамя', 'орденский полк', 'святое воинство', 'крестовое воинство'],
  kaltrans: ['абордажная команда', 'отряд', 'капитанский полк', 'флотилия суши', 'армада'],
  desert: ['ряд', 'знамя', 'полк', 'крыло', 'войско'],
  cin: ['пятёрка', 'сотня', 'знамя', 'армия', 'великая армия'],
  zlatay: ['сотня', 'курень', 'полк', 'войско', 'рать'],
  orcish: ['кулак', 'банда', 'клан', 'орда', 'великая орда'],
  yut: ['десяток', 'сотня', 'полк', 'войско', 'великое войско'],
  dark: ['стая', 'когорта Тьмы', 'легион Тьмы', 'воинство', 'тьма']
}
export const LADDER_STATE = {
  'Республика': ['рота', 'батальон', 'полк', 'дивизия', 'армия'],
  'Корона Аргус': ['копьё', 'знамя', 'хоругвь', 'войско Совета', 'королевская армия'],
  'Креит': ['сотня', 'хирд', 'дружина ярла', 'ополчение Выводка', 'великий поход'],
  'Фарвольская лига': ['щит', 'стена', 'чертог', 'гора', 'войско Лиги'],
  'Крайдонианская Лига': ['вымпел', 'отряд', 'полк морской пехоты', 'эскадра суши', 'армия Лиги'],
  'Святая церковь': ['копьё', 'знамя', 'орденский полк', 'святое воинство', 'войско Света'],
  'Семья Каяя': ['вольная рота', 'компания', 'кондотта', 'наёмное войско', 'войско контор'],
  'Королевство Редания': ['стража моста', 'застава', 'полк переправ', 'войско короны', 'королевская рать'],
  'Империя Кагия': ['копьё', 'когорта', 'Багряный полк', 'гвардия ворот', 'армия Семи ворот'],
  'Северная Башня': ['дозор', 'стража', 'гарнизон Башни', '—', '—']
}

// ---------- законы призыва ----------
export const LAW = {
  imperial: { name: 'Набор по податным дворам', levy: 0.03, standing: 0.004, nobles: true, mercs: true, unfree: false, orders: true, text: 'Каждый тридцатый двор даёт рекрута; постоянные легионы на жалованье; знать служит со своими людьми.' },
  nordic: { name: 'Право стрелы', levy: 0.08, standing: 0.003, nobles: true, mercs: false, unfree: true, orders: false, text: 'Ярл пускает стрелу по хуторам — каждый свободный, способный держать топор, идёт в поход; трэлли гребут.' },
  dwarven: { name: 'Долг чертога', levy: 0.06, standing: 0.008, nobles: true, mercs: false, unfree: false, orders: true, text: 'Каждый взрослый дварф и гном — щит своего чертога; рунные жрецы ведут священные роты.' },
  romance: { name: 'Кондотта', levy: 0.015, standing: 0.003, nobles: true, mercs: true, unfree: true, orders: true, text: 'Город нанимает кондотьеров на договор; ополчение — только в крайней беде.' },
  eleon: { name: 'Морской сбор', levy: 0.03, standing: 0.006, nobles: true, mercs: true, unfree: true, orders: false, text: 'Порты дают моряков и морскую пехоту; галеры гребут должники.' },
  elven: { name: 'Зов Ивы', levy: 0.04, standing: 0.006, nobles: true, mercs: false, unfree: false, orders: true, text: 'Дома Ивы держат стражу; в беде весь лес берёт луки.' },
  eluin: { name: 'Сбор очагов', levy: 0.06, standing: 0.003, nobles: true, mercs: false, unfree: false, orders: false, text: 'Каждый очаг даёт воинов в круг рода.' },
  church: { name: 'Обет служения', levy: 0.01, standing: 0.004, nobles: true, mercs: true, unfree: false, orders: true, text: 'Святое воинство — ордена паладинов и обетные роты; миряне служат лишь в святом походе.' },
  kaltrans: { name: 'Капитанский набор', levy: 0.04, standing: 0.005, nobles: true, mercs: true, unfree: true, orders: false, text: 'Кланы капитанов ставят команды; оружейни Вактхана вооружают.' },
  desert: { name: 'Право шейха', levy: 0.05, standing: 0.004, nobles: true, mercs: true, unfree: true, orders: true, text: 'Племена дают всадников, города — пехоту; рабы-воины служат беку.' },
  cin: { name: 'Реестр знамён', levy: 0.03, standing: 0.006, nobles: true, mercs: false, unfree: false, orders: false, text: 'Каждая семья записана в реестр знамени; чиновники знают, сколько придёт.' },
  zlatay: { name: 'Реестр и вольница', levy: 0.06, standing: 0.004, nobles: true, mercs: true, unfree: false, orders: false, text: 'Реестровые казаки на жалованье, вольные — за добычу; бояре ведут свои дружины.' },
  orcish: { name: 'Закон кулака', levy: 0.15, standing: 0.01, nobles: true, mercs: false, unfree: true, orders: false, text: 'Каждый, кто может держать оружие, идёт за вождём; рабы тащат обоз.' },
  yut: { name: 'Служба домов', levy: 0.04, standing: 0.006, nobles: true, mercs: false, unfree: false, orders: true, text: 'Дома самураев держат дружины; крестьяне — копейщики в беде.' },
  dark: { name: 'Призыв Тьмы', levy: 0.1, standing: 0.01, nobles: true, mercs: false, unfree: true, orders: true, text: 'Жрецы зовут всех; обречённых гонят впереди.' }
}
export const LAW_STATE = {
  'Республика': { name: 'Закон о народном ополчении 977 г.', levy: 0.05, standing: 0.006, nobles: false, mercs: true, unfree: false, orders: false, text: 'Каждый гражданин записан в ополчение и держит ружьё дома; постоянная армия — на жалованье Союза ветеранов.' },
  'Корона Аргус': { name: 'Право Совета', levy: 0.02, standing: 0.005, nobles: true, mercs: true, unfree: true, orders: true, text: 'Знать Совета ставит хоругви; Цепной народ идёт в копейщики по приказу надзирателей.' },
  'Семья Каяя': { name: 'Договор контор', levy: 0, standing: 0.002, nobles: false, mercs: true, unfree: false, orders: false, text: 'Своих солдат почти нет — Семья нанимает вольные роты на договор.' },
  'Святая церковь': { name: 'Обет служения', levy: 0.01, standing: 0.005, nobles: true, mercs: true, unfree: false, orders: true, text: 'Паладины Света, монашеские щитоносцы и морская стража паломников.' },
  'Когалым': { name: 'Сельский сбор с оружием', levy: 0.05, standing: 0.001, nobles: false, mercs: false, unfree: false, orders: false, text: 'Каждый двор держит пику; войско собирается решением сбора.' },
  'Креит': { name: 'Право Выводка', levy: 0.09, standing: 0.004, nobles: true, mercs: false, unfree: true, orders: false, text: 'Последний выживший Выводка зовёт ярлов; трэлли Фросланда гребут и копают.' }
}

// ---------- уставные роты по культурам (общие) ----------
export const BASIC = {
  imperial: [
    tpl('hastati', 'Центурия гастатов', 'line', { weapon: 'gladius', armor: 'lorica', shield: 'scutum', training: 'trained', formation: 'manipular', banner: 'eagle', train: 'normal' }, ['drums']),
    tpl('principes', 'Центурия принципов', 'line', { weapon: 'gladius', armor: 'lorica', shield: 'scutum', training: 'veteran', formation: 'manipular', banner: 'eagle', train: 'normal' }, ['drums', 'medic']),
    tpl('sagittarii', 'Центурия лучников', 'archers', { weapon: 'compbow', armor: 'gambeson', shield: 'noshield', training: 'trained', formation: 'skirmish', banner: 'company', train: 'normal' }),
    tpl('equites', 'Ала всадников', 'lightcav', { weapon: 'lance', armor: 'mail', shield: 'kite', mount: 'riding', training: 'trained', formation: 'charge', banner: 'company', train: 'normal' }),
    tpl('ballistarii', 'Центурия баллистариев', 'siege', { weapon: 'ballista', armor: 'gambeson', training: 'trained', formation: 'close', banner: 'company', train: 'full' }, ['sappertools']),
    tpl('levy', 'Ополчение податных дворов', 'line', { weapon: 'spear', armor: 'gambeson', shield: 'round', training: 'levy', formation: 'close', banner: 'company', train: 'normal' })
  ],
  // феодальные королевства и графства имперской культуры (кроме самой Империи с её легионами)
  feudal: [
    tpl('spearmen', 'Копейщики', 'line', { weapon: 'spear', armor: 'gambeson', shield: 'kite', training: 'trained', formation: 'close', banner: 'house', train: 'normal' }),
    tpl('swordsmen', 'Мечники в кольчугах', 'line', { weapon: 'sword', armor: 'mail', shield: 'kite', training: 'veteran', formation: 'close', banner: 'house', train: 'normal' }),
    tpl('halberdiers', 'Алебардщики', 'line', { weapon: 'halberd', armor: 'brigandine', shield: 'noshield', training: 'trained', formation: 'close', banner: 'company', train: 'normal' }, ['drums']),
    tpl('bowmen', 'Лучники', 'archers', { weapon: 'longbow', armor: 'gambeson', shield: 'noshield', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }),
    tpl('crossbows', 'Арбалетчики', 'xbow', { weapon: 'xbow', armor: 'gambeson', shield: 'pavise', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }),
    tpl('menatarms', 'Конные латники', 'heavycav', { weapon: 'warlance', armor: 'plate', shield: 'kite', mount: 'warhorse', training: 'veteran', formation: 'charge', banner: 'house', train: 'full' }),
    tpl('sergeants', 'Конные сержанты', 'lightcav', { weapon: 'lance', armor: 'mail', shield: 'kite', mount: 'riding', training: 'trained', formation: 'charge', banner: 'company', train: 'normal' }),
    tpl('levy', 'Ополчение', 'line', { weapon: 'spear', armor: 'gambeson', shield: 'round', training: 'levy', formation: 'close', banner: 'company', train: 'normal' })
  ],
  nordic: [
    tpl('karls', 'Сотня карлов', 'line', { weapon: 'axe', armor: 'mail', shield: 'round', training: 'trained', formation: 'shieldwall', banner: 'house', train: 'light' }, ['horns']),
    tpl('huscarls', 'Хускарлы', 'line', { weapon: 'daneaxe', armor: 'mail', shield: 'round', training: 'veteran', formation: 'wedge', banner: 'house', train: 'light' }, ['horns']),
    tpl('bowmen', 'Сотня лучников', 'archers', { weapon: 'shortbow', armor: 'hide', shield: 'noshield', training: 'trained', formation: 'skirmish', banner: 'company', train: 'light' }),
    tpl('bondi', 'Бонды с копьями', 'line', { weapon: 'spear', armor: 'hide', shield: 'round', training: 'levy', formation: 'shieldwall', banner: 'company', train: 'forager' }),
    tpl('skiers', 'Лыжники', 'scouts', { weapon: 'javelin', armor: 'hide', training: 'trained', formation: 'skirmish', banner: 'company', train: 'light' }, ['skis'])
  ],
  dwarven: [
    tpl('shieldwall', 'Щит хирдманов камня', 'line', { weapon: 'axe', armor: 'plate', shield: 'tower', training: 'veteran', formation: 'shieldwall', banner: 'house', train: 'normal' }, ['horns']),
    tpl('xbows', 'Щит арбалетчиков', 'xbow', { weapon: 'heavyxbow', armor: 'mail', shield: 'pavise', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }),
    tpl('miners', 'Рудничная стража', 'line', { weapon: 'mace', armor: 'mail', shield: 'round', training: 'trained', formation: 'close', banner: 'company', train: 'normal' }, ['sappertools']),
    tpl('engineers', 'Камнемёты чертога', 'siege', { weapon: 'trebuchet', armor: 'gambeson', training: 'trained', formation: 'close', banner: 'company', train: 'full' }, ['mechanism'])
  ],
  romance: [
    tpl('pikemen', 'Компания пикинёров', 'line', { weapon: 'pike', armor: 'brigandine', shield: 'noshield', training: 'trained', formation: 'phalanx', banner: 'company', train: 'normal' }, ['drums']),
    tpl('crossbows', 'Генуэзские арбалетчики', 'xbow', { weapon: 'xbow', armor: 'brigandine', shield: 'pavise', training: 'veteran', formation: 'volley', banner: 'company', train: 'normal' }),
    tpl('gendarmes', 'Жандармы кондотты', 'heavycav', { weapon: 'warlance', armor: 'plate', shield: 'noshield', mount: 'warhorse', training: 'veteran', formation: 'charge', banner: 'house', train: 'full' }),
    tpl('rodeleros', 'Щитоносцы с мечами', 'line', { weapon: 'sword', armor: 'halfplate', shield: 'buckler', training: 'trained', formation: 'close', banner: 'company', train: 'normal' }),
    tpl('militia', 'Городская милиция', 'line', { weapon: 'glaive', armor: 'gambeson', shield: 'noshield', training: 'levy', formation: 'close', banner: 'company', train: 'normal' })
  ],
  eleon: [
    tpl('marines', 'Морская пехота', 'marines', { weapon: 'sword', armor: 'brigandine', shield: 'round', training: 'veteran', formation: 'boarding', banner: 'company', train: 'normal' }),
    tpl('xbmen', 'Корабельные арбалетчики', 'xbow', { weapon: 'xbow', armor: 'gambeson', shield: 'pavise', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }),
    tpl('coastguard', 'Береговая стража', 'line', { weapon: 'halberd', armor: 'mail', shield: 'noshield', training: 'trained', formation: 'close', banner: 'company', train: 'normal' })
  ],
  elven: [
    tpl('wardens', 'Стражи рощ', 'line', { weapon: 'elfblade', armor: 'elfmail', shield: 'kite', training: 'veteran', formation: 'close', banner: 'house', train: 'light' }),
    tpl('longbows', 'Лучники Корня', 'archers', { weapon: 'elfbow', armor: 'gambeson', shield: 'noshield', training: 'veteran', formation: 'skirmish', banner: 'house', train: 'light' }, ['treesong']),
    tpl('riders', 'Всадники на оленях', 'lightcav', { weapon: 'lance', armor: 'elfmail', shield: 'buckler', mount: 'stag', training: 'trained', formation: 'swarm', banner: 'house', train: 'light' })
  ],
  eluin: [
    tpl('hearth', 'Воины очага', 'line', { weapon: 'axe', armor: 'hide', shield: 'round', training: 'trained', formation: 'shieldwall', banner: 'house', train: 'light' }, ['amulets']),
    tpl('hunters', 'Охотники', 'archers', { weapon: 'shortbow', armor: 'hide', training: 'trained', formation: 'ambush', banner: 'company', train: 'forager' })
  ],
  church: [
    tpl('lancers', 'Копьё рыцарей веры', 'heavycav', { weapon: 'warlance', armor: 'plate', shield: 'kite', mount: 'destrier', training: 'veteran', formation: 'charge', banner: 'holy', train: 'full' }, ['blessing']),
    tpl('monks', 'Монашеские щитоносцы', 'line', { weapon: 'mace', armor: 'mail', shield: 'tower', training: 'trained', formation: 'shieldwall', banner: 'holy', train: 'normal' }, ['priest']),
    tpl('pilgrims', 'Обетные паломники', 'line', { weapon: 'spear', armor: 'gambeson', shield: 'round', training: 'levy', formation: 'close', banner: 'holy', train: 'normal' }, ['vow'])
  ],
  kaltrans: [
    tpl('boarders', 'Абордажная команда', 'marines', { weapon: 'blunder', armor: 'brigandine', shield: 'buckler', training: 'veteran', formation: 'boarding', banner: 'house', train: 'normal' }),
    tpl('musketeers', 'Мушкетёры оружейни', 'guns', { weapon: 'arquebus', armor: 'gambeson', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' })
  ],
  desert: [
    tpl('cameliers', 'Верблюжья конница', 'lightcav', { weapon: 'sabre', armor: 'mail', shield: 'round', mount: 'camel', training: 'trained', formation: 'swarm', banner: 'house', train: 'light' }),
    tpl('archers', 'Лучники пустыни', 'archers', { weapon: 'compbow', armor: 'gambeson', training: 'trained', formation: 'skirmish', banner: 'company', train: 'light' }),
    tpl('mamluks', 'Рабы-воины бека', 'heavycav', { weapon: 'sabre', armor: 'lamellar', shield: 'round', mount: 'warhorse', training: 'guard', formation: 'charge', banner: 'house', train: 'normal' })
  ],
  cin: [
    tpl('spears', 'Копейщики знамени', 'line', { weapon: 'glaive', armor: 'lamellar', shield: 'wicker', training: 'trained', formation: 'close', banner: 'company', train: 'normal' }, ['drums', 'banners2']),
    tpl('xbows', 'Арбалетчики реестра', 'xbow', { weapon: 'heavyxbow', armor: 'lamellar', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' })
  ],
  zlatay: [
    tpl('cossacks', 'Казачья сотня', 'lightcav', { weapon: 'sabre', armor: 'gambeson', shield: 'noshield', mount: 'steppe', training: 'veteran', formation: 'swarm', banner: 'company', train: 'light' }),
    tpl('streltsy', 'Стрелецкая сотня', 'guns', { weapon: 'handgonne', armor: 'gambeson', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }),
    tpl('boyars', 'Боярская дружина', 'heavycav', { weapon: 'sabre', armor: 'scale', shield: 'kite', mount: 'warhorse', training: 'veteran', formation: 'charge', banner: 'house', train: 'normal' }),
    tpl('smerds', 'Ополчение посадов', 'line', { weapon: 'axe', armor: 'gambeson', shield: 'round', training: 'levy', formation: 'close', banner: 'company', train: 'normal' })
  ],
  orcish: [
    tpl('fists', 'Кулак клана', 'line', { weapon: 'axe', armor: 'hide', shield: 'wicker', training: 'levy', formation: 'wedge', banner: 'house', train: 'forager' }, ['paint']),
    tpl('wolfriders', 'Волчьи всадники', 'beasts', { weapon: 'javelin', armor: 'hide', mount: 'wolf', training: 'trained', formation: 'swarm', banner: 'house', train: 'forager' }),
    tpl('trolls', 'Тролли-таранщики', 'beasts', { weapon: 'club', armor: 'none', training: 'levy', formation: 'charge', banner: 'nobanner', train: 'forager' }, ['chains'])
  ],
  yut: [
    tpl('samurai', 'Сотня домов', 'line', { weapon: 'sword', armor: 'lamellar', shield: 'noshield', training: 'veteran', formation: 'close', banner: 'house', train: 'normal' }),
    tpl('yari', 'Копейщики', 'line', { weapon: 'spear', armor: 'gambeson', shield: 'noshield', training: 'trained', formation: 'close', banner: 'company', train: 'normal' }),
    tpl('yumi', 'Лучники', 'archers', { weapon: 'longbow', armor: 'lamellar', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' })
  ],
  dark: [
    tpl('damned', 'Стая обречённых', 'line', { weapon: 'scythe', armor: 'none', training: 'levy', formation: 'wedge', banner: 'nobanner', train: 'forager' }, ['curse']),
    tpl('darkguard', 'Стража Тьмы', 'line', { weapon: 'glaive', armor: 'plate', shield: 'tower', training: 'guard', formation: 'close', banner: 'holy', train: 'normal' }, ['darkward'])
  ]
}

// ---------- свои рода войск стран (уникальные уставы) ----------
const U = (id, name, arm, parts, kit = [], note = '') => ({ ...tpl(id, name, arm, parts, kit, note), unique: true })
export const UNIQUE = {
  'Империя': [
    U('legionaries', 'Легионеры старой когорты', 'line', { weapon: 'gladius', armor: 'lorica', shield: 'scutum', training: 'guard', formation: 'testudo', banner: 'eagle', train: 'full' }, ['drums', 'medic', 'forge'], 'Десять знаменитых легионов'),
    U('cataphracts', 'Имперские катафракты', 'heavycav', { weapon: 'warlance', armor: 'scale', shield: 'kite', mount: 'destrier', training: 'veteran', formation: 'charge', banner: 'eagle', train: 'full' }, [], 'тяжёлая конница знати'),
    U('teyberguard', 'Стражи Тейбера', 'line', { weapon: 'sword', armor: 'gothic', shield: 'kite', training: 'guard', formation: 'close', banner: 'legend', train: 'full' }, ['wine'], 'личная гвардия императора'),
    U('kruggmages', 'Лицензированные маги Кругов', 'mages', { weapon: 'firestaff', armor: 'robes', training: 'trained', formation: 'circle', banner: 'company', train: 'normal' }, [], 'по лицензии Круга')
  ],
  'Республика': [
    U('musketmilitia', 'Ружейное ополчение 977 г.', 'guns', { weapon: 'arquebus', armor: 'gambeson', training: 'trained', formation: 'volley', banner: 'legend', train: 'normal' }, ['drums'], 'граждане с ружьями Брандштеттеров'),
    U('scissors', '«Ножницы» — ночная стража', 'light', { weapon: 'sword', armor: 'brigandine', shield: 'buckler', training: 'veteran', formation: 'ambush', banner: 'legend', train: 'light' }, ['nets'], 'Ночь Ножниц'),
    U('brandfels', 'Ветеранские роты Брандфельса', 'line', { weapon: 'halberd', armor: 'halfplate', shield: 'noshield', training: 'veteran', formation: 'square', banner: 'legend', train: 'normal' }, ['drums', 'medic']),
    U('gunners', 'Канониры Брандштеттеров', 'cannon', { weapon: 'culverin', armor: 'gambeson', training: 'trained', formation: 'close', banner: 'company', train: 'full' }, ['sappertools'])
  ],
  'Корона Аргус': [
    U('chainspears', 'Цепные копейщики', 'line', { weapon: 'pike', armor: 'gambeson', shield: 'noshield', training: 'levy', formation: 'phalanx', banner: 'company', train: 'normal' }, ['chains'], 'рабы Цепного народа'),
    U('fjalrangers', 'Фьяльские горные стрелки', 'xbow', { weapon: 'heavyxbow', armor: 'mail', training: 'veteran', formation: 'ambush', banner: 'house', train: 'light' }, ['maps']),
    U('councilknights', 'Рыцари Совета', 'heavycav', { weapon: 'warlance', armor: 'plate', shield: 'kite', mount: 'destrier', training: 'veteran', formation: 'charge', banner: 'house', train: 'full' }),
    U('kirchguns', 'Литейщики Кирхерталя', 'cannon', { weapon: 'bombard', armor: 'gambeson', training: 'trained', formation: 'close', banner: 'company', train: 'full' })
  ],
  'Креит': [
    U('broodhird', 'Хирдманы Выводка', 'line', { weapon: 'daneaxe', armor: 'mail', shield: 'round', training: 'guard', formation: 'wedge', banner: 'house', train: 'light' }, ['horns', 'seidr']),
    U('berserkers', 'Берсерки', 'light', { weapon: 'daneaxe', armor: 'hide', shield: 'noshield', training: 'veteran', formation: 'wedge', banner: 'nobanner', train: 'light' }, ['bloodrite'], 'бьются без доспеха'),
    U('longship', 'Драккарная дружина', 'marines', { weapon: 'axe', armor: 'mail', shield: 'round', training: 'veteran', formation: 'boarding', banner: 'house', train: 'river' }, ['boats']),
    U('thralls', 'Трэлли-гребцы', 'sappers', { weapon: 'club', armor: 'none', training: 'levy', formation: 'close', banner: 'nobanner', train: 'forager' }, ['chains'])
  ],
  'Земли Севера': [
    U('ulfhednar', 'Ульфхеднары', 'light', { weapon: 'axe', armor: 'hide', shield: 'noshield', training: 'veteran', formation: 'wedge', banner: 'nobanner', train: 'light' }, ['paint', 'seidr'], 'волчьи шкуры'),
    U('greyclans', 'Кланы Седых', 'line', { weapon: 'axe', armor: 'mail', shield: 'round', training: 'veteran', formation: 'shieldwall', banner: 'house', train: 'light' }, ['horns'])
  ],
  'Фарвольская лига': [
    U('runeshields', 'Рунные щитоносцы', 'line', { weapon: 'runeaxe', armor: 'runeplate', shield: 'runeshield', training: 'guard', formation: 'shieldwall', banner: 'legend', train: 'normal' }, ['runes'], 'дварфы Азгов'),
    U('gnomexbows', 'Гномьи самострельщики', 'xbow', { weapon: 'gnomexbow', armor: 'mail', shield: 'pavise', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }, ['mechanism', 'spyglass']),
    U('blasters', 'Рудничные подрывники', 'sappers', { weapon: 'mace', armor: 'brigandine', training: 'trained', formation: 'close', banner: 'company', train: 'normal' }, ['oil', 'sappertools'], 'горный порох в бою'),
    U('steamram', 'Огненный насос-таран', 'siege', { weapon: 'trebuchet', armor: 'plate', training: 'trained', formation: 'close', banner: 'legend', train: 'full' }, ['mechanism', 'ram'], 'опытная паровая машина — одна в мире')
  ],
  'Высокогорное Княжество': [
    U('passguard', 'Хранители перевалов', 'line', { weapon: 'halberd', armor: 'plate', shield: 'tower', training: 'veteran', formation: 'shieldwall', banner: 'house', train: 'normal' }, ['runes']),
    U('tunnelers', 'Подземные тоннельщики', 'sappers', { weapon: 'mace', armor: 'mail', training: 'trained', formation: 'close', banner: 'company', train: 'normal' }, ['sappertools', 'ladders'])
  ],
  'Эльфборн': [
    U('willowguard', 'Стражи Ивы', 'line', { weapon: 'elfblade', armor: 'elfmail', shield: 'runeshield', training: 'guard', formation: 'close', banner: 'holy', train: 'light' }, ['treesong'], 'клянутся Серебряной Иве'),
    U('rootbows', 'Длинные луки Корня', 'archers', { weapon: 'elfbow', armor: 'elfmail', training: 'guard', formation: 'volley', banner: 'house', train: 'light' }),
    U('treeguards', 'Древесные стражи', 'beasts', { weapon: 'club', armor: 'bark', training: 'trained', formation: 'close', banner: 'nobanner', train: 'light' }, ['treesong'], 'ожившие деревья — по зову Стража Корня'),
    U('herbalists', 'Травники-лекари', 'sappers', { weapon: 'club', armor: 'gambeson', training: 'trained', formation: 'loose', banner: 'company', train: 'normal' }, ['medic'])
  ],
  'Сильвленд': [
    U('vineweavers', 'Сильва-лозоплёты', 'line', { weapon: 'spear', armor: 'bark', shield: 'wicker', training: 'trained', formation: 'ambush', banner: 'company', train: 'light' }, ['treesong']),
    U('guardians', 'Опекуны Опушки', 'archers', { weapon: 'elfbow', armor: 'elfmail', training: 'veteran', formation: 'ambush', banner: 'house', train: 'light' }),
    U('edgehunters', 'Ловчие Опушки', 'scouts', { weapon: 'javelin', armor: 'hide', training: 'veteran', formation: 'ambush', banner: 'company', train: 'light' }, ['nets'])
  ],
  'Святая церковь': [
    U('paladins', 'Паладины Света', 'templars', { weapon: 'sword', armor: 'plate', shield: 'kite', training: 'guard', formation: 'close', banner: 'holy', train: 'full' }, ['blessing', 'vow']),
    U('inquisitors', 'Огненные инквизиторы', 'mages', { weapon: 'firestaff', armor: 'robes', training: 'veteran', formation: 'circle', banner: 'holy', train: 'normal' }, ['firecircle']),
    U('pilgrimguard', 'Морская стража паломников', 'marines', { weapon: 'mace', armor: 'mail', shield: 'kite', training: 'trained', formation: 'boarding', banner: 'holy', train: 'normal' }, ['priest'])
  ],
  'Крайдонианская Лига': [
    U('rokmarines', 'Рокская морская пехота', 'marines', { weapon: 'blunder', armor: 'brigandine', shield: 'buckler', training: 'guard', formation: 'boarding', banner: 'legend', train: 'normal' }, ['drums'], '12 000 «рокских»'),
    U('fireships', 'Команды брандеров', 'sappers', { weapon: 'club', armor: 'gambeson', training: 'veteran', formation: 'loose', banner: 'company', train: 'river' }, ['oil']),
    U('coastguns', 'Береговые канониры', 'cannon', { weapon: 'culverin', armor: 'gambeson', training: 'trained', formation: 'close', banner: 'company', train: 'full' })
  ],
  'Семья Каяя': [
    U('freecompany', 'Вольная рота по договору', 'line', { weapon: 'halberd', armor: 'brigandine', shield: 'noshield', training: 'veteran', formation: 'close', banner: 'company', train: 'normal' }, ['wine'], 'наёмники на рынке Каяи'),
    U('officeguard', 'Стража контор', 'xbow', { weapon: 'xbow', armor: 'brigandine', shield: 'pavise', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' })
  ],
  'Магнолия': [
    U('bloodblades', 'Сумеречные клинки крови', 'light', { weapon: 'elfblade', armor: 'elfmail', shield: 'buckler', training: 'guard', formation: 'ambush', banner: 'house', train: 'light' }, ['bloodrite']),
    U('nightriders', 'Ночные всадники', 'lightcav', { weapon: 'sabre', armor: 'elfmail', mount: 'riding', training: 'veteran', formation: 'swarm', banner: 'house', train: 'light' })
  ],
  'Дзань Цинь': [
    U('rocketeers', 'Ракетчики «огненных цветов»', 'archers', { weapon: 'rockets', armor: 'lamellar', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }, ['rockets'], 'праздник, ставший оружием'),
    U('borderarchers', 'Конные лучники границы', 'horsearch', { weapon: 'compbow', armor: 'lamellar', mount: 'steppe', training: 'veteran', formation: 'swarm', banner: 'company', train: 'light' })
  ],
  'Златайская Гетманщина': [
    U('registered', 'Реестровые казаки с пищалями', 'guns', { weapon: 'handgonne', armor: 'gambeson', training: 'veteran', formation: 'volley', banner: 'legend', train: 'light' }),
    U('gulyai', 'Гуляй-город', 'sappers', { weapon: 'spear', armor: 'gambeson', training: 'trained', formation: 'wagenburg', banner: 'company', train: 'wagons' })
  ],
  'Джака': [
    U('nargbows', 'Лучники наргов', 'archers', { weapon: 'compbow', armor: 'gambeson', training: 'veteran', formation: 'skirmish', banner: 'house', train: 'light' }),
    U('starsignal', 'Звездочёты-сигнальщики', 'scouts', { weapon: 'javelin', armor: 'gambeson', training: 'trained', formation: 'loose', banner: 'company', train: 'light' }, ['spyglass', 'banners2'])
  ],
  'Орда': [
    U('greatwolves', 'Волчьи всадники Орды', 'beasts', { weapon: 'axe', armor: 'hide', mount: 'wolf', training: 'veteran', formation: 'charge', banner: 'house', train: 'forager' }, ['shaman']),
    U('gremlinfire', 'Гремлины-поджигатели', 'light', { weapon: 'javelin', armor: 'none', training: 'levy', formation: 'skirmish', banner: 'nobanner', train: 'forager' }, ['oil'])
  ],
  'Империя Кагия': [
    U('crimsonguard', 'Багряная гвардия', 'heavycav', { weapon: 'warlance', armor: 'plate', shield: 'kite', mount: 'warhorse', training: 'guard', formation: 'charge', banner: 'legend', train: 'full' }, [], 'покупает трон на торгах'),
    U('gatespears', 'Копейщики Семи ворот', 'line', { weapon: 'pike', armor: 'mail', training: 'trained', formation: 'phalanx', banner: 'company', train: 'normal' })
  ],
  'Королевство Редания': [
    U('bridgewatch', 'Мостовая стража', 'line', { weapon: 'halberd', armor: 'brigandine', shield: 'noshield', training: 'veteran', formation: 'close', banner: 'legend', train: 'normal' }, ['drums'], 'держат пять переправ')
  ],
  'Королевство Болетария': [
    U('ashguard', 'Пепельная стража Предков', 'line', { weapon: 'sword', armor: 'plate', shield: 'kite', training: 'guard', formation: 'close', banner: 'holy', train: 'normal' }, ['vow'])
  ],
  'Рейх': [
    U('convicts', 'Каторжные рудокопы с кайлом', 'light', { weapon: 'club', armor: 'hide', training: 'veteran', formation: 'wedge', banner: 'nobanner', train: 'forager' }, [], 'вчерашние каторжники')
  ],
  'Северная Башня': [
    U('towerwatch', 'Стража Башни', 'xbow', { weapon: 'gnomexbow', armor: 'mail', shield: 'pavise', training: 'trained', formation: 'volley', banner: 'company', train: 'normal' }, ['spyglass', 'rockets']),
    U('stormmages', 'Маги бурь', 'mages', { weapon: 'firestaff', armor: 'robes', training: 'veteran', formation: 'circle', banner: 'company', train: 'normal' })
  ],
  'Олекохт': [
    U('spherekeepers', 'Держатели сфер', 'templars', { weapon: 'mace', armor: 'scale', shield: 'round', training: 'veteran', formation: 'circle', banner: 'holy', train: 'light' }, ['amulets'])
  ],
  'Фейноко': [
    U('topknots', 'Пучки девяти камней', 'line', { weapon: 'glaive', armor: 'lamellar', training: 'veteran', formation: 'close', banner: 'house', train: 'light' }, ['vow'])
  ],
  'Пираты': [
    U('corsairs', 'Корсары', 'marines', { weapon: 'blunder', armor: 'gambeson', shield: 'buckler', training: 'veteran', formation: 'boarding', banner: 'nobanner', train: 'light' }, ['wine'])
  ],
  'Церковь Тьмы': [
    U('nightpriests', 'Жрецы-маги Тьмы', 'mages', { weapon: 'firestaff', armor: 'robes', training: 'veteran', formation: 'circle', banner: 'holy', train: 'normal' }, ['darkward'])
  ],
  'Таварвайт': [
    U('yewbows', 'Тисовые лучники', 'archers', { weapon: 'longbow', armor: 'gambeson', training: 'veteran', formation: 'ambush', banner: 'company', train: 'light' })
  ],
  'Когалым': [
    U('yardpikes', 'Пики хозяйских дворов', 'line', { weapon: 'pike', armor: 'gambeson', training: 'trained', formation: 'phalanx', banner: 'company', train: 'normal' })
  ]
}

// ---------- имена командиров ----------
export const NAMES = {
  imperial: [['Ансельм', 'Бертольд', 'Конрад', 'Дитрих', 'Эберхард', 'Готфрид', 'Хайнрих', 'Людвиг', 'Отто', 'Рупрехт', 'Зигмунд', 'Вильгельм', 'Альбрехт', 'Ульрих', 'Маркус', 'Лотар', 'Гериберт', 'Фалько'], ['Штайн', 'Вальдек', 'Фернау', 'Кельбург', 'Остерхольц', 'Брандт', 'Хаген', 'Лихтенау', 'Мюллер', 'Шварц', 'Райнер', 'фон Тальберг', 'Аурих', 'Грауэр', 'Зоммер', 'Вебер']],
  nordic: [['Бьёрн', 'Эйрик', 'Торвальд', 'Ульф', 'Харальд', 'Сигурд', 'Кнут', 'Халльдор', 'Ингвар', 'Асгейр', 'Гуннар', 'Рагнар', 'Ивар', 'Торстейн', 'Сверре'], ['Железнобокий', 'сын Олава', 'Рыжий', 'Кривая Шея', 'Тихий', 'Медведь', 'сын Грима', 'Секира', 'Хромой', 'Седой', 'Морской Волк', 'сын Кетиля']],
  dwarven: [['Торгрим', 'Балин', 'Дурин', 'Гронд', 'Кхазрак', 'Ульдрих', 'Ортвин', 'Гилдартс', 'Бурин', 'Нурри', 'Фалин'], ['Железный', 'Каменнорукий', 'из Азгов', 'Молотобоец', 'Рудознатец', 'Глубинный', 'Щитоносец', 'Чёрная Борода']],
  romance: [['Лоренцо', 'Джакомо', 'Франческо', 'Бартоломео', 'Пьетро', 'Альвизе', 'Риккардо', 'Сандро', 'Марко', 'Козимо'], ['Орсолино', 'да Тореццо', 'Кастельмаре', 'Фальконьери', 'Сфорцони', 'Барбьери', 'Россеттини', 'делла Скала']],
  eleon: [['Кассиан', 'Рокруа', 'Мерен', 'Доннар', 'Элинор', 'Тьерри', 'Арно', 'Габриэль'], ['ван Рокруа', 'ван Доненвирен', 'Меренруа', 'де Хофдейк', 'Линден', 'Брайс']],
  elven: [['Эларион', 'Таэль', 'Сильвиен', 'Аэрин', 'Лоридан', 'Келебрин', 'Нимраэль', 'Иларион', 'Фаэлан'], ['из Дома Ивы', 'Тавэлин', 'Аурелан', 'Риорэн', 'Серебролистый', 'Звездоокий', 'из Корня']],
  eluin: [['Каидо', 'Тоомас', 'Ильмар', 'Арво', 'Яак', 'Рейн', 'Индрек', 'Ханнес'], ['из очага Антслы', 'сын Мярта', 'Огненный', 'Тулакрольский', 'Лесной']],
  church: [['Бенедикт', 'Игнаций', 'Северин', 'Клемент', 'Амброзий', 'Лука', 'Тадеуш'], ['брат Света', 'из Сантареи', 'Огненный', 'Смиренный', 'Святой Стражи']],
  kaltrans: [['Тархад', 'Корвин', 'Эрван', 'Марек', 'Доннел'], ['Тархад', 'Вактханский', 'Морской', 'Абордажник']],
  desert: [['Халид', 'Юсуф', 'Тарик', 'Саид', 'Амр', 'Насир', 'Идрис'], ['ибн Рашид', 'аль-Джаки', 'Звездочёт', 'из Офира', 'ибн Наср']],
  cin: [['Ли', 'Чжан', 'Вэй', 'Хань', 'Сюй', 'Лун'], ['Минь', 'Тао', 'Чэн', 'Фэн', 'Юэ', 'Шэн']],
  zlatay: [['Богдан', 'Остап', 'Тарас', 'Святослав', 'Мстислав', 'Ярема', 'Добрыня', 'Всеволод'], ['Сирко', 'Наливайко', 'Вольный', 'Хмельный', 'Остроглазый', 'Буревой']],
  orcish: [['Грук', 'Ургаш', 'Мордак', 'Зоргул', 'Хракк', 'Брогаш', 'Тугар'], ['Кровавый Клык', 'Сломанный Нос', 'Череполом', 'Волчий', 'Одноглазый', 'Железная Челюсть']],
  yut: [['Хидэо', 'Кэнсин', 'Масамунэ', 'Нобутада', 'Рё', 'Такэда'], ['Одзукава', 'Сэйдзи', 'Хаяси', 'Мори', 'Такэути']],
  dark: [['Мор', 'Велиар', 'Скорг', 'Нахт', 'Азраэль'], ['Чёрный', 'Пепельный', 'Безликий', 'из Пустоши']]
}
export const CMD_TRAITS = ['храбрец', 'осторожный', 'хитрец', 'любимец солдат', 'жестокий', 'пьяница', 'старый служака', 'молодой и горячий', 'книжник-стратег', 'трус', 'честолюбец', 'набожный', 'везучий', 'мститель', 'дипломат']

// названия частей
export const ORDINAL = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']
export const EPITHETS = ['Каменный', 'Пепельный', 'Северный', 'Южный', 'Морской', 'Лесной', 'Горный', 'Железный', 'Верный', 'Стойкий', 'Быстрый', 'Красный', 'Чёрный', 'Золотой', 'Старый', 'Новый', 'Пограничный', 'Речной', 'Святой', 'Волчий']

// народ своих родов войск (если задан — рота набирается из него, а не из области)
export const TEMPLATE_RACE = {
  chainspears: 'Цепной народ', fjalrangers: 'Фьяли', runeshields: 'Дварфы', gnomexbows: 'Гномы', blasters: 'Дварфы', steamram: 'Гномы',
  passguard: 'Дварфы', tunnelers: 'Дварфы', willowguard: 'Эльфы', rootbows: 'Эльфы', treeguards: 'Сильва', vineweavers: 'Сильва',
  guardians: 'Эльфы', bloodblades: 'Сумеречные эльфы', nightriders: 'Сумеречные эльфы', topknots: 'Момиты', greatwolves: 'Орки',
  gremlinfire: 'Гремлины', nargbows: 'Нарги', berserkers: 'Норды', broodhird: 'Норды', ulfhednar: 'Норды', spherekeepers: 'Элуины',
  trolls: 'Тролли', wolfriders: 'Орки', shieldwall: 'Дварфы', xbows_dw: 'Дварфы'
}
