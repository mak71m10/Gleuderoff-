// Обливиум Каэлорум, Семья Каяя и Ла Роше на карте (волна 3, 21.11.2026): поселения, описания, места.
// Обливиум: Пиеция — аббатство-некрополь (столица), Альбенора — обсерватория, Альбис — ворота караванов.
// Каяя: Империум (бывш. Обербах) — столица и Большой банк. Ла Роше: Тореццо — столица и Дом Лозы.
// Запуск после reich-detail.mjs: node scripts/south-church-detail.mjs
import { readFileSync, writeFileSync } from 'fs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261125
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const stOf = (n) => world.states.find((s) => s.base.name === n)
const provsOf = (st) => world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const sx = (p) => p.settlement ?? p
const landOf = (p) => `${admin.get(p.areaId)?.name ?? ''}`
const setTown = (p, type, name) => {
  if (!p) return
  if (name) { const area = admin.get(p.areaId); if (area?.name === `Округ ${p.name}`) area.name = `Округ ${name}`; p.name = name }
  p.settlement = { ...(p.settlement ?? { x: p.x, y: p.y }), type }
}
const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}

// ---------- Обливиум ----------
{
  const st = stOf('Обливиум Каэлорум'), ps = provsOf(st), by = (n) => ps.find((p) => p.name === n)
  setTown(by('Пиеция'), 'temple'); setTown(by('Альбенора'), 'tower'); setTown(by('Альбис'), 'village')
  const NOTE = ['Колокол здесь бьёт только по мёртвым: раз — за мирянина, трижды — за знатного.', 'Монахи разговаривают знаками: ладонь к сердцу — «да», ладонь к земле — «нет».', 'Вдоль дороги стоят столбы с медными звёздами: по ним идут похоронные караваны.', 'Миряне-могильщики живут у кладбищенских ворот и говорят шёпотом даже дома.']
  let n = 0
  for (const p of ps.filter((x) => x.settlement)) {
    const L = []
    if (p.name === 'Пиеция') L.push('Пиеция — аббатство и великий некрополь Обливиума: белые стены, двор без единого звука и девять ярусов подземных галерей, куда девятьсот лет везут хоронить знатных мёртвых юга. Над кельей аббата — медная звезда Аргенту.')
    else if (p.name === 'Альбенора') L.push('Альбенора — обсерватория Ордена: круглая башня с раскрытым куполом. Приор Тацит ночами считает звёзды и записывает их числами, без имён.')
    else if (p.name === 'Альбис') L.push('Альбис — ворота похоронных караванов: здесь сидят «говорящие» привратники и контора Каяя, а дальше дорога идёт молча.')
    else { L.push(`${p.name} — приход Ордена: часовня со звездой на шпиле, кладбище больше деревни и дома мирян-могильщиков.`); L.push(pick(NOTE)) }
    L.push(`${landOf(p)}; земля Ордена Безмолвного Неба.`)
    p.description = L.join(' '); n++
  }
  const cap = by('Пиеция'), obs = by('Альбенора'), gate = by('Альбис'), bea = by('Беатанора')
  if (cap) { place('lore-obl-capital', 'Пиеция', 'capital', sx(cap), null, '**Аббатство и некрополь.** Капитул молчащих, Книга Покоя.', st.id, [0, 0], 'Аббат Целестин'); place('lore-obl-necropolis', 'Великий некрополь', 'temple', sx(cap), 512.3, '**Девять ярусов галерей** под аббатством.', '', [-16, -12]) }
  if (obs) place('lore-obl-observatory', 'Обсерватория Альбеноры', 'landmark', sx(obs), 700, '**Купол над лесом.** Звёзды Аргенту — числами, без имён.', '', [14, -10])
  if (gate) place('lore-obl-gate', 'Ворота караванов', 'landmark', sx(gate), 1009.1, '**1009.1.** Договор Каяя: отсюда идут похоронные караваны из Империума.', '', [14, 10])
  if (bea) place('lore-obl-word', 'Слово Остиария', 'battle', sx(bea), 1004.2, '**1004.2.** Приор заговорил с охотниками Рейха и спас караван с телами.', '', [-14, 10])
  console.log(`Обливиум: описаний ${n}`)
}

// ---------- Семья Каяя ----------
{
  const st = stOf('Семья Каяя'), ps = provsOf(st), by = (n) => ps.find((p) => p.name === n || p.name === 'Империум')
  setTown(ps.find((p) => p.name === 'Обербах' || p.name === 'Империум'), 'city', 'Империум')
  let n = 0
  for (const p of ps.filter((x) => x.settlement)) {
    const L = []
    if (p.name === 'Империум') {
      L.push('Империум — вольный торговый город и личная резиденция Дома Каяя: мраморные набережные, конторы в каждом доме и рынок, где торгуют на десяти языках. Над городом стоит Большой банк — золотой купол, видный с моря за полдня пути.')
      L.push('Правит Геральд Каяя. В подвалах банка — казна, которой должен весь континент; под куполом — круглый стол, за которым в Ночь Карт переходят Доли Дома.')
    } else if (p.settlement.type === 'fishing') {
      L.push(`${p.name} — рыбацкая гавань под скалами: лодки, коптильни и соляные сараи. Улов уходит в Империум, а долги рыбаков записаны в той же книге, что долги королей.`)
    } else L.push(`${p.name} — горная деревня над Империумом: виноградные террасы и загородные виллы конторщиков.`)
    L.push(`${landOf(p)}; владение Дома Каяя.`)
    p.description = L.join(' '); n++
  }
  const cap = by('Империум')
  if (cap) { place('lore-ky-capital', 'Империум', 'capital', sx(cap), null, '**Вольный торговый город.** Большой банк и Книга долгов.', st.id, [0, 0], 'Геральд Каяя'); place('lore-ky-bank', 'Большой банк', 'landmark', sx(cap), 970.4, '**Золотой купол.** Подвалы казны, стол Ночи Карт.', '', [-16, -12]) }
  console.log(`Каяя: описаний ${n}`)
}

// ---------- Ла Роше ----------
{
  const st = stOf('Ла Роше'), ps = provsOf(st), by = (n) => ps.find((p) => p.name === n)
  const NOTE = ['Склоны над деревней — в виноградных террасах Сестёр; в сбор винограда работают все, даже рыбаки.', 'У часовни Аматерасу — каменная чаша с землёй: каждый новорождённый получает в ладонь её горсть.', 'По вечерам на площади пьют молодое вино и спорят, кто из двух ключей хуже.', 'Сестра Лозы приходит раз в неделю: лечит, крестит, принимает роды и не спрашивает, кто отец.']
  let n = 0
  for (const p of ps.filter((x) => x.settlement)) {
    const L = []
    if (p.name === 'Тореццо') L.push('Тореццо — столица Ла Роше и главная гавань: розовые и охристые дома под черепицей, над ними — виноградники и Дом Лозы с белой часовней Аматерасу. Здесь сидит Мать Кьяра Ферелли, а на набережной — контора Каяя под маленьким золотым кораблём.')
    else if (p.name === 'Ферелико') L.push('Ферелико — второй порт: скалы, узкие улицы-лестницы и капитаны, которые знают, как пройти мимо таможни Республики.')
    else if (p.settlement.type === 'fishing') { L.push(`${p.name} — рыбацкая деревня: лодки на гальке, сети на кольях, часовня Аматерасу у самой воды.`); L.push(pick(NOTE)) }
    else { L.push(`${p.name} — деревня на склоне: виноградники, оливы, каменные дома под черепицей.`); L.push(pick(NOTE)) }
    L.push(`${landOf(p)}; земля Сестёр Лозы.`)
    p.description = L.join(' '); n++
  }
  const cap = by('Тореццо'), fer = by('Ферелико')
  if (cap) { place('lore-lrs-capital', 'Тореццо', 'capital', sx(cap), null, '**Столица Ла Роше.** Дом Лозы и гавань.', st.id, [0, 0], 'Мать Кьяра Ферелли'); place('lore-lrs-house', 'Дом Лозы', 'temple', sx(cap), 602.4, '**Мать-обитель Сестёр Лозы** над виноградниками.', '', [-16, -12]) }
  if (fer) place('lore-lrs-smugglers', 'Скалы Ферелико', 'landmark', sx(fer), null, '**Тайные причалы** капитанов.', '', [14, 10])
  console.log(`Ла Роше: описаний ${n}`)
}

writeFileSync(WORLD, JSON.stringify(world, null, 1))
