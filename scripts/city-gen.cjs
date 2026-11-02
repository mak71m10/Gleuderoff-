// Генерация планов городов без браузера и без участия человека: скрытое окно Electron открывает
// генератор Watabou (Medieval Fantasy City Generator) с параметрами города и флагом export=json,
// генератор сам «скачивает» план — загрузку перехватываем и кладём в source-maps/cities/<slug>.json.
// Он же рисует SVG-карты в PNG движком Chromium (--render=<файл.svg> → рядом <файл>.png): в разы быстрее,
// чем librsvg в sharp (Кирхфельд: 132 с → пара секунд).
// Запускается из node scripts/city-maps.mjs; вручную: npx electron scripts/city-gen.cjs <slug>=<query> … --render=<svg> …
const { app, BrowserWindow, session } = require('electron')
const { mkdirSync, readFileSync, writeFileSync } = require('fs')
const path = require('path')

const SITE = 'https://watabou.github.io/city-generator/'
const OUT = path.resolve('source-maps/cities')
const renders = process.argv.slice(2).filter((a) => a.startsWith('--render=')).map((a) => path.resolve(a.slice(9)))
const jobs = process.argv.slice(2).filter((a) => a.includes('=') && !a.startsWith('-')).map((a) => {
  const i = a.indexOf('=')
  return { slug: a.slice(0, i), query: a.slice(i + 1) }
})

app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.on('window-all-closed', () => {}) // окна открываются по одному — не выходить, когда закрылось очередное
app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true })
  let pending = null
  session.defaultSession.on('will-download', (_e, item) => {
    if (!pending) return item.cancel()
    const job = pending
    item.setSavePath(path.join(OUT, `${job.slug}.json`))
    item.once('done', (_ev, state) => job.resolve(state))
  })
  let failed = 0
  for (const job of jobs) {
    const t0 = Date.now()
    const win = new BrowserWindow({ show: false, width: 1400, height: 1000, webPreferences: { backgroundThrottling: false } })
    const state = await new Promise((resolve) => {
      pending = { ...job, resolve }
      setTimeout(() => resolve('timeout'), 60000)
      win.loadURL(`${SITE}?${job.query}`).catch(() => resolve('load-failed'))
    })
    pending = null
    win.destroy()
    if (state !== 'completed') failed++
    console.log(`${job.slug}: ${state === 'completed' ? 'план сохранён' : 'ошибка — ' + state} (${((Date.now() - t0) / 1000).toFixed(1)} с)`)
  }
  for (const svgFile of renders) {
    const t0 = Date.now()
    const svg = readFileSync(svgFile, 'utf8')
    const [, w, h] = svg.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/)
    const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
    await win.loadURL('data:text/html,<body></body>')
    const b64 = await win.webContents.executeJavaScript(`(async () => {
      const img = new Image()
      img.src = URL.createObjectURL(new Blob([${JSON.stringify(svg)}], { type: 'image/svg+xml' }))
      await img.decode()
      const c = document.createElement('canvas')
      c.width = ${w}; c.height = ${h}
      c.getContext('2d').drawImage(img, 0, 0, ${w}, ${h})
      return c.toDataURL('image/png').slice(22)
    })()`)
    win.destroy()
    writeFileSync(svgFile.replace(/\.svg$/, '.png'), Buffer.from(b64, 'base64'))
    console.log(`  отрисовка ${path.basename(svgFile)}: ${((Date.now() - t0) / 1000).toFixed(1)} с`)
  }
  app.exit(failed ? 1 : 0)
})
