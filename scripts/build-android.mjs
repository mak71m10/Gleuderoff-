// Сборка приложения для Android (APK) из веб-сборки: npm run build:web → Capacitor копирует out-web в android/ → Gradle собирает APK.
// Инструменты лежат вне проекта (не в git): JDK 17, Android SDK и консоль Capacitor — в E:\Android (путь меняется переменной ANDROID_TOOLS).
// Готовый файл: release/Gleuderoff-<версия>.apk (подписан отладочным ключом — ставится на телефон напрямую, без магазина).
// Запуск: node scripts/build-android.mjs [--skip-web]
import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

const TOOLS = process.env.ANDROID_TOOLS ?? 'E:\\Android'
const jdk = readdirSync(TOOLS).find((d) => d.startsWith('jdk-17'))
if (!jdk) throw new Error(`Нет JDK 17 в ${TOOLS}`)
const env = {
  ...process.env,
  JAVA_HOME: join(TOOLS, jdk),
  ANDROID_HOME: join(TOOLS, 'sdk'),
  ANDROID_SDK_ROOT: join(TOOLS, 'sdk'),
  // кэш Gradle — тоже на E:, на C: мало места
  GRADLE_USER_HOME: join(TOOLS, 'gradle-home'),
  PATH: `${join(TOOLS, jdk, 'bin')};${process.env.PATH}`
}
const run = (cmd, cwd = '.') => execSync(cmd, { stdio: 'inherit', env, cwd })

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
if (!process.argv.includes('--skip-web')) run('npm run build:web')
run(`node "${join(TOOLS, 'capcli', 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor')}" sync android`)
// версия приложения = версия проекта (versionCode растёт вместе с ней: 0.31.0 → 3100)
const [a, b, c] = version.split('.').map(Number)
// Gradle для Android на Windows не собирает проект, в пути которого есть кириллица («Проект Gleuderoff»):
// на время сборки проект подключается виртуальным диском (subst) с латинским путём
const ascii = /^[\x20-\x7e]*$/.test(resolve('.'))
const drive = ascii ? null : ['W:', 'X:', 'Y:', 'Q:'].find((d) => { try { execSync(`if exist ${d}\\ (exit 1)`, { stdio: 'ignore' }); return true } catch { return false } })
if (!ascii && !drive) throw new Error('Нет свободной буквы диска для subst')
if (drive) execSync(`subst ${drive} "${resolve('.')}"`)
try {
  // по полному пути: cmd здесь не ищет программы в текущей папке
  const dir = drive ? `${drive}\\android` : resolve('android')
  run(`"${dir}\\gradlew.bat" assembleDebug -PappVersionName=${version} -PappVersionCode=${a * 100000 + b * 100 + c}`, dir)
} finally {
  if (drive) execSync(`subst ${drive} /d`)
}
mkdirSync('release', { recursive: true })
const out = join('release', `Gleuderoff-${version}.apk`)
copyFileSync(join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), out)
console.log(`Готово: ${out}`)
