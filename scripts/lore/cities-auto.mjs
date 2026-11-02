// Планы городов «по умолчанию»: для каждого города, городка, порта и кастры легиона, которых нет в cities.mjs,
// параметры генератора Watabou и примечательные места выводятся из самого мира — типа поселения, местности,
// реки и моря рядом (карта рельефа) и описания провинции (губернатор, родовое гнездо, кастра, почтовая станция…).
// Придумано по поручению автора (02.11.2026), тег «черновик». Особые города — вручную в cities.mjs, они главнее.
import sharp from 'sharp'

const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
export const slugOf = (name) => [...name.toLowerCase()].map((c) => TR[c] ?? (/[a-z0-9]/.test(c) ? c : '')).join('')
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const pickN = (list, n, seed) => {
  const a = [...list]
  let h = seed
  for (let i = a.length - 1; i > 0; i--) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, n)
}

const DRY = ['Старый город', 'Рыночный конец', 'Кожевенная слобода', 'Ремесленный конец', 'Соборная сторона', 'Верхний город', 'Гончарная слобода', 'Кузнечный конец', 'Ткацкий двор', 'Новый город', 'Пивоварный конец', 'Солдатская слобода', 'Монетный двор', 'Конная слобода', 'Свечной конец', 'Бочарный двор']
const WET = ['Рыбный конец', 'Причалы', 'Набережная', 'Мельничный берег', 'Лодочная слобода', 'Портовый двор', 'Канатный берег']
const MINE = ['Рудничная слобода', 'Литейный двор', 'Плавильни']
const SLAVE = ['Невольничий двор', 'Цепная слобода']

/** Факты из описания провинции → примечательные места [название, тип метки, правило, текст] */
function landmarksFrom(name, type, text, state) {
  const L = []
  const sentence = (re) => (text.match(new RegExp(`[^.]*${re}[^.]*\\.`)) ?? [''])[0].trim()
  const house = text.match(/родовое гнездо Дома ([А-ЯЁ][а-яё]+)/)
  const castra = text.match(/кастра ([IVX]+ [^,]+?), военный город/)
  const nest = !house && text.match(/гнездо ((?:баронов|рода|Дома) [А-ЯЁ][а-яё]+|[А-ЯЁ][а-яё]+ Аргусов)/)
  if (house) L.push([`Замок Дома ${house[1]}`, 'castle', 'citadel', sentence('родовое гнездо')])
  if (nest) L.push([`Гнездо ${nest[1]}`, 'castle', 'citadel', sentence('гнездо')])
  if (castra) L.push([`Кастра ${castra[1]}`, 'castle', 'citadel', sentence('кастра')])
  const gov = text.match(/[Гг]убернатор(?: —)? ([А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+)/)
  if (gov) L.push(['Дом губернатора', 'landmark', 'center', sentence('[Гг]убернатор')])
  if (/ратуш|магистрат/.test(text) || type === 'city') L.push([`Ратуша ${name}`, 'assembly', 'plaza', sentence('ратуш|магистрат')])
  L.push([`Храм ${name}`, 'temple', 'temple', ''])
  if (type === 'port') L.push([/портовый мастер/.test(text) ? 'Контора портового мастера' : 'Гавань', 'landmark', 'water', sentence('[Гг]аван|порт')])
  if (/склады Зальтмаров/.test(text)) L.push(['Склады Зальтмаров', 'landmark', type === 'port' ? 'water' : 'gate', sentence('Зальтмаров')])
  if (/почтовая станция/.test(text)) L.push(['Почтовая станция', 'landmark', 'gate', 'Почтовая станция на имперском тракте.'])
  if (/мельница/.test(text)) L.push(['Мельница', 'landmark', 'river', sentence('мельниц')])
  if (/пивоварн/.test(text)) L.push(['Пивоварня', 'landmark', 'big', sentence('пивоварн')])
  if (/сторожевая вышка/.test(text)) L.push(['Старая сторожевая вышка', 'tower', 'edge', sentence('вышка')])
  if (/торг|рынок|ярмар/.test(text) && !L.some((l) => l[2] === 'plaza')) L.push(['Рыночная площадь', 'landmark', 'plaza', sentence('торг|рынок|ярмар')])
  if (/верфи|верфь/.test(text)) L.push(['Верфи', 'landmark', 'water', sentence('верф')])
  return L.slice(0, 7)
}

export async function autoCities(world, handmade) {
  const wm = world.maps.find((m) => m.kind === 'world')
  const { data, info } = await sharp('resources/default-world/maps/terrain.png').raw().toBuffer({ resolveWithObject: true })
  const k = info.width / wm.width
  const px = (x, y) => (Math.round(y * k) * info.width + Math.round(x * k)) * info.channels
  const nearRiver = (x, y) => {
    for (let r = 0; r <= 8; r += 2) for (let a = 0; a < 360; a += 30) { const i = px(x + r * Math.cos((a * Math.PI) / 180), y + r * Math.sin((a * Math.PI) / 180)); if (data[i + 2] > 128 && data[i + 3] >= 128) return true }
    return false
  }
  const nearSea = (x, y) => {
    for (let r = 4; r <= 40; r += 4) for (let a = 0; a < 360; a += 15) if (data[px(x + r * Math.cos((a * Math.PI) / 180), y + r * Math.sin((a * Math.PI) / 180)) + 3] < 128) return true
    return false
  }
  const taken = new Set(handmade.map((c) => c.province).filter(Boolean))
  const takenSlugs = new Set(handmade.map((c) => c.slug))
  const out = []
  for (const sn of ['Империя', 'Корона Аргус', 'Республика']) {
    const st = world.states.find((s) => s.base.name === sn)
    for (const p of world.provinces) {
      const s = p.settlement
      if (!s || p.owners?.at(-1)?.[1] !== st.id || taken.has(p.name)) continue
      const text = p.description ?? ''
      const castra = /кастра [IVX]+/.test(text)
      if (!['city', 'town', 'port'].includes(s.type) && !castra) continue
      const slug = slugOf(p.name)
      if (takenSlugs.has(slug)) continue
      const seed = hash(slug)
      const type = castra ? 'castra' : s.type
      const coast = (type === 'port' || p.coastal) && nearSea(s.x, s.y)
      const river = nearRiver(s.x, s.y)
      const nest = /гнездо/.test(text)
      const size = { city: 30 + (seed % 7), town: 10 + (seed % 9), port: 14 + (seed % 8), castra: 8 + (seed % 3) }[type]
      const gen = {
        size, walls: type === 'town' ? (/стен/.test(text) || nest || seed % 3 === 0 ? 1 : 0) : 1,
        citadel: castra || nest || type === 'city' ? 1 : 0, plaza: 1, temple: type === 'castra' ? 0 : 1, river: river ? 1 : 0,
        coast: coast ? 1 : 0, shantytown: type === 'city' ? 1 : 0, greens: seed % 4 === 0 ? 1 : 0
      }
      const extra = [...(/рудник|копи/.test(text) ? MINE : []), ...(sn === 'Корона Аргус' && /раб|невольн/.test(text) ? SLAVE : [])]
      const dry = [...extra.slice(0, 1), ...pickN(DRY, 12, seed)]
      const wet = coast || river ? pickN(WET, coast ? 3 : 2, seed + 1).map((n) => `~${n}`) : []
      out.push({
        slug, name: p.name, province: p.name, state: sn, auto: true,
        forest: p.terrain === 2 ? 0.25 : 0.1, hills: p.terrain === 3 || undefined, rocky: p.terrain >= 4 || undefined,
        citadelName: castra ? 'Кастра' : nest ? 'Замковая гора' : 'Замок',
        gen, districts: [...wet.slice(0, 1), ...dry.slice(0, 2), ...wet.slice(1), ...dry.slice(2)],
        landmarks: landmarksFrom(p.name, type, text, sn)
      })
    }
  }
  return out
}
