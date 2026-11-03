// Портреты членов собраний Республики (Народное собрание, городские парламенты, Совет рабочих): сотни лиц, поэтому
// меньше и быстрее, чем портреты персонажей. Файл называется по устойчивому ключу (собрание, имя, год рождения),
// чтобы портрет не уехал к другому человеку при пересборке. world.json не трогает: поле image проставляет
// scripts/legislatures.mjs, если файл есть. Запуск: node scripts/deputy-portraits.mjs [только-текущие]
import { existsSync, mkdirSync, readFileSync } from 'fs'
import sharp from 'sharp'
import { startSd, stopSd, txt2img } from './sd.mjs'

const WORLD = 'resources/default-world/world.json'
const OUT = 'resources/default-world/portraits/dep'
mkdirSync(OUT, { recursive: true })

export const depKey = (legId, m) => {
  const s = `${legId}|${m.name}|${m.born}`
  let h = 7
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0
  return `${legId}-${h.toString(36)}`
}

const STYLE = 'oil painting, dutch golden age style, renaissance old master style, chiaroscuro lighting, plain dark background, visible brush strokes, detailed face, head and shoulders portrait'
export const NEG = '(asian:1.4), (east asian:1.3), crown, tiara, coronet, photo, photorealistic, 3d render, modern clothing, text, watermark, signature, frame, blurry, lowres, deformed, cartoon, anime, nsfw, nude'
const CLOTHES = {
  noble: (f) => (f ? 'noblewoman in dark velvet gown with a lace collar and pearls' : 'nobleman in dark velvet doublet with a lace collar and a gold chain'),
  money: (f) => (f ? 'rich merchant woman in black silk with a white ruff collar' : 'rich merchant banker in black doublet with a white ruff collar, gold rings'),
  learned: (f) => (f ? 'learned woman in plain dark dress with a white collar' : 'lawyer in black gown with a white collar, holding a quill'),
  officer: (f) => (f ? 'militia officer woman in blue coat with a steel gorget' : 'militia officer in blue coat with a steel gorget and sash'),
  clergy: () => 'priest in black cassock with white collar and a golden sun pendant',
  worker: (f) => (f ? 'working woman weaver with a simple headscarf and rough linen dress' : 'working man dockworker in rough linen shirt and leather apron, strong hands'),
  press: (f) => (f ? 'woman publisher in dark dress with ink-stained fingers' : 'newspaper publisher in dark coat with ink-stained fingers and spectacles'),
  owner: (f) => (f ? 'peasant farmwife in a woollen shawl' : 'prosperous peasant farmer in a woollen coat')
}
const RACE = {
  'Дварф': 'stout dwarf with a long braided beard, broad face, ',
  'Гном': 'small gnome with a big nose, bright eyes and spectacles, ',
  'Эльф': 'elf with long pointed ears and fine features, ',
  'Полуорк': 'half-orc with greenish grey skin and small lower tusks, ',
  'Человек (беглец из Короны Аргус)': 'dark-skinned southern freedman, '
}
// юг: испано-итальянский придворный портрет; кальтранцы — кельтские лица
const SOUTH_STYLE = 'oil painting, spanish and italian renaissance portrait, velazquez and titian style, chiaroscuro lighting, plain dark background, visible brush strokes, detailed face, head and shoulders portrait'
const SOUTH_CLS = { church: 'clergy', teria: 'clergy', sword: 'officer', captains: 'officer', banks: 'money', merchants: 'money', harbor: 'money', harbors: 'money', teachers: 'learned', liberals: 'learned' }
const IMPERIAL_STYLE = 'oil painting, medieval fantasy court portrait, renaissance old master style, dramatic chiaroscuro lighting, dark ornate background, visible brush strokes, detailed face, head and shoulders portrait'
const HOLY_STYLE = 'oil painting, renaissance papal court portrait, raphael and titian style, warm golden light, dark background, visible brush strokes, detailed face, head and shoulders portrait'
const STYRIA_STYLE = 'oil painting, dark gothic medieval portrait, candlelight, deep shadows, black background, visible brush strokes, detailed face, head and shoulders portrait'
const STYRIA_OVER = {
  rodnya: (f) => `${f ? 'noblewoman' : 'nobleman'} with (snow white skin, jet black hair:1.3), black velvet with a silver crescent brooch`,
  nemye: (f) => `silent grim ${f ? 'woman' : 'man'} clerk in a grey hooded robe, closed lips, ink-stained fingers`,
  market: (f) => `shady ${f ? 'merchant woman' : 'merchant'} in dark red and black clothes with rings, sly look`,
  bank: (f) => `${f ? 'moneylender woman' : 'moneylender'} in a plain black coat with a white collar and a heavy key on a chain`,
  roty: (f) => `scarred mercenary captain${f ? ' woman' : ''} in worn leather and a dented steel gorget`,
  kast: (f) => `impoverished minor ${f ? 'noblewoman' : 'nobleman'} in a patched old doublet, tired hollow face`
}
export const isSouth = (leg) => /^(tos|vuf|she|kal)-/.test(leg.id)
export const prompt = (m, leg) => {
  const f = m.gender === 'Женский'
  const end = m.to ? Math.floor(m.to / 500) + 1 : 1010
  const age = end - m.born
  const ageW = leg.id === 'sty-council' && m.faction === 'rodnya' ? (age < 45 ? 'young' : 'old') : age < 30 ? 'young' : age < 45 ? 'adult' : age < 60 ? 'middle-aged' : age < 72 ? 'aging grey-haired' : 'elderly white-haired'
  const south = isSouth(leg)
  // Верховный совет Империи, Сенат Короны, Совет святых архиепископов — своя одежда по скамье
  const imperial = leg.id === 'empire-council' || leg.id === 'argus-senate'
  const holy = leg.id === 'ch-council'
  const over = holy
    ? m.faction === 'order' ? (f ? 'paladin woman in polished white plate armor with a golden sun emblem, white cloak' : 'paladin knight in polished white plate armor with a golden sun emblem, white cloak') : 'bishop in white and gold robes with a mitre, golden sun pendant'
    : imperial ? (m.faction === 'chaplains' ? 'imperial chaplain in black cassock with a golden sun pendant and a red sash' : m.group === 'Генералитет' ? 'imperial general in black and crimson uniform with gold epaulettes and a steel gorget' : f ? 'noblewoman in dark velvet gown with a fur collar and family jewels' : 'nobleman in dark velvet doublet with a fur collar and a heavy gold chain') : ''
  const sty = leg.id === 'sty-council'
  const cls = south ? (leg.unofficial ? 'worker' : SOUTH_CLS[m.faction] ?? m.cls ?? 'noble') : m.cls ?? (leg.id === 'rp-workers' ? 'worker' : 'learned')
  const clothes = (sty && STYRIA_OVER[m.faction]?.(f)) || over || (CLOTHES[cls] ?? CLOTHES.learned)(f)
  const race = sty ? '(northern european, pale skin, gaunt:1.2), ' : holy ? '(european:1.1), ' : south ? (leg.id.startsWith('kal-') ? '(celtic european, pale weathered skin:1.15), ' : '(southern european, mediterranean, olive skin, dark hair:1.2), ') : m.race ? RACE[m.race] ?? '' : '(northern european, germanic features, pale skin:1.2), '
  const color = leg.factions.find((x) => x.id === m.faction)?.color
  return `${sty ? STYRIA_STYLE : holy ? HOLY_STYLE : imperial ? IMPERIAL_STYLE : south ? SOUTH_STYLE : STYLE}, portrait of a ${race}${ageW} ${f ? 'woman' : 'man'}, ${clothes}${color ? `, small ${colorWord(color)} ribbon rosette on the chest` : ''}`
}
const colorWord = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  if (r > 200 && g > 200 && b > 200) return 'white'
  if (r > g + 60 && r > b + 60) return g > 100 ? 'orange' : 'red'
  if (b > r + 40 && b > g) return 'blue'
  if (g > r && g > b) return 'green'
  if (r > 150 && g > 120 && b < 120) return 'gold'
  if (g > 100 && b > 100) return 'teal'
  return 'purple'
}
export const seedOf = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 1000000

if (process.argv[1].endsWith('deputy-portraits.mjs')) {
  const world = JSON.parse(readFileSync(WORLD, 'utf8'))
  const onlyNow = process.argv.includes('now')
  const todo = []
  for (const leg of world.legislatures.filter((l) => l.id.startsWith('rp-') || isSouth(l) || ['empire-council', 'argus-senate', 'ch-council', 'sty-council'].includes(l.id))) {
    for (const m of leg.members) {
      if (m.entryId) continue // у людей из карточек — свой портрет
      if (onlyNow && m.to != null) continue
      todo.push([leg, m])
    }
  }
  // сначала нынешние члены, потом бывшие; внутри — Народное собрание первым
  const rank = (leg) => (leg.id === 'rp-assembly' ? 0 : leg.id === 'rp-workers' ? 2 : isSouth(leg) ? (leg.unofficial ? 4 : 3) : 1)
  todo.sort((a, b) => (a[1].to == null ? 0 : 1) - (b[1].to == null ? 0 : 1) || rank(a[0]) - rank(b[0]))
  let done = 0
  const left = todo.filter(([leg, m]) => !existsSync(`${OUT}/${depKey(leg.id, m)}.webp`))
  console.log(`Портретов к рисованию: ${left.length} из ${todo.length}`)
  for (const [leg, m] of left) {
    const key = depKey(leg.id, m)
    const p = prompt(m, leg)
    if (process.env.DRY) { console.log(`${m.name}: ${p.slice(STYLE.length + 2)}`); continue }
    await startSd()
    const t0 = Date.now()
    const png = await txt2img({ prompt: p, negative: NEG, width: 384, height: 448, steps: 5, cfg: 1.5, seed: seedOf(key), fast: true })
    // LCM любит рисовать раму и подпись по краю — обрезаем
    await sharp(png).extract({ left: 26, top: 24, width: 332, height: 396 }).webp({ quality: 82 }).toFile(`${OUT}/${key}.webp`)
    console.log(`[${++done}/${left.length}] ${leg.name}: ${m.name} — ${((Date.now() - t0) / 1000).toFixed(0)} с`)
  }
  stopSd()
}
