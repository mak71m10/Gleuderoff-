// Новая подробная подложка карты мира (по умолчанию 32768×18688), построенная заново по формам исходной карты:
// береговая линия, местность и горы берутся из provinces.png и base-4096.png, а детали — рельеф со светотенью,
// кроны деревьев, скалы и снега, барханы, мелководье — рисуются процедурно, до отдельного дерева.
// Запуск: node --max-old-space-size=12000 scripts/render-map.mjs  → source-maps/base-render.rgb (+ .json с размерами)
// Затем: node --max-old-space-size=12000 scripts/make-tiles.mjs source-maps/base-render.rgb
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { cpus } from 'os'
import { fileURLToPath } from 'url'

const SW = 4096, SH = 2336 // исходные растры
const K = Number(process.env.K ?? 8) // во сколько раз крупнее исходника (8 → 32768×18688)
const OW = SW * K, OH = SH * K
const STRIP = 32

// ================= главный поток: подготовка полей =================
if (isMainThread) {
  const sharp = (await import('sharp')).default
  sharp.cache(false)
  const t0 = Date.now()
  const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`)
  const N = SW * SH
  const shared = (bytes) => new SharedArrayBuffer(bytes)

  const { data: pimg } = await sharp('resources/default-world/maps/provinces.png').raw().toBuffer({ resolveWithObject: true })
  const base = await sharp('source-maps/base-4096.png').removeAlpha().raw().toBuffer()
  const land = new Uint8Array(N)
  const cls = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    land[i] = pimg[i * 4 + 3] ? 1 : 0
    cls[i] = land[i] ? pimg[i * 4 + 2] : 0
  }

  // линии границ из PSD вырезаны в маске суши как щели в 1–3 пикселя — закрываем их (дилатация + эрозия)
  {
    const grow = edt(land, 1)
    const L1 = new Uint8Array(N)
    for (let i = 0; i < N; i++) L1[i] = land[i] || grow[i] <= 2 ? 1 : 0
    const shrink = edt(L1, 0)
    for (let i = 0; i < N; i++) {
      if (land[i] || shrink[i] <= 2) continue
      land[i] = 1
      // местность — от соседа слева или сверху
      cls[i] = cls[i - 1] || cls[i - SW] || cls[i + 1] || cls[i + SW] || 1
    }
    for (let i = 0; i < N; i++) if (land[i] && !cls[i]) cls[i] = cls[i - 1] || cls[i - SW] || 1
  }
  log('щели закрыты')

  // реки исходной карты (светло-голубые линии) — из terrain.png, канал B
  const { data: timg } = await sharp('resources/default-world/maps/terrain.png').raw().toBuffer({ resolveWithObject: true })
  const riv = new Uint8Array(N)
  for (let i = 0; i < N; i++) riv[i] = land[i] && timg[i * 4 + 2] ? 1 : 0
  const dRiv = edt(riv, 1)
  const RV = new Uint8Array(shared(N))
  {
    const tmp = new Float32Array(N)
    for (let i = 0; i < N; i++) tmp[i] = riv[i]
    const b = blur(tmp, SW, SH, 1)
    for (let i = 0; i < N; i++) RV[i] = Math.round(b[i] * 255)
  }

  // пашни вокруг поселений: чем крупнее поселение, тем шире круг наделов
  const FM = new Uint8Array(shared(N))
  {
    const { readFileSync } = await import('fs')
    const world = JSON.parse(readFileSync('resources/default-world/world.json', 'utf8'))
    const R = { village: 11, fishing: 8, town: 22, city: 32, capital: 42, castle: 10, port: 20, temple: 8, ruins: 0, tower: 5 }
    const pts = []
    // деревни дают пашни, но не вырубают лес (сила 0.5 < порога вырубки)
    const AMP = { village: 0.5, fishing: 0.5 }
    for (const p of world.provinces ?? []) if (p.settlement) pts.push([p.settlement.x / 2, p.settlement.y / 2, R[p.settlement.type] ?? 8, AMP[p.settlement.type] ?? 1])
    for (const pl of world.places ?? []) if (pl.mapId === 'world') pts.push([pl.x / 2, pl.y / 2, R[pl.base?.type] ?? 10, 1])
    const tmp = new Float32Array(N)
    for (const [cx, cy, rad, amp] of pts) {
      if (!rad) continue
      for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(SH - 1, cy + rad); y++)
        for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(SW - 1, cx + rad); x++) {
          const d = Math.hypot(x - cx, y - cy) / rad
          if (d < 1) tmp[y * SW + x] = Math.max(tmp[y * SW + x], (1 - d * d) * amp)
        }
    }
    const b = blur(tmp, SW, SH, 2)
    for (let i = 0; i < N; i++) FM[i] = Math.round(Math.min(1, b[i] * 1.6) * 255)
  }

  // знаковое расстояние до берега (в пикселях исходника): + суша, − вода
  const dIn = edt(land, 0) // для суши — до ближайшей воды
  const dOut = edt(land, 1) // для воды — до ближайшей суши
  const sdf = new Float32Array(shared(N * 4))
  {
    // размываем поле расстояний — береговая линия скругляется, без «ступенек» исходных пикселей
    const raw = new Float32Array(N)
    for (let i = 0; i < N; i++) raw[i] = land[i] ? dIn[i] - 0.5 : -(dOut[i] - 0.5)
    sdf.set(blur(raw, SW, SH, 1))
  }
  log('берега')

  // тёмная кайма у берегов исходной карты распознана как холмы/горы — берём местность из глубины суши
  {
    const RIM = 10, R = 14
    const fixed = cls.slice()
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const i = y * SW + x
        if (!land[i] || (dIn[i] >= RIM && dRiv[i] > 4) || (cls[i] !== 3 && cls[i] !== 4)) continue
        const cnt = [0, 0, 0, 0, 0, 0, 0]
        for (let dy = -R; dy <= R; dy += 2)
          for (let dx = -R; dx <= R; dx += 2) {
            const xx = x + dx, yy = y + dy
            if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue
            const j = yy * SW + xx
            if (land[j] && dIn[j] >= RIM && dRiv[j] > 4) cnt[cls[j]]++
          }
        const rough = cnt[3] + cnt[4] + cnt[5]
        let best = 1, bc = 0
        for (const c of [1, 2, 6]) if (cnt[c] > bc) { bc = cnt[c]; best = c }
        if (rough > bc * 1.5) continue // настоящие горы у моря
        fixed[i] = best
      }
    cls.set(fixed)
  }

  // мягкие веса местности
  const CW = new Uint8Array(shared(N * 7))
  {
    const tmp = new Float32Array(N)
    for (let c = 0; c < 7; c++) {
      for (let i = 0; i < N; i++) tmp[i] = cls[i] === c && (c > 0 || !land[i]) ? 1 : 0
      const b = blur(tmp, SW, SH, 2)
      for (let i = 0; i < N; i++) CW[i * 7 + c] = Math.round(b[i] * 255)
    }
  }
  // большие пустыни (с барханами) отличаем от степных пятен
  const DB = new Uint8Array(shared(N))
  {
    const tmp = new Float32Array(N)
    for (let i = 0; i < N; i++) tmp[i] = cls[i] === 6 ? 1 : 0
    const b = blur(tmp, SW, SH, 22)
    for (let i = 0; i < N; i++) DB[i] = Math.round(b[i] * 255)
  }
  log('местность')

  // крупный рельеф: высоты по местности + выпуклости гор, нарисованные на исходной карте
  const CLASS_H = [-0.08, 0.1, 0.13, 0.28, 0.58, 0.72, 0.08]
  const ch = new Float32Array(N)
  for (let i = 0; i < N; i++) ch[i] = CLASS_H[cls[i]]
  const coarse = new Float32Array(shared(N * 4))
  coarse.set(blur(ch, SW, SH, 9))
  const lum = new Float32Array(N)
  for (let i = 0; i < N; i++) lum[i] = (0.3 * base[i * 3] + 0.59 * base[i * 3 + 1] + 0.11 * base[i * 3 + 2]) / 255
  const lumB = blur(lum, SW, SH, 4)
  const lumS = blur(lum, SW, SH, 1)
  const lumHP = new Float32Array(shared(N * 4))
  for (let i = 0; i < N; i++) lumHP[i] = lumS[i] - lumB[i]
  // оттенок исходной карты (сильно размытый) — чтобы сохранить её настроение
  const tint = new Uint8Array(shared(N * 3))
  {
    const ch3 = new Float32Array(N)
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < N; i++) ch3[i] = base[i * 3 + c]
      const b = blur(ch3, SW, SH, 6)
      for (let i = 0; i < N; i++) tint[i * 3 + c] = Math.round(b[i])
    }
  }
  log('рельеф и оттенки')

  // ---------- дороги: расстояние до осевой линии на логической сетке 8192×4672 (в 1/32 единицы) ----------
  const LW = SW * 2, LH = SH * 2, LN = LW * LH
  const roadField = (type) => {
    const field = new Uint8Array(shared(LN)).fill(255)
    if (!existsSync('source-maps/roads.json')) return field
    const mask = new Uint8Array(LN)
    for (const r of roadsJson) {
      if (r.type !== type) continue
      for (let k = 0; k < r.pts.length - 1; k++) {
        const [ax, ay] = r.pts[k], [bx, by] = r.pts[k + 1]
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3) + 1
        for (let t = 0; t <= n; t++) {
          const x = Math.round(ax + ((bx - ax) * t) / n), y = Math.round(ay + ((by - ay) * t) / n)
          if (x >= 0 && y >= 0 && x < LW && y < LH) mask[y * LW + x] = 1
        }
      }
    }
    const d = edt(mask, 1, LW, LH)
    for (let i = 0; i < LN; i++) field[i] = Math.min(255, Math.round(d[i] * 32))
    return field
  }
  const { existsSync, readFileSync: rf } = await import('fs')
  const roadsJson = existsSync('source-maps/roads.json') ? JSON.parse(rf('source-maps/roads.json', 'utf8')) : []
  const RP = roadField('paved'), RDT = roadField('dirt'), RT = roadField('trail')
  log(`дороги: ${roadsJson.length}`)

  // ---------- тени гор: луч к солнцу (северо-запад) по крупному рельефу ----------
  const SHD = new Uint8Array(shared(N))
  {
    const hs = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const mtn = (CW[i * 7 + 4] + CW[i * 7 + 5]) / 255, hill = CW[i * 7 + 3] / 255
      hs[i] = coarse[i] + lumHP[i] * (mtn * 0.9 + hill * 0.45 + 0.12) * 0.3
    }
    const GAIN = 0.011 // подъём луча на пиксель исходника: высота 0.3 даёт тень ≈ 27 px
    const raw = new Float32Array(N)
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const i = y * SW + x
        const h0 = hs[i]
        let ex = 0
        for (let t = 1; t <= 48; t++) {
          const xx = x - t * 0.7071, yy = y - t * 0.7071
          if (xx < 0 || yy < 0) break
          const e = hs[(yy | 0) * SW + (xx | 0)] - (h0 + t * GAIN)
          if (e > ex) ex = e
        }
        raw[i] = Math.min(1, ex / 0.05)
      }
    const b = blur(raw, SW, SH, 1)
    for (let i = 0; i < N; i++) SHD[i] = Math.round(b[i] * 255)
  }
  log('тени гор')

  const out = new Uint8Array(shared(OW * OH * 3))
  const counter = new Int32Array(shared(4))
  const nWorkers = Math.max(1, cpus().length)
  await Promise.all(
    Array.from({ length: nWorkers }, () =>
      new Promise((res, rej) => {
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { RP: RP.buffer, RDT: RDT.buffer, RT: RT.buffer, SHD: SHD.buffer, FM: FM.buffer, RV: RV.buffer, DB: DB.buffer, sdf: sdf.buffer, CW: CW.buffer, coarse: coarse.buffer, lumHP: lumHP.buffer, tint: tint.buffer, out: out.buffer, counter: counter.buffer } })
        w.on('message', (m) => process.stdout.write(`\r  полос: ${m}/${Math.ceil(OH / STRIP)}   `))
        w.on('error', rej)
        w.on('exit', res)
      })
    )
  )
  console.log()
  log('отрисовка')
  const { writeFileSync } = await import('fs')
  writeFileSync('source-maps/base-render.rgb', Buffer.from(out.buffer))
  writeFileSync('source-maps/base-render.json', JSON.stringify({ width: OW, height: OH, channels: 3 }))
  log(`source-maps/base-render.rgb (${OW}×${OH})`)
  process.exit(0)
}

// ---------- общие помощники ----------
function edt(mask, target, SW = 4096, SH = 2336) {
  // расстояние до ближайшего пикселя, где mask === target (Felzenszwalb)
  const INF = 1e12
  const f = new Float64Array(Math.max(SW, SH))
  const d = new Float64Array(Math.max(SW, SH))
  const v = new Int32Array(Math.max(SW, SH))
  const z = new Float64Array(Math.max(SW, SH) + 1)
  const g = new Float64Array(SW * SH)
  const pass = (n) => {
    let k = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
      while (s <= z[k]) {
        k--
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
      }
      k++
      v[k] = q
      z[k] = s
      z[k + 1] = INF
    }
    k = 0
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
    }
  }
  for (let x = 0; x < SW; x++) {
    for (let y = 0; y < SH; y++) f[y] = mask[y * SW + x] === target ? 0 : INF
    pass(SH)
    for (let y = 0; y < SH; y++) g[y * SW + x] = d[y]
  }
  const out = new Float32Array(SW * SH)
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) f[x] = g[y * SW + x]
    pass(SW)
    for (let x = 0; x < SW; x++) out[y * SW + x] = Math.sqrt(d[x])
  }
  return out
}

function blur(src, W, H, r) {
  // три прохода скользящего среднего ≈ гаусс
  let a = Float32Array.from(src)
  let b = new Float32Array(W * H)
  for (let it = 0; it < 3; it++) {
    for (let y = 0; y < H; y++) {
      const o = y * W
      let s = 0
      for (let x = -r; x <= r; x++) s += a[o + Math.min(W - 1, Math.max(0, x))]
      for (let x = 0; x < W; x++) {
        b[o + x] = s / (2 * r + 1)
        s += a[o + Math.min(W - 1, x + r + 1)] - a[o + Math.max(0, x - r)]
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0
      for (let y = -r; y <= r; y++) s += b[Math.min(H - 1, Math.max(0, y)) * W + x]
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / (2 * r + 1)
        s += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x]
      }
    }
  }
  return a
}

// ================= рабочий поток: рисуем полосы =================
if (!isMainThread) {
  const sdf = new Float32Array(workerData.sdf)
  const CW = new Uint8Array(workerData.CW)
  const DB = new Uint8Array(workerData.DB)
  const RV = new Uint8Array(workerData.RV)
  const FM = new Uint8Array(workerData.FM)
  const RP = new Uint8Array(workerData.RP)
  const RDT = new Uint8Array(workerData.RDT)
  const RT = new Uint8Array(workerData.RT)
  const SHD = new Uint8Array(workerData.SHD)
  // расстояние до дороги (логические единицы) — билинейно по сетке 8192×4672
  const LW = SW * 2, LH = SH * 2
  const roadD = (arr, lx, ly) => {
    const x = Math.min(LW - 1.001, Math.max(0, lx - 0.5)), y = Math.min(LH - 1.001, Math.max(0, ly - 0.5))
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0
    const i = y0 * LW + x0
    const a = arr[i] + (arr[i + 1] - arr[i]) * fx
    const b = arr[i + LW] + (arr[i + LW + 1] - arr[i + LW]) * fx
    return (a + (b - a) * fy) / 32
  }
  const coarse = new Float32Array(workerData.coarse)
  const lumHP = new Float32Array(workerData.lumHP)
  const tint = new Uint8Array(workerData.tint)
  const out = new Uint8Array(workerData.out)
  const counter = new Int32Array(workerData.counter)

  // --- шум Перлина ---
  const perm = new Uint8Array(512)
  {
    const p = Array.from({ length: 256 }, (_, i) => i)
    let s = 1337
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0
      const j = s % (i + 1)
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  }
  const GX = [1, -1, 1, -1, 1.41, -1.41, 0, 0]
  const GY = [1, 1, -1, -1, 0, 0, 1.41, -1.41]
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const X = xi & 255, Y = yi & 255
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    const a = perm[X] + Y, b = perm[X + 1] + Y
    const h00 = perm[a] & 7, h01 = perm[a + 1] & 7, h10 = perm[b] & 7, h11 = perm[b + 1] & 7
    const n00 = GX[h00] * xf + GY[h00] * yf
    const n10 = GX[h10] * (xf - 1) + GY[h10] * yf
    const n01 = GX[h01] * xf + GY[h01] * (yf - 1)
    const n11 = GX[h11] * (xf - 1) + GY[h11] * (yf - 1)
    const nx0 = n00 + u * (n10 - n00)
    const nx1 = n01 + u * (n11 - n01)
    return nx0 + v * (nx1 - nx0)
  }
  const fbm = (x, y, oct) => {
    let s = 0, a = 0.5, f = 1
    for (let o = 0; o < oct; o++) {
      s += a * noise(x * f + o * 17.3, y * f - o * 9.1)
      f *= 2.03
      a *= 0.5
    }
    return s
  }
  const ridged = (x, y, oct) => {
    let s = 0, a = 0.55, f = 1, w = 1
    for (let o = 0; o < oct; o++) {
      let n = 1 - Math.abs(noise(x * f + o * 5.7, y * f + o * 3.3))
      n *= n
      s += n * a * w
      w = Math.min(1, n * 1.6)
      f *= 2.1
      a *= 0.5
    }
    return s
  }
  const hash = (x, y) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  // билинейная выборка исходных полей
  const bil = (arr, sx, sy) => {
    sx = Math.min(SW - 1.001, Math.max(0, sx))
    sy = Math.min(SH - 1.001, Math.max(0, sy))
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0
    const i = y0 * SW + x0
    const a = arr[i] + (arr[i + 1] - arr[i]) * fx
    const b = arr[i + SW] + (arr[i + SW + 1] - arr[i + SW]) * fx
    return a + (b - a) * fy
  }
  const wts = new Float32Array(7)
  const bilW = (sx, sy) => {
    sx = Math.min(SW - 1.001, Math.max(0, sx))
    sy = Math.min(SH - 1.001, Math.max(0, sy))
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0
    const i = (y0 * SW + x0) * 7
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy
    for (let c = 0; c < 7; c++) wts[c] = (CW[i + c] * w00 + CW[i + 7 + c] * w10 + CW[i + SW * 7 + c] * w01 + CW[i + SW * 7 + 7 + c] * w11) / 255
  }
  const tintC = [0, 0, 0]
  const bilT = (sx, sy) => {
    sx = Math.min(SW - 1.001, Math.max(0, sx))
    sy = Math.min(SH - 1.001, Math.max(0, sy))
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0
    const i = (y0 * SW + x0) * 3
    for (let c = 0; c < 3; c++) {
      const a = tint[i + c] + (tint[i + 3 + c] - tint[i + c]) * fx
      const b = tint[i + SW * 3 + c] + (tint[i + SW * 3 + 3 + c] - tint[i + SW * 3 + c]) * fx
      tintC[c] = (a + (b - a) * fy) / 255
    }
  }
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
  const P = {
    river: hex('#2f6876'), deep: hex('#0c2131'), mid: hex('#163b52'), shallow: hex('#245f6c'), reef: hex('#3a7f80'), foam: hex('#9cc4bd'),
    plainA: hex('#7f8c4c'), plainB: hex('#9b9a5d'), plainC: hex('#687a40'), field: hex('#a8a067'),
    forestGround: hex('#2c3f26'), crownL: hex('#5d7d3f'), crownD: hex('#2a4122'), pineL: hex('#46663e'), pineD: hex('#1e3121'),
    hillA: hex('#8b8157'), hillB: hex('#76734c'),
    rockA: hex('#7a746c'), rockB: hex('#58534d'), rockC: hex('#86735c'), snow: hex('#eef2f6'),
    sandA: hex('#d8b97f'), sandB: hex('#c39b63'), sandC: hex('#e2c895'), stone: hex('#a37f5b'),
    steppeA: hex('#b2a56c'), steppeB: hex('#9c9660'), tundraA: hex('#bdb9a2'), stoneRoad: hex('#b0aa9c'), kerb: hex('#6b665c'), dirtRoad: hex('#7a6040'), trailC: hex('#c2ad84'), plank: hex('#7a5a3a'), tundraB: hex('#a4a38b'), beach: hex('#d6c494'), wetSand: hex('#a3936c'),
    cropA: hex('#bdaa66'), cropB: hex('#8a9450'), cropC: hex('#9c8662'), cropD: hex('#aca76b'), hedge: hex('#55663a'),
    gap: hex('#17231a'), autumn: hex('#7d7a38')
  }
  const col = [0, 0, 0]
  const mix3 = (a, b, t) => {
    col[0] = a[0] + (b[0] - a[0]) * t
    col[1] = a[1] + (b[1] - a[1]) * t
    col[2] = a[2] + (b[2] - a[2]) * t
  }
  const add3 = (c, w) => {
    acc[0] += c[0] * w
    acc[1] += c[1] * w
    acc[2] += c[2] * w
  }
  const acc = [0, 0, 0]
  const sstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const tmpA = [0, 0, 0]

  // --- кроны деревьев: ячейки в 2 логические единицы, в каждой — дерево с шансом по густоте леса ---
  const CELL = K * 1.3
  const crown = { h: -1, nx: 0, ny: 0, pine: 0 }
  const crownAt = (X, Y, dens, pine) => {
    const cx = Math.floor(X / CELL), cy = Math.floor(Y / CELL)
    crown.h = -1
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j
        const r0 = hash(gx, gy)
        if (r0 > dens) continue
        const px = (gx + 0.15 + 0.7 * hash(gx + 71, gy)) * CELL
        const py = (gy + 0.15 + 0.7 * hash(gx, gy + 37)) * CELL
        const rad = CELL * (pine ? 0.45 + 0.25 * hash(gx + 5, gy + 9) : 0.55 + 0.4 * hash(gx + 5, gy + 9))
        const dx = X - px, dy = Y - py
        const d2 = (dx * dx + dy * dy) / (rad * rad)
        if (d2 >= 1) continue
        const h = (1 - d2) * rad
        if (h > crown.h) {
          crown.h = h
          crown.nx = dx / rad
          crown.ny = dy / rad
        }
      }
    return crown.h > 0
  }

  // --- наделы полей: вытянутые многоугольники (ячейки Вороного), между ними — межи и живые изгороди ---
  const parcel = { id: 0, edge: 9 }
  const parcelAt = (lx, ly) => {
    // свой постоянный угол наделов в каждом квадрате земли 90×90; координаты — от его угла
    // (поворот по абсолютным координатам при крошечной смене угла разворачивал сетку в круги)
    const bx = Math.floor(lx / 90), by = Math.floor(ly / 90)
    const ang = hash(bx + 4001, by + 9007) * Math.PI
    const ca = Math.cos(ang), sa = Math.sin(ang)
    const rx = lx - bx * 90, ry = ly - by * 90
    const u = (rx * ca + ry * sa) / 13 + bx * 37, v = (-rx * sa + ry * ca) / 4.5 + by * 53
    const cu = Math.floor(u), cv = Math.floor(v)
    let d1 = 9, d2 = 9, best = 0
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const gx = cu + i, gy = cv + j
        const pu = gx + hash(gx * 3 + 1, gy * 7 + 2), pv = gy + hash(gx * 5 + 3, gy * 11 + 4)
        const d = Math.hypot((u - pu) * 13, (v - pv) * 4.5)
        if (d < d1) { d2 = d1; d1 = d; best = hash(gx + 913, gy + 377) }
        else if (d < d2) d2 = d
      }
    parcel.id = best
    parcel.edge = d2 - d1 // в логических единицах
  }

  const H = new Float32Array((STRIP + 2) * OW)
  const S = new Float32Array((STRIP + 2) * OW)
  const WX = new Float32Array((STRIP + 2) * OW)
  const WY = new Float32Array((STRIP + 2) * OW)
  const LX = -0.62, LY = -0.62, LZ = 0.48 // солнце с северо-запада
  const flatDot = LZ

  for (;;) {
    const strip = Atomics.add(counter, 0, 1)
    const y0 = strip * STRIP
    if (y0 >= OH) break
    const y1 = Math.min(OH, y0 + STRIP)
    // проход 1: высоты (с запасом в строку сверху и снизу — для нормалей)
    for (let Y = y0 - 1; Y <= y1; Y++) {
      const row = (Y - y0 + 1) * OW
      const yy = Math.min(OH - 1, Math.max(0, Y))
      for (let X = 0; X < OW; X++) {
        const lx = (X * 2) / K, ly = (yy * 2) / K // логические единицы
        const sx = (X + 0.5) / K - 0.5, sy = (yy + 0.5) / K - 0.5
        const wx = fbm(lx * 0.011, ly * 0.011, 3) * 2.2
        const wy = fbm(lx * 0.011 + 31.7, ly * 0.011 - 12.4, 3) * 2.2
        let s = bil(sdf, sx + wx * 0.3, sy + wy * 0.3) + fbm(lx * 0.06, ly * 0.06, 5) * 0.9 + noise(lx * 0.7, ly * 0.7) * 0.08
        let h
        if (s > 0) {
          bilW(sx + wx, sy + wy)
          const mtn = wts[4] + wts[5]
          const hill = wts[3]
          const rug = mtn * 0.9 + hill * 0.45 + 0.12
          h = bil(coarse, sx + wx * 0.5, sy + wy * 0.5)
          h += bil(lumHP, sx + wx * 0.15, sy + wy * 0.15) * rug * 0.3
          h += mtn * (ridged(lx * 0.014 + wx * 0.02, ly * 0.014 + wy * 0.02, 6) - 0.45) * 0.3
          h += hill * (fbm(lx * 0.03, ly * 0.03, 4)) * 0.1
          // мелкие гребни, осыпи и кочки — видны на самом сильном приближении
          h += (mtn * 0.035 + hill * 0.014 + 0.004) * fbm(lx * 0.13 + wx * 0.1, ly * 0.13, 4)
          h += mtn * (ridged(lx * 0.07, ly * 0.07, 3) - 0.5) * 0.03
          h += fbm(lx * 0.09, ly * 0.09, 3) * 0.012
          // барханы: гребни поперёк ветра с изгибом
          const big = sstep(0.4, 0.7, bil(DB, sx, sy) / 255)
          const des = wts[6] * (ly < 1300 ? 0 : 1) * big
          if (des > 0.05) {
            const u = lx * 0.16 + ly * 0.05 + fbm(lx * 0.02, ly * 0.02, 2) * 6
            const f = u - Math.floor(u)
            const dune = f < 0.7 ? f / 0.7 : (1 - f) / 0.3
            h += des * dune * 0.03 * (0.6 + 0.4 * noise(lx * 0.03, ly * 0.03))
          }
          const rv = bil(RV, sx + wx * 0.12, sy + wy * 0.12) / 255
          h -= rv * 0.025
          h = Math.max(0.002, h + Math.min(s, 3) * 0.004)
        } else {
          h = Math.max(-1, s * 0.004)
        }
        H[row + X] = h
        S[row + X] = s
        WX[row + X] = wx
        WY[row + X] = wy
      }
    }
    // проход 2: цвет и свет
    for (let Y = y0; Y < y1; Y++) {
      const row = (Y - y0 + 1) * OW
      for (let X = 0; X < OW; X++) {
        const i = row + X
        const s = S[i]
        const lx = (X * 2) / K, ly = (Y * 2) / K
        const sx = (X + 0.5) / K - 0.5, sy = (Y + 0.5) / K - 0.5
        let r, g, b
        if (s <= 0) {
          // --- вода ---
          const depth = sstep(0, 1, -s / 11 + fbm(lx * 0.008, ly * 0.008, 4) * 0.6 + 0.08)
          const n = fbm(lx * 0.02, ly * 0.02, 3)
          if (depth < 0.35) mix3(P.reef, P.shallow, depth / 0.35)
          else if (depth < 0.7) mix3(P.shallow, P.mid, (depth - 0.35) / 0.35)
          else mix3(P.mid, P.deep, (depth - 0.7) / 0.3)
          r = col[0] * (1 + n * 0.12)
          g = col[1] * (1 + n * 0.12)
          b = col[2] * (1 + n * 0.1)
          // рябь
          const wave = noise(lx * 0.5 + ly * 0.12, ly * 0.9) * 0.5 + noise(lx * 1.3, ly * 2.2) * 0.25
          const wv = 1 + wave * 0.05 * (1 - depth * 0.5)
          r *= wv
          g *= wv
          b *= wv
          // пена у самого берега
          if (s > -0.6) {
            const fm = sstep(-0.6, -0.05, s) * (0.5 + 0.5 * noise(lx * 0.8, ly * 0.8)) * 0.55
            r += (P.foam[0] - r) * fm
            g += (P.foam[1] - g) * fm
            b += (P.foam[2] - b) * fm
          }
          // тень берега на мелководье
          const hn = H[i - OW - 1]
          if (hn > 0) {
            r *= 0.85
            g *= 0.85
            b *= 0.88
          }
          // затемнение к краям карты
          const ex = Math.min(X, OW - X) / OW, ey = Math.min(Y, OH - Y) / OH
          const vig = 0.72 + 0.28 * sstep(0, 0.12, Math.min(ex, ey * 1.4))
          r *= vig
          g *= vig
          b *= vig
        } else {
          // --- суша ---
          bilW(sx + WX[i], sy + WY[i])
          let wl = 0
          for (let c = 1; c < 7; c++) wl += wts[c]
          if (wl < 0.01) {
            wts[1] = 1
            wl = 1
          }
          const north = 1 - sstep(900, 1350, ly) // холодный север: пустыня → тундра
          const h = H[i]
          const nB = fbm(lx * 0.035, ly * 0.035, 4)
          const nF = noise(lx * 0.14, ly * 0.14)
          // вокруг поселений лес вырублен под луга и пашни; край вырубки неровный
          const fmW = bil(FM, sx + WX[i] * 2.2 + fbm(lx * 0.03 + 7, ly * 0.03, 3) * 5, sy + WY[i] * 2.2 + fbm(lx * 0.03, ly * 0.03 + 7, 3) * 5) / 255
          const clear = sstep(0.86, 1.0, fmW + fbm(lx * 0.06, ly * 0.06, 3) * 0.35) * 0.95
          if (clear > 0 && wts[2] > 0) {
            wts[1] += wts[2] * clear
            wts[2] *= 1 - clear
          }
          acc[0] = acc[1] = acc[2] = 0
          // равнины: поля и луга
          if (wts[1] > 0.01) {
            mix3(P.plainA, P.plainB, 0.5 + nB)
            const patch = noise(Math.floor(lx * 0.09 + nF * 0.6) * 1.7, Math.floor(ly * 0.11 + nF * 0.6) * 2.3)
            const fc = patch > 0.25 ? 0.35 : patch < -0.3 ? -0.3 : 0
            if (fc > 0) { tmpA[0] = col[0] + (P.field[0] - col[0]) * fc; tmpA[1] = col[1] + (P.field[1] - col[1]) * fc; tmpA[2] = col[2] + (P.field[2] - col[2]) * fc }
            else { tmpA[0] = col[0] + (P.plainC[0] - col[0]) * -fc; tmpA[1] = col[1] + (P.plainC[1] - col[1]) * -fc; tmpA[2] = col[2] + (P.plainC[2] - col[2]) * -fc }
            add3(tmpA, wts[1])
          }
          // холмы
          if (wts[3] > 0.01) {
            mix3(P.hillA, P.hillB, 0.5 + nB)
            add3(col, wts[3])
          }
          // горы: скалы, осыпи, снег по высоте
          if (wts[4] + wts[5] > 0.01) {
            const strata = noise(lx * 0.05, ly * 0.4 + nB * 4)
            mix3(P.rockA, P.rockB, 0.5 + strata * 0.8)
            tmpA[0] = col[0]; tmpA[1] = col[1]; tmpA[2] = col[2]
            mix3(tmpA, P.rockC, Math.max(0, nB) * 1.2)
            const snowLine = sstep(0.66, 0.8, h + nB * 0.1 + wts[5] * 0.22 - (1 - north) * 0.08)
            tmpA[0] = col[0]; tmpA[1] = col[1]; tmpA[2] = col[2]
            mix3(tmpA, P.snow, snowLine)
            add3(col, wts[4] + wts[5])
          }
          // пустыня / тундра
          if (wts[6] > 0.01) {
            mix3(P.sandA, P.sandB, 0.5 + nB)
            tmpA[0] = col[0]; tmpA[1] = col[1]; tmpA[2] = col[2]
            mix3(tmpA, P.sandC, Math.max(0, noise(lx * 0.07, ly * 0.07)) * 0.8)
            tmpA[0] = col[0]; tmpA[1] = col[1]; tmpA[2] = col[2]
            const rocky = sstep(0.25, 0.5, noise(lx * 0.025 + 40, ly * 0.025))
            mix3(tmpA, P.stone, rocky * 0.5)
            tmpA[0] = col[0]; tmpA[1] = col[1]; tmpA[2] = col[2]
            mix3(P.steppeA, P.steppeB, 0.5 + nB)
            const steppe = [col[0], col[1], col[2]]
            mix3(steppe, tmpA, sstep(0.4, 0.7, bil(DB, sx, sy) / 255))
            const desert = [col[0], col[1], col[2]]
            mix3(P.tundraA, P.tundraB, 0.5 + nB)
            tmpA[0] = col[0]; tmpA[1] = col[1]; tmpA[2] = col[2]
            mix3(tmpA, P.snow, sstep(0.1, 0.4, noise(lx * 0.04, ly * 0.04)) * 0.7)
            const tundra = [col[0], col[1], col[2]]
            mix3(desert, tundra, north)
            add3(col, wts[6])
          }
          // лес: под кронами — тёмная подстилка
          if (wts[2] > 0.01) {
            mix3(P.forestGround, P.plainC, 0.25 + nB * 0.3)
            add3(col, wts[2])
          }
          r = acc[0] / wl
          g = acc[1] / wl
          b = acc[2] / wl
          // настроение исходной карты
          bilT(sx, sy)
          r += (tintC[0] * 1.2 - r) * 0.26
          g += (tintC[1] * 1.2 - g) * 0.26
          b += (tintC[2] * 1.2 - b) * 0.26
          // мелкая фактура: трава, камни, тропинки — видна только вблизи
          const fine = 1 + noise(lx * 0.55, ly * 0.55) * 0.07 + noise(lx * 1.6, ly * 1.6) * 0.05
          r *= fine
          g *= fine
          b *= fine
          // пашни у поселений: наделы разных культур, межи и изгороди
          const farm = sstep(0.12, 0.55, fmW + nF * 0.12) * Math.min(1, (wts[1] + wts[3] * 0.5 + wts[6] * 0.3 * (1 - north)) / wl * 1.2)
          if (farm > 0.02) {
            parcelAt(lx, ly)
            const id = parcel.id
            const crop = id < 0.3 ? P.cropA : id < 0.55 ? P.cropB : id < 0.75 ? P.cropC : P.cropD
            const furrow = 1 + noise(lx * 0.9 + id * 50, ly * 0.9 - id * 30) * 0.05
            const k = farm * 0.5
            r += (crop[0] * furrow - r) * k
            g += (crop[1] * furrow - g) * k
            b += (crop[2] * furrow - b) * k
            if (parcel.edge < 0.35) {
              const e = (1 - parcel.edge / 0.35) * farm * (id > 0.6 ? 0.5 : 0.28)
              r += (P.hedge[0] - r) * e
              g += (P.hedge[1] - g) * e
              b += (P.hedge[2] - b) * e
            }
          }
          // берег: сухой песок, у самой воды — мокрый
          if (s < 2 && wts[4] + wts[5] < 0.5) {
            const bt = (1 - sstep(0.4, 2, s)) * 0.75
            const wet = 1 - sstep(0.05, 0.45, s)
            const sand0 = P.beach[0] + (P.wetSand[0] - P.beach[0]) * wet
            const sand1 = P.beach[1] + (P.wetSand[1] - P.beach[1]) * wet
            const sand2 = P.beach[2] + (P.wetSand[2] - P.beach[2]) * wet
            r += (sand0 - r) * bt
            g += (sand1 - g) * bt
            b += (sand2 - b) * bt
          }
          // река: вода с тёмными мокрыми берегами
          const rv = bil(RV, sx + WX[i] * 0.12, sy + WY[i] * 0.12) / 255 + noise(lx * 0.4, ly * 0.4) * 0.06
          if (rv > 0.28) {
            const bank = sstep(0.28, 0.46, rv)
            const wet = 1 - bank * 0.25
            r *= wet
            g *= wet
            b *= wet
            const water = sstep(0.5, 0.6, rv)
            const ripple = 1 + noise(lx * 1.2, ly * 1.2) * 0.06
            r += (P.river[0] * ripple - r) * water
            g += (P.river[1] * ripple - g) * water
            b += (P.river[2] * ripple - b) * water
          }
          // дороги: тракт из серого камня с бордюром, грунтовка, тропа; над рекой — мост
          const dP = roadD(RP, lx, ly), dD = roadD(RDT, lx, ly), dT = roadD(RT, lx, ly)
          const onRiver = rv > 0.5
          if (dT < 0.7) {
            const k = (1 - sstep(0.22, 0.4, dT)) * (onRiver ? 0.9 : 0.75)
            const c = onRiver ? P.plank : P.trailC
            r += (c[0] - r) * k
            g += (c[1] - g) * k
            b += (c[2] - b) * k
          }
          if (dD < 1) {
            const k = (1 - sstep(0.45, 0.65, dD)) * 0.9
            const c = onRiver ? P.plank : P.dirtRoad
            const rut = 1 - (1 - sstep(0.05, 0.16, Math.abs(dD - 0.22))) * 0.12 // колеи
            r += (c[0] * rut - r) * k
            g += (c[1] * rut - g) * k
            b += (c[2] * rut - b) * k
          }
          if (dP < 1.1) {
            const edge = 1 - sstep(0.75, 0.92, dP)
            const kerb = sstep(0.55, 0.75, dP) * edge * 0.6
            const cob = 1 + noise(lx * 3.2, ly * 3.2) * 0.07 + noise(lx * 7, ly * 7) * 0.05
            r += (P.stoneRoad[0] * cob - r) * edge
            g += (P.stoneRoad[1] * cob - g) * edge
            b += (P.stoneRoad[2] * cob - b) * edge
            r += (P.kerb[0] - r) * kerb * 0.7
            g += (P.kerb[1] - g) * kerb * 0.7
            b += (P.kerb[2] - b) * kerb * 0.7
          }
          // свет от рельефа
          const EX = (68 * K) / 4
          const dzx = (H[i + 1] - H[i - 1]) * 0.5 * EX
          const dzy = (H[i + OW] - H[i - OW]) * 0.5 * EX
          const inv = 1 / Math.sqrt(dzx * dzx + dzy * dzy + 1)
          let dot = (-dzx * LX - dzy * LY + LZ) * inv
          let shade = (0.52 + Math.max(0, dot)) / (0.52 + flatDot)
          // тень от гор, заслоняющих солнце
          shade *= 1 - (bil(SHD, sx, sy) / 255) * 0.38
          // деревья
          const forestD = Math.min(1, (wts[2] / wl) * 1.25 + (wts[4] / wl) * 0.12 * (h < 0.5 ? 1 : 0) + (wts[1] / wl) * 0.03) * (1 - sstep(0.18, 0.34, rv)) * sstep(0.7, 1.6, Math.min(dP, dD)) * sstep(0.25, 0.6, dT)
          if (forestD > 0.04) {
            const dens = sstep(0.04, 0.9, forestD + nF * 0.2) * 0.97
            const pine = (h > 0.32 || ly < 1200) ? 1 : 0
            if (crownAt(X, Y, dens, pine)) {
              const nz = Math.sqrt(Math.max(0, 1 - crown.nx * crown.nx - crown.ny * crown.ny))
              const cd = (-crown.nx * LX - crown.ny * LY + nz * LZ * 1.3)
              const lit = sstep(-0.2, 1.1, cd)
              const v = hash(Math.floor(X / CELL), Math.floor(Y / CELL))
              mix3(pine ? P.pineD : P.crownD, pine ? P.pineL : P.crownL, lit)
              // у лиственных — редкие желтеющие кроны
              if (!pine && v > 0.8) {
                const au = (v - 0.8) * 2.5 * lit
                col[0] += (P.autumn[0] - col[0]) * au
                col[1] += (P.autumn[1] - col[1]) * au
                col[2] += (P.autumn[2] - col[2]) * au
              }
              const tv = 0.88 + v * 0.22
              r = col[0] * tv
              g = col[1] * tv
              b = col[2] * tv
              shade = 0.75 + shade * 0.25
            } else {
              // просвет между кронами — тёмная глубина леса
              if (dens > 0.5) {
                const gk = (dens - 0.5) * 1.4
                r += (P.gap[0] - r) * gk
                g += (P.gap[1] - g) * gk
                b += (P.gap[2] - b) * gk
              }
              if (crownAt(X - 0.55 * CELL, Y - 0.55 * CELL, dens, pine)) shade *= 0.55 // тень от соседнего дерева
            }
          } else {
            // опушка отбрасывает тень на поле (солнце с северо-запада)
            bilW(sx - 0.7 + WX[i], sy - 0.7 + WY[i])
            const edgeF = wts[2]
            if (edgeF > 0.35) shade *= 1 - sstep(0.35, 0.8, edgeF) * 0.22
          }
          // ложбины темнее
          r *= shade
          g *= shade * 0.99
          b *= shade * (shade < 1 ? 1.04 : 0.98)
        }
        const o = (Y * OW + X) * 3
        out[o] = Math.max(0, Math.min(255, r * 255))
        out[o + 1] = Math.max(0, Math.min(255, g * 255))
        out[o + 2] = Math.max(0, Math.min(255, b * 255))
      }
    }
    parentPort.postMessage(strip + 1)
  }
}
