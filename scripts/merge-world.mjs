// Трёхстороннее слияние world.json по id записей (для слияния веток стран).
// node scripts/merge-world.mjs <base.json> <ours.json> <theirs.json> <out.json>
// Массивы с id (entries, provinces, maps…) сливаются по id: новое из обеих веток, изменённое — пофайлово по полям
// (рекурсивно по объектам). Если одно поле обе ветки поменяли по-разному — берём «их» и печатаем конфликт.
import { readFileSync, writeFileSync } from 'fs'

const [bp, op, tp, out] = process.argv.slice(2)
const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
const base = read(bp), ours = read(op), theirs = read(tp)
const conflicts = []
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x)
const hasIds = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => isObj(x) && x.id != null)

// ключ с номером повтора — в мире бывают дубли id
const keyed = (arr) => {
  const seen = new Map()
  return (arr ?? []).map((x) => { const n = seen.get(x.id) ?? 0; seen.set(x.id, n + 1); return [`${x.id}#${n}`, x] })
}

function merge(b, o, t, path) {
  if (same(o, t)) return o
  if (same(b, o)) return t
  if (same(b, t)) return o
  if (isObj(o) && isObj(t)) {
    const r = {}
    for (const k of new Set([...Object.keys(o), ...Object.keys(t)])) {
      const v = merge(isObj(b) ? b[k] : undefined, o[k], t[k], `${path}.${k}`)
      if (v !== undefined) r[k] = v
    }
    return r
  }
  if ((hasIds(o) || hasIds(t)) && (Array.isArray(o) && Array.isArray(t))) return mergeArr(Array.isArray(b) ? b : [], o, t, path)
  conflicts.push(path)
  return t
}

function mergeArr(b, o, t, path) {
  const B = new Map(keyed(b)), O = new Map(keyed(o)), T = new Map(keyed(t))
  const res = []
  const done = new Set()
  const pick = (k) => {
    if (done.has(k)) return
    done.add(k)
    const inB = B.has(k), inO = O.has(k), inT = T.has(k)
    if (inO && inT) res.push(merge(B.get(k), O.get(k), T.get(k), `${path}[${k}]`))
    else if (inO && !inT) { if (!inB) res.push(O.get(k)); else if (!same(B.get(k), O.get(k))) { conflicts.push(`${path}[${k}] удалён у них, изменён у нас`); res.push(O.get(k)) } }
    else if (!inO && inT) { if (!inB) res.push(T.get(k)); else if (!same(B.get(k), T.get(k))) { conflicts.push(`${path}[${k}] удалён у нас, изменён у них`); res.push(T.get(k)) } }
  }
  for (const [k] of O) pick(k)
  for (const [k] of T) pick(k)
  return res
}

const r = merge(base, ours, theirs, 'world')
r.version = Math.max(ours.version ?? 0, theirs.version ?? 0)
writeFileSync(out, JSON.stringify(r, null, 1))
for (const k of Object.keys(r)) if (Array.isArray(r[k])) console.log(`${k}: ${r[k].length}`)
console.log(`version ${r.version}; конфликтов: ${conflicts.length}`)
for (const c of conflicts.slice(0, 40)) console.log('  ' + c)
