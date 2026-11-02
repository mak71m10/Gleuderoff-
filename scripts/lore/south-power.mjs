// Власть южных республик по годам: парламенты с цензовыми выборами и рабочие комитеты, подчинённые Совету рабочих
// Республики. Канон автора — в lore/south.mjs; итоги выборов, законы и подробности придуманы («черновик»).
// Собирает scripts/legislatures.mjs.
import { SOUTH, SOUTH_ELECTIONS, SOUTH_FACTIONS, SOUTH_ISSUES } from './south.mjs'

// ключевые законы: [год, название, кто внёс (фракция или id записи), итог, сдвиг по вопросам, суть, вид]
const KEY_BILLS = {
  tos: [
    [978.42, 'Устав Синьории', 'banks', 'принят', { chancellor: 2, census: 2 }, 'Канцлер из Дома Фальконьери пожизненно; Синьория утверждает налоги.', 'устав'],
    [979.45, 'Закон о векселе', 'banks', 'принят', { money: 2 }, 'Долг перед банком выше долга перед государством: должник республики платит сначала банку.', 'закон'],
    [987.6, 'Займ архиепархии Луправена', 'merchants', 'принят', { money: 1, church: 0.5 }, 'Банк Альбанелли даёт архиепархии полмиллиона под залог соляных копей.', 'закон'],
    [995.3, 'Закрытие «Окна Акелаты»', 'banks', 'принят', { census: 1 }, 'Газету либералов закрывают «за клевету на канцлера».', 'закон'],
    [1002.3, 'Закон о цензе', 'lore-tos-giuliano', 'принят', { census: -1 }, 'Голос получают купцы I гильдии. Простолюдинам — нет.', 'закон'],
    [1006.4, 'Всеобщие выборы', 'left', 'отклонён', { census: -2 }, 'Народные левые предлагают один голос на человека. Отклонено, но либералы впервые голосуют «за».', 'закон'],
    [1008.35, 'Займ Республике на союзное войско', 'banks', 'принят', { union: 1, money: 1 }, 'Акелата даёт Тирриту в долг на «Союз республик» — под залог таможенных сборов, которых нет.', 'договор']
  ],
  vuf: [
    [978.37, 'Сиенеронский договор', 'lore-vuf-alfonso', 'принят', { union: 2 }, 'Союз с Республикой без таможен, общее гражданство.', 'договор'],
    [978.4, 'Устав Большого совета', 'union', 'принят', { chancellor: 2, census: 2 }, 'Канцлер из Дома Орсолино пожизненно; голос у знати и помещиков.', 'устав'],
    [983.5, 'Отмена Сиенеронского договора', 'grandees', 'отклонён', { union: -2 }, 'Граф Монтальдо требует выйти из союза с Тирритом.', 'закон'],
    [985.2, 'Закон о гаванях', 'harbors', 'принят', { money: 1 }, 'Консулы гаваней выбираются судовладельцами.', 'закон'],
    [995.6, 'Программа «Союза республик»', 'lore-vuf-federico', 'принят', { union: 2, chancellor: 1 }, 'Совет поручает канцлеру готовить союз республик с общим войском.', 'резолюция'],
    [1003.6, 'Голос хозяевам с наделом', 'liberals', 'отклонён', { census: -1 }, 'Либералы предлагают дать голос крестьянам с наделом. Не хватило восьми голосов.', 'закон'],
    [1008.32, 'Ответ посольству Тиррита', 'lore-vuf-federico', 'принят', { union: 1.5 }, '«Да — если столица будет у моря».', 'резолюция']
  ],
  she: [
    [978.38, 'Устав Меча', 'lore-she-rodrigo', 'принят', { chancellor: 2, census: 2 }, 'Канцлер-генерал из Дома Кастельмаре пожизненно; Сенат утверждает налоги; комитеты запрещены.', 'устав'],
    [980.1, 'Привилегия Терии', 'teria', 'принят', { church: 2 }, 'Церковные земли не платят податей.', 'закон'],
    [983.35, 'Закон о долговых контрактах', 'harbor', 'принят', { chains: 2, money: 1 }, 'Должник может «отработать долг за морем». На деле — продажа людей.', 'закон'],
    [995.4, 'Отказ выдать «имперцев» Тирриту', 'imperials', 'принят', { union: -1 }, 'Республика требует выдать бывших имперских чиновников — Сенат отказывает.', 'резолюция'],
    [1003.7, 'Расследование трюмов', 'liberals', 'отклонён', { chains: -2 }, 'Фонтанелла публикует списки трюмов и требует суда над Медрано. Отклонено.', 'закон'],
    [1005.5, 'Розыск Микеле Сольдати', 'sword', 'принят', { chancellor: 1 }, 'Вождь левых объявлен в розыск; его фракция остаётся в Сенате.', 'закон'],
    [1009.2, '«Совет церкви и меча»', 'teria', 'отклонён', { church: 2, chancellor: -1 }, 'Архиепископ предлагает делить власть с канцлером-генералом. Отклонено — двенадцатью голосами.', 'закон']
  ],
  kal: [
    [978.42, 'Закон о канцлере', 'captains', 'принят', { chancellor: 2 }, 'Канцлер из рода Тархад пожизненно.', 'устав'],
    [978.45, 'Устав рот', 'captains', 'принят', { chancellor: 1 }, 'Вольные роты нанимаются только с согласия Совета кланов.', 'закон'],
    [979.2, 'Закон о букваре', 'lore-kal-tarhad', 'принят', { census: -0.5 }, 'Каждый ребёнок кальтранцев учится шесть лет.', 'закон'],
    [996.4, 'Протест против фортов Республики', 'captains', 'принят', { union: -1 }, 'Форты на границе смотрят на Кальтранию, а не на Империю.', 'резолюция'],
    [1004.5, 'Жалованье ротам напрямую', 'left', 'принят', { money: -1 }, 'Рядовым платят не через капитанов.', 'закон'],
    [1008.6, 'Голос выпускникам школ', 'teachers', 'отклонён', { census: -1.5 }, 'Учительская партия требует школьного ценза. Отклонено двумя голосами.', 'закон']
  ]
}
// рядовые законы каждого года
export const SOUTH_TPL = [
  () => ({ title: 'Бюджет республики', kind: 'бюджет', w: { money: 0.6 }, sponsor: 'first', summary: 'Подати знати, сборы гаваней, жалованье полкам — и долг банкам Акелаты.' }),
  () => ({ title: 'Подать с поместий', kind: 'закон', w: { money: -0.8, census: -0.4 }, sponsor: 'liberals', summary: 'Повысить подать с крупных поместий на один грош с десятины.' }),
  () => ({ title: 'Пошлина на зерно с островов', kind: 'закон', w: { money: 1 }, sponsor: 'first', summary: 'Защитить хлеб помещиков от дешёвого островного зерна.' }),
  () => ({ title: 'Школа при соборе', kind: 'закон', w: { church: 1 }, sponsor: 'church', summary: 'Отдать школу города епархии.' }),
  () => ({ title: 'Мостовая и водовод столицы', kind: 'закон', w: { money: 0.4 }, sponsor: 'first', summary: 'Подряд дому, близкому к канцлеру.' }),
  () => ({ title: 'Голос для горожан', kind: 'закон', w: { census: -1.5 }, sponsor: 'left', summary: 'Дать голос домовладельцам городов.' }),
  () => ({ title: 'Делегаты на союзный съезд в Тиррит', kind: 'резолюция', w: { union: 1.2 }, sponsor: 'first', summary: 'Послать делегатов на съезд республик.' }),
  () => ({ title: 'Расследование взяток в таможне', kind: 'закон', w: { chancellor: -1, money: -0.5 }, sponsor: 'liberals', summary: 'Коррупция в портах — снова. Комиссию назначает канцлер.' }),
  () => ({ title: 'Помилование имперских чиновников', kind: 'закон', w: { union: -1 }, sponsor: 'imperials', summary: 'Вернуть пенсии бывшим чиновникам Империи.' }),
  () => ({ title: 'Запрет собраний рабочих', kind: 'закон', w: { chancellor: 1, census: 1 }, sponsor: 'first', summary: 'Запретить сходки без разрешения городской стражи.' }),
  () => ({ title: 'Ремонт береговых батарей', kind: 'закон', w: { money: 0.3 }, sponsor: 'first', summary: 'Пушки на мысу и новая стена гавани.' }),
  () => ({ title: 'Ограничение «долговых контрактов»', kind: 'закон', w: { chains: -1.5 }, sponsor: 'liberals', summary: 'Запретить вывоз должников за море без суда.' })
]
// рабочие комитеты: фракции и съезды
const COMMITTEE_FACTIONS = [
  { id: 'loyal', name: 'Линия Корельвейлера', color: '#8a1420', ideology: 'Как решит Совет рабочих в Республике', leader: '', stance: [0.5, 1, -0.5] },
  { id: 'local', name: 'Мастерские и доки', color: '#2f7a86', ideology: 'Сначала свои требования', leader: '', stance: [1, 0, 0] },
  { id: 'radicals', name: 'Огненные', color: '#d0262d', ideology: 'Сразу и силой', leader: '', stance: [2, -1.5, 1.8] }
]
const COMMITTEE_ISSUES = [
  { id: 'strike', name: 'Стачка', minus: 'Переговоры', plus: 'Стачка сразу' },
  { id: 'council', name: 'Совет', minus: 'Своя дорога', plus: 'Подчинение Совету в Корельвейлере' },
  { id: 'violence', name: 'Сила', minus: 'Только мирно', plus: 'Как в 978-м' }
]

export function southBodies(D, capitalArea) {
  const parliaments = []
  const committees = []
  for (const s of SOUTH) {
    const area = capitalArea(s)
    const facs = SOUTH_FACTIONS[s.key].map(([id, name, color, ideology, stance, leader]) => ({ id, name, color, ideology, stance, leader: leader ? `lore-${leader}` : '' }))
    const first = facs[0].id
    const named = []
    const add = (eid, fac, role) => facs.some((f) => f.id === fac) && named.push([`lore-${eid}`, fac, area, 979.5, null, role])
    for (const [, , , , , leader] of SOUTH_FACTIONS[s.key]) if (leader && !s.chancellors.some((c) => c[0] === leader)) add(leader, SOUTH_FACTIONS[s.key].find((x) => x[5] === leader)[0], '')
    parliaments.push({
      key: s.key, culture: s.culture,
      body: {
        id: `${s.key}-${{ tos: 'signoria', vuf: 'council', she: 'senate', kal: 'council' }[s.key]}`, state: s.state, name: s.chamber, entryId: `lore-${s.key}-chamber`,
        chairTitle: 'Председатель', seats: s.seats, from: 979.45, seatOrder: [...facs.map((f) => f.id)].sort((a, b) => facs.find((f) => f.id === a).stance[1] - facs.find((f) => f.id === b).stance[1]), groups: [],
        description: `${s.seats} мест; выборы раз в четыре года. Голосуют только знать и помещики${s.key === 'tos' ? ' (с 1002 г. — и купцы I гильдии)' : ''}; у простолюдинов голоса нет. ${s.rulerTitle} — пожизненно из одного рода. Заседает: ${s.hall}.`,
        issues: SOUTH_ISSUES, factions: facs,
        elections: SOUTH_ELECTIONS[s.key].map(([year, target, note]) => ({ year, name: `Выборы ${Math.floor(year)} года`, system: '979', target, note })),
        named,
        bills: KEY_BILLS[s.key].map(([y, t, sp, r, w, sum, kind]) => [y, t, sp, r, w, sum, kind]),
        years: {}
      },
      head: { title: s.rulerTitle, entryId: `lore-${s.chancellors.at(-1)[0]}` },
      tpl: SOUTH_TPL.map((t) => () => { const g = t(); if (g.sponsor === 'first') g.sponsor = first; if (!facs.some((f) => f.id === g.sponsor)) g.sponsor = first; return g })
    })
    const c = s.committee
    const n = c.seats
    const seatsAt = (k) => { const r = Math.round(n * (0.15 + k * 0.02)); const l = Math.round(n * 0.5); return { loyal: l, local: n - l - r, radicals: r } }
    committees.push({
      id: `${s.key}-committee`, state: s.state, name: c.name, entryId: `lore-${s.key}-committee`, chairTitle: 'Председатель комитета', seats: n, from: 992.3, unofficial: true,
      seatOrder: ['radicals', 'local', 'loyal'], groups: [],
      description: `${c.text} Неофициальный: закон его не знает${s.key === 'she' ? ', а Устав Меча запрещает' : ''}.`,
      issues: COMMITTEE_ISSUES, factions: COMMITTEE_FACTIONS,
      convocations: [992.3, 997.3, 1002.3, 1007.3].map((year, k) => ({ year, name: k ? `Съезд ${Math.floor(year)} г.` : 'Первый съезд', seats: seatsAt(k), note: k ? '' : 'Комитет признаёт себя отделением Совета рабочих и крестьян в Корельвейлере.' })),
      named: [],
      bills: [[992.32, 'Подчинение Совету рабочих', 'loyal', 'принят', { council: 2 }, 'Комитет — отделение Совета рабочих и крестьян Республики.', 'резолюция']],
      years: {}
    })
  }
  return { parliaments, committees }
}
