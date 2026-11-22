import * as THREE from 'three'
import { buildStreets, type Streets } from './city3dStreets'
import { buildMonument, MON_SIZE, monumentKind, type MonKind, type MonOut, type MonStyle } from './city3dMonuments'
import { createLife, type PersonInfo, type Speech } from './city3dLife'
import type { Race } from './city3dRaces'
import { populationFor } from './city3dRaces'

/**
 * 3D-вид поселения: всё собирается из плана города (контуры зданий, улицы, стены, реки, поля) прямо в браузере.
 * Дом — настоящий контур здания с плана, поднятый в стены с двускатной крышей; земля — холст, на котором нарисованы
 * улицы и поля и который лежит на сетке высот. Облик зависит от государства (STYLES), всё детерминировано по имени карты.
 */

export interface PlanLine { r: number[]; w: number }
export interface PlanScene {
  s: number
  style: string
  forest: number
  hills?: number
  rocky?: number
  tower: number
  roof?: string[]
  droof: (string[] | null)[]
  citadel: number
  dist: number[][]
  water: number[][]
  fields: number[][]
  greens: number[][]
  squares: number[][]
  walls: PlanLine[]
  roads: PlanLine[]
  rivers: PlanLine[]
  planks: PlanLine[]
  /** мосты: ось (с заездом на оба берега) и ширина; где дорога переходит реку */
  bridges?: PlanLine[]
  /** контур суши (как на 2D-плане): всё вне него — море; нет поля — суша на весь кадр */
  earth?: number[]
}
export interface CityPlan {
  w: number
  h: number
  districts: { name: string; x: number; y: number }[]
  buildings: number[][]
  landmarks?: { b: number; name: string }[]
  scene?: PlanScene
}

export interface Style {
  plaster: string[]
  roof: string[]
  timber: string
  stone: string
  wall: string
  shutter: string[]
  pitch: number
  framed: boolean
  floors: number
  grass: string
  grass2: string
  dirt: string
  pave: string
  lit: number
  conifer: number
  tower: string
}
export const STYLES: Record<string, Style> = {
  // Земли Севера: тёмное смолёное дерево, дерновые крыши, крутые скаты, крашеные ставни, ели
  norse: { plaster: ['#5a4232', '#4e3a2c', '#634a38', '#463427', '#6b5240'], roof: ['#5b7340', '#4f6638', '#66784a', '#6d6a4a', '#4a5a36', '#5a4a36'], timber: '#2a1e16', stone: '#6e6c66', wall: '#5a4a3a', shutter: ['#7a2a22', '#2f4a6a', '#3a5a3a'], pitch: 1.3, framed: false, floors: 0, grass: '#6a7f4e', grass2: '#748a56', dirt: '#8a7a5e', pave: '#7f7668', lit: 0.32, conifer: 0.9, tower: '#3a2e26' },
  // Креит: всё из дерева — бревенчатые стены, тёмный смолёный гонт, крутые крыши почти до земли, драконьи коньки, частокол
  viking: { plaster: ['#4a3626', '#553e2b', '#3f2e20', '#5c4430', '#47331f'], roof: ['#3a2e24', '#43352a', '#2f2620', '#4a3a2c', '#383028'], timber: '#1e140e', stone: '#5e5a54', wall: '#4a3828', shutter: ['#1e140e'], pitch: 1.7, framed: false, floors: 0, grass: '#5f7448', grass2: '#6a7e50', dirt: '#7a6a52', pave: '#6e6558', lit: 0.22, conifer: 0.95, tower: '#2e2219' },
  // Имперские изгнанники: серый северный камень, тёмно-алые и сланцевые крыши под снег, крутые скаты
  exile: { plaster: ['#b8b4aa', '#a9a59a', '#c4c0b6', '#9d998e'], roof: ['#5a2626', '#4a2222', '#3f3d44', '#6a2c2a', '#47434a'], timber: '#2e2420', stone: '#76726a', wall: '#8a867c', shutter: ['#5a1414', '#2e2a28'], pitch: 1.25, framed: false, floors: 0, grass: '#6a7a52', grass2: '#74845a', dirt: '#9a8f74', pave: '#8f897a', lit: 0.3, conifer: 0.9, tower: '#3e2a2a' },
  // Фарвольская лига, дварфы: серый гранит, плоские каменные крыши, горны; deep — то же под сводом пещеры
  dwarf: { plaster: ['#8d8579', '#7d766c', '#9a9184', '#867c6e'], roof: ['#5b5550', '#4f4a45', '#625a52', '#56504a'], timber: '#3a2e24', stone: '#6a645c', wall: '#7a746a', shutter: ['#3b3633'], pitch: 0.5, framed: false, floors: 0, grass: '#6a7454', grass2: '#737c5a', dirt: '#8a8070', pave: '#7a756c', lit: 0.45, conifer: 0.95, tower: '#4a4440' },
  // Высокогорное Княжество: альпийские дома — белёный камень внизу, тёмное дерево наверху, широкие крыши из тёмного гонта;
  // kranz — то же на каменной платформе вокруг вершины (Венец), alpine — замки и городки людей ниже
  // Княжества Гарефорда: горный фахверк — белёная штукатурка, тёмный дуб, крутые сланцевые и красно-бурые крыши, медно-зелёные шпили
  bezd: { plaster: ['#6a6670', '#5a5660', '#7a7680', '#4e4a58', '#867f8a'], roof: ['#2a2630', '#34303c', '#1e1a26', '#3e3a48', '#4a3844'], timber: '#2a2024', stone: '#5a5660', wall: '#6a6670', shutter: ['#6a3a4a', '#2a2a3a', '#4a3a2a'], pitch: 1.05, framed: false, floors: 1, grass: '#6a7a62', grass2: '#788870', dirt: '#7a7068', pave: '#6a6870', lit: 0.4, conifer: 0.5, tower: '#c8788a' },
  ntow: { plaster: ['#8e8e98', '#7e7e88', '#9a9aa4', '#6e6e7a', '#a4a4ae'], roof: ['#3a3a52', '#2e2e44', '#464660', '#2a2a3c', '#52526a'], timber: '#2a2a32', stone: '#7a7a84', wall: '#868690', shutter: ['#4a4a7a', '#7a7aa8', '#2e2e44'], pitch: 1.3, framed: false, floors: 2, grass: '#7a8a78', grass2: '#8a9a86', dirt: '#8a8478', pave: '#82828c', lit: 0.6, conifer: 0.8, tower: '#c8c8e8' },
  gren: { plaster: ['#e8e2d6', '#d8d0c0', '#c8c4bc', '#dcd4c4', '#b8b4ac'], roof: ['#3a4a5a', '#2e3a48', '#5a4a3a', '#4a5a5a', '#7a3a2e'], timber: '#2e2a26', stone: '#8a8c8e', wall: '#94968e', shutter: ['#3a6ac8', '#c83a3a', '#3a9a4a', '#d8b83a'], pitch: 1.0, framed: false, floors: 2, grass: '#7a8a6a', grass2: '#8a9a72', dirt: '#948c7c', pave: '#8a8c8a', lit: 0.5, conifer: 0.75, tower: '#c83a3a' },
  uuna: { plaster: ['#c8c0b0', '#b8b0a0', '#d4ccbc', '#a8a090', '#c0b8a4'], roof: ['#3a3e48', '#44474f', '#2e3038', '#4a4440', '#5a3a30'], timber: '#3a3028', stone: '#8a8680', wall: '#9a948a', shutter: ['#1f3a6a', '#5a2a4a', '#3a5a2a'], pitch: 1.2, framed: false, floors: 2, grass: '#7a8a68', grass2: '#8a9874', dirt: '#948a78', pave: '#8c8880', lit: 0.55, conifer: 0.85, tower: '#1f3a6a' },
  olek: { plaster: ['#8a6a48', '#7a5c3e', '#94724e', '#6e5236', '#a07c56'], roof: ['#3a3430', '#4a4038', '#2e2a28', '#5a4a3a', '#6a2a26'], timber: '#3a2818', stone: '#8a8a88', wall: '#7a7470', shutter: ['#c8303a', '#e8dcc0', '#3a5a6a'], pitch: 1.35, framed: false, floors: 1, grass: '#8a9a78', grass2: '#a8b49a', dirt: '#9a9080', pave: '#8e8a84', lit: 0.5, conifer: 0.95, tower: '#c8303a' },
  harn: { plaster: ['#efe6d2', '#e4d6bc', '#f2eadb', '#d9c9ae', '#e8dcc4'], roof: ['#7a2a26', '#6a2622', '#4a4650', '#5a2a22', '#8a3a2e'], timber: '#2a1c12', stone: '#8a867c', wall: '#a29c90', shutter: ['#c03538', '#2a4a7a', '#2f5a3a'], pitch: 1.1, framed: true, floors: 2, grass: '#6a8a48', grass2: '#789850', dirt: '#988666', pave: '#9c9688', lit: 0.45, conifer: 0.7, tower: '#c03538' },
  garef: { plaster: ['#f1ece0', '#e8dfcc', '#f4efe4', '#ddd3bf', '#ece4d2'], roof: ['#4a4650', '#3e3a44', '#7a3a2a', '#5a4a40', '#6a3226'], timber: '#2f2014', stone: '#8c8a82', wall: '#a6a298', shutter: ['#2f5a3a', '#7a2a22', '#c8a040'], pitch: 1.05, framed: true, floors: 1, grass: '#6a8c4a', grass2: '#76984f', dirt: '#9a8a68', pave: '#9e988a', lit: 0.45, conifer: 0.8, tower: '#4f8a74' },
  // Королевство Темерия: средневековый имперский фахверк — белёные стены на каменных низах, зелёные и тёмно-красные крыши
  temer: { plaster: ['#f0e8d4', '#e6dcc0', '#f4ecdc', '#dccfb0', '#ece2c8'], roof: ['#3f6a4a', '#2f5a3c', '#6a2a22', '#7a3328', '#4a5a3a'], timber: '#3a2614', stone: '#8f8a7c', wall: '#a8a496', shutter: ['#2f5a3a', '#7a2a22', '#c8a040'], pitch: 0.98, framed: true, floors: 1, grass: '#6f9a4a', grass2: '#7aa650', dirt: '#b09a72', pave: '#a8a08a', lit: 0.45, conifer: 0.5, tower: '#3f7a54' },
  // Протекторат Лирия: римская Эллирия — кремовый мрамор и штукатурка, терракотовые крыши с низким скатом, колоннады
  lyria: { plaster: ['#f4eadb', '#ecdcc4', '#f6eee0', '#e0cfb4', '#efe2cc'], roof: ['#b5553a', '#a64a30', '#c2623f', '#9a4430', '#b85c3c'], timber: '#6a5a4a', stone: '#cfc6b4', wall: '#c4bba8', shutter: ['#7a3b2e', '#3f5a6a', '#8a6a2e'], pitch: 0.5, framed: false, floors: 1, grass: '#7a9a4e', grass2: '#86a458', dirt: '#bda884', pave: '#cfc4ac', lit: 0.45, conifer: 0.15, tower: '#b5553a' },
  // Когалым: деревенская коммуна — белёные срубы под тёплой соломой, крутой скат, потемневший дуб
  kulag: { plaster: ['#e8e2d4', '#dcd4c0', '#f0ebdd', '#d4c8b0', '#e2dac6'], roof: ['#a8452f', '#9a3c28', '#b4503a', '#8a3424', '#6a2c20'], timber: '#2e2a26', stone: '#8a8478', wall: '#a8503a', shutter: ['#2a4a6a', '#3a5a3a', '#8a3a2a'], pitch: 1.15, framed: true, floors: 2, grass: '#6a9a48', grass2: '#76a652', dirt: '#9a8a64', pave: '#8e8672', lit: 0.4, conifer: 0.1, tower: '#8a3a28' },
  kogal: { plaster: ['#ece0c8', '#e0d2b4', '#f0e6d0', '#d8c8a8', '#e6d8bc'], roof: ['#b89a52', '#a88c48', '#c4a860', '#9a7e40', '#6a4a30'], timber: '#4a3420', stone: '#9a9484', wall: '#b0a890', shutter: ['#2f5a3a', '#8a6a2e', '#6a4a2a'], pitch: 1.1, framed: true, floors: 1, grass: '#74a04a', grass2: '#80aa52', dirt: '#a89268', pave: '#a09478', lit: 0.4, conifer: 0.4, tower: '#7a5a3a' },
  // Эльфборн: светлое дерево и белый камень, серебристо-зелёные крутые крыши, арки, много лиственных крон
  silva: { plaster: ['#8a6a3a', '#7a5a30', '#9a7a44', '#6a4a2c', '#8a7a50'], roof: ['#4f7a34', '#5a8a3a', '#3f6a2e', '#6a9a3e', '#5a7a3a'], timber: '#6a4a2c', stone: '#8a7a5a', wall: '#7a5a3a', shutter: ['#7a8a3a', '#a86a3a', '#8a6a3a'], pitch: 1.4, framed: false, floors: 1, grass: '#4f7a34', grass2: '#5f8a3e', dirt: '#6a5a3a', pave: '#8a7a56', lit: 0.5, conifer: 0.35, tower: '#6a4a2c' },
  elf: { plaster: ['#eef0e4', '#e4ead8', '#f3f0e2', '#dfe6d4', '#e9ecdc'], roof: ['#5a8068', '#4a7470', '#6a8a5a', '#7a9a86', '#8aa0a0'], timber: '#b59a6a', stone: '#c8c6b8', wall: '#d6d4c6', shutter: ['#5d7f5a', '#4a6a70', '#b59a6a'], pitch: 1.4, framed: false, floors: 1, grass: '#6e9a52', grass2: '#7aa65a', dirt: '#a09272', pave: '#cfcbbc', lit: 0.42, conifer: 0.25, tower: '#5a8a7a' },
  alpine: { plaster: ['#efe9dc', '#e6dccb', '#f3eee4', '#d9cfbd', '#e9e1d0'], roof: ['#4a3426', '#5a3e2c', '#3f2c20', '#6a4a34', '#46434a'], timber: '#3a2416', stone: '#8a877e', wall: '#a8a49a', shutter: ['#2f5a3a', '#8a2a22', '#2a4a6a'], pitch: 0.82, framed: true, floors: 1, grass: '#6f8f4e', grass2: '#7a9a56', dirt: '#9a8a6a', pave: '#9a958a', lit: 0.4, conifer: 1, tower: '#3f4a5a' },
  kranz: { plaster: ['#f4f0e8', '#ebe5d8', '#f7f4ee', '#e2dacb', '#efe8da'], roof: ['#4a3426', '#5a3e2c', '#3f2c20', '#3a3a42', '#46434a'], timber: '#3a2416', stone: '#a9a598', wall: '#c8c3b6', shutter: ['#2f5a3a', '#8a2a22', '#2a4a6a'], pitch: 0.82, framed: true, floors: 1, grass: '#a6a294', grass2: '#b0ac9e', dirt: '#b8b2a2', pave: '#c4bfb2', lit: 0.4, conifer: 1, tower: '#2a3a5a' },
  // Республика Чеафарал: имперский фахверк на нордской земле — светлая штукатурка, тёмные нордские крыши, серый камень
  chea: { plaster: ['#e6dcc4', '#d8cdb0', '#ece3cf', '#cfc4a8'], roof: ['#4a3a2e', '#3f3228', '#55453a', '#394048', '#4a4f54'], timber: '#3a2a1e', stone: '#7e7a72', wall: '#9c978a', shutter: ['#2f4a6a', '#6a2a22', '#3a5a3a'], pitch: 1.1, framed: true, floors: 0, grass: '#6a8348', grass2: '#748d50', dirt: '#a8997a', pave: '#a09886', lit: 0.36, conifer: 0.7, tower: '#3a3f58' },
  // Крайдонианская Лига: береговой город элеонов — светлый известняк, сине-голубые крыши, тёмное дерево у воды
  cray: { plaster: ['#efe9d8', '#e4ddc8', '#f3eee0', '#d9d2bc', '#e9e3d0'], roof: ['#2f4a78', '#3a5a8a', '#27405f', '#4a6a96', '#5a4a3a'], timber: '#3a2a1e', stone: '#9a968a', wall: '#b5b0a2', shutter: ['#1f3a6a', '#2f6a7a', '#6a2a22'], pitch: 0.9, framed: false, floors: 1, grass: '#7a9a56', grass2: '#86a45e', dirt: '#b8a888', pave: '#bdb7a6', lit: 0.4, conifer: 0.3, tower: '#2f4a78' },
  deep: { plaster: ['#7d766c', '#8a8276', '#70695f', '#958c7e'], roof: ['#4f4a45', '#5b5149', '#463f3a'], timber: '#3a2e24', stone: '#5e5850', wall: '#6a645a', shutter: ['#3b3633'], pitch: 0.5, framed: false, floors: 0, grass: '#4a4a3c', grass2: '#525040', dirt: '#5a5246', pave: '#6a645a', lit: 0.75, conifer: 0, tower: '#3a3532' },
  // гномы: пёстрая штукатурка, медные и позеленевшие крыши, высокие узкие дома с башенками
  gnome: { plaster: ['#d9c27a', '#c97a5a', '#7aa3a0', '#e0d0b0', '#b8c9a0', '#d99a6a', '#c9b0d0'], roof: ['#4f8a78', '#5a9a86', '#a8552f', '#3f6a8a', '#8a3a3a', '#b8783a'], timber: '#4a3222', stone: '#8f8a7e', wall: '#a9a394', shutter: ['#2f5a6a', '#8a3a2a', '#d8b040'], pitch: 1.4, framed: false, floors: 1, grass: '#7a9a4c', grass2: '#86a654', dirt: '#b0a07a', pave: '#a89c80', lit: 0.5, conifer: 0.7, tower: '#4f8a78' },
  empire: { plaster: ['#e9dcc0', '#dccca8', '#efe5cf', '#d8c9a6'], roof: ['#a8452f', '#9c3f2c', '#b4553a', '#8f3a2a', '#a04a30', '#6d7d3c'], timber: '#4a3222', stone: '#8f8a7e', wall: '#a9a394', shutter: ['#3f6a4a', '#2f5570', '#7a3b2e'], pitch: 0.95, framed: true, floors: 0, grass: '#6f9b46', grass2: '#7fa84f', dirt: '#b9a57c', pave: '#b1a384', lit: 0.4, conifer: 0.3, tower: '#5c5a78' },
  argus: { plaster: ['#c9c2b0', '#bdb6a4', '#d3ccba', '#b2ab99'], roof: ['#7c3b2e', '#6d3a30', '#874536', '#5d4a3e'], timber: '#33261d', stone: '#7a766c', wall: '#8c867a', shutter: ['#3a3a3a', '#4a3226'], pitch: 0.9, framed: false, floors: 0, grass: '#6a8d47', grass2: '#789a50', dirt: '#a8976f', pave: '#9c9078', lit: 0.3, conifer: 0.35, tower: '#4b4b58' },
  styria: { plaster: ['#8a858f', '#7b7682', '#96919b', '#6f6b76'], roof: ['#3f3d44', '#4a4650', '#38363e', '#524d55', '#45424a'], timber: '#1e1a20', stone: '#3b3840', wall: '#4a4750', shutter: ['#221d22', '#2d2528'], pitch: 1.35, framed: true, floors: 1, grass: '#55683f', grass2: '#4d5e3c', dirt: '#6f675a', pave: '#5b5650', lit: 0.24, conifer: 0.85, tower: '#26222c' },
  church: { plaster: ['#efe9dc', '#e6dfd0', '#f4efe5', '#dcd4c2'], roof: ['#56677f', '#4d5e78', '#64768c', '#d9d3c5'], timber: '#6a6258', stone: '#c9c4b8', wall: '#ddd6c6', shutter: ['#3f5f86', '#2f4a70'], pitch: 0.5, framed: false, floors: 0, grass: '#7aa552', grass2: '#88b05a', dirt: '#d3c8ac', pave: '#ddd4c0', lit: 0.4, conifer: 0.15, tower: '#465a7d' },
  south: { plaster: ['#e8cfa0', '#e6bd8c', '#efdcb8', '#d9a878'], roof: ['#c4683c', '#b85c34', '#cf7446', '#ad5530'], timber: '#6b4a30', stone: '#b7a888', wall: '#c9b48c', shutter: ['#2f6f6a', '#3f7a4a', '#8a4a2a'], pitch: 0.42, framed: false, floors: 0, grass: '#8fa055', grass2: '#a0a95f', dirt: '#cdb488', pave: '#d8c4a0', lit: 0.45, conifer: 0.5, tower: '#a8552f' },
  kalt: { plaster: ['#a3a184', '#8f8d72', '#b0ae90', '#8a8a6c'], roof: ['#5d6b3a', '#6b7344', '#54603a', '#7a6a42'], timber: '#3e3524', stone: '#7d7b68', wall: '#7d7b68', shutter: ['#3e3524', '#4a4a30'], pitch: 0.3, framed: false, floors: 0, grass: '#7b8a4a', grass2: '#8a9452', dirt: '#b3a177', pave: '#a39878', lit: 0.3, conifer: 0.4, tower: '#46503a' }
}

// ---------- сборка геометрии: плоские грани, цвет в вершинах ----------
type V3 = [number, number, number]
const colors = new Map<string, THREE.Color>()
const C = (hex: string): THREE.Color => {
  let c = colors.get(hex)
  if (!c) colors.set(hex, (c = new THREE.Color(hex)))
  return c
}
export class Bucket {
  p: number[] = []
  c: number[] = []
  uv: number[] = []
  tri(a: V3, b: V3, d: V3, col: string, k = 1, uva?: number[]): void {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2])
    const q = C(col)
    for (let i = 0; i < 3; i++) this.c.push(q.r * k, q.g * k, q.b * k)
    // uv держим ровно по вершинам: иначе одна коробка без uv в слое черепицы сдвигает фактуру всех следующих крыш
    if (uva) {
      const need = (this.p.length / 3 - 3) * 2
      while (this.uv.length < need) this.uv.push(0, 0)
      this.uv.push(...uva)
    } else if (this.uv.length) this.uv.push(a[0] / 2.4, a[2] / 2.4, b[0] / 2.4, b[2] / 2.4, d[0] / 2.4, d[2] / 2.4)
  }
  quad(a: V3, b: V3, d: V3, e: V3, col: string, k = 1): void {
    this.tri(a, b, d, col, k)
    this.tri(a, d, e, col, k)
  }
  /** Коробка: x,z — центр, y — низ, поворот rot вокруг вертикали */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, col: string, rot = 0): void {
    const co = Math.cos(rot) / 2, si = Math.sin(rot) / 2
    const P = (u: number, v: number, h: number): V3 => [x + u * sx * co - v * sz * si, y + h * sy, z + u * sx * si + v * sz * co]
    const a = P(-1, -1, 0), b = P(1, -1, 0), d = P(1, 1, 0), e = P(-1, 1, 0), f = P(-1, -1, 1), g = P(1, -1, 1), h = P(1, 1, 1), i = P(-1, 1, 1)
    this.quad(a, b, g, f, col, 0.92)
    this.quad(b, d, h, g, col, 1)
    this.quad(d, e, i, h, col, 0.92)
    this.quad(e, a, f, i, col, 1)
    this.quad(f, g, h, i, col, 1.05)
  }
  /** Тело вращения (r2 = 0 — конус, n = 4 — пирамида) */
  cyl(x: number, y: number, z: number, r: number, h: number, n: number, col: string, r2 = r, cap = true, rot = 0): void {
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2
      const A: V3 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], B: V3 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r]
      const D: V3 = [x + Math.cos(a1) * r2, y + h, z + Math.sin(a1) * r2], E: V3 = [x + Math.cos(a0) * r2, y + h, z + Math.sin(a0) * r2]
      if (r2 > 0) this.quad(A, B, D, E, col)
      else this.tri(A, B, D, col)
      if (cap && r2 > 0) this.tri([x, y + h, z], E, D, col, 1.05)
    }
  }
  geometry(): THREE.BufferGeometry | null {
    if (!this.p.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    while (this.uv.length && this.uv.length < (this.p.length / 3) * 2) this.uv.push(0, 0)
    if (this.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.computeVertexNormals()
    return g
  }
}

const hashOf = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const rng = (seed: number) => (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const mixHex = (a: string, b: string, t: number): string => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()

function noise2(seed: number): (x: number, y: number) => number {
  const P = new Uint8Array(512), R = rng(seed), V = new Float32Array(256)
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = R() }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i]
  const at = (x: number, y: number): number => V[P[(P[x & 255] + y) & 255]]
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
    return at(xi, yi) * (1 - u) * (1 - v) + at(xi + 1, yi) * u * (1 - v) + at(xi, yi + 1) * (1 - u) * v + at(xi + 1, yi + 1) * u * v
  }
}

type P2 = [number, number]
export const ringOf = (flat: number[], k: number, from = 0): P2[] => {
  const out: P2[] = []
  for (let i = from; i + 1 < flat.length; i += 2) out.push([flat[i] / k, flat[i + 1] / k])
  return out
}
export const areaOf = (r: P2[]): number => r.reduce((s, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return s + x * v - u * y }, 0) / 2
export const centerOf = (r: P2[]): P2 => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1] } return [x / r.length, y / r.length] }

/** Отрезать часть контура по прямой v = 0: оставить sign·v ≥ 0 (контур в координатах u, v) */
function clipHalf(r: P2[], sign: number): P2[] {
  const out: P2[] = []
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length]
    const da = a[1] * sign, db = b[1] * sign
    if (da >= 0) out.push(a)
    if (da > 0 !== db > 0 && da !== db) {
      const t = da / (da - db)
      out.push([a[0] + (b[0] - a[0]) * t, 0])
    }
  }
  return out
}
/** Контур наружу (свес крыши); на острых углах сдвиг ограничен */
function grow(r: P2[], d: number): P2[] {
  const o = areaOf(r) > 0 ? 1 : -1
  return r.map((p, i) => {
    const a = r[(i + r.length - 1) % r.length], b = r[(i + 1) % r.length]
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, l2 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1
    const n1: P2 = [((p[1] - a[1]) / l1) * o, (-(p[0] - a[0]) / l1) * o], n2: P2 = [((b[1] - p[1]) / l2) * o, (-(b[0] - p[0]) / l2) * o]
    const m: P2 = [n1[0] + n2[0], n1[1] + n2[1]]
    const ml = Math.hypot(m[0], m[1]) || 1
    const k = Math.min(1.6, 1 / Math.max(0.35, (m[0] * n1[0] + m[1] * n1[1]) / ml))
    return [p[0] + (m[0] / ml) * d * k, p[1] + (m[1] / ml) * d * k]
  })
}

function tileTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const R = rng(17)
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 8; col++) {
      const v = 205 + Math.floor(R() * 50)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(col * 16 + (row % 2) * 8, row * 16, 16, 16)
      g.fillStyle = 'rgba(0,0,0,.34)'
      g.fillRect(col * 16 + (row % 2) * 8, row * 16, 1.2, 16)
    }
  g.fillStyle = 'rgba(0,0,0,.42)'
  for (let row = 0; row < 8; row++) g.fillRect(0, row * 16, 128, 2)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function softDot(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  d.addColorStop(0, 'rgba(255,255,255,1)')
  d.addColorStop(0.35, 'rgba(255,255,255,.45)')
  d.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = d
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export interface CityWorld {
  scene: THREE.Scene
  sun: THREE.DirectionalLight
  center: P2
  radius: number
  /** Ширина и высота плана в метрах — для мини-карты */
  size: P2
  /** Метров на единицу плана */
  k: number
  heightAt: (x: number, z: number) => number
  /** Можно ли стоять в этой точке (и на какой высоте настил) */
  walkable: (x: number, z: number) => boolean
  deckAt: (x: number, z: number) => number | null
  floorAt: (x: number, z: number, y: number) => number | null
  pick: (o: THREE.Vector3, d: THREE.Vector3) => number | null
  buildingTop: (i: number) => [number, number, number] | null
  spawn: () => P2
  setTime: (hour: number, focus: THREE.Vector3) => void
  /** Экспозиция кадра для текущего времени суток */
  exposure: () => number
  tick: (dt: number, t: number, cam: THREE.Camera) => void
  /** Достроились детали: нужно обновить тени */
  takeDirty: () => boolean
  setLabels: (on: boolean) => void
  /** Подписи и метки: все места на этой карте, в том числе созданные автором */
  setPlaces: (list: CityPlace[]) => void
  setMarks: (on: boolean) => void
  /** Подсветка здания при наведении и выборе */
  setHighlight: (hover: number | null, selected: number | null) => void
  pickPerson: (o: THREE.Vector3, d: THREE.Vector3) => PersonInfo | null
  /** Тап/клик по воротам: открыть или закрыть их вручную. true — луч попал в ворота */
  toggleGate: (o: THREE.Vector3, d: THREE.Vector3) => boolean
  /** Кто из жителей впереди заговаривает (реплика и точка над головой) */
  speak: (o: THREE.Vector3, d: THREE.Vector3, range: number, t: number) => Speech | null
  census: { race: Race; count: number }[]
  dispose: () => void
}

export interface CityPlace { id: string; name: string; x: number; y: number; building?: number | null }

export function buildCity(plan: CityPlan, seedName: string, opts: { mobile: boolean; maxTexture: number; places: CityPlace[]; state: string; culture: string; gov?: string }): CityWorld {
  const S: PlanScene = plan.scene ?? { s: 1, style: 'empire', forest: 0.1, tower: 7.6, droof: [], citadel: -1, dist: [], water: [], fields: [], greens: [], squares: [], walls: [], roads: [], rivers: [], planks: [] }
  if (S.style === 'silva') S.forest = Math.max(S.forest, 0.45)
  const st = STYLES[S.style] ?? STYLES.empire
  const R = rng(hashOf(seedName) + 1)

  // единицы генератора Watabou — не метры: подбираем масштаб так, чтобы обычный дом занимал около 70 м²
  const areas = plan.buildings.map((b) => Math.abs(areaOf(ringOf(b, 1, 2)))).sort((a, b) => a - b)
  const med = areas[areas.length >> 1] || 300
  const k = Math.max(0.6, Math.min(Math.sqrt(med / 62), 12))
  const W = plan.w / k, H = plan.h / k
  const allPts = plan.buildings.flatMap((b) => ringOf(b, k, 2))
  const center: P2 = allPts.length ? centerOf(allPts) : [W / 2, H / 2]
  const radius = Math.max(30, Math.sqrt(allPts.reduce((m, p) => Math.max(m, (p[0] - center[0]) ** 2 + (p[1] - center[1]) ** 2), 0)))
  // город на вершине (Высокогорное Княжество): платформа радиуса RP вокруг скалы R0, ниже края — обрыв на DROP
  const kranz = S.style === 'kranz'
  // край платформы — по плотной застройке (хутора и пашни за ней остаются на склонах внизу или убираются)
  const coreR = (() => {
    const d = plan.buildings.map((b) => { const c = centerOf(ringOf(b, k, 2)); return Math.hypot(c[0] - center[0], c[1] - center[1]) }).sort((a, b) => a - b)
    return d.length ? d[Math.floor(d.length * 0.82)] : radius
  })()
  const RP = Math.min(radius, coreR) + 12
  const DROP = Math.min(330, Math.max(180, RP * 1.1))
  const R0 = Math.max(16, RP * 0.24)
  const PEAK = Math.max(60, RP * 0.75)

  // на плане дома стоят почти вплотную: в 3D чуть уже, чтобы между ними появились проходы и улицы
  // ширина дома (короткая сторона наименьшего описанного прямоугольника) и ось этой ширины
  const narrowOf = (r: P2[]): { w: number; nx: number; nz: number; c: number } => {
    let best = 1e18, w = 0, nx = 0, nz = 1, c = 0
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length]
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l < 0.01) continue
      const ax = (q[0] - p[0]) / l, az = (q[1] - p[1]) / l
      let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9
      for (const t of r) { const u = t[0] * ax + t[1] * az, v = -t[0] * az + t[1] * ax; a0 = Math.min(a0, u); a1 = Math.max(a1, u); c0 = Math.min(c0, v); c1 = Math.max(c1, v) }
      const s = (a1 - a0) * (c1 - c0)
      if (s < best) { best = s; if (a1 - a0 < c1 - c0) { w = a1 - a0; nx = ax; nz = az; c = (a0 + a1) / 2 } else { w = c1 - c0; nx = -az; nz = ax; c = (c0 + c1) / 2 } }
    }
    return { w, nx, nz, c }
  }
  // минимальная ширина дома в 3D (бета-тестер: «дома очень узкие»): отступ не делает дом уже HOUSE_W,
  // а слишком узкий участок плана раздвигается поперёк конька
  const HOUSE_W = 4.6
  const inset = (r: P2[]): P2[] => {
    const a = Math.abs(areaOf(r))
    const nw = narrowOf(r)
    if (nw.w < HOUSE_W - 0.4) {
      const f = Math.min(1.7, (HOUSE_W - 0.4) / Math.max(0.5, nw.w))
      return r.map(([x, z]) => { const d = x * nw.nx + z * nw.nz - nw.c; return [x + nw.nx * d * (f - 1), z + nw.nz * d * (f - 1)] as P2 })
    }
    if (a < 18) return r
    const dd = Math.min(1.5, 0.5 + Math.sqrt(a) * 0.05, Math.max(0.2, (nw.w - HOUSE_W) / 2))
    const q = grow(r, -dd)
    return Math.abs(areaOf(q)) > a * 0.4 && areaOf(q) * areaOf(r) > 0 ? q : r
  }
  const blds = plan.buildings.map((b) => { const r = ringOf(b, k, 2); return { d: b[0], special: b[1] === 1, r: b[1] === 1 ? r : inset(r) } })
  const dists = S.dist.map((f) => ringOf(f, k))
  const waters = S.water.map((f) => ringOf(f, k))
  const fields = kranz ? [] : S.fields.map((f) => ringOf(f, k))
  const greens = S.greens.map((f) => ringOf(f, k))
  // город на вершине: площади, что оказались на скале посреди платформы, не нужны — рынок и жителей там не будет
  const squares = S.squares.map((f) => ringOf(f, k)).filter((r) => { if (!kranz) return true; const c = centerOf(r); return Math.hypot(c[0] - center[0], c[1] - center[1]) > R0 * 1.35 })
  const lines = (l: PlanLine[]): { r: P2[]; w: number }[] => l.map((q) => ({ r: ringOf(q.r, k), w: q.w / k }))
  const roads = lines(S.roads), rivers = lines(S.rivers), planks = lines(S.planks), bridges = lines(S.bridges ?? []), wallLines = lines(S.walls)

  const trace = (g: CanvasRenderingContext2D, r: P2[], close = true): void => {
    g.beginPath()
    r.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    if (close) g.closePath()
  }

  // ---------- маски: вода и застройка → сетка высот ----------
  const MS = 512
  const canvasMask = (paint: (g: CanvasRenderingContext2D) => void, passes: number, rad: number): Float32Array => {
    const c = document.createElement('canvas')
    c.width = c.height = MS
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.scale(MS / W, MS / H)
    g.fillStyle = g.strokeStyle = '#fff'
    g.lineCap = g.lineJoin = 'round'
    paint(g)
    const d = g.getImageData(0, 0, MS, MS).data
    let a = new Float32Array(MS * MS)
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4] / 255
    // размытие прямоугольником: ctx.filter на телефонах Safari не работает
    let b = new Float32Array(MS * MS)
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < MS; y++) { let s = a[y * MS] * (2 * rad + 1); for (let x = -rad; x < MS; x++) { if (x + rad < MS) s += a[y * MS + x + rad]; else s += a[y * MS + MS - 1]; if (x - rad - 1 >= 0) s -= a[y * MS + x - rad - 1]; else s -= a[y * MS]; if (x >= 0) b[y * MS + x] = s / (2 * rad + 1) + 0 } }
      ;[a, b] = [b, a]
      for (let x = 0; x < MS; x++) { let s = a[x] * (2 * rad + 1); for (let y = -rad; y < MS; y++) { if (y + rad < MS) s += a[(y + rad) * MS + x]; else s += a[(MS - 1) * MS + x]; if (y - rad - 1 >= 0) s -= a[(y - rad - 1) * MS + x]; else s -= a[x]; if (y >= 0) b[y * MS + x] = s / (2 * rad + 1) } }
      ;[a, b] = [b, a]
    }
    return a
  }
  const sampler = (m: Float32Array) => (x: number, z: number): number => {
    const u = Math.max(0, Math.min(MS - 1.001, (x / W) * MS)), v = Math.max(0, Math.min(MS - 1.001, (z / H) * MS))
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j
    return (m[j * MS + i] * (1 - fu) + m[j * MS + i + 1] * fu) * (1 - fv) + (m[(j + 1) * MS + i] * (1 - fu) + m[(j + 1) * MS + i + 1] * fu) * fv
  }
  const earth = S.earth && S.earth.length >= 6 ? ringOf(S.earth, k) : null
  const hasWater = waters.length > 0 || rivers.length > 0 || !!earth
  const waterIn = hasWater
    ? sampler(canvasMask((g) => {
        // море за берегом: весь кадр — вода, суша вырезается контуром
        if (earth) {
          g.fillRect(0, 0, W, H)
          g.fillStyle = '#000'
          trace(g, earth)
          g.fill()
          g.fillStyle = '#fff'
        }
        waters.forEach((r) => { trace(g, r); g.fill() })
        rivers.forEach((q) => { trace(g, q.r, false); g.lineWidth = q.w; g.stroke() })
      }, 2, 2))
    : () => 0
  const townAt = sampler(canvasMask((g) => {
    blds.forEach((b) => { trace(g, b.r); g.fill() })
    dists.forEach((r) => { trace(g, r); g.fill() })
    wallLines.forEach((q) => { trace(g, q.r); g.fill() })
    fields.forEach((r) => { trace(g, r); g.fill() })
    roads.forEach((q) => { trace(g, q.r, false); g.lineWidth = Math.max(8, q.w * 2); g.stroke() })
  }, 3, 14))

  // город на вершине: края карты должны скрывать горы, поэтому земля уходит далеко за платформу
  const margin = Math.max(350, Math.max(W, H) * 0.6, kranz ? DROP * 3.2 : 0)
  const x0 = -margin, z0 = -margin, EW = W + margin * 2, EH = H + margin * 2
  const hillAmp = S.rocky ? 46 : S.hills ? 20 : 7
  const n1 = noise2(hashOf(seedName) + 3)
  // за краем плана берег и река продолжаются извилисто, а не прямой полосой от крайнего пикселя маски
  const waterAt = (x: number, z: number): number => {
    const d = Math.max(0, -x, x - W, -z, z - H)
    if (d <= 0 || !hasWater) return waterIn(x, z)
    const k = Math.min(d, margin * 1.2)
    const ox = (n1(x * 0.0035 + 13, z * 0.0035 + 7) - 0.5) * k * 1.7 + (n1(x * 0.012 + 3, z * 0.012 + 51) - 0.5) * k * 0.5
    const oz = (n1(x * 0.0035 + 91, z * 0.0035 + 37) - 0.5) * k * 1.7 + (n1(x * 0.012 + 77, z * 0.012 + 19) - 0.5) * k * 0.5
    return waterIn(Math.max(0, Math.min(W, x)) + ox, Math.max(0, Math.min(H, z)) + oz)
  }
  // горы вокруг города: начинаются за краем плана и растут к горизонту (не для пещер и Кулагона)
  const mtnOn = !kranz && S.style !== 'deep'
  const mAmp = mtnOn ? margin * (S.rocky ? 0.42 : S.hills ? 0.24 : 0.1) : 0
  const SKIRT = mtnOn ? Math.max(EW, EH) * 0.45 : 0
  const mtnW = (x: number, z: number): number => smooth(margin * 0.45, margin * 1.6, Math.max(0, -x, x - W, -z, z - H))
  const mtn = (x: number, z: number): number => {
    const w = mtnW(x, z)
    if (w <= 0) return 0
    const f0 = 1 / Math.max(170, margin * 0.6)
    let a = 0, amp = 1, fr = f0, prev = 1
    for (let o = 0; o < 4; o++) {
      let r = 1 - Math.abs(2 * n1(x * fr + 300 + o * 17, z * fr + 500 - o * 13) - 1)
      r *= r
      a += r * amp * prev
      prev = Math.min(1, r * 1.5 + 0.15)
      amp *= 0.5
      fr *= 2.1
    }
    // перевалы и долины: кольцо гор не сплошное
    const gap = 0.4 + 0.6 * smooth(0.3, 0.62, n1(x * f0 * 0.4 + 70, z * f0 * 0.4 + 90))
    // к воде горы спускаются полого
    let wb = 0
    if (hasWater) {
      const d = margin * 0.28, e = d * 0.4
      wb = (waterAt(x - d, z) + waterAt(x + d, z) + waterAt(x, z - d) + waterAt(x, z + d) + waterAt(x - e, z - e) + waterAt(x + e, z + e) + waterAt(x - e, z + e) + waterAt(x + e, z - e)) / 8
    }
    return mAmp * w * gap * (0.16 + 1.25 * a) * (1 - smooth(0, 0.55, wb))
  }
  const rawHeight = (x: number, z: number): number => {
    const f = 1 / Math.max(90, radius * 0.5)
    const hill = n1(x * f, z * f) * 0.65 + n1(x * f * 2.3 + 40, z * f * 2.3) * 0.28 + n1(x * f * 6 + 90, z * f * 6) * 0.07
    const out = 1 - smooth(0.02, 0.5, townAt(x, z))
    const edge = Math.min(1.5, Math.max(0, Math.max(-x, x - W, -z, z - H)) / margin)
    const land = 1.1 + (n1(x * 0.02, z * 0.02) - 0.5) * 0.6 + Math.max(0, hill - 0.3) * 1.7 * hillAmp * out * (0.45 + edge) + mtn(x, z)
    const w = waterAt(x, z)
    const h = land * (1 - smooth(0.12, 0.5, w)) - 3 * smooth(0.3, 0.75, w)
    if (!kranz) return h
    const r = Math.hypot(x - center[0], z - center[1])
    // скала вершины посреди платформы
    if (r < R0) return h + PEAK * Math.pow(1 - r / R0, 1.25) * (0.86 + 0.28 * n1(x * 0.08 + 11, z * 0.08))
    if (r <= RP) return h
    // за краем платформы — стена, под ней склоны горы до дна долины, с гребнями и осыпями
    const t = r - RP
    const ridge = n1(x * 0.006 + 30, z * 0.006) * 0.6 + n1(x * 0.02, z * 0.02 + 50) * 0.4
    const u = Math.min(1, t / (DROP * 1.5))
    // вокруг платформы — горный массив: хребты и пики поднимаются из долины, самые дальние выше самой платформы
    const fm = 1 / (DROP * 1.15)
    const rg = 1 - Math.abs(2 * n1(x * fm + 200, z * fm + 300) - 1)
    const peaks = Math.pow(Math.max(0, rg - 0.3) / 0.7, 1.5) * DROP * 1.5 * smooth(DROP * 0.3, DROP * 1.7, t)
    return -24 - (DROP - 24) * (1 - Math.pow(1 - u, 2.6)) * (0.72 + ridge * 0.5) + peaks + (n1(x * 0.05, z * 0.05) - 0.5) * 12 * smooth(0, 40, t)
  }
  const GN = opts.mobile ? 150 : EW > 2500 ? 384 : 256
  const GM = Math.round((GN * EH) / EW)
  const hgrid = new Float32Array((GN + 1) * (GM + 1))
  for (let j = 0; j <= GM; j++) for (let i = 0; i <= GN; i++) hgrid[j * (GN + 1) + i] = rawHeight(x0 + (i / GN) * EW, z0 + (j / GM) * EH)
  const heightAt = (x: number, z: number): number => {
    const u = Math.max(0, Math.min(GN - 0.001, ((x - x0) / EW) * GN)), v = Math.max(0, Math.min(GM - 0.001, ((z - z0) / EH) * GM))
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, L = GN + 1
    return (hgrid[j * L + i] * (1 - fu) + hgrid[j * L + i + 1] * fu) * (1 - fv) + (hgrid[(j + 1) * L + i] * (1 - fu) + hgrid[(j + 1) * L + i + 1] * fu) * fv
  }

  // ---------- сетка занятости: столкновения, выбор здания, места для деревьев ----------
  const cell = Math.max(0.75, Math.max(W, H) / 1800)
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell)
  const grid = new Int32Array(gw * gh) // >0 здание+1, -1 стена, -2 вода, -3 настил
  const fillPoly = (r: P2[], v: number): void => {
    let a = 1e9, b = -1e9
    for (const p of r) { a = Math.min(a, p[1]); b = Math.max(b, p[1]) }
    const y0 = Math.max(0, Math.floor(a / cell)), y1 = Math.min(gh - 1, Math.ceil(b / cell))
    for (let j = y0; j <= y1; j++) {
      const y = (j + 0.5) * cell, xs: number[] = []
      for (let i = 0; i < r.length; i++) {
        const p = r[i], q = r[(i + 1) % r.length]
        if (p[1] > y !== q[1] > y) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]))
      }
      xs.sort((m, n) => m - n)
      for (let n = 0; n + 1 < xs.length; n += 2) for (let i = Math.max(0, Math.floor(xs[n] / cell)); i <= Math.min(gw - 1, Math.floor(xs[n + 1] / cell)); i++) grid[j * gw + i] = v
    }
  }
  const fillLine = (r: P2[], w: number, v: number): void => {
    for (let s = 1; s < r.length; s++) {
      const [ax, ay] = r[s - 1], [bx, by] = r[s]
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (cell / 2)), rr = Math.ceil(w / 2 / cell)
      for (let t = 0; t <= n; t++) {
        const cx = Math.floor((ax + ((bx - ax) * t) / n) / cell), cy = Math.floor((ay + ((by - ay) * t) / n) / cell)
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
          const gx = cx + dx, gy = cy + dy
          if (gx >= 0 && gy >= 0 && gx < gw && gy < gh && dx * dx + dy * dy <= rr * rr) grid[gy * gw + gx] = v
        }
      }
    }
  }
  /** Мелкий предмет на земле (бочка, ящик, фонарь, сушилка…): закрывает свободные клетки круга, чтобы сквозь него не ходили */
  const blockProp = (x: number, z: number, rad: number): void => {
    const rr = Math.max(0, Math.ceil(rad / cell) - 1), cx = Math.floor(x / cell), cy = Math.floor(z / cell)
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const gx = cx + dx, gy = cy + dy
      if (gx >= 0 && gy >= 0 && gx < gw && gy < gh && dx * dx + dy * dy <= rr * rr + 0.5 && grid[gy * gw + gx] === 0) grid[gy * gw + gx] = -1
    }
  }
  if (hasWater) for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (heightAt((i + 0.5) * cell, (j + 0.5) * cell) < -0.2) grid[j * gw + i] = -2
  planks.forEach((q) => fillLine(q.r, Math.max(q.w, 3), -3))
  // ---------- мосты: профиль настила — концы на берегах, над водой горб не ниже 1.8 м ----------
  type Bridge = { a: P2; ux: number; uz: number; L: number; w: number; ya: number; yb: number; hump: number; d0: number; d1: number }
  const bridgeList: Bridge[] = []
  const deckY = (B: Bridge, d: number): number => { const t = Math.max(0, Math.min(1, d / B.L)); return B.ya + (B.yb - B.ya) * t + B.hump * Math.sin(Math.PI * t) }
  for (const q of bridges) for (let s = 1; s < q.r.length; s++) {
    const a = q.r[s - 1], b = q.r[s], L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 4) continue
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L
    let d0 = -1, d1 = -1
    for (let d = 0; d <= L; d += 0.5) if (heightAt(a[0] + ux * d, a[1] + uz * d) < -0.2) { if (d0 < 0) d0 = d; d1 = d }
    if (d0 < 0) continue
    const ya = Math.max(heightAt(a[0], a[1]), 0.2), yb = Math.max(heightAt(b[0], b[1]), 0.2)
    let hump = 0.8
    for (let d = d0; d <= d1; d += 0.5) { const t = d / L, sn = Math.sin(Math.PI * t); if (sn > 0.05) hump = Math.max(hump, (1.8 - (ya + (yb - ya) * t)) / sn) }
    bridgeList.push({ a, ux, uz, L, w: Math.max(q.w, 4.5), ya, yb, hump: Math.min(hump, 4), d0, d1 })
  }
  // высота настила моста в точке (null — не на мосту); ходят по нему между парапетами
  const bridgeAt = (x: number, z: number): number | null => {
    let best: number | null = null
    for (const B of bridgeList) {
      const px = x - B.a[0], pz = z - B.a[1], d = px * B.ux + pz * B.uz
      if (d < 0 || d > B.L || Math.abs(-px * B.uz + pz * B.ux) > B.w / 2 - 0.45) continue
      const h = deckY(B, d)
      if (best === null || h > best) best = h
    }
    return best
  }
  bridgeList.forEach((B) => fillLine([B.a, [B.a[0] + B.ux * B.L, B.a[1] + B.uz * B.L]], B.w - 1.2, -3))
  const gridAt = (x: number, z: number): number => {
    const i = Math.floor(x / cell), j = Math.floor(z / cell)
    return i < 0 || j < 0 || i >= gw || j >= gh ? 0 : grid[j * gw + i]
  }

  // ---------- стены: где ворота, что занято ----------
  const segCross = (a: P2, b: P2, c: P2, d: P2): number | null => {
    const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
    if (Math.abs(r) < 1e-6) return null
    const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r
    const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
  }
  const GATE = 4.2
  const gatesOn = (a: P2, b: P2, len: number): number[] => {
    const out: number[] = []
    for (const q of [...roads, ...planks, ...bridges]) for (let s = 1; s < q.r.length; s++) { const t = segCross(a, b, q.r[s - 1], q.r[s]); if (t !== null) out.push(t * len) }
    return out.sort((m, n) => m - n)
  }
  // водяные ворота: участки, где стена переходит реку поперёк (вдоль берега по воде стену не режем)
  const waterOn = (a: P2, b: P2, len: number): [number, number][] => {
    if (!hasWater || len < 2) return []
    const out: [number, number][] = [], st = 1.5, n = Math.ceil(len / st)
    let w0 = -1
    for (let j = 0; j <= n; j++) {
      const f = (len * j) / n, wet = heightAt(a[0] + ((b[0] - a[0]) * f) / len, a[1] + ((b[1] - a[1]) * f) / len) < -0.2
      if (wet && w0 < 0) w0 = f
      if ((!wet || j === n) && w0 >= 0) { const w1 = wet ? f : f - len / n; if (w1 - w0 > 2 && w1 - w0 < 40) out.push([w0, w1]); w0 = -1 }
    }
    // если реку здесь уже переходит мост с дорогой — это обычные ворота, не водяные
    return out.filter(([w0, w1]) => !gatesOn(a, b, len).some((g) => g > w0 - GATE && g < w1 + GATE))
  }
  const spansOf = (gates: number[], len: number, wet: [number, number][] = []): [number, number][] => {
    const cuts: [number, number][] = [...gates.map((g): [number, number] => [g - GATE, g + GATE]), ...wet.map(([w0, w1]): [number, number] => [w0 - 1.2, w1 + 1.2])].sort((m, n) => m[0] - n[0])
    const spans: [number, number][] = []
    let cur = 0
    for (const [c0, c1] of cuts) { if (c0 > cur) spans.push([cur, c0]); cur = Math.max(cur, c1) }
    if (cur < len) spans.push([cur, len])
    return spans
  }
  const gatePts: P2[] = []
  const towerSpots: { x: number; z: number; r: number }[] = []
  wallLines.forEach((w) => {
    const th = Math.max(1.8, Math.min(3.2, w.w / 2)), towerR = Math.max(2.4, Math.min(4.4, (S.tower / k) * 0.9))
    w.r.forEach((a, i) => {
      const b = w.r[(i + 1) % w.r.length], len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.5) return
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len
      const gates = gatesOn(a, b, len)
      for (const [s0, s1] of spansOf(gates, len, waterOn(a, b, len))) fillLine([[a[0] + ux * s0, a[1] + uz * s0], [a[0] + ux * s1, a[1] + uz * s1]], th + 0.6, -1)
      for (const g0 of gates) {
        const cx = a[0] + ux * g0, cz = a[1] + uz * g0
        gatePts.push([cx, cz])
        for (const sd of [-1, 1]) {
          fillLine([[cx + ux * sd * GATE, cz + uz * sd * GATE], [cx + ux * sd * GATE + 0.1, cz + uz * sd * GATE]], towerR * 1.7, -1)
          towerSpots.push({ x: cx + ux * sd * GATE, z: cz + uz * sd * GATE, r: towerR * 0.9 + 0.8 })
        }
      }
      fillLine([a, [a[0] + 0.1, a[1]]], towerR * 2, -1)
      towerSpots.push({ x: a[0], z: a[1], r: towerR + 0.8 })
    })
  })

  // ---------- что за здание: особые получают свою модель и место вокруг ----------
  const N = blds.length
  const marks = new Map<number, string>((plan.landmarks ?? []).map((l) => [l.b, l.name]))
  // локации автора: их здания не сносятся, и название тоже может дать модель («Банк», «Собор»…)
  for (const q of opts.places) if (q.building != null && !marks.has(q.building)) marks.set(q.building, q.name)
  function pointIn([x, y]: P2, r: P2[]): boolean {
    let c = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c
    return c
  }
  const kindOf = (i: number): string => {
    const n = marks.get(i) ?? ''
    if (/храм|церк|часовн|капелл|сан-|санта-/i.test(n)) return 'temple'
    if (/замок|кастра|цитадел|гнездо|крепост|кастелян/i.test(n)) return 'keep'
    if (/ратуш|палат|совет|дворец|губернатор|подест|магистрат/i.test(n)) return 'civic'
    if (/мельниц/i.test(n)) return 'mill'
    if (blds[i].special) return S.citadel >= 0 && pointIn(centerOf(blds[i].r), wallLines[S.citadel].r) ? 'keep' : 'temple'
    return ''
  }
  const obbOf = (r: P2[]): { ux: number; uz: number; cx: number; cz: number; L: number; W: number } => {
    let best = 1e18, out = { ux: 1, uz: 0, cx: 0, cz: 0, L: 1, W: 1 }
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length], l = Math.hypot(q[0] - p[0], q[1] - p[1])
      if (l < 0.01) continue // у своих планов контур замкнут повторной точкой
      const ax = (q[0] - p[0]) / l, az = (q[1] - p[1]) / l
      let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9
      for (const w of r) { const u = w[0] * ax + w[1] * az, v = -w[0] * az + w[1] * ax; a0 = Math.min(a0, u); a1 = Math.max(a1, u); c0 = Math.min(c0, v); c1 = Math.max(c1, v) }
      const sq = (a1 - a0) * (c1 - c0)
      if (sq < best) {
        best = sq
        const mu = (a0 + a1) / 2, mv = (c0 + c1) / 2, cx = mu * ax - mv * az, cz = mu * az + mv * ax
        out = a1 - a0 >= c1 - c0 ? { ux: ax, uz: az, cx, cz, L: a1 - a0, W: c1 - c0 } : { ux: -az, uz: ax, cx, cz, L: c1 - c0, W: a1 - a0 }
      }
    }
    return out
  }
  const at0 = (r: number, a: number): P2 => [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]
  const hubAim: P2 = squares[0] ? centerOf(squares[0]) : kranz ? at0(R0 * 1.7, 0.6) : center
  const townScale = N < 60 ? 0.42 : N < 150 ? 0.62 : N < 500 ? 0.84 : 1
  interface Mon { i: number; kind: MonKind; x: number; z: number; rot: number; L: number; W: number }
  const mons: Mon[] = []
  const removed = new Uint8Array(N)
  const inRect = (m: Omit<Mon, 'i' | 'kind'>, x: number, z: number, pad = 0): boolean => {
    const c = Math.cos(m.rot), n = Math.sin(m.rot), dx = x - m.x, dz = z - m.z
    return Math.abs(dx * c + dz * n) <= m.L / 2 + pad && Math.abs(-dx * n + dz * c) <= m.W / 2 + pad
  }
  const rectBlocked = (m: Omit<Mon, 'i' | 'kind'>): boolean => {
    const c = Math.cos(m.rot), n = Math.sin(m.rot)
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const u = (a / 3) * (m.L / 2), v = (b / 3) * (m.W / 2), x = m.x + u * c - v * n, z = m.z + u * n + v * c
      if (x < 0 || z < 0 || x > W || z > H) return true
      const g = gridAt(x, z)
      if (g === -1 || g === -2 || g === -3) return true
    }
    return false
  }
  for (const [i, name] of marks) {
    const kind = monumentKind(name, N)
    if (!kind || !blds[i]) continue
    const o = obbOf(blds[i].r)
    const want = MON_SIZE[kind]
    let L = Math.max(o.L, want[0] * townScale), Wd = Math.max(o.W, want[1] * townScale)
    let rot = Math.atan2(o.uz, o.ux)
    // перед смотрит на центр
    const front = -Math.sin(rot) * (hubAim[0] - o.cx) + Math.cos(rot) * (hubAim[1] - o.cz)
    if (front < 0) rot += Math.PI
    let placed: Mon | null = null
    for (let t = 0; t < 5 && !placed; t++) {
      const m = { i, kind, x: o.cx, z: o.cz, rot, L, W: Wd }
      if (!rectBlocked(m)) placed = m
      L = Math.max(o.L, L * 0.84)
      Wd = Math.max(o.W, Wd * 0.84)
    }
    if (!placed) placed = { i, kind, x: o.cx, z: o.cz, rot, L: o.L, W: o.W }
    mons.push(placed)
  }
  // соседние домики уступают место зданию; примечательные остаются
  blds.forEach((b, i) => {
    if (marks.has(i)) return
    const c = centerOf(b.r)
    // сносим по площади: задет хоть угол или середина ребра дома — дом уступает
    const pts: P2[] = [c, ...b.r, ...b.r.map((p, j) => { const q = b.r[(j + 1) % b.r.length]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as P2 })]
    const monCorners = (m: Mon): P2[] => { const co = Math.cos(m.rot), n = Math.sin(m.rot); return [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([u, v]) => [m.x + (u * m.L) / 2 * co - (v * m.W) / 2 * n, m.z + (u * m.L) / 2 * n + (v * m.W) / 2 * co] as P2) }
    if (mons.some((m) => pts.some((p) => inRect(m, p[0], p[1], 1.5)) || monCorners(m).some((p) => pointIn(p, b.r)))) removed[i] = 1
    // угловые и надвратные башни стоят свободно: дом, задевший башню, уступает
    if (towerSpots.some((t) => pointIn([t.x, t.z], b.r) || pts.some((p) => Math.hypot(p[0] - t.x, p[1] - t.z) < t.r))) removed[i] = 1
    // на вершине — скала и дворец, домов там нет
    if (kranz && Math.hypot(c[0] - center[0], c[1] - center[1]) < R0 * 1.08) removed[i] = 1
    // за краем платформы — обрыв, домов там нет
    if (kranz && Math.hypot(c[0] - center[0], c[1] - center[1]) > RP - 5) removed[i] = 1
  })
  blds.forEach((b, i) => { if (!removed[i]) fillPoly(b.r, i + 1) })
  // скала посреди платформы и стена по краю — для жителей и улиц непроходимы
  if (kranz) {
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const r = Math.hypot((i + 0.5) * cell - center[0], (j + 0.5) * cell - center[1])
      if ((r < R0 * 1.12 || r > RP - 2) && grid[j * gw + i] === 0) grid[j * gw + i] = -1
    }
  }
  const monAt = new Map<number, Mon>(mons.map((m) => [m.i, m]))
  for (const m of mons) {
    const c = Math.cos(m.rot), n = Math.sin(m.rot)
    fillPoly([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, d]) => { const u = (a * m.L) / 2, v = (d * m.W) / 2; return [m.x + u * c - v * n, m.z + u * n + v * c] as P2 }), m.i + 1)
  }

  // ---------- двери и улицы ----------
  const doorEdges = new Map<number, number>()
  const doors: P2[] = []
  const pois: P2[] = []
  blds.forEach((b, i) => {
    if (removed[i]) return
    const m = monAt.get(i)
    if (m) {
      const d = m.W / 2 + 2
      const pt: P2 = [m.x - Math.sin(m.rot) * d, m.z + Math.cos(m.rot) * d]
      pois.push(pt)
      doors.push(pt)
      return
    }
    const o = areaOf(b.r) > 0 ? 1 : -1
    let best = -1, bl = 1.6
    let pt: P2 | null = null
    b.r.forEach((a, e) => {
      const c = b.r[(e + 1) % b.r.length], l = Math.hypot(c[0] - a[0], c[1] - a[1])
      if (l <= bl) return
      const nx = ((c[1] - a[1]) / l) * o, nz = (-(c[0] - a[0]) / l) * o
      const mx = (a[0] + c[0]) / 2 + nx * 1.1, mz = (a[1] + c[1]) / 2 + nz * 1.1
      const g = gridAt(mx, mz)
      if (g > 0) return
      bl = l; best = e; pt = [(a[0] + c[0]) / 2 + nx * 1.4, (a[1] + c[1]) / 2 + nz * 1.4]
    })
    if (pt) { doorEdges.set(i, best); doors.push(pt); if (marks.has(i)) pois.push(pt) }
  })
  squares.forEach((r) => {
    const c = centerOf(r)
    fillLine([c, [c[0] + 0.1, c[1]]], 3.4, N + 2)
    pois.push([c[0] + 5, c[1] + 2], [c[0] - 4, c[1] - 5])
  })
  const roadAt = sampler(canvasMask((c) => { roads.forEach((q) => { trace(c, q.r, false); c.lineWidth = Math.max(4, q.w); c.stroke() }) }, 0, 0))
  // концы дорог — главные цели улиц. За городской стеной это только выезды с карты: тупик слободского проулка
  // в поле главной улицей не считается, иначе от каждого такого тупика к воротам тянется мощёная колея вдоль стены
  const ringWall = wallLines.find((w, i) => i !== S.citadel && w.r.length > 2)
  const edgeGap = Math.max(W, H) * 0.06
  const roadEnds: P2[] = roads.flatMap((q) => (q.r.length ? [q.r[0], q.r[q.r.length - 1]] : [])).filter((p) => p[0] > 0 && p[1] > 0 && p[0] < W && p[1] < H)
    .filter((p) => !ringWall || pointIn(p, ringWall.r) || Math.min(p[0], p[1], W - p[0], H - p[1]) < edgeGap)
  let streets: Streets | null = null
  if (doors.length > 1) {
    streets = buildStreets({
      W, H,
      cell: Math.max(1.4, Math.max(W, H) / (opts.mobile ? 420 : 640)),
      // проезд ворот уже клетки сетки (башни по бокам почти смыкаются), поэтому у самих ворот стена проходима:
      // иначе город внутри отрезан, центр улиц уезжает в поле, и все пути огибают стену кольцами
      free: (x, z) => {
        const g = gridAt(x, z)
        if (g === -1 && gatePts.some((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 < 10)) return true
        return (g === 0 || g === -3) && (heightAt(x, z) > 0.05 || bridgeAt(x, z) !== null)
      },
      roadAt,
      hub: hubAim,
      mains: [...gatePts, ...pois, ...roadEnds],
      doors
    })
  }

  // главные улицы шире: мелкие домики, что вылезают на проезд, сносятся (большие и примечательные остаются)
  if (streets && N >= 150) {
    const T = streets, mainMin = Math.max(5, Math.round(N * 0.035)), reach = Math.ceil((N < 500 ? 3 : 3.8) / T.cell)
    const hit = new Set<number>()
    for (let q = 0; q < T.traffic.length; q++) {
      if (T.traffic[q] < mainMin) continue
      const i0 = q % T.gw, j0 = (q / T.gw) | 0
      for (let dj = -reach; dj <= reach; dj++) for (let di = -reach; di <= reach; di++) {
        if (di * di + dj * dj > reach * reach) continue
        const v = gridAt((i0 + di + 0.5) * T.cell, (j0 + dj + 0.5) * T.cell)
        if (v > 0 && v <= N) hit.add(v - 1)
      }
    }
    for (const i of hit) {
      if (marks.has(i) || blds[i].special || Math.abs(areaOf(blds[i].r)) > 95) continue
      removed[i] = 1
      for (let q = 0; q < grid.length; q++) if (grid[q] === i + 1) grid[q] = 0
    }
  }

  // ---------- земля: всё плоское рисуется на холсте ----------
  const texMax = Math.min(opts.maxTexture, opts.mobile ? 2048 : W > 900 ? 4096 : 2048)
  const tc = document.createElement('canvas')
  tc.width = texMax
  tc.height = Math.round((texMax * EH) / EW)
  const g = tc.getContext('2d')!
  const pxPerM = tc.width / EW
  const groundFill = S.rocky ? mixHex(st.grass, '#8d8a78', 0.45) : st.grass
  g.fillStyle = groundFill
  g.fillRect(0, 0, tc.width, tc.height)
  const RT = rng(hashOf(seedName) + 5)
  for (let i = 0; i < 2600; i++) {
    const x = RT() * tc.width, y = RT() * tc.height, r = (6 + RT() * 60) * (tc.width / 2048)
    g.fillStyle = RT() < 0.5 ? st.grass2 : mixHex(groundFill, '#39482a', 0.35)
    g.globalAlpha = 0.09 + RT() * 0.14
    g.beginPath()
    g.ellipse(x, y, r, r * (0.5 + RT() * 0.5), RT() * 3, 0, 7)
    g.fill()
  }
  g.globalAlpha = 1
  g.save()
  g.translate(margin * pxPerM, margin * pxPerM)
  g.scale(pxPerM, pxPerM)
  g.lineCap = g.lineJoin = 'round'
  // поля: борозды по длинной стороне
  const FIELD = S.style === 'deep' ? ['#4a3f4a', '#3f4a3a', '#5a4a3a', '#46403a'] : S.style === 'styria' ? ['#7c7a58', '#6c6d4c', '#857a5a', '#5f6846'] : S.style === 'south' ? ['#c9b264', '#a9a85a', '#d0b878', '#8f9a50'] : ['#c7b35e', '#a8ab55', '#8fa24c', '#b99f58', '#7f9a48']
  fields.forEach((r, i) => {
    const col = FIELD[i % FIELD.length]
    g.save()
    trace(g, r)
    g.fillStyle = col
    g.fill()
    g.clip()
    let best = 0, ang = 0
    r.forEach((p, n) => { const q = r[(n + 1) % r.length]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > best) { best = l; ang = Math.atan2(q[1] - p[1], q[0] - p[0]) } })
    const [cx, cy] = centerOf(r)
    g.translate(cx, cy)
    g.rotate(ang)
    g.strokeStyle = mixHex(col, '#3f3a20', 0.32)
    g.lineWidth = 0.55
    g.beginPath()
    const span = Math.max(best * 1.4, 40)
    for (let y = -span; y < span; y += 1.7) { g.moveTo(-span, y); g.lineTo(span, y) }
    g.stroke()
    g.restore()
    trace(g, r)
    g.strokeStyle = mixHex(col, '#3f3a20', 0.45)
    g.lineWidth = 0.8
    g.stroke()
  })
  greens.forEach((r) => { trace(g, r); g.fillStyle = mixHex(st.grass, '#2f4a22', 0.35); g.fill() })
  // берег
  const sand = S.style === 'styria' ? '#6d675a' : '#d6c79a'
  waters.forEach((r) => { trace(g, r); g.strokeStyle = sand; g.lineWidth = 7; g.stroke() })
  rivers.forEach((q) => { trace(g, q.r, false); g.strokeStyle = sand; g.lineWidth = q.w + 5; g.stroke() })
  // земля кварталов и площади: утоптанная земля и мостовая
  const built = new Float32Array(dists.length)
  blds.forEach((b, i) => { if (b.d >= 0 && !removed[i]) built[b.d] += Math.abs(areaOf(b.r)) })
  const dense = dists.map((r, i) => built[i] / Math.max(1, Math.abs(areaOf(r))))
  dists.forEach((r, i) => { trace(g, r); g.fillStyle = st.dirt; g.globalAlpha = dense[i] > 0.34 ? 0.9 : dense[i] > 0.2 ? 0.45 : 0.14; g.fill(); g.globalAlpha = 1 })
  const speck = (r: P2[], n: number, col: string, alpha: number, size: number): void => {
    g.save()
    trace(g, r)
    g.clip()
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9
    for (const p of r) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]) }
    g.fillStyle = col
    g.globalAlpha = alpha
    for (let i = 0; i < n; i++) { const s = size * (0.5 + RT()); g.fillRect(a + RT() * (b - a), c + RT() * (d - c), s, s * 0.7) }
    g.restore()
  }
  dists.forEach((r, i) => { if (dense[i] > 0.2) speck(r, Math.min(5000, Math.abs(areaOf(r)) / 6), mixHex(st.dirt, '#3a3020', 0.4), 0.22, 0.9) })
  squares.forEach((r) => {
    trace(g, r)
    g.fillStyle = st.pave
    g.fill()
    g.strokeStyle = mixHex(st.pave, '#000', 0.3)
    g.lineWidth = 0.8
    g.stroke()
    speck(r, Math.min(9000, Math.abs(areaOf(r))), mixHex(st.pave, '#000', 0.25), 0.4, 0.8)
  })
  // дороги: обочина, полотно, две колеи
  const road = mixHex(st.dirt, st.grass, 0.08), rut = mixHex(st.dirt, '#2c2418', 0.45)
  for (const q of roads) {
    const w = Math.max(q.w, 3.6)
    trace(g, q.r, false)
    g.strokeStyle = mixHex(st.dirt, st.grass, 0.55)
    g.lineWidth = w + 2
    g.stroke()
    trace(g, q.r, false)
    g.strokeStyle = road
    g.lineWidth = w
    g.stroke()
    for (const off of [-0.75, 0.75]) {
      g.beginPath()
      q.r.forEach((p, i) => {
        const a = q.r[Math.max(0, i - 1)], b = q.r[Math.min(q.r.length - 1, i + 1)]
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const x = p[0] - ((b[1] - a[1]) / l) * off, y = p[1] + ((b[0] - a[0]) / l) * off
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      })
      g.strokeStyle = rut
      g.globalAlpha = 0.55
      g.lineWidth = 0.28
      g.stroke()
      g.globalAlpha = 1
    }
  }
  // улицы: мостовая на главных, утоптанная земля на переулках и дорожках к дверям
  if (streets) {
    const T = streets, mainMin = Math.max(5, Math.round(N * 0.035))
    const stones = document.createElement('canvas')
    stones.width = stones.height = 48
    const sg = stones.getContext('2d')!
    sg.fillStyle = mixHex(st.pave, '#000', 0.26)
    sg.fillRect(0, 0, 48, 48)
    const RS = rng(77)
    for (let row = 0; row < 6; row++) for (let c = -1; c < 6; c++) {
      sg.fillStyle = mixHex(st.pave, RS() < 0.5 ? '#ffffff' : '#000000', RS() * 0.16)
      sg.fillRect(c * 8 + (row % 2) * 4 + 0.6, row * 8 + 0.6, 6.8, 6.8)
    }
    const pattern = g.createPattern(stones, 'repeat')!
    pattern.setTransform(new DOMMatrix().scale(1 / Math.max(pxPerM * 0.9, 1) * (N > 150 ? 1 : 1)))
    const klass = (q: number): number => (T.traffic[q] >= mainMin || (T.main[q] && T.traffic[q] >= 6) ? 2 : T.traffic[q] >= 3 ? 1 : 0)
    const paved = N >= 120
    const strokeClass = (c: number, width: number, style: string | CanvasPattern, alpha = 1): void => {
      g.beginPath()
      for (let q = 0; q < T.traffic.length; q++) {
        if (!T.traffic[q] || klass(q) < c) continue
        const w = T.parent[q]
        if (w < 0 || !T.traffic[w]) continue
        g.moveTo(T.sp[q * 2], T.sp[q * 2 + 1])
        g.lineTo(T.sp[w * 2], T.sp[w * 2 + 1])
      }
      g.strokeStyle = style
      g.lineWidth = width
      g.globalAlpha = alpha
      g.stroke()
      g.globalAlpha = 1
    }
    const lane = mixHex(st.dirt, st.grass, N < 120 ? 0.1 : 0)
    const edge = mixHex(st.dirt, st.grass, 0.6)
    strokeClass(0, 1.9, edge, 0.75)
    strokeClass(0, 1.15, lane)
    strokeClass(1, 3.9, edge, 0.8)
    strokeClass(1, 2.9, paved && dense.some((d) => d > 0.3) ? mixHex(st.pave, st.dirt, 0.55) : lane)
    const mw = N < 120 ? 4 : N < 500 ? 5.2 : 6.4
    strokeClass(2, mw + 1.4, paved ? mixHex(st.pave, '#000', 0.34) : edge, 0.9)
    strokeClass(2, mw, paved ? pattern : lane)
    if (paved) strokeClass(2, 0.32, mixHex(st.pave, '#000', 0.42), 0.55)
  }
  rivers.forEach((q) => { trace(g, q.r, false); g.strokeStyle = '#3f7488'; g.lineWidth = q.w; g.stroke() })
  // тень у основания домов: читается даже там, где нет настоящих теней
  g.strokeStyle = 'rgba(25,18,10,.3)'
  g.lineWidth = 1.5
  blds.forEach((b, i) => { if (!removed[i]) { trace(g, b.r); g.stroke() } })
  g.restore()

  const groundTex = new THREE.CanvasTexture(tc)
  groundTex.colorSpace = THREE.SRGBColorSpace
  groundTex.anisotropy = 8
  const scene = new THREE.Scene()
  const disposable: { dispose: () => void }[] = [groundTex]
  // цвет земли по высоте и уклону: камень на кручах и высоте, лес на склонах, снег на вершинах, песок у воды
  const landRock = new THREE.Color('#8b8878'), landShore = new THREE.Color(sand), landSnow = new THREE.Color(1.5, 1.52, 1.6), landWood = new THREE.Color(0.5, 0.66, 0.46)
  const snowLine = Math.max(95, mAmp * 0.66)
  const paintLand = (tmp: THREE.Color, x: number, z: number, y: number, sl: number): void => {
    tmp.setRGB(1, 1, 1)
    const mw = mtnOn ? mtnW(x, z) : 0
    const lo = 12 + mw * mAmp * 0.4
    if (mw > 0 && S.forest > 0.02) {
      const wood = smooth(0.42, 0.6, n1(x * 0.011 + 21, z * 0.011 + 8) * 0.7 + n1(x * 0.04, z * 0.04 + 33) * 0.3) * mw * Math.min(1, S.forest * 3) * (1 - smooth(lo * 0.7, lo * 1.1, y))
      tmp.lerp(landWood, wood * 0.8)
    }
    const rk = Math.max(smooth(lo, lo + 18 + mw * mAmp * 0.3, y) * 0.85, mw * smooth(0.55, 1.05, sl) * 0.9)
    if (rk > 0) tmp.lerp(landRock, rk)
    if (mw > 0 && y > snowLine * 0.7) tmp.lerp(landSnow, smooth(snowLine * 0.8, snowLine * 1.1, y + (n1(x * 0.03 + 5, z * 0.03) - 0.5) * snowLine * 0.25) * (1 - smooth(1.1, 2.2, sl) * 0.7) * 0.92)
    if (y < 0.55 && hasWater) tmp.lerp(landShore, 0.75 * smooth(0.55, 0.1, y))
    if (y < -0.3) tmp.multiplyScalar(0.55)
  }
  const groundGeo = new THREE.BufferGeometry()
  {
    const n = (GN + 1) * (GM + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3)
    const rock = C('#8b8878'), white = new THREE.Color(1, 1, 1), tmp = new THREE.Color()
    for (let j = 0; j <= GM; j++)
      for (let i = 0; i <= GN; i++) {
        const q = j * (GN + 1) + i, x = x0 + (i / GN) * EW, z = z0 + (j / GM) * EH, y = hgrid[q]
        pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z
        uv[q * 2] = i / GN; uv[q * 2 + 1] = 1 - j / GM
        tmp.copy(white)
        if (kranz) {
          const r = Math.hypot(x - center[0], z - center[1])
          if (r < R0) { tmp.lerp(rock, 0.9); if (y > PEAK * 0.55) tmp.setRGB(1.55, 1.58, 1.65) }
          else if (r > RP) {
            // долина внизу — луга, выше — голый камень, на вершинах — снег; крутые склоны всегда камень
            const sl = Math.abs((hgrid[q + 1] ?? y) - y) + Math.abs((hgrid[q + GN + 1] ?? y) - y)
            const meadow = smooth(-DROP * 0.62, -DROP * 0.92, y) * (1 - Math.min(1, (sl / (EW / GN)) * 0.8))
            tmp.setRGB(0.74, 1.06, 0.62).lerp(rock, 1 - meadow)
            const snow = smooth(-DROP * 0.55, DROP * 0.02, y + (n1(x * 0.03 + 5, z * 0.03) - 0.5) * DROP * 0.3) * (1 - Math.min(1, (sl / (EW / GN)) * 0.35))
            tmp.lerp(new THREE.Color(1.5, 1.52, 1.6), snow * 0.9)
          }
          col[q * 3] = tmp.r; col[q * 3 + 1] = tmp.g; col[q * 3 + 2] = tmp.b
          continue
        }
        paintLand(tmp, x, z, y, Math.hypot((hgrid[i < GN ? q + 1 : q - 1] - y) / (EW / GN), (hgrid[j < GM ? q + GN + 1 : q - GN - 1] - y) / (EH / GM)))
        col[q * 3] = tmp.r; col[q * 3 + 1] = tmp.g; col[q * 3 + 2] = tmp.b
      }
    const idx = new Uint32Array(GN * GM * 6)
    let e = 0
    for (let j = 0; j < GM; j++)
      for (let i = 0; i < GN; i++) {
        const a = j * (GN + 1) + i, b = a + 1, c = a + GN + 1, d = c + 1
        idx[e++] = a; idx[e++] = c; idx[e++] = b; idx[e++] = b; idx[e++] = c; idx[e++] = d
      }
    groundGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    groundGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    groundGeo.setIndex(new THREE.BufferAttribute(idx, 1))
    groundGeo.computeVertexNormals()
  }
  const groundMat = new THREE.MeshLambertMaterial({ map: groundTex, vertexColors: true })
  // мелкая фактура поверх холста: вблизи земля и трава не расплываются
  const grain = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const q = c.getContext('2d')!
    q.fillStyle = '#808080'
    q.fillRect(0, 0, 256, 256)
    const RG = rng(31)
    for (let i = 0; i < 2600; i++) {
      const v = 95 + Math.floor(RG() * 70)
      q.fillStyle = `rgba(${v},${v},${v},${0.25 + RG() * 0.4})`
      const x = RG() * 256, y = RG() * 256, w = 1 + RG() * 5
      for (const [ox, oy] of [[0, 0], [256, 0], [0, 256], [-256, 0], [0, -256]]) { q.beginPath(); q.ellipse(x + ox, y + oy, w, w * (0.4 + RG() * 0.6), RG() * 3, 0, 7); q.fill() }
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    return t
  })()
  disposable.push(grain)
  // дымка слабее на высоте: вершины дальних гор видны над горизонтом
  const hazeUni = { value: new THREE.Vector2(mtnOn ? Math.max(14, mAmp * 0.15) : 1e6, mtnOn ? Math.max(40, mAmp * 0.7) : 2e6) }
  const landShader = (sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }): void => {
    sh.uniforms.uGrain = { value: grain }
    sh.uniforms.uHz = hazeUni
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGr; varying float vGy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGr = position.xz; vGy = position.y;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGr; varying float vGy; uniform sampler2D uGrain; uniform vec2 uHz;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= 0.55 + 0.45 * texture2D(uGrain, vGr * 0.09).r + 0.45 * texture2D(uGrain, vGr * 0.31 + 0.37).r;')
      .replace('#include <fog_fragment>', '#ifdef USE_FOG\nfloat fogK = smoothstep(fogNear, fogFar, vFogDepth) * (1.0 - 0.6 * smoothstep(uHz.x, uHz.y, vGy));\ngl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogK);\n#endif')
  }
  groundMat.onBeforeCompile = landShader as never
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.receiveShadow = true
  scene.add(ground)
  if (mtnOn) {
    // «юбка»: местность за краем земли города — предгорья и хребты до горизонта; сетка вдвое реже,
    // внутренний ряд клеток заходит под землю города, чтобы на стыке не было щелей
    const nxi = Math.round(GN / 2), nzi = Math.max(4, Math.round(GM / 2)), csx = EW / nxi, csz = EH / nzi
    const kx = Math.ceil(SKIRT / csx), kz = Math.ceil(SKIRT / csz), NX = nxi + kx * 2, NZ = nzi + kz * 2, L = NX + 1
    const n = L * (NZ + 1), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), hs = new Float32Array(n)
    for (let j = 0; j <= NZ; j++)
      for (let i = 0; i <= NX; i++) {
        const q = j * L + i, ii = i - kx, jj = j - kz, x = x0 + ii * csx, z = z0 + jj * csz
        const inside = ii >= 0 && ii <= nxi && jj >= 0 && jj <= nzi
        const inner = ii > 0 && ii < nxi && jj > 0 && jj < nzi
        hs[q] = inner ? heightAt(x, z) - 6 : inside ? heightAt(x, z) : rawHeight(x, z)
        pos[q * 3] = x; pos[q * 3 + 1] = hs[q]; pos[q * 3 + 2] = z
      }
    const tmp = new THREE.Color()
    for (let j = 0; j <= NZ; j++)
      for (let i = 0; i <= NX; i++) {
        const q = j * L + i, y = hs[q]
        paintLand(tmp, pos[q * 3], pos[q * 3 + 2], y, Math.hypot((hs[i < NX ? q + 1 : q - 1] - y) / csx, (hs[j < NZ ? q + L : q - L] - y) / csz))
        col[q * 3] = tmp.r; col[q * 3 + 1] = tmp.g; col[q * 3 + 2] = tmp.b
      }
    const idx: number[] = []
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++) {
        const ii = i - kx, jj = j - kz
        if (ii >= 1 && ii < nxi - 1 && jj >= 1 && jj < nzi - 1) continue
        const a = j * L + i, b = a + 1, c = a + L, d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const mat = new THREE.MeshLambertMaterial({ color: groundFill, vertexColors: true })
    mat.onBeforeCompile = landShader as never
    scene.add(new THREE.Mesh(geo, mat))
    disposable.push(geo, mat)
  }
  disposable.push(groundGeo, groundMat)

  // ---------- материалы и куски города ----------
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  const tileTex = tileTexture()
  const roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: tileTex })
  const glowMat = new THREE.MeshBasicMaterial({ color: '#39464f', toneMapped: false, side: THREE.DoubleSide, fog: true })
  // фактура штукатурки, камня и дерева: шум по мировым координатам, чтобы стены не были плоской заливкой
  solidMat.onBeforeCompile = ((sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }): void => {
    sh.uniforms.uGrain = { value: grain }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform sampler2D uGrain;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat wg = texture2D(uGrain, vec2(vWp.x + vWp.z, vWp.y) * 0.21).r * 0.6 + texture2D(uGrain, vec2(vWp.x - vWp.z, vWp.y * 1.3) * 0.67 + 0.31).r * 0.4;\ndiffuseColor.rgb *= 0.8 + 0.36 * wg;')
  }) as never
  disposable.push(solidMat, roofMat, glowMat, tileTex)
  const CHUNK = Math.max(90, radius / 3)
  interface Chunk { solid: Bucket; roof: Bucket; glow: Bucket }
  const chunks = new Map<string, Chunk>()
  const chunkAt = (x: number, z: number): Chunk => {
    const key = `${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`
    let c = chunks.get(key)
    if (!c) chunks.set(key, (c = { solid: new Bucket(), roof: new Bucket(), glow: new Bucket() }))
    return c
  }
  // детальность по размеру: столица в десять тысяч домов и деревня строятся по-разному
  const detail = opts.mobile ? (N > 900 ? 0 : N > 250 ? 1 : 2) : N > 5000 ? 0 : N > 1800 ? 1 : 2

  const tops = new Float32Array(N)
  const crenel = (ch: Chunk, a: P2, b: P2, y: number, col: string, t: number, step = 2.1): void => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[1] - a[1], b[0] - a[0])
    const n = Math.max(1, Math.floor(len / step))
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n
      ch.solid.box(a[0] + (b[0] - a[0]) * f, y, a[1] + (b[1] - a[1]) * f, (len / n) * 0.55, 1.1, t, col, rot)
    }
  }

  const monStyle: MonStyle = { wall: mixHex(st.wall, st.plaster[0], 0.35), stone: st.stone, roof: S.style === 'styria' ? '#34323a' : st.roof[0], dark: S.style === 'styria' ? '#1f1c24' : st.tower, pillar: mixHex(st.plaster[2], '#ffffff', 0.3), banner: S.style === 'styria' ? '#2a1a2a' : S.style === 'church' ? '#d8c070' : '#8f2f2f', timber: st.timber }
  const monOut: MonOut = { smoke: [], beacon: [] }
  const chimneys: [number, number, number][] = []
  // кабачок: вывеска на столбе, столы и лавки
  const tavern = (q: { x: number; z: number; y: number; rot: number; ch: Chunk }): void => {
    const c = Math.cos(q.rot), n = Math.sin(q.rot), b = q.ch.solid
    b.box(q.x + c * 2, q.y, q.z + n * 2, 0.14, 3.1, 0.14, st.timber)
    b.box(q.x + c * 2, q.y + 3, q.z + n * 2, 1, 0.08, 0.08, st.timber, q.rot)
    b.box(q.x + c * 2.3, q.y + 2.2, q.z + n * 2.3, 0.75, 0.75, 0.06, S.style === 'styria' ? '#3a2c3a' : '#a8862e', q.rot)
    for (const sd of [-1.1, 0.5]) {
      const tx = q.x + c * sd, tz = q.z + n * sd
      b.box(tx, q.y, tz, 1.2, 0.8, 0.7, '#7a5a38', q.rot)
      b.box(tx - n * 0.65, q.y, tz + c * 0.65, 1.2, 0.42, 0.26, '#6a4a2c', q.rot)
      b.box(tx + n * 0.65, q.y, tz - c * 0.65, 1.2, 0.42, 0.26, '#6a4a2c', q.rot)
      b.cyl(tx, q.y + 0.8, tz, 0.09, 0.16, 6, '#d9c48e')
    }
  }
  for (const m of mons) tops[m.i] = buildMonument(m.kind, chunkAt(m.x, m.z), m.x, m.z, m.rot, m.L, m.W, heightAt(m.x, m.z), monStyle, monOut)
  // кварталы народов: где живут дварфы, эльфы или орки, часть кварталов строится в их духе — так каждый город свой
  const population = populationFor({ state: opts.state, culture: opts.culture, style: S.style, forest: S.forest, hills: !!S.hills, rocky: !!S.rocky, water: hasWater, buildings: N })
  const popTotal = population.reduce((s, q) => s + q.weight, 0) || 1
  const shareOf = (ids: string[]): number => population.filter((q) => ids.includes(q.race.id)).reduce((s, q) => s + q.weight, 0) / popTotal
  const CULT_SHARE = { dwarf: shareOf(['dwarves', 'gnomes']), elf: shareOf(['high-elves', 'wood-elves', 'sylva', 'eleons', 'eluins']), orc: shareOf(['orcs', 'ogres', 'goliaths', 'tsions']) }
  type Cult = 'human' | 'gnome' | keyof typeof CULT_SHARE
  const dwStyle = S.style === 'dwarf' || S.style === 'deep'
  const gnStyle = S.style === 'gnome'
  const elStyle = S.style === 'elf' || S.style === 'silva'
  const pickCult = (u: number, k: number): Cult => {
    let acc = 0
    for (const [c, s] of Object.entries(CULT_SHARE) as [Cult, number][]) {
      acc += s * k
      if (u < acc) return c
    }
    return 'human'
  }
  const distRnd = rng(hashOf(seedName) + 4049)
  const distCult = S.dist.map(() => pickCult(distRnd(), 1.6))
  const houseCult = (idx: number, u: number): Cult => {
    if (dwStyle) return 'dwarf'
    if (gnStyle) return 'gnome'
    if (elStyle) return u < 0.85 ? 'elf' : 'human'
    if (S.style === 'olek') return 'human' // элуины строят срубы, а не эльфийские дома
    const dc = distCult[blds[idx].d] ?? 'human'
    if (dc !== 'human') return u < 0.75 ? dc : 'human'
    return pickCult(u, 0.35)
  }
  const CULT_LOOK = {
    dwarf: { wall: ['#8d8579', '#7d766c', '#9a9184', '#867c6e'], roof: ['#4f4a45', '#5b5149', '#463f3a', '#5e5048'], shutter: '#3b3633', pitch: 0.55, eave: -0.3 },
    elf: { wall: ['#eef0e4', '#e2e9dc', '#f2eee0', '#dfe6d6'], roof: ['#4f7a5a', '#3f6b66', '#5c7f4a', '#6a8a6a'], shutter: '#5d7f5a', pitch: 1.75, eave: 0.9 },
    orc: { wall: ['#6b5136', '#5c4630', '#74583a', '#4f3c2a'], roof: ['#7d6a4a', '#6a5a3c', '#857150', '#5f5238'], shutter: '', pitch: 0.85, eave: -0.2 },
    gnome: { wall: ['#d9c27a', '#c97a5a', '#7aa3a0', '#e0d0b0', '#b8c9a0', '#d99a6a', '#c9b0d0'], roof: ['#4f8a78', '#5a9a86', '#a8552f', '#3f6a8a', '#8a3a3a', '#b8783a'], shutter: '#2f5a6a', pitch: 1.45, eave: 0.4 }
  }
  const FLOWERS = ['#c0504d', '#d9a441', '#8e5ea2', '#e07a9a', '#f0d36a']
  // у каждого поселения своё лицо: оттенок штукатурки, тон крыш, крутизна скатов, ставни, сколько цветов и дворов
  const TR = rng(hashOf(seedName) + 77)
  const town = {
    tint: ['#ffffff', '#f3e3c4', '#e6eee6', '#f6e8dc', '#ece0d4', '#f0efe0'][Math.floor(TR() * 6)],
    tintK: 0.1 + TR() * 0.22,
    roofTone: ['#7a3a2a', '#5d4a3e', '#8a5a30', '#4a5a6a', '#6a6a3a', '#9a4a2a'][Math.floor(TR() * 6)],
    roofK: TR() * 0.3,
    pitchK: 0.85 + TR() * 0.35,
    shutters: [['#3f6a4a', '#2f4f6a'], ['#8a3a2a', '#3a3a3a'], ['#4a6a8a', '#d8c9a0'], ['#5a7a3a', '#8a6a3a'], ['#2a4a6a', '#6a2a2a']][Math.floor(TR() * 5)],
    flowers: 0.5 + TR() * 1.0,
    // дворы с огородами: в деревне почти у каждого дома, в большом городе — только на окраинах
    yard: N < 80 ? 0.85 : N < 300 ? 0.45 : 0.12
  }
  const AWNINGS = S.style === 'styria' ? ['#2a2230', '#3a2c3a', '#40303a'] : S.style === 'viking' ? ['#6a5440', '#7a6650', '#5a4634', '#8a7a62'] : ['#b03a2e', '#d9b44a', '#3f6a8a', '#5d8a4a', '#c97a3a', '#e8e0c8']
  // один дом заданной детальности; случайность своя у каждого дома, поэтому при достройке он остаётся тем же
  const buildHouse = (idx: number, ch: Chunk, detail: number, first: boolean): void => {
    const b = blds[idx]
    let r = b.r.filter((p, i) => { const q = b.r[(i + 1) % b.r.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.25 })
    if (r.length < 3) { r = b.r; if (r.length < 3) return }
    const ctr = centerOf(r)
    const base = heightAt(ctr[0], ctr[1])
    const area = Math.abs(areaOf(r))
    const kind0 = kindOf(idx)
    const vik = S.style === 'viking'
    // у викингов цитадель и ратуша — не каменные башни, а большие длинные залы
    const hall = vik && (kind0 === 'keep' || kind0 === 'civic')
    const kind = hall ? '' : kind0
    const rv = rng(hashOf(seedName) + idx * 7919 + 13)
    const rx = rng(hashOf(seedName) + idx * 104729 + 77)
    const orient = areaOf(r) > 0 ? 1 : -1

    // ось конька — длинная сторона наименьшего описанного прямоугольника
    let best = 1e18, ux = 1, uz = 0, u0 = 0, u1 = 0, v0 = 0, v1 = 0
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length]
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
      const ax = (q[0] - p[0]) / l, az = (q[1] - p[1]) / l
      let a0 = 1e9, a1 = -1e9, c0 = 1e9, c1 = -1e9
      for (const w of r) {
        const u = w[0] * ax + w[1] * az, v = -w[0] * az + w[1] * ax
        a0 = Math.min(a0, u); a1 = Math.max(a1, u); c0 = Math.min(c0, v); c1 = Math.max(c1, v)
      }
      const s = (a1 - a0) * (c1 - c0)
      if (s < best) {
        best = s
        if (a1 - a0 >= c1 - c0) { ux = ax; uz = az; u0 = a0; u1 = a1; v0 = c0; v1 = c1 } else { ux = -az; uz = ax; u0 = c0; u1 = c1; v0 = -a1; v1 = -a0 }
      }
    }
    const vc = (v0 + v1) / 2, hw = Math.max(0.8, (v1 - v0) / 2)
    const toUV = (p: P2): P2 => [p[0] * ux + p[1] * uz, -p[0] * uz + p[1] * ux - vc]
    const fromUV = (u: number, v: number): P2 => [u * ux - (v + vc) * uz, u * uz + (v + vc) * ux]

    let floors = 1 + (area > 55 ? 1 : 0) + (area > 110 && rv() < 0.55 ? 1 : 0)
    if (rv() < 0.25) floors = Math.max(1, floors - 1)
    if (N > 200 && dists.length) floors += st.floors
    const cult: Cult = kind ? 'human' : houseCult(idx, rng(hashOf(seedName) + idx * 104729)())
    const look = cult === 'human' ? null : CULT_LOOK[cult]
    if (cult === 'dwarf' || cult === 'orc') floors = Math.max(1, floors - 1)
    if (cult === 'gnome' && area < 140) floors += 1
    // дварфы лиги: плоская каменная крыша с парапетом, на ней сушат руду
    const flat = dwStyle && !kind && !hall
    if (vik) floors = 1
    const plaster0 = look ? look.wall[Math.floor(rv() * look.wall.length)] : mixHex(st.plaster[Math.floor(rv() * st.plaster.length)], town.tint, town.tintK)
    // у каждого дома свой оттенок стены: светлее или темнее, чуть к общей пастельной гамме
    const plaster = mixHex(mixHex(plaster0, rx() < 0.5 ? '#e8dcc0' : '#b9a98c', rx() * (look ? 0.1 : 0.22)), '#cfc2a4', look ? 0.04 : 0.12)
    const quoin = rx() < 0.4
    const pal = look ? look.roof : S.droof[b.d] ?? S.roof ?? st.roof
    const roofCol = kind === 'temple' ? (vik ? mixHex(st.tower, '#8a6a48', 0.4) : st.tower) : kind === 'keep' ? mixHex(st.stone, '#000', 0.2) : look ? pal[Math.floor(rv() * pal.length)] : mixHex(pal[Math.floor(rv() * pal.length)], town.roofTone, town.roofK * rv())
    const stoneBody = !vik && (kind === 'temple' || kind === 'keep' || kind === 'civic')
    // хоф у викингов — деревянный, но светлее жилых срубов, чтобы не сливаться в чёрную глыбу
    const wallCol = stoneBody ? mixHex(st.wall, st.plaster[0], 0.3) : vik && kind === 'temple' ? mixHex(plaster, '#9a7a52', 0.35) : plaster
    const eave = vik && !kind ? (hall ? 4.4 : 2.7) : vik && kind === 'temple' ? Math.min(7, 4.5 + Math.sqrt(area) * 0.1) : kind === 'temple' ? Math.min(16, 8 + Math.sqrt(area) * 0.2) : kind === 'keep' ? Math.min(22, 11 + Math.sqrt(area) * 0.3) : kind === 'civic' ? 3.3 * Math.max(floors, 3) : 0.5 + floors * 3 + (look?.eave ?? 0)
    // эльфы строят высокие крутые крыши, дварфы — низкие каменные, орки — приземистые
    const rise = flat ? 0 : Math.min(hw * st.pitch * (look?.pitch ?? 1) * (kind ? 1 : town.pitchK), kind === 'keep' ? 0 : hw > 8 ? (cult === 'elf' ? 11 : hall ? 12 : vik ? 9 : 7) : 99)
    const pitch = flat ? 0 : rise / hw
    const topAt = (p: P2): number => { const v = Math.abs(toUV(p)[1]); return base + eave + Math.max(-1.5, rise - v * pitch) }
    tops[idx] = base + eave + rise + (flat ? 0.6 : 0)
    // Сильвленд: каждый дом — живое дерево с дуплом; ни стен, ни крыш. Дверь, окна и лестница вырезаны в стволе
    if (S.style === 'silva') {
      const big = kind === 'keep' || kind === 'civic' || kind === 'temple'
      const R = Math.min(3.8, (0.8 + Math.sqrt(area) * 0.13) * (big ? 1.45 : 1))
      const sp = big ? (kind === 'temple' ? 1 : 0) : Math.floor(rv() * 6)
      const H = 4.8 + floors * 2.9 + (big ? 4.5 : 0) + (sp === 4 ? 3 : 0)
      const BARK = ['#6a4a2c', '#e2ded0', '#7a6a50', '#8a8478', '#5a4030', '#6a5a3e'][sp]
      const LEAF = [['#4f7a34', '#5a8a3a', '#3f6a2e'], ['#8aae48', '#9ab852', '#7a9e42'], ['#6a9a3e', '#76a846', '#5a8a38'], ['#5a7a3a', '#8a7a2e', '#6a8a3a'], ['#2f5a3a', '#3a6a42', '#27503a'], ['#8aa050', '#9ab060', '#7a9444']][sp]
      const lc = (): string => LEAF[Math.floor(rv() * LEAF.length)]
      const rT = (y: number): number => R * (1 - 0.28 * ((y - base) / H))
      // направление двери: к самой длинной стороне участка
      let bi = 0, bl = 0
      for (let i = 0; i < r.length; i++) { const l = Math.hypot(r[(i + 1) % r.length][0] - r[i][0], r[(i + 1) % r.length][1] - r[i][1]); if (l > bl) { bl = l; bi = i } }
      const mx0 = (r[bi][0] + r[(bi + 1) % r.length][0]) / 2 - ctr[0], mz0 = (r[bi][1] + r[(bi + 1) % r.length][1]) / 2 - ctr[1]
      const a0 = Math.atan2(mz0, mx0) + (rv() - 0.5) * 0.5
      const cx0 = ctr[0], cz0 = ctr[1]
      const polar = (a: number, d: number): [number, number] => [cx0 + Math.cos(a) * d, cz0 + Math.sin(a) * d]
      // ствол и лёгкое расширение у корней
      ch.solid.cyl(cx0, base - 0.5, cz0, R * 1.18, 1.3, 12, BARK, R, false)
      ch.solid.cyl(cx0, base + 0.8, cz0, R, H - 0.8, 12, BARK, R * 0.72, true)
      if (detail >= 1) {
        for (let k = 0; k < 5; k++) {
          const a = a0 + 0.6 + (k / 5) * Math.PI * 2 + (rx() - 0.5) * 0.4, [rx1, rz1] = polar(a, R * 0.8), [rx2, rz2] = polar(a, R + 1.5 + rx() * 1.2)
          const px = -Math.sin(a) * 0.45, pz = Math.cos(a) * 0.45
          ch.solid.tri([rx1, base + 1.5, rz1], [rx2 + px, base - 0.1, rz2 + pz], [rx2 - px, base - 0.1, rz2 - pz], BARK)
          ch.solid.tri([rx1, base + 1.5, rz1], [rx2 - px, base - 0.1, rz2 - pz], [rx2 + px, base - 0.1, rz2 + pz], BARK)
        }
        if (sp === 1) for (let k = 0; k < 7; k++) { const a = rx() * 6.28, y = base + 0.8 + rx() * (H - 1.5), [qx, qz] = polar(a, rT(y) * 0.97); ch.solid.box(qx, y, qz, 0.1, 0.12, 0.5, '#2f2c28', a) }
      }
      // дверь в дупле, лестница из корней
      const [dx0, dz0] = polar(a0, R * 0.95)
      ch.solid.box(dx0, base, dz0, 0.26, 2.15, 1.25, mixHex(BARK, '#000', 0.4), a0)
      ch.solid.box(dx0, base + 0.05, dz0, 0.34, 2.3, 1.45, mixHex(BARK, '#000', 0.2), a0)
      ch.solid.box(dx0, base, dz0, 0.3, 2.1, 1.2, '#241a10', a0)
      ch.glow.box(dx0, base + 0.6, dz0, 0.34, 0.7, 0.5, '#ffffff', a0)
      for (let s = 0; s < 3; s++) { const [sx1, sz1] = polar(a0, R + 0.5 + s * 0.7); ch.solid.box(sx1, base - 0.15, sz1, 0.9, 0.3 + (2 - s) * 0.14, 1.5 - s * 0.2, mixHex(BARK, '#3a2a18', 0.3), a0) }
      // окна-дупла по ярусам
      if (detail >= 1) {
        const nW = Math.min(3, floors + (big ? 1 : 0))
        for (let k = 0; k < nW; k++) {
          const y = base + 2.7 + k * 2.7
          if (y > base + H - 1.4) break
          for (const sg of [-1, 1]) {
            const a = a0 + sg * (0.8 + k * 0.12), [qx, qz] = polar(a, rT(y) * 0.96)
            ch.solid.box(qx, y, qz, 0.24, 0.95, 0.62, mixHex(BARK, '#000', 0.45), a)
            ch.solid.box(qx, y + 0.06, qz, 0.28, 0.8, 0.5, '#1f1810', a)
            if (rx() < 0.65) ch.glow.box(qx, y + 0.12, qz, 0.31, 0.62, 0.38, '#ffffff', a)
          }
        }
      }
      // крона
      const cr = Math.min(8.5, R * 2.5 + 2.3 + (big ? 1.5 : 0))
      const yb = base + H - 1
      if (sp === 4) {
        for (let t = 0; t < 4; t++) { const rr = cr * (0.95 - t * 0.2), y = base + H * 0.3 + t * H * 0.24; ch.solid.cyl(cx0, y, cz0, rr, H * 0.3, 9, lc(), 0.05, true) }
      } else if (sp === 1) {
        ch.solid.cyl(cx0, yb - 0.5, cz0, cr * 0.5, cr * 0.5, 8, lc(), cr * 0.8)
        ch.solid.cyl(cx0, yb, cz0, cr * 0.8, cr * 0.7, 8, lc(), cr * 0.9)
        ch.solid.cyl(cx0, yb + cr * 0.7, cz0, cr * 0.9, cr * 0.6, 8, lc(), cr * 0.25)
      } else {
        ch.solid.cyl(cx0, yb - 0.8, cz0, cr * 0.45, cr * 0.5, 9, lc(), cr * 0.95)
        ch.solid.cyl(cx0, yb - 0.3, cz0, cr * 0.95, cr * 0.7, 9, lc(), cr)
        ch.solid.cyl(cx0, yb + cr * 0.4, cz0, cr, cr * 0.6, 9, lc(), cr * 0.45)
        if (detail >= 1) for (let k = 0; k < 3; k++) { const a = rx() * 6.28, [bx, bz] = polar(a, cr * 0.7); ch.solid.cyl(bx, yb - 0.2 + rx() * 1.2, bz, cr * 0.42, cr * 0.45, 7, lc(), cr * 0.2) }
      }
      if (sp === 5 && detail >= 1) for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.28, [qx, qz] = polar(a, cr * 0.97), px = -Math.sin(a) * 0.3, pz = Math.cos(a) * 0.3; ch.solid.quad([qx - px, yb - 0.2, qz - pz], [qx + px, yb - 0.2, qz + pz], [qx + px, yb - 3.2, qz + pz], [qx - px, yb - 3.2, qz - pz], LEAF[1]) }
      // фонари в кроне и лианный подъёмник
      if (detail >= 1) {
        for (let k = 0; k < (big ? 4 : 2); k++) { const a = a0 + 0.5 + k * 1.6, [lx, lz] = polar(a, cr * 0.55); ch.solid.box(lx, yb + 0.2, lz, 0.05, 1.2, 0.05, '#4a5a2a'); ch.glow.box(lx, yb - 0.4, lz, 0.34, 0.5, 0.34, '#ffffff', a) }
        if (H > 8 && rx() < 0.55) { const a = a0 + 2.4, [lx, lz] = polar(a, R + 0.35); ch.solid.box(lx, base, lz, 0.06, H - 1, 0.06, '#5a6a2e'); ch.solid.box(lx, base + 0.6 + rx() * (H * 0.5), lz, 0.9, 0.12, 0.9, '#8a6a3a', a) }
        if (first && rv() < 0.4 && chimneys.length < 400) chimneys.push([cx0, base + H * 0.6, cz0])
      }
      // ветви-мостки к соседним деревьям
      if (detail >= 1) {
        for (let k = 0; k < 4; k++) {
          const a = a0 + k * Math.PI / 2 + 0.7
          for (let dd = 4; dd <= 15; dd += 1.5) {
            const [qx, qz] = polar(a, dd), v = gridAt(qx, qz)
            if (v > 0 && v !== idx + 1) {
              if (v - 1 < idx) break
              const oc = centerOf(blds[v - 1].r), L = Math.hypot(oc[0] - cx0, oc[1] - cz0), an = Math.atan2(oc[1] - cz0, oc[0] - cx0)
              const y = Math.max(base, heightAt(oc[0], oc[1])) + 4.6
              const ln = L - R - 1.4
              if (ln > 1.5 && ln < 16) {
                const [px, pz] = polar(an, R + 0.7 + ln / 2)
                ch.solid.box(px, y, pz, ln, 0.14, 1.0, '#7a5a30', an)
                for (const sg of [-1, 1]) ch.solid.box(px - Math.sin(an) * sg * 0.5, y + 0.8, pz + Math.cos(an) * sg * 0.5, ln, 0.05, 0.05, '#5a6a2e', an)
              }
              break
            }
          }
        }
      }
      tops[idx] = base + H + cr * 0.6
      return
    }

    // стены: каждую сторону делим на коньке, чтобы щипец вышел ровным
    const edges: { a: P2; b: P2; n: P2; len: number; hidden: boolean }[] = []
    for (let i = 0; i < r.length; i++) {
      const a = r[i], c = r[(i + 1) % r.length]
      const va = toUV(a)[1], vb = toUV(c)[1]
      const parts: P2[] = [a]
      if (va > 0 !== vb > 0 && va !== vb && kind !== 'keep') { const t = va / (va - vb); parts.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]) }
      parts.push(c)
      for (let s = 0; s + 1 < parts.length; s++) {
        const p = parts[s], q = parts[s + 1]
        const tp = kind === 'keep' ? base + eave : topAt(p), tq = kind === 'keep' ? base + eave : topAt(q)
        ch.solid.quad([p[0], base - 2, p[1]], [q[0], base - 2, q[1]], [q[0], tq, q[1]], [p[0], tp, p[1]], wallCol)
      }
      const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1
      const nx = ((c[1] - a[1]) / l) * orient, nz = (-(c[0] - a[0]) / l) * orient
      const mx = (a[0] + c[0]) / 2 + nx * 1.1, mz = (a[1] + c[1]) / 2 + nz * 1.1
      const other = gridAt(mx, mz)
      edges.push({ a, b: c, n: [nx, nz], len: l, hidden: other > 0 && other !== idx + 1 })
      // цоколь; у дварфов — высокий, из тёмного камня
      if (detail >= 1 && !edges[edges.length - 1].hidden) {
        const off = 0.07, ph = cult === 'dwarf' ? 1.5 : 0.55, pc = cult === 'dwarf' ? mixHex(st.stone, '#000', 0.25) : st.stone
        ch.solid.quad([a[0] + nx * off, base - 0.5, a[1] + nz * off], [c[0] + nx * off, base - 0.5, c[1] + nz * off], [c[0] + nx * off, base + ph, c[1] + nz * off], [a[0] + nx * off, base + ph, a[1] + nz * off], pc)
      }
    }

    // крыша: два ската по контуру со свесом; плоская — у цитадельных башен
    if (flat) {
      const tr = THREE.ShapeUtils.triangulateShape(r.map(([x, z]) => new THREE.Vector2(x, z)), [])
      for (const [i, j, m] of tr) ch.solid.tri([r[i][0], base + eave, r[i][1]], [r[j][0], base + eave, r[j][1]], [r[m][0], base + eave, r[m][1]], mixHex(roofCol, '#000', 0.08))
      // парапет из каменных плит по краю крыши
      if (detail >= 1) for (const e of edges) {
        const rot = Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0])
        ch.solid.box((e.a[0] + e.b[0]) / 2 - e.n[0] * 0.18, base + eave - 0.05, (e.a[1] + e.b[1]) / 2 - e.n[1] * 0.18, e.len + 0.36, 0.6, 0.36, mixHex(wallCol, '#000', 0.18), rot)
      }
      // руда и мешки на крыше
      if (detail >= 2 && rv() < 0.4) ch.solid.box(ctr[0], base + eave, ctr[1], 1.2, 0.4, 0.9, rv() < 0.5 ? '#6a4a3a' : '#8a7a5a', rv() * 3)
    } else if (kind === 'keep') {
      const flat = r.map(toUV)
      const tris = THREE.ShapeUtils.triangulateShape(flat.map(([u, v]) => new THREE.Vector2(u, v)), [])
      for (const [i, j, m] of tris) ch.solid.tri([r[i][0], base + eave, r[i][1]], [r[j][0], base + eave, r[j][1]], [r[m][0], base + eave, r[m][1]], roofCol)
      for (const e of edges) crenel(ch, e.a, e.b, base + eave, wallCol, 0.7, 2.2)
      for (const p of r) if (r.length <= 10) ch.solid.cyl(p[0], base, p[1], 2.2, eave + 2.2, 8, wallCol)
      if (area > 90) {
        const s = Math.sqrt(area) * 0.42
        ch.solid.cyl(ctr[0], base + eave - 1, ctr[1], s * 0.6, 7, 10, mixHex(wallCol, '#000', 0.06))
        for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; ch.solid.box(ctr[0] + Math.cos(a) * s * 0.6, base + eave + 6, ctr[1] + Math.sin(a) * s * 0.6, 0.9, 1, 0.6, wallCol, a + 1.57) }
        ch.solid.box(ctr[0], base + eave + 6, ctr[1], 0.1, 5, 0.1, '#2a2420')
        ch.solid.box(ctr[0] + 0.8, base + eave + 9.8, ctr[1], 1.6, 1, 0.05, S.style === 'styria' ? '#2a1a2a' : '#8f2f2f')
      }
    } else {
      const over = grow(r, vik ? 0.8 : kind ? 0.5 : 0.35)
      const uv = over.map(toUV)
      const LIFT = 0.02
      // фактический размах крыши по линии конька (для непрямоугольных контуров он короче описанного прямоугольника)
      let rU0 = 1e9, rU1 = -1e9
      for (const sgn of [1, -1]) {
        const half = clipHalf(uv, sgn)
        for (const q of half) if (Math.abs(q[1]) < 1e-4) { rU0 = Math.min(rU0, q[0]); rU1 = Math.max(rU1, q[0]) }
        if (half.length < 3) continue
        const tris = THREE.ShapeUtils.triangulateShape(half.map(([u, v]) => new THREE.Vector2(u, v)), [])
        const P = (q: P2): V3 => { const w = fromUV(q[0], q[1]); return [w[0], base + eave + rise - Math.abs(q[1]) * pitch + LIFT, w[1]] }
        const slope = Math.sqrt(1 + pitch * pitch)
        for (const [i, j, m] of tris) {
          const A = half[i], B = half[j], D = half[m]
          ch.roof.tri(P(A), P(B), P(D), roofCol, S.style === 'styria' ? 1.5 : 1, [A[0] / 2.4, (Math.abs(A[1]) * slope) / 2.4, B[0] / 2.4, (Math.abs(B[1]) * slope) / 2.4, D[0] / 2.4, (Math.abs(D[1]) * slope) / 2.4])
        }
      }
      // конёк
      if (detail >= 1 && rU1 - rU0 > 0.6) {
        const a = fromUV(rU0 + 0.05, 0), c = fromUV(rU1 - 0.05, 0), y = base + eave + rise + 0.02
        ch.solid.box((a[0] + c[0]) / 2, y - 0.08, (a[1] + c[1]) / 2, Math.hypot(c[0] - a[0], c[1] - a[1]), 0.18, 0.28, mixHex(roofCol, '#000', 0.35), Math.atan2(c[1] - a[1], c[0] - a[0]))
      }
      // Креит: на щипцах — скрещённые доски, концы которых вырезаны драконьими головами
      if (vik && detail >= 1 && kind !== 'keep') {
        const top = base + eave + rise
        const ov = 0.8
        const strip = (u: number, v0: number, y0: number, v1: number, y1: number, w: number, col: string): void => {
          const dv = v1 - v0, dy = y1 - y0, l = Math.hypot(dv, dy) || 1
          const nv = (-dy / l) * (w / 2), ny = (dv / l) * (w / 2)
          const P = (v: number, y: number): V3 => { const p = fromUV(u, v); return [p[0], y, p[1]] }
          const A = P(v0 + nv, y0 + ny), B = P(v1 + nv, y1 + ny), Cq = P(v1 - nv, y1 - ny), Dq = P(v0 - nv, y0 - ny)
          ch.solid.quad(A, B, Cq, Dq, col)
          ch.solid.quad(Dq, Cq, B, A, col)
        }
        const board = mixHex(st.timber, '#7a5a3a', 0.45)
        const head = hall ? '#6a2a1a' : mixHex(st.timber, '#5a3a22', 0.4)
        const big = hall ? 1.5 : 1
        for (const [u, out] of [[u0 - ov - 0.05, -1], [u1 + ov + 0.05, 1]] as [number, number][]) {
          for (const s of [1, -1]) {
            // доска идёт по краю ската от свеса к коньку и дальше за конёк, перекрещиваясь с другой
            const vE = s * (hw + ov), yE = top - (hw + ov) * pitch
            const vT = -s * 0.55 * big, yT = top + 0.55 * big * pitch
            strip(u, vE, yE, vT, yT, 0.22, board)
            // голова дракона: шея загибается наружу, морда смотрит вперёд
            const vH = vT - s * 0.32 * big, yH = yT + 0.22 * big
            strip(u, vT, yT, vH, yH, 0.22 * big, head)
            strip(u + out * 0.01, vH, yH, vH - s * 0.22 * big, yH - 0.1 * big, 0.17 * big, head)
          }
        }
      }
    }

    // окна, двери, фахверк
    const shutter = vik ? '' : look ? look.shutter : rv() < 0.5 ? town.shutters[Math.floor(rv() * 2)] : st.shutter[Math.floor(rv() * st.shutter.length)]
    // ящики с цветами под окнами первого этажа — у людей и эльфов, не у каждого дома
    const flowers = !vik && !kind && cult !== 'dwarf' && cult !== 'orc' && S.style !== 'styria' && rv() < (cult === 'elf' ? 0.7 : 0.35) * town.flowers
    const litHere = kind === 'temple' ? 0.9 : st.lit
    const wq = (e: (typeof edges)[number], t0: number, t1: number, y0: number, y1: number, off: number): [V3, V3, V3, V3] => {
      const ax = e.a[0] + (e.b[0] - e.a[0]) * t0 + e.n[0] * off, az = e.a[1] + (e.b[1] - e.a[1]) * t0 + e.n[1] * off
      const bx = e.a[0] + (e.b[0] - e.a[0]) * t1 + e.n[0] * off, bz = e.a[1] + (e.b[1] - e.a[1]) * t1 + e.n[1] * off
      return [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]]
    }
    const visible = edges.filter((e) => !e.hidden && e.len > 1.6)
    let door: (typeof edges)[number] | null = null
    if (visible.length) door = visible.reduce((a, e) => (e.len > a.len ? e : a), visible[0])
    // кабачок: вывеска и столы у двери, если перед домом оживлённая улица
    if (door && !kind && detail >= 2 && N > 30 && rv() < 0.07) {
      const cx = (door.a[0] + door.b[0]) / 2 + door.n[0] * 2.4, cz = (door.a[1] + door.b[1]) / 2 + door.n[1] * 2.4
      if (gridAt(cx, cz) === 0) tavern({ x: cx, z: cz, y: base, rot: Math.atan2(door.b[1] - door.a[1], door.b[0] - door.a[0]), ch })
    }
    if (detail >= 1) {
      const storeys = kind === 'temple' ? 1 : kind === 'keep' ? Math.floor(eave / 4) : kind === 'civic' ? 3 : floors
      const fh = kind === 'temple' ? eave - 1 : kind === 'keep' ? 4 : (eave - 0.5) / Math.max(1, storeys)
      for (const e of visible) {
        const count = vik && !kind ? (e.len > 7 ? 1 : 0) : dwStyle && !kind ? Math.min(2, Math.floor(e.len / 5)) : Math.max(0, Math.min(kind === 'temple' ? 6 : 6, Math.floor(e.len / (kind === 'temple' ? 3.4 : 2.7))))
        // дварфы: пояс рун под карнизом и каменные углы
        if (dwStyle && detail >= 2 && !kind) {
          ch.solid.quad(...wq(e, 0, 1, base + eave - 0.75, base + eave - 0.45, 0.05), mixHex(wallCol, '#000', 0.3))
          for (const t0 of [0, 1 - 0.3 / e.len]) ch.solid.quad(...wq(e, t0, t0 + 0.3 / e.len, base + 1.5, base + eave - 0.75, 0.07), mixHex(wallCol, '#fff', 0.12))
        }
        // бревенчатые венцы: тёмные пазы между брёвнами
        if (vik && detail >= 2 && !kind) {
          for (let y = base + 0.62; y < base + eave - 0.12; y += 0.42) ch.solid.quad(...wq(e, 0, 1, y - 0.035, y + 0.035, 0.04), mixHex(wallCol, '#000', 0.45))
          // торцы брёвен на углах
          ch.solid.quad(...wq(e, 0, 0.12 / e.len, base + 0.4, base + eave, 0.06), mixHex(wallCol, '#c8a878', 0.25))
        }
        for (let fl = 0; fl < storeys; fl++) {
          const wy = kind === 'temple' ? base + 2.2 : base + 0.5 + fl * fh + fh * 0.32
          const wh = kind === 'temple' ? eave - 4 : vik ? 0.5 : Math.min(1.25, fh * 0.45)
          if (wy + wh > base + eave - 0.2) continue
          for (let i = 0; i < count; i++) {
            const c = (i + 0.5) / count
            if (e === door && fl === 0 && Math.abs(c - 0.5) < 1.1 / e.len + 0.02) continue
            const hwn = (kind === 'temple' ? 0.45 : kind === 'keep' ? 0.25 : 0.42) / e.len
            const lit = rv() < litHere
            const ce = (i * 2 + fl) % 3 === 0 && count > 1 && detail < 2
            if (ce) continue
            if (detail >= 2 && !kind) {
              ch.solid.quad(...wq(e, c - hwn - 0.08 / e.len, c + hwn + 0.08 / e.len, wy - 0.08, wy + wh + 0.08, 0.05), cult === 'elf' ? '#b59a6a' : st.timber)
              if (shutter) {
                ch.solid.quad(...wq(e, c - hwn - 0.42 / e.len, c - hwn - 0.08 / e.len, wy - 0.02, wy + wh + 0.02, 0.06), shutter)
                ch.solid.quad(...wq(e, c + hwn + 0.08 / e.len, c + hwn + 0.42 / e.len, wy - 0.02, wy + wh + 0.02, 0.06), shutter)
              }
              if (flowers && fl === 0) {
                const fx = e.a[0] + (e.b[0] - e.a[0]) * c + e.n[0] * 0.22, fz = e.a[1] + (e.b[1] - e.a[1]) * c + e.n[1] * 0.22
                const rot = Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0])
                ch.solid.box(fx, wy - 0.3, fz, 1.0, 0.24, 0.3, '#6b4a2c', rot)
                ch.solid.box(fx, wy - 0.06, fz, 0.92, 0.16, 0.26, FLOWERS[Math.floor(rv() * FLOWERS.length)], rot)
              }
            }
            const q = wq(e, c - hwn, c + hwn, wy, wy + wh, 0.08)
            if (lit) ch.glow.quad(...q, '#ffffff')
            else ch.solid.quad(...q, '#2b333b')
            // вблизи у окна есть глубина: каменный подоконник, перемычка и деревянный переплёт крестом
            if (detail >= 2 && !kind && cult !== 'orc') {
              const mx = e.a[0] + (e.b[0] - e.a[0]) * c + e.n[0] * 0.1, mz = e.a[1] + (e.b[1] - e.a[1]) * c + e.n[1] * 0.1
              const rot = Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0]), ww = hwn * 2 * e.len
              ch.solid.box(mx, wy - 0.16, mz, ww + 0.34, 0.1, 0.26, cult === 'elf' ? '#d8d2c0' : st.stone, rot)
              if (!st.framed || cult !== 'human') ch.solid.box(mx, wy + wh + 0.04, mz, ww + 0.26, 0.12, 0.16, cult === 'elf' ? '#b59a6a' : mixHex(st.stone, '#000', 0.12), rot)
              ch.solid.quad(...wq(e, c - 0.035 / e.len, c + 0.035 / e.len, wy, wy + wh, 0.1), st.timber)
              ch.solid.quad(...wq(e, c - hwn, c + hwn, wy + wh * 0.55 - 0.035, wy + wh * 0.55 + 0.035, 0.1), st.timber)
            }
          }
        }
        // фахверк: балки между этажами, стойки, раскосы верхнего этажа
        if (detail >= 2 && st.framed && !kind && cult === 'human') {
          for (let fl = 1; fl <= floors; fl++) {
            const y = base + 0.5 + fl * fh
            if (y > base + eave + 0.05) break
            ch.solid.quad(...wq(e, 0, 1, y - 0.1, y + 0.1, 0.05), st.timber)
          }
          ch.solid.quad(...wq(e, 0, 0.16 / e.len, base + 0.5, base + eave, 0.05), st.timber)
          ch.solid.quad(...wq(e, 1 - 0.16 / e.len, 1, base + 0.5, base + eave, 0.05), st.timber)
          if (floors > 1 && e.len > 3.5) {
            for (const f of [0.34, 0.66]) ch.solid.quad(...wq(e, f - 0.06 / e.len, f + 0.06 / e.len, base + 0.5, base + eave, 0.05), st.timber)
          }
          // раскосы верхнего этажа у углов
          const yb = base + 0.5 + (floors - 1) * fh, yt = base + eave - 0.2
          if (e.len > 3 && yt - yb > 1.5) {
            const w = 0.14 / e.len, run = Math.min(0.3, ((yt - yb) * 0.55) / e.len), c0 = 0.16 / e.len
            for (const [t0, t1] of [[c0 + run, c0], [1 - c0 - run - w, 1 - c0 - w]] as const) {
              const a = wq(e, t0, t0 + w, yb, yb, 0.05), b = wq(e, t1, t1 + w, yt, yt, 0.05)
              ch.solid.quad(a[0], a[1], b[1], b[0], st.timber)
            }
          }
        }
        if (!vik && !kind && !flat) {
          // карниз под свесом крыши
          ch.solid.quad(...wq(e, 0, 1, base + eave - 0.24, base + eave, 0.08), mixHex(wallCol, '#000', 0.2))
          // угловые камни у оштукатуренных домов
          if (detail >= 2 && quoin && !st.framed && cult === 'human') {
            const qc = mixHex(wallCol, st.stone, 0.72)
            for (let k = 0, y = base + 0.55; y + 0.42 < base + eave - 0.3; k++, y += 0.62) {
              const w = (k % 2 ? 0.24 : 0.42) / e.len
              ch.solid.quad(...wq(e, 0, w, y, y + 0.42, 0.06), qc)
              ch.solid.quad(...wq(e, 1 - w, 1, y, y + 0.42, 0.06), qc)
            }
          }
        }
      }
      if (door && !stoneBody && dwStyle) {
        const hd = 0.7 / door.len
        ch.solid.quad(...wq(door, 0.5 - hd - 0.35 / door.len, 0.5 + hd + 0.35 / door.len, base, base + 2.9, 0.06), mixHex(st.stone, '#000', 0.3))
        ch.solid.quad(...wq(door, 0.5 - hd, 0.5 + hd, base, base + 2.3, 0.1), '#7a5a2a')
        ch.solid.quad(...wq(door, 0.5 - hd, 0.5 + hd, base + 1.1, base + 1.25, 0.12), '#b8903a')
      } else if (door && !stoneBody) {
        const hd = 0.55 / door.len
        ch.solid.quad(...wq(door, 0.5 - hd - 0.1 / door.len, 0.5 + hd + 0.1 / door.len, base, base + 2.2, 0.05), st.timber)
        ch.solid.quad(...wq(door, 0.5 - hd, 0.5 + hd, base, base + 2.1, 0.08), mixHex(st.timber, '#6b3f22', 0.5))
        if (detail >= 2) {
          const cx = (door.a[0] + door.b[0]) / 2 + door.n[0] * 0.9, cz = (door.a[1] + door.b[1]) / 2 + door.n[1] * 0.9
          const rot = Math.atan2(door.b[1] - door.a[1], door.b[0] - door.a[0])
          // навес над дверью, столбики, бочка или ящик рядом
          ch.solid.box(cx, base + 2.55, cz, 2.1, 0.14, 1.9, mixHex(roofCol, st.timber, 0.3), rot)
          if (rv() < 0.6) for (const s of [-0.9, 0.9]) ch.solid.box(cx + Math.cos(rot) * s + door.n[0] * 0.75, base, cz + Math.sin(rot) * s + door.n[1] * 0.75, 0.13, 2.55, 0.13, st.timber)
          if (gridAt(cx + door.n[0] * 1.2, cz + door.n[1] * 1.2) === 0 && rv() < 0.5) {
            const sx = cx + Math.cos(rot) * 1.4 + door.n[0] * 0.2, sz = cz + Math.sin(rot) * 1.4 + door.n[1] * 0.2
            if (rv() < 0.5) ch.solid.cyl(sx, base, sz, 0.36, 0.95, 7, '#6e4a2c')
            else ch.solid.box(sx, base, sz, 0.8, 0.7, 0.8, '#8a6a42', rot)
            blockProp(sx, sz, 0.5)
          }
        }
      }
    }
    // дымоход
    // у дварфов трубы есть всегда и толще: дома с горнами
    if (vik && !kind && first && rv() < 0.6 && chimneys.length < 400) {
      // у викингов не трубы, а дымовое отверстие в коньке
      const [cx, cz] = fromUV((u0 + u1) / 2, 0)
      chimneys.push([cx, base + eave + rise + 0.3, cz])
    } else if (!vik && !kind && detail >= 1 && cult !== 'elf' && (cult === 'dwarf' || rv() < 0.55) && hw < 7 && hw > 1.6) {
      const cw = cult === 'dwarf' ? 1.15 : 0.6 + rx() * 0.3
      // труба стоит на самой крыше: все четыре угла внутри контура дома (у Г-образных и косых домов
      // прямоугольник шире контура — раньше труба висела над пустотой), основание ниже ската у нижнего угла
      let cx = 0, cz = 0, v = 0, ok = false
      for (let t = 0; t < 6 && !ok; t++) {
        const u = u0 + (u1 - u0) * (0.2 + rv() * 0.6)
        v = (rv() - 0.5) * Math.max(0, hw - cw) * 0.8
        ;[cx, cz] = fromUV(u, v)
        const h = cw * 0.5 + 0.25
        ok = [[-h, -h], [h, -h], [h, h], [-h, h]].every(([a, b]) => pointIn(fromUV(u + a, v + b), r))
      }
      const y = base + eave + Math.max(-1.5, rise - (Math.abs(v) + cw * 0.5) * pitch) - 0.25
      if (ok) {
      // трубы разной высоты, часть — кирпичные, с горшком наверху
      const chH = 1.5 + rx() * 1.2
      const chCol = cult === 'human' && rx() < 0.45 ? mixHex('#9a6a55', st.stone, 0.3) : st.stone
      ch.solid.box(cx, y, cz, cw, chH, cw, chCol, Math.atan2(uz, ux))
      ch.solid.box(cx, y + chH, cz, cw + 0.2, 0.16, cw + 0.2, mixHex(chCol, '#000', 0.3), Math.atan2(uz, ux))
      if (!dwStyle && detail >= 2 && rx() < 0.6) ch.solid.cyl(cx, y + chH + 0.16, cz, 0.15, 0.38, 6, '#8a5a48', 0.12)
      if (dwStyle) ch.glow.box(cx, y + chH + 0.14, cz, cw * 0.6, 0.04, cw * 0.6, '#ffffff', Math.atan2(uz, ux))
      if (first && chimneys.length < 400) chimneys.push([cx, y + chH + 0.2, cz])
      }
    }
    // слуховые окна на скате — у части домов с простой прямоугольной крышей
    if (!vik && !kind && !flat && detail >= 1 && r.length === 4 && hw > 2.5 && hw < 7 && u1 - u0 > 6 && pitch > 0.35 && rx() < 0.4) {
      const nd = u1 - u0 > 11 && rx() < 0.5 ? 2 : 1, sgn = rx() < 0.5 ? 1 : -1, rot = Math.atan2(uz, ux)
      for (let k = 0; k < nd; k++) {
        const u = u0 + (u1 - u0) * (nd === 1 ? 0.3 + rx() * 0.4 : k ? 0.7 : 0.3)
        const vm = hw * 0.5, yTop = base + eave + rise - vm * pitch + 0.85, yLow = base + eave + rise - (vm + 0.75) * pitch
        const [dx, dz] = fromUV(u, sgn * vm), [fx, fz] = fromUV(u, sgn * (vm + 0.72))
        ch.solid.box(dx, yLow, dz, 1.25, yTop - yLow, 1.4, wallCol, rot)
        ch.roof.box(dx, yTop, dz, 1.6, 0.16, 1.75, roofCol, rot)
        ch.solid.box(fx, yTop - 0.85, fz, 0.7, 0.62, 0.1, '#2b3138', rot)
      }
    }
    // двор по месту: у воды — рыбацкий, на людной улице — лавка, иногда мастерская, в деревне — огород за плетнём
    if (!kind && detail >= 2 && door) {
      const dx = (door.a[0] + door.b[0]) / 2, dz = (door.a[1] + door.b[1]) / 2, [nx, nz] = door.n
      const rot = Math.atan2(door.b[1] - door.a[1], door.b[0] - door.a[0]), co = Math.cos(rot), si = Math.sin(rot)
      const free = (x: number, z: number): boolean => gridAt(x, z) === 0 && waterAt(x, z) < 0.2 && roadAt(x, z) < 0.3
      const at = (along: number, out: number): P2 => [dx + co * along + nx * out, dz + si * along + nz * out]
      const ground = (p: P2): number => heightAt(p[0], p[1])
      const water = hasWater && [4, 7, 10].some((d) => waterAt(dx + nx * d, dz + nz * d) > 0.4)
      const busy = roadAt(dx + nx * 3, dz + nz * 3) > 0.5
      const kindRoll = rv()
      if (water) {
        // сушилка для сетей, перевёрнутая лодка, бочка с уловом
        const p = at(2.4, 2.2)
        if (free(...p)) {
          const y = ground(p)
          for (const s of [-1.2, 1.2]) ch.solid.box(p[0] + co * s, y, p[1] + si * s, 0.1, 1.9, 0.1, st.timber)
          ch.solid.box(p[0], y + 1.75, p[1], 2.6, 0.06, 0.06, st.timber, rot)
          blockProp(p[0], p[1], 1.3)
          ch.solid.quad([p[0] - co * 1.2, y + 1.75, p[1] - si * 1.2], [p[0] + co * 1.2, y + 1.75, p[1] + si * 1.2], [p[0] + co * 1.2 + nx * 0.05, y + 0.5, p[1] + si * 1.2 + nz * 0.05], [p[0] - co * 1.2 + nx * 0.05, y + 0.5, p[1] - si * 1.2 + nz * 0.05], '#8a7a58')
        }
        const q = at(-2.2, 2.6)
        if (free(...q)) {
          const y = ground(q)
          blockProp(q[0], q[1], 1.6)
          ch.solid.box(q[0], y + 0.05, q[1], 3.2, 0.42, 1.05, '#5a4026', rot)
          ch.solid.box(q[0], y + 0.47, q[1], 2.6, 0.12, 0.8, '#6e4e30', rot)
          ch.solid.cyl(...([q[0] + nx * 1.2, y, q[1] + nz * 1.2] as V3), 0.32, 0.8, 7, '#6e4a2c')
        }
      } else if (busy && N > 40 && kindRoll < 0.35) {
        // лавка: полосатый навес над входом, ящики и корзины с товаром
        const awn = AWNINGS[Math.floor(rv() * AWNINGS.length)], wdt = Math.min(3.6, door.len * 0.8)
        const a0: V3 = [dx - co * wdt / 2 + nx * 0.1, base + 2.7, dz - si * wdt / 2 + nz * 0.1], a1: V3 = [dx + co * wdt / 2 + nx * 0.1, base + 2.7, dz + si * wdt / 2 + nz * 0.1]
        const b1: V3 = [a1[0] + nx * 1.7, base + 2.05, a1[2] + nz * 1.7], b0: V3 = [a0[0] + nx * 1.7, base + 2.05, a0[2] + nz * 1.7]
        const stripes = 5
        for (let i = 0; i < stripes; i++) {
          const f0 = i / stripes, f1 = (i + 1) / stripes, L = (A: V3, B: V3, f: number): V3 => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f]
          ch.solid.quad(L(a0, a1, f0), L(a0, a1, f1), L(b0, b1, f1), L(b0, b1, f0), i % 2 ? awn : '#efe8d6')
        }
        for (const s of [-1, 1]) ch.solid.box(dx + co * s * (wdt / 2 - 0.1) + nx * 1.75, base, dz + si * s * (wdt / 2 - 0.1) + nz * 1.75, 0.08, 2.05, 0.08, st.timber)
        for (let i = 0; i < 3; i++) {
          const p = at(-wdt / 2 + 0.5 + i * 0.9, 1.0)
          ch.solid.box(p[0], base, p[1], 0.7, 0.45, 0.6, '#8a6a42', rot)
          blockProp(p[0], p[1], 0.45)
          ch.solid.box(p[0], base + 0.45, p[1], 0.6, 0.14, 0.5, ['#c9843a', '#8fa04a', '#c94a3a', '#d8c070', '#7a4a8a'][Math.floor(rv() * 5)], rot)
        }
      } else if (kindRoll > 0.93 && N > 20) {
        // мастерская: поленница у стены, наковальня на чурбаке, колесо у двери
        const p = at(door.len * 0.35, 0.7)
        if (free(...p)) {
          const y = ground(p)
          blockProp(p[0], p[1], 1.1)
          for (let row = 0; row < 3; row++) ch.solid.box(p[0], y + row * 0.3, p[1], 2.2, 0.3, 0.6, row % 2 ? '#7a5a38' : '#8a6a42', rot)
        }
        const q = at(-1.6, 1.8)
        if (free(...q)) {
          const y = ground(q)
          blockProp(q[0], q[1], 0.4)
          ch.solid.cyl(q[0], y, q[1], 0.35, 0.6, 8, '#6e4a2c')
          ch.solid.box(q[0], y + 0.6, q[1], 0.6, 0.26, 0.26, '#3a3a40', rot)
        }
      }
      // огород за плетнём с задней стороны дома, стог или поленница
      if (rv() < town.yard) {
        const bx = ctr[0] - nx * (hw + 4.2), bz = ctr[1] - nz * (hw + 4.2)
        if (free(bx, bz) && free(bx + co * 3, bz + si * 3) && free(bx - co * 3, bz - si * 3) && free(bx - nx * 2.4, bz - nz * 2.4)) {
          const y = heightAt(bx, bz), fw = 6.4, fd = 4.2
          const corner = (u: number, v: number): P2 => [bx + co * u - nx * v, bz + si * u - nz * v]
          for (let u = -fw / 2; u <= fw / 2; u += 0.7) for (let v = -fd / 2; v <= fd / 2; v += 0.7) { const c = corner(u, v); blockProp(c[0], c[1], 0.4) }
          const posts: P2[] = [corner(-fw / 2, -fd / 2), corner(fw / 2, -fd / 2), corner(fw / 2, fd / 2), corner(-fw / 2, fd / 2)]
          for (let s = 0; s < 4; s++) {
            const A = posts[s], B = posts[(s + 1) % 4], len = Math.hypot(B[0] - A[0], B[1] - A[1]), rr = Math.atan2(B[1] - A[1], B[0] - A[0])
            const n = Math.max(2, Math.round(len / 0.9))
            for (let i = 0; i < n; i++) { const f = i / n; ch.solid.box(A[0] + (B[0] - A[0]) * f, y, A[1] + (B[1] - A[1]) * f, 0.07, 0.95, 0.07, '#7a5e3c') }
            for (const h of [0.35, 0.75]) ch.solid.box((A[0] + B[0]) / 2, y + h, (A[1] + B[1]) / 2, len, 0.06, 0.05, '#6a4e30', rr)
          }
          // грядки: тёмная земля и зелень рядами
          for (let i = 0; i < 4; i++) {
            const v = -fd / 2 + 0.7 + i * 0.95, p = corner(0, v)
            ch.solid.box(p[0], y, p[1], fw - 1.0, 0.14, 0.55, '#5a4430', rot)
            ch.solid.box(p[0], y + 0.14, p[1], fw - 1.4, 0.16, 0.32, ['#5f8a3a', '#6f9a40', '#8aa04a', '#4f7a34'][Math.floor(rv() * 4)], rot)
          }
          const hp = corner(fw / 2 + 1.4, 0)
          if (free(...hp)) {
            blockProp(hp[0], hp[1], 1.1)
            if (rv() < 0.5) ch.solid.cyl(hp[0], y, hp[1], 1.1, 1.9, 9, '#c9b06a', 0.15)
            else for (let row = 0; row < 3; row++) ch.solid.box(hp[0], y + row * 0.28, hp[1], 1.8, 0.28, 0.55, row % 2 ? '#7a5a38' : '#8a6a42', rot + 1.57)
          }
        }
      }
    }
    // гномы: башенка мастерской на углу, медная труба с паром, латунная шестерня на щипце
    if (cult === 'gnome' && !kind && detail >= 1) {
      if (rv() < 0.5 && r.length >= 4) {
        const k = Math.floor(rv() * r.length), [tx, tz] = r[k]
        const tr0 = Math.min(1.3, Math.max(0.8, hw * 0.35)), th = eave + rise * 0.7 + 1.6
        ch.solid.cyl(tx, base - 0.5, tz, tr0, th + 0.5, 10, mixHex(wallCol, '#fff', 0.12))
        ch.solid.cyl(tx, base + th, tz, tr0 + 0.35, 2.4 + tr0, 10, roofCol, 0)
        ch.solid.cyl(tx, base + th + 2.4 + tr0, tz, 0.05, 0.9, 4, '#b8903a', 0.02)
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; ch.glow.box(tx + Math.cos(a) * (tr0 + 0.02), base + th - 1.3, tz + Math.sin(a) * (tr0 + 0.02), 0.32, 0.42, 0.06, '#ffffff', a + Math.PI / 2) }
        tops[idx] = Math.max(tops[idx], base + th + 3.3 + tr0)
      }
      if (rv() < 0.65) {
        const [cx, cz] = fromUV(u0 + (u1 - u0) * (0.25 + rv() * 0.5), hw * 0.3)
        const y = base + eave + rise - hw * 0.3 * pitch - 0.3
        ch.solid.cyl(cx, y, cz, 0.24, 2.1, 7, '#b0703a')
        ch.solid.cyl(cx, y + 2.1, cz, 0.36, 0.25, 7, '#7a8a5a')
        if (first && chimneys.length < 400) chimneys.push([cx, y + 2.4, cz])
      }
      if (detail >= 2 && rise > 1.2) {
        const gr = Math.min(hw * 0.42, 1.25), gy = base + eave + rise * 0.38
        for (const [u, out] of [[u0 - 0.05, -1], [u1 + 0.05, 1]] as [number, number][]) {
          const pts: V3[] = []
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2, rr = i % 2 ? gr : gr * 0.78
            const w = fromUV(u + out * 0.02, Math.cos(a) * rr)
            pts.push([w[0], gy + Math.sin(a) * rr, w[1]])
          }
          const c0 = fromUV(u + out * 0.02, 0), cc: V3 = [c0[0], gy, c0[1]]
          for (let i = 0; i < 20; i++) { ch.solid.tri(cc, pts[i], pts[(i + 1) % 20], '#c9963a'); ch.solid.tri(cc, pts[(i + 1) % 20], pts[i], '#c9963a') }
          const h0 = fromUV(u + out * 0.04, 0)
          ch.solid.box(h0[0], gy - 0.18, h0[1], 0.36, 0.36, 0.36, '#5a4a2a')
        }
      }
    }
    // эльфийский конёк: тонкие резные шпили на концах
    if (cult === 'elf' && detail >= 2) {
      for (const u of [u0 - 0.2, u1 + 0.2]) {
        const [px, pz] = fromUV(u, 0)
        ch.solid.cyl(px, base + eave + rise - 0.1, pz, 0.12, 1.6, 6, '#b59a6a', 0.02)
      }
    }
    // орочьи дома: клыки-колья по углам кровли
    if (cult === 'orc' && detail >= 2) {
      for (const u of [u0 - 0.25, u1 + 0.25]) {
        const [px, pz] = fromUV(u, 0)
        ch.solid.cyl(px, base + eave + rise - 0.6, pz, 0.16, 1.9, 5, '#d8cfb4', 0.02)
      }
    }
    // башня с шатром у храма, башенка с часами у ратуши, крылья у мельницы
    if (kind === 'temple' && vik) {
      // хоф: не каменная колокольня, а ярусная деревянная башенка на коньке, как у ставкирки
      const s = Math.max(2.4, Math.min(5, hw * 0.7)), rot = Math.atan2(uz, ux) + Math.PI / 4, y0 = base + eave + rise * 0.55
      ch.solid.box(ctr[0], y0, ctr[1], s, rise * 0.45 + 2.4, s, wallCol, rot - Math.PI / 4)
      const y1 = base + eave + rise + 2.4
      ch.solid.cyl(ctr[0], y1, ctr[1], s * 0.95, 1.6, 4, roofCol, s * 0.45, true, rot)
      ch.solid.box(ctr[0], y1 + 1.6, ctr[1], s * 0.55, 1.6, s * 0.55, wallCol, rot - Math.PI / 4)
      ch.solid.cyl(ctr[0], y1 + 3.2, ctr[1], s * 0.6, s * 1.1, 4, roofCol, 0, false, rot)
      ch.solid.box(ctr[0], y1 + 3.2 + s * 1.1, ctr[1], 0.14, 1.4, 0.14, '#d8c070')
      tops[idx] = Math.max(tops[idx], y1 + 3.2 + s * 1.1 + 1.4)
    } else if (kind === 'temple') {
      const [tx, tz] = fromUV(u0 + Math.min(hw, (u1 - u0) / 4), 0)
      const s = Math.max(3.4, Math.min(9, hw * 1.25)), th = eave + rise + 8 + Math.sqrt(area) * 0.3, rot = Math.atan2(uz, ux)
      ch.solid.box(tx, base, tz, s, th, s, wallCol, rot)
      ch.solid.cyl(tx, base + th, tz, s * 0.72, s * 2, 4, st.tower, 0, false, rot + Math.PI / 4)
      ch.solid.box(tx, base + th + s * 2, tz, 0.16, 2.4, 0.16, S.style === 'styria' ? '#111' : '#d8c070')
      ch.solid.box(tx, base + th + s * 2 + 1.4, tz, 1.2, 0.16, 0.16, S.style === 'styria' ? '#111' : '#d8c070', rot)
      for (let i = 0; i < 4; i++) {
        const a = rot + (i * Math.PI) / 2
        const wx = tx + (Math.cos(a) * s) / 2, wz = tz + (Math.sin(a) * s) / 2
        const perp = a + Math.PI / 2
        const P = (d: number, y: number): V3 => [wx + Math.cos(perp) * d + Math.cos(a) * 0.06, y, wz + Math.sin(perp) * d + Math.sin(a) * 0.06]
        ch.glow.quad(P(-0.5, base + th - 3.4), P(0.5, base + th - 3.4), P(0.5, base + th - 1), P(-0.5, base + th - 1), '#ffffff')
      }
      tops[idx] = Math.max(tops[idx], base + th + s * 2)
    }
    if (kind === 'civic') {
      const s = Math.min(5, hw), rot = Math.atan2(uz, ux)
      ch.solid.box(ctr[0], base + eave, ctr[1], s, rise + 6, s, wallCol, rot)
      ch.solid.cyl(ctr[0], base + eave + rise + 6, ctr[1], s * 0.72, s * 1.2, 4, roofCol, 0, false, rot + Math.PI / 4)
      tops[idx] = base + eave + rise + 6 + s * 1.2
    }
    if (kind === 'mill') {
      ch.solid.cyl(ctr[0], base + eave, ctr[1], 2.2, 4, 8, wallCol, 1.6)
      ch.solid.cyl(ctr[0], base + eave + 4, ctr[1], 1.9, 2, 8, roofCol, 0, false)
      const rot = Math.atan2(uz, ux)
      const hx = ctr[0] + Math.cos(rot) * 2.1, hz = ctr[1] + Math.sin(rot) * 2.1, hy = base + eave + 4.5
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.4, dx = -Math.sin(rot) * Math.cos(a), dz = Math.cos(rot) * Math.cos(a), dy = Math.sin(a)
        ch.solid.quad([hx, hy, hz], [hx + dx * 7, hy + dy * 7, hz + dz * 7], [hx + dx * 7 + Math.sin(a) * 0, hy + dy * 7 + 1, hz + dz * 7], [hx, hy + 1, hz], '#d9cfb4')
      }
    }
  }
  // дома лежат кусками: большой город строится упрощённо, а вокруг камеры куски достраиваются окнами и фахверком
  interface HouseCell { idxs: number[]; lvl: number; meshes: THREE.Mesh[]; x: number; z: number }
  const HCELL = opts.mobile ? 180 : 120
  const cells = new Map<string, HouseCell>()
  blds.forEach((b, i) => {
    if (removed[i] || monAt.has(i)) return
    const c = centerOf(b.r), key = `${Math.floor(c[0] / HCELL)}:${Math.floor(c[1] / HCELL)}`
    let h = cells.get(key)
    if (!h) cells.set(key, (h = { idxs: [], lvl: detail, meshes: [], x: (Math.floor(c[0] / HCELL) + 0.5) * HCELL, z: (Math.floor(c[1] / HCELL) + 0.5) * HCELL }))
    h.idxs.push(i)
  })
  const makeMeshes = (ch: Chunk): THREE.Mesh[] => {
    const out: THREE.Mesh[] = []
    const add = (b: Bucket, m: THREE.Material, shadow: boolean): void => {
      const geo = b.geometry()
      if (!geo) return
      geo.computeBoundingSphere()
      const mesh = new THREE.Mesh(geo, m)
      mesh.castShadow = shadow
      mesh.receiveShadow = shadow
      scene.add(mesh)
      out.push(mesh)
    }
    add(ch.solid, solidMat, true)
    add(ch.roof, roofMat, true)
    add(ch.glow, glowMat, false)
    return out
  }
  const fillCell = (h: HouseCell, lvl: number, first: boolean): void => {
    const ch: Chunk = { solid: new Bucket(), roof: new Bucket(), glow: new Bucket() }
    for (const i of h.idxs) buildHouse(i, ch, lvl, first)
    for (const m of h.meshes) { scene.remove(m); m.geometry.dispose() }
    h.meshes = makeMeshes(ch)
    h.lvl = lvl
  }
  for (const h of cells.values()) fillCell(h, detail, true)
  let dirty = false
  let upgradeWait = 0
  const upgradeNear = (cam: THREE.Camera, dt: number): void => {
    upgradeWait -= dt
    if (upgradeWait > 0) return
    const low = cam.position.y - heightAt(cam.position.x, cam.position.z) < (opts.mobile ? 45 : 110)
    if (!low) return
    let best: HouseCell | null = null, bd = (opts.mobile ? 1.1 : 1.8) * HCELL
    for (const h of cells.values()) {
      if (h.lvl >= 2) continue
      const d = Math.hypot(h.x - cam.position.x, h.z - cam.position.z)
      if (d < bd) { bd = d; best = h }
    }
    if (best) {
      fillCell(best, 2, false)
      dirty = true
      upgradeWait = 0.12
    }
  }

  // ---------- подъём пешком: поверхности (верх стен, площадки) и лестницы ----------
  // поверхность — повёрнутый прямоугольник, высота растёт линейно вдоль него
  type Climb = { ax: number; az: number; bx: number; bz: number; w: number; ya: number; yb: number }
  const climbs: Climb[] = []
  const surfH = (s: Climb, x: number, z: number): number | null => {
    const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz
    if (l2 < 1e-6) return null
    const px = x - s.ax, pz = z - s.az, t = (px * dx + pz * dz) / l2
    if (t < 0 || t > 1) return null
    if (Math.abs(px * dz - pz * dx) / Math.sqrt(l2) > s.w / 2) return null
    return s.ya + (s.yb - s.ya) * t
  }
  // лестница от земли в (sx,sz) до высоты hEnd в (ex,ez); tail — хвост у стены, который не проверяем на занятость
  const addStair = (sx: number, sz: number, ex: number, ez: number, w: number, hEnd: number, c1: string, c2: string, tail: number, chk?: number[], okWall = false): boolean => {
    const L = Math.hypot(ex - sx, ez - sz)
    if (L < 2) return false
    const ux = (ex - sx) / L, uz = (ez - sz) / L, px = -uz, pz = ux
    const y0 = heightAt(sx, sz)
    if ((hEnd - y0) / L > 0.7 || hEnd < y0 + 1) return false
    for (let d = 0; d <= L - tail; d += 0.75) {
      const lin = y0 + ((hEnd - y0) * d) / L
      for (const o of chk ?? [-w / 2, 0, w / 2]) {
        const x = sx + ux * d + px * o, z = sz + uz * d + pz * o
        if ((gridAt(x, z) !== 0 && !(okWall && gridAt(x, z) === -1)) || heightAt(x, z) < -0.2 || heightAt(x, z) > lin + 0.5) return false
      }
    }
    const n = Math.max(2, Math.ceil(L / 0.7)), riser = (hEnd - y0) / n, rot = Math.atan2(uz, ux)
    // деревянная лестница: ступени-доски, две тетивы-балки, столбы-опоры и перила
    const line = (d: number): number => y0 + riser * 0.5 + ((hEnd - y0) * d) / L
    const q2 = (ch: Chunk, a: V3, b: V3, d2: V3, e: V3, col: string): void => { ch.solid.quad(a, b, d2, e, col); ch.solid.quad(e, d2, b, a, col) }
    const beam = (off: number, dA: number, dB: number, yA: number, yB: number, t: number, hg: number, col: string): void => {
      const mx = sx + ux * (dA + dB) / 2, mz = sz + uz * (dA + dB) / 2, ch = chunkAt(mx, mz)
      const P = (d: number, l: number, y: number): V3 => [sx + ux * d + px * (off + l), y, sz + uz * d + pz * (off + l)]
      for (const l of [-t / 2, t / 2]) q2(ch, P(dA, l, yA - hg), P(dB, l, yB - hg), P(dB, l, yB), P(dA, l, yA), col)
      q2(ch, P(dA, -t / 2, yA), P(dB, -t / 2, yB), P(dB, t / 2, yB), P(dA, t / 2, yA), col)
    }
    for (let k = 0; k < n; k++) {
      const d = ((k + 0.5) * L) / n, x = sx + ux * d, z = sz + uz * d
      const top = y0 + riser * (k + 1)
      chunkAt(x, z).solid.box(x, top - 0.14, z, L / n + 0.04, 0.14, w, k % 2 ? c1 : c2, rot)
    }
    const timb = mixHex(c1, '#000', 0.15)
    for (const sg of [-1, 1]) {
      const off = sg * (w / 2 - 0.1)
      beam(off, 0, L, line(0) - 0.1, line(L) - 0.1, 0.2, 0.55, timb)
      // перила: столбы и поручень
      const posts: number[] = []
      for (let d = 0; d < L - 0.2; d += 2.1) posts.push(d)
      posts.push(L - 0.1)
      for (const d of posts) {
        const x = sx + ux * d + px * off, z = sz + uz * d + pz * off
        chunkAt(x, z).solid.box(x, line(d) - 0.1, z, 0.12, 1.05, 0.12, timb, rot)
      }
      beam(off, 0, L - 0.1, line(0) + 0.95, line(L - 0.1) + 0.95, 0.1, 0.1, c2)
      beam(off, 0, L - 0.1, line(0) + 0.5, line(L - 0.1) + 0.5, 0.06, 0.06, c2)
      // опоры под тетивой
      for (let d = 1.5; d < L - 0.3; d += 3) {
        const x = sx + ux * d + px * off, z = sz + uz * d + pz * off, g = heightAt(x, z)
        if (line(d) - g > 1) chunkAt(x, z).solid.box(x, g - 0.8, z, 0.22, line(d) - 0.65 - g + 0.8, 0.22, timb, rot)
      }
    }
    climbs.push({ ax: sx, az: sz, bx: ex, bz: ez, w, ya: y0 + riser / 2, yb: hEnd + riser / 2 })
    // под лестницей и по бокам не пройти (первые метры у земли остаются проходимыми)
    const lead = Math.min(L - 1, 1.6 + cell)
    fillLine([[sx + ux * lead, sz + uz * lead], [ex, ez]], w + 0.4, -1)
    return true
  }

  // ---------- водяные ворота: опоры у берегов, свод над рекой и опущенная решётка до воды ----------
  const waterGate = (a: P2, ux: number, uz: number, w0: number, w1: number, th: number, wh: number, col: string, wood: boolean): void => {
    const rot = Math.atan2(uz, ux), span = w1 - w0 + 2.4, m = (w0 + w1) / 2
    const cx = a[0] + ux * m, cz = a[1] + uz * m, ch = chunkAt(cx, cz)
    const arch = 3.6 // высота проёма над водой — лодка проходит, когда решётку поднимут
    for (const sd of [-1, 1]) {
      const px = cx + ux * sd * (span / 2), pz = cz + uz * sd * (span / 2), py = Math.min(heightAt(px, pz), -0.6)
      ch.solid.box(px, py - 2, pz, 2.4, wh + 2 - py, th + 1.2, mixHex(col, '#000', 0.06), rot)
    }
    ch.solid.box(cx, arch, cz, span, wh - arch, th, col, rot)
    ch.solid.box(cx, arch - 0.5, cz, span, 0.5, th + 0.4, mixHex(col, '#000', 0.18), rot)
    if (!wood && detail >= 1) for (const sd of [1, -1]) crenel(ch, [cx - ux * (span / 2) + -uz * (th / 2) * sd, cz - uz * (span / 2) + ux * (th / 2) * sd], [cx + ux * (span / 2) + -uz * (th / 2) * sd, cz + uz * (span / 2) + ux * (th / 2) * sd], wh, col, 0.4)
    // решётка: железные прутья до самой воды и две поперечины
    const IRON = wood ? '#3a2c20' : '#2b2a28', bars = Math.max(3, Math.round((span - 2.4) / 0.7))
    for (let j = 0; j <= bars; j++) {
      const f = -((span - 2.4) / 2) + ((span - 2.4) * j) / bars
      ch.solid.box(cx + ux * f, -0.4, cz + uz * f, 0.16, arch - 0.1, 0.16, IRON, rot)
    }
    for (const hy of [0.7, 2.2]) ch.solid.box(cx, hy, cz, span - 2.4, 0.16, 0.2, IRON, rot)
  }

  // ---------- Креит: частокол из заострённых брёвен, деревянные вышки и надвратные башни под шатром ----------
  const palisade = (r: P2[], isCit: boolean): void => {
    const logH = isCit ? 5.2 : 4.4
    const LOGS = ['#4a3828', '#3f2f21', '#55402c', '#46352a']
    const roofW = mixHex(st.roof[0], '#000', 0.1)
    const tower = (x: number, z: number, y: number, s: number, h: number, rot: number, ch: Chunk): void => {
      ch.solid.box(x, y - 1.5, z, s, h + 1.5, s, mixHex(st.wall, '#000', 0.1), rot)
      ch.solid.box(x, y + h, z, s + 0.6, 0.25, s + 0.6, st.timber, rot)
      ch.solid.cyl(x, y + h + 0.25, z, (s + 0.9) * 0.72, 2.4, 4, roofW, 0, false, rot + Math.PI / 4)
    }
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.5) continue
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, nx = -uz, nz = ux
      const gates = gatesOn(a, b, len), wet = waterOn(a, b, len)
      for (const [w0, w1] of wet) waterGate(a, ux, uz, w0, w1, 1.4, logH, st.timber, true)
      for (const [s0, s1] of spansOf(gates, len, wet)) {
        const n = Math.max(1, Math.round((s1 - s0) / 0.85))
        for (let j = 0; j <= n; j++) {
          const f = s0 + ((s1 - s0) * j) / n
          const x = a[0] + ux * f, z = a[1] + uz * f, y = heightAt(x, z), ch = chunkAt(x, z)
          const h = logH + ((j * 7919) % 5) * 0.12
          if (detail >= 1) {
            const col = LOGS[(j + i) % LOGS.length]
            ch.solid.cyl(x, y - 1.5, z, 0.44, h + 1.5, 6, col, 0.44, false)
            ch.solid.cyl(x, y + h, z, 0.44, 0.85, 6, mixHex(col, '#c8a878', 0.2), 0)
          } else if (j < n) {
            // издалека — сплошная стена из брёвен
            const f1 = s0 + ((s1 - s0) * (j + 1)) / n, x1 = a[0] + ux * f1, z1 = a[1] + uz * f1, y1 = heightAt(x1, z1)
            ch.solid.quad([x + nx * 0.4, y - 1.5, z + nz * 0.4], [x1 + nx * 0.4, y1 - 1.5, z1 + nz * 0.4], [x1 + nx * 0.4, y1 + h, z1 + nz * 0.4], [x + nx * 0.4, y + h, z + nz * 0.4], st.wall)
            ch.solid.quad([x1 - nx * 0.4, y1 - 1.5, z1 - nz * 0.4], [x - nx * 0.4, y - 1.5, z - nz * 0.4], [x - nx * 0.4, y + h, z - nz * 0.4], [x1 - nx * 0.4, y1 + h, z1 - nz * 0.4], mixHex(st.wall, '#000', 0.1))
          }
        }
        // поперечный брус с внутренней стороны, на котором держится частокол
        if (detail >= 1 && s1 - s0 > 1) {
          const m = (s0 + s1) / 2, x = a[0] + ux * m - nx * 0.55, z = a[1] + uz * m - nz * 0.55
          chunkAt(x, z).solid.box(x, heightAt(x, z) + logH * 0.62, z, s1 - s0, 0.28, 0.28, st.timber, Math.atan2(uz, ux))
        }
        // дощатый настил за частоколом и лестница на него (внутренняя сторона — к центру города)
        if (s1 - s0 >= 16 && stairCount++ % 3 === 0) {
          const rot = Math.atan2(uz, ux), rl = 2.7 / 0.42
          const t1 = mixHex(st.timber, '#000', 0.08), t2 = mixHex(st.timber, '#000', 0.16)
          const m0 = (s0 + s1) / 2, wc = centerOf(r), m0x = a[0] + ux * m0, m0z = a[1] + uz * m0
          const isg = (wc[0] - m0x) * nx + (wc[1] - m0z) * nz >= 0 ? 1 : -1 // сторона внутрь контура этой стены
          for (const dir of [1, -1]) {
            const pm = dir > 0 ? s0 + 4.5 : s1 - 4.5, mx = a[0] + ux * pm, mz = a[1] + uz * pm
            const hy = heightAt(mx, mz) + 2.7
            const cx = mx + nx * isg * 1.9, cz = mz + nz * isg * 1.9
            // лестница идёт вдоль частокола от края настила
            const ex = cx + ux * dir * 3.0, ez = cz + uz * dir * 3.0
            if (!addStair(ex + ux * dir * rl, ez + uz * dir * rl, ex, ez, 2.2, hy - 0.15, t1, t2, 1.2, [0], true)) continue
            const ax = cx - ux * 3.5, az = cz - uz * 3.5, bx = cx + ux * 3.5, bz = cz + uz * 3.5
            const ch = chunkAt(cx, cz)
            ch.solid.box(cx, hy - 0.45, cz, 7, 0.4, 2.4, t1, rot)
            for (const sd of [-3.2, 3.2]) ch.solid.box(cx + ux * sd, heightAt(cx + ux * sd, cz + uz * sd) - 1.5, cz + uz * sd, 0.4, hy - 0.45 - heightAt(cx + ux * sd, cz + uz * sd) + 1.5, 2.2, t2, rot)
            climbs.push({ ax, az, bx, bz, w: 2.4, ya: hy, yb: hy })
            break
          }
        }
      }
      // надвратные башни: две деревянные вышки под шатром и перекладина над проездом с черепами коней
      for (const g0 of gates) {
        const cx = a[0] + ux * g0, cz = a[1] + uz * g0, y = heightAt(cx, cz), ch = chunkAt(cx, cz), rot = Math.atan2(uz, ux)
        for (const sd of [-1, 1]) tower(cx + ux * sd * 4, cz + uz * sd * 4, y, 2.6, logH + 2.6, rot, ch)
        ch.solid.box(cx, y + logH + 0.6, cz, 8.6, 0.7, 1.2, st.timber, rot)
        if (detail >= 1) for (const sd of [-1.4, 0, 1.4]) ch.solid.box(cx + ux * sd + nx * 0.7, y + logH - 0.1, cz + uz * sd + nz * 0.7, 0.42, 0.5, 0.6, '#d8d0bc', rot)
        // дощатые створки между вышками (наружу — от центра частокола)
        const pc = centerOf(r), vs = (pc[0] - cx) * nx + (pc[1] - cz) * nz >= 0 ? -1 : 1
        const gy = bridgeAt(cx, cz) ?? y
        const rd = gateRoad(cx, cz, nx * vs, nz * vs)
        rd.e = Math.min(rd.e, 2.6)
        addGate(cx, cz, gy, ux, uz, nx * vs, nz * vs, 2.7, 0.7, logH - 0.2, mixHex(st.timber, '#000', 0.2), '#2a2c30', rd)
      }
      // угловые дозорные вышки — не на каждом углу
      if (i % 3 === 0 || isCit) {
        const y = heightAt(a[0], a[1])
        tower(a[0], a[1], y, 3, logH + 3.4, Math.atan2(uz, ux), chunkAt(a[0], a[1]))
      }
    }
  }

  // ---------- стены города: зубцы, башни, ворота там, где стену пересекает дорога ----------
  const wallColor = st.wall
  // ---------- ворота со створками: открываются днём и при подходе, закрываются ночью; тап по воротам — вручную ----------
  // Данные берём из плана как есть: точка ворот — пересечение стены с дорогой/мостом; ширину проезда и сторону «наружу» считаем здесь.
  type GateLeaf = { mesh: THREE.Mesh; a0: number; a1: number }
  type Gate = { x: number; z: number; y: number; ux: number; uz: number; nx: number; nz: number; pw: number; hv: number; h: number; open: number; target: number; manual: boolean | null; leaves: GateLeaf[] }
  const gateList: Gate[] = []
  const gateGeos: THREE.BufferGeometry[] = []
  // закрытые (больше чем наполовину) створки не пропускают
  const gateShut = (x: number, z: number): boolean => {
    for (const g of gateList) {
      if (g.open >= 0.5) continue
      const dx = x - g.x, dz = z - g.z
      if (Math.abs(dx * g.ux + dz * g.uz) < g.pw && Math.abs(dx * g.nx + dz * g.nz) < g.hv + 0.3) return true
    }
    return false
  }
  // дорога через ворота: направление наружу, полуширина проезда поперёк дороги и смещение оси дороги от точки ворот
  const gateRoad = (cx: number, cz: number, nx: number, nz: number): { dx: number; dz: number; e: number; off: number } => {
    let best = 1e9, dx = nx, dz = nz
    for (const q of [...bridges, ...roads, ...planks]) for (let s = 1; s < q.r.length; s++) {
      const a = q.r[s - 1], b = q.r[s], L = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (L < 0.01) continue
      const ex = (b[0] - a[0]) / L, ez = (b[1] - a[1]) / L
      const t = Math.max(0, Math.min(L, (cx - a[0]) * ex + (cz - a[1]) * ez))
      const d = Math.hypot(cx - a[0] - ex * t, cz - a[1] - ez * t)
      if (d < best - 0.01) { best = d; dx = ex; dz = ez }
    }
    let e = 2.2, off = 0, bridge: Bridge | null = null
    for (const B of bridgeList) {
      const px = cx - B.a[0], pz = cz - B.a[1], d = px * B.ux + pz * B.uz
      if (d < -3 || d > B.L + 3 || Math.abs(-px * B.uz + pz * B.ux) > B.w / 2 + 1) continue
      bridge = B; dx = B.ux; dz = B.uz
    }
    if (dx * nx + dz * nz < 0) { dx = -dx; dz = -dz }
    if (bridge) {
      // створки встают у перил, внутри настила: весь настил остаётся проходом
      e = Math.max(2.2, bridge.w / 2 - 0.65)
      off = (cx - bridge.a[0]) * -dz + (cz - bridge.a[1]) * dx
    }
    return { dx, dz, e, off }
  }
  // полуширина арки вдоль стены, чтобы косой проезд/мост целиком проходил через толщу стены
  const gateSpan = (ux: number, uz: number, nx: number, nz: number, rd: { dx: number; dz: number; e: number }, depth: number): number => {
    const px = -rd.dz, pz = rd.dx
    const sp = Math.max(0.5, Math.abs(ux * px + uz * pz)), cp = Math.abs(nx * px + nz * pz)
    return Math.min(9, Math.max(2.2, (rd.e + depth * cp) / sp))
  }
  // створки: две отдельные сетки на петлях (крутятся в tick); n — наружу
  const addGate = (cx: number, cz: number, y: number, ux: number, uz: number, nx: number, nz: number, pw: number, hv: number, doorH: number, col: string, band: string, rd: { dx: number; dz: number; e: number; off: number }): void => {
    if (gateList.some((g) => Math.hypot(g.x - cx, g.z - cz) < 3)) return
    const px = -rd.dz, pz = rd.dx
    let sp = ux * px + uz * pz
    if (Math.abs(sp) < 0.5) sp = sp < 0 ? -0.5 : 0.5
    const cp = nx * px + nz * pz
    const t0 = (-rd.off - hv * cp) / sp // середина проезда на внешней грани
    const leaves: GateLeaf[] = []
    const aOpen = Math.atan2(-rd.dz, rd.dx)
    for (const sd of [-1, 1]) {
      const t = (sd * rd.e - rd.off - hv * cp) / sp, L = Math.abs(t0 - t)
      if (L < 0.4) continue
      const s = Math.sign(t0 - t), dirx = ux * s, dirz = uz * s
      const b = new Bucket()
      b.box(L / 2, 0, 0, L - 0.04, doorH, 0.24, col)
      // доски и железные полосы
      if (detail >= 1) {
        for (const hh of [0.5, doorH - 0.7]) b.box(L / 2, hh, 0, L * 0.96, 0.22, 0.32, band)
        const nb = Math.max(2, Math.round(L / 0.45))
        for (let q = 1; q < nb; q++) b.box((L * q) / nb, 0.05, 0.125, 0.04, doorH - 0.1, 0.02, mixHex(col, '#000', 0.25))
      }
      b.box(0.1, -0.05, 0, 0.3, doorH + 0.15, 0.36, mixHex(band, col, 0.3)) // столб петли
      const geo = b.geometry()
      if (!geo) continue
      geo.computeBoundingSphere()
      gateGeos.push(geo)
      const mesh = new THREE.Mesh(geo, solidMat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.position.set(cx + ux * t + nx * hv, y, cz + uz * t + nz * hv)
      const aClosed = Math.atan2(-dirz, dirx)
      let d = aOpen - aClosed
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      mesh.rotation.y = aClosed + d
      scene.add(mesh)
      leaves.push({ mesh, a0: aClosed, a1: aClosed + d })
      // глухая вставка между петлёй и башней (над перилами/обочиной — проходу не мешает)
      const gap = pw - Math.abs(t)
      if (gap > 0.3 && Math.abs(t) < pw) {
        const m = (Math.abs(t) + pw) / 2 * Math.sign(t)
        chunkAt(cx, cz).solid.box(cx + ux * m + nx * hv, y - 0.5, cz + uz * m + nz * hv, gap, doorH + 0.5, 0.4, mixHex(col, '#000', 0.15), Math.atan2(uz, ux))
      }
    }
    gateList.push({ x: cx, z: cz, y, ux, uz, nx, nz, pw, hv, h: doorH, open: 1, target: 1, manual: null, leaves })
  }
  // надвратное строение: башни, арка проезда, решётка; вид зависит от стиля города. nx,nz — наружу
  const gatehouse = (cx: number, cz: number, ux: number, uz: number, nx: number, nz: number, th: number, wh: number): void => {
    if (gateList.some((g) => Math.hypot(g.x - cx, g.z - cz) < 3)) return
    const y = bridgeAt(cx, cz) ?? heightAt(cx, cz), s = chunkAt(cx, cz).solid, rot = Math.atan2(uz, ux)
    const kind = dwStyle || gnStyle ? 'dwarf' : elStyle ? 'elf' : S.style === 'south' ? 'south' : S.style === 'styria' ? 'dark' : 'human'
    const D = th + 3.4 // глубина башни поперёк стены
    const rd = gateRoad(cx, cz, nx, nz)
    const pw = gateSpan(ux, uz, nx, nz, rd, D / 2)
    const wc = wallColor, dk = '#1c1713'
    const bx = (u: number, v: number, h: number, sx: number, sh: number, sz: number, col: string, r = 0): void => s.box(cx + ux * u + nx * v, y + h, cz + uz * u + nz * v, sx, sh, sz, col, rot + r)
    const roofC = kind === 'dark' ? '#34323a' : kind === 'elf' ? '#4f8f72' : st.roof[0]
    const stoneC = mixHex(st.stone, wc, 0.3)
    const top = wh + 1.2 // верх надвратного пролёта
    // башни
    for (const sd of [-1, 1]) {
      if (kind === 'elf') {
        const u = sd * (pw + 2.0), hh = wh + 6.5
        s.cyl(cx + ux * u, y - 3, cz + uz * u, 2.0, hh + 3, 14, mixHex(wc, '#ffffff', 0.18), 1.65)
        s.cyl(cx + ux * u, y + hh - 0.2, cz + uz * u, 2.35, 0.6, 14, stoneC)
        s.cyl(cx + ux * u, y + hh + 0.4, cz + uz * u, 2.5, 4.6, 14, roofC, 0, false)
        s.cyl(cx + ux * u, y + hh + 5.0, cz + uz * u, 0.12, 1.3, 5, '#d8c27a', 0.04)
        for (const v of [-1, 1]) bx(u, v * 1.9, wh * 0.5, 0.3, 1.6, 0.12, dk)
        // колонна-подпорка проезда, чтобы между круглой башней и аркой не было щели
        bx(sd * (pw + 0.7), 0, -3, 1.6, wh + 4.2, th + 1.6, wc)
      } else {
        const T = kind === 'dwarf' ? 5.0 : 4.4, ht = kind === 'dwarf' ? wh + 2.4 : wh + 4
        const u = sd * (pw + T / 2)
        bx(u, 0, -3, T, ht + 3, D, wc)
        bx(u, 0, -0.2, T + 0.5, 1.4, D + 0.5, mixHex(wc, '#000', 0.16)) // цоколь
        bx(u, 0, ht - 0.6, T + 0.8, 0.7, D + 0.8, stoneC) // карниз
        if (kind === 'human' || kind === 'dark') {
          const rh = T * (kind === 'dark' ? 1.7 : 1.3)
          s.cyl(cx + ux * u, y + ht, cz + uz * u, (T + 0.9) * 0.71, rh, 4, roofC, 0, false, rot + Math.PI / 4)
          s.cyl(cx + ux * u, y + ht + rh, cz + uz * u, 0.07, 1.6, 4, '#3a2a1a', 0.07)
          bx(u + 0.7, 0, ht + rh + 0.9, 1.3, 0.7, 0.05, kind === 'dark' ? '#2a1a2a' : '#8f2f2f')
        } else {
          for (const f of [-1, 1]) {
            crenel(chunkAt(cx, cz), [cx + ux * (u - T / 2 - 0.2) + nx * (D / 2 + 0.2) * f, cz + uz * (u - T / 2 - 0.2) + nz * (D / 2 + 0.2) * f], [cx + ux * (u + T / 2 + 0.2) + nx * (D / 2 + 0.2) * f, cz + uz * (u + T / 2 + 0.2) + nz * (D / 2 + 0.2) * f], y + ht + 0.1, wc, 0.5)
          }
        }
        if (detail >= 1) for (const v of [-1, 1]) for (const du of [-0.9, 0.9]) bx(u + du, v * (D / 2 + 0.03), wh * 0.5, 0.32, 1.5, 0.1, dk)
      }
    }
    // арка проезда: ступенчатая по кривой, с кольцом из камня
    const Hs = kind === 'dwarf' ? 4.1 : kind === 'dark' ? 2.6 : kind === 'elf' ? 3.0 : 2.9
    const rise = kind === 'dwarf' ? 0 : kind === 'dark' ? 2.9 : kind === 'elf' ? 3.6 : kind === 'south' ? 2.2 : 2.4
    const sh = (t: number): number => kind === 'south' ? Math.sqrt(Math.max(0, 1 - t * t)) : Math.pow(Math.max(0, 1 - t), kind === 'elf' ? 0.55 : 0.7)
    const NS = Math.max(12, Math.round(pw * 5)), sw = (2 * pw) / NS
    const v0 = -(th + 1.6) / 2, v1 = (th + 1.6) / 2
    for (let i = 0; i < NS; i++) {
      const u = -pw + (i + 0.5) * sw, hA = Hs + rise * sh(Math.abs(u) / pw)
      bx(u, 0, hA, sw + 0.02, top - hA, th + 1.6, mixHex(wc, '#000', 0.04))
      bx(u, 0, hA, sw + 0.02, 0.6, th + 2.0, kind === 'elf' ? '#e6dcc0' : stoneC)
      s.quad([cx + ux * (u - sw / 2) + nx * v0, y + hA, cz + uz * (u - sw / 2) + nz * v0], [cx + ux * (u + sw / 2) + nx * v0, y + hA, cz + uz * (u + sw / 2) + nz * v0], [cx + ux * (u + sw / 2) + nx * v1, y + hA, cz + uz * (u + sw / 2) + nz * v1], [cx + ux * (u - sw / 2) + nx * v1, y + hA, cz + uz * (u - sw / 2) + nz * v1], '#2d2620')
    }
    if (kind === 'dwarf') {
      bx(0, 0, Hs - 0.4, 2 * pw + 0.8, 0.9, th + 2.2, stoneC) // тяжёлая перемычка
      if (detail >= 1) for (let q = -3; q <= 3; q++) bx(q * 0.62, th / 2 + 1.12, Hs + 0.9, 0.22, 0.5, 0.06, '#c9a24a') // золотые руны
    }
    // зубцы над проездом
    if (kind !== 'elf') for (const f of [1, -1]) crenel(chunkAt(cx, cz), [cx - ux * pw + nx * (th / 2 + 0.7) * f, cz - uz * pw + nz * (th / 2 + 0.7) * f], [cx + ux * pw + nx * (th / 2 + 0.7) * f, cz + uz * pw + nz * (th / 2 + 0.7) * f], y + top, wc, 0.4)
    else for (let q = -2; q <= 2; q++) s.cyl(cx + ux * q * 0.9, y + top, cz + uz * q * 0.9, 0.22, 1.5, 5, '#f0e8d0', 0.03)
    // герб над аркой
    const gh = Hs + rise + 0.55
    bx(0, th / 2 + 0.88, gh, 1.1, Math.min(1.5, top - gh - 0.1), 0.08, kind === 'dark' ? '#2a1a2a' : kind === 'elf' ? '#3e7d5c' : '#8f2f2f')
    // решётка поднята под свод — проезду не мешает
    if (detail >= 1 && kind !== 'elf') {
      const nq = Math.floor((pw - 0.3) / 0.55)
      for (let q = -nq; q <= nq; q++) {
        const u = q * 0.55, hA = Hs + rise * sh(Math.abs(u) / pw)
        bx(u, 0, hA - 1.1, 0.12, 1.2, 0.12, '#2a2a2e')
      }
    }
    // створки
    const dc = kind === 'dwarf' ? '#3c4046' : kind === 'elf' ? '#c9b98a' : mixHex(st.timber, '#000', 0.25)
    addGate(cx, cz, y, ux, uz, nx, nz, pw, th / 2 + 0.7, Hs - 0.2, dc, kind === 'elf' ? '#9a8a5a' : '#2a2c30', rd)
  }
  let stairCount = 0
  wallLines.forEach((w, wi) => {
    const r = w.r
    if (r.length < 2) return
    if (S.style === 'viking') return palisade(r, wi === S.citadel)
    const isCit = wi === S.citadel
    const wh = (isCit ? 9 : 7) * (S.style === 'styria' ? 1.15 : 1)
    const th = Math.max(1.8, Math.min(3.2, w.w / 2))
    const towerR = Math.max(2.4, Math.min(4.4, S.tower / k * 0.9))
    const closed = true
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length]
      if (!closed && i === r.length - 1) break
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.5) continue
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, nx = -uz, nz = ux
      // ворота на этом участке
      const gates = gatesOn(a, b, len), wet = waterOn(a, b, len)
      const spans = spansOf(gates, len, wet)
      for (const [w0, w1] of wet) waterGate(a, ux, uz, w0, w1, th, wh, wallColor, false)
      for (const [s0, s1] of spans) {
        const L = s1 - s0, n = Math.max(1, Math.ceil(L / 7))
        for (let j = 0; j < n; j++) {
          const f0 = s0 + (L * j) / n, f1 = s0 + (L * (j + 1)) / n
          const A: P2 = [a[0] + ux * f0, a[1] + uz * f0], B: P2 = [a[0] + ux * f1, a[1] + uz * f1]
          const ya = heightAt(A[0], A[1]), yb = heightAt(B[0], B[1])
          const ch = chunkAt(A[0], A[1])
          const o = th / 2
          const A1: V3 = [A[0] + nx * o, ya, A[1] + nz * o], B1: V3 = [B[0] + nx * o, yb, B[1] + nz * o], A2: V3 = [A[0] - nx * o, ya, A[1] - nz * o], B2: V3 = [B[0] - nx * o, yb, B[1] - nz * o]
          const up = (v: V3, h: number): V3 => [v[0], v[1] + h, v[2]]
          const dn = (v: V3): V3 => [v[0], v[1] - 2, v[2]]
          ch.solid.quad(dn(A1), dn(B1), up(B1, wh), up(A1, wh), wallColor)
          ch.solid.quad(dn(A2), dn(B2), up(B2, wh), up(A2, wh), mixHex(wallColor, '#000', 0.08))
          ch.solid.quad(up(A1, wh), up(B1, wh), up(B2, wh), up(A2, wh), mixHex(wallColor, '#000', 0.2))
          if (detail >= 1) {
            for (const sd of [1, -1]) crenel(ch, [A[0] + nx * o * sd, A[1] + nz * o * sd], [B[0] + nx * o * sd, B[1] + nz * o * sd], (ya + yb) / 2 + wh, wallColor, 0.4)
          }
          // верх стены — можно ходить; у башен отступаем
          const sh = towerR * 0.9 + 0.2
          const fa = j === 0 ? sh : 0, fb = j === n - 1 ? sh : 0
          if (L - fa - fb > 1) {
            const pa = f0 + fa, pb = f1 - fb
            const ax2 = a[0] + ux * pa, az2 = a[1] + uz * pa, bx2 = a[0] + ux * pb, bz2 = a[1] + uz * pb
            climbs.push({ ax: ax2, az: az2, bx: bx2, bz: bz2, w: th, ya: heightAt(ax2, az2) + wh, yb: heightAt(bx2, bz2) + wh })
          }
        }
        // лестницы на стену: на каждом третьем длинном участке, изнутри и ВДОЛЬ стены (ступени идут параллельно стене)
        const sw = 2.6, rl0 = wh / 0.5
        if (L >= rl0 + 6 && (stairCount++ % 3 === 0)) {
          const sc1 = mixHex(st.timber, '#000', 0.08), sc2 = mixHex(st.timber, '#000', 0.16)
          const wc = centerOf(r), mm = a[0] + ux * (s0 + L / 2), mz0 = a[1] + uz * (s0 + L / 2)
          const isg = (wc[0] - mm) * nx + (wc[1] - mz0) * nz >= 0 ? 1 : -1 // внутрь контура этой стены (замок — к замку)
          const off = isg * (th / 2 - 0.5 + sw / 2)
          let done = false
          for (const slope of [0.5, 0.42, 0.6]) {
            if (done) break
            const rl = wh / slope, lo = s0 + 3, hi = s1 - 3, room = hi - lo - rl
            if (room < 0) continue
            for (const dir of [1, -1]) {
              if (done) break
              for (const t of [0.5, 0, 1]) {
                const ps = dir > 0 ? lo + room * t : hi - room * t, pe = ps + dir * rl
                if (gatesOn(a, b, len).some((g) => Math.abs(g - ps) < 6 || Math.abs(g - pe) < 6)) continue
                const hEnd = heightAt(a[0] + ux * pe, a[1] + uz * pe) + wh
                if (addStair(a[0] + ux * ps + nx * off, a[1] + uz * ps + nz * off, a[0] + ux * pe + nx * off, a[1] + uz * pe + nz * off, sw, hEnd, sc1, sc2, 2.5, [0], true)) { done = true; break }
              }
            }
          }
        }
      }
      // надвратные башни со створками; «наружу» — от центра контура этой стены
      if (gates.length) {
        const wc = centerOf(r)
        for (const g0 of gates) {
          const cx = a[0] + ux * g0, cz = a[1] + uz * g0
          const vs = (wc[0] - cx) * nx + (wc[1] - cz) * nz >= 0 ? -1 : 1
          gatehouse(cx, cz, ux, uz, nx * vs, nz * vs, th, wh)
        }
      }
      // угловая башня
      const ty = heightAt(a[0], a[1]), ch = chunkAt(a[0], a[1])
      ch.solid.cyl(a[0], ty - 2, a[1], towerR, wh + 4.5, detail ? 12 : 8, wallColor)
      if (i % 3 === 0 && S.style !== 'south') ch.solid.cyl(a[0], ty + wh + 2.5, a[1], towerR * 1.15, towerR * 2.1, 12, st.tower, 0, false)
      else if (detail >= 1) for (let m = 0; m < 10; m++) { const q = (m / 10) * 6.283; ch.solid.box(a[0] + Math.cos(q) * towerR, ty + wh + 2.5, a[1] + Math.sin(q) * towerR, 1, 1.1, 0.5, wallColor, q + 1.57) }
    }
  })

  // ---------- мосты и причалы ----------
  const DECK = 1.5
  planks.forEach((q) => {
    const w = Math.max(q.w, 3.2)
    for (let s = 1; s < q.r.length; s++) {
      const a = q.r[s - 1], b = q.r[s], ch = chunkAt(a[0], a[1])
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[1] - a[1], b[0] - a[0])
      const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2
      ch.solid.box(cx, DECK - 0.2, cz, len + 0.2, 0.2, w, '#6b4f33', rot)
      const n = Math.max(1, Math.floor(len / 4))
      for (let i = 0; i <= n; i++) {
        const f = i / n, px = a[0] + (b[0] - a[0]) * f, pz = a[1] + (b[1] - a[1]) * f
        for (const sd of [-1, 1]) {
          const ox = -Math.sin(rot) * (w / 2) * sd, oz = Math.cos(rot) * (w / 2) * sd
          ch.solid.box(px + ox, -3, pz + oz, 0.28, DECK + 3.8, 0.28, '#4a3522')
        }
      }
      for (const sd of [-1, 1]) ch.solid.box(cx - Math.sin(rot) * (w / 2) * sd, DECK + 0.7, cz + Math.cos(rot) * (w / 2) * sd, len, 0.1, 0.1, '#4a3522', rot)
    }
  })

  // каменный мост арками (дерево — у северных стилей): настил с парапетами/перилами на уровне улицы, по нему ходят
  const woodBridge = ['viking', 'norse', 'alpine', 'chea', 'gnome', 'elf'].includes(S.style)
  bridgeList.forEach((B) => {
    const { a, ux, uz, L, w } = B, px = -uz, pz = ux, rot = Math.atan2(uz, ux)
    const P = (d: number, o: number, y: number): V3 => [a[0] + ux * d + px * o, y, a[1] + uz * d + pz * o]
    const q2 = (ch: Chunk, p1: V3, p2: V3, p3: V3, p4: V3, col: string): void => { ch.solid.quad(p1, p2, p3, p4, col); ch.solid.quad(p4, p3, p2, p1, col) }
    const n = Math.max(4, Math.ceil(L / 0.8)), ds = L / n, hw = w / 2
    // ходьба: настил кусками (поверхность Climb линейна), ширина — между парапетами
    const m = Math.max(4, Math.ceil(L / 2.5))
    for (let i = 0; i < m; i++) {
      const dA = (L * i) / m, dB = (L * (i + 1)) / m
      climbs.push({ ax: a[0] + ux * dA, az: a[1] + uz * dA, bx: a[0] + ux * dB, bz: a[1] + uz * dB, w: w - 0.9, ya: deckY(B, dA), yb: deckY(B, dB) })
    }
    if (!woodBridge) {
      const stone = st.stone, dark = mixHex(st.stone, '#000', 0.25), pave = st.pave, par = 0.45, parH = 0.85
      // пролёты: арки над водой, между ними быки с волнорезами
      const A = Math.max(0, B.d0 - 1.5), Z = Math.min(L, B.d1 + 1.5), na = Math.max(1, Math.round((Z - A) / 11)), span = (Z - A) / na, pt = 1.6
      const bottom = (d: number): number => {
        const g = heightAt(a[0] + ux * d, a[1] + uz * d)
        if (d < A || d > Z) return Math.min(g - 0.6, deckY(B, d) - 0.4)
        const k = Math.min(na - 1, Math.floor((d - A) / span)), s0 = A + k * span + (k ? pt / 2 : 0), s1 = A + (k + 1) * span - (k < na - 1 ? pt / 2 : 0)
        if (d < s0 || d > s1) return -2.5
        const mid = (s0 + s1) / 2, half = (s1 - s0) / 2, crown = Math.min(deckY(B, mid) - 0.7, -0.3 + half), f = (d - mid) / half
        return -0.3 + (crown + 0.3) * Math.sqrt(Math.max(0, 1 - f * f))
      }
      for (let i = 0; i < n; i++) {
        const dA = i * ds, dB = (i + 1) * ds, ch = chunkAt(a[0] + ux * dA, a[1] + uz * dA)
        const yA = deckY(B, dA), yB = deckY(B, dB), bA = bottom(dA), bB = bottom(dB)
        // настил-мостовая и свод снизу
        q2(ch, P(dA, -hw + par, yA), P(dA, hw - par, yA), P(dB, hw - par, yB), P(dB, -hw + par, yB), i % 2 ? pave : mixHex(pave, '#000', 0.06))
        q2(ch, P(dA, -hw, bA), P(dA, hw, bA), P(dB, hw, bB), P(dB, -hw, bB), dark)
        for (const sg of [-1, 1]) {
          // наружная стена от свода до верха парапета, внутренняя сторона парапета и его верх
          q2(ch, P(dA, sg * hw, bA), P(dB, sg * hw, bB), P(dB, sg * hw, yB + parH), P(dA, sg * hw, yA + parH), stone)
          q2(ch, P(dA, sg * (hw - par), yA), P(dB, sg * (hw - par), yB), P(dB, sg * (hw - par), yB + parH), P(dA, sg * (hw - par), yA + parH), stone)
          q2(ch, P(dA, sg * (hw - par), yA + parH), P(dB, sg * (hw - par), yB + parH), P(dB, sg * hw, yB + parH + 0.06), P(dA, sg * hw, yA + parH + 0.06), mixHex(stone, '#fff', 0.12))
        }
      }
      // торцы парапетов и быки с волнорезами
      for (const d of [0.35, L - 0.35]) for (const sg of [-1, 1]) { const [x, , z] = P(d, sg * (hw - par / 2), 0); chunkAt(x, z).solid.box(x, deckY(B, d), z, 0.7, parH + 0.35, 0.7, stone, rot) }
      for (let k = 1; k < na; k++) {
        const d = A + k * span, [x, , z] = P(d, 0, 0), top = Math.max(0.6, bottom(d - pt / 2 - 0.4) + 0.2)
        const ch = chunkAt(x, z)
        ch.solid.box(x, -2.5, z, pt, top + 2.5, w + 0.3, stone, rot)
        for (const sg of [-1, 1]) ch.solid.box(x + px * sg * (hw + 0.4), -2.5, z + pz * sg * (hw + 0.4), pt * 0.75, top + 1.9, pt * 0.75, dark, rot + Math.PI / 4)
      }
    } else {
      const plank = '#6b4f33', dark = '#4a3522'
      for (let i = 0; i < n; i++) {
        const dA = i * ds, dB = (i + 1) * ds, ch = chunkAt(a[0] + ux * dA, a[1] + uz * dA), yA = deckY(B, dA), yB = deckY(B, dB)
        q2(ch, P(dA, -hw, yA), P(dA, hw, yA), P(dB, hw, yB), P(dB, -hw, yB), i % 2 ? plank : mixHex(plank, '#000', 0.1))
        for (const sg of [-1, 1]) {
          q2(ch, P(dA, sg * hw, yA - 0.35), P(dB, sg * hw, yB - 0.35), P(dB, sg * hw, yB), P(dA, sg * hw, yA), dark)
          q2(ch, P(dA, sg * (hw - 0.1), yA + 0.95), P(dB, sg * (hw - 0.1), yB + 0.95), P(dB, sg * (hw - 0.1), yB + 1.05), P(dA, sg * (hw - 0.1), yA + 1.05), dark)
        }
      }
      for (let d = 0.2; d < L; d += 2) for (const sg of [-1, 1]) {
        const [x, , z] = P(d, sg * (hw - 0.1), 0), y = deckY(B, d)
        chunkAt(x, z).solid.box(x, y, z, 0.14, 1.05, 0.14, dark, rot)
      }
      // сваи: ряды поперёк реки через 4 м
      for (let d = B.d0; d <= B.d1; d += 4) for (const o of [-hw + 0.3, 0, hw - 0.3]) {
        const [x, , z] = P(d, o, 0)
        chunkAt(x, z).solid.box(x, -3, z, 0.34, deckY(B, d) + 2.7, 0.34, dark, rot)
      }
    }
  })

  // ---------- площади: колодец, прилавки ----------
  const vendors: { x: number; z: number; a: number }[] = []
  const AWN = S.style === 'styria' ? ['#2a2230', '#3a2c3a', '#40303a'] : S.style === 'viking' ? ['#6a5440', '#7a6650', '#5a4634', '#8a7a62'] : ['#b03a2e', '#d9b44a', '#3f6a8a', '#5d8a4a']
  // Гарефорд: Светочная башня всегда встаёт на самую большую площадь
  const garefSq = (S.style === 'garef' || S.style === 'temer' || S.style === 'lyria' || S.style === 'kogal' || S.style === 'kulag' || S.style === 'elf' || S.style === 'silva' || S.style === 'harn' || S.style === 'olek' || S.style === 'uuna' || S.style === 'gren' || S.style === 'ntow' || S.style === 'bezd') && squares.length ? squares.reduce((bi, r, i) => (Math.abs(areaOf(r)) > Math.abs(areaOf(squares[bi])) ? i : bi), 0) : -1
  squares.forEach((r, si) => {
    const [cx, cz] = centerOf(r), area = Math.abs(areaOf(r)), y = heightAt(cx, cz), ch = chunkAt(cx, cz)
    if (area > 500 || si === garefSq) {
      // большая площадь: фонтан или памятник на постаменте; в гарде Креита — жертвенный камень, кострище и резные столбы богов
      if (S.style === 'viking') {
        ch.solid.box(cx, y, cz, 2.4, 1.2, 1.6, st.stone, si)
        ch.solid.cyl(cx + 3.2, y, cz + 0.6, 1.2, 0.25, 9, '#3a3430')
        ch.solid.cyl(cx + 3.2, y + 0.25, cz + 0.6, 0.7, 0.5, 6, '#c8642a', 0.1)
        for (let i = 0; i < 3; i++) {
          const a = si + (i / 3) * 6.283, px = cx + Math.cos(a) * 5.2, pz = cz + Math.sin(a) * 5.2
          ch.solid.cyl(px, y, pz, 0.38, 4.2, 6, st.timber)
          ch.solid.box(px, y + 3.3, pz, 0.9, 0.8, 0.9, '#6a2a1a', a)
        }
      } else if (si === garefSq && S.style === 'silva') {
        // Великая Мать Сильвленда: плетёное каменное кольцо, массивный ствол в корнях, ярусная крона и красные плоды
        ch.solid.cyl(cx, y, cz, 9.8, 0.3, 32, st.stone)
        ch.solid.cyl(cx, y + 0.3, cz, 8.2, 0.1, 32, '#7a9a4a')
        ch.solid.cyl(cx, y + 0.4, cz, 3.4, 0.7, 14, '#6a4a2a')
        for (let k = 0; k < 8; k++) {
          const a = si + (k / 8) * 6.283
          ch.solid.box(cx + Math.cos(a) * 3.0, y + 0.4, cz + Math.sin(a) * 3.0, 3.0, 0.9, 0.7, '#5a3e22', a)
        }
        ch.solid.cyl(cx, y + 1.0, cz, 2.1, 6.4, 12, '#6a4a2a', 0.9)
        ch.solid.cyl(cx, y + 7.2, cz, 1.5, 2.2, 10, '#5a3e22', 0.7)
        ch.solid.cyl(cx, y + 7.0, cz, 7.6, 2.0, 20, '#4f8a3a', 5.4)
        ch.solid.cyl(cx, y + 8.8, cz, 6.2, 2.2, 18, '#5c9a3e', 3.6)
        ch.solid.cyl(cx, y + 10.8, cz, 3.8, 1.8, 14, '#6aa846', 0.6)
        for (let k = 0; k < 16; k++) {
          const a = si * 0.4 + (k / 16) * 6.283, rr = 3.6 + (k % 3) * 1.6, bx = cx + Math.cos(a) * rr, bz = cz + Math.sin(a) * rr
          ch.glow.box(bx, y + 7.0 + (k % 4) * 0.9, bz, 0.34, 0.34, 0.34, '#d84a3a', a)
        }
        for (let k = 0; k < 4; k++) {
          const a = si + 0.4 + (k / 4) * 6.283
          ch.solid.box(cx + Math.cos(a) * 9.2, y + 0.3, cz + Math.sin(a) * 9.2, 3.2, 0.45, 0.7, '#8a6a3a', a + Math.PI / 2)
        }
        fillLine([[cx - 9, cz], [cx + 9, cz]], 10, N + 2 + si)
      } else if (si === garefSq && S.style === 'elf') {
        // Серебряная Ива Эльфборна: белое каменное кольцо с водой, серебристый ствол с корнями, широкая крона
        // и двенадцать ниспадающих ветвей Домов — на конце каждой светится лист
        ch.solid.cyl(cx, y, cz, 9.6, 0.3, 32, st.stone)
        ch.solid.cyl(cx, y + 0.3, cz, 8.4, 0.1, 32, '#4a7a78')
        ch.solid.cyl(cx, y + 0.3, cz, 3.2, 0.5, 16, '#8a9a7a')
        for (let k = 0; k < 6; k++) {
          const a = si + (k / 6) * 6.283
          ch.solid.box(cx + Math.cos(a) * 2.2, y + 0.3, cz + Math.sin(a) * 2.2, 2.6, 0.7, 0.6, '#a9ada4', a)
        }
        ch.solid.cyl(cx, y + 0.8, cz, 1.35, 4.6, 12, '#c4c8c0', 0.95)
        ch.solid.cyl(cx, y + 5.4, cz, 0.95, 1.4, 10, '#b8bcb4', 0.6)
        ch.solid.cyl(cx, y + 5.2, cz, 6.4, 1.6, 20, '#9fb8a4', 5.6)
        ch.solid.cyl(cx, y + 6.8, cz, 5.6, 1.8, 18, '#b4c8b8', 3.4)
        ch.solid.cyl(cx, y + 8.6, cz, 3.4, 1.4, 14, '#c8d8cc', 0.6)
        for (let k = 0; k < 12; k++) {
          const a = si * 0.3 + (k / 12) * 6.283, ca = Math.cos(a), sa = Math.sin(a)
          for (const [rr, hh] of [[5.6, 3.6], [4.4, 2.6]] as const) {
            const bx = cx + ca * rr, bz = cz + sa * rr
            ch.solid.box(bx, y + 5.4 - hh, bz, 0.22, hh, 0.22, '#d4e2d6', a)
            if (rr > 5) ch.glow.box(bx, y + 5.2 - hh, bz, 0.34, 0.34, 0.34, '#ffffff', a)
          }
        }
        for (let k = 0; k < 4; k++) {
          const a = si + 0.4 + (k / 4) * 6.283
          ch.solid.box(cx + Math.cos(a) * 9.0, y + 0.3, cz + Math.sin(a) * 9.0, 3.2, 0.45, 0.7, '#b59a6a', a + Math.PI / 2)
        }
        fillLine([[cx - 9, cz], [cx + 9, cz]], 10, N + 2 + si)
      } else if (si === garefSq && S.style === 'kulag') {
        // Дом Колец Кулагона: круг из семи каменных арок над водой, у каждой — свой цвет Дома, в центре светящийся камень-черепок
        ch.solid.cyl(cx, y, cz, 9.5, 0.35, 28, st.stone)
        ch.solid.cyl(cx, y + 0.35, cz, 7.6, 0.15, 28, '#3a5a6a')
        const hc = ['#c9a24a', '#6a9ac8', '#c8584a', '#7ab070', '#a878c0', '#d89a4a', '#8ab0b0']
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * 6.283, bx = cx + Math.cos(a) * 7.6, bz = cz + Math.sin(a) * 7.6, ra = a + Math.PI / 2
          for (const sd of [-1.6, 1.6]) ch.solid.box(bx + Math.cos(ra) * sd, y + 0.35, bz + Math.sin(ra) * sd, 0.9, 5.2, 0.9, st.stone, a)
          ch.solid.box(bx, y + 5.55, bz, 4.4, 0.8, 1.0, st.stone, ra)
          ch.solid.box(bx, y + 6.35, bz, 3.0, 0.5, 0.8, hc[k], ra)
          ch.glow.box(bx, y + 4.2, bz, 0.7, 0.7, 0.7, '#ffffff', ra)
        }
        ch.solid.cyl(cx, y + 0.35, cz, 1.6, 1.4, 10, st.stone)
        ch.glow.box(cx, y + 1.75, cz, 1.1, 1.1, 1.1, '#ffffff', si)
        fillLine([[cx - 9, cz], [cx + 9, cz]], 8, N + 2 + si)
      } else if (si === garefSq && S.style === 'kogal') {
        // Сходный круг Когалыма: камень и столб с зарубками посередине, кольцо брёвен-скамей, Сходная изба с открытыми стенами, Первый Воз
        ch.solid.cyl(cx, y, cz, 1.7, 0.9, 12, st.stone)
        ch.solid.box(cx, y + 0.9, cz, 0.55, 8, 0.55, st.timber, si)
        for (let k = 0; k < 11; k++) ch.solid.box(cx + (k % 2 ? 0.3 : -0.3), y + 1.5 + k * 0.6, cz, 0.28, 0.12, 0.7, '#e8dcc0', si)
        ch.glow.box(cx, y + 8.9, cz, 0.7, 0.7, 0.7, '#ffffff', si)
        for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283, bx = cx + Math.cos(a) * 6, bz = cz + Math.sin(a) * 6; ch.solid.box(bx, y, bz, 3.2, 0.55, 0.8, st.timber, a + Math.PI / 2) }
        const hx = cx + Math.min(14, Math.sqrt(area) * 0.38), hz = cz
        ch.solid.box(hx, y, hz, 19, 0.5, 8, st.stone, si)
        for (let k = 0; k <= 6; k++) for (const sz of [-3.6, 3.6]) ch.solid.box(hx - 8.4 + k * 2.8, y + 0.5, hz + sz, 0.5, 4.2, 0.5, st.timber, si)
        ch.solid.box(hx, y + 4.7, hz, 19.4, 0.4, 8.4, st.timber, si)
        ch.roof.cyl(hx, y + 5.1, hz, 11.4, 4, 4, st.roof[0], 0, false, si + Math.PI / 4)
        ch.glow.box(hx, y + 0.5, hz, 1.2, 1.4, 1.2, '#ffffff', si)
        const wx = cx - 11, wz = cz + 4
        ch.solid.box(wx, y + 0.6, wz, 4.2, 0.45, 2.2, '#6a4a2a', si)
        for (const sx2 of [-1.4, 1.4]) ch.solid.box(wx + sx2, y, wz - 1.2, 0.3, 1.9, 1.9, '#3a2a14', si)
        for (const sx2 of [-1.4, 1.4]) ch.solid.box(wx + sx2, y, wz + 1.2, 0.3, 1.9, 1.9, '#3a2a14', si)
        fillLine([[cx - 8, cz], [cx + 8, cz]], 9, N + 2 + si)
        fillLine([[hx - 9, hz], [hx + 9, hz]], 8, N + 2 + si)
      } else if (si === garefSq && S.style === 'lyria') {
        // Стена Трёх Тысяч: длинная мраморная стена с рядами светящихся табличек, 31 пилястр, тыльная сторона заложена кирпичом, жаровни по краям
        const len = Math.max(14, Math.min(28, Math.sqrt(area) * 0.8)), cols = Math.floor(len / 0.95)
        ch.solid.box(cx, y, cz, len + 2, 0.5, 4.4, mixHex(st.stone, '#000', 0.12), si)
        ch.solid.box(cx, y + 0.5, cz, len, 5.2, 1.5, '#f0eadb', si)
        ch.solid.box(cx, y + 5.7, cz, len + 0.6, 0.5, 2.1, '#d8d0bc', si)
        ch.solid.box(cx, y + 0.5, cz - 1.05, len, 4.6, 0.5, '#8a4a38', si)
        for (let k = 0; k <= cols; k++) ch.solid.box(cx - len / 2 + (k / cols) * len, y + 0.5, cz + 0.78, 0.18, 5.2, 0.14, '#cfc6b4', si)
        const rr = rng(hashOf(seedName) + si + 7)
        for (let row = 0; row < 3; row++) for (let k = 0; k < cols; k++) {
          const tx = cx - len / 2 + (k + 0.5) * (len / cols), ty = y + 1.2 + row * 1.5
          if (rr() < 0.17) ch.solid.box(tx, ty, cz + 0.8, 0.5, 0.7, 0.08, '#4a4234', si)
          else ch.glow.box(tx, ty, cz + 0.8, 0.5, 0.7, 0.08, '#ffffff', si)
        }
        for (const sx2 of [-1, 1]) { ch.solid.cyl(cx + sx2 * (len / 2 + 1.3), y, cz + 1.4, 0.55, 1.1, 8, st.stone); ch.glow.box(cx + sx2 * (len / 2 + 1.3), y + 1.1, cz + 1.4, 0.7, 0.5, 0.7, '#ffffff', si) }
        fillLine([[cx - len / 2, cz], [cx + len / 2, cz]], 5, N + 2 + si)
      } else if (si === garefSq && S.style === 'temer') {
        // Очаг Крова Темерии: зал с вечно открытым порталом, фонарь над дверью, печная башня с огнём и скамьи приюта
        ch.solid.box(cx, y, cz, 13, 1.0, 13, mixHex(st.stone, '#000', 0.1), si)
        ch.solid.box(cx, y + 1.0, cz, 12, 5.2, 12, st.plaster[0], si)
        ch.solid.box(cx, y + 4.1, cz, 12.3, 0.45, 12.3, st.timber, si)
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ch.solid.box(cx + dx * 6, y + 1.0, cz + dz * 6, 0.55, 5.2, 0.55, st.timber, si)
        for (let k = -1; k <= 1; k++) { ch.solid.box(cx + k * 3.2, y + 1.0, cz - 6.02, 0.3, 5.2, 0.12, st.timber, si); ch.solid.box(cx - 6.02, y + 1.0, cz + k * 3.2, 0.12, 5.2, 0.3, st.timber, si) }
        ch.roof.cyl(cx, y + 6.2, cz, 9.4, 5.6, 4, st.roof[0], 0, false, si + Math.PI / 4)
        // портал: вечно открытая дверь, свет изнутри, лента-притолока и фонарь над дверью
        ch.glow.box(cx + 6.03, y + 1.0, cz, 0.12, 3.6, 3.0, '#ffffff', si)
        ch.solid.box(cx + 6.05, y + 4.6, cz, 0.5, 0.5, 4.4, st.timber, si)
        for (const sz of [-1, 1]) ch.solid.box(cx + 6.05, y + 1.0, cz + sz * 2.0, 0.5, 3.6, 0.5, st.timber, si)
        ch.solid.box(cx + 6.7, y + 3.6, cz, 0.4, 0.7, 0.4, '#2a2a30', si)
        ch.glow.box(cx + 6.75, y + 3.75, cz, 0.28, 0.4, 0.28, '#ffffff', si)
        // печная башня: камень, венец и огонь наверху
        ch.solid.box(cx - 4.6, y + 1.0, cz - 4.6, 3, 14, 3, st.stone, si)
        ch.solid.box(cx - 4.6, y + 14.6, cz - 4.6, 3.7, 0.6, 3.7, mixHex(st.stone, '#fff', 0.15), si)
        ch.glow.box(cx - 4.6, y + 15.2, cz - 4.6, 1.6, 1.3, 1.6, '#ffffff', si)
        // скамьи приюта вокруг
        for (let k = 0; k < 6; k++) { const a = si + (k / 6) * 6.283, bx = cx + Math.cos(a) * 11, bz = cz + Math.sin(a) * 11; ch.solid.box(bx, y, bz, 3, 0.55, 0.8, st.timber, a + Math.PI / 2) }
        fillLine([[cx, cz], [cx + 0.1, cz]], 9, N + 2 + si)
      } else if (si === garefSq && S.style === 'bezd') {
        // Колодец Дальберга: круглая каменная шахта с чёрной водой, чёрные ворота с цепью, ворот с канатами и клетью, вокруг — шесть ступеней-платформ по наборам
        ch.solid.cyl(cx, y, cz, 8.4, 0.7, 20, mixHex(st.stone, '#000', 0.25))
        ch.solid.cyl(cx, y + 0.7, cz, 5.4, 0.2, 20, '#07070c')
        for (let k = 0; k < 6; k++) {
          const a = si + (k / 6) * 6.283, rr = 6.4 + k * 0.25
          ch.solid.box(cx + Math.cos(a) * rr, y + 0.7, cz + Math.sin(a) * rr, 2.4, 0.3 + k * 0.28, 1.6, ['#8a8a96', '#c8785a', '#c8a85a', '#7aa87a', '#6a98c8', '#a878c8'][k], a + Math.PI / 2)
        }
        for (const sd of [-3.6, 3.6]) ch.solid.box(cx + sd, y + 0.7, cz, 0.6, 7, 0.6, st.timber, si)
        ch.solid.box(cx, y + 7.7, cz, 8.2, 0.5, 0.7, st.timber, si)
        ch.solid.cyl(cx, y + 7.0, cz, 0.6, 1.2, 8, '#2a2a30')
        ch.solid.box(cx, y + 3.2, cz, 0.12, 4, 0.12, '#1a1a1e')
        ch.glow.box(cx, y + 2.6, cz, 0.7, 0.7, 0.7, '#ffffff', si)
        for (let k = 0; k < 4; k++) { const a = si + (k * Math.PI) / 2 + 0.4; ch.glow.box(cx + Math.cos(a) * 8.9, y + 0.7, cz + Math.sin(a) * 8.9, 0.35, 0.9, 0.35, '#ffffff', a) }
        fillLine([[cx - 8.4, cz], [cx + 8.4, cz]], 16.8, N + 2 + si)
      } else if (si === garefSq && S.style === 'ntow') {
        // Северная Башня: огромная, широкая, ярусная; двенадцать ярусов сужаются кверху, на каждом пояс окон, у вершины — купол и звёздный шпиль
        const tiers = 12, th = 5.2
        ch.solid.cyl(cx, y, cz, 11.5, 1.4, 20, mixHex(st.stone, '#000', 0.12))
        for (let k = 0; k < tiers; k++) {
          const r0 = 10 - k * 0.55, y0 = y + 1.4 + k * th
          ch.solid.cyl(cx, y0, cz, r0, th, 20, k % 2 ? st.wall : st.plaster[0], r0 - 0.5)
          ch.solid.cyl(cx, y0 + th - 0.35, cz, r0 + 0.2, 0.35, 20, st.stone)
          const wn = opts.mobile ? 8 : 14
          for (let w = 0; w < wn; w++) {
            const a = si + (w / wn) * 6.283 + k * 0.2
            ch.glow.box(cx + Math.cos(a) * (r0 - 0.2), y0 + 1.5, cz + Math.sin(a) * (r0 - 0.2), 0.7, 1.5, 0.35, '#ffffff', a + Math.PI / 2)
          }
        }
        const ty = y + 1.4 + tiers * th
        ch.roof.cyl(cx, ty, cz, 4.4, 3.6, 16, st.roof[0], 0.6)
        ch.solid.cyl(cx, ty + 3.4, cz, 0.18, 6.2, 6, '#c8c8d0')
        ch.glow.box(cx, ty + 9.4, cz, 0.9, 0.9, 0.9, '#ffffff', si)
        for (let k = 0; k < 4; k++) { const a = si + (k * Math.PI) / 2; ch.solid.box(cx + Math.cos(a) * 11.8, y, cz + Math.sin(a) * 11.8, 1.8, 6, 1.8, st.stone, a) }
        fillLine([[cx - 11.5, cz], [cx + 11.5, cz]], 23, N + 2 + si)
      } else if (si === garefSq && S.style === 'gren' && seedName === 'map-city-drogenmau') {
        // Маяк Иссикара Дрогенмау: круглая белая башня в полосах, галерея, фонарь с огнём, бронзовый трезубец; у подножия — Стяг Саренто
        const th = 22
        ch.solid.cyl(cx, y, cz, 4.2, 1.2, 16, mixHex(st.stone, '#000', 0.12))
        for (let k = 0; k < 4; k++) ch.solid.cyl(cx, y + 1.2 + k * (th / 4), cz, 3.0 - k * 0.3, th / 4, 14, k % 2 ? '#c83a3a' : '#f0ece4', 2.7 - k * 0.3)
        ch.solid.cyl(cx, y + 1.2 + th, cz, 2.8, 0.4, 14, st.timber)
        ch.glow.box(cx, y + 1.6 + th, cz, 2.0, 2.2, 2.0, '#ffffff', si)
        ch.roof.cyl(cx, y + 3.8 + th, cz, 2.0, 2.0, 10, '#4a6a7a', 0)
        ch.solid.cyl(cx, y + 5.8 + th, cz, 0.12, 2.4, 6, '#b08a3a')
        ch.solid.box(cx, y + 7.6 + th, cz, 1.4, 0.18, 0.14, '#b08a3a', si)
        for (const sd of [-0.65, 0, 0.65]) ch.solid.box(cx + sd * Math.cos(si), y + 7.6 + th, cz + sd * Math.sin(si), 0.12, 0.8, 0.12, '#b08a3a', si)
        ch.solid.cyl(cx + 6, y, cz + 2, 0.12, 7, 6, st.timber)
        ch.solid.box(cx + 6.9, y + 5.6, cz + 2, 1.8, 1.1, 0.06, '#e8c860', si)
        fillLine([[cx - 4.2, cz], [cx + 4.2, cz]], 8.4, N + 2 + si)
      } else if (si === garefSq && S.style === 'gren') {
        // колокол Набата на площади полиса: деревянная рама с колоколом и шест со Стягом
        ch.solid.box(cx, y, cz, 3.6, 0.3, 2.2, st.stone, si)
        for (const sd of [-1.4, 1.4]) ch.solid.box(cx + sd * Math.cos(si), y + 0.3, cz + sd * Math.sin(si), 0.35, 4.2, 0.35, st.timber, si)
        ch.solid.box(cx, y + 4.5, cz, 3.4, 0.35, 0.45, st.timber, si)
        ch.solid.cyl(cx, y + 3.0, cz, 0.75, 1.4, 12, '#a8803a', 0.35)
        ch.solid.cyl(cx + 3, y, cz + 1.6, 0.1, 6, 6, st.timber)
        ch.solid.box(cx + 3.7, y + 4.9, cz + 1.6, 1.4, 0.9, 0.05, '#e8c860', si)
        fillLine([[cx - 1.8, cz], [cx + 1.8, cz]], 3.6, N + 2 + si)
      } else if (si === garefSq && S.style === 'uuna' && seedName === 'map-city-avel') {
        // Стена Ключей Авеля: длинная каменная стена с воротной аркой, на ней ряды ключей (светятся ночью),
        // перед ней шесть очагов владетелей — каменные горшки с углями и столбами дыма; посередине стол Книги Дымов
        const len = Math.max(14, Math.min(24, Math.sqrt(area) * 0.7))
        ch.solid.box(cx, y, cz, len + 2, 0.4, 5, mixHex(st.stone, '#000', 0.12), si)
        for (const sd of [-1, 1]) ch.solid.box(cx + sd * (len / 4 + 1.6), y + 0.4, cz - 1.2, len / 2 - 3.2, 4.4, 1.2, st.wall, si)
        for (const sd of [-1, 1]) ch.solid.box(cx + sd * 1.8, y + 0.4, cz - 1.2, 0.9, 6.2, 1.4, st.stone, si)
        ch.solid.box(cx, y + 6.2, cz - 1.2, 4.6, 1.0, 1.6, st.stone, si)
        ch.solid.box(cx, y + 7.2, cz - 1.2, 2.6, 0.6, 1.0, st.tower, si)
        const rk = rng(hashOf(seedName) + si + 31), keys = opts.mobile ? 40 : 110
        for (let k = 0; k < keys; k++) {
          const kx = cx + (rk() - 0.5) * (len - 1), ky = y + 1.2 + rk() * 3.0
          if (Math.abs(kx - cx) < 2.6) continue
          if (rk() < 0.35) ch.glow.box(kx, ky, cz - 0.55, 0.12, 0.34, 0.06, '#ffffff', si)
          else ch.solid.box(kx, ky, cz - 0.55, 0.12, 0.34, 0.06, '#c9a24a', si)
        }
        for (let k = 0; k < 6; k++) {
          const hx = cx - len / 2 + 1.6 + (k * (len - 3.2)) / 5, hz = cz + 2.6
          ch.solid.cyl(hx, y + 0.4, hz, 0.75, 0.9, 10, st.stone, 0.95)
          ch.glow.box(hx, y + 1.25, hz, 0.8, 0.15, 0.8, '#ffffff', si)
          if (!opts.mobile) for (let j = 0; j < 3; j++) ch.solid.cyl(hx + Math.sin(j + k) * 0.25, y + 2.0 + j * 1.1, hz, 0.45 + j * 0.12, 0.7, 7, '#d8d4cc', 0.3 + j * 0.1)
        }
        ch.solid.box(cx, y + 0.4, cz + 4.4, 2.2, 1.0, 1.2, st.timber, si)
        ch.solid.box(cx, y + 1.4, cz + 4.4, 1.6, 0.25, 1.0, '#e8dcc0', si)
        fillLine([[cx - len / 2, cz], [cx + len / 2, cz]], 6, N + 2 + si)
      } else if (si === garefSq && S.style === 'uuna') {
        // очаг владетеля на площади: каменный горшок с углями под навесом, куда в День Ворот несут дым
        ch.solid.box(cx, y, cz, 4.4, 0.35, 4.4, st.stone, si)
        ch.solid.cyl(cx, y + 0.35, cz, 1.0, 1.1, 10, mixHex(st.stone, '#000', 0.15), 0.9)
        ch.glow.box(cx, y + 1.45, cz, 1.0, 0.18, 1.0, '#ffffff', si)
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ch.solid.box(cx + dx * 1.9, y + 0.35, cz + dz * 1.9, 0.3, 3.4, 0.3, st.timber, si)
        ch.roof.cyl(cx, y + 3.75, cz, 3.0, 1.6, 4, st.roof[0], 0, false, si + Math.PI / 4)
        fillLine([[cx - 2.2, cz], [cx + 2.2, cz]], 4.4, N + 2 + si)
      } else if (si === garefSq && S.style === 'olek' && seedName === 'map-city-antsla') {
        // Арена Ясного дня Антслы: деревянный амфитеатр (ряды поднимаются наружу), песок, три шатра трупп
        // (белый Валгус, рыжий Кая, лиловый Тули), посередине — Тулакрол с красной кроной, жаровни по кругу
        const R = Math.max(8, Math.min(12, Math.sqrt(area) * 0.36)), segs = opts.mobile ? 18 : 28
        ch.solid.cyl(cx, y, cz, R + 1.4, 0.25, 32, st.stone)
        ch.solid.cyl(cx, y + 0.25, cz, R - 3.2, 0.08, 32, '#d8c8a0')
        for (let t = 0; t < 4; t++) {
          const rr = R - 2.6 + t * 1.0, hh = 0.6 + t * 0.7
          for (let k = 0; k < segs; k++) {
            const a = si + (k / segs) * 6.283
            if (k % Math.floor(segs / 3) === 0 && t < 3) continue // три прохода
            ch.solid.box(cx + Math.cos(a) * rr, y + 0.25, cz + Math.sin(a) * rr, (6.283 * rr) / segs + 0.15, hh, 1.0, t % 2 ? st.timber : mixHex(st.timber, '#fff', 0.18), a + Math.PI / 2)
          }
        }
        for (let k = 0; k < segs; k += 2) {
          const a = si + (k / segs) * 6.283
          ch.solid.box(cx + Math.cos(a) * (R + 0.9), y + 0.25, cz + Math.sin(a) * (R + 0.9), 0.3, 4.2, 0.3, st.timber, a)
        }
        const TENT = ['#f0ece0', '#d8883a', '#8a50b8']
        for (let k = 0; k < 3; k++) {
          const a = si + 0.5 + (k / 3) * 6.283, tx = cx + Math.cos(a) * (R + 2.4), tz = cz + Math.sin(a) * (R + 2.4)
          ch.solid.cyl(tx, y, tz, 1.9, 1.5, 10, TENT[k])
          ch.roof.cyl(tx, y + 1.5, tz, 2.2, 2.4, 10, TENT[k], 0)
          ch.solid.cyl(tx, y + 4.2, tz, 0.06, 1.2, 4, st.timber)
          ch.solid.box(tx, y + 4.9, tz, 0.05, 0.5, 0.8, TENT[k], a)
        }
        ch.solid.cyl(cx, y + 0.3, cz, 0.55, 3.6, 8, '#3a2418', 0.4)
        ch.solid.cyl(cx, y + 3.4, cz, 3.0, 1.6, 12, '#b8202c', 2.2)
        ch.solid.cyl(cx, y + 5.0, cz, 2.2, 1.4, 10, '#c8303a', 0.9)
        ch.solid.cyl(cx, y + 6.4, cz, 0.9, 0.8, 8, '#d84048', 0.1)
        for (let k = 0; k < 6; k++) {
          const a = si + (k / 6) * 6.283
          ch.solid.cyl(cx + Math.cos(a) * (R - 3.6), y + 0.25, cz + Math.sin(a) * (R - 3.6), 0.35, 0.9, 6, '#2a2a30')
          ch.glow.box(cx + Math.cos(a) * (R - 3.6), y + 1.15, cz + Math.sin(a) * (R - 3.6), 0.45, 0.35, 0.45, '#ffffff', a)
        }
        fillLine([[cx - R, cz], [cx + R, cz]], R * 2, N + 2 + si)
      } else if (si === garefSq && S.style === 'olek') {
        // Тулакрол на площади: каменное кольцо-скамья и дерево с вечнокрасной кроной
        ch.solid.cyl(cx, y, cz, 3.6, 0.5, 18, st.stone)
        ch.solid.cyl(cx, y + 0.5, cz, 2.9, 0.08, 18, '#5a6a3a')
        ch.solid.cyl(cx, y + 0.5, cz, 0.4, 2.8, 8, '#3a2418', 0.3)
        ch.solid.cyl(cx, y + 2.8, cz, 2.4, 1.3, 10, '#b8202c', 1.6)
        ch.solid.cyl(cx, y + 4.1, cz, 1.5, 1.1, 8, '#c8303a', 0.2)
        fillLine([[cx - 3.6, cz], [cx + 3.6, cz]], 7.2, N + 2 + si)
      } else if (si === garefSq && S.style === 'harn') {
        // Дом Колыбелей Орельберга: длинный зал и пять башен под щипцами цветов Пяти Домов; в красной башне Харнов горит свет
        const cols = ['#2a4a7a', '#2f5a3a', '#5a3a2a', '#1f5f6e', '#4a4a52']
        const len = 17
        ch.solid.box(cx, y, cz, len + 1, 1.0, 8, mixHex(st.stone, '#000', 0.1), si)
        ch.solid.box(cx, y + 1.0, cz, len, 4.2, 7, st.plaster[0], si)
        ch.solid.box(cx, y + 3.4, cz, len + 0.3, 0.4, 7.3, st.timber, si)
        ch.roof.cyl(cx, y + 5.2, cz, 6.2, 3.2, 4, st.roof[0], 0, false, Math.PI / 4)
        for (let k = 0; k < 5; k++) {
          const tx = cx + (k - 2) * (len / 4.4), tz = cz - 4.4
          ch.solid.box(tx, y + 1.0, tz, 2.6, 7.2, 2.6, st.plaster[1], si)
          ch.solid.box(tx, y + 8.2, tz, 2.9, 0.4, 2.9, cols[k], si)
          ch.roof.cyl(tx, y + 8.6, tz, 2.4, 3.2, 4, cols[k], 0, false, Math.PI / 4)
          if (!opts.mobile || k === 2) ch.glow.box(tx, y + 5.2, tz + 1.32, 0.7, 1.1, 0.12, '#ffffff', si)
        }
        ch.solid.box(cx, y + 1.0, cz + 3.6, 3.2, 3.2, 0.3, st.timber, si)
        ch.glow.box(cx, y + 1.0, cz + 3.8, 2.2, 3.0, 0.1, '#ffffff', si)
        ch.solid.cyl(cx + len / 2 + 2, y, cz + 5, 0.4, 5, 8, st.timber)
        ch.solid.box(cx + len / 2 + 2, y + 4.2, cz + 5.45, 0.12, 1.5, 0.9, '#c03538', si)
        fillLine([[cx - len / 2, cz + 6], [cx + len / 2, cz + 6]], 5, N + 2 + si)
      } else if (si === garefSq) {
        // Светочная башня Гарефорда: каменный ствол, дубовая галерея, фонарная клеть с Пламенем, медный шпиль
        const tw = 4.6, th = 20
        ch.solid.box(cx, y, cz, 6.2, 1.1, 6.2, mixHex(st.stone, '#000', 0.12), si)
        ch.solid.box(cx, y + 1.1, cz, tw, th - 1.1, tw, st.stone, si)
        for (const hy of [4.6, 9.2, 14.2]) ch.solid.box(cx, y + hy, cz, tw + 0.35, 0.3, tw + 0.35, mixHex(st.stone, '#fff', 0.15), si)
        for (let k = 0; k < 4; k++) {
          const a = si + k * Math.PI / 2, ox = Math.cos(a) * (tw / 2 + 0.03), oz = Math.sin(a) * (tw / 2 + 0.03)
          for (const hy of [3, 7.4, 11.8, 16.4]) ch.glow.box(cx + ox, y + hy, cz + oz, 0.7, 1.3, 0.06, '#ffffff', a + Math.PI / 2)
        }
        ch.solid.box(cx, y + th, cz, tw + 1.8, 0.35, tw + 1.8, st.timber, si)
        for (let k = 0; k < 4; k++) for (let j = -2; j <= 2; j++) {
          const a = si + k * Math.PI / 2, nx = Math.cos(a), nz = Math.sin(a), off = (tw + 1.6) / 2
          ch.solid.box(cx + nx * off - nz * j * 1.2, y + th + 0.35, cz + nz * off + nx * j * 1.2, 0.14, 1.0, 0.14, st.timber)
        }
        ch.glow.box(cx, y + th + 0.4, cz, 2.5, 2.9, 2.5, '#ffffff', si)
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ch.solid.box(cx + dx * 1.32 * Math.cos(si) - dz * 1.32 * Math.sin(si), y + th + 0.35, cz + dx * 1.32 * Math.sin(si) + dz * 1.32 * Math.cos(si), 0.22, 3.0, 0.22, '#2a2a30')
        ch.solid.box(cx, y + th + 3.3, cz, 3.3, 0.3, 3.3, '#2a2a30', si)
        ch.roof.cyl(cx, y + th + 3.6, cz, 2.6, 6.2, 4, st.tower, 0, false, si + Math.PI / 4)
        ch.solid.cyl(cx, y + th + 9.7, cz, 0.12, 1.4, 6, '#c9a24a')
        ch.solid.cyl(cx, y + th + 11.1, cz, 0.34, 0.5, 8, '#c9a24a', 0.1)
        fillLine([[cx, cz], [cx + 0.1, cz]], 8.4, N + 2 + si)
      } else if (si % 2 === 0) {
        ch.solid.cyl(cx, y, cz, 3.4, 0.8, 16, st.stone)
        ch.solid.cyl(cx, y + 0.8, cz, 3, 0.02, 16, '#3f7f96')
        ch.solid.cyl(cx, y, cz, 0.7, 2.8, 8, st.stone)
        ch.solid.cyl(cx, y + 2.8, cz, 1.5, 0.3, 10, st.stone, 1.2)
      } else {
        ch.solid.box(cx, y, cz, 3, 2.6, 3, st.stone)
        ch.solid.box(cx, y + 2.6, cz, 1, 2.4, 0.7, '#6d7a70')
        ch.solid.cyl(cx, y + 5, cz, 0.42, 0.75, 8, '#6d7a70', 0.3)
      }
      fillLine([[cx, cz], [cx + 0.1, cz]], 8.4, N + 2 + si)
    } else if (S.style === 'viking') {
      // малая площадь гарда: колодец-сруб
      ch.solid.box(cx, y, cz, 2.2, 0.9, 2.2, mixHex(st.plaster[0], '#000', 0.15))
      fillLine([[cx, cz], [cx + 0.1, cz]], 3.4, N + 2 + si)
      for (const s of [-1, 1]) ch.solid.box(cx + s * 1.0, y + 0.8, cz, 0.18, 2.1, 0.18, st.timber)
      ch.solid.box(cx, y + 2.85, cz, 2.4, 0.18, 0.18, st.timber)
    } else {
      ch.solid.cyl(cx, y, cz, 1.3, 0.9, 10, st.stone)
      fillLine([[cx, cz], [cx + 0.1, cz]], 3.4, N + 2 + si)
      ch.solid.cyl(cx, y + 0.9, cz, 0.95, 0.02, 10, '#26404d')
      for (const s of [-1, 1]) ch.solid.box(cx + s * 1.1, y + 0.8, cz, 0.15, 2.1, 0.15, st.timber)
      ch.solid.cyl(cx, y + 2.9, cz, 1.8, 1, 4, mixHex(st.roof[0], '#000', 0.1), 0, false, Math.PI / 4)
    }
    const stalls = Math.min(detail >= 1 ? 14 : 0, Math.floor(Math.sqrt(area) / 3.2))
    const rad = Math.sqrt(area) * 0.3
    for (let i = 0; i < stalls; i++) {
      const a = (i / stalls) * 6.283 + si, sx = cx + Math.cos(a) * rad, sz = cz + Math.sin(a) * rad
      if (!pointIn([sx, sz], r) || gridAt(sx, sz) !== 0) continue
      const rot = a + Math.PI / 2, col = AWN[i % AWN.length]
      ch.solid.box(sx, y, sz, 2.6, 0.85, 1.1, '#7a5a38', rot)
      for (const s of [-1.2, 1.2]) for (const t of [-0.5, 0.5]) ch.solid.box(sx + Math.cos(rot) * s - Math.sin(rot) * t, y, sz + Math.sin(rot) * s + Math.cos(rot) * t, 0.08, 2.2, 0.08, st.timber)
      ch.solid.box(sx, y + 2.2, sz, 2.9, 0.1, 1.5, col, rot)
      ch.solid.box(sx, y + 0.85, sz, 2, 0.18, 0.7, ['#c9843a', '#8fa04a', '#c94a3a', '#d8c070'][i % 4], rot)
      fillLine([[sx, sz], [sx + 0.1, sz]], 3, si + N + 2)
      // торговец за прилавком, лицом к центру площади
      vendors.push({ x: sx + Math.cos(a) * 1.15, z: sz + Math.sin(a) * 1.15, a: Math.atan2(-Math.cos(a), -Math.sin(a)) })
    }
  })

  // ---------- деревья, кусты, скалы ----------
  const treeSpots: { x: number; z: number; y: number; h: number; t: number }[] = []
  const cap = opts.mobile ? 600 : 2800
  const forest = Math.min(1, S.forest * 2.6)
  const paved = sampler(canvasMask((c) => {
    dists.forEach((r) => { trace(c, r); c.fill() })
    fields.forEach((r) => { trace(c, r); c.fill() })
    squares.forEach((r) => { trace(c, r); c.fill() })
    roads.forEach((q) => { trace(c, q.r, false); c.lineWidth = q.w + 4; c.stroke() })
    rivers.forEach((q) => { trace(c, q.r, false); c.lineWidth = q.w + 6; c.stroke() })
  }, 1, 0))
  const coniferP = S.rocky ? 0.9 : st.conifer
  for (let i = 0; i < cap * 8 && treeSpots.length < cap; i++) {
    const far = R() < 0.7
    const x = far ? center[0] + (R() - 0.5) * Math.min(EW, radius * 7) : R() * W
    const z = far ? center[1] + (R() - 0.5) * Math.min(EH, radius * 7) : R() * H
    if (x < x0 || z < z0 || x > x0 + EW || z > z0 + EH) continue
    const y = heightAt(x, z)
    // город на вершине: ели только на склонах под платформой
    if (kranz ? Math.hypot(x - center[0], z - center[1]) < RP + 8 || y > -DROP * 0.5 || y < -DROP * 1.1 : y < 0.5 || y > 34 || gridAt(x, z) !== 0) continue
    const inPlan = x >= 0 && z >= 0 && x <= W && z <= H
    if (inPlan && paved(x, z) > 0.25) continue
    const d = Math.hypot(x - center[0], z - center[1]) / radius
    const clump = n1(x * 0.018 + 7, z * 0.018 + 3)
    if (R() > forest * (0.25 + clump * 1.6) * Math.min(1.4, 0.35 + d * 0.5)) continue
    treeSpots.push({ x, z, y, h: 5 + R() * 6, t: R() < coniferP ? 1 : 0 })
  }
  if (mtnOn && forest > 0.02) {
    // лес не обрывается по краю земли города: редеющие рощи на предгорьях (свой генератор — город не меняется)
    let sd = (hashOf(seedName) ^ 0x51ed27) >>> 0
    const R2 = (): number => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296)
    const reach = SKIRT * 0.75, capS = Math.round(cap * 0.7)
    for (let i = 0, n = 0; i < capS * 10 && n < capS; i++) {
      const x = x0 - reach + R2() * (EW + reach * 2), z = z0 - reach + R2() * (EH + reach * 2)
      const dOut = Math.max(x0 - x, x - x0 - EW, z0 - z, z - z0 - EH)
      if (dOut <= 0) continue
      const clump = n1(x * 0.009 + 7, z * 0.009 + 3)
      if (R2() > forest * (0.3 + clump * 1.7) * (1 - smooth(reach * 0.15, reach, dOut))) continue
      const y = rawHeight(x, z)
      if (y < 0.6 || y > 14 + mtnW(x, z) * mAmp * 0.45) continue
      treeSpots.push({ x, z, y: y - 0.5, h: 7 + R2() * 8, t: R2() < Math.max(coniferP, mtnW(x, z) * 0.8) ? 1 : 0 })
      n++
    }
  }
  greens.forEach((r) => {
    const [cx, cz] = centerOf(r)
    const n = Math.min(14, Math.floor(Math.abs(areaOf(r)) / 90))
    for (let i = 0; i < n; i++) {
      const x = cx + (R() - 0.5) * Math.sqrt(Math.abs(areaOf(r))), z = cz + (R() - 0.5) * Math.sqrt(Math.abs(areaOf(r)))
      if (pointIn([x, z], r) && gridAt(x, z) === 0) treeSpots.push({ x, z, y: heightAt(x, z), h: 3.5 + R() * 3, t: 0 })
    }
  })
  const instanced: THREE.InstancedMesh[] = []
  const addTrees = (t: number): void => {
    const list = treeSpots.filter((q) => q.t === t)
    if (!list.length) return
    const b = new Bucket()
    if (t === 0) {
      // лиственное: ствол и две шапки; тёмно-зелёное — в цвете экземпляра
      b.cyl(0, 0, 0, 0.09, 0.45, 5, '#5a4632', 0.06, false)
      const blob = new THREE.IcosahedronGeometry(0.34, 0).toNonIndexed()
      const add = (ox: number, oy: number, oz: number, sc: number): void => {
        const p = blob.attributes.position
        for (let i = 0; i < p.count; i += 3) {
          const V = (j: number): V3 => [p.getX(j) * sc + ox, p.getY(j) * sc + oy, p.getZ(j) * sc + oz]
          b.tri(V(i), V(i + 1), V(i + 2), '#ffffff')
        }
      }
      add(0, 0.65, 0, 1)
      add(0.14, 0.5, 0.08, 0.68)
      blob.dispose()
    } else {
      b.cyl(0, 0, 0, 0.07, 0.25, 5, '#4a3a2a', 0.05, false)
      b.cyl(0, 0.18, 0, 0.3, 0.42, 7, '#ffffff', 0, false)
      b.cyl(0, 0.42, 0, 0.23, 0.36, 7, '#e8e8e8', 0, false)
      b.cyl(0, 0.66, 0, 0.15, 0.34, 7, '#d8d8d8', 0, false)
    }
    const geo = b.geometry()!
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
    const m = new THREE.InstancedMesh(geo, mat, list.length)
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color()
    const greensOf = S.style === 'styria' ? ['#3f4f35', '#4a5a3a', '#37452f'] : S.style === 'south' ? ['#6a8440', '#7c8f45', '#5d7a3a'] : ['#4f8038', '#5f9040', '#3f7234', '#6f9a44']
    list.forEach((q, i) => {
      const w = q.h * (t ? 0.8 + R() * 0.3 : 0.85 + R() * 0.45)
      Q.setFromAxisAngle(UP, R() * 6.28)
      M.compose(new THREE.Vector3(q.x, q.y - 0.1, q.z), Q, new THREE.Vector3(w, q.h, w))
      m.setMatrixAt(i, M)
      m.setColorAt(i, col.set(t ? mixHex(greensOf[i % greensOf.length], '#1f3a2a', 0.4) : greensOf[i % greensOf.length]))
    })
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
    instanced.push(m)
    disposable.push(geo, mat)
  }
  addTrees(0)
  addTrees(1)
  if (S.rocky || S.hills) {
    const b = chunkAt(center[0], center[1]).solid
    for (let i = 0; i < (S.rocky ? 160 : 50); i++) {
      const x = R() * W, z = R() * H
      if (gridAt(x, z) !== 0 || paved(x, z) > 0.2) continue
      const s = 0.6 + R() * 2.2
      b.cyl(x, heightAt(x, z) - 0.2, z, s, s * 1.1, 5, '#8a8678', s * 0.35, true, R() * 3)
    }
  }

  // фонари вдоль дорог и на площадях: столб и огонёк, ночью — мягкое свечение
  const glows: number[] = []
  const lamp = (x: number, z: number): void => {
    if (gridAt(x, z) !== 0) return
    const y = heightAt(x, z), ch = chunkAt(x, z)
    ch.solid.box(x, y, z, 0.13, 3.1, 0.13, '#2a2420')
    ch.solid.box(x, y + 3.1, z, 0.34, 0.08, 0.34, '#2a2420')
    ch.glow.box(x, y + 2.7, z, 0.26, 0.4, 0.26, '#ffffff')
    glows.push(x, y + 2.9, z)
    blockProp(x, z, 0.4)
  }
  const LAMP_STEP = S.style === 'styria' ? 68 : 34
  if (detail >= 1) {
    for (const q of roads) {
      let run = 0
      for (let s = 1; s < q.r.length; s++) {
        const a = q.r[s - 1], b = q.r[s], l = Math.hypot(b[0] - a[0], b[1] - a[1])
        for (let t = LAMP_STEP - run; t < l; t += LAMP_STEP) {
          const x = a[0] + ((b[0] - a[0]) * t) / l, z = a[1] + ((b[1] - a[1]) * t) / l
          if (Math.hypot(x - center[0], z - center[1]) > radius * 1.25 || glows.length > 540) continue
          const off = q.w / 2 + 1.2
          lamp(x - ((b[1] - a[1]) / l) * off, z + ((b[0] - a[0]) / l) * off)
        }
        run = (run + l) % LAMP_STEP
      }
    }
    // вдоль главных улиц города
    if (streets && N >= 40) {
      const T = streets, stepCells = Math.max(6, Math.round(LAMP_STEP / T.cell))
      let count = 0
      for (let q = 0; q < T.traffic.length && glows.length < 900; q++) {
        if (!T.main[q] || !T.traffic[q] || T.parent[q] < 0) continue
        if (((q % T.gw) + ((q / T.gw) | 0)) % stepCells !== 0 || count++ % 2) continue
        const w = T.parent[q], dx = T.sp[w * 2] - T.sp[q * 2], dz = T.sp[w * 2 + 1] - T.sp[q * 2 + 1], l = Math.hypot(dx, dz) || 1
        const sd = q % 2 ? 1 : -1
        lamp(T.sp[q * 2] - (dz / l) * 3 * sd, T.sp[q * 2 + 1] + (dx / l) * 3 * sd)
      }
    }
    squares.forEach((r) => r.forEach((p, i) => { if (i % 2 === 0) lamp(p[0] + (centerOf(r)[0] - p[0]) * 0.08, p[1] + (centerOf(r)[1] - p[1]) * 0.08) }))
  }
  const dot = softDot()
  const glowGeo = new THREE.BufferGeometry()
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glows, 3))
  const glowPts = new THREE.PointsMaterial({ map: dot, color: '#ffb864', size: 5.5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false })
  scene.add(new THREE.Points(glowGeo, glowPts))
  disposable.push(dot, glowGeo, glowPts)

  // сборка кусков в меши
  for (const ch of chunks.values()) {
    for (const m of makeMeshes(ch)) disposable.push(m.geometry)
    ch.solid.p = ch.solid.c = ch.roof.p = ch.roof.c = ch.roof.uv = ch.glow.p = ch.glow.c = []
  }

  // ---------- вода ----------
  const waterUni = { uT: { value: 0 }, uDeep: { value: new THREE.Color('#2c6580') }, uSky: { value: new THREE.Color('#9fc8d8') }, uFog: { value: new THREE.Color() }, uNear: { value: 1 }, uFar: { value: 2 }, uDay: { value: 1 } }
  if (hasWater) {
    const geo = new THREE.PlaneGeometry(Math.max(EW * 1.5, EW + SKIRT * 2.1), Math.max(EH * 1.5, EH + SKIRT * 2.1))
    geo.rotateX(-Math.PI / 2)
    geo.translate(W / 2, 0, H / 2)
    const mat = new THREE.ShaderMaterial({
      uniforms: waterUni,
      transparent: true,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uT,uNear,uFar,uDay; uniform vec3 uDeep,uSky,uFog; varying vec3 vW;
        void main(){
          vec3 v = cameraPosition - vW; float d = length(v); v /= d;
          float a = sin(vW.x*0.35+uT*0.9)+sin(vW.z*0.42-uT*0.7)+0.6*sin((vW.x+vW.z)*0.9+uT*1.4)+0.35*sin((vW.x-vW.z)*2.1-uT*1.9);
          vec3 n = normalize(vec3(cos(vW.x*0.35+uT)*0.04, 1.0, cos(vW.z*0.42-uT)*0.04));
          float f = pow(1.0-max(dot(v,n),0.0),3.0);
          float near = exp(-d/260.0);
          vec3 c = mix(uDeep, uSky, clamp(f*0.9+a*0.035*near,0.0,1.0));
          c += vec3(0.9)*uDay*smoothstep(2.05,2.5,a)*0.16*near;
          float fg = clamp((d-uNear)/(uFar-uNear),0.0,1.0);
          gl_FragColor = vec4(mix(c,uFog,fg), mix(0.9,1.0,fg));
          #include <colorspace_fragment>
        }`
    })
    const m = new THREE.Mesh(geo, mat)
    m.renderOrder = 2
    scene.add(m)
    disposable.push(geo, mat)
    // лодки у берега
    const b = new Bucket()
    for (let i = 0, made = 0; i < 300 && made < 7; i++) {
      const x = R() * W, z = R() * H
      const h = heightAt(x, z)
      if (h > -0.5 || h < -2.8 || heightAt(x + 12, z) < -1.6 === heightAt(x - 12, z) < -1.6 && heightAt(x, z + 12) < -1.6 === heightAt(x, z - 12) < -1.6) continue
      const rot = R() * 6.28
      b.box(x, 0.02, z, 4.4, 0.55, 1.5, '#5e4128', rot)
      b.box(x, 0.56, z, 3.6, 0.08, 1.1, '#7a5a38', rot)
      made++
    }
    const bg = b.geometry()
    if (bg) { const bm = new THREE.Mesh(bg, solidMat); bm.castShadow = true; scene.add(bm); disposable.push(bg) }

    // ---------- Крайдонианская Лига: флот у причалов, свайные кварталы над водой, маяк на молу ----------
    if (S.style === 'cray') {
      const nr = rng(hashOf(seedName) + 4242)
      const hull = new Bucket(), sails = new Bucket(), pile = new Bucket(), stilt = new Bucket(), roofs = new Bucket(), lit = new Bucket()
      const isW = (x: number, z: number): boolean => heightAt(x, z) < -0.9
      // ближайшая суша: расстояние и направление к ней
      const toLand = (x: number, z: number): { d: number; a: number } | null => {
        let best: { d: number; a: number } | null = null
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2
          for (let d = 4; d <= 70; d += 4) if (heightAt(x + Math.cos(a) * d, z + Math.sin(a) * d) > 0.3) { if (!best || d < best.d) best = { d, a }; break }
        }
        return best
      }
      const spots: { x: number; z: number; d: number; a: number }[] = []
      // обход сеткой: вода, рядом с которой (до 56 м) есть суша
      const step = opts.mobile ? 12 : 8
      scan: for (let x = -30; x < W + 30; x += step) for (let z = -30; z < H + 30; z += step) {
        if (!isW(x, z)) continue
        let near = false
        for (let k = 0; k < 8 && !near; k++) for (const dd of [10, 24, 40, 56]) if (heightAt(x + Math.cos(k * 0.785) * dd, z + Math.sin(k * 0.785) * dd) > 0.3) { near = true; break }
        if (!near) continue
        const l = toLand(x + (nr() - 0.5) * step, z + (nr() - 0.5) * step)
        if (l) spots.push({ x, z, ...l })
        if (spots.length > 4000) break scan
      }
      // корабль: корпус с полубаком и ютом, золотой планширь, орудийные порты, мачты с парусами и флагом Лиги
      const mk = (x: number, z: number, rot: number, len: number): void => {
        const wd = len * 0.24, hc = ['#4a3220', '#32281f', '#5a3e28'][Math.floor(nr() * 3)]
        const fx = Math.cos(rot), fz = Math.sin(rot)
        const P = (u: number): [number, number] => [x + fx * u, z + fz * u]
        hull.box(x, -0.7, z, len * 0.76, 2.4, wd, hc, rot)
        const [bx, bz] = P(len * 0.4)
        hull.box(bx, -0.4, bz, len * 0.26, 2.0, wd * 0.55, hc, rot)
        const [sx, sz] = P(-len * 0.36)
        hull.box(sx, 1.6, sz, len * 0.26, 1.8, wd * 0.95, mixHex(hc, '#7a5a38', 0.35), rot)
        hull.box(x, 1.6, z, len * 0.76, 0.18, wd * 1.02, '#c9a24a', rot)
        for (let k = -2; k <= 2; k++) {
          const [gx, gz] = P(k * len * 0.12)
          hull.box(gx - fz * (wd / 2 + 0.05), 0.4, gz + fx * (wd / 2 + 0.05), 0.9, 0.7, 0.12, '#17120e', rot)
          hull.box(gx + fz * (wd / 2 + 0.05), 0.4, gz - fx * (wd / 2 + 0.05), 0.9, 0.7, 0.12, '#17120e', rot)
        }
        const masts = len > 26 ? 3 : 2
        for (let m = 0; m < masts; m++) {
          const [mx, mz] = P((m - (masts - 1) / 2) * len * 0.26)
          const mh = len * (m === 1 && masts === 3 ? 0.62 : 0.5)
          pile.box(mx, 1.8, mz, 0.45, mh, 0.45, '#3a2a1e')
          for (let yv = 0; yv < 2; yv++) sails.box(mx, 3.4 + yv * mh * 0.42, mz, 0.16, mh * 0.36, wd * 1.5 - yv * 1.2, '#efe6d0', rot)
          if (m === 0) sails.box(mx + fx * 0.2, 1.8 + mh, mz + fz * 0.2, 0.08, 0.9, 1.7, '#2a3f8a', rot)
        }
      }
      // корабли стоят вдоль берега
      const placed: { x: number; z: number }[] = []
      const nShips = Math.min(24, 5 + Math.floor(radius / 18))
      const shipSpots = spots.filter((p) => p.d >= 16 && p.d <= 56).sort(() => nr() - 0.5)
      for (const p of shipSpots) {
        if (placed.length >= nShips) break
        if (placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 28)) continue
        placed.push(p)
        mk(p.x, p.z, p.a + Math.PI / 2, 18 + nr() * 14)
      }
      // свайные кварталы: дома на помосте над самой водой, мостки к берегу
      const stiltSpots = spots.filter((p) => p.d >= 5 && p.d <= 14).sort(() => nr() - 0.5)
      const used: { x: number; z: number }[] = []
      const nStilt = Math.min(48, 8 + Math.floor(radius / 8))
      for (const p of stiltSpots) {
        if (used.length >= nStilt) break
        if (used.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 11)) continue
        if (gridAt(p.x, p.z) > 0) continue
        used.push(p)
        const w = 6 + nr() * 3, d = 5 + nr() * 2.5, rot = p.a
        stilt.box(p.x, DECK - 0.25, p.z, w + 2, 0.3, d + 2, '#6b4f33', rot)
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const lxp = p.x + Math.cos(rot) * ox * (w / 2 + 0.6) - Math.sin(rot) * oz * (d / 2 + 0.6)
          const lzp = p.z + Math.sin(rot) * ox * (w / 2 + 0.6) + Math.cos(rot) * oz * (d / 2 + 0.6)
          pile.box(lxp, -3, lzp, 0.4, DECK + 3.2, 0.4, '#4a3522')
        }
        stilt.box(p.x, DECK + 0.05, p.z, w, 2.8, d, ['#efe9d8', '#e4ddc8', '#d8d2bc', '#c8d6e0'][Math.floor(nr() * 4)], rot)
        roofs.cyl(p.x, DECK + 2.85, p.z, Math.max(w, d) * 0.72, 2.0, 4, ['#2f4a78', '#3a5a8a', '#27405f'][Math.floor(nr() * 3)], 0, false, rot + Math.PI / 4)
        lit.box(p.x + Math.cos(rot) * (w / 2 + 0.05), DECK + 1.3, p.z + Math.sin(rot) * (w / 2 + 0.05), 0.12, 0.8, 0.9, '#ffffff', rot)
        stilt.box(p.x + Math.cos(p.a) * p.d * 0.5, DECK - 0.2, p.z + Math.sin(p.a) * p.d * 0.5, p.d + 1.5, 0.2, 1.6, '#6b4f33', p.a)
      }
      // маяк на молу — на самой дальней от города кромке воды
      const lh = spots.filter((p) => p.d >= 12 && p.d <= 30).sort((a, b) => Math.hypot(b.x - center[0], b.z - center[1]) - Math.hypot(a.x - center[0], a.z - center[1]))[0]
      if (lh) {
        stilt.box(lh.x + Math.cos(lh.a) * (lh.d / 2), 0.1, lh.z + Math.sin(lh.a) * (lh.d / 2), lh.d + 4, 1.4, 4.2, '#9a968a', lh.a)
        stilt.box(lh.x, -2, lh.z, 8, 3.4, 8, '#8a867a')
        roofs.cyl(lh.x, 1.3, lh.z, 3.4, 9, 8, '#f0eada', 2.6, true)
        roofs.cyl(lh.x, 10.3, lh.z, 2.7, 4, 8, '#2f4a78', 2.7, true)
        roofs.cyl(lh.x, 14.3, lh.z, 2.9, 0.6, 8, '#3a3a42', 2.9, true)
        lit.cyl(lh.x, 14.9, lh.z, 1.5, 2.4, 8, '#ffffff', 1.5, true)
        roofs.cyl(lh.x, 17.3, lh.z, 2.1, 2.6, 8, '#27405f', 0, false)
      }
      for (const [bk, m] of [[hull, solidMat], [sails, solidMat], [pile, solidMat], [stilt, solidMat], [roofs, roofMat], [lit, glowMat]] as [Bucket, THREE.Material][]) {
        const g = bk.geometry()
        if (!g) continue
        const mesh = new THREE.Mesh(g, m)
        mesh.castShadow = m !== glowMat
        mesh.receiveShadow = m !== glowMat
        scene.add(mesh)
        disposable.push(g)
      }
    }
  }

  // ---------- небо, солнце, звёзды, облака ----------
  const skyUni = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSunK: { value: 1 } }
  const skyGeo = new THREE.SphereGeometry(1, 24, 16)
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUni,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position*10.0,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 uTop,uHor,uSun,uSunCol; uniform float uSunK; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        vec3 c = mix(uHor, uTop, pow(clamp(d.y*1.35,0.0,1.0),0.62));
        float s = max(dot(d,uSun),0.0);
        c += uSunCol*(pow(s,420.0)*1.4 + pow(s,9.0)*0.2)*uSunK;
        gl_FragColor = vec4(c,1.0);
        #include <colorspace_fragment>
      }`
  })
  const sky = new THREE.Mesh(skyGeo, skyMat)
  sky.renderOrder = -10
  sky.frustumCulled = false
  scene.add(sky)
  disposable.push(skyGeo, skyMat)

  const starPos: number[] = []
  for (let i = 0; i < 700; i++) {
    const a = R() * 6.283, y = 0.05 + R() * 0.95, q = Math.sqrt(1 - y * y)
    starPos.push(Math.cos(a) * q, y, Math.sin(a) * q)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false })
  const stars = new THREE.Points(starGeo, starMat)
  stars.scale.setScalar(4000)
  stars.renderOrder = -9
  stars.frustumCulled = false
  scene.add(stars)
  disposable.push(starGeo, starMat)

  const cloudMat = new THREE.SpriteMaterial({ map: dot, color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, fog: false })
  disposable.push(cloudMat)
  const clouds = new THREE.Group()
  const skyH = Math.max(160, radius * 0.9)
  for (let i = 0; i < (opts.mobile ? 14 : 30); i++) {
    const cx = center[0] + (R() - 0.5) * (radius * 6 + 800), cz = center[1] + (R() - 0.5) * (radius * 6 + 800), cy = skyH + R() * 60
    const puffs = 3 + Math.floor(R() * 4), w = 60 + R() * 110
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Sprite(cloudMat)
      s.position.set(cx + (R() - 0.5) * w, cy + (R() - 0.5) * 8, cz + (R() - 0.5) * w * 0.5)
      s.scale.set(w * (0.6 + R() * 0.6), w * (0.22 + R() * 0.15), 1)
      clouds.add(s)
    }
  }
  scene.add(clouds)

  // ---------- люди ----------
  const life = createLife({ scene, streets, heightAt: (x: number, z: number) => bridgeAt(x, z) ?? heightAt(x, z), gridAt, doors, pois, gates: gatePts, vendors, center, radius, size: [W, H], style: S.style, buildings: N, mobile: opts.mobile, rnd: R, dot, population, state: opts.state, culture: opts.culture, gov: opts.gov })
  let marksOn = false

  // ---------- дым из труб ----------
  const smokeSrc = [...monOut.smoke, ...monOut.smoke, ...chimneys.filter((_, i) => i % (opts.mobile ? 8 : 3) === 0).slice(0, opts.mobile ? 20 : 70)]
  const PUFFS = 3
  const smokePos = new Float32Array(smokeSrc.length * PUFFS * 3)
  const smokeGeo = new THREE.BufferGeometry()
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3))
  const smokeMat = new THREE.PointsMaterial({ map: dot, color: '#cfcfcf', size: 3.6, transparent: true, opacity: 0.34, depthWrite: false })
  const smokePts = new THREE.Points(smokeGeo, smokeMat)
  smokePts.frustumCulled = false
  scene.add(smokePts)
  disposable.push(smokeGeo, smokeMat)

  // ---------- подписи особых зданий ----------
  const labels = new THREE.Group()
  labels.visible = false
  const labelCache = new Map<string, { sp: THREE.Sprite; name: string; tex: THREE.Texture; mat: THREE.SpriteMaterial }>()
  const setPlaces = (list: CityPlace[]): void => {
    const seen = new Set<string>()
    for (const q of list) {
      seen.add(q.id)
      const old = labelCache.get(q.id)
      if (old && old.name === q.name) continue
      if (old) { labels.remove(old.sp); old.tex.dispose(); old.mat.dispose() }
      const c = document.createElement('canvas')
      const ctx = c.getContext('2d')!
      const font = '600 30px Georgia, serif'
      ctx.font = font
      c.width = Math.ceil(ctx.measureText(q.name).width) + 28
      c.height = 48
      ctx.font = font
      ctx.fillStyle = 'rgba(20,23,29,.82)'
      ctx.beginPath()
      ctx.roundRect(0, 0, c.width, c.height, 10)
      ctx.fill()
      ctx.fillStyle = '#f3ead6'
      ctx.textBaseline = 'middle'
      ctx.fillText(q.name, 14, 25)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false, fog: false })
      const sp = new THREE.Sprite(mat)
      const b = q.building
      const at = b != null ? monAt.get(b) : undefined
      const ctr: P2 = at ? [at.x, at.z] : b != null && blds[b] ? centerOf(blds[b].r) : [q.x / k, q.y / k]
      const top = b != null && tops[b] ? tops[b] : heightAt(ctr[0], ctr[1]) + 2
      sp.position.set(ctr[0], top + 3, ctr[1])
      sp.scale.set((c.width / c.height) * 0.026, 0.026, 1)
      sp.renderOrder = 20
      labels.add(sp)
      labelCache.set(q.id, { sp, name: q.name, tex, mat })
    }
    for (const [id, v] of labelCache) if (!seen.has(id)) { labels.remove(v.sp); v.tex.dispose(); v.mat.dispose(); labelCache.delete(id) }
  }
  setPlaces(opts.places)
  scene.add(labels)
  // подписи не налезают друг на друга: ближняя к камере остаётся, задетая ею прячется
  let labelCheck = 0
  const tmpLbl = new THREE.Vector3()
  const declutter = (cam: THREE.Camera): void => {
    const pc = cam as THREE.PerspectiveCamera
    const tf = pc.isPerspectiveCamera ? Math.tan((pc.fov * Math.PI) / 360) : 1, asp = pc.isPerspectiveCamera ? pc.aspect : 1
    const list = [...labelCache.values()].map((v) => ({ sp: v.sp, d: v.sp.position.distanceToSquared(cam.position) })).sort((m, n) => m.d - n.d)
    const shown: [number, number, number, number][] = []
    for (const { sp } of list) {
      tmpLbl.copy(sp.position).project(cam)
      if (tmpLbl.z > 1) { sp.visible = false; continue }
      const hw = (0.5 * sp.scale.x) / tf / asp + 0.01, hh = (0.5 * sp.scale.y) / tf + 0.008
      const box: [number, number, number, number] = [tmpLbl.x - hw, tmpLbl.y - hh, tmpLbl.x + hw, tmpLbl.y + hh]
      sp.visible = !shown.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])
      if (sp.visible) shown.push(box)
    }
  }
  let nightNow = 0

  // подсветка здания: полупрозрачная оболочка по контуру, как рамка на плане
  const shellMat = (color: string, op: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false })
  const hoverMat = shellMat('#fff3c4', 0.32), selMat = shellMat('#ffd76a', 0.5)
  const shell = (mat: THREE.Material): THREE.Mesh => { const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 6; scene.add(m); disposable.push(m.geometry, mat as THREE.Material); return m }
  const hoverShell = shell(hoverMat), selShell = shell(selMat)
  const shellFor = (mesh: THREE.Mesh, i: number | null): void => {
    if (i === null || (!blds[i] && !monAt.has(i)) || removed[i]) { mesh.visible = false; return }
    const m = monAt.get(i)
    let r: P2[] = blds[i].r
    if (m) {
      const c = Math.cos(m.rot), n = Math.sin(m.rot)
      r = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, d]) => { const u = (a * m.L) / 2 + a * 0.6, v = (d * m.W) / 2 + d * 0.6; return [m.x + u * c - v * n, m.z + u * n + v * c] as P2 })
    } else r = grow(r, 0.25)
    const ce = centerOf(r), y0 = heightAt(ce[0], ce[1]) - 0.2, y1 = Math.max(tops[i], y0 + 3) + 0.4
    const pos: number[] = []
    r.forEach((a, e) => {
      const b = r[(e + 1) % r.length]
      pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1])
    })
    mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    mesh.visible = true
  }
  let lastHover: number | null = null, lastSel: number | null = null

  // ---------- свет и время суток ----------
  const hemi = new THREE.HemisphereLight('#ffffff', '#7a8a5a', 1)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#ffffff', 3)
  sun.castShadow = !(opts.mobile && N > 500)
  sun.shadow.mapSize.setScalar(opts.mobile ? 1024 : 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.25
  scene.add(sun, sun.target)
  // ночью у ближайших к камере фонарей горят настоящие огни: тёплые пятна света на стенах и мостовой
  const lampLights: THREE.PointLight[] = []
  for (let i = 0; i < (opts.mobile ? 0 : 6); i++) {
    const l = new THREE.PointLight('#ffb866', 0, 30, 2)
    scene.add(l)
    lampLights.push(l)
  }
  let lampCheck = 0
  scene.fog = new THREE.Fog('#ffffff', 300, 1500)
  const fog = scene.fog as THREE.Fog
  fog.near = Math.max(280, radius * 1.1)
  fog.far = Math.max(1100, radius * 4.2)
  waterUni.uNear.value = fog.near
  waterUni.uFar.value = fog.far

  // ---------- подгорный город (Фарвольская лига): свод пещеры, сталактиты, столбы, кристаллы и фонари на цепях ----------
  // свод рисуется только изнутри: сверху (в обзоре) видна дальняя стена пещеры, как в разрезе, а на прогулке — потолок
  const deep = S.style === 'deep'
  if (deep) {
    const RX = radius * 1.12 + 40, RY = Math.max(60, Math.min(150, radius * 0.55 + 34))
    const y0 = heightAt(center[0], center[1]) - 4
    const cr = rng(hashOf(seedName) + 991)
    const geo = new THREE.SphereGeometry(1, 72, 30, 0, Math.PI * 2, 0, Math.PI * 0.62)
    const pos = geo.attributes.position
    const cols: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const k = 1 + Math.sin(x * 9 + z * 5) * 0.035 + Math.sin(z * 13 - y * 7) * 0.03 + Math.sin(x * 23 + y * 17) * 0.015
      pos.setXYZ(i, center[0] + x * RX * k, y0 + y * RY * k, center[1] + z * RX * k)
      const c = C(mixHex('#55493e', '#2c2520', (Math.sin(x * 31 + z * 27) + 1) / 2))
      cols.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    geo.computeVertexNormals()
    const caveMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.BackSide })
    const cave = new THREE.Mesh(geo, caveMat)
    scene.add(cave)
    disposable.push(geo, caveMat)
    const domeY = (x: number, z: number): number => { const d = Math.hypot(x - center[0], z - center[1]) / RX; return y0 + RY * Math.sqrt(Math.max(0, 1 - d * d)) }
    const rock = new Bucket(), crys = new Bucket(), lant = new Bucket()
    const rockCol = (): string => mixHex('#4a4038', '#6e6252', cr())
    // сталактиты, на концах некоторых — светящиеся кристаллы
    for (let i = 0; i < 170; i++) {
      const a = cr() * Math.PI * 2, d = Math.sqrt(cr()) * RX * 0.93
      const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d
      const top = domeY(x, z) + 2, len = 5 + cr() * RY * 0.24, rr = 1.2 + cr() * 3.6
      rock.cyl(x, top - len, z, 0, len, 6, rockCol(), rr, false)
      if (i % 3 === 0) crys.cyl(x, top - len - 1.6, z, 0, 2.2, 5, '#ffffff', 0.7, false)
    }
    // кристаллы на полу у стен пещеры
    for (let i = 0; i < 90; i++) {
      const a = cr() * Math.PI * 2, d = RX * (0.75 + cr() * 0.2)
      const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d
      if (gridAt(x, z) !== 0) continue
      const g = heightAt(x, z), h = 1.5 + cr() * 4
      crys.cyl(x, g - 0.3, z, 0.6 + cr() * 0.6, h, 5, '#ffffff', 0, false, cr() * 3)
    }
    // каменные столбы, что держат свод: только там, где нет домов и улиц
    let made = 0
    for (let i = 0; i < 160 && made < 10; i++) {
      const a = cr() * Math.PI * 2, d = RX * (0.35 + cr() * 0.5)
      const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d, rr = 4 + cr() * 4
      let ok = true
      for (let k = 0; k < 8 && ok; k++) { const b = (k / 8) * Math.PI * 2; if (gridAt(x + Math.cos(b) * rr * 1.5, z + Math.sin(b) * rr * 1.5) !== 0 || roadAt(x + Math.cos(b) * rr, z + Math.sin(b) * rr) > 0.2) ok = false }
      if (!ok || gridAt(x, z) !== 0) continue
      const g = heightAt(x, z), top = domeY(x, z), col = rockCol()
      rock.cyl(x, g - 2, z, rr * 1.5, 6, 9, col, rr, false)
      rock.cyl(x, g + 4, z, rr, top - g - 12, 9, col, rr * 0.9, false)
      rock.cyl(x, top - 8, z, rr * 0.9, 10, 9, col, rr * 2.2, false)
      for (let k = 0; k < 4; k++) lant.box(x + Math.cos(k * 1.571) * (rr + 0.05), g + 6, z + Math.sin(k * 1.571) * (rr + 0.05), 0.8, 1.1, 0.2, '#ffffff', k * 1.571 + 1.571)
      made++
    }
    // фонари на цепях над улицами
    for (let i = 0; i < 40; i++) {
      const a = cr() * Math.PI * 2, d = Math.sqrt(cr()) * radius * 0.85
      const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d
      if (roadAt(x, z) < 0.3) continue
      const g = heightAt(x, z), top = domeY(x, z), low = g + 16 + cr() * 10
      if (top - low < 4) continue
      rock.box(x, low + 1.2, z, 0.12, top - low - 1.2, 0.12, '#2a2420')
      lant.box(x, low, z, 1.1, 1.3, 1.1, '#ffffff')
      rock.box(x, low + 1.3, z, 1.4, 0.2, 1.4, '#3a3028')
    }
    const crysMat = new THREE.MeshBasicMaterial({ color: '#6fcfe8', toneMapped: false, fog: true })
    for (const [b, m, sh] of [[rock, solidMat, true], [crys, crysMat, false], [lant, glowMat, false]] as [Bucket, THREE.Material, boolean][]) {
      const g = b.geometry()
      if (!g) continue
      const mesh = new THREE.Mesh(g, m)
      mesh.receiveShadow = sh
      scene.add(mesh)
      disposable.push(g)
    }
    disposable.push(crysMat)
    fog.near = Math.max(60, radius * 0.45)
    fog.far = RX * 2.4
    waterUni.uNear.value = fog.near
    waterUni.uFar.value = fog.far
  }

  // ---------- город на вершине (Высокогорное Княжество): стена платформы, скала с дворцом, подъёмники, Подошва, облака ----------
  const gondolas: { mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; sag: number; ph: number; sp: number }[] = []
  if (kranz) {
    const kr = rng(hashOf(seedName) + 1337)
    const wallB = new Bucket(), roofB = new Bucket(), lit = new Bucket(), huts = new Bucket(), cableB = new Bucket()
    const stone = mixHex(st.stone, '#7a766c', 0.3), stone2 = mixHex(st.stone, '#ffffff', 0.18)
    const at = (a: number, r: number): [number, number] => [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]
    // стена платформы: от склона до парапета, с контрфорсами и зубцами
    const SEG = 180
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2
      const [x0w, z0w] = at(a0, RP + 1), [x1w, z1w] = at(a1, RP + 1)
      const [xi0, zi0] = at(a0, RP - 1.4), [xi1, zi1] = at(a1, RP - 1.4)
      const top = Math.max(heightAt(...at(a0, RP - 3)), heightAt(...at(a1, RP - 3))) + 1.5
      const bot0 = heightAt(...at(a0, RP + 7)) - 4, bot1 = heightAt(...at(a1, RP + 7)) - 4
      wallB.quad([x0w, bot0, z0w], [x1w, bot1, z1w], [x1w, top, z1w], [x0w, top, z0w], i % 2 ? stone : stone2, 0.9)
      wallB.quad([xi0, top - 1.6, zi0], [xi1, top - 1.6, zi1], [xi1, top, zi1], [xi0, top, zi0], stone, 1)
      wallB.quad([x0w, top, z0w], [x1w, top, z1w], [xi1, top, zi1], [xi0, top, zi0], stone2, 1.05)
      if (i % 3 === 0) { const [cx, cz] = at((a0 + a1) / 2, RP); wallB.box(cx, top, cz, 1.4, 0.9, 2.4, stone2, -(a0 + a1) / 2) }
      if (i % 10 === 0) {
        // контрфорс уходит в склон
        const [bx, bz] = at(a0, RP + 4), b = heightAt(bx, bz) - 6
        wallB.box(bx, b, bz, 6, top - b - 2, 3.4, stone, -a0 + Math.PI / 2)
      }
    }
    // скала вершины: каменные зубья, а на макушке — дворец князя или храм Света
    for (let i = 0; i < 26; i++) {
      const a = kr() * Math.PI * 2, d = R0 * (0.25 + kr() * 0.7)
      const [x, z] = at(a, d), g = heightAt(x, z)
      wallB.cyl(x, g - 4, z, 3 + kr() * 5, 8 + kr() * PEAK * 0.3, 5, mixHex('#7d7a70', '#9a968a', kr()), 0, false, kr() * 3)
    }
    const topY = heightAt(center[0], center[1])
    const capital = N > 220
    const keep = (x: number, z: number, w: number, h: number, roofH: number, col: string, rot = 0): void => {
      wallB.box(x, topY - 6, z, w, h + 6, w, col, rot)
      roofB.cyl(x, topY + h, z, w * 0.78, roofH, 4, st.roof[0], 0, false, rot + Math.PI / 4)
      for (let k = 0; k < 4; k++) lit.box(x + Math.cos(rot + k * 1.571) * (w / 2 + 0.05), topY + h * 0.62, z + Math.sin(rot + k * 1.571) * (w / 2 + 0.05), 0.9, 1.5, 0.15, '#ffffff', rot + k * 1.571 + 1.571)
    }
    if (capital) {
      // дворец Адлерхорнов: главная башня, четыре угловые и выше всех — Орлиная
      wallB.box(center[0], topY - 1, center[1], 30, 6, 30, stone2)
      keep(center[0], center[1], 13, 18, 14, '#efeae0')
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * 1.571; const [x, z] = at(a, 11); keep(x, z, 5.5, 22, 11, '#e8e2d4', a) }
      keep(center[0] + 3, center[1] - 3, 4.5, 34, 13, '#f4f0e8')
    } else {
      // храм Света: белая башня, огонь на шпиле
      keep(center[0], center[1], 7, 15, 12, '#f4f0e8')
      lit.cyl(center[0], topY + 27, center[1], 0.6, 2.5, 6, '#ffffff', 0.1)
    }
    // подъёмники: верхняя станция у края платформы, нижняя — в долине; канаты провисают, бадьи ходят вверх и вниз
    const LIFTS = capital ? 4 : 2
    const cableMat = new THREE.MeshBasicMaterial({ color: '#2a2622', fog: true, side: THREE.DoubleSide })
    const gondGeo = new THREE.BoxGeometry(4.2, 3.6, 5.4)
    const gondMat = new THREE.MeshLambertMaterial({ color: '#6a4a30' })
    disposable.push(cableMat, gondGeo, gondMat)
    for (let l = 0; l < LIFTS; l++) {
      const a = (l / LIFTS) * Math.PI * 2 + kr() * 0.6 + 0.3
      const [tx, tz] = at(a, RP - 6), ty = heightAt(tx, tz)
      const far = RP + DROP * (1.15 + kr() * 0.35)
      const [bx, bz] = at(a + (kr() - 0.5) * 0.3, far), by = heightAt(bx, bz)
      // станции: каменный низ, деревянный верх, большое колесо
      for (const [x, z, y, big] of [[tx, tz, ty, true], [bx, bz, by, false]] as [number, number, number, boolean][]) {
        huts.box(x, y - 2, z, 9, 7, 7, stone, -a)
        huts.box(x, y + 5, z, 9.4, 4, 7.4, st.timber, -a)
        roofB.cyl(x, y + 9, z, 7.2, 4, 4, st.roof[1], 0, false, -a + Math.PI / 4)
        huts.cyl(x - Math.sin(a) * 3.8, y + 3, z + Math.cos(a) * 3.8, 3.4, 0.5, 14, '#3a2a1e', 3.4, true)
        if (big) lit.box(x, y + 2, z, 1, 1.4, 7.6, '#ffffff', -a)
      }
      // два каната с провисом
      for (const off of [-1.4, 1.4]) {
        const ox = -Math.sin(a) * off, oz = Math.cos(a) * off
        const A = new THREE.Vector3(tx + ox, ty + 7, tz + oz), B = new THREE.Vector3(bx + ox, by + 7, bz + oz)
        const sag = A.distanceTo(B) * 0.06
        const STEPS = 28
        const P = (t: number): THREE.Vector3 => new THREE.Vector3().lerpVectors(A, B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0))
        for (let k = 0; k < STEPS; k++) {
          const p = P(k / STEPS), q = P((k + 1) / STEPS)
          cableB.quad([p.x, p.y, p.z], [q.x, q.y, q.z], [q.x, q.y + 0.6, q.z], [p.x, p.y + 0.6, p.z], '#2a2622')
        }
        // бадьи: по четыре на канат, по одному канату вверх, по другому вниз
        for (let k = 0; k < 4; k++) {
          const m = new THREE.Mesh(gondGeo, gondMat)
          m.castShadow = true
          m.rotation.y = -a
          scene.add(m)
          gondolas.push({ mesh: m, a: A, b: B, sag, ph: k / 4 + (off > 0 ? 0.125 : 0), sp: (off > 0 ? 1 : -1) * 0.012 })
        }
      }
      // в Подошве у нижней станции — рудник: хижины подгорников, отвалы, вход в штольню
      const hutN = 7 + Math.floor(kr() * 6)
      for (let k = 0; k < hutN; k++) {
        const ha = a + (kr() - 0.5) * 0.5, hr = far + (kr() - 0.3) * 70
        const [hx, hz] = at(ha, hr), hy = heightAt(hx, hz), w = 4 + kr() * 3, d = 3.5 + kr() * 2.5, rot = kr() * 3
        huts.box(hx, hy - 1.5, hz, w, 4.5, d, mixHex('#7d766c', '#958c7e', kr()), rot)
        huts.box(hx, hy + 3, hz, w + 0.6, 0.6, d + 0.6, '#5b5550', rot)
        if (kr() < 0.5) lit.box(hx + Math.cos(rot) * (w / 2 + 0.05), hy + 1.2, hz + Math.sin(rot) * (w / 2 + 0.05), 0.8, 1, 0.1, '#ffffff', rot + 1.571)
      }
      for (let k = 0; k < 3; k++) {
        const [hx, hz] = at(a + (kr() - 0.5) * 0.4, far + 30 + kr() * 50), hy = heightAt(hx, hz)
        huts.cyl(hx, hy - 2, hz, 9 + kr() * 8, 6 + kr() * 7, 7, '#6e6a62', 0, false, kr() * 3)
      }
      const [mx, mz] = at(a + 0.12, far - 18), my = heightAt(mx, mz)
      huts.box(mx, my - 2, mz, 6, 7, 3, '#4a4038', -a)
      huts.box(mx, my - 2, mz, 3.6, 5, 3.4, '#0e0c0a', -a)
      lit.box(mx + 2.6, my + 2.4, mz, 0.6, 0.9, 0.6, '#ffffff')
    }
    for (const [b, m, sh] of [[wallB, solidMat, true], [roofB, roofMat, true], [huts, solidMat, true], [lit, glowMat, false], [cableB, cableMat, false]] as [Bucket, THREE.Material, boolean][]) {
      const g = b.geometry()
      if (!g) continue
      const mesh = new THREE.Mesh(g, m)
      mesh.castShadow = sh
      mesh.receiveShadow = sh
      scene.add(mesh)
      disposable.push(g)
    }
    // облака ниже платформы: город над облаками
    const lowMat = new THREE.SpriteMaterial({ map: dot, color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false, fog: false })
    disposable.push(lowMat)
    for (let i = 0; i < (opts.mobile ? 30 : 70); i++) {
      const a = kr() * Math.PI * 2, d = RP + 40 + kr() * DROP * 1.6
      const sp = new THREE.Sprite(lowMat)
      const [x, z] = at(a, d)
      sp.position.set(x, -DROP * (0.35 + kr() * 0.25), z)
      const w = 70 + kr() * 120
      sp.scale.set(w, w * 0.3, 1)
      clouds.add(sp)
    }
    fog.near = Math.max(fog.near, RP * 1.4)
    fog.far = Math.max(fog.far, (RP + DROP * 2) * 2.2)
    waterUni.uNear.value = fog.near
    waterUni.uFar.value = fog.far
  }

  const KEY = {
    // тёплое солнце и мягкий свет неба, приглушённый пастельный горизонт
    day: { top: '#5f97c9', hor: '#cfdfdc', sun: '#ffe8c4', sunK: 2.75, hemiK: 1.6, sky: '#f1ecde', gnd: '#74866a' },
    gold: { top: '#4a5f92', hor: '#e9b594', sun: '#ffa868', sunK: 2.4, hemiK: 1.0, sky: '#dcc0b4', gnd: '#6a5a4a' },
    night: { top: '#0a1226', hor: '#22344f', sun: '#9db4ff', sunK: 0.95, hemiK: 0.74, sky: '#4a5a98', gnd: '#20263a' }
  }
  const lerpKey = (a: typeof KEY.day, b: typeof KEY.day, t: number): typeof KEY.day => ({ top: mixHex(a.top, b.top, t), hor: mixHex(a.hor, b.hor, t), sun: mixHex(a.sun, b.sun, t), sunK: a.sunK + (b.sunK - a.sunK) * t, hemiK: a.hemiK + (b.hemiK - a.hemiK) * t, sky: mixHex(a.sky, b.sky, t), gnd: mixHex(a.gnd, b.gnd, t) })
  let exposure = 1
  const setTime = (hour: number, focus: THREE.Vector3): void => {
    // под горой нет ни дня, ни ночи: свет сверху из зеркальных шахт, тени не бегают
    if (deep) hour = 11.5
    const ph = ((hour - 6) / 14) * Math.PI
    const elev = Math.sin(ph) // > 0 — солнце над горизонтом (6:00–20:00)
    const k = elev > 0.28 ? KEY.day : elev > 0 ? lerpKey(KEY.gold, KEY.day, elev / 0.28) : elev > -0.2 ? lerpKey(KEY.night, KEY.gold, 1 + elev / 0.2) : KEY.night
    const nightK = smooth(0.16, -0.14, elev)
    // на закате и ночью кадр чуть светлее, чтобы тени не проваливались
    exposure = deep ? 1.22 : 1 + 0.1 * smooth(0.3, 0, elev)
    skyUni.uTop.value.set(k.top)
    skyUni.uHor.value.set(k.hor)
    skyUni.uSunCol.value.set(k.sun)
    skyUni.uSunK.value = 1 - nightK * 0.7
    fog.color.set(k.hor)
    waterUni.uFog.value.copy(fog.color)
    waterUni.uSky.value.set(mixHex(k.hor, k.top, 0.3))
    waterUni.uDeep.value.set(mixHex('#2c6580', k.top, 0.4 + nightK * 0.4)).multiplyScalar(1 - nightK * 0.6)
    waterUni.uDay.value = 1 - nightK
    hemi.color.set(k.sky)
    hemi.groundColor.set(k.gnd)
    hemi.intensity = k.hemiK * (S.style === 'styria' ? 1 + nightK * 0.7 : 1)
    // ночью светит луна с другой стороны неба
    const az = ph * 0.9 + 0.5
    const up = elev > 0.02 ? Math.max(0.12, elev) : 0.62
    const flip = elev > 0.02 ? 1 : -1
    const dir = new THREE.Vector3(Math.cos(az) * flip, up * 1.15, Math.sin(az) * 0.6 * flip + 0.35).normalize()
    skyUni.uSun.value.copy(dir)
    sun.color.set(k.sun)
    sun.intensity = k.sunK
    const span = Math.min(radius * 1.25 + 60, focus.y > 30 ? radius * 1.25 + 60 : 200)
    const cam = sun.shadow.camera
    cam.left = cam.bottom = -span
    cam.right = cam.top = span
    cam.near = 1
    cam.far = span * 4 + 400
    cam.updateProjectionMatrix()
    // смещение тени под размер её клетки, иначе на стенах появляются полосы
    sun.shadow.normalBias = ((span * 2) / sun.shadow.mapSize.x) * 2.2
    sun.shadow.bias = -0.0004
    sun.target.position.set(focus.x, 0, focus.z)
    sun.position.copy(sun.target.position).addScaledVector(dir, span * 1.5 + 200)
    sun.target.updateMatrixWorld()
    // окна и фонари
    glowMat.color.set('#39464f').lerp(new THREE.Color(1.0, 0.72, 0.36).multiplyScalar(1.5), nightK * 0.95 + smooth(0.3, 0.05, elev) * 0.2)
    glowPts.opacity = nightK * 0.8
    starMat.opacity = nightK
    cloudMat.color.set(k.hor).lerp(new THREE.Color('#ffffff'), 0.65 * (1 - nightK))
    cloudMat.opacity = 0.62 - nightK * 0.46
    nightNow = nightK
    for (const l of lampLights) l.intensity = nightK * 45
    smokeMat.color.set(nightK > 0.5 ? '#50566a' : '#cfcfcf')
    if (deep) {
      skyUni.uTop.value.set('#0c0907')
      skyUni.uHor.value.set('#1a120c')
      skyUni.uSunK.value = 0
      fog.color.set('#160f0a')
      waterUni.uFog.value.copy(fog.color)
      waterUni.uSky.value.set('#3a2a1c')
      waterUni.uDeep.value.set('#0e1a20')
      waterUni.uDay.value = 0.3
      hemi.color.set('#c8a888')
      hemi.groundColor.set('#4a3626')
      hemi.intensity = 1.2
      sun.color.set('#ffc890')
      sun.intensity = 1.2
      glowMat.color.set(new THREE.Color(1.0, 0.72, 0.36).multiplyScalar(1.5))
      glowPts.opacity = 0.8
      starMat.opacity = 0
      cloudMat.opacity = 0
      nightNow = 1
      for (const l of lampLights) l.intensity = 45
      smokeMat.color.set('#50566a')
    }
  }

  // ---------- кадр ----------
  const tmpFocus = new THREE.Vector3(), tmpDir = new THREE.Vector3()
  const tick = (dt: number, t: number, cam: THREE.Camera): void => {
    waterUni.uT.value = t
    clouds.position.x = kranz ? Math.sin(t * 0.01) * 30 : ((t * 1.1) % 800) - 400
    for (const g of gondolas) {
      const u = (((g.ph + t * g.sp) % 1) + 1) % 1
      g.mesh.position.lerpVectors(g.a, g.b, u)
      g.mesh.position.y -= g.sag * 4 * u * (1 - u) + 3.4
    }
    sky.position.copy(cam.position)
    stars.position.copy(cam.position)
    labelCheck -= dt
    if (labels.visible && labelCheck <= 0) { labelCheck = 0.15; declutter(cam) }
    const camH = cam.position.y - heightAt(cam.position.x, cam.position.z)
    // огни переставляем к ближайшим фонарям раз в полсекунды и только ночью
    lampCheck -= dt
    if (lampLights.length && nightNow > 0.2 && lampCheck <= 0 && glows.length) {
      lampCheck = 0.5
      // вокруг точки, куда смотрит камера (с прошлого кадра)
      const fx = tmpFocus.x || cam.position.x, fz = tmpFocus.z || cam.position.z
      const near: [number, number][] = []
      for (let i = 0; i < glows.length; i += 3) {
        const d = (glows[i] - fx) ** 2 + (glows[i + 2] - fz) ** 2
        if (near.length < lampLights.length) near.push([d, i])
        else {
          let w = 0
          for (let k = 1; k < near.length; k++) if (near[k][0] > near[w][0]) w = k
          if (d < near[w][0]) near[w] = [d, i]
        }
      }
      lampLights.forEach((l, k) => {
        const n = near[k]
        l.visible = !!n && camH < 260
        if (n) l.position.set(glows[n[1]], glows[n[1] + 1] + 0.2, glows[n[1] + 2])
      })
    }
    // с высоты людей видно плохо: чем выше камера, тем крупнее они нарисованы (как фишки на макете)
    const boost = Math.max(1, Math.min(6, camH / 22))
    tmpFocus.set(cam.position.x, 0, cam.position.z)
    if (camH > 12) { cam.getWorldDirection(tmpDir); if (tmpDir.y < -0.05) { const f = camH / -tmpDir.y; tmpFocus.set(cam.position.x + tmpDir.x * f, 0, cam.position.z + tmpDir.z * f) } }
    life.tick(dt, t, nightNow, tmpFocus, boost)
    // ворота: днём открыты, ночью закрыты, но открываются, когда к ним подходишь; тап — ручной выбор, пока не уйдёшь
    for (const g of gateList) {
      const dh = Math.hypot(cam.position.x - g.x, cam.position.z - g.z)
      if (g.manual !== null && dh > 60) g.manual = null
      const auto = nightNow < 0.5 || (dh < 20 && camH < 30)
      g.target = (g.manual ?? auto) ? 1 : 0
      if (g.open === g.target) continue
      g.open = g.target > g.open ? Math.min(g.target, g.open + dt / 1.5) : Math.max(g.target, g.open - dt / 1.5)
      const e = g.open * g.open * (3 - 2 * g.open)
      for (const lf of g.leaves) lf.mesh.rotation.y = lf.a0 + (lf.a1 - lf.a0) * e
    }
    upgradeNear(cam, dt)
    for (let i = 0; i < smokeSrc.length; i++) {
      const [sx, sy, sz] = smokeSrc[i]
      for (let p = 0; p < PUFFS; p++) {
        const f = (t * 0.16 + i * 0.37 + p / PUFFS) % 1
        const q = (i * PUFFS + p) * 3
        smokePos[q] = sx + f * f * 5 + Math.sin(t * 0.6 + i + f * 4) * 0.6 * f
        smokePos[q + 1] = sy + f * 8
        smokePos[q + 2] = sz + f * f * 2.4
      }
    }
    smokeGeo.attributes.position.needsUpdate = true
  }

  const pick = (o: THREE.Vector3, d: THREE.Vector3): number | null => {
    const step = cell * 0.7
    const maxD = radius * 8
    for (let s = 1; s < maxD; s += step) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s
      if (y < heightAt(x, z)) return null
      const v = gridAt(x, z)
      if (v > 0 && v <= N && y <= tops[v - 1]) return v - 1
    }
    return null
  }

  return {
    scene,
    sun,
    center,
    radius,
    size: [W, H],
    k,
    heightAt,
    // на вершине ходить можно только по платформе: ни на скалу в середине, ни за край стены
    walkable: (x, z) => {
      if (kranz) { const r = Math.hypot(x - center[0], z - center[1]); if (r < R0 * 1.08 || r > RP - 2) return false }
      const v = gridAt(x, z)
      return (v === 0 || v === -3) && !gateShut(x, z)
    },
    deckAt: (x, z) => bridgeAt(x, z) ?? (gridAt(x, z) === -3 ? DECK : null),
    // высота пола под ногами, стоящими на высоте y: лестницы, пандусы и верх стен (шаг вверх ≤ 0.8 м), иначе земля/настил; null — не пройти
    floorAt: (x, z, y) => {
      let best: number | null = null
      for (const s of climbs) {
        const h = surfH(s, x, z)
        if (h !== null && h <= y + 0.8 && (best === null || h > best)) best = h
      }
      if (best !== null) return best
      if (kranz) { const r = Math.hypot(x - center[0], z - center[1]); if (r < R0 * 1.08 || r > RP - 2) return null }
      const v = gridAt(x, z)
      if ((v !== 0 && v !== -3) || gateShut(x, z)) return null
      return Math.max(heightAt(x, z), v === -3 ? bridgeAt(x, z) ?? DECK : -99)
    },
    pick,
    buildingTop: (i) => { const m = monAt.get(i); if (m) return [m.x, tops[i], m.z]; const b = blds[i]; if (!b) return null; const c = centerOf(b.r); return [c[0], tops[i], c[1]] },
    spawn: () => {
      const s = kranz ? at0(R0 * 1.5, 0) : squares[0] ? centerOf(squares[0]) : roads[0]?.r.length ? roads[0].r[Math.floor(roads[0].r.length / 2)] : center
      // свободное место с запасом вокруг, чтобы не начать прогулку носом в колодец или прилавок
      const clear = (x: number, z: number): boolean => { for (let i = 0; i < 8; i++) if (gridAt(x + Math.cos(i * 0.785) * 3, z + Math.sin(i * 0.785) * 3) !== 0) return false; return gridAt(x, z) === 0 && heightAt(x, z) > 0.2 }
      // город на вершине: начинаем на платформе, на кольце вокруг скалы, а не на самой скале
      if (kranz) {
        for (let rad = R0 * 1.4; rad < RP - 8; rad += cell * 2) for (let i = 0; i < 24; i++) {
          const x = center[0] + Math.cos((i / 24) * 6.283) * rad, z = center[1] + Math.sin((i / 24) * 6.283) * rad
          if (clear(x, z)) return [x, z]
        }
      }
      for (let rad = 5; rad < radius * 2; rad += cell) for (let i = 0; i < 16; i++) {
        const x = s[0] + (Math.cos((i / 16) * 6.283) * rad), z = s[1] + (Math.sin((i / 16) * 6.283) * rad)
        if (clear(x, z)) return [x, z]
      }
      return s
    },
    setTime,
    exposure: () => exposure,
    tick,
    setLabels: (on) => { labels.visible = on },
    setPlaces,
    setMarks: (on) => { marksOn = on; life.setMarks(marksOn) },
    setHighlight: (hover, sel) => {
      if (hover !== lastHover) { lastHover = hover; shellFor(hoverShell, hover === sel ? null : hover) }
      if (sel !== lastSel) { lastSel = sel; shellFor(selShell, sel) }
    },
    pickPerson: (o, d) => {
      // люди за стеной не выбираются: сперва ищем, где луч упирается в здание или землю
      const step = cell * 0.7
      let tMax = radius * 8
      for (let q = 1; q < tMax; q += step) {
        const x = o.x + d.x * q, y = o.y + d.y * q, z = o.z + d.z * q
        const v = gridAt(x, z)
        if (y < heightAt(x, z) - 0.2 || (v > 0 && v <= N && y <= tops[v - 1])) { tMax = q + 3; break }
      }
      return life.pick(o, d, tMax)
    },
    toggleGate: (o, d) => {
      // луч до земли; попадание — в объём проезда ворот
      for (let q = 0.5; q < 400; q += 0.5) {
        const x = o.x + d.x * q, y = o.y + d.y * q, z = o.z + d.z * q
        if (y < heightAt(x, z) - 0.3) break
        for (const g of gateList) {
          const dx = x - g.x, dz = z - g.z
          if (Math.abs(dx * g.ux + dz * g.uz) < g.pw + 1 && Math.abs(dx * g.nx + dz * g.nz) < g.hv + 2 && y > g.y - 1 && y < g.y + g.h + 2) {
            g.manual = !(g.target > 0.5)
            return true
          }
        }
      }
      return false
    },
    speak: life.speak,
    census: life.census,
    takeDirty: () => { const d = dirty; dirty = false; return d },
    dispose: () => {
      instanced.forEach((m) => m.dispose())
      life.dispose()
      for (const h of cells.values()) for (const m of h.meshes) m.geometry.dispose()
      disposable.forEach((d) => d.dispose())
      gateGeos.forEach((g) => g.dispose())
    }
  }
}
