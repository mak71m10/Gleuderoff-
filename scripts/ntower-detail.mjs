// Северная Башня на карте: Тореос (город под Башней, порт) и Хальвахейм (военный городок ордена); места: сама Башня, Нижняя
// библиотека, Северный Пост и Шлем (городки), Пустой экзамен, сдвиг стрелки.
// Запуск после greninsword-detail.mjs: node scripts/ntower-detail.mjs
import { readFileSync, writeFileSync } from 'fs'
import { STATE } from './lore/ntower.mjs'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const D = (y) => Math.round((y - 1) * YEAR)
const st = world.states.find((s) => s.base.name === STATE)
const provs = world.provinces.filter((p) => p.owners?.at(-1)?.[1] === st.id)
const byName = (nm) => provs.find((p) => p.name === nm)
const sx = (p) => p.settlement ?? p
const tor = byName('Тореос'), hal = byName('Хальвахейм')
if (tor) { tor.settlement.type = 'city'; tor.description = 'Тореос — город и порт у подножия Северной Башни: серый камень, узкие улицы-ступени и маяк, который зажигают без огнива. Над крышами — двенадцать ярусов Башни, верхние уходят в облака. Порт кормит Башню хлебом и железом; старшина — Рольф Нор. Здесь же площадь Испытаний, где вывешивают баллы. Скала над городом — Магистр Сигни Верн; в 1010 г. город ждёт Великого испытания. Снаская земля, Херад Тореос; норды.' }
if (hal) { hal.settlement.type = 'village'; hal.description = 'Хальвахейм — военный городок ордена серых плащей: казармы в тёсаных камнях, стрельбище и плац. Командует Орм Хальвахейм, три сотни воинов-магов с мечами с рунами. По ночам на нижних ярусах Башни видны огни, и Орм предпочитает не смотреть. Снаская земля, Херад Тореос; норды.' }
const place = (id, name, type, at, from, description, stateId = '', off = [14, 10], ruler = '') => {
  const old = world.places.find((p) => p.id === id)
  world.places = world.places.filter((p) => p.id !== id)
  world.places.push({ id, mapId: 'world', x: Math.round(at.x) + off[0], y: Math.round(at.y) + off[1], ...(old?.innerMapId ? { innerMapId: old.innerMapId } : {}), base: { name, type, stateId, population: '', ruler, image: '', description }, history: [], from: from == null ? null : D(from), to: null })
}
world.places = world.places.filter((p) => !p.id.startsWith('lore-nt-'))
if (tor) {
  place('lore-nt-capital', 'Северная Башня', 'capital', sx(tor), 977.5, '**Башня.** Двенадцать ярусов-кафедр над Тореосом; верхний — Магистр, Хранитель Ключа и архив. Магистр Сигни Верн.', st.id, [0, 0], 'Магистр Сигни Верн')
  place('lore-nt-library', 'Нижняя библиотека', 'landmark', sx(tor), 981, '**Библиотека Олава Скарде.** Три зала у подножия Башни; хранит книги имперской Школы и Свиток тем.', '', [16, -12])
  place('lore-nt-empty', 'Пустой экзамен', 'battle', sx(tor), 1000.2, '**1000.2.** Лучший балл — 196, проходного не набрал никто; Башней правит Хранитель Ключа Ульрик Вейд.', '', [-16, 12])
  place('lore-nt-needle', 'Стрелка Тореоса', 'landmark', sx(tor), 1008, '**1008 г.** Компас у маяка показывает на север на три градуса дальше, чем год назад; Торбьёрн Аск записывает это в тетрадь.', '', [14, 14])
}
if (hal) {
  place('lore-nt-hal', 'Серые плащи', 'landmark', sx(hal), 981.5, '**Городок ордена.** Три сотни воинов-магов; командует Орм Хальвахейм.', '', [14, -10])
  place('lore-nt-post', 'Северный Пост', 'landmark', sx(hal), 981.5, '**Застава.** Каменная башня и сигнальный костёр на дороге к Земле Севера.', '', [-14, 10])
}
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Северная Башня: мест ${world.places.filter((p) => p.id.startsWith('lore-nt-')).length}`)
