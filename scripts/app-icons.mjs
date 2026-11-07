// Иконки программы и приложения из логотипа build/logo.jpg (дракон в золотом круге):
//   build/icon.png                         — программа для Windows (electron-builder), круг без фона
//   src/renderer/src/assets/logo.webp      — знак в боковом меню интерфейса
//   android/app/src/main/res/mipmap-*      — значок приложения Android (обычный, круглый и адаптивный)
//   android/app/src/main/res/drawable*/splash.png — заставка при запуске
// Запуск: node scripts/app-icons.mjs
import sharp from 'sharp'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

const SRC = 'build/logo.jpg'
const BG = '#0d0f13'
const meta = await sharp(SRC).metadata()
const S = Math.min(meta.width, meta.height)
// круглая маска чуть больше внешнего золотого кольца логотипа (кольцо — ~47% от края до края)
const circle = (size, r = 0.485) =>
  Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size * r}" fill="#fff"/></svg>`)
const round = async (size) =>
  sharp(SRC).resize(size, size).composite([{ input: circle(size), blend: 'dest-in' }]).png().toBuffer()

await sharp(await round(512)).toFile('build/icon.png')
await sharp(await round(128)).webp({ quality: 92 }).toFile('src/renderer/src/assets/logo.webp')

const RES = 'android/app/src/main/res'
if (existsSync(RES)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  for (const [d, k] of Object.entries(dens)) {
    const dir = join(RES, `mipmap-${d}`)
    const n = Math.round(48 * k)
    const icon = await round(n)
    await sharp(icon).toFile(join(dir, 'ic_launcher.png'))
    await sharp(icon).toFile(join(dir, 'ic_launcher_round.png'))
    // адаптивный значок: холст 108dp, видимая часть — круг 72dp; логотип занимает её целиком
    const f = Math.round(108 * k)
    const inner = Math.round(74 * k)
    await sharp({ create: { width: f, height: f, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await round(inner), gravity: 'center' }])
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'))
  }
  // заставка: логотип по центру на тёмном фоне, во всех готовых размерах шаблона
  for (const dir of readdirSync(RES).filter((x) => x.startsWith('drawable'))) {
    const file = join(RES, dir, 'splash.png')
    if (!existsSync(file)) continue
    const { width, height } = await sharp(file).metadata()
    const logo = Math.round(Math.min(width, height) * 0.42)
    await sharp({ create: { width, height, channels: 4, background: BG } })
      .composite([{ input: await round(logo), gravity: 'center' }])
      .png()
      .toFile(file + '.tmp')
    const { renameSync } = await import('fs')
    renameSync(file + '.tmp', file)
  }
}
console.log('Иконки готовы', S)
