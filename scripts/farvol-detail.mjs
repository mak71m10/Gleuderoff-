// Фарвольская лига на карте: кто где живёт (подгорные чертоги и твердыни дварфов, гномьи долины и торговые городки,
// усадьбы имперских баронов), описания всех поселений, три ворот и замурованные Ледяные, Нижние врата, Наковальня
// Магнуса, места битв, походы Дозора. Придумано по поручению автора (07.11.2026) — «черновик». Детерминированно.
// Запуск после kreit-detail.mjs: node scripts/farvol-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { CLANS, FV_NAMES, HOUSES, STATE, SURFACE, fvRace } from './lore/farvol.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
let seed = 20261107
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const st = world.states.find((s) => s.base.name === STATE)
const admin = new Map(world.adminRegions.map((a) => [a.id, a]))
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const landOf = (p) => admin.get(admin.get(p.areaId)?.parentId)?.name ?? ''
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const sx = (p) => p.settlement ?? p
const byName = (nm) => provs.find((p) => p.name === nm)
const race = new Map(provs.filter((p) => p.settlement).map((p) => [p, fvRace(p.name, p.settlement.type, landOf(p))]))
const nearest = (p, list) => list.map(([k, n, seat]) => [k, n, byName(seat)]).filter((x) => x[2]).reduce((a, b) => (dist(b[2], p) < dist(a[2], p) ? b : a))
const dwarf = () => `${pick(FV_NAMES.dwarfMen)} из клана ${pick(CLANS)[1].replace('Клан ', '')}`
const gnome = () => `${pick(FV_NAMES.gnomeMen)} ${pick(FV_NAMES.gnomeHouses)}`
const human = () => `${pick(FV_NAMES.humanMen)} фон ${pick(FV_NAMES.humanNoble)}`

const ORE = ['серебро', 'медь', 'железо', 'олово', 'свинец', 'уголь']
const GNOME_TRADE = ['часы и весы', 'насосные трубы', 'стекло и лампы', 'медную утварь', 'механические замки', 'сыр и пиво', 'ткани с вышивкой', 'подъёмные блоки', 'мельничные колёса']
const FIELDS = ['ячмень на террасах', 'овёс', 'горную репу', 'коз и сыр', 'хмель', 'лён', 'грибы в старых штольнях', 'мёд']
const DEEP_NOTE = [
  'Улицы чертога освещают зеркальные шахты Глиммеров: днём здесь светло, как в пасмурный полдень, ночью горят масляные фонари.',
  'Свод держат каменные столбы толщиной в дом, на каждом вырезаны имена мастеров клана Тор, которые его поставили.',
  'Ниже жилых ярусов — шахты и застава Глубинного Дозора; из нижних ворот по ночам слышно, как стучит насос.',
  'На площади чертога — горн Магнуса: в нём никогда не гаснет огонь, и каждый новый молот клана куют здесь.',
  'Воздух гонят вниз мехи, которые крутят гномьи колёса на горном ручье; когда ручей замерзает, в нижних ярусах дышат через раз.'
]
const DWARF_NOTE = [
  'Над воротами — каменная голова предка с бородой до земли; через неё не проходят без поклона.',
  'Дома здесь низкие и толстостенные, с плоскими крышами, на которых сушат руду и бельё.',
  'Кузни работают день и ночь; сталь отсюда идёт на ярмарки у Фьяльских ворот.',
  'Половина мужчин внизу, в шахтах, половина — в Дозоре; на улицах днём одни старики и дети.',
  'Здесь помнят Тёмную неделю: на многих лампах — красное стекло.'
]
const GNOME_NOTE = [
  'Дома высокие и узкие, с медными крышами и флюгерами-шестерёнками; на каждой третьей крыше — башенка мастерской.',
  'На ручье — колесо, которое крутит меха, мельницу и часы на площади разом.',
  'Здесь говорят быстро, смеются громко и торгуются даже с родной бабушкой.',
  'У каждого дома — медная труба, из которой идёт пар: в мастерских греют котлы.',
  'Террасы вокруг долины гномы вырубили сами, и каждая подписана именем семьи, которая её держит.'
]

let n = 0
const capital = byName('Норг-Бад')
for (const [p, r] of race) {
  const t = p.settlement.type
  const land = landOf(p)
  const lines = []
  const clan = nearest(p, CLANS)
  const house = nearest(p, HOUSES)
  const noble = nearest(p, SURFACE)
  const clanSeat = CLANS.find((c) => c[2] === p.name)
  const houseSeat = HOUSES.find((c) => c[2] === p.name)
  const nobleSeat = SURFACE.find((c) => c[2] === p.name)
  if (p === capital) {
    lines.push('Норг-Бад — подгорная столица лиги. Город вырублен в горе на семь ярусов: наверху, у входа, — гномьи кварталы, рынок и Железный чертог рода Железных, где заседает Совет Свода; ниже — чертоги клана Норг, кузни и казна; ещё ниже — шахты и Нижние врата, за которыми начинается Глубь.')
    lines.push('Свет вниз несут зеркальные шахты Глиммеров. В Зале Свода шестьдесят одно каменное кресло; у входа — Стена павших с именами воинов Глубинного Дозора.')
    lines.push('Здесь живёт Первый Молот Гилдартс Железный; в нижних чертогах — Бальдрек Норгский.')
  } else if (clanSeat) {
    lines.push(`${p.name} — родовая твердыня клана ${clanSeat[1].replace('Клан ', '')}, одного из Семи Щитов. ${clanSeat[5].split('. ').slice(0, 2).join('. ')}.`)
    if (r === 'deep') lines.push('Твердыня целиком под горой: снаружи видны только ворота с каменными головами предков.')
  } else if (houseSeat) {
    lines.push(`${p.name} — усадьба ${houseSeat[1].replace('Дом ', 'Дома ')}, одной из Пяти Шестерён. ${houseSeat[5].split('. ').slice(0, 2).join('. ')}.`)
    lines.push('Высокий дом с медными крышами, мастерские, склады и контора, где считают доли для Переписи.')
  } else if (nobleSeat) {
    lines.push(`${p.name} — замок ${nobleSeat[1].replace('Дом ', 'Дома ')}, одного из пяти гербов Поверхности. ${nobleSeat[5].split('. ').slice(0, 2).join('. ')}.`)
  } else if (p.name === 'Азг-Кар') {
    lines.push('Азг-Кар — город кузнецов клана Азг. Сотни горнов, дым которых видно с перевалов, и в глубине — Наковальня Магнуса, святыня лиги. Здесь живёт Хранитель Горна Гудрун Пепельная.')
  } else if (p.name === 'Хаэ-Бад') {
    lines.push('Хаэ-Бад — торговый город у Фьяльских ворот, главных ворот лиги. Ярмарка, привратная контора Тиббальдов, весы, склады серебра и стали; дальше ярмарки чужеземец идёт только с грамотой.')
    lines.push('Город держат люди: ландфогт Поверхности, его стража и купцы, — но торгуют в нём гномы, а заставу у ворот держит Дозор.')
  } else if (p.name === 'Барак-Ази') {
    lines.push('Барак-Ази — Гарефордские ворота и Привратный горн: храм Магнуса, где горновые благословляют караваны, а Тиббальды взвешивают каждую чужую повозку. Через эти ворота идут лес, рыба и кожи Гарефорда и Гренинсворда.')
  } else if (r === 'deep') {
    lines.push(`${p.name} — подгорный ${t === 'castle' ? 'чертог-твердыня' : 'чертог'} клана ${clan[1].replace('Клан ', '')}: дома вырублены в стенах огромной пещеры, по дну идут улицы, над ними — каменный свод. Живут здесь одни дварфы, разве что при насосах — пара гномов-механиков.`)
    lines.push(`Добывают ${pick(ORE)} и ${pick(ORE)}. ${t === 'castle' ? `Чертогом правит старейшина ${dwarf()}` : `Старший мастер — ${dwarf()}`}.`)
    lines.push(pick(DEEP_NOTE))
  } else if (r === 'dwarf') {
    if (t === 'castle') {
      lines.push(`${p.name} — каменная твердыня клана ${clan[1].replace('Клан ', '')}: стены из цельного гранита, приземистые башни, кузня и вход в шахту под защитой стен.`)
      lines.push(land === 'Грунский хребет' ? `Твердыня стоит над гномьими долинами и над перевалами в Креит; её держит ${dwarf()} с сотней щитов.` : `Твердыней правит ${dwarf()}.`)
    } else if (t === 'tower') {
      lines.push(`${p.name} — сторожевая башня Дозора на перевале: отсюда огнём передают весть до Норг-Бада.`)
    } else {
      lines.push(`${p.name} — рудничный посёлок клана ${clan[1].replace('Клан ', '')}: низкие каменные дома у входа в штольню. Здесь живут только дварфы.`)
      lines.push(`Добывают ${pick(ORE)}; старший рудокоп — ${dwarf()}${chance(0.4) ? ', родившийся в шахтном долгу' : ''}.`)
    }
    lines.push(pick(DWARF_NOTE))
  } else if (r === 'gnome') {
    const fields = land !== 'Грунский хребет' || chance(0.45)
    lines.push(`${p.name} — гномья ${fields ? 'деревня пахарей' : 'деревня мастеров'} ${house[1].replace('Дом ', 'Дома ')}: высокие узкие дома с медными крышами, башенки мастерских, колёса на ручье. Здесь живут только гномы.`)
    lines.push(fields ? `Растят ${pick(FIELDS)} и ${pick(FIELDS)}${land === 'Зонгау' || land === 'Фьялская земля' ? `; землю арендуют у ${noble[1].replace('Дом ', 'Дома ')}` : ''}. Староста — ${gnome()}.` : `Делают ${pick(GNOME_TRADE)} и ${pick(GNOME_TRADE)}; старшина мастерских — ${gnome()}.`)
    if (fields && chance(0.5)) lines.push('Здесь сильна Борозда: пахари хотят, чтобы хлеб тоже считали долей на Переписи.')
    else lines.push(pick(GNOME_NOTE))
  } else {
    lines.push(`${p.name} — ${t === 'castle' ? 'замок' : 'городок'} имперской знати Поверхности: каменный дом под черепицей, церковь Света, конюшни. ${t === 'castle' ? `Держит его ${human()}, вассал ${noble[1].replace('Дом ', 'Дома ')}` : `Правит ландфогт ${human()}`}.`)
    lines.push('Вокруг — пашня, которую арендуют гномы-пахари; аренда — главный спор Скамьи Поверхности и Борозды.')
  }
  const tag = r === 'deep' ? 'подгорный чертог дварфов' : r === 'dwarf' ? 'дварфы' : r === 'gnome' ? 'гномы' : 'люди Поверхности'
  lines.push(`${land}; ${tag}.`)
  p.description = `${lines.join(' ')}\n\n_черновик_`
  n++
}

// ---------- места ----------
const place = (id, name, type, at, from, description, stateId = '', off = [14, 10]) => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler: type === 'capital' ? 'Первый Молот Гилдартс Железный' : '', image: '', description: `${description}\n\n_черновик_` }, history: [], from: from == null ? null : D(from), to: null })
}
place('lore-fv-capital', 'Норг-Бад', 'capital', sx(capital), null, '**Подгорная столица лиги.** Семь ярусов в горе: Железный чертог и Зал Свода наверху, чертоги Норгов посередине, Нижние врата — внизу.', st.id, [0, 0])
place('lore-fv-lowergate', 'Нижние врата', 'landmark', sx(capital), null, '**Где кончаются горы и начинается Глубь.** Запечатанные врата под Норг-Бадом; здесь стоит Глубинный Дозор. Битва 868 г.', '', [-16, 12])
const azg = byName('Азг-Кар')
if (azg) place('lore-fv-anvil', 'Наковальня Магнуса', 'temple', sx(azg), null, '**Святыня лиги.** Наковальня, которую, по преданию, оставил смертным Магнус. На ней куют Железный молот, по ней бьют на Выборе.', '', [14, -10])
const grond = byName('Грондгунд')
if (grond) place('lore-fv-blackvault', 'Битва в Чёрном Своде', 'battle', sx(grond), 999.2, '**999 г.** Твари выходят из нижних штолен Гронда. Тибор Железный гибнет; Гилдартс и Хельга Дургн трое суток держат штольню, пока Торы не обрушивают свод.', '', [-14, -12])
const khaz = byName('Кхаз-Гунд')
if (khaz) place('lore-fv-blind', 'Слепые штольни', 'ruins', sx(khaz), null, '**Заброшенные нижние штольни Кхаз-Гунда.** Рудокопы говорят, что там ходят без ламп. В 1010 г. Хельга Дургн их запечатала.', '', [14, 12])
const gate = (id, name, nm, off, desc) => { const p = byName(nm); if (p) place(id, name, 'landmark', sx(p), null, desc, '', off) }
gate('lore-fv-gate-fjal', 'Фьяльские ворота', 'Хаэ-Бад', [14, -10], '**Главные ворота лиги** — на Корону Аргус и север. Ярмарка серебра, стали и гномьих часов.')
gate('lore-fv-gate-zong', 'Зонгауские ворота', 'Кхаз-Адор', [14, -10], '**Ворота на Штирию и Аргус.** Хлеб, соль, вино. Пошлина с 1002 г. — Скамье Поверхности.')
gate('lore-fv-gate-gare', 'Гарефордские ворота', 'Барак-Ази', [-14, -10], '**Ворота на Гарефорд и Гренинсворд.** Лес, рыба, кожи; Привратный горн Магнуса.')
// Ледяные ворота — поселение лиги ближе всего к Ледяному перевалу Креита
const ice = world.places.find((p) => p.id === 'lore-kr-icepass')
const iceGate = ice ? provs.filter((p) => p.settlement).reduce((a, b) => (dist(b.settlement, ice) < dist(a.settlement, ice) ? b : a)) : null
if (iceGate) place('lore-fv-gate-ice', 'Ледяные ворота', 'ruins', sx(iceGate), 992.8, '**Ворота к Креиту, замурованные в 992 г.** Перевальная война: Драмы держат перевалы. Через них в 1006 г. пришёл Ульв Беглый.', '', [-14, 12])
const dram = byName('Драм-Кар')
if (dram) place('lore-fv-passwar', 'Перевальная война', 'battle', sx(dram), 992.5, '**992–994 гг.** Креит идёт за перевалами Фросланда; щиты Драмов держат все, кроме Ледяного.', '', [14, 12])
// Ульв Беглый живёт там, куда дошёл после Ледяного перевала
const ulvArmy = world.armies?.find((a) => a.id === 'lore-army-kr-ulv')
const ulvPt = ulvArmy?.waypoints.at(-1)
const ulvHome = ulvPt ? provs.filter((p) => p.settlement).reduce((a, b) => (dist(b.settlement, ulvPt) < dist(a.settlement, ulvPt) ? b : a)) : null
if (ulvHome) {
  place('lore-fv-ulv', 'Двор Ульва Беглого', 'landmark', sx(ulvHome), 1006.7, '**Беглый сын Скарди и сорок его людей.** Совет Свода дал им кров в 1006 г.; по закону Креита Жатва 1004 г. не кончена, пока Ульв жив.', '', [-14, -10])
  ulvHome.description = ulvHome.description.replace('\n\n_черновик_', ' Здесь живёт Ульв Беглый, сын ярла Скарди, с сорока креитцами.\n\n_черновик_')
}

// ---------- походы Дозора ----------
world.armies = (world.armies ?? []).filter((a) => !a.id.startsWith('lore-army-fv-'))
const pt = (p, y) => { const s = sx(p); return { x: Math.round(s.x), y: Math.round(s.y), date: D(y) } }
let marches = 0
if (capital && grond) { world.armies.push({ id: 'lore-army-fv-999', name: 'Глубинный Дозор в Чёрный Свод (999)', mapId: 'world', stateId: st.id, color: '#6b5a4a', waypoints: [pt(capital, 999.1), pt(grond, 999.2), pt(capital, 999.35)] }); marches++ }
if (dram && iceGate) { world.armies.push({ id: 'lore-army-fv-992', name: 'Щиты Драмов на перевалах (992)', mapId: 'world', stateId: st.id, color: '#2e3a4a', waypoints: [pt(dram, 992.4), pt(iceGate, 992.6), pt(dram, 994.2)] }); marches++ }
if (capital && azg) { world.armies.push({ id: 'lore-army-fv-976', name: 'Ульдрих поднимает горы (976)', mapId: 'world', stateId: st.id, color: '#c9a04a', waypoints: [pt(azg, 976.2), pt(capital, 976.4), pt(byName('Хаэ-Бад') ?? capital, 976.8)] }); marches++ }

writeFileSync(WORLD, JSON.stringify(world, null, 1))
const cnt = {}
for (const r of race.values()) cnt[r] = (cnt[r] ?? 0) + 1
console.log(`Фарвольская лига: описаний ${n}, по народам ${JSON.stringify(cnt)}, Ледяные ворота — ${iceGate?.name}, двор Ульва — ${ulvHome?.name}, походов ${marches}`)
