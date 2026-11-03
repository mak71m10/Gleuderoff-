// Планы городов «по умолчанию»: для каждого города, городка, порта и кастры легиона, которых нет в cities.mjs,
// параметры генератора Watabou и примечательные места выводятся из самого мира — типа поселения, местности,
// реки и моря рядом (карта рельефа) и описания провинции (губернатор, родовое гнездо, кастра, почтовая станция…).
// Придумано по поручению автора (02.11.2026), тег «черновик». Особые города — вручную в cities.mjs, они главнее.
import sharp from 'sharp'
import { SOUTH } from './south.mjs'

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
// юг: испано-итальянский колорит и кальтранцы
const SOUTH_DRY = ['Пьяцца', 'Борго', 'Контрада Оливы', 'Санта-Лучия', 'Борго-Нуово', 'Аркады', 'Сан-Микеле', 'Ла-Лонха', 'Контрада дель Пьяно', 'Виноградная сторона', 'Кожевенная контрада', 'Сан-Бартоло', 'Монастырская сторона', 'Верхний Борго']
const SOUTH_WET = ['Марина', 'Порто-Веккьо', 'Рыбачья контрада', 'Ривьера']
const KALT_DRY = ['Дом рот', 'Школьный конец', 'Кузни', 'Конные дворы', 'Клановая слобода', 'Старый очаг', 'Оружейный ряд', 'Верхнее селение']
const KALT_WET = ['Рыбачий берег', 'Причалы клана']
// Святая церковь и архиепархии: латинский колорит
const CHURCH_DRY = ['Соборная гора', 'Виа Сакра', 'Квартал паломников', 'Двор ордена', 'Монастырская сторона', 'Ступени', 'Сад Аматерасу', 'Госпитальный двор', 'Квартал писцов', 'Колокольная сторона', 'Старые кельи']
const CHURCH_WET = ['Пристань паломников', 'Молы Звёздной стражи', 'Рыбачий берег']
// белый мрамор и светлый камень Святого архипелага
export const MARBLE = ['#d9d3c5', '#cfc7b6', '#e3ddd0', '#c6bda8', '#d4cdbd']
const CHURCH_STATES = ['Святая церковь', 'Архиепархия Луправена', 'Архиепархия Ошоморида', 'Архиепископия Окрупия', 'Архиепархия Бувезеона']
const SOUTH_STATES = { 'Тоскана': 'tos', 'Вуфинская Республика': 'vuf', 'Республика Шеша': 'she', 'Кальтранская Республика': 'kal' }
// Штирия: нищие сланцевые городки и Ночной рынок
const STYRIA_DRY = ['Немой конец', 'Долговой ряд', 'Свечной ряд', 'Кожевенная яма', 'Висельный спуск', 'Нищая слобода', 'Рудничная яма', 'Воровской двор', 'Верхняя слобода', 'Сажевый конец', 'Угольный двор', 'Вексельный ряд']
const STYRIA_WET = ['Мутный берег', 'Мельничная яма']
export const SLATE = ['#3f3d44', '#4a4650', '#38363e', '#524d55', '#45424a']
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
  if (state !== 'Графство Штирия' || /[Чч]асовн|[Хх]рам|собор/.test(text)) L.push([/заколочен/.test(text) ? 'Заколоченная часовня' : `Храм ${name}`, 'temple', 'temple', state === 'Графство Штирия' ? sentence('[Чч]асовн|[Хх]рам|собор') : ''])
  if (type === 'port') L.push([/портовый мастер/.test(text) ? 'Контора портового мастера' : 'Гавань', 'landmark', 'water', sentence('[Гг]аван|порт')])
  if (/склады Зальтмаров/.test(text)) L.push(['Склады Зальтмаров', 'landmark', type === 'port' ? 'water' : 'gate', sentence('Зальтмаров')])
  if (/почтовая станция/.test(text)) L.push(['Почтовая станция', 'landmark', 'gate', 'Почтовая станция на имперском тракте.'])
  if (/мельница/.test(text)) L.push(['Мельница', 'landmark', 'river', sentence('мельниц')])
  if (/пивоварн/.test(text)) L.push(['Пивоварня', 'landmark', 'big', sentence('пивоварн')])
  if (/сторожевая вышка/.test(text)) L.push(['Старая сторожевая вышка', 'tower', 'edge', sentence('вышка')])
  if (/торг|рынок|ярмар/.test(text) && !L.some((l) => l[2] === 'plaza')) L.push(['Рыночная площадь', 'landmark', 'plaza', sentence('торг|рынок|ярмар')])
  if (/верфи|верфь/.test(text)) L.push(['Верфи', 'landmark', 'water', sentence('верф')])
  if (/Подеста/.test(text)) L.push(['Дом подесты', 'landmark', 'center', sentence('Подеста')])
  if (/Комендант/.test(text)) L.push(['Комендатура полка', 'castle', 'center', sentence('Комендант')])
  if (/Старейшина клана/.test(text)) L.push(['Дом старейшины', 'landmark', 'center', sentence('Старейшина')])
  if (/школа|школу|Школьный/.test(text)) L.push(['Школа', 'landmark', 'big', sentence('школ')])
  if (/фонтан/.test(text)) L.push(['Фонтан с дельфинами', 'landmark', 'plaza2', sentence('фонтан')])
  if (/Колокольня/.test(text)) L.push(['Колокольня', 'tower', 'center', sentence('Колокольня')])
  if (/трюмах/.test(text)) L.push(['Склады у пристани', 'landmark', 'water', sentence('трюм')])
  // Штирия
  if (/Кастелян/.test(text)) L.push(['Дом кастеляна', 'castle', 'citadel', sentence('Кастелян')])
  if (/мытарь/.test(text)) L.push(['Дом мытаря', 'landmark', 'center', sentence('мытарь')])
  if (/контора Вексельного дома/.test(text)) L.push(['Контора Вексельного дома', 'landmark', 'big', sentence('Вексельного дома')])
  if (/виселица/.test(text)) L.push(['Виселица', 'landmark', 'gate', sentence('виселица')])
  if (/синюю свечу/.test(text)) L.push(['Дом с синей свечой', 'landmark', 'edge', sentence('синюю свечу')])
  if (/ночью — всем/.test(text)) L.push(['Ночные ряды', 'landmark', 'plaza', sentence('ночью — всем')])
  // Святая церковь
  if (/епископ-пастырь/.test(text)) L.push(['Палата епископа-пастыря', 'assembly', 'plaza', sentence('епископ-пастырь')])
  if (/Командор Святого ордена/.test(text)) L.push(['Дом Святого ордена', 'castle', 'citadel', sentence('Командор')])
  if (/кюре/.test(text)) L.push(['Дом кюре', 'landmark', 'center', sentence('кюре')])
  if (/госпиталь Ордена Чаши/.test(text)) L.push(['Госпиталь Ордена Чаши', 'landmark', 'big', sentence('госпиталь')])
  if (/мощи святого/.test(text)) L.push(['Часовня с мощами', 'temple', 'temple', sentence('мощи')])
  if (/статуя Орамея/.test(text)) L.push(['Статуя Орамея', 'landmark', 'plaza2', sentence('статуя')])
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
  for (const sn of ['Империя', 'Корона Аргус', 'Республика', ...Object.keys(SOUTH_STATES), ...CHURCH_STATES, 'Графство Штирия']) {
    const st = world.states.find((s) => s.base.name === sn)
    for (const p of world.provinces) {
      const s = p.settlement
      if (!s || p.owners?.at(-1)?.[1] !== st.id || taken.has(p.name)) continue
      const text = p.description ?? ''
      const castra = /кастра [IVX]+/.test(text)
      const south = SOUTH_STATES[sn]
      // на юге — все поселения, включая деревни и рыбачьи посёлки (кроме развалин)
      // всё, кроме развалин: города, городки, порты, кастры, замки, храмы, деревни и рыбачьи посёлки
      if (s.type === 'ruins') continue
      const slug = slugOf(p.name)
      if (takenSlugs.has(slug)) continue
      const seed = hash(slug)
      const type = castra ? 'castra' : s.type
      const sty = sn === 'Графство Штирия'
      const capital = (south && world.places.find((x) => x.id === `lore-${south}-capital` && x.base.name === p.name)) || (sty && world.places.find((x) => x.id === 'lore-sty-capital' && x.base.name === p.name))
      const coast = (type === 'port' || p.coastal) && nearSea(s.x, s.y)
      const river = nearRiver(s.x, s.y)
      const nest = /гнездо/.test(text)
      const size = capital ? 22 + (seed % 8) : { city: 30 + (seed % 7), town: 10 + (seed % 9), port: 14 + (seed % 8), castra: 8 + (seed % 3), village: 7 + (seed % 3), fishing: 6 + (seed % 2), temple: 10, castle: 7 }[type]
      const gen = {
        size, walls: capital ? 1 : ['village', 'fishing'].includes(type) ? 0 : type === 'town' ? (/стен/.test(text) || nest || seed % 3 === 0 ? 1 : 0) : 1,
        citadel: capital || castra || nest || type === 'city' || type === 'castle' ? 1 : 0, plaza: ['village', 'fishing'].includes(type) ? 0 : 1, temple: type === 'castra' ? 0 : 1, river: river ? 1 : 0,
        coast: coast ? 1 : 0, shantytown: type === 'city' || capital ? 1 : 0, greens: south ? (seed % 2) : seed % 4 === 0 ? 1 : 0
      }
      const extra = [...(/рудник|копи/.test(text) ? MINE : []), ...(sn === 'Корона Аргус' && /раб|невольн/.test(text) ? SLAVE : [])]
      const kalt = south === 'kal'
      const holy = CHURCH_STATES.includes(sn)
      const dry = sty ? pickN(STYRIA_DRY, 11, seed) : holy ? pickN(CHURCH_DRY, 11, seed) : south ? pickN(kalt ? KALT_DRY : SOUTH_DRY, 12, seed) : [...extra.slice(0, 1), ...pickN(DRY, 12, seed)]
      const wet = coast || river ? pickN(sty ? STYRIA_WET : holy ? CHURCH_WET : south ? (kalt ? KALT_WET : SOUTH_WET) : WET, coast ? (south ? 2 : 3) : 2, seed + 1).map((n) => `~${n}`) : []
      out.push({
        slug, name: p.name, province: p.name, state: sn, auto: true, ...(holy ? { roof: MARBLE } : {}), ...(sty ? { roof: SLATE } : {}), ...(['village', 'fishing', 'castle', 'temple'].includes(type) ? { px: 1 } : {}), ...(capital ? { place: capital.id } : {}),
        forest: p.terrain === 2 ? 0.25 : 0.1, hills: p.terrain === 3 || undefined, rocky: p.terrain >= 4 || undefined,
        citadelName: sty ? (capital ? 'Чёрный замок' : 'Замок кастеляна') : holy ? 'Соборный двор' : castra ? 'Кастра' : nest ? 'Замковая гора' : south ? (kalt ? 'Дом капитанов' : capital ? 'Палаццо' : 'Кастелло') : 'Замок',
        gen, districts: [...wet.slice(0, 1), ...dry.slice(0, 2), ...wet.slice(1), ...dry.slice(2)],
        landmarks: [
          ...(capital && sty ? [['Чёрный замок', 'castle', 'citadel', 'Здесь живёт граф Конрад и заседает Ночной совет.'], ['Немая палата', 'assembly', 'center', 'Канцелярия его сиятельства: сюда не заходят по своей воле.'], ['Вексельный дом', 'landmark', 'big', 'Банк Штирии — прикрытие Ночного рынка.'], ['Ночной рынок', 'landmark', 'plaza', 'Ночной ряд: при свечах и в масках.']] : []),
          ...(capital && !sty ? (() => { const r = SOUTH.find((x) => x.key === south); return [[r.hall.split(',')[0], 'assembly', 'citadel', `Здесь заседает ${r.chamber} и живёт ${r.rulerTitle.toLowerCase()}.`]] })() : []),
          ...landmarksFrom(p.name, type, text, sn).map((l) => (south && l[2] === 'temple' ? [kalt ? 'Храм клана' : `Церковь ${pickN(['Сан-Микеле', 'Санта-Лучия', 'Сан-Бартоло', 'Санта-Агна', 'Сан-Доменико', 'Санта-Клара'], 1, seed)[0]}`, l[1], l[2], l[3]] : l))
        ].slice(0, 7)
      })
    }
  }
  return out
}
