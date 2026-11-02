// Локальная «мастерская» карт городов: страница /gen?… запускает генератор городов Watabou
// (Medieval Fantasy City Generator, скрипт грузится с его сайта) с нужными параметрами и сразу
// выгружает план в JSON; план приходит сюда POST-запросом и ложится в source-maps/cities/<имя>.json.
// Запуск: node scripts/city-receiver.mjs, затем открыть http://127.0.0.1:5310/gen?name=tirrit&size=30&seed=…
// Параметры генератора: size, seed, citadel, urban_castle, plaza, temple, walls, shantytown, coast, river,
// greens, hub, gates, sea (сторона моря). Скрипт city-maps.mjs печатает готовые ссылки для всех городов.
import { createServer } from 'http'
import { writeFileSync, mkdirSync } from 'fs'

const SITE = 'https://watabou.github.io/city-generator/'
mkdirSync('source-maps/cities', { recursive: true })

const page = (name) => `<!doctype html><html><head><meta charset="utf-8"><base href="${SITE}">
<title>План: ${name}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#111}#openfl-content{width:100%;height:100%}
#st{position:fixed;left:8px;bottom:8px;z-index:9;font:14px sans-serif;color:#fff;background:#000a;padding:4px 8px;border-radius:4px}</style>
<script>
// выгрузку генератора (FileSaver: Blob → ссылка → click) перехватываем и шлём план на свой сервер
const _oc = URL.createObjectURL
URL.createObjectURL = function (b) {
  b.text().then((t) => fetch('http://127.0.0.1:5310/save/${encodeURIComponent(name)}', { method: 'POST', body: t }))
    .then((r) => { document.getElementById('st').textContent = r.ok ? 'сохранён' : 'ошибка'; document.title = r.ok ? 'SAVED' : 'ERROR' })
  return _oc.call(URL, b)
}
HTMLAnchorElement.prototype.click = function () {}
// генератор переписывает адрес страницы под свой сайт (из-за <base>) — здесь это запрещено, просто глушим
history.replaceState = history.pushState = function () {}
</script>
<script src="mfcg.js"></script></head>
<body><div id="openfl-content"></div><div id="st">генерирую…</div>
<script>lime.embed("mfcg", "openfl-content", 0, 0, { parameters: {} })</script></body></html>`

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (req.method === 'GET' && url.pathname === '/gen') {
    const name = (url.searchParams.get('name') ?? 'city').replace(/[^\p{L}\p{N}_-]/gu, '')
    return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page(name))
  }
  if (req.method === 'POST' && url.pathname.startsWith('/save/')) {
    const name = decodeURIComponent(url.pathname.slice(6)).replace(/[^\p{L}\p{N}_-]/gu, '')
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      writeFileSync(`source-maps/cities/${name}.json`, body)
      console.log(`сохранён ${name}: ${body.length} байт`)
      res.writeHead(200).end('ok')
    })
    return
  }
  res.writeHead(404).end()
}).listen(5310, '127.0.0.1', () => console.log('мастерская карт городов: http://127.0.0.1:5310/gen?name=…'))
