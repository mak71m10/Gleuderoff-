// Убирает пометки «черновик» из стартового мира: теги, строки «_черновик_», «(черновик)». Запускать ПОСЛЕДНИМ шагом конвейера
// (после books и city-maps): скрипты лора по-прежнему ставят пометки при сборке, автор их не хочет видеть (07.11.2026).
// Тот же код — в миграции мира (src/main/index.ts, stripDraft).
import { readFileSync, writeFileSync } from 'fs'

export function stripDraft(node) {
  if (Array.isArray(node)) {
    const out = []
    for (const v of node) { if (typeof v === 'string' && /^черновик$/i.test(v.trim())) continue; out.push(stripDraft(v)) }
    return out
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = stripDraft(node[k])
    return node
  }
  if (typeof node === 'string' && /черновик/i.test(node)) {
    return node
      .replace(/\n*_[^_\n]*черновик[^_\n]*_/gi, '')
      .replace(/ ?Придумано по поручению автора[^.]*черновик\.?/gi, '')
      .replace(/ ?\([^()]*черновик[^()]*\)/gi, '')
      .replace(/[ \t]*[—-][ \t]*черновик\b/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/, '')
  }
  return node
}

if (process.argv[1].endsWith('strip-draft.mjs')) {
  const WORLD = 'resources/default-world/world.json'
  const world = stripDraft(JSON.parse(readFileSync(WORLD, 'utf8')))
  writeFileSync(WORLD, JSON.stringify(world, null, 1))
  const left = (JSON.stringify(world).match(/черновик/gi) ?? []).length
  console.log(`Пометки «черновик» убраны; осталось упоминаний: ${left}`)
}
