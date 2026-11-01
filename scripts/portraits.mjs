// Портреты персонажей Империи в духе средневековой фэнтези-живописи (масло, придворный портрет).
// Рисует локальная нейросеть: stable-diffusion.cpp (Vulkan) + модель DreamShaper 8 в tools/sd (не в git).
// Описание картины собирается из записи: пол, возраст, титул, характер, цвета великого дома; у ключевых
// персонажей — своё описание. Готовые портреты не перерисовываются (удалите файл, чтобы перерисовать).
// Запуск: node scripts/portraits.mjs [id …]  → resources/default-world/portraits/<id>.webp и поле image в записи
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import { HOUSES } from './lore/empire.mjs'

const WORLD = 'resources/default-world/world.json'
const OUT = 'resources/default-world/portraits'
const SD = 'tools/sd/bin/sd-cli.exe'
const MODEL = 'tools/sd/models/dreamshaper8.safetensors'
// на этом компьютере: денойзинг — на AMD R9 380 (веса в ОЗУ), текст — на процессоре, VAE — на встроенной Intel.
// Без явного выбора sd.cpp считает всё на Intel — в 4–5 раз медленнее. SD_BACKEND в окружении переопределяет.
const BACKEND = ['--backend', process.env.SD_BACKEND ?? 'diffusion=vulkan0,te=cpu,vae=vulkan1']
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const yearOf = (d) => (d == null ? null : Math.floor(d / YEAR) + 1)
mkdirSync(OUT, { recursive: true })

const STYLE = 'oil painting, medieval fantasy court portrait, renaissance old master style, dramatic chiaroscuro lighting, dark ornate background, rich textures, visible brush strokes, highly detailed face, half-length portrait, masterpiece'
const NEG = '(asian:1.5), (east asian, chinese, japanese, korean, mongolian:1.4), epicanthic fold, monolid eyes, narrow eyes, photo, photorealistic, 3d render, modern clothing, text, watermark, signature, frame border, blurry, lowres, deformed, extra fingers, extra limbs, cartoon, anime, nsfw, nude'

// цвета домов -> слова для одежды
const HOUSE_COLORS = {
  essenwald: 'black and gold', rheinhold: 'crimson and black', morving: 'deep blue and white', grauenstein: 'grey and silver',
  littenau: 'green and gold', falkenhorst: 'gold and crimson', tessen: 'forest green and brown', saltmar: 'white and teal',
  hoeldern: 'deep blue and gold', brandt: 'black and flame red', osterveld: 'purple and gold', kronau: 'white and gold',
  'house-argus': 'navy blue and silver', 'house-mangenium': 'brown and gold', 'house-styria': 'black and dark purple'
}
const houseOf = new Map(HOUSES.map((h) => [`lore-${h.id}`, h.id]))

// особые описания ключевых персонажей
const CUSTOM = {
  'teyber-1': 'stern powerful germanic warlord emperor like a medieval king of the holy roman empire in his fifties, very broad shoulders, thick black beard, short black hair, cold hard grey eyes, square jaw, massive black and crimson plate armor with dragon motifs, heavy golden imperial crown, faint fire glow in his palm, symbol of the empire',
  sandra: 'beautiful proud archmage empress, flowing red hair, fiery eyes, crimson and gold robes, flames swirling around her hands, confident smile',
  robert: 'gentle wise old emperor with long white beard, kind tired eyes, scholarly crimson robes, holding a scroll of laws, golden crown',
  lutsiy: 'mad tyrant emperor, gaunt face, wild burning eyes, cruel smile, black and crimson robes, crown askew, flames and gallows in the background',
  'teyber-2': 'young gentle emperor around twenty, sad kind eyes, soft features, crimson imperial robes too heavy for him, golden crown',
  'oktavian-2': '(newborn baby:1.5), (chubby infant face:1.4), tiny pale baby sleeping in a golden cradle, tiny crown beside the pillow, crimson silk blankets, candlelight, melancholic atmosphere',
  'feliks-1': 'fat sleepy emperor with heavy eyelids, double chin, half asleep on a throne, crimson robes, crown slipping',
  'dominik-1': 'corpulent jolly emperor feasting, rosy cheeks, holding a roasted leg and golden goblet, crimson robes, crown',
  'ulrich-1': 'drunk emperor with red nose and bleary eyes, wine goblet, disheveled crimson robes, crooked crown',
  'sebastian-1': 'very handsome vain emperor, perfect curly hair, charming smile, lavish crimson and gold clothes, mirror in hand',
  'markus-1': 'arrogant handsome young emperor, duelist rapier, slick hair, vain expression, crimson doublet',
  'sandra-2': 'cold beautiful empress in her forties, sharp eyes, fire mage, crimson gown, flames curling around fingers',
  'izolda-1': 'stern iron widow empress, black mourning veil, steel breastplate over crimson gown, crown',
  'korvin-1': 'quiet melancholic emperor poet, holding a red rose, soft sad face, crimson robes',
  'adrian-1': 'adventurous emperor sea captain, weathered face, ships and sea behind him, crimson naval coat, spyglass',
  'robert-2': 'near-sighted emperor astronomer with spectacles, starry sky, telescope, crimson robes',
  'severin-1': 'bookish emperor scholar surrounded by books and glowing runes, crimson robes',
  'valerian-1': 'cheerful rugged emperor builder covered in stone dust, holding blueprints, crimson cloak',
  'gabriel-1': 'pious ascetic emperor, hollow cheeks, holy light in his hands, white and crimson robes, cathedral background',
  'valerian-2': 'bitter grim emperor in mourning black over crimson, hard eyes, ash in the air',
  'markus-2': 'emperor cartographer holding a great map, travel cloak over crimson robes',
  'konrad-1': 'just emperor judge with a stern fair face, holding scales and a law book, crimson robes',
  'robert-3': 'cautious elderly emperor, careful eyes, modest crimson robes',
  'oktavian-1': 'dry pedantic emperor accountant with ledger and quill, thin face, crimson robes',
  'ansgar-2': 'old impulsive bitter prince, white beard, angry eyes, black fur mantle with silver, princely circlet',
  'anselm-fern': 'grizzled medieval general with scarred face, steel armor, black cloak, battle standard',
  jakasta: 'proud desert king, dark skin, black and gold robes, golden headdress, desert temple and fire behind',
  'durin-kald': 'old dwarf advisor with long braided white beard, gold rings, leather and fur, forge glow',
  'heribert-steiner': 'tough supreme marshal, broad shoulders, close-cropped grey hair, many medals, steel and dark blue uniform',
  'margot-vellen': 'stern female admiral, weathered face, dark blue naval coat with gold braid, sea behind',
  'kaya-head': 'smiling rich merchant patriarch, golden chains and rings, black velvet, coins and ships behind',
  'styria-now': 'pale nocturnal grand duke, gaunt, dark purple and black velvet, moonlight, unsettling eyes',
  'ulrike-brandt': 'fierce woman commander in snowy north, fur cloak over black armor, flame emblem',
  'matthias-essenwald': 'young army captain, steel breastplate, defiant eyes',
  'bernhard-rheinhold': 'old veteran legate with an eyepatch, missing leg, crutch, worn crimson coat',
  // Корона Аргус
  'argus-now': 'pious cunning mountain king in his late forties, thin clean-shaven face, calm hooded eyes, faint humble smile, simple silver crown, navy blue robes with silver mountains, prayer beads in his fingers, gold ring with a large ruby',
  'argus-heir': 'stern pious young crown princess, pale ascetic face, dark hair in a tight braid, cold clever eyes, navy blue cloak with a silver mountain clasp over light mail, small silver circlet, a prayer book in her hand',
  'ag-argus-1': '(bareheaded, no crown:1.4), shrewd lowborn middle-aged steward of an old principality, plain dark wool coat, many keys and a ledger, sharp watchful eyes, early medieval',
  'ag-irmfrid': 'cautious diplomat lord, early medieval, holding a gold ring with a ruby, silver crown on a cushion beside him, navy and silver',
  'ag-ortrun': 'stern widow ruler, grey hair under a white wimple, navy blue gown, gold ring with a ruby, iron will',
  'ag-tankred': 'cruel stern lord in red-stained steel armor, crosses on a road in the background, navy cloak',
  'ag-wolfram': 'blind old lord with milky white eyes, long white hair, navy velvet, listening intently',
  'ag-eberhard': 'patient grey-bearded first king, weary eyes, silver crown of mountains, navy blue mantle, ruby ring',
  'ag-gottfried': 'bitter proud older prince, grey hair, severe face, navy and black doublet',
  'ag-kassian': 'charming dissolute young prince, playing cards and wine cup, smug smile, navy and silver doublet',
  'ag-dietmar': 'hot-tempered young swordsman prince, silver gorget, navy surcoat, sword hilt',
  'ag-joachim': '(teenage boy of fifteen:1.4), (no crown:1.3), gentle novice monk with a tonsure, plain grey wool habit with a rope belt, holding a candle, pale thoughtful face',
  'matilda-argus': 'quiet pious queen, pale face, dark eyes, white veil and navy gown, silver crown, rosary',
  'klemens-grisbach': 'stern archbishop in white and gold vestments, mitre, navy cope, golden chalice',
  'vignand-ulfengard': 'old fanatical knight-monk grand master, white surcoat with a red ruby ring emblem, hair shirt collar visible, grey beard',
  'ag-asher': 'proud dark-skinned freedman colonel from the southern desert peoples, shaved head, scarred, half-riveted iron ring on a chain around his neck, navy uniform, steady fierce eyes',
  'hildegunde-waldeck': '(very old wrinkled woman of eighty:1.4), stern abbess-princess in black and white habit with a golden crozier and a cross',
  'bonifaz-waldeck': 'abbot-prince in brown monastic habit with a golden crozier',
  'leodegar-waldeck': 'builder abbot-prince in white habit with a stone mason square and crozier',
  'fredegar-waldeck': 'scholarly abbot-prince in white habit surrounded by books',
  'roswitha-morwen': 'fierce countess in mail armor holding a long spear, purple and silver cloak, crescent moon emblem',
  'morwena': 'warrior countess founder with braided hair, spear and purple cloak'
}
// без короны: незнатные и монахи (корону подсказывает герб рода на знамени)
const NO_CROWN = new Set(['ag-argus-1', 'ag-joachim'])
const word = (e) => {
  const p = e.base.props ?? {}
  // роль — только по титулу и занятию: в биографиях упоминаются императоры, это не делает героя императором
  const t = `${e.base.title} ${p.occupation ?? ''}`.toLowerCase()
  const female = p.gender === 'Женский'
  const born = yearOf(e.from)
  const end = yearOf(e.to) ?? 1010
  // Монстарги стареют медленно: делим возраст
  const drag = (p.race ?? '').includes('Драконья') ? 0.65 : 1
  const age = born != null ? Math.max(1, Math.round((Math.min(end, 1010) - born) * drag)) : 45
  const ageW = age < 6 ? 'small child' : age < 14 ? `child of ${age}` : age < 22 ? 'young' : age < 35 ? 'youthful adult' : age < 50 ? 'middle-aged' : age < 65 ? 'aging, grey-haired' : 'elderly, white-haired'
  const who = female ? 'woman' : 'man'
  let role = 'noble'
  if (/наместни/.test(t)) role = female ? 'lady governor in a silver mountain coronet and dark blue gown, gold ring with a ruby' : 'lord governor in a silver mountain coronet and dark blue robes, gold ring with a ruby'
  else if (/глава рода аргус/.test(t)) role = 'early medieval wealthy landowner lord in dark wool and fur, silver chain'
  else if (/аббат/.test(t)) role = female ? 'abbess-princess in a monastic habit with a golden crozier' : 'abbot-prince in a monastic habit with a golden crozier'
  else if (/императриц/.test(t) && !/консорт/.test(t)) role = 'reigning empress wearing a golden imperial crown and crimson gown with black dragon embroidery'
  else if (/император/.test(t)) role = 'emperor wearing a golden imperial crown and crimson robes with black dragon embroidery'
  else if (/консорт/.test(t)) role = female ? 'empress consort with a jeweled tiara and crimson gown' : 'prince consort in rich crimson doublet'
  else if (/кронпринц|принц/.test(t)) role = female ? 'imperial princess with a small tiara, crimson dress' : 'imperial prince with a gold circlet, crimson doublet'
  else if (/княгин|князь/.test(t)) role = female ? 'medieval princess of a small realm, silver circlet, black and silver dress' : 'medieval prince of a small realm, silver circlet, black fur mantle'
  else if (/претендент/.test(t)) role = 'scheming medieval nobleman, black fur, silver chain'
  else if (/король/.test(t)) role = 'king with a silver crown over mountains'
  else if (/граф/.test(t)) role = female ? 'countess in rich velvet with a coronet' : 'count in rich velvet with a coronet'
  else if (/барон|бургграф|кастелян/.test(t)) role = female ? 'baroness in velvet with a pearl coronet' : 'baron in velvet and fur with a silver chain'
  else if (/архиеп|настоятель|священ/.test(t)) role = female ? 'abbess in white and gold habit' : 'archbishop in white and gold vestments with a sun-and-eye pendant'
  else if (/легат|капитан|генерал|маршал|командир|стражи/.test(t)) role = 'military officer in polished steel armor'
  else if (/магес|магистр|архимаг/.test(t)) role = 'mage scholar in robes with glowing runes'
  else if (/наездник|конев|ловч|охот/.test(t)) role = 'huntsman noble in leather and fur'
  else if (/рудник|литейн/.test(t)) role = 'mining noble with iron jewelry'
  else role = female ? 'noblewoman in velvet gown' : 'nobleman in velvet doublet'
  const hid = houseOf.get(e.base.links?.dynasty)
  const dynH = world.entries.find((x) => x.id === e.base.links?.dynasty)?.base.heraldry
  const colors = hid ? `, clothes in ${HOUSE_COLORS[hid]} colors` : dynH ? `, clothes in ${[...new Set(dynH.colors)].map(colorName).join(' and ')} colors` : ''
  const pers = p.personality ?? e.base.summary ?? ''
  const mood = /жесток|безум|тиран|кровав/.test(pers.toLowerCase()) ? ', cruel menacing expression' : /добр|мягк|тих/.test(pers.toLowerCase()) ? ', gentle expression' : /горд|холод|строг/.test(pers.toLowerCase()) ? ', proud cold expression' : ''
  return `${ageW} ${who}, ${role}${colors}${mood}`
}
// ---------- знамёна: правителям — флаг страны, знати — знамя рода ----------
const COLOR_NAMES = [
  ['crimson', '#a01c24'], ['dark red', '#5a1a1a'], ['black', '#141414'], ['gold', '#c9a45c'], ['white', '#ece6d6'], ['silver', '#b8b8c0'],
  ['grey', '#5a5a64'], ['navy blue', '#1f3f6a'], ['deep blue', '#2a2a5a'], ['teal', '#2f6876'], ['green', '#2f5a2a'], ['brown', '#5a3a1a'],
  ['purple', '#5a2a4a'], ['dark purple', '#2a1a2a'], ['orange', '#c96a2a']
]
const colorName = (hex) => {
  const h = (hex ?? '#888888').replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  if (Math.max(r, g, b) < 48) return 'black'
  let best = 'grey', bd = Infinity
  for (const [n, c] of COLOR_NAMES) {
    const [R, G, B] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2
    if (d < bd) { bd = d; best = n }
  }
  return best
}
const EMBLEM_WORDS = {
  dragon: 'a black dragon', sword: 'a sword', swords: 'crossed swords', crown: 'a crown', tower: 'a tower', tree: 'a tree', wave: 'waves',
  star: 'a star', moon: 'a crescent moon', skull: 'a skull', hammer: 'a hammer', axe: 'an axe', flame: 'a flame', rose: 'a rose',
  cross: 'a cross', key: 'a key', anchor: 'an anchor', ship: 'a ship', mountain: 'a mountain', book: 'an open book', eagle: 'an eagle',
  wolf: 'a wolf', scales: 'scales', chalice: 'a chalice', chain: 'a chain', 'sun-eye': 'a sun with an eye'
}
const bannerText = (h) => {
  if (!h) return ''
  const field = h.colors.length > 1 && h.colors[0] !== h.colors[1] ? `${colorName(h.colors[0])} and ${colorName(h.colors[1])}` : colorName(h.colors[0])
  const em = EMBLEM_WORDS[h.emblem] ? ` with ${EMBLEM_WORDS[h.emblem].replace(/^an? /, (m) => m)} in ${colorName(h.emblemColor)}` : ''
  return `a large ${field} heraldic banner${em}`
}
const stateByName = (n) => world.states.find((st) => st.base.name === n)
const empireSt = stateByName('Империя')
const princedomHeraldry = empireSt.history.find((h) => h.patch?.heraldry)?.patch.heraldry
const bannerFor = (e) => {
  const t = e.base.title
  const id = e.id.slice(5)
  if (id === 'jakasta') return bannerText(world.states.find((st) => st.id === 'hist-desert')?.base.heraldry)
  // императоры, императрицы и регент — имперский стяг: алый с чёрным драконом
  if (/Император|Императрица|Регент Дагерфорда/.test(t) && !/консорт/.test(t)) return 'a large crimson imperial banner with a black dragon'
  // князья и княгини Дагерфорда — флаг княжества
  if (/^(Князь|Княгиня) Дагерфорда/.test(t)) return bannerText(princedomHeraldry)
  // короли и графы вассалов — флаг их страны
  const ruled = world.states.find((st) => st.base.rulerId === e.id)
  if (ruled?.base.heraldry) return bannerText(ruled.base.heraldry)
  // знать — знамя рода
  const dyn = world.entries.find((x) => x.id === e.base.links?.dynasty)
  if (dyn?.base.heraldry) return bannerText(dyn.base.heraldry)
  // Монстарги без титула правителя и супруги — имперский стяг
  if (e.base.links?.dynasty === 'lore-monstarg' || /консорт|Принц/.test(t) || e.base.tags.includes('армия')) return 'a large crimson imperial banner with a black dragon'
  return ''
}
const seedOf = (id) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 1000000

const IDS = new Set(process.argv.slice(2).map((x) => (x.startsWith('lore-') ? x : `lore-${x}`)))
const chars = world.entries.filter(
  (e) =>
    e.kind === 'character' &&
    (IDS.size ? IDS.has(e.id) : e.base.tags.some((t) => ['Монстарги', 'Дагерфорд', 'Великие дома', 'армия', 'Корона Аргус'].includes(t)) || ['lore-kaya-head', 'lore-korvin-argus', 'lore-jakasta', 'lore-anselm-fern'].includes(e.id))
)
let done = 0
for (const e of chars) {
  const id = e.id.slice(5)
  const file = `${OUT}/${id}.webp`
  if (existsSync(file) && !IDS.size) {
    e.base.image = `portraits/${id}.webp`
    continue
  }
  const subject = CUSTOM[id] ?? word(e)
  // европейская внешность — людям-гладрам; южанам, дварфам и прочим — нет
  const race = e.base.props?.race ?? ''
  const imperial = !['jakasta', 'durin-kald'].includes(id) && (!race || /гладр|имперец|^Человек$/.test(race))
  // у незнатных и монахов — знамя рода без эмблемы, иначе нейросеть надевает им корону с герба
  const flag = NO_CROWN.has(id) ? bannerFor(e).replace(/ with .*$/, '') : bannerFor(e)
  const banner = flag ? `(${flag} hanging on the wall behind:1.35), ` : ''
  const prompt = `${STYLE}, ${banner}portrait of a ${imperial ? (id === 'oktavian-2' ? '(pale european baby:1.2), ' : '(northern european, germanic features, pale skin, deep-set eyes, strong brow ridge, prominent straight nose:1.3), ') : ''}${subject}`
  if (process.env.DRY) {
    console.log(`${e.base.name}: ${prompt.slice(STYLE.length + 2)}`)
    continue
  }
  const tmp = `tools/sd/out-${id}.png`
  const t0 = Date.now()
  execFileSync(SD, ['-m', MODEL, ...BACKEND, '-p', prompt, '-n', NO_CROWN.has(id) ? `${NEG}, (crown, tiara, circlet, diadem:1.5)` : NEG, '-W', '512', '-H', '640', '--steps', '22', '--cfg-scale', '6.5', '--sampling-method', 'dpm++2m', '--scheduler', 'karras', '-s', String(seedOf(id) + Number(process.env.SEED_OFFSET ?? 0)), '-o', tmp], { stdio: 'ignore' })
  await sharp(tmp).webp({ quality: 86 }).toFile(file)
  rmSync(tmp, { force: true })
  e.base.image = `portraits/${id}.webp`
  writeFileSync(WORLD, JSON.stringify(world, null, 1)) // сохраняем после каждого — можно прервать и продолжить
  console.log(`[${++done}/${chars.length}] ${e.base.name} — ${((Date.now() - t0) / 1000).toFixed(0)} с`)
}
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Готово: портретов ${chars.filter((e) => e.base.image).length} из ${chars.length}`)
