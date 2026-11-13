/**
 * Улицы поселения. На плане Watabou улицы — просто промежутки между домами, поэтому сеть выводится из самого плана:
 * сперва проводятся главные улицы от ворот и примечательных зданий к центру, затем к ним подводятся дорожки от дверей
 * всех домов. Получается дерево путей, по которому рисуются улицы и ходят жители.
 */
type P2 = [number, number]

export interface Streets {
  gw: number
  gh: number
  cell: number
  /** Сколько домов «пользуется» клеткой улицы */
  traffic: Uint16Array
  /** Сглаженное положение клетки: x, z */
  sp: Float32Array
  parent: Int32Array
  /** Клетка уже лежит на главной улице (от ворот и примечательных зданий) */
  main: Uint8Array
  /** Путь из точки в точку по улицам: x, z, x, z… */
  trip: (a: P2, b: P2) => Float32Array | null
}

class Heap {
  k = new Float32Array(4096)
  v = new Int32Array(4096)
  n = 0
  push(key: number, val: number): void {
    if (this.n === this.k.length) {
      const k = new Float32Array(this.n * 2), v = new Int32Array(this.n * 2)
      k.set(this.k)
      v.set(this.v)
      this.k = k
      this.v = v
    }
    let i = this.n++
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.k[p] <= key) break
      this.k[i] = this.k[p]
      this.v[i] = this.v[p]
      i = p
    }
    this.k[i] = key
    this.v[i] = val
  }
  /** Индекс снятого значения лежит в popKey/popVal */
  popKey = 0
  popVal = 0
  pop(): void {
    this.popKey = this.k[0]
    this.popVal = this.v[0]
    const key = this.k[--this.n], val = this.v[this.n]
    let i = 0
    for (;;) {
      let c = i * 2 + 1
      if (c >= this.n) break
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++
      if (this.k[c] >= key) break
      this.k[i] = this.k[c]
      this.v[i] = this.v[c]
      i = c
    }
    this.k[i] = key
    this.v[i] = val
  }
}

export function buildStreets(o: {
  W: number
  H: number
  cell: number
  free: (x: number, z: number) => boolean
  roadAt: (x: number, z: number) => number
  hub: P2
  mains: P2[]
  doors: P2[]
}): Streets {
  const { cell } = o
  const gw = Math.ceil(o.W / cell), gh = Math.ceil(o.H / cell), n = gw * gh
  const open = new Uint8Array(n)
  // в большом городе клетка крупнее переулка: она проходима, если свободна хоть одна её часть
  const off = cell > 2.2 ? [[0, 0], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0, -0.42], [0, 0.42], [-0.42, 0], [0.42, 0]] : [[0, 0]]
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const x = (i + 0.5) * cell, z = (j + 0.5) * cell
      let ok = 0
      for (let t = 0; t < off.length && !ok; t++) if (o.free(x + off[t][0] * cell, z + off[t][1] * cell)) ok = 1
      open[j * gw + i] = ok
    }

  // расстояние до ближайшей стены дома: улица идёт посередине проезда
  const clear = new Float32Array(n)
  const D = 1, DD = 1.414
  for (let q = 0; q < n; q++) clear[q] = open[q] ? 1e6 : 0
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const q = j * gw + i
      if (i > 0) clear[q] = Math.min(clear[q], clear[q - 1] + D)
      if (j > 0) {
        clear[q] = Math.min(clear[q], clear[q - gw] + D)
        if (i > 0) clear[q] = Math.min(clear[q], clear[q - gw - 1] + DD)
        if (i < gw - 1) clear[q] = Math.min(clear[q], clear[q - gw + 1] + DD)
      }
    }
  for (let j = gh - 1; j >= 0; j--)
    for (let i = gw - 1; i >= 0; i--) {
      const q = j * gw + i
      if (i < gw - 1) clear[q] = Math.min(clear[q], clear[q + 1] + D)
      if (j < gh - 1) {
        clear[q] = Math.min(clear[q], clear[q + gw] + D)
        if (i < gw - 1) clear[q] = Math.min(clear[q], clear[q + gw + 1] + DD)
        if (i > 0) clear[q] = Math.min(clear[q], clear[q + gw - 1] + DD)
      }
    }

  const cost = new Float32Array(n)
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const q = j * gw + i
      if (!open[q]) continue
      const c = clear[q] * cell
      cost[q] = (1 + 7 / (c + 0.6)) * (o.roadAt((i + 0.5) * cell, (j + 0.5) * cell) > 0.4 ? 0.3 : 1)
    }

  const cellOf = (p: P2): number => {
    const ci = Math.floor(p[0] / cell), cj = Math.floor(p[1] / cell)
    for (let r = 0; r < 14; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
          const i = ci + di, j = cj + dj
          if (i >= 0 && j >= 0 && i < gw && j < gh && open[j * gw + i] && comp[j * gw + i] === bestComp) return j * gw + i
        }
    return -1
  }

  // центр — в самой большой связной части города: площадь могло запереть особыми зданиями, цитадель — стеной
  const comp = new Int32Array(n).fill(-1)
  let bestComp = -1, bestSize = 0
  const stack = new Int32Array(n)
  for (let q0 = 0, id = 0; q0 < n; q0++) {
    if (!open[q0] || comp[q0] >= 0) continue
    let sp2 = 0, size = 0
    stack[sp2++] = q0
    comp[q0] = id
    while (sp2) {
      const q = stack[--sp2], i = q % gw, j = (q / gw) | 0
      size++
      if (i > 0 && open[q - 1] && comp[q - 1] < 0) { comp[q - 1] = id; stack[sp2++] = q - 1 }
      if (i < gw - 1 && open[q + 1] && comp[q + 1] < 0) { comp[q + 1] = id; stack[sp2++] = q + 1 }
      if (j > 0 && open[q - gw] && comp[q - gw] < 0) { comp[q - gw] = id; stack[sp2++] = q - gw }
      if (j < gh - 1 && open[q + gw] && comp[q + gw] < 0) { comp[q + gw] = id; stack[sp2++] = q + gw }
    }
    if (size > bestSize) { bestSize = size; bestComp = id }
    id++
  }
  let hub = 0, hubD = 1e30
  for (let q = 0; q < n; q++) {
    if (comp[q] !== bestComp) continue
    const d = ((q % gw) * cell - o.hub[0]) ** 2 + (((q / gw) | 0) * cell - o.hub[1]) ** 2
    if (d < hubD) { hubD = d; hub = q }
  }
  const dist = new Float32Array(n)
  const parent = new Int32Array(n)
  const NBX = [1, -1, 0, 0, 1, 1, -1, -1], NBY = [0, 0, 1, -1, 1, -1, 1, -1], NBL = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414]
  const solve = (): void => {
    dist.fill(1e30)
    parent.fill(-1)
    const h = new Heap()
    dist[hub] = 0
    h.push(0, hub)
    while (h.n) {
      h.pop()
      const q = h.popVal
      if (h.popKey > dist[q]) continue
      const i = q % gw, j = (q / gw) | 0
      const dq = dist[q]
      for (let t = 0; t < 8; t++) {
        const dx = NBX[t], dy = NBY[t], l = NBL[t]
        const x = i + dx, y = j + dy
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue
        const w = y * gw + x
        if (!open[w]) continue
        // по диагонали нельзя срезать угол дома
        if (dx && dy && (!open[j * gw + x] || !open[y * gw + i])) continue
        const d = dq + cost[w] * l
        if (d < dist[w]) {
          dist[w] = d
          parent[w] = q
          h.push(d, w)
        }
      }
    }
  }

  // первый проход — главные улицы; по ним потом идти дешевле, и дорожки от домов стекаются к ним, а не веером
  solve()
  const main = new Uint8Array(n)
  for (const p of o.mains) {
    let q = cellOf(p)
    while (q >= 0 && !main[q]) {
      main[q] = 1
      q = parent[q]
    }
  }
  for (let q = 0; q < n; q++) if (main[q]) cost[q] *= 0.28
  solve()
  const traffic = new Uint16Array(n)
  const walk = (p: P2, weight: number): void => {
    let q = cellOf(p)
    if (q < 0 || parent[q] < 0) return
    while (q >= 0) {
      traffic[q] = Math.min(65000, traffic[q] + weight)
      q = parent[q]
    }
  }
  for (const p of o.mains) walk(p, 6)
  for (const p of o.doors) walk(p, 1)

  // сглаживание: клетка притягивается к среднему своего участка пути
  const sp = new Float32Array(n * 2)
  for (let q = 0; q < n; q++) {
    if (!traffic[q]) continue
    let x = 0, y = 0, m = 0, w = q
    for (let s = 0; s < 4 && w >= 0; s++, w = parent[w]) {
      x += (w % gw) + 0.5
      y += ((w / gw) | 0) + 0.5
      m++
    }
    sp[q * 2] = (x / m) * cell
    sp[q * 2 + 1] = (y / m) * cell
  }

  const chain = (q: number): number[] => {
    const out: number[] = []
    while (q >= 0 && out.length < 4000) {
      out.push(q)
      q = parent[q]
    }
    return out
  }
  const trip = (a: P2, b: P2): Float32Array | null => {
    const ca = cellOf(a), cb = cellOf(b)
    if (ca < 0 || cb < 0 || (ca !== hub && parent[ca] < 0) || (cb !== hub && parent[cb] < 0)) return null
    const A = chain(ca), B = chain(cb)
    // общий предок: идти через центр незачем, если дома на одной улице
    let i = A.length - 1, j = B.length - 1
    while (i > 0 && j > 0 && A[i - 1] === B[j - 1]) { i--; j-- }
    const cells = [...A.slice(0, i + 1), ...B.slice(0, j).reverse()]
    const step = Math.max(1, Math.round(2.4 / cell))
    const pts: number[] = []
    const put = (q: number): void => {
      const has = traffic[q] > 0
      pts.push(has ? sp[q * 2] : ((q % gw) + 0.5) * cell, has ? sp[q * 2 + 1] : (((q / gw) | 0) + 0.5) * cell)
    }
    for (let s = 0; s < cells.length; s += step) put(cells[s])
    put(cells[cells.length - 1])
    return pts.length >= 4 ? new Float32Array(pts) : null
  }

  return { gw, gh, cell, traffic, sp, parent, main, trip }
}
