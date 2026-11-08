// Родословные династий: добавляет родителей, жён и мужей, детей и внуков и связывает уже существующих людей в древо
// (ссылки «отец», «мать», «супруг», «супруг 2»). Данные — в scripts/lore/families/*.mjs; образ для портрета подбирается
// по полу, возрасту и роли (поле props.look читает scripts/portraits.mjs). Вызывается в конце scripts/seed-lore.mjs.
import * as TM from './families/tm.mjs'
import * as GF from './families/gf.mjs'
import * as CR from './families/cr.mjs'
import * as CH from './families/ch.mjs'
import * as MISC from './families/misc.mjs'

const HU = 'Человек (имперец)'
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const pickBy = (arr, key, salt) => arr[hash(key + salt) % arr.length]

const HAIR_Y = ['black', 'dark brown', 'chestnut', 'auburn', 'light brown', 'dark blonde', 'blond']
const HAIR_O = ['grey-streaked brown', 'silver-grey', 'white', 'grey']
const MOOD = ['calm eyes', 'stern eyes', 'a kind smile', 'sharp clever eyes', 'tired eyes', 'a proud look', 'a thoughtful look', 'a wry smile']
const CLOTH = {
  noble: 'rich velvet coat with a brooch',
  cleric: 'plain robe with a small symbol on the chest',
  soldier: 'mail shirt and a plain tabard',
  merchant: 'fine wool coat with a purse and a ledger',
  scholar: 'dark robe, ink-stained fingers, a book',
  folk: 'simple linen shirt and a leather vest',
  child: 'simple clothes'
}
function look(g, age, role, key) {
  const f = g === 'f'
  if (age < 14 || role === 'child') return `${f ? 'little girl' : 'little boy'}, ${pickBy(HAIR_Y, key, 'h')} hair, simple clothes, ${pickBy(MOOD, key, 'm')}`
  const hair = age >= 55 ? pickBy(HAIR_O, key, 'h') : age >= 42 && hash(key + 'g') % 3 === 0 ? pickBy(HAIR_O, key, 'h') : pickBy(HAIR_Y, key, 'h')
  const beard = !f && age > 22 ? pickBy(['clean shaven', 'short beard', 'full beard', 'moustache'], key, 'b') : ''
  const braid = f ? pickBy(['hair in a braid', 'hair pinned up', 'long loose hair', 'hair under a plain coif'], key, 'd') : ''
  return `${hair} hair, ${beard || braid}, ${CLOTH[role] ?? CLOTH.folk}, ${pickBy(MOOD, key, 'm')}`
}

export default function families({ E, Y, entries }) {
  const idOf = (ref) => (ref == null ? null : ref.startsWith('@') ? ref.slice(1) : `fm-${ref}`)
  const pass = []
  for (const m of [TM, GF, CR, CH]) pass.push({ tag: m.TAG, race: m.RACE ?? HU, specs: m.SPECS })
  for (const m of MISC.MODULES) pass.push({ tag: m.tag, race: m.race ?? HU, specs: m.specs })

  let created = 0, patched = 0
  for (const mod of pass) {
    for (const spec of mod.specs) {
      for (const p of spec.people) {
        const [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret] = p
        const age = (died ?? 1010) - born
        const links = { dynasty: house ?? spec.dyn }
        for (const [k, ref] of [['father', father], ['mother', mother], ['spouse', spouse]]) if (ref) links[k] = idOf(ref)
        E(`fm-${key}`, 'character', name, {
          title, summary: text.split('. ')[0].replace(/\.$/, '') + '.', from: Y(born), ...(died ? { to: Y(died) } : {}),
          props: { race: mod.race, gender: g === 'f' ? 'Женский' : 'Мужской', occupation: title.split(',')[0].replace(/ \(.*\)/, ''), look: look(g, age, role ?? 'folk', key) },
          links, body: text, ...(secret ? { secret } : {}), tags: [mod.tag, 'родословная']
        })
        created++
      }
    }
  }
  // связи уже существующих людей
  for (const mod of pass) {
    for (const spec of mod.specs) {
      for (const [ref, ch] of spec.patch ?? []) {
        const t = entries.find((e) => e.id === `lore-${idOf(ref)}`)
        if (!t) { console.warn(`families: нет записи ${ref}`); continue }
        for (const [k, v] of Object.entries(ch)) {
          if (k === 'text') { t.base.body = v; t.base.summary = v.split('. ')[0].replace(/\.$/, '') + '.' }
          else t.base.links[k] = `lore-${idOf(v)}`
        }
        patched++
      }
    }
  }
  console.log(`Родословные: новых людей ${created}, связей существующим ${patched}`)
}
