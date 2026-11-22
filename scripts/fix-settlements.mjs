// Поселения и места, стоящие в воде (море или озеро), переносит на ближайшую сушу той же провинции,
// не ближе 2 пикселей (4 ед.) к воде. Места на карте мира, стоявшие в той же точке (столица, ратуша), едут вместе.
//   node --max-old-space-size=6144 scripts/fix-settlements.mjs [--dry]
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const WF = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(WF, 'utf8'))
const { data: P, info } = await sharp('resources/default-world/maps/provinces.png').raw().toBuffer({ resolveWithObject: true })
const LK = (await (async () => { const src = await sharp('source-maps/lakes.png').greyscale().raw().toBuffer(), out = new Uint8Array(src.length), w = info.width, h = src.length / w; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && src[Y * w + X]) { v = 255; break } } out[y * w + x] = v } return out })()) // маска озёр рваная — расширена на пиксель
const SW = info.width, SH = info.height
const inb = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH
const wet = (x, y) => !inb(x, y) || !(P[(y * SW + x) * 4 + 3] && P[(y * SW + x) * 4 + 2]) || LK[y * SW + x] > 0
const pid = (x, y) => (inb(x, y) && P[(y * SW + x) * 4 + 3] ? (P[(y * SW + x) * 4] << 8) | P[(y * SW + x) * 4 + 1] : -1)
const dry = (x, y, m = 2) => { for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) if (wet(x + dx, y + dy)) return false; return true }

/** ближайшая сухая точка (по спирали до 120 пикс.); prov — только внутри этой провинции */
function nearestDry(x0, y0, prov) {
  for (let r = 1; r <= 120; r++)
    for (let a = 0; a < 360; a += Math.max(2, 90 / r)) {
      const x = Math.round(x0 + r * Math.cos((a * Math.PI) / 180)), y = Math.round(y0 + r * Math.sin((a * Math.PI) / 180))
      if ((prov == null || pid(x, y) === prov) && dry(x, y)) return [x, y]
    }
  return null
}

const moved = []
const placesAt = (x, y) => W.places.filter((pl) => pl.mapId === 'world' && Math.hypot(pl.x - x, pl.y - y) < 3)
for (const p of W.provinces) {
  const s = p.settlement
  if (!s) continue
  const x = Math.round(s.x / 2), y = Math.round(s.y / 2)
  if (!wet(x, y)) continue
  const to = nearestDry(x, y, p.id) ?? nearestDry(x, y, null)
  if (!to) { moved.push(`!! ${p.name}: суши рядом нет`); continue }
  const nx = to[0] * 2, ny = to[1] * 2
  for (const pl of placesAt(s.x, s.y)) { pl.x = nx; pl.y = ny }
  moved.push(`${p.name} (${s.type}): ${s.x},${s.y} → ${nx},${ny} (${Math.round(Math.hypot(nx - s.x, ny - s.y))} ед.)`)
  s.x = nx; s.y = ny
}
for (const pl of W.places) {
  if (pl.mapId !== 'world' || /морск|рейд|высадк|флот|ruins/i.test(`${pl.base?.name} ${pl.base?.type}`)) continue
  const x = Math.round(pl.x / 2), y = Math.round(pl.y / 2)
  if (!wet(x, y)) continue
  const to = nearestDry(x, y, pid(x, y) >= 0 ? pid(x, y) : null) ?? nearestDry(x, y, null)
  if (!to) continue
  moved.push(`место ${pl.base?.name} (${pl.base?.type}): → ${to[0] * 2},${to[1] * 2}`)
  pl.x = to[0] * 2; pl.y = to[1] * 2
}
console.log(moved.join('\n') + `\nсдвинуто: ${moved.length}`)
if (!process.argv.includes('--dry')) writeFileSync(WF, JSON.stringify(W, null, 1))
