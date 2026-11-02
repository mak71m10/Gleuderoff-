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
export const prompt = (m, leg) => {
  const f = m.gender === 'Женский'
  const end = m.to ? Math.floor(m.to / 500) + 1 : 1010
  const age = end - m.born
  const ageW = age < 30 ? 'young' : age < 45 ? 'adult' : age < 60 ? 'middle-aged' : age < 72 ? 'aging grey-haired' : 'elderly white-haired'
  const cls = m.cls ?? (leg.id === 'rp-workers' ? 'worker' : 'learned')
  const clothes = (CLOTHES[cls] ?? CLOTHES.learned)(f)
  const race = m.race ? RACE[m.race] ?? '' : '(northern european, germanic features, pale skin:1.2), '
  const color = leg.factions.find((x) => x.id === m.faction)?.color
  return `${STYLE}, portrait of a ${race}${ageW} ${f ? 'woman' : 'man'}, ${clothes}${color ? `, small ${colorWord(color)} ribbon rosette on the chest` : ''}`
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
  for (const leg of world.legislatures.filter((l) => l.id.startsWith('rp-'))) {
    for (const m of leg.members) {
      if (m.entryId) continue // у людей из карточек — свой портрет
      if (onlyNow && m.to != null) continue
      todo.push([leg, m])
    }
  }
  // сначала нынешние члены, потом бывшие; внутри — Народное собрание первым
  const rank = (leg) => (leg.id === 'rp-assembly' ? 0 : leg.id === 'rp-workers' ? 2 : 1)
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
