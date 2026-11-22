// Берега Гренинсворда на карте: Оберталь → Дрогенмау (столица), Оствейлер → Этнор, Фрейхаузен → Артензи'Винар,
// Оберенведель → Онершайм, Вердорф → Саренто; описания поселений по полисам, места (Маяк Иссикара, Дом союза, Белый год,
// набеги 989 и 996), поход общего флота 981 г.
// Запуск после uunaash-detail.mjs: node scripts/greninsword-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/greninsword.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261123
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))

export const GS_CITIES = [['Оберталь', 'Дрогенмау', null], ['Оствейлер', 'Этнор', null], ['Фрейхаузен', 'Артензи\'Винар', null], ['Оберенведель', 'Онершайм', null], ['Вердорф', 'Саренто', 'town']]
for (const [old, nw, type] of GS_CITIES) {
  const p = world.provinces.find((x) => x.owners?.at(-1)?.[1] === st.id && (x.name === old || x.name === nw))
  if (!p) continue
  const area = admin.get(p.areaId)
  if (area && area.name === `Округ ${old}`) area.name = `Округ ${nw}`
  p.name = nw
  if (type) p.settlement.type = type
}

const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const dist = (a, b) => Math.hypot(sx(a).x - sx(b).x, sx(a).y - sx(b).y)
const POLIS = ['Дрогенмау', 'Этнор', 'Артензи\'Винар', 'Онершайм', 'Саренто'].map(byName).filter(Boolean)
const polisOf = (p) => POLIS.reduce((a, b) => (dist(p, b) < dist(p, a) ? b : a), POLIS[0]).name

const SPECIAL = {
  Дрогенмау: 'Полис-бастион на скале посреди залива: три кольца стен, гавань с цепью поперёк входа и девять плавучих крепостей у мола. Здесь Дом союза, казна, арсенал и архив, кто бы ни держал Стяг, и Маяк Иссикара, где лоцманы ведут Ледовую книгу. Зимой у гавани ходят окованные сани-ледоколы.',
  Этнор: 'Полис рыбаков и верфей: стапели вдоль всего берега, сети сушат на синих вешалах, пахнет сельдью и смолой. Консул — Мария де-Вран, в 1010 г. держит Стяг. Гавань мёрзнет раньше всех в заливе.',
  'Артензи\'Винар': 'Красный полис торговцев и послов: рынок под арками, дома с лоджиями, где говорят на шести языках. Здесь знают всё о всех. У мыса в 1004 г. утонул ког наследника Уунааша.',
  Онершайм: 'Зелёный полис лучников на краю лесов: тисовые склады, стрельбище у самой гавани, гребные лодки с высокими бортами. Гавань мелкая и зимой закрыта.',
  Саренто: 'Полис хлебных полей: амбары с жёлтыми ставнями, мельницы вдоль берега, рынок зерна. В доме полиса хранится сам Стяг Саренто, под которым в 977 г. подписан Пакт.',
}
const FN = ['Гуннар', 'Пит', 'Сигурд', 'Олаф', 'Бьярне', 'Хальвард', 'Йенс', 'Арне', 'Кнут', 'Эйвинд']
const FW = ['Рагна', 'Ингвильд', 'Сигрид', 'Мария', 'Тора', 'Хельга', 'Астрид', 'Гудрун']
const SUR = ['Тинд', 'Хёг', 'Грёнланн', 'Сельм', 'Брекке', 'Ваг', 'Хольм', 'Стенсен']
const person = () => `${pick(rnd() < 0.35 ? FW : FN)} ${pick(SUR)}`
const NOTE = [
  'На носу каждой лодки нарисован трезубец Иссикара; первую рыбину улова бросают обратно.',
  'У пристани висит колокол Набата: в него бьют, только если полис напал на соседа, и последний раз били в 1007 г.',
  'Старики помнят Белый год: лёд стоял до горизонта, и хлеб везли по льду на санях лоцманов.',
  'Отказать путнику в воде здесь — хуже, чем украсть: колодец у околицы открыт всем.',
  'Староста ведёт счёт чистым дням своей бухты, хотя в Ледовую книгу её не пишут.',
  'Летом здесь стоит такая духота, что работают ночью; зимой — такой холод, что ломит кости.',
  'В прошлый Набег Сигрунгов отсюда видели дым над Этнором и три дня ждали флота.',
  'У часовни Дома Света — каменный дельфин: перед дальним плаванием его гладят по носу.',
]
const CROP = ['сельдь и треску', 'соль и рыбий жир', 'лес и смолу', 'рожь и ячмень', 'тюленя и кожи', 'коз и шерсть']

let n = 0
for (const p of provs.filter((x) => x.settlement)) {
  const t = p.settlement.type
  const lines = []
  if (SPECIAL[p.name]) {
    lines.push(`${p.name} — ${p.name === 'Дрогенмау' ? 'полис-столица Объединённых Берегов Гренинсворда' : 'полис союза Гренинсворда'}.`)
    lines.push(SPECIAL[p.name])
  } else {
    const kind = { castle: 'крепость', port: 'гавань', town: 'городок', fishing: 'рыбацкое село' }[t] ?? 'село'
    lines.push(`${p.name} — ${kind} полиса ${polisOf(p)}: ${pick(['дома из камня на сваях над водой', 'серые срубы под дёрном, лодки на катках', 'дворы вдоль бухты, сети на кольях', 'каменная башня и десяток домов у обрыва'])}; живут ${pick(CROP)}.`)
    lines.push(`Староста — ${person()}.`)
    lines.push(pick(NOTE))
  }
  lines.push(`${admin.get(p.areaId)?.name ?? ''}; норды залива.`)
  p.description = lines.join(' ')
  n++
}

const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
world.places = world.places.filter((p) => !p.id.startsWith('lore-gs-'))
const cap = byName('Дрогенмау'), etn = byName('Этнор'), art = byName('Артензи\'Винар'), sar = byName('Саренто')
place('lore-gs-capital', 'Дрогенмау', 'capital', sx(cap), 978.3, '**Столица-бастион.** Дом союза, казна, арсенал и архив — здесь при любом держателе Стяга. В 1010 г. Стяг у Марии де-Вран из Этнора.', st.id, [0, 0], 'Держательница Стяга Мария де-Вран')
place('lore-gs-lighthouse', 'Маяк Иссикара', 'temple', sx(cap), null, '**Лоцманы.** Маяк-храм с трезубцем на шпиле; здесь хранится Ледовая книга. Старший лоцман — Ульвар Тинд.', '', [16, -12])
place('lore-gs-white', 'Белый год', 'landmark', sx(cap), 987, '**987 г.** Залив замёрз целиком; Стяг весь год у лоцманов, Ульвар Тинд провёл хлебные когги Саренто по льду.', '', [-16, 12])
if (sar) place('lore-gs-pact', 'Пакт Саренто', 'landmark', sx(sar), 977.5, '**977.5.** Под золотым стягом Саренто пять полисов договорились: против зачинщика — все.', '', [14, 12])
if (etn) place('lore-gs-raid989', 'Набег Сигрунгов', 'battle', sx(etn), 989.5, '**989.5.** Хвалинги и Сигрунги Земель Севера жгут причалы Этнора; общий флот приходит через три дня.', '', [14, -12])
if (art) place('lore-gs-raid996', 'Морские псы', 'battle', sx(art), 996.5, '**996.5.** Двенадцать драккаров Аслака Морского Пса грабят причалы Артензи\'Винара.', '', [-14, -12])
if (art) place('lore-gs-wreck', 'Мачта Давида', 'landmark', sx(art), 1004.8, '**1004.8.** У мыса тонет ког наследника Уунааша Давида Яффе; лоцманы нашли только мачту.', '', [16, 14])
if (art) place('lore-gs-war976', 'Пожар верфи Винаров', 'battle', sx(art), 976.6, '**976.6.** Корабли Дрогенмау жгут верфь Артензи\'Винара — начало войны полисов.', '', [-16, 14])

world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-gs-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
if (etn && art && cap) world.armies.push({ id: 'lore-army-gs-981', name: 'Первый Набат: общий флот у Дрогенмау (981)', mapId: 'world', stateId: st.id, color: '#c83a3a', waypoints: [pt(art, 981.4), pt(etn, 981.45), pt(cap, 981.55)] })
if (cap && etn) world.armies.push({ id: 'lore-army-gs-989', name: 'Общий флот против Сигрунгов (989)', mapId: 'world', stateId: st.id, color: '#3a3a42', waypoints: [pt(cap, 989.5), pt(etn, 989.56)] })

writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Гренинсворд: описаний ${n}, мест ${world.places.filter((p) => p.id.startsWith('lore-gs-')).length}`)
