// Гидрология карты мира: реки и озёра по рельефу, а не по рисунку.
// Высоты (+шум +«подсказка» от нарисованных русел) → заполнение впадин от моря → сток по D8 →
// русла там, где накопился большой водосбор. Река каждой клеткой течёт вниз и никогда не раздваивается.
// Возвращает { river: Uint8Array (255 = вода), lake: Uint8Array, stats }.

function hash(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x, y, cell, s) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell)
  const fx = x / cell - gx, fy = y / cell - gy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function hydro({ W, H, prov, cls, smooth, guide, opts = {} }) {
  const N = W * H
  const T = opts.T ?? 4000 // порог водосбора для русла (клеток)
  const LAKE_D = opts.lakeDepth ?? 6 // глубина заполнения впадины, с которой она — озеро
  const Q = 16 // шагов высоты в единице
  const dist = new Float32Array(N).fill(-1)
  { const q = new Int32Array(N); let a = 0, b = 0
    for (let i = 0; i < N; i++) if (prov[i]) { const x = i % W; if (x === 0 || x === W - 1 || i < W || i >= N - W || !prov[i - 1] || !prov[i + 1] || !prov[i - W] || !prov[i + W]) { dist[i] = 0; q[b++] = i } }
    while (a < b) { const c = q[a++]; const x = c % W; for (const n of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W]) { if (n < 0 || n >= N || !prov[n] || dist[n] >= 0) continue; dist[n] = dist[c] + 1; q[b++] = n } } }
  const h = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    if (!prov[i]) continue
    const x = i % W, y = (i / W) | 0
    let v = smooth[i] + Math.min(dist[i], 700) * (opts.slope ?? 0.06)
    v += (vnoise(x, y, 70, 1) - 0.5) * 8 + (vnoise(x, y, 26, 2) - 0.5) * 5 + (vnoise(x, y, 9, 3) - 0.5) * 3
    if (guide && guide[i]) v -= 14
    h[i] = v
  }
  // ---- заполнение впадин от моря (bucket queue), порядок обхода — для накопления ----
  const key = new Int32Array(N)
  let maxK = 0
  for (let i = 0; i < N; i++) if (prov[i]) { key[i] = Math.max(0, Math.round(h[i] * Q) + 400); if (key[i] > maxK) maxK = key[i] }
  const bk = new Array(maxK + 2)
  const level = new Int32Array(N).fill(-1)
  const flow = new Int32Array(N).fill(-1)
  let rs = 12345
  const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296)
  const push = (c, lv) => { level[c] = lv; (bk[lv] ||= []).push(c) }
  for (let i = 0; i < N; i++) {
    if (!prov[i]) continue
    const x = i % W, y = (i / W) | 0
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || !prov[i - 1] || !prov[i + 1] || !prov[i - W] || !prov[i + W]) push(i, key[i])
  }
  const order = new Int32Array(N)
  let on = 0
  const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1], dy8 = [-1, -1, -1, 0, 0, 1, 1, 1]
  const ORTH = [0, 1, 2, 3, 4, 5, 6, 7]
  for (let b = 0; b <= maxK; b++) {
    const A = bk[b]
    while (A && A.length) {
      const j = (rnd() * A.length) | 0
      const c = A[j]; A[j] = A[A.length - 1]; A.pop()
      order[on++] = c
      const x = c % W, y = (c / W) | 0
      for (const k of ORTH) {
        const nx = x + dx8[k], ny = y + dy8[k]
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const n = ny * W + nx
        if (!prov[n] || level[n] >= 0) continue
        flow[n] = c
        push(n, key[n] > b ? key[n] : b)
      }
    }
  }
  // ---- накопление стока ----
  const acc = new Float32Array(N)
  for (let i = 0; i < N; i++) if (prov[i]) acc[i] = cls[i] === 4 || cls[i] === 5 ? 2.2 : cls[i] === 3 ? 1.4 : 1
  for (let k = on - 1; k >= 0; k--) {
    const c = order[k]
    if (flow[c] >= 0) acc[flow[c]] += acc[c]
  }
  // ---- озёра: глубина заполнения ----
  const lake = new Uint8Array(N)
  for (let i = 0; i < N; i++) if (prov[i] && (level[i] - key[i]) / Q > LAKE_D) lake[i] = 1
  // чистка озёр: мелкие пятна и одиночки убрать
  {
    const seen = new Uint8Array(N)
    const stack = []
    for (let i = 0; i < N; i++) {
      if (!lake[i] || seen[i]) continue
      const comp = []
      stack.push(i); seen[i] = 1
      while (stack.length) {
        const c = stack.pop(); comp.push(c)
        const x = c % W, y = (c / W) | 0
        for (let k = 0; k < 8; k++) {
          const nx = x + dx8[k], ny = y + dy8[k]
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const n = ny * W + nx
          if (lake[n] && !seen[n]) { seen[n] = 1; stack.push(n) }
        }
      }
      if (comp.length < (opts.lakeMin ?? 150) || comp.length > (opts.lakeMax ?? 5000)) for (const c of comp) lake[c] = 0
    }
  }
  // ---- русла ----
  const river = new Uint8Array(N)
  let rc = 0
  for (let i = 0; i < N; i++) {
    if (!prov[i] || acc[i] < T) continue
    rc++
    const x = i % W, y = (i / W) | 0
    const r = Math.min(opts.maxR ?? 3.6, 1.25 + 0.021 * Math.sqrt(acc[i]) * (opts.wk ?? 1))
    const ri = Math.ceil(r)
    for (let dy = -ri; dy <= ri; dy++)
      for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const n = ny * W + nx
        if (prov[n]) river[n] = 255
      }
  }
  let lk = 0
  for (let i = 0; i < N; i++) if (lake[i]) { river[i] = 255; lk++ }
  return { river, lake, flow, acc, stats: { riverCells: rc, lakeCells: lk } }
}
