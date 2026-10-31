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
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const yearOf = (d) => (d == null ? null : Math.floor(d / YEAR) + 1)
mkdirSync(OUT, { recursive: true })

const STYLE = 'oil painting, medieval fantasy court portrait, renaissance old master style, dramatic chiaroscuro lighting, dark ornate background, rich textures, visible brush strokes, highly detailed face, half-length portrait, masterpiece'
const NEG = 'photo, photorealistic, 3d render, modern clothing, text, watermark, signature, frame border, blurry, lowres, deformed, extra fingers, extra limbs, cartoon, anime, nsfw, nude'

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
  'teyber-1': 'stern emperor in his fifties, cold calm eyes, short dark hair with grey, black and crimson plate armor with dragon motifs, golden imperial crown, faint fire glow in his palm, burning city far behind',
  sandra: 'beautiful proud archmage empress, flowing red hair, fiery eyes, crimson and gold robes, flames swirling around her hands, confident smile',
  robert: 'gentle wise old emperor with long white beard, kind tired eyes, scholarly crimson robes, holding a scroll of laws, golden crown',
  lutsiy: 'mad tyrant emperor, gaunt face, wild burning eyes, cruel smile, black and crimson robes, crown askew, flames and gallows in the background',
  'teyber-2': 'young gentle emperor around twenty, sad kind eyes, soft features, crimson imperial robes too heavy for him, golden crown',
  'oktavian-2': 'infant emperor in a golden cradle, tiny crown, crimson silk blankets, candlelight, melancholic atmosphere',
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
  'bernhard-rheinhold': 'old veteran legate with an eyepatch, missing leg, crutch, worn crimson coat'
}
const word = (e) => {
  const p = e.base.props ?? {}
  const t = `${e.base.title} ${e.base.body} ${p.occupation ?? ''}`.toLowerCase()
  const female = p.gender === 'Женский'
  const born = yearOf(e.from)
  const end = yearOf(e.to) ?? 1010
  // Монстарги стареют медленно: делим возраст
  const drag = (p.race ?? '').includes('Драконья') ? 0.65 : 1
  const age = born != null ? Math.max(1, Math.round((Math.min(end, 1010) - born) * drag)) : 45
  const ageW = age < 6 ? 'small child' : age < 14 ? `child of ${age}` : age < 22 ? 'young' : age < 35 ? 'in their late twenties' : age < 50 ? 'middle-aged' : age < 65 ? 'aging, grey-haired' : 'elderly, white-haired'
  const who = female ? 'woman' : 'man'
  let role = 'noble'
  if (/императриц/.test(t) && !/консорт/.test(t)) role = 'reigning empress wearing a golden imperial crown and crimson gown with black dragon embroidery'
  else if (/император/.test(t)) role = 'emperor wearing a golden imperial crown and crimson robes with black dragon embroidery'
  else if (/консорт/.test(t)) role = female ? 'empress consort with a jeweled tiara and crimson gown' : 'prince consort in rich crimson doublet'
  else if (/кронпринц|принц/.test(t)) role = female ? 'imperial princess with a small tiara, crimson dress' : 'imperial prince with a gold circlet, crimson doublet'
  else if (/княгин|князь/.test(t)) role = female ? 'medieval princess of a small realm, silver circlet, black and silver dress' : 'medieval prince of a small realm, silver circlet, black fur mantle'
  else if (/претендент/.test(t)) role = 'scheming medieval nobleman, black fur, silver chain'
  else if (/король/.test(t)) role = 'king with a silver crown over mountains'
  else if (/граф/.test(t)) role = 'countess in rich velvet with a coronet'
  else if (/архиеп|настоятель|священ/.test(t)) role = female ? 'abbess in white and gold habit' : 'archbishop in white and gold vestments with a sun-and-eye pendant'
  else if (/легат|капитан|генерал|маршал|командир|стражи/.test(t)) role = 'military officer in polished steel armor'
  else if (/магес|магистр|архимаг/.test(t)) role = 'mage scholar in robes with glowing runes'
  else if (/наездник|конев|ловч|охот/.test(t)) role = 'huntsman noble in leather and fur'
  else if (/рудник|литейн/.test(t)) role = 'mining noble with iron jewelry'
  else role = female ? 'noblewoman in velvet gown' : 'nobleman in velvet doublet'
  const hid = houseOf.get(e.base.links?.dynasty)
  const colors = hid ? `, clothes in ${HOUSE_COLORS[hid]} colors` : ''
  const pers = p.personality ?? e.base.summary ?? ''
  const mood = /жесток|безум|тиран|кровав/.test(pers.toLowerCase()) ? ', cruel menacing expression' : /добр|мягк|тих/.test(pers.toLowerCase()) ? ', gentle expression' : /горд|холод|строг/.test(pers.toLowerCase()) ? ', proud cold expression' : ''
  return `${ageW} ${who}, ${role}${colors}${mood}`
}
const seedOf = (id) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 1000000

const IDS = new Set(process.argv.slice(2).map((x) => (x.startsWith('lore-') ? x : `lore-${x}`)))
const chars = world.entries.filter(
  (e) =>
    e.kind === 'character' &&
    (IDS.size ? IDS.has(e.id) : e.base.tags.some((t) => ['Монстарги', 'Дагерфорд', 'Великие дома', 'армия'].includes(t)) || ['lore-kaya-head', 'lore-korvin-argus', 'lore-jakasta', 'lore-anselm-fern'].includes(e.id))
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
  const prompt = `${STYLE}, portrait of a ${subject}`
  const tmp = `tools/sd/out-${id}.png`
  const t0 = Date.now()
  execFileSync(SD, ['-m', MODEL, '-p', prompt, '-n', NEG, '-W', '512', '-H', '640', '--steps', '24', '--cfg-scale', '6.5', '--sampling-method', 'dpm++2m', '--scheduler', 'karras', '-s', String(seedOf(id)), '-o', tmp], { stdio: 'ignore' })
  await sharp(tmp).webp({ quality: 86 }).toFile(file)
  rmSync(tmp, { force: true })
  e.base.image = `portraits/${id}.webp`
  writeFileSync(WORLD, JSON.stringify(world, null, 1)) // сохраняем после каждого — можно прервать и продолжить
  console.log(`[${++done}/${chars.length}] ${e.base.name} — ${((Date.now() - t0) / 1000).toFixed(0)} с`)
}
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Готово: портретов ${chars.filter((e) => e.base.image).length} из ${chars.length}`)
