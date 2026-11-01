import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { PageFlip } from 'page-flip'
import { useStore } from '../store'
import { resolve } from '../temporal'
import { bookTheme, inlineMd, toBlocks, type BookBlock, type BookTheme } from '../books'
import { EMBLEMS } from './Heraldry'
import { assetUrl } from './ui'
import { Icon } from './Icon'
import type { Entry } from '../types'

interface Laid {
  pages: { html: string; chapter: string }[]
  chapters: { title: string; page: number }[]
}

const emblemSvg = (theme: BookTheme, size: number): string =>
  renderToStaticMarkup(
    <svg viewBox="0 0 100 100" width={size} height={size} className="bk-emblem">
      {EMBLEMS[theme.emblem]?.draw(theme.coverInk, theme.cover[1])}
    </svg>
  )

/** Размер шрифта, размеры страницы и цвета обложки — переменными CSS: одинаково для разметки и для книги. */
const bookVars = (theme: BookTheme, w: number, h: number): string =>
  `--bk-fs:${(w / 29).toFixed(2)}px;--bk-w:${w}px;--bk-h:${h}px;--bk-cover1:${theme.cover[0]};--bk-cover2:${theme.cover[1]};--bk-cover-ink:${theme.coverInk};--bk-orn:'${theme.ornament}'`

/** Раскладка текста по страницам: каждая страница заполняется, пока текст помещается; абзацы режутся по предложениям. */
function layout(blocks: BookBlock[], theme: BookTheme, w: number, h: number): Laid {
  const probe = document.createElement('div')
  probe.className = `bk bk-theme-${theme.key} bk-probe`
  probe.setAttribute('style', bookVars(theme, w, h))
  probe.lang = 'ru'
  probe.innerHTML = `<div class="bk-page bk-content" style="width:${w}px;height:${h}px"><div class="bk-head">&nbsp;</div><div class="bk-text"></div><div class="bk-foot">0</div></div>`
  document.body.appendChild(probe)
  const text = probe.querySelector('.bk-text') as HTMLDivElement
  const pages: Laid['pages'] = []
  const chapters: Laid['chapters'] = []
  let cur: { html: string; kind: string }[] = []
  let chapter = ''
  let initial = 'bk-initial'
  const fits = (): boolean => text.scrollHeight <= text.clientHeight + 1
  const render = (): void => {
    text.innerHTML = cur.map((c) => c.html).join('')
  }
  const newPage = (): void => {
    if (cur.length) pages.push({ html: cur.map((c) => c.html).join(''), chapter })
    cur = []
    text.innerHTML = ''
  }
  const tryAdd = (html: string, kind: string): boolean => {
    text.insertAdjacentHTML('beforeend', html)
    if (fits()) {
      cur.push({ html, kind })
      return true
    }
    text.lastElementChild?.remove()
    return false
  }
  // заголовок не остаётся один внизу страницы
  const breakKeepingHeading = (): void => {
    const carry: typeof cur = []
    while (cur.length && (cur[cur.length - 1].kind === 'h1' || cur[cur.length - 1].kind === 'h2' || cur[cur.length - 1].kind === 'img')) carry.unshift(cur.pop()!)
    render()
    newPage()
    for (const c of carry) tryAdd(c.html, c.kind)
  }

  for (const b of blocks) {
    if (b.kind === 'h1') {
      newPage()
      chapter = b.html.replace(/<[^>]+>/g, '')
      chapters.push({ title: chapter, page: pages.length })
      tryAdd(b.html, 'h1')
      initial = 'bk-initial'
      continue
    }
    if (b.kind === 'h2') {
      if (!chapters.length || chapters[chapters.length - 1].title !== chapter) chapter ||= b.html.replace(/<[^>]+>/g, '')
      if (!tryAdd(b.html, 'h2')) {
        breakKeepingHeading()
        tryAdd(b.html, 'h2')
      }
      initial = initial === 'bk-initial' && cur.length === 1 ? 'bk-initial' : 'bk-initial-sm'
      continue
    }
    if (b.kind !== 'p') {
      if (!tryAdd(b.html, b.kind)) {
        breakKeepingHeading()
        if (!tryAdd(b.html, b.kind)) cur.push({ html: b.html, kind: b.kind })
      }
      continue
    }
    // абзац: целиком, иначе столько предложений, сколько влезет, остальное — на следующую страницу
    let rest = b.text!.split(/(?<=[.!?…»])\s+/)
    let cls = initial
    initial = ''
    const para = (c: string, list: string[]): string => `<p class="${c}">${inlineMd(list.join(' '))}</p>`
    const fitsAlone = (html: string): boolean => {
      text.insertAdjacentHTML('beforeend', html)
      const ok = fits()
      text.lastElementChild?.remove()
      return ok
    }
    while (rest.length) {
      if (tryAdd(para(cls, rest), 'p')) break
      let n = 0
      while (n < rest.length && fitsAlone(para(`${cls} bk-split`, rest.slice(0, n + 1)))) n++
      if (n === 0) {
        if (!cur.length) {
          // одно предложение длиннее страницы — ставим как есть
          cur.push({ html: para(cls, rest.slice(0, 1)), kind: 'p' })
          rest = rest.slice(1)
          newPage()
          cls = 'bk-cont'
        } else breakKeepingHeading()
        continue
      }
      cur.push({ html: para(`${cls} bk-split`, rest.slice(0, n)), kind: 'p' })
      rest = rest.slice(n)
      newPage()
      cls = 'bk-cont'
    }
  }
  newPage()
  probe.remove()
  return { pages, chapters }
}

export function BookReader({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)
  const f = resolve(entry, date)
  const theme = bookTheme(entry)
  const stage = useRef<HTMLDivElement>(null)
  const flipRef = useRef<PageFlip | null>(null)
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [toc, setToc] = useState<{ title: string; index: number }[]>([])
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  useEffect(() => {
    let t = 0
    const onResize = (): void => {
      clearTimeout(t)
      t = window.setTimeout(() => setSize({ w: window.innerWidth, h: window.innerHeight }), 250)
    }
    window.addEventListener('resize', onResize)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') flipRef.current?.flipNext()
      if (e.key === 'ArrowLeft') flipRef.current?.flipPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    const host = stage.current
    if (!host) return
    // размер страницы: книга во весь экран, в узком окне — одна страница
    const availH = size.h - 130
    const availW = size.w - 40
    let h = Math.max(380, Math.min(availH, 860))
    let w = Math.round(h * 0.7)
    const portrait = availW < w * 2 + 40
    if (portrait && w > availW) {
      w = availW
      h = Math.round(w / 0.7)
    }
    const titleIll = theme.illustrations.find((i) => i.at === 'title')
    const laid = layout(toBlocks(f.body, theme, assetUrl), theme, w, h)
    const first = 4 // обложка, форзац, титул, оглавление
    const frame = (cls: string, inner: string, hard = false): string => `<div class="bk-page ${cls}"${hard ? ' data-density="hard"' : ''}>${inner}</div>`
    const cover = frame(
      'bk-cover',
      `<div class="bk-cover-frame"><div class="bk-cover-kind">${theme.kind}</div><div class="bk-cover-title">${inlineMd(f.name)}</div>${emblemSvg(theme, Math.round(w * 0.36))}<div class="bk-cover-orn">${theme.ornament}</div></div>`,
      true
    )
    const endpaper = frame('bk-endpaper', '', true)
    const titlePage = frame(
      'bk-content bk-titlepage',
      `<div class="bk-tp-kind">${theme.kind}</div><div class="bk-tp-title">${inlineMd(f.name)}</div>${f.title ? `<div class="bk-tp-sub">${inlineMd(f.title)}</div>` : ''}<div class="bk-rule">${theme.ornament}</div>${
        titleIll
          ? `<figure class="bk-figure bk-front"><img src="${assetUrl(`books/${titleIll.file}`)}" alt=""><figcaption>${titleIll.caption}</figcaption></figure>`
          : `<div class="bk-tp-emblem">${emblemSvg(theme, Math.round(w * 0.3))}</div>`
      }<div class="bk-tp-imprint">${theme.imprint}</div>`
    )
    const tocItems = laid.chapters.length ? laid.chapters : [{ title: f.name, page: 0 }]
    const tocPage = frame(
      'bk-content bk-toc',
      `<div class="bk-toc-title">Оглавление</div><div class="bk-rule">${theme.ornament}</div><ol>${tocItems
        .map((c) => `<li class="bk-toc-item" data-page="${first + c.page}"><span>${c.title}</span><i></i><b>${c.page + 1}</b></li>`)
        .join('')}</ol>`
    )
    // при обложке отдельно нечётные страницы книги — левые: слева название книги, справа глава
    const content = laid.pages.map((p, i) => {
      const left = (first + i) % 2 === 1
      return frame(
        `bk-content ${left ? 'bk-left' : 'bk-right'}`,
        `<div class="bk-head">${left ? inlineMd(f.name) : p.chapter}</div><div class="bk-text">${p.html}</div><div class="bk-foot">${i + 1}</div>`
      )
    })
    // обложка одна справа, дальше развороты, задняя обложка одна — внутренних страниц должно быть чётное число
    const inner = [endpaper, titlePage, tocPage, ...content]
    if (inner.length % 2) inner.push(frame('bk-content bk-blank', `<div class="bk-end-orn">${theme.ornament}</div>`))
    const all = [cover, ...inner, frame('bk-endpaper', '', true), frame('bk-cover bk-back', `<div class="bk-cover-frame"><div class="bk-cover-orn">${theme.ornament}</div></div>`, true)]

    const root = document.createElement('div')
    root.className = `bk bk-theme-${theme.key}`
    root.setAttribute('style', bookVars(theme, w, h))
    root.lang = 'ru'
    root.innerHTML = all.join('')
    host.appendChild(root)
    // иллюстрации, которые ещё не нарисованы, — пустая рамка с орнаментом
    for (const img of root.querySelectorAll('img')) {
      const miss = (): void => img.parentElement?.classList.add('missing')
      if (img.complete && !img.naturalWidth) miss()
      img.addEventListener('error', miss)
      img.addEventListener('load', () => !img.naturalWidth && miss())
    }
    const pf = new PageFlip(root, {
      width: w,
      height: h,
      size: 'fixed',
      showCover: true,
      usePortrait: portrait,
      maxShadowOpacity: 0.55,
      flippingTime: 800,
      mobileScrollSupport: false,
      drawShadow: true
    })
    pf.loadFromHTML(root.querySelectorAll('.bk-page'))
    pf.on('flip', (e) => setPage(Number(e.data)))
    flipRef.current = pf
    setCount(pf.getPageCount())
    setPage(0)
    setToc(tocItems.map((c) => ({ title: c.title, index: first + c.page })))
    // оглавление и ссылки в тексте
    const onClick = (e: MouseEvent): void => {
      const el = e.target as HTMLElement
      const item = el.closest('.bk-toc-item') as HTMLElement | null
      if (item) pf.flip(Number(item.dataset.page))
      const link = el.closest('.bk-link') as HTMLElement | null
      if (link) {
        const target = world.entries.find((x) => x.base.name === link.dataset.name)
        if (target) {
          select({ type: 'entry', id: target.id })
          setView(target.kind)
          onClose()
        }
      }
    }
    root.addEventListener('click', onClick)
    return () => {
      root.removeEventListener('click', onClick)
      flipRef.current = null
      try {
        pf.destroy()
      } catch {
        // уже снят
      }
      root.remove()
    }
  }, [entry.id, f.body, size.w, size.h])

  const spread = page <= 0 ? 'Обложка' : page >= count - 1 ? 'Задняя обложка' : `${page}–${Math.min(page + 1, count - 1)} из ${count}`
  return createPortal(
    <div className={`book-room bk-room-${theme.key}`}>
      <button className="modal-close" onClick={onClose} title="Закрыть (Esc)">
        <Icon name="x" size={18} />
      </button>
      <div className="book-stage" ref={stage} />
      <div className="book-bar">
        <button onClick={() => flipRef.current?.flip(0)} title="К обложке">
          <Icon name="back" size={16} />
        </button>
        <button onClick={() => flipRef.current?.flipPrev()} title="Назад (←)">‹</button>
        <span className="book-pos">{spread}</span>
        <button onClick={() => flipRef.current?.flipNext()} title="Вперёд (→)">›</button>
        {toc.length > 1 && (
          <select value="" onChange={(e) => e.target.value && flipRef.current?.flip(Number(e.target.value))}>
            <option value="">Главы…</option>
            {toc.map((c) => (
              <option key={c.index} value={c.index}>
                {c.title}
              </option>
            ))}
          </select>
        )}
        <span className="book-hint">Листайте мышью за угол страницы или стрелками</span>
      </div>
    </div>,
    document.body
  )
}
