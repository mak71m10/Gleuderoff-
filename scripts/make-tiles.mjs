// Нарезает подложку карты мира на плитки 1024×1024 для плавного приближения.
// Уровень z: ширина картинки = логическая ширина карты (8192) × 2^z. Наибольший z — полное разрешение исходника
// (16384 → z=1, 32768 → z=2). MAX_Z=1 в окружении — обрезать сверху (лёгкая версия для телефона).
// Также делает лёгкое превью base.webp (4096), которое показывается, пока грузятся плитки.
// Использование: node scripts/make-tiles.mjs [вход.png | вход.rgb] [папка вывода]
import sharp from 'sharp'
import { mkdirSync, readFileSync, rmSync } from 'fs'

const INPUT = process.argv[2] ?? 'source-maps/base-render.rgb'
const OUT = process.argv[3] ?? 'resources/default-world/maps'
const LOGICAL_W = 8192
const LOGICAL_H = 4672
const TILE = 1024
const MIN_Z = -4

sharp.cache(false)
const full = INPUT.endsWith('.rgb')
  ? { data: readFileSync(INPUT), info: JSON.parse(readFileSync(INPUT.replace(/\.rgb$/, '.json'), 'utf8')) }
  : await sharp(INPUT, { limitInputPixels: false }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const MAX_Z = Math.min(Number(process.env.MAX_Z ?? 99), Math.round(Math.log2(full.info.width / LOGICAL_W)))
console.log(`Исходник: ${full.info.width}×${full.info.height}`)

rmSync(`${OUT}/tiles`, { recursive: true, force: true })
let total = 0
for (let z = MAX_Z; z >= MIN_Z; z--) {
  const w = Math.round(LOGICAL_W * 2 ** z)
  const h = Math.round(LOGICAL_H * 2 ** z)
  const level =
    w === full.info.width && h === full.info.height
      ? full.data
      : await sharp(full.data, { raw: { width: full.info.width, height: full.info.height, channels: 3 }, limitInputPixels: false }).resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer()
  const nx = Math.ceil(w / TILE)
  const ny = Math.ceil(h / TILE)
  mkdirSync(`${OUT}/tiles/${z}`, { recursive: true })
  for (let ty = 0; ty < ny; ty++)
    for (let tx = 0; tx < nx; tx++) {
      const left = tx * TILE
      const top = ty * TILE
      const tw = Math.min(TILE, w - left)
      const th = Math.min(TILE, h - top)
      await sharp(level, { raw: { width: w, height: h, channels: 3 }, limitInputPixels: false })
        .extract({ left, top, width: tw, height: th })
        .extend({ right: TILE - tw, bottom: TILE - th, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 84, effort: 4, alphaQuality: 60 })
        .toFile(`${OUT}/tiles/${z}/${tx}_${ty}.webp`)
      total++
    }
  console.log(`Уровень ${z}: ${w}×${h}, ${nx * ny} плиток`)
}

await sharp(full.data, { raw: { width: full.info.width, height: full.info.height, channels: 3 }, limitInputPixels: false }).resize(4096).webp({ quality: 82 }).toFile(`${OUT}/base.webp`)
console.log(`Готово: ${total} плиток (z ${MIN_Z}..${MAX_Z}) + превью base.webp`)

// размер плиток и уровни — в описание карты мира
if (OUT === 'resources/default-world/maps') {
  const { writeFileSync } = await import('fs')
  const WORLD = 'resources/default-world/world.json'
  const world = JSON.parse(readFileSync(WORLD, 'utf8'))
  const wm = world.maps.find((m) => m.id === 'world')
  wm.tiles = { path: 'maps/tiles', minZoom: MIN_Z, maxZoom: MAX_Z, size: TILE }
  writeFileSync(WORLD, JSON.stringify(world, null, 1))
}
