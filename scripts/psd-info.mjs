// Печатает дерево слоёв PSD: имя, видимость, границы, режим наложения.
// Использование: node scripts/psd-info.mjs source-maps/political.psd
import { readFileSync } from 'fs'
import { readPsd } from 'ag-psd'

const psd = readPsd(readFileSync(process.argv[2] ?? 'source-maps/political.psd'), {
  skipLayerImageData: true,
  skipCompositeImageData: true,
  skipThumbnail: true
})
console.log(`Размер: ${psd.width}×${psd.height}`)
function walk(layers, depth) {
  for (const l of layers ?? []) {
    const box = `${l.left},${l.top} → ${l.right},${l.bottom}`
    console.log(`${'  '.repeat(depth)}${l.children ? '[группа] ' : ''}${l.name}  ${l.hidden ? '(скрыт)' : ''} ${box} ${l.blendMode ?? ''} op=${l.opacity ?? 1}`)
    if (l.children) walk(l.children, depth + 1)
  }
}
walk(psd.children, 0)
