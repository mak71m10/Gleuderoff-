import type { Bucket } from './city3d'

/** Особые здания: своя модель по смыслу названия с плана — амфитеатр, собор, биржа, кастра, верфь… */
export type MonKind = 'palace' | 'cathedral' | 'arena' | 'hall' | 'bank' | 'academy' | 'fort' | 'castle' | 'warehouse' | 'shipyard' | 'factory' | 'lighthouse' | 'belltower' | 'darktower'

export function monumentKind(name: string, buildings: number): MonKind | null {
  const n = name.toLowerCase()
  if (/немая палата|серый дом/.test(n)) return 'darktower'
  if (/маяк(?! *совет)|маячн/.test(n)) return 'lighthouse'
  if (/амфитеатр/.test(n)) return 'arena'
  if (/замок монстаргов|дворец|палаццо|летний двор/.test(n)) return 'palace'
  if (/собор|великий храм/.test(n)) return buildings > 100 ? 'cathedral' : null
  if (/мануфактур|цеха|литейн|оружейн|солеварн|пивоварн/.test(n)) return 'factory'
  if (/кастра|казармы|ставка|комендатур|управа|морского ордена|святого ордена/.test(n)) return 'fort'
  if (/замок|цитадел|гнездо/.test(n)) return buildings > 150 ? 'castle' : null
  if (/биржа|банк|вексельн|монетн|меняльн|таможн/.test(n)) return 'bank'
  if (/академ|библиотек|университет|школа|редакц|типограф/.test(n)) return buildings > 40 ? 'academy' : null
  if (/верф/.test(n)) return 'shipyard'
  if (/склад|пакгауз|амбар/.test(n)) return 'warehouse'
  if (/колокольн|звонниц|вышка/.test(n)) return 'belltower'
  if (/совет|палата|^зал |министерств|адмиралтейств|дом капитанов|сообщества|ратуш|губернатор|подест|старейшин/.test(n)) return buildings > 40 ? 'hall' : null
  return null
}

/** Сколько места просит здание в большом городе: длина и ширина, м */
export const MON_SIZE: Record<MonKind, [number, number]> = {
  palace: [66, 42], cathedral: [52, 28], arena: [70, 56], hall: [40, 24], bank: [26, 18], academy: [38, 30], fort: [50, 40], castle: [58, 48],
  warehouse: [30, 13], shipyard: [34, 16], factory: [32, 15], lighthouse: [11, 11], belltower: [9, 9], darktower: [18, 18]
}

export interface MonStyle { wall: string; stone: string; roof: string; dark: string; pillar: string; banner: string; timber: string }
export interface MonOut { smoke: [number, number, number][]; beacon: [number, number, number][] }
interface Parts { solid: Bucket; roof: Bucket; glow: Bucket }

/** Строит здание с центром x, z; L — вдоль оси rot, W — поперёк, «перед» смотрит в сторону +v. Возвращает высоту верха. */
export function buildMonument(kind: MonKind, P: Parts, x: number, z: number, rot: number, L: number, W: number, base: number, st: MonStyle, out: MonOut): number {
  const c = Math.cos(rot), s = Math.sin(rot)
  const X = (u: number, v: number): number => x + u * c - v * s
  const Z = (u: number, v: number): number => z + u * s + v * c
  const box = (u: number, v: number, y: number, su: number, sy: number, sv: number, col: string): void => P.solid.box(X(u, v), base + y, Z(u, v), su, sy, sv, col, rot)
  const glow = (u: number, v: number, y: number, su: number, sy: number, sv: number): void => P.glow.box(X(u, v), base + y, Z(u, v), su, sy, sv, '#ffffff', rot)
  const cyl = (u: number, v: number, y: number, r: number, h: number, n: number, col: string, r2 = r, cap = true): void => P.solid.cyl(X(u, v), base + y, Z(u, v), r, h, n, col, r2, cap)
  /** Двускатная крыша: конёк вдоль u (или вдоль v) */
  const gable = (u: number, v: number, y: number, su: number, sv: number, rise: number, col: string, alongV = false): void => {
    const hu = su / 2, hv = sv / 2
    const V = (a: number, b: number, h: number): [number, number, number] => [X(u + a, v + b), base + y + h, Z(u + a, v + b)]
    const t = (A: [number, number, number], B: [number, number, number], D: [number, number, number], E: [number, number, number], len: number, wid: number): void => {
      P.roof.tri(A, B, D, col, 1, [0, 0, len, 0, len, wid])
      P.roof.tri(A, D, E, col, 1, [0, 0, len, wid, 0, wid])
    }
    const lu = su / 2.4, lv = Math.hypot(hv, rise) / 2.4, lv2 = Math.hypot(hu, rise) / 2.4, lu2 = sv / 2.4
    if (!alongV) {
      t(V(-hu, -hv, 0), V(hu, -hv, 0), V(hu, 0, rise), V(-hu, 0, rise), lu, lv)
      t(V(-hu, hv, 0), V(hu, hv, 0), V(hu, 0, rise), V(-hu, 0, rise), lu, lv)
      P.solid.tri(V(-hu, -hv, 0), V(-hu, hv, 0), V(-hu, 0, rise), st.wall)
      P.solid.tri(V(hu, -hv, 0), V(hu, hv, 0), V(hu, 0, rise), st.wall)
    } else {
      t(V(-hu, -hv, 0), V(-hu, hv, 0), V(0, hv, rise), V(0, -hv, rise), lu2, lv2)
      t(V(hu, -hv, 0), V(hu, hv, 0), V(0, hv, rise), V(0, -hv, rise), lu2, lv2)
      P.solid.tri(V(-hu, -hv, 0), V(hu, -hv, 0), V(0, -hv, rise), st.wall)
      P.solid.tri(V(-hu, hv, 0), V(hu, hv, 0), V(0, hv, rise), st.wall)
    }
  }
  const merlons = (u: number, v: number, y: number, su: number, sv: number, col: string): void => {
    const nu = Math.max(2, Math.round(su / 2.2)), nv = Math.max(2, Math.round(sv / 2.2))
    for (let i = 0; i <= nu; i += 1) for (const sd of [-1, 1]) if (i % 2 === 0) box(u - su / 2 + (su * i) / nu, v + (sd * sv) / 2, y, su / nu, 1.1, 0.5, col)
    for (let i = 0; i <= nv; i += 1) for (const sd of [-1, 1]) if (i % 2 === 0) box(u + (sd * su) / 2, v - sv / 2 + (sv * i) / nv, y, 0.5, 1.1, sv / nv, col)
  }
  const roundTower = (u: number, v: number, y: number, r: number, h: number, col: string, spire?: string): void => {
    cyl(u, v, y - 2, r, h + 2, 12, col)
    if (spire) cyl(u, v, y + h, r * 1.18, r * 2.6, 12, spire, 0, false)
    else for (let m = 0; m < 10; m++) { const a = (m / 10) * 6.283; P.solid.box(X(u, v) + Math.cos(a) * r, base + y + h, Z(u, v) + Math.sin(a) * r, 0.9, 1, 0.45, col, a + 1.57) }
  }
  const dome = (u: number, v: number, y: number, r: number, col: string): void => {
    const steps = 5
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * 1.57, a1 = ((i + 1) / steps) * 1.57
      cyl(u, v, y + Math.sin(a0) * r, Math.cos(a0) * r, (Math.sin(a1) - Math.sin(a0)) * r, 14, col, Math.max(0.01, Math.cos(a1) * r), false)
    }
    box(u, v, y + r, 0.5, 2.2, 0.5, '#d8c070')
  }
  /** Ряд колонн с антаблементом и фронтоном по фасаду +v */
  const portico = (u: number, frontV: number, width: number, h: number, depth: number): void => {
    const n = Math.max(4, Math.round(width / 3))
    box(u, frontV + depth / 2, -0.4, width + 1.6, 1.1, depth + 2.2, st.stone)
    for (let i = 0; i < n; i++) {
      const cu = u - width / 2 + (width * (i + 0.5)) / n
      cyl(cu, frontV + depth, 0.7, 0.55, h - 1.4, 8, st.pillar)
    }
    box(u, frontV + depth / 2, h - 0.7, width + 0.6, 1.1, depth + 0.6, st.pillar)
    gable(u, frontV + depth / 2, h + 0.4, width + 0.6, depth + 0.6, Math.min(3, width * 0.13), st.roof)
    glow(u, frontV + 0.08, 0.7, 2.2, 3.4, 0.14)
  }
  const windows = (u: number, v: number, y: number, su: number, h: number, count: number, normalV = true): void => {
    for (let i = 0; i < count; i++) {
      const t = -su / 2 + (su * (i + 0.5)) / count
      if (normalV) glow(u + t, v, y, 0.95, h, 0.12)
      else glow(u, v + t, y, 0.12, h, 0.95)
    }
  }
  const flag = (u: number, v: number, y: number, h = 5): void => {
    box(u, v, y, 0.14, h, 0.14, '#2a2420')
    box(u + 1, v, y + h - 1.3, 2, 1.25, 0.05, st.banner)
  }
  const crate = (u: number, v: number): void => box(u, v, 0, 1.1, 0.9, 1.1, '#8a6a42')

  const L2 = L / 2, W2 = W / 2
  switch (kind) {
    case 'palace': {
      const h = 13
      box(0, 0, -2, L * 0.46, h + 2, W * 0.62, st.wall)
      gable(0, 0, h, L * 0.46, W * 0.62, 5, st.roof)
      for (const sd of [-1, 1]) {
        box(sd * L * 0.34, W * 0.06, -2, L * 0.24, h - 1, W * 0.86, st.wall)
        gable(sd * L * 0.34, W * 0.06, h - 3, L * 0.24, W * 0.86, 4.2, st.roof, true)
        roundTower(sd * L2 * 0.92, W2 * 0.86, 0, 3, h + 3, st.wall, st.dark)
        roundTower(sd * L2 * 0.92, -W2 * 0.72, 0, 3, h + 3, st.wall, st.dark)
        windows(sd * L * 0.34, W * 0.49, 2, L * 0.2, 2.2, 4)
        windows(sd * L * 0.34, W * 0.49, 6.6, L * 0.2, 2.2, 4)
      }
      portico(0, W * 0.31, L * 0.3, h - 2, 3.4)
      windows(0, W * 0.31, 8, L * 0.4, 2.4, 8)
      dome(0, -W * 0.05, h + 5, Math.min(L, W) * 0.13, st.dark)
      flag(-L * 0.12, -W * 0.05, h + 5)
      flag(L * 0.12, -W * 0.05, h + 5)
      return base + h + 5 + Math.min(L, W) * 0.13 + 2
    }
    case 'cathedral': {
      const h = Math.min(20, W * 0.72), nave = W * 0.48
      box(0, 0, -2, L * 0.86, h + 2, nave, st.wall)
      gable(0, 0, h, L * 0.86, nave, nave * 0.62, st.roof)
      // трансепт и апсида
      box(L * 0.12, 0, -2, nave * 0.9, h + 2, W, st.wall)
      gable(L * 0.12, 0, h, nave * 0.9, W, nave * 0.55, st.roof, true)
      cyl(L * 0.42, 0, -2, nave * 0.5, h + 1, 10, st.wall)
      cyl(L * 0.42, 0, h - 1, nave * 0.56, nave * 0.55, 10, st.roof, 0, false)
      // контрфорсы и высокие витражи
      const n = Math.max(3, Math.floor((L * 0.6) / 5))
      for (let i = 0; i < n; i++) {
        const u = -L * 0.3 + (L * 0.52 * (i + 0.5)) / n
        for (const sd of [-1, 1]) {
          box(u + 2.2, (sd * nave) / 2 + sd * 0.8, 0, 0.9, h * 0.8, 1.7, st.stone)
          glow(u, (sd * nave) / 2, 3, 1.3, h - 7, 0.14)
        }
      }
      // две башни западного фасада со шпилями и окно-роза
      const tw = nave * 0.46, th = h * 1.75, u0 = -L * 0.43
      for (const sd of [-1, 1]) {
        box(u0, (sd * nave) / 2.4, -2, tw, th + 2, tw, st.wall)
        cyl(u0, (sd * nave) / 2.4, th, tw * 0.72, tw * 2.5, 4, st.roof, 0, false)
        box(u0, (sd * nave) / 2.4, th + tw * 2.5, 0.2, 2.2, 0.2, '#d8c070')
        glow(u0 - tw / 2, (sd * nave) / 2.4, th * 0.68, 0.14, 4, 1.3)
      }
      glow(-L * 0.43 - 0.1, 0, h * 0.58, 0.14, 4.2, 4.2)
      box(-L * 0.43 - 0.2, 0, 0, 0.2, 5.2, 3.4, st.dark)
      return base + th + tw * 2.5 + 2
    }
    case 'arena': {
      const A = L2, B = W2, n = 28, oh = 15
      const ring = (ra: number, rb: number, y0: number, y1: number, col: string, ra2 = ra, rb2 = rb): void => {
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * 6.283, a1 = ((i + 1) / n) * 6.283
          const p = (a: number, ea: number, eb: number, y: number): [number, number, number] => [X(Math.cos(a) * ea, Math.sin(a) * eb), base + y, Z(Math.cos(a) * ea, Math.sin(a) * eb)]
          P.solid.quad(p(a0, ra, rb, y0), p(a1, ra, rb, y0), p(a1, ra2, rb2, y1), p(a0, ra2, rb2, y1), col)
        }
      }
      ring(A, B, -2, oh, st.wall)
      // ярусы арок снаружи
      for (let t = 0; t < 2; t++)
        for (let i = 0; i < n; i++) {
          const a = ((i + 0.5) / n) * 6.283
          const u = Math.cos(a) * (A + 0.05), v = Math.sin(a) * (B + 0.05)
          P.solid.box(X(u, v), base + 1.2 + t * 6.8, Z(u, v), 2.4, 4.8, 0.18, st.dark, rot + Math.atan2(B * Math.cos(a), -A * Math.sin(a)))
        }
      // трибуны и песок
      ring(A, B, oh, oh, st.stone, A * 0.86, B * 0.86)
      ring(A * 0.86, B * 0.86, oh, 2, st.pillar, A * 0.42, B * 0.42)
      ring(A * 0.42, B * 0.42, 2, 0.5, st.dark)
      ring(A * 0.42, B * 0.42, 0.5, 0.5, '#d9c48e', 0.01, 0.01)
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; flag(Math.cos(a) * A * 0.96, Math.sin(a) * B * 0.96, oh, 3.5) }
      return base + oh + 3
    }
    case 'hall': {
      const h = 11
      box(0, 0, -2, L, h + 2, W * 0.72, st.wall)
      gable(0, 0, h, L, W * 0.72, 4, st.roof)
      portico(0, W * 0.36, L * 0.46, h - 1, 3)
      for (const f of [2.2, 6.6]) { windows(-L * 0.36, W * 0.36 + 0.05, f, L * 0.24, 2.2, 3); windows(L * 0.36, W * 0.36 + 0.05, f, L * 0.24, 2.2, 3); windows(0, -W * 0.36 - 0.05, f, L * 0.9, 2.2, 8) }
      // башня с часами или купол
      if (L > 26) dome(0, -W * 0.08, h + 3.6, Math.min(W * 0.24, 6), st.dark)
      else {
        box(0, -W * 0.08, h, 4, 8, 4, st.wall)
        P.glow.cyl(X(0, -W * 0.08 + 2.04), base + h + 5.6, Z(0, -W * 0.08 + 2.04), 1, 0.05, 10, '#ffffff')
        cyl(0, -W * 0.08, h + 8, 3, 3.4, 4, st.dark, 0, false)
      }
      flag(L * 0.42, 0, h + 2)
      return base + h + 12
    }
    case 'bank': {
      const h = 9.5
      box(0, 0, -2, L, h + 2, W * 0.76, st.stone)
      box(0, 0, h, L + 0.5, 0.8, W * 0.76 + 0.5, st.pillar)
      gable(0, 0, h + 0.8, L, W * 0.76, 2.4, st.dark)
      portico(0, W * 0.38, L * 0.7, h, 2.6)
      windows(0, -W * 0.38 - 0.05, 3, L * 0.8, 3.2, 5)
      for (const sd of [-1, 1]) windows((sd * L) / 2 + sd * 0.05, 0, 3, W * 0.6, 3.2, 3, false)
      return base + h + 4
    }
    case 'academy': {
      const h = 9
      box(0, -W * 0.34, -2, L, h + 2, W * 0.32, st.wall)
      gable(0, -W * 0.34, h, L, W * 0.32, 3.4, st.roof)
      for (const sd of [-1, 1]) {
        box(sd * (L2 - W * 0.13), W * 0.14, -2, W * 0.26, h + 2, W * 0.64, st.wall)
        gable(sd * (L2 - W * 0.13), W * 0.14, h, W * 0.26, W * 0.64, 3.2, st.roof, true)
        windows(sd * (L2 - W * 0.26) - sd * 0.05, W * 0.14, 2.4, W * 0.5, 2.4, 4, false)
        windows(sd * (L2 - W * 0.26) - sd * 0.05, W * 0.14, 6.2, W * 0.5, 2, 4, false)
      }
      windows(0, -W * 0.18 + 0.05, 2.4, L * 0.46, 2.4, 6)
      windows(0, -W * 0.18 + 0.05, 6.2, L * 0.46, 2, 6)
      box(0, -W * 0.34, h, 5, 9, 5, st.wall)
      cyl(0, -W * 0.34, h + 9, 3.6, 5.5, 4, st.roof, 0, false)
      // двор: деревце и колодец
      cyl(0, W * 0.15, 0, 0.3, 2.2, 6, st.timber)
      cyl(0, W * 0.15, 2.2, 2.2, 3.4, 8, '#4f8038', 0.6)
      return base + h + 15
    }
    case 'fort': {
      const h = 6.5, col = st.stone
      for (const sd of [-1, 1]) {
        box(0, sd * W2, -2, L, h + 2, 1.5, col)
        box(sd * L2, 0, -2, 1.5, h + 2, W, col)
        merlons(0, sd * W2, h, L, 0.1, col)
      }
      for (const a of [-1, 1]) for (const b of [-1, 1]) roundTower(a * L2, b * W2, 0, 2.6, h + 3, col)
      // ворота и ряды бараков внутри
      box(0, W2 + 0.1, 0, 4.4, 4.4, 1.7, st.dark)
      const rows = Math.max(2, Math.floor(W / 10))
      for (let i = 0; i < rows; i++) {
        const v = -W2 + (W * (i + 0.6)) / (rows + 0.4)
        if (Math.abs(v - W2) < 8) continue
        box(-L * 0.14, v, -1, L * 0.5, 4.2, 4.6, st.wall)
        gable(-L * 0.14, v, 3.2, L * 0.5, 4.6, 1.8, st.roof)
      }
      box(L * 0.32, -W * 0.18, -1, L * 0.2, 9, L * 0.2, col)
      merlons(L * 0.32, -W * 0.18, 8, L * 0.2, L * 0.2, col)
      flag(L * 0.32, -W * 0.18, 9, 6)
      return base + 16
    }
    case 'castle': {
      const h = 9.5, col = st.wall
      for (const sd of [-1, 1]) {
        box(0, sd * W2, -2, L, h + 2, 2.4, col)
        box(sd * L2, 0, -2, 2.4, h + 2, W, col)
        merlons(0, sd * W2, h, L, 0.6, col)
        merlons(sd * L2, 0, h, 0.6, W, col)
      }
      for (const a of [-1, 1]) for (const b of [-1, 1]) roundTower(a * L2, b * W2, 0, 4, h + 5, col, b < 0 ? st.dark : undefined)
      box(0, W2 + 0.2, 0, 5, 5.5, 2.8, st.dark)
      roundTower(-4.2, W2, 0, 3, h + 3, col)
      roundTower(4.2, W2, 0, 3, h + 3, col)
      // большая башня-донжон и дворец
      const kh = h * 2.6, ks = Math.min(L, W) * 0.36
      box(-L * 0.08, -W * 0.08, -2, ks, kh + 2, ks, col)
      merlons(-L * 0.08, -W * 0.08, kh, ks, ks, col)
      for (const a of [-1, 1]) for (const b of [-1, 1]) roundTower(-L * 0.08 + (a * ks) / 2, -W * 0.08 + (b * ks) / 2, 0, 2.2, kh + 3, col, st.dark)
      for (let f = 0; f < 4; f++) for (const sd of [-1, 1]) glow(-L * 0.08 + (sd * ks) / 4, -W * 0.08 + ks / 2 + 0.05, 4 + f * 6, 0.9, 2, 0.12)
      box(L * 0.27, W * 0.1, -1, L * 0.3, h, W * 0.42, col)
      gable(L * 0.27, W * 0.1, h - 1, L * 0.3, W * 0.42, 4, st.dark, true)
      flag(-L * 0.08, -W * 0.08, kh + 1, 7)
      return base + kh + 8
    }
    case 'warehouse': {
      const h = 6
      box(0, 0, -2, L, h + 2, W, st.wall)
      gable(0, 0, h, L, W, 3, st.roof)
      const n = Math.max(2, Math.floor(L / 8))
      for (let i = 0; i < n; i++) {
        const u = -L2 + (L * (i + 0.5)) / n
        box(u, W2 + 0.05, 0, 3.2, 3.7, 0.15, st.timber)
        box(u, W2 + 0.1, 3.7, 3.6, 0.3, 0.2, st.dark)
        crate(u + 2.6, W2 + 1.3)
        if (i % 2) crate(u - 2.5, W2 + 1.2)
      }
      return base + h + 3.2
    }
    case 'shipyard': {
      // навес на столбах и корабль на стапеле
      const h = 8
      for (let i = 0; i <= 6; i++) for (const sd of [-1, 1]) box(-L2 + (L * i) / 6, (sd * W2) * 0.86, 0, 0.4, h, 0.4, st.timber)
      gable(0, 0, h, L, W, 3.4, st.roof)
      const hull = st.timber
      box(0, 0, 1.1, L * 0.66, 1.9, W * 0.34, hull)
      box(0, 0, 3, L * 0.54, 0.9, W * 0.26, '#6a4a2c')
      cyl(L * 0.36, 0, 1.2, W * 0.17, 2.5, 3, hull, 0.05)
      box(-L * 0.33, 0, 2.6, 2, 2.2, W * 0.3, hull)
      box(0, 0, 3.8, 0.35, 9, 0.35, st.timber)
      for (let i = 0; i < 6; i++) box(-L2 + 2 + i * 1.6, W2 - 0.2, 0, 1.3, 0.45, 2.4, '#8a6a42')
      return base + h + 4
    }
    case 'factory': {
      const h = 7.5
      box(0, 0, -2, L, h + 2, W, st.wall)
      const n = Math.max(2, Math.floor(L / 7))
      // пилообразная крыша цеха
      for (let i = 0; i < n; i++) gable(-L2 + (L * (i + 0.5)) / n, 0, h, L / n, W, 2.6, st.roof, true)
      windows(0, W2 + 0.05, 2.4, L * 0.9, 3, n * 2)
      for (const [u, v] of [[-L * 0.36, -W * 0.28], [L * 0.32, -W * 0.3]]) {
        cyl(u, v, 0, 1.2, h + 11, 9, st.dark, 0.8)
        out.smoke.push([X(u, v), base + h + 11.5, Z(u, v)])
      }
      crate(-L2 + 1.6, W2 + 1.3)
      crate(L2 - 1.6, W2 + 1.3)
      return base + h + 12
    }
    case 'lighthouse': {
      const r = Math.min(L, W) * 0.4, h = 26
      cyl(0, 0, -2, r * 1.5, 3.4, 12, st.stone)
      cyl(0, 0, 1.4, r, h, 12, st.wall, r * 0.62)
      for (let t = 0; t < 3; t++) cyl(0, 0, 5 + t * 7, r * (0.94 - t * 0.11) + 0.05, 1.6, 12, st.banner, r * (0.9 - t * 0.11) + 0.05, false)
      cyl(0, 0, h + 1.4, r * 0.82, 0.5, 12, st.dark)
      P.glow.cyl(X(0, 0), base + h + 1.9, Z(0, 0), r * 0.5, 2.4, 10, '#ffffff')
      cyl(0, 0, h + 4.3, r * 0.74, 2.4, 10, st.dark, 0, false)
      out.beacon.push([X(0, 0), base + h + 3, Z(0, 0)])
      return base + h + 7
    }
    case 'belltower': {
      const w = Math.min(L, W) * 0.78, h = 22
      box(0, 0, -2, w, h + 2, w, st.stone)
      for (let i = -1; i <= 1; i += 2) { box((i * w) / 2 - i * 0.3, (i * w) / 2 - i * 0.3, h, 0.6, 4, 0.6, st.stone); box((i * w) / 2 - i * 0.3, (-i * w) / 2 + i * 0.3, h, 0.6, 4, 0.6, st.stone) }
      cyl(0, 0, h + 0.4, 0.9, 1.8, 8, '#a8863c', 0.45)
      box(0, 0, h + 4, w + 0.6, 0.4, w + 0.6, st.stone)
      cyl(0, 0, h + 4.4, w * 0.72, w * 1.2, 4, st.dark, 0, false)
      glow(0, w / 2 + 0.05, h * 0.6, 0.8, 1.8, 0.12)
      return base + h + 4.4 + w * 1.2
    }
    case 'darktower': {
      // глухая башня без окон: только узкая щель наверху
      const w = Math.min(L, W) * 0.82, h = 30
      box(0, 0, -2, w, h + 2, w, st.dark)
      box(0, 0, h, w + 1.2, 1.2, w + 1.2, st.dark)
      merlons(0, 0, h + 1.2, w + 1, w + 1, st.dark)
      for (const a of [-1, 1]) for (const b of [-1, 1]) box((a * w) / 2, (b * w) / 2, 0, 1.5, h - 2, 1.5, st.stone)
      glow(0, w / 2 + 0.05, h - 4, w * 0.6, 0.28, 0.14)
      box(0, w / 2 + 0.05, 0, 2.6, 3.6, 0.14, '#111')
      return base + h + 3
    }
  }
}
