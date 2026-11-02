// Наполняет южные республики на карте: доимперские государства юга вместо безликого княжества (лига, сеньории,
// епископство, кланы), столицы как места, описание каждого поселения в южном духе — что растят, кто правит,
// чем славится, чьей землёй было до Империи. Придумано по поручению автора (02.11.2026) — «черновик».
// Детерминированно. Запуск после republic-detail.mjs: node scripts/south-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { SOUTH, SOUTH_PRE } from './lore/south.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 9781978
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const stateByName = new Map(world.states.map((s) => [s.base.name, s]))

// ---------- доимперский юг ----------
world.states = world.states.filter((s) => !s.id.startsWith('hist-south-'))
for (const [id, name, color, government, , description] of SOUTH_PRE)
  world.states.push({
    id, from: null, to: D(id === 'hist-south-torar' ? 127.3 : 126.5), history: [], factions: [],
    base: { name, fullName: '', color, flag: '', motto: '', ruler: '', rulerTitle: '', rulerId: '', government, ideology: '', religion: 'Дом Света', religionId: 'lore-house-light', capitalId: '', population: '', army: '', navy: '', economy: '', treasury: '', laws: '', culture: id === 'hist-south-kalt' ? 'Кальтранцы' : 'Южане', languages: '', stability: 50, description: `${description}\n\n_черновик_`, dynastyId: '', overlordId: '', diplomacy: '', customFields: [] }
  })
const preOf = new Map(SOUTH_PRE.map(([id, name, , , where]) => [where, id]))
const southIds = new Map(SOUTH.map((s) => [stateByName.get(s.state)?.id, s]))
const provs = world.provinces.filter((p) => southIds.has(p.owners?.at(-1)?.[1]))
for (const p of provs) {
  const s = southIds.get(p.owners.at(-1)[1])
  // в Шеше: храм Терии и внутренние земли — епископство, берег — сеньория Торарата
  const pre = s.key === 'she' ? (p.coastal && p.settlement?.type !== 'temple' ? 'hist-south-torar' : 'hist-south-teria') : preOf.get(s.state)
  if (p.owners[0]?.[0] == null) p.owners[0] = [null, pre]
  p.preState = pre
}

// ---------- описания поселений ----------
const GOODS = {
  romance: { coast: ['вяленая рыба', 'соль', 'кораллы', 'губки', 'солёные анчоусы', 'рыбий соус'], land: ['вино', 'оливковое масло', 'пробковый дуб', 'шёлк', 'шерсть мериносов', 'апельсины', 'миндаль', 'кони', 'мрамор', 'сыр из овечьего молока'] },
  kaltrans: { coast: ['вяленая рыба', 'соль', 'тюлений жир'], land: ['кони', 'сталь', 'клинки', 'горный мёд', 'шерсть'] }
}
const TYPE = {
  village: ['деревня на холме с колокольней', 'деревня среди виноградников', 'селение с аркадой у колодца', 'деревня с белыми домами и красными крышами'],
  fishing: ['рыбачий посёлок у бухты', 'посёлок рыбаков под мысом', 'рыбачья деревня с лодками на песке'],
  town: ['городок с площадью, фонтаном и колокольней', 'городок за старой стеной лиги', 'торговый городок с крытым рынком'],
  port: ['гавань с молом и маяком', 'портовый город на мысу'],
  city: ['большой город с соборными куполами', 'город дворцов и аркад'],
  castle: ['замок сеньоров над деревней', 'крепость на скале'],
  temple: ['храмовый город паломников'],
  ruins: ['развалины старой крепости']
}
const KTYPE = { village: ['селение клана с каменной школой', 'горное селение с конюшнями', 'деревня клана за каменной оградой'], fishing: ['посёлок рыбаков клана'], town: ['город кланов с Домом рот'], ruins: ['развалины клановой крепости'] }
const SIGHT = {
  romance: ['На площади — фонтан с тремя дельфинами времён лиги', 'Колокольня видна с моря за полдня пути', 'В церкви хранят знамя, с которым город сдался Тейберу', 'Под аркадами рынка каждую пятницу играют на гитарах', 'На холме — развалины замка сеньоров, сожжённого в Войну трёх гаваней', 'Здесь лучший сыр побережья — его возят даже в Акелату', 'В праздник урожая улицы засыпают лепестками', 'У ворот — старая сторожевая башня лиги'],
  kaltrans: ['При Доме рот — школа, где учат читать договор найма раньше, чем держать меч', 'Здесь куют клинки, которые наёмники берут с собой за море', 'В селении все мужчины старше двадцати служили в ротах', 'На скале — родовой очаг клана, огонь в нём не гаснет']
}
const RULE = {
  tos: () => pick([`Подеста ${pick(['Альбанелли', 'Корвезе', 'Россеттини', 'Фальконьери'])} — от Дома Фальконьери`, 'Подеста назначен канцлером', 'Землёй владеет банк Фальконьери: должники платят зерном']),
  vuf: () => pick([`Граф ${pick(['Монтальдо', 'Орсолино', 'ди Лучола', 'де Монате'])} держит землю и суд`, 'Консул гавани и совет судовладельцев', 'Помещик-гранд и его управляющий']),
  she: () => pick([`Комендант ${pick(['Первого', 'Второго', 'Третьего', 'Четвёртого'])} полка правит именем канцлера-генерала`, 'Земля церкви Терии; правит каноник', 'Помещик-полковник из знати при армии']),
  kal: () => pick([`Старейшина клана ${pick(['Кесхан', 'Ракхзис', 'Дрохр', 'Калагат', 'Транах'])}`, 'Капитан вольной роты, вернувшийся с наёма', 'Школьный совет и старейшина'])
}
const PRE_NAME = new Map([['hist-south-kalt', 'Союза кальтранских кланов'], ['hist-south-akel', 'Сеньории Акелата'], ['hist-south-torin', 'Торинийской лиги'], ['hist-south-teria', 'Епископства Терии'], ['hist-south-torar', 'Сеньории Торарата']])
for (const p of provs) {
  const s = southIds.get(p.owners.at(-1)[1])
  const t = p.settlement?.type ?? 'village'
  const cult = s.culture
  const capital = p.name === s.capital
  const kind = capital ? `столица республики, ${pick(TYPE[t] ?? TYPE.town)}` : pick((cult === 'kaltrans' ? KTYPE[t] : null) ?? TYPE[t] ?? TYPE.village)
  const goods = [...new Set([pick(p.coastal ? GOODS[cult].coast : GOODS[cult].land), pick(GOODS[cult].land)])].join(', ')
  const lines = [`${p.name} — ${kind}. Живёт тем, что даёт земля: ${goods}.`, `${RULE[s.key]()}.`, `${pick(SIGHT[cult])}.`]
  if (s.key === 'she' && p.coastal && chance(0.45)) lines.push('Говорят, в трюмах здешних лодок возят не только рыбу.')
  if (s.key === 'tos' && chance(0.3)) lines.push('Половина домов заложена в банке Акелаты.')
  if (s.key === 'kal' && chance(0.4)) lines.push('Сюда бегут из Республики контрабандисты — «гости кланов».')
  if (s.key === 'vuf' && chance(0.3)) lines.push('Здесь гордятся Торинийской лигой и не любят, когда их зовут «вуфинцами».')
  if (t === 'temple') lines.push('Храм Терии, где князья-епископы правили до Империи; паломники идут сюда со всего юга.')
  lines.push(`До 126 г. — земля ${PRE_NAME.get(p.preState)}. С 978 г. — ${s.state}.`)
  const old = p.description ?? ''
  const i = old.indexOf('**Освобождение')
  p.description = `${lines.join(' ')}\n\n${i >= 0 ? old.slice(i) : ''}`.trim()
  delete p.preState
}

// ---------- столицы ----------
for (const s of SOUTH) {
  const st = stateByName.get(s.state)
  const prov = world.provinces.find((p) => p.name === s.capital)
  const pos = prov.settlement ?? prov
  const id = `lore-${s.key}-capital`
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({
    id, mapId: 'world', x: Math.round(pos.x), y: Math.round(pos.y), ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}),
    base: { name: s.capital, type: 'capital', stateId: st.id, population: '', ruler: `${s.rulerTitle} ${s.chancellors.at(-1)[1]}`, image: '', description: `**Столица: ${s.state}.** ${s.hall.split(',')[0]} — здесь заседает ${s.chamber}.\n\n${prov.description.split('\n\n')[0]}\n\n_черновик_` },
    history: [], from: null, to: null
  })
}
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Юг: ${provs.length} поселений, доимперских государств ${SOUTH_PRE.length}, столиц ${SOUTH.length}`)
