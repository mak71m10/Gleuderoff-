// Поиск артефактов на плитках карты мира (resources/default-world/maps/tiles/<z>/<x>_<y>.webp).
//   node scripts/scan-tiles.mjs [z=0] [--crops папка]  — печатает подозрительные места; с --crops сохраняет вырезки 256×256
// Что ищет:
//  - дыры: прозрачные/чисто чёрные пятна внутри плитки (не у края мира);
//  - швы: резкий скачок яркости ровно по границе соседних плиток;
//  - «кислотные» пиксели: чистые отладочные цвета (пурпур, ярко-жёлтый, ярко-зелёный), которых в палитре карты нет;
//  - полосы: строка или столбец, резко отличающиеся от соседей по всей длине (сбой полосы рендера).
import { readdirSync, existsSync, mkdirSync } from 'fs'
import sharp from 'sharp'

const z = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '0'
const ci = process.argv.indexOf('--crops'), CROPS = ci > 0 ? process.argv[ci + 1] : null
if (CROPS) mkdirSync(CROPS, { recursive: true })
const DIR = `resources/default-world/maps/tiles/${z}`
const files = readdirSync(DIR).filter((f) => f.endsWith('.webp'))
const T = 1024
const load = async (f) => (existsSync(`${DIR}/${f}`) ? sharp(`${DIR}/${f}`).ensureAlpha().raw().toBuffer() : null)
const lum = (b, i) => 0.3 * b[i] + 0.59 * b[i + 1] + 0.11 * b[i + 2]
const found = []
const note = async (f, x, y, what) => {
  found.push(`${z}/${f} (${x}, ${y}) — ${what}`)
  if (CROPS && found.length <= 60) await sharp(`${DIR}/${f}`).extract({ left: Math.max(0, Math.min(T - 256, x - 128)), top: Math.max(0, Math.min(T - 256, y - 128)), width: 256, height: 256 }).png().toFile(`${CROPS}/${found.length}_${f.replace('.webp', '')}_${x}_${y}.png`)
}

for (const f of files) {
  const b = await load(f)
  const [tx, ty] = f.replace('.webp', '').split('_').map(Number)
  // 1) дыры и кислотные цвета — по сетке 4 px, кластером
  let holes = 0, hx = 0, hy = 0, acid = 0, ax = 0, ay = 0, opaque = 0
  for (let y = 0; y < T; y += 4) for (let x = 0; x < T; x += 4) {
    const i = (y * T + x) * 4
    if (b[i + 3] > 0) opaque++
    const r = b[i], g = b[i + 1], bl = b[i + 2]
    if (b[i + 3] > 0 && r < 3 && g < 3 && bl < 3) { holes++; hx = x; hy = y }
    if ((r > 230 && bl > 230 && g < 60) || (r > 240 && g > 240 && bl < 40) || (g > 240 && r < 60 && bl < 60)) { acid++; ax = x; ay = y }
  }
  if (holes > 20 && opaque > 1000) await note(f, hx, hy, `чёрное пятно (${holes} точек)`)
  if (acid > 6) await note(f, ax, ay, `кислотный цвет (${acid} точек)`)
  // 2) полосы: строка, отличающаяся от обеих соседних в среднем сильнее 25 по всей ширине
  for (let y = 1; y < T - 1; y++) {
    let d = 0, n = 0
    for (let x = 0; x < T; x += 8) { const i = (y * T + x) * 4; if (!b[i + 3]) continue; d += Math.min(Math.abs(lum(b, i) - lum(b, i - T * 4)), Math.abs(lum(b, i) - lum(b, i + T * 4))); n++ }
    if (n > 60 && d / n > 25) { await note(f, 512, y, `полоса-строка (разница ${Math.round(d / n)})`); break }
  }
  // 3) шов с правой и нижней соседкой
  for (const [nf, side] of [[`${tx + 1}_${ty}.webp`, 'x'], [`${tx}_${ty + 1}.webp`, 'y']]) {
    const nb = files.includes(nf) ? await load(nf) : null
    if (!nb) continue
    let jump = 0, inner = 0, n = 0
    for (let k = 0; k < T; k += 4) {
      const a = side === 'x' ? (k * T + T - 1) * 4 : ((T - 1) * T + k) * 4, a2 = side === 'x' ? (k * T + T - 2) * 4 : ((T - 2) * T + k) * 4
      const c = side === 'x' ? (k * T) * 4 : k * 4
      if (!b[a + 3] || !nb[c + 3]) continue
      jump += Math.abs(lum(b, a) - lum(nb, c)); inner += Math.abs(lum(b, a) - lum(b, a2)); n++
    }
    if (n > 50 && jump / n > 12 && jump / n > 3 * (inner / n + 1)) await note(f, side === 'x' ? T - 1 : 512, side === 'x' ? 512 : T - 1, `шов с ${nf} (скачок ${Math.round(jump / n)} против ${Math.round(inner / n)} внутри)`)
  }
}
console.log(`плиток z=${z}: ${files.length}; подозрительных мест: ${found.length}`)
for (const l of found.slice(0, 80)) console.log('  ' + l)
