// Релиз на GitHub: node scripts/release.mjs "Заголовок" "Что нового"
// Версия берётся из package.json; загружает release/Gleuderoff-<версия>.apk и Gleuderoff-Setup-<версия>.exe.
// Токен — из git credential (тот же, что у git push), нигде не печатается.
import { execSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'

const ver = JSON.parse(readFileSync('package.json', 'utf8')).version
const [title = `Gleuderoff ${ver}`, notes = ''] = process.argv.slice(2)
const cred = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n\n' }).toString()
const token = /password=(.*)/.exec(cred)?.[1]?.trim()
if (!token) throw new Error('нет токена GitHub: сначала git push должен работать')
const repo = 'mak71m10/Gleuderoff-'
const H = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'gleuderoff-release' }
const tag = `v${ver}`

let res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers: H })
if (res.status === 404) {
  const body = `${notes}\n\nТелефон: Gleuderoff-${ver}.apk — ставится поверх старой версии.\nПК: Gleuderoff-Setup-${ver}.exe — ставится поверх, мир обновится сам (прежний сохраняется копией).`
  res = await fetch(`https://api.github.com/repos/${repo}/releases`, { method: 'POST', headers: H, body: JSON.stringify({ tag_name: tag, target_commitish: 'main', name: title, body }) })
}
const r = await res.json()
if (!r.upload_url) throw new Error(JSON.stringify(r).slice(0, 300))
for (const [name, type] of [[`Gleuderoff-${ver}.apk`, 'application/vnd.android.package-archive'], [`Gleuderoff-Setup-${ver}.exe`, 'application/octet-stream']]) {
  const file = `release/${name}`
  if (!existsSync(file)) { console.log('нет файла', file); continue }
  if (r.assets?.some((a) => a.name === name)) { console.log('уже загружен', name); continue }
  const up = await fetch(r.upload_url.replace(/\{.*\}/, '') + '?name=' + name, { method: 'POST', headers: { ...H, 'Content-Type': type, 'Content-Length': String(statSync(file).size) }, body: readFileSync(file), duplex: 'half' })
  const a = await up.json()
  console.log(name, up.status, a.state ?? JSON.stringify(a).slice(0, 200))
}
console.log('Страница релиза:', r.html_url)
