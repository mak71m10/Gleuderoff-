// Увеличивает исходную карту в 4 раза и подчищает детализацию.
// Использование: node scripts/upscale-map.mjs <вход> <выход> [масштаб]
import sharp from 'sharp'

const [input = 'source-maps/physical.webp', output = 'resources/default-world/maps/base.webp', scaleArg = '4'] =
  process.argv.slice(2)
const scale = Number(scaleArg)

const meta = await sharp(input).metadata()
const width = meta.width * scale
const height = meta.height * scale

// Шаг 1: увеличение в 2 прохода (Lanczos), так меньше «ступенек», чем за один проход.
const half = await sharp(input)
  .resize(Math.round(meta.width * Math.sqrt(scale)), Math.round(meta.height * Math.sqrt(scale)), { kernel: 'lanczos3' })
  .sharpen({ sigma: 0.8, m1: 0.6, m2: 1.5 })
  .toBuffer()

// Шаг 2: финальный размер + повышение локального контраста и резкости.
const upscaled = await sharp(half)
  .resize(width, height, { kernel: 'lanczos3' })
  .sharpen({ sigma: 1.4, m1: 0.8, m2: 2.2, x1: 2 })
  .clahe({ width: 256, height: 256, maxSlope: 2 })
  .toBuffer()

// Шаг 3: лёгкое пергаментное зерно, чтобы при сильном приближении не было «мыла».
const grainRaw = Buffer.alloc(width * height)
for (let i = 0; i < grainRaw.length; i++) grainRaw[i] = 128 + Math.round((Math.random() - 0.5) * 34)
const grain = await sharp(grainRaw, { raw: { width, height, channels: 1 } })
  .blur(0.6)
  .toColourspace('srgb')
  .png()
  .toBuffer()

await sharp(upscaled)
  .composite([{ input: grain, blend: 'soft-light' }])
  .webp({ quality: 90, effort: 5 })
  .toFile(output)

console.log(`Готово: ${output} (${width}×${height})`)
