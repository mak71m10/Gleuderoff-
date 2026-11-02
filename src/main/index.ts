import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { join, basename, extname, normalize, sep } from 'path'
import { pathToFileURL } from 'url'
import { promises as fs, existsSync } from 'fs'

// Файлы мира отдаются рендереру через схему world://asset/<относительный путь>
protocol.registerSchemesAsPrivileged([
  { scheme: 'world', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

const MAX_BACKUPS = 40

function defaultWorldSource(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'default-world')
    : join(app.getAppPath(), 'resources', 'default-world')
}

function worldDir(): string {
  return join(app.getPath('documents'), 'Gleuderoff', 'worlds', 'gleuderoff')
}

async function ensureWorld(): Promise<string> {
  const dir = worldDir()
  if (!existsSync(join(dir, 'world.json'))) {
    await fs.mkdir(dir, { recursive: true })
    await fs.cp(defaultWorldSource(), dir, { recursive: true })
  }
  return dir
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Обновление мира пользователя до новой версии стартового мира.
 * v1 -> v2: карта и государства перенесены из PSD (другая система координат), календарь «Реквием», статьи лора.
 * Метки пользователя пересчитываются в новые координаты, его записи справочника сохраняются.
 */
async function migrateWorld(dir: string): Promise<void> {
  const file = join(dir, 'world.json')
  const user: Json = JSON.parse(await fs.readFile(file, 'utf8'))
  const def: Json = JSON.parse(await fs.readFile(join(defaultWorldSource(), 'world.json'), 'utf8'))
  if ((user.version ?? 1) >= def.version) return

  await fs.copyFile(file, join(dir, `world-before-v${def.version}.json`))
  await fs.cp(join(defaultWorldSource(), 'maps'), join(dir, 'maps'), { recursive: true, force: true })
  // портреты персонажей (если есть) — копируются, не затирая картинки автора
  await fs.cp(join(defaultWorldSource(), 'portraits'), join(dir, 'portraits'), { recursive: true, force: false }).catch(() => undefined)
  // иллюстрации книг
  await fs.cp(join(defaultWorldSource(), 'books'), join(dir, 'books'), { recursive: true, force: true }).catch(() => undefined)

  if ((user.version ?? 1) < 2) {
    const oldMap = user.maps.find((m: Json) => m.id === 'world')
    const newMap = def.maps.find((m: Json) => m.id === 'world')
    const kx = newMap.width / oldMap.width
    const ky = newMap.height / oldMap.height
    for (const p of user.places) {
      if (p.mapId !== 'world') continue
      p.x = Math.round(p.x * kx * 10) / 10
      p.y = Math.round(p.y * ky * 10) / 10
    }
    user.maps = [newMap, ...user.maps.filter((m: Json) => m.id !== 'world')]
    user.states = def.states
    user.regions = [...def.regions, ...user.regions.filter((r: Json) => r.mapId !== 'world')]
    user.calendar = def.calendar
  }
  if ((user.version ?? 1) < 3) {
    // v3: подложка улучшена нейросетью и нарезана на плитки
    const newMap = def.maps.find((m: Json) => m.id === 'world')
    const map = user.maps.find((m: Json) => m.id === 'world')
    if (map) Object.assign(map, { image: newMap.image, tiles: newMap.tiles })
  }
  if ((user.version ?? 1) < 4) mergeLoreV4(user, def)
  if ((user.version ?? 1) < 5) mergeHistoryV5(user, def)
  if ((user.version ?? 1) < 8) {
    // v8: карта провинций (тысячи провинций, иерархия, постепенная история) вместо векторных участков
    if (isEmpty(user.provinces)) user.provinces = structuredClone(def.provinces)
    if (isEmpty(user.adminRegions)) user.adminRegions = structuredClone(def.adminRegions)
    const wm = user.maps.find((m: Json) => m.id === 'world')
    const dm = def.maps.find((m: Json) => m.id === 'world')
    if (wm && dm) wm.provinceMap = dm.provinceMap
    const untouched = (r: Json): boolean => r.mapId === 'world' && r.owners.length === 1 && r.owners[0].date === null
    user.regions = user.regions.filter((r: Json) => !untouched(r))
    const defStates = new Map<string, Json>(def.states.map((s: Json) => [s.id, s]))
    user.states = [...user.states.filter((s: Json) => !String(s.id).startsWith('hist-')), ...structuredClone(def.states.filter((s: Json) => String(s.id).startsWith('hist-')))]
    for (const us of user.states) {
      const ds = defStates.get(us.id)
      if (ds && !String(us.id).startsWith('hist-')) {
        us.from = ds.from
        us.to = ds.to
      }
    }
  }
  if ((user.version ?? 1) < 7) {
    // v7: Креит входил в Империю 150–980 — нетронутые участки карты мира заменяются заново
    const untouched = (r: Json): boolean => r.mapId === 'world' && r.owners.length === 1 && r.owners[0].date === null
    user.regions = [...user.regions.filter((r: Json) => !untouched(r)), ...structuredClone(def.regions.filter((r: Json) => r.mapId === 'world'))]
  }
  if ((user.version ?? 1) < 6) {
    // v6: даты основания стран, чья история целиком от составителя (Империя существует с эпохи княжеств)
    const defStates = new Map<string, Json>(def.states.map((s: Json) => [s.id, s]))
    for (const us of user.states) {
      const ds = defStates.get(us.id)
      if (ds && us.history.every((c: Json) => String(c.id).startsWith('lore-'))) us.from = ds.from
    }
  }
  if ((user.version ?? 1) < 9) {
    // v9: карта рельефа и поселения провинций (объёмные модели)
    const wm = user.maps.find((m: Json) => m.id === 'world')
    const dm = def.maps.find((m: Json) => m.id === 'world')
    if (wm && dm) wm.terrainMap = dm.terrainMap
    const defProv = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProv.get(p.id)
      if (!dp) continue
      if (p.settlement === undefined) p.settlement = structuredClone(dp.settlement ?? null)
      if (p.coastal === undefined) p.coastal = dp.coastal
    }
  }
  if ((user.version ?? 1) < 10) {
    // v10: новая подробная подложка 32768 px (плитки 1024), сглаженные провинции — соседи и поселения заново
    const wm = user.maps.find((m: Json) => m.id === 'world')
    const dm = def.maps.find((m: Json) => m.id === 'world')
    if (wm && dm) {
      wm.tiles = structuredClone(dm.tiles)
      delete wm.terrainMap
    }
    const defProv = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProv.get(p.id)
      if (!dp) continue
      p.neighbors = structuredClone(dp.neighbors)
      p.settlement = structuredClone(dp.settlement ?? null)
      p.coastal = dp.coastal
    }
  }
  if ((user.version ?? 1) < 13) {
    // v13: проработка Империи — лор («lore-…») заменяется, история провинций, описания поселений, дома регионов, битвы
    const defEntries = new Map<string, Json>(def.entries.map((e: Json) => [e.id, e]))
    user.entries = [...user.entries.filter((e: Json) => !String(e.id).startsWith('lore-') || !defEntries.has(e.id)).filter((e: Json) => !String(e.id).startsWith('lore-battle-')), ...structuredClone(def.entries.filter((e: Json) => String(e.id).startsWith('lore-')))]
    user.states = [...user.states.filter((s: Json) => !String(s.id).startsWith('hist-')), ...structuredClone(def.states.filter((s: Json) => String(s.id).startsWith('hist-')))]
    const defStates = new Map<string, Json>(def.states.map((s: Json) => [s.id, s]))
    for (const us of user.states) {
      const ds = defStates.get(us.id)
      if (!ds || String(us.id).startsWith('hist-')) continue
      us.from = ds.from
      us.to = ds.to
      // карточки, которые составил лор (Империя, вассалы): поля и история — из стартового мира
      if (['Империя', 'Корона Аргус', 'Графство Мангениум', 'Великое Герцогство Штирия'].includes(ds.base.name)) {
        us.base = { ...us.base, ...structuredClone(ds.base) }
        us.history = structuredClone(ds.history)
        if (ds.factions) us.factions = structuredClone(ds.factions)
      }
    }
    const defProv = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProv.get(p.id)
      if (!dp) continue
      p.owners = structuredClone(dp.owners)
      p.settlement = structuredClone(dp.settlement ?? null)
      if (dp.description) p.description = dp.description
      if (dp.landmark) p.landmark = dp.landmark
    }
    const defAdmin = new Map<string, Json>((def.adminRegions ?? []).map((a: Json) => [a.id, a]))
    for (const a of user.adminRegions ?? []) {
      const da = defAdmin.get(a.id)
      if (!da) continue
      if (da.houseId) a.houseId = da.houseId
      if (da.description && (!a.description || a.descAuto !== false)) {
        a.description = da.description
        a.descAuto = true
      }
    }
    const defPlaces = def.places.filter((p: Json) => String(p.id).startsWith('lore-'))
    const defPlaceIds = new Set(defPlaces.map((p: Json) => p.id))
    user.places = [...user.places.filter((p: Json) => !defPlaceIds.has(p.id) && !String(p.id).startsWith('lore-battle-')), ...structuredClone(defPlaces)]
  }
  if ((user.version ?? 1) < 14) {
    // v14: отколовшиеся от Республики государства больше не возвращаются Империи в 980 г.; походы армий
    const defProv = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProv.get(p.id)
      if (!dp) continue
      p.owners = structuredClone(dp.owners)
      p.settlement = structuredClone(dp.settlement ?? null)
      if (dp.description) p.description = dp.description
      if (dp.landmark) p.landmark = dp.landmark
      else delete p.landmark
    }
    const lorePlaces = def.places.filter((p: Json) => String(p.id).startsWith('lore-'))
    const ids = new Set(lorePlaces.map((p: Json) => p.id))
    user.places = [...user.places.filter((p: Json) => !ids.has(p.id)), ...structuredClone(lorePlaces)]
    user.armies = [...(user.armies ?? []).filter((a: Json) => !String(a.id).startsWith('lore-')), ...structuredClone(def.armies ?? [])]
  }
  if ((user.version ?? 1) < 16) {
    // v16: Корона Аргус — пять княжеств, Дом Аргус и Совет Крови, системы власти по годам, младшие дома, Сенат, армия, мятежи 976–977,
    // столица Норерштадт, описания поселений. Лор («lore-…») и история провинций — из стартового мира
    const defIds = new Set(def.entries.map((e: Json) => e.id))
    user.entries = [...user.entries.filter((e: Json) => !String(e.id).startsWith('lore-') || !defIds.has(e.id)), ...structuredClone(def.entries.filter((e: Json) => String(e.id).startsWith('lore-')))]
    user.states = [...user.states.filter((s: Json) => !String(s.id).startsWith('hist-')), ...structuredClone(def.states.filter((s: Json) => String(s.id).startsWith('hist-')))]
    const ds = def.states.find((s: Json) => s.base.name === 'Корона Аргус')
    const us = user.states.find((s: Json) => s.id === ds?.id)
    if (ds && us) {
      us.base = { ...us.base, ...structuredClone(ds.base) }
      us.history = structuredClone(ds.history)
      us.factions = structuredClone(ds.factions)
    }
    const defProv = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProv.get(p.id)
      if (!dp) continue
      p.owners = structuredClone(dp.owners)
      p.settlement = structuredClone(dp.settlement ?? null)
      if (dp.description) p.description = dp.description
    }
    const defAdmin = new Map<string, Json>((def.adminRegions ?? []).map((a: Json) => [a.id, a]))
    for (const a of user.adminRegions ?? []) {
      const da = defAdmin.get(a.id)
      if (!da) continue
      if (da.houseId) a.houseId = da.houseId
      if (da.description && (!a.description || a.descAuto !== false)) {
        a.description = da.description
        a.descAuto = true
      }
    }
    const lorePlaces = def.places.filter((p: Json) => String(p.id).startsWith('lore-'))
    const ids = new Set(lorePlaces.map((p: Json) => p.id))
    user.places = [...user.places.filter((p: Json) => !ids.has(p.id) && !String(p.id).startsWith('lore-battle-')), ...structuredClone(lorePlaces)]
    user.armies = [...(user.armies ?? []).filter((a: Json) => !String(a.id).startsWith('lore-')), ...structuredClone(def.armies ?? [])]
    // Верховный совет и Сенат Короны: составы, законы и голоса по годам
    user.legislatures = structuredClone(def.legislatures ?? [])
  }
  if ((user.version ?? 1) < 17) {
    // v17: Республика — Временное правительство, Освобождение 977 г. по городам, Охота, Ночь Ножниц, канцлер, дома, губернаторы,
    // армия, Народное собрание с выборами по весу голоса, кабинеты, городские парламенты, Совет рабочих, особые места
    const defIds = new Set(def.entries.map((e: Json) => e.id))
    user.entries = [...user.entries.filter((e: Json) => !String(e.id).startsWith('lore-') || !defIds.has(e.id)), ...structuredClone(def.entries.filter((e: Json) => String(e.id).startsWith('lore-')))]
    user.states = [...user.states.filter((s: Json) => !String(s.id).startsWith('hist-')), ...structuredClone(def.states.filter((s: Json) => String(s.id).startsWith('hist-')))]
    const ds = def.states.find((s: Json) => s.base.name === 'Республика')
    const us = user.states.find((s: Json) => s.id === ds?.id)
    if (ds && us) {
      us.base = { ...us.base, ...structuredClone(ds.base) }
      us.history = structuredClone(ds.history)
      us.factions = structuredClone(ds.factions)
    }
    const defProv = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProv.get(p.id)
      if (!dp) continue
      p.owners = structuredClone(dp.owners)
      p.settlement = structuredClone(dp.settlement ?? null)
      if (dp.description) p.description = dp.description
      if (dp.cityMapId) p.cityMapId = dp.cityMapId
    }
    const defAdmin = new Map<string, Json>((def.adminRegions ?? []).map((a: Json) => [a.id, a]))
    for (const a of user.adminRegions ?? []) {
      const da = defAdmin.get(a.id)
      if (!da) continue
      if (da.houseId !== undefined) a.houseId = da.houseId
      if (da.description && (!a.description || a.descAuto !== false)) {
        a.description = da.description
        a.descAuto = true
      }
    }
    // планы городов Республики (генератор Watabou + city-maps.mjs): картинки уже скопированы вместе с maps;
    // метки зданий city-* добавятся ниже вместе с прочими новыми местами
    const cityMaps = (def.maps ?? []).filter((m: Json) => String(m.id).startsWith('map-city-'))
    const cityIds = new Set(cityMaps.map((m: Json) => m.id))
    user.maps = [...user.maps.filter((m: Json) => !cityIds.has(m.id)), ...structuredClone(cityMaps)]
    const lorePlaces = def.places.filter((p: Json) => String(p.id).startsWith('lore-'))
    const ids = new Set(lorePlaces.map((p: Json) => p.id))
    user.places = [...user.places.filter((p: Json) => !ids.has(p.id) && !String(p.id).startsWith('lore-battle-') && !String(p.id).startsWith('lore-rp-')), ...structuredClone(lorePlaces)]
    user.armies = [...(user.armies ?? []).filter((a: Json) => !String(a.id).startsWith('lore-')), ...structuredClone(def.armies ?? [])]
    user.legislatures = structuredClone(def.legislatures ?? [])
  }
  if ((user.version ?? 1) < 19) {
    // v18: план Хауссера по эскизу автора (scripts/hausser-plan.mjs); v19: планы городов, городков, портов и кастр
    // Империи и Короны Аргус. Карты, вход из столицы или провинции; метки зданий city-* добавятся ниже со всеми новыми местами
    const cityMaps = (def.maps ?? []).filter((m: Json) => String(m.id).startsWith('map-city-'))
    const cityIds = new Set(cityMaps.map((m: Json) => m.id))
    user.maps = [...user.maps.filter((m: Json) => !cityIds.has(m.id)), ...structuredClone(cityMaps)]
    for (const m of cityMaps) {
      const up = m.placeId && user.places.find((p: Json) => p.id === m.placeId)
      if (up && !up.innerMapId) up.innerMapId = m.id
    }
    const defCity = new Map<number, string>((def.provinces ?? []).filter((p: Json) => p.cityMapId).map((p: Json) => [p.id, p.cityMapId]))
    for (const p of user.provinces ?? []) if (!p.cityMapId && defCity.has(p.id)) p.cityMapId = defCity.get(p.id)
  }
  if ((user.version ?? 1) < 20) {
    // v20: южные республики — доимперский юг, канцлерские дома, парламенты с цензом и партиями, рабочие комитеты,
    // описания поселений, столицы; планы всех южных городов и деревень. Перерисованы Корельвейлер, Дальау и Тирельлаге —
    // их метки зданий city-* заменяются целиком (свои локации пользователя в зданиях — с другими id — не трогаются)
    const defIds = new Set(def.entries.map((e: Json) => e.id))
    user.entries = [...user.entries.filter((e: Json) => !String(e.id).startsWith('lore-') || !defIds.has(e.id)), ...structuredClone(def.entries.filter((e: Json) => String(e.id).startsWith('lore-')))]
    const SOUTH = ['Тоскана', 'Вуфинская Республика', 'Республика Шеша', 'Кальтранская Республика']
    for (const ds of def.states.filter((s: Json) => SOUTH.includes(s.base.name))) {
      const us = user.states.find((s: Json) => s.id === ds.id)
      if (us) {
        us.base = { ...us.base, ...structuredClone(ds.base) }
        us.factions = structuredClone(ds.factions)
      }
    }
    user.states = [...user.states.filter((s: Json) => !String(s.id).startsWith('hist-south-')), ...structuredClone(def.states.filter((s: Json) => String(s.id).startsWith('hist-south-')))]
    const southIds = new Set(def.states.filter((s: Json) => SOUTH.includes(s.base.name)).map((s: Json) => s.id))
    const defProv = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProv.get(p.id)
      if (!dp) continue
      if (dp.cityMapId) p.cityMapId = dp.cityMapId
      if (!southIds.has(dp.owners?.at(-1)?.[1])) continue
      p.owners = structuredClone(dp.owners)
      p.description = dp.description
    }
    const cityMaps = (def.maps ?? []).filter((m: Json) => String(m.id).startsWith('map-city-'))
    const cityIds = new Set(cityMaps.map((m: Json) => m.id))
    user.maps = [...user.maps.filter((m: Json) => !cityIds.has(m.id)), ...structuredClone(cityMaps)]
    user.places = user.places.filter((p: Json) => !String(p.id).startsWith('city-'))
    for (const m of cityMaps) {
      const up = m.placeId && user.places.find((p: Json) => p.id === m.placeId)
      if (up && !up.innerMapId) up.innerMapId = m.id
    }
    user.legislatures = structuredClone(def.legislatures ?? [])
  }
  if ((user.version ?? 1) < 21) {
    // v21: походы армий идут по дорогам и местности (scripts/army-routes.mjs); планы всех деревень, замков и посёлков
    // Империи, Короны Аргус, Республики и Святой церкви; портреты депутатов южных парламентов; Святая церковь —
    // папы, святые архиепископы, ордена, Совет, иерархия, архиепархии, описания поселений
    const defIds = new Set(def.entries.map((e: Json) => e.id))
    user.entries = [...user.entries.filter((e: Json) => !String(e.id).startsWith('lore-') || !defIds.has(e.id)), ...structuredClone(def.entries.filter((e: Json) => String(e.id).startsWith('lore-')))]
    const HOLY = ['Святая церковь', 'Архиепархия Луправена', 'Архиепархия Ошоморида', 'Архиепископия Окрупия', 'Архиепархия Бувезеона']
    const holyIds = new Set<string>()
    for (const ds of def.states.filter((s: Json) => HOLY.includes(s.base.name))) {
      holyIds.add(ds.id)
      const us = user.states.find((s: Json) => s.id === ds.id)
      if (us) us.base = { ...us.base, ...structuredClone(ds.base) }
    }
    const defProvs = new Map<number, Json>((def.provinces ?? []).map((p: Json) => [p.id, p]))
    for (const p of user.provinces ?? []) {
      const dp = defProvs.get(p.id)
      if (dp && holyIds.has(dp.owners?.at(-1)?.[1])) p.description = dp.description
    }
    const defArmies = new Map<string, Json>((def.armies ?? []).map((a: Json) => [a.id, a]))
    user.armies = (user.armies ?? []).map((a: Json) => (defArmies.has(a.id) ? structuredClone(defArmies.get(a.id)) : a))
    const cityMaps = (def.maps ?? []).filter((m: Json) => String(m.id).startsWith('map-city-'))
    const cityIds = new Set(cityMaps.map((m: Json) => m.id))
    user.maps = [...user.maps.filter((m: Json) => !cityIds.has(m.id)), ...structuredClone(cityMaps)]
    user.places = user.places.filter((p: Json) => !String(p.id).startsWith('city-'))
    const defCity = new Map<number, string>((def.provinces ?? []).filter((p: Json) => p.cityMapId).map((p: Json) => [p.id, p.cityMapId]))
    for (const p of user.provinces ?? []) if (defCity.has(p.id)) p.cityMapId = defCity.get(p.id)
    user.legislatures = structuredClone(def.legislatures ?? [])
  }
  // v11–v12: перерисована подложка (пашни, лес, берега, дороги, тени гор) — новые плитки уже скопированы вместе с maps выше
  // v15: портреты из стартового мира — тем записям лора, у которых своей картинки нет
  const defImages = new Map<string, string>(def.entries.filter((e: Json) => e.base?.image).map((e: Json) => [e.id, e.base.image]))
  for (const e of user.entries) if (!e.base.image && defImages.has(e.id)) e.base.image = defImages.get(e.id)
  const ids = new Set(user.entries.map((e: Json) => e.id))
  user.entries = [...user.entries, ...def.entries.filter((e: Json) => !ids.has(e.id))]
  const placeIds = new Set(user.places.map((p: Json) => p.id))
  user.places = [...user.places, ...def.places.filter((p: Json) => !placeIds.has(p.id))]
  user.version = def.version
  await fs.writeFile(file, JSON.stringify(user, null, 1), 'utf8')
}

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Дописывает в target только то, что там пусто. Заполненное пользователем не трогается. */
function fillEmpty(target: Json, src: Json): void {
  for (const [k, v] of Object.entries(src)) {
    if (isEmpty(target[k])) target[k] = structuredClone(v)
    else if (isObj(target[k]) && isObj(v)) fillEmpty(target[k], v)
  }
}

/**
 * v4: исправленные названия стран, Клан Марф-Одр и Братство Бездны, флаги, правители Империи,
 * боги, расы, династия Монстаргов, эпохи и 1010 год. Правки пользователя сохраняются.
 */
function mergeLoreV4(user: Json, def: Json): void {
  const TYPOS: Record<string, string> = {
    'Имперсике Изгнаники': 'Имперские Изгнанники',
    'Королество Темерия': 'Королевство Темерия',
    'Алое Королевства': 'Алые Королевства',
    'Великая Востояная Башня': 'Великая Восточная Башня',
    'Содружество Злайтайских Общин': 'Содружество Златайских Общин',
    'Клан Арк"ран': "Клан Арк'ран",
    'Империя Кагай': 'Империя Кагия'
  }
  const userStates = new Map<string, Json>(user.states.map((s: Json) => [s.id, s]))
  for (const ds of def.states) {
    const us = userStates.get(ds.id)
    if (!us) {
      user.states.push(structuredClone(ds))
      continue
    }
    if (TYPOS[us.base.name]) us.base.name = TYPOS[us.base.name]
    fillEmpty(us.base, ds.base)
    for (const k of ['history', 'factions', 'label', 'from']) if (isEmpty(us[k]) && !isEmpty(ds[k])) us[k] = structuredClone(ds[k])
  }
  const userRegions = new Map<string, Json>(user.regions.map((r: Json) => [r.id, r]))
  for (const dr of def.regions) {
    const ur = userRegions.get(dr.id)
    if (!ur) user.regions.push(structuredClone(dr))
    else if (ur.owners.length === 1 && ur.owners[0].date === null) {
      // владение не правили — можно обновить форму (например, Гротта без Марф-Одр)
      ur.rings = dr.rings
      ur.name = dr.name
    }
  }
  const userEntries = new Map<string, Json>(user.entries.map((e: Json) => [e.id, e]))
  for (const de of def.entries) {
    const ue = userEntries.get(de.id)
    if (!ue) continue // новые добавятся ниже
    fillEmpty(ue.base, de.base)
    if (ue.from == null && de.from != null) ue.from = de.from
    if (ue.to == null && de.to != null) ue.to = de.to
  }
  const OLD_PRESENT = 1199 * 500
  if (user.calendar.present === OLD_PRESENT) user.calendar.present = def.calendar.present
  if (user.calendar.rangeFrom === -300 && user.calendar.rangeTo === 1400) {
    user.calendar.rangeFrom = def.calendar.rangeFrom
    user.calendar.rangeTo = def.calendar.rangeTo
  }
  fillEmpty(user.calendar, def.calendar)
}

/**
 * v5: история границ (княжества, Дагерфорд, Империя, распад), государства прошлого, подписи географии,
 * Сантарея и Ул-гхайм, дни недели, правки лора (Калев, Аматерасу, мироны, Империя Кагия).
 */
function mergeHistoryV5(user: Json, def: Json): void {
  mergeLoreV4(user, def) // названия, пустые поля, новые страны
  const defStates = new Map<string, Json>(def.states.map((s: Json) => [s.id, s]))
  for (const us of user.states) {
    const ds = defStates.get(us.id)
    if (!ds) continue
    // история, составленная только составителем (id «lore-…»), обновляется целиком
    if (us.history.every((c: Json) => String(c.id).startsWith('lore-'))) {
      us.history = structuredClone(ds.history)
      for (const k of ['ruler', 'rulerId', 'rulerTitle']) us.base[k] = ds.base[k]
    }
    if (us.from == null && ds.from != null) us.from = ds.from
  }
  // участки карты мира: нетронутые пользователем заменяются историческими
  const untouched = (r: Json): boolean => r.mapId === 'world' && r.owners.length === 1 && r.owners[0].date === null
  user.regions = [...user.regions.filter((r: Json) => !untouched(r)), ...structuredClone(def.regions.filter((r: Json) => r.mapId === 'world'))]
  // точечные правки лора по ответам автора
  const fix = (id: string, extra?: (e: Json) => void): void => {
    const e = user.entries.find((x: Json) => x.id === id)
    const d = def.entries.find((x: Json) => x.id === id)
    if (!e || !d) return
    e.base.props = { ...e.base.props, ...d.base.props }
    e.base.links = { ...e.base.links, ...d.base.links }
    extra?.(e)
  }
  fix('lore-kalev', (e) => (e.base.links.religion = ''))
  fix('lore-amaterasu')
  fix('lore-mirons', (e) => delete e.base.secret)
  if ((user.calendar.weekdays ?? []).join() === 'День I,День II,День III,День IV,День V') user.calendar.weekdays = def.calendar.weekdays
  if (isEmpty(user.mapLabels)) user.mapLabels = structuredClone(def.mapLabels ?? [])
}

async function backupWorld(dir: string): Promise<void> {
  const backups = join(dir, 'backups')
  await fs.mkdir(backups, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await fs.copyFile(join(dir, 'world.json'), join(backups, `world-${stamp}.json`))
  const files = (await fs.readdir(backups)).filter((f) => f.startsWith('world-')).sort()
  for (const old of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
    await fs.unlink(join(backups, old))
  }
}

function insideWorld(dir: string, rel: string): string | null {
  const full = normalize(join(dir, rel))
  return full.startsWith(normalize(dir) + sep) ? full : null
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f1115',
    title: 'Gleuderoff',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  const dir = await ensureWorld()
  await backupWorld(dir)
  await migrateWorld(dir)

  protocol.handle('world', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname.replace(/^\/+/, ''))
    const full = insideWorld(dir, rel)
    if (!full) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(full).toString())
  })

  ipcMain.handle('world:load', async () => {
    const raw = await fs.readFile(join(dir, 'world.json'), 'utf8')
    return { dir, data: JSON.parse(raw) }
  })

  ipcMain.handle('world:save', async (_e, data: unknown) => {
    const tmp = join(dir, 'world.json.tmp')
    await fs.writeFile(tmp, JSON.stringify(data, null, 1), 'utf8')
    await fs.rename(tmp, join(dir, 'world.json'))
    return true
  })

  ipcMain.handle('world:importImage', async (_e, folder: string) => {
    const res = await dialog.showOpenDialog({
      title: 'Выберите изображение',
      properties: ['openFile'],
      filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const src = res.filePaths[0]
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '') || 'images'
    const name = `${basename(src, extname(src)).replace(/[^\p{L}\p{N}_-]+/gu, '_')}-${Date.now()}${extname(src).toLowerCase()}`
    const rel = `assets/${safeFolder}/${name}`
    await fs.mkdir(join(dir, 'assets', safeFolder), { recursive: true })
    await fs.copyFile(src, join(dir, rel))
    return rel
  })

  ipcMain.handle('world:openFolder', () => shell.openPath(dir))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
