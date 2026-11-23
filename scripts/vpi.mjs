// Запуск инструментов ВПИ: собирает scripts/vpi/vpi.mts и выполняет. Пример: node scripts/vpi.mjs досье "Корона Аргус"
import { buildSync } from 'esbuild'
import { spawnSync } from 'child_process'
import { mkdirSync } from 'fs'

mkdirSync('node_modules/.cache', { recursive: true })
const out = 'node_modules/.cache/vpi.mjs'
buildSync({ entryPoints: ['scripts/vpi/vpi.mts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' })
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(r.status ?? 0)
