// Иллюстрации книг в духе средневековых рукописей — по подсказкам из src/renderer/src/books.ts.
// Рисует та же локальная нейросеть, что и портреты (scripts/portraits.mjs). Готовые не перерисовываются.
// Запуск: node scripts/book-art.mjs [файл …]  → resources/default-world/books/<файл>.webp
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import sharp from 'sharp'
import { BOOK_ART_STYLE, BOOK_THEMES } from '../src/renderer/src/books.ts'

const OUT = 'resources/default-world/books'
const SD = 'tools/sd/bin/sd-cli.exe'
const MODEL = 'tools/sd/models/dreamshaper8.safetensors'
const BACKEND = ['--backend', process.env.SD_BACKEND ?? 'diffusion=vulkan0,te=cpu,vae=vulkan1']
const NEG = 'photo, photorealistic, 3d render, modern, text, letters, watermark, signature, blurry, lowres, deformed, extra limbs, cartoon, anime, nsfw, nude, gore'
mkdirSync(OUT, { recursive: true })

const only = new Set(process.argv.slice(2))
const jobs = Object.values(BOOK_THEMES).flatMap((t) => t.illustrations).filter((il) => !only.size || only.has(il.file))
let n = 0
for (const il of jobs) {
  const file = `${OUT}/${il.file}`
  if (existsSync(file) && !only.size) continue
  const seed = [...il.file].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 11) % 1000000
  const tmp = `tools/sd/book-${il.file}.png`
  const t0 = Date.now()
  execFileSync(SD, ['-m', MODEL, ...BACKEND, '-p', `${BOOK_ART_STYLE}, ${il.prompt}`, '-n', NEG, '-W', '640', '-H', '384', '--steps', '22', '--cfg-scale', '6.5', '--sampling-method', 'dpm++2m', '--scheduler', 'karras', '-s', String(seed), '-o', tmp], { stdio: 'ignore' })
  await sharp(tmp).webp({ quality: 86 }).toFile(file)
  rmSync(tmp, { force: true })
  console.log(`[${++n}/${jobs.length}] ${il.file} — ${((Date.now() - t0) / 1000).toFixed(0)} с`)
}
console.log(`Готово: иллюстраций ${jobs.filter((il) => existsSync(`${OUT}/${il.file}`)).length} из ${jobs.length}`)
