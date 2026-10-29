// Сглаживает границы провинций: фильтр большинства по кругу убирает мелкую «рваную» извилистость,
// оставляя крупные изгибы. Номера провинций, суша и вода не меняются; ни одна провинция не пропадает.
// Запуск после provinces.mjs (и до terrain.mjs): node --max-old-space-size=8192 scripts/smooth-provinces.mjs
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const WORLD = 'resources/default-world/world.json'
const FILE = 'resources/default-world/maps/provinces.png'
const R = 4
const ITER = 3

const { data, info } = await sharp(FILE).raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, N = W * H
let id = new Uint16Array(N)
for (let i = 0; i < N; i++) if (data[i * 4 + 3]) id[i] = (data[i * 4] << 8) | data[i * 4 + 1]
// щели в 1–3 пикселя (линии границ из PSD) заполняем соседней провинцией
for (let pass = 0; pass < 2; pass++) {
  let filled = 0
  const next = id.slice()
  for (let y = 3; y < H - 3; y++)
    for (let x = 3; x < W - 3; x++) {
      const i = y * W + x
      if (id[i]) continue
      let gap = false
      for (const [ax, ay] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        let a = 0, b = 0
        for (let d = 1; d <= 2 && !a; d++) a = id[i + (ay * W + ax) * d]
        for (let d = 1; d <= 2 && !b; d++) b = id[i - (ay * W + ax) * d]
        if (a && b) { gap = true; next[i] = a; break }
      }
      if (gap) {
        filled++
        // местность и непрозрачность — от соседа
        const j = [i - 1, i + 1, i - W, i + W, i - 2, i + 2].find((k) => id[k]) ?? i
        data[i * 4 + 2] = data[j * 4 + 2]
        data[i * 4 + 3] = 255
      }
    }
  id = next
  console.log(`щели: заполнено ${filled} пикселей`)
}

const area0 = new Int32Array(65536)
for (let i = 0; i < N; i++) area0[id[i]]++

const disk = []
for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R + 1) disk.push([dx, dy])

const ids = new Uint16Array(disk.length)
const cnt = new Uint16Array(disk.length)
for (let it = 0; it < ITER; it++) {
  const next = id.slice()
  let changed = 0
  for (let y = R; y < H - R; y++)
    for (let x = R; x < W - R; x++) {
      const i = y * W + x
      const me = id[i]
      if (!me) continue
      // только у границы провинции
      if (id[i - 1] === me && id[i + 1] === me && id[i - W] === me && id[i + W] === me) continue
      let k = 0
      for (const [dx, dy] of disk) {
        const n = id[i + dy * W + dx]
        if (!n) continue
        let j = 0
        while (j < k && ids[j] !== n) j++
        if (j === k) {
          ids[k] = n
          cnt[k++] = 0
        }
        cnt[j]++
      }
      let best = me, bc = 0
      for (let j = 0; j < k; j++) if (cnt[j] > bc || (cnt[j] === bc && ids[j] === me)) { bc = cnt[j]; best = ids[j] }
      if (best !== me && area0[me] > 60) {
        next[i] = best
        changed++
      }
    }
  // провинция не должна потерять больше трети площади
  const area = new Int32Array(65536)
  for (let i = 0; i < N; i++) area[next[i]]++
  for (let i = 0; i < N; i++) if (next[i] !== id[i] && area[id[i]] < area0[id[i]] * 0.67) next[i] = id[i]
  id = next
  console.log(`проход ${it + 1}: изменено ${changed} пикселей`)
}

// связность: оторванные кусочки провинции (меньше 40 пикселей) отдаём соседу
{
  const seen = new Uint8Array(N)
  const q = new Int32Array(N)
  for (let s = 0; s < N; s++) {
    if (!id[s] || seen[s]) continue
    const me = id[s]
    let qh = 0, qt = 0
    q[qt++] = s
    seen[s] = 1
    while (qh < qt) {
      const i = q[qh++]
      const x = i % W
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || seen[j] || id[j] !== me) continue
        seen[j] = 1
        q[qt++] = j
      }
    }
    if (qt >= 40 || qt >= area0[me] * 0.5) continue
    for (let k = 0; k < qt; k++) {
      const i = q[k]
      for (const j of [i - 1, i + 1, i - W, i + W]) if (id[j] && id[j] !== me) { id[i] = id[j]; break }
    }
  }
}

for (let i = 0; i < N; i++) {
  if (!data[i * 4 + 3]) continue
  data[i * 4] = id[i] >> 8
  data[i * 4 + 1] = id[i] & 255
}
await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(FILE + '.tmp')
const { renameSync } = await import('fs')
renameSync(FILE + '.tmp', FILE)

// соседи провинций заново
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const nb = new Map(world.provinces.map((p) => [p.id, new Set()]))
for (let y = 0; y < H - 1; y++)
  for (let x = 0; x < W - 1; x++) {
    const i = y * W + x
    const a = id[i]
    if (!a) continue
    for (const b of [id[i + 1], id[i + W]]) {
      if (!b || b === a) continue
      nb.get(a)?.add(b)
      nb.get(b)?.add(a)
    }
  }
for (const p of world.provinces) p.neighbors = [...(nb.get(p.id) ?? [])].sort((a, b) => a - b)
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log('provinces.png и соседи обновлены')
