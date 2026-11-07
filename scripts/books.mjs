// Книги из лора (scripts/lore/books.mjs) — последним шагом сборки мира, когда в нём уже есть битвы, описания
// поселений и государств от всех *-detail.mjs. Запуск: node scripts/books.mjs
import { readFileSync, writeFileSync } from 'fs'
import books from './lore/books.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const made = []
const E = (id, kind, name, f = {}) => {
  const entry = { id: `lore-${id}`, kind, base: { name, title: f.title ?? '', image: '', summary: f.summary ?? '', body: f.body ?? '', tags: f.tags ?? [], props: f.props ?? {}, links: {} }, history: [], from: null, to: null }
  world.entries = world.entries.filter((e) => e.id !== entry.id)
  world.entries.push(entry)
  made.push(name)
}
books({ E, entries: world.entries.filter((e) => e.id.startsWith('lore-')), world })
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Книги из лора: ${made.join(', ')}`)
