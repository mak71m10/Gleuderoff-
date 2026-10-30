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
  // v11: перерисована подложка (пашни, лес, берега) — новые плитки уже скопированы вместе с maps выше
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
