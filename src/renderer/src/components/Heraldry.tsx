import { useId, useState, type ReactNode } from 'react'
import type { FlagLayout, Heraldry, WorldState } from '../types'
import { Button, Modal } from './ui'

/** Эмблемы в поле 100×100. fg — цвет эмблемы, bg — цвет поля (для прорезей вроде глаза). */
export const EMBLEMS: Record<string, { label: string; draw: (fg: string, bg: string) => ReactNode }> = {
  none: { label: 'Без эмблемы', draw: () => null },
  dragon: {
    label: 'Дракон',
    draw: (fg, bg) => (
      <g fill={fg}>
        <path d="M53 47C55 33 60 20 71 6c0 10 3 14 10 7-1 10 3 14 11 10-5 9-3 16 3 21-10 0-18 5-28 11z" />
        <path d="M44 55c-5-8-8-16-6-23-3-1-6-1-9 0l-12 3 10-5.5 2-2-16-3.5 2-3.5 16-3.5c2-4 6-6 10-6l4-9 1 9 9-6-5 9c3 4 3 8 1 12 4 6 6 15 7 24z" />
        <path d="M51 26l6-3-3 6zM54 34l6-2-3 6zM57 42l6-1-4 5z" />
        <path d="M41 52c12-10 29-3 29 10 0 10-8 17-19 15-9-2-13-10-10-19z" />
        <path d="M64 72c12 4 18 16 8 23-8 5-19 0-15-8 2 5 10 5 11-1 1-5-6-8-11-10z" />
        <path d="M57 87l-7-3 3 7zM44 59l-10-3-6 3-4-2v5l5 1 5-2 7 5zM53 75l-3 10-6 3-2 5 6-2 3 3 5-8 4-9zM60 63l-7 5h-6l-2 4 6-1 3 3 8-6z" />
        <circle cx="37" cy="16.5" r="1.7" fill={bg} />
      </g>
    )
  },
  'sun-eye': {
    label: 'Солнце с глазом',
    draw: (fg, bg) => (
      <g>
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} fill={fg} d="M50 6l5 18h-10z" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="22" fill={fg} />
        <path fill={bg} d="M30 50c8-11 32-11 40 0-8 11-32 11-40 0z" />
        <circle cx="50" cy="50" r="6" fill={fg} />
      </g>
    )
  },
  chalice: {
    label: 'Чаша',
    draw: (fg) => <path fill={fg} d="M26 16h48c0 22-8 34-19 38v14c6 2 14 6 16 14H29c2-8 10-12 16-14V54C34 50 26 38 26 16z" />
  },
  chain: {
    label: 'Разорванная цепь',
    draw: (fg) => (
      <g fill="none" stroke={fg} strokeWidth="7" strokeLinecap="round">
        <rect x="14" y="40" width="26" height="20" rx="10" />
        <path d="M46 50h-6M52 38c4-6 12-6 16 0M52 62c4 6 12 6 16 0" />
        <rect x="62" y="40" width="26" height="20" rx="10" />
      </g>
    )
  },
  crown: { label: 'Корона', draw: (fg) => <path fill={fg} d="M14 72h72l4-44-20 16-20-26-20 26-20-16zM14 78h72v8H14z" /> },
  sword: {
    label: 'Меч',
    draw: (fg) => <path fill={fg} d="M47 8h6l3 56h-12zM30 64h40v6H30zM46 70h8v14h-8zM42 84h16v6H42z" />
  },
  swords: {
    label: 'Скрещённые мечи',
    draw: (fg) => (
      <g fill={fg}>
        <path d="M47 8h6l3 56h-12zM30 64h40v6H30zM46 70h8v18h-8z" transform="rotate(35 50 50)" />
        <path d="M47 8h6l3 56h-12zM30 64h40v6H30zM46 70h8v18h-8z" transform="rotate(-35 50 50)" />
      </g>
    )
  },
  tower: { label: 'Башня', draw: (fg) => <path fill={fg} d="M28 88V36h-4V16h10v8h8v-8h16v8h8v-8h10v20h-4v52H58V68a8 8 0 00-16 0v20z" /> },
  tree: {
    label: 'Древо',
    draw: (fg) => <path fill={fg} d="M50 8c18 0 30 12 30 26 0 12-8 20-18 22h-6v26h10v6H34v-6h10V56h-6C28 54 20 46 20 34 20 20 32 8 50 8z" />
  },
  wave: {
    label: 'Волны',
    draw: (fg) => (
      <g fill="none" stroke={fg} strokeWidth="7" strokeLinecap="round">
        {[34, 52, 70].map((y) => (
          <path key={y} d={`M10 ${y}q10-12 20 0t20 0 20 0 20 0`} />
        ))}
      </g>
    )
  },
  star: { label: 'Звезда', draw: (fg) => <path fill={fg} d="M50 8l11 30h32L67 57l10 31-27-19-27 19 10-31L7 38h32z" /> },
  moon: { label: 'Полумесяц', draw: (fg) => <path fill={fg} d="M62 10a40 40 0 100 80 32 32 0 010-80z" /> },
  skull: {
    label: 'Череп',
    draw: (fg, bg) => (
      <g>
        <path fill={fg} d="M50 10c20 0 32 14 32 32 0 10-4 16-10 20v14H28V62c-6-4-10-10-10-20 0-18 12-32 32-32z" />
        <circle cx="38" cy="44" r="8" fill={bg} />
        <circle cx="62" cy="44" r="8" fill={bg} />
        <path fill={bg} d="M46 58h8l-4 8zM36 70h4v6h-4zM48 70h4v6h-4zM60 70h4v6h-4z" />
      </g>
    )
  },
  hammer: { label: 'Молот', draw: (fg) => <path fill={fg} d="M22 14h56v24H22zM45 38h10v50H45z" /> },
  axe: { label: 'Топор', draw: (fg) => <path fill={fg} d="M46 10h8v80h-8zM54 18c18 2 30 14 30 30S72 76 54 78z" /> },
  flame: { label: 'Пламя', draw: (fg) => <path fill={fg} d="M50 6c4 16 24 24 24 48a24 24 0 01-48 0c0-12 8-18 10-28 4 8 6 12 10 14 2-14-2-22 4-34z" /> },
  rose: {
    label: 'Роза',
    draw: (fg, bg) => (
      <g>
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx="50" cy="28" r="18" fill={fg} transform={`rotate(${i * 72} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="12" fill={bg} />
        <circle cx="50" cy="50" r="7" fill={fg} />
      </g>
    )
  },
  cross: { label: 'Крест', draw: (fg) => <path fill={fg} d="M42 10h16v28h28v16H58v36H42V54H14V38h28z" /> },
  key: { label: 'Ключ', draw: (fg, bg) => <g><circle cx="50" cy="26" r="16" fill={fg} /><circle cx="50" cy="26" r="7" fill={bg} /><path fill={fg} d="M45 40h10v50H45zM55 70h12v7H55zM55 82h8v7h-8z" /></g> },
  anchor: {
    label: 'Якорь',
    draw: (fg) => (
      <g fill="none" stroke={fg} strokeWidth="7" strokeLinecap="round">
        <circle cx="50" cy="18" r="7" />
        <path d="M50 25v60M34 38h32M18 58c4 18 18 28 32 28s28-10 32-28" />
      </g>
    )
  },
  ship: { label: 'Корабль', draw: (fg) => <path fill={fg} d="M48 8h4v50h-4zM52 12l26 38H52zM44 18L24 50h20zM12 62h76l-12 20H24z" /> },
  mountain: { label: 'Горы', draw: (fg) => <path fill={fg} d="M6 84l30-50 14 22 12-20 32 48z" /> },
  book: { label: 'Книга', draw: (fg, bg) => <g><path fill={fg} d="M10 22c14-6 28-6 40 4 12-10 26-10 40-4v60c-14-6-28-6-40 4-12-10-26-10-40-4z" /><path stroke={bg} strokeWidth="3" d="M50 26v58" /></g> },
  eagle: {
    label: 'Орёл',
    draw: (fg) => <path fill={fg} d="M50 18l6 6-2 6 30-14-8 20 14-2-18 16H58l6 26-14-8-14 8 6-26H28L10 34l14 2-8-20 30 14-2-6z" />
  },
  wolf: { label: 'Волк', draw: (fg) => <path fill={fg} d="M24 12l14 18h24l14-18 4 34-12 16-8 22-10 6-10-6-8-22-12-16z" /> },
  scales: {
    label: 'Весы',
    draw: (fg) => (
      <g fill={fg}>
        <path d="M47 14h6v68h-6zM30 82h40v6H30zM18 26h64v5H18z" />
        <path d="M14 56h24l-12-24zM62 56h24L74 32z" />
      </g>
    )
  }
}

export const LAYOUTS: { value: FlagLayout; label: string }[] = [
  { value: 'plain', label: 'Одноцветный' },
  { value: 'bicolor-h', label: 'Две полосы ═' },
  { value: 'bicolor-v', label: 'Две полосы ║' },
  { value: 'tricolor-h', label: 'Триколор ═' },
  { value: 'tricolor-v', label: 'Триколор ║' },
  { value: 'cross', label: 'Северный крест' },
  { value: 'saltire', label: 'Андреевский крест' },
  { value: 'border', label: 'Кайма' },
  { value: 'chevron', label: 'Шеврон' },
  { value: 'quarters', label: 'Четверти' },
  { value: 'diagonal', label: 'Диагональ' }
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`
}

const METALS = ['#d9a521', '#f1ece0', '#c9ccd2']
const RANDOM_EMBLEMS = ['crown', 'sword', 'tower', 'tree', 'star', 'moon', 'eagle', 'wolf', 'mountain', 'swords', 'rose', 'key', 'axe', 'hammer', 'flame', 'scales']

/** Стабильный «случайный» флаг для государства без своего — от id и цвета на карте. */
export function defaultHeraldry(st: WorldState, color: string): Heraldry {
  const h = hash(st.id)
  const metal = METALS[h % METALS.length]
  const layouts: FlagLayout[] = ['plain', 'bicolor-h', 'bicolor-v', 'tricolor-h', 'tricolor-v', 'cross', 'border', 'chevron', 'diagonal', 'quarters']
  return {
    layout: layouts[(h >>> 3) % layouts.length],
    colors: [color, shade(color, -0.45), metal],
    emblem: RANDOM_EMBLEMS[(h >>> 7) % RANDOM_EMBLEMS.length],
    emblemColor: metal
  }
}

function Field({ h, w, hgt }: { h: Heraldry; w: number; hgt: number }) {
  const [a, b = shade(a, -0.4), c = '#d9a521'] = h.colors
  switch (h.layout) {
    case 'bicolor-h':
      return <><rect width={w} height={hgt} fill={a} /><rect y={hgt / 2} width={w} height={hgt / 2} fill={b} /></>
    case 'bicolor-v':
      return <><rect width={w} height={hgt} fill={a} /><rect x={w / 2} width={w / 2} height={hgt} fill={b} /></>
    case 'tricolor-h':
      return <><rect width={w} height={hgt} fill={a} /><rect y={hgt / 3} width={w} height={hgt / 3} fill={b} /><rect y={(hgt * 2) / 3} width={w} height={hgt / 3} fill={c} /></>
    case 'tricolor-v':
      return <><rect width={w} height={hgt} fill={a} /><rect x={w / 3} width={w / 3} height={hgt} fill={b} /><rect x={(w * 2) / 3} width={w / 3} height={hgt} fill={c} /></>
    case 'cross':
      return <><rect width={w} height={hgt} fill={a} /><rect x={w * 0.3} width={hgt * 0.18} height={hgt} fill={c} /><rect y={hgt * 0.41} width={w} height={hgt * 0.18} fill={c} /></>
    case 'saltire':
      return (
        <>
          <rect width={w} height={hgt} fill={a} />
          <path d={`M0 0L${w} ${hgt}M${w} 0L0 ${hgt}`} stroke={c} strokeWidth={hgt * 0.16} />
        </>
      )
    case 'border':
      return <><rect width={w} height={hgt} fill={b} /><rect x={hgt * 0.1} y={hgt * 0.1} width={w - hgt * 0.2} height={hgt * 0.8} fill={a} /></>
    case 'chevron':
      return <><rect width={w} height={hgt} fill={a} /><path d={`M0 0L${w * 0.45} ${hgt / 2}L0 ${hgt}z`} fill={b} /></>
    case 'quarters':
      return (
        <>
          <rect width={w} height={hgt} fill={a} />
          <rect x={w / 2} width={w / 2} height={hgt / 2} fill={b} />
          <rect y={hgt / 2} width={w / 2} height={hgt / 2} fill={b} />
        </>
      )
    case 'diagonal':
      return <><rect width={w} height={hgt} fill={a} /><path d={`M${w} 0V${hgt}H0z`} fill={b} /></>
    default:
      return <rect width={w} height={hgt} fill={a} />
  }
}

/** Флаг 3:2 */
export function Flag({ heraldry, width = 120 }: { heraldry: Heraldry; width?: number }) {
  const W = 150
  const Hh = 100
  const em = EMBLEMS[heraldry.emblem] ?? EMBLEMS.none
  const plainBg = heraldry.colors[0]
  return (
    <svg className="flag-svg" width={width} height={(width * Hh) / W} viewBox={`0 0 ${W} ${Hh}`}>
      <Field h={heraldry} w={W} hgt={Hh} />
      <g transform={`translate(${W / 2 - 34} ${Hh / 2 - 34}) scale(0.68)`}>{em.draw(heraldry.emblemColor, plainBg)}</g>
      <rect width={W} height={Hh} fill="url(#flag-sheen)" />
      <defs>
        <linearGradient id="flag-sheen" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Герб на геральдическом щите */
export function CoatOfArms({ heraldry, size = 90 }: { heraldry: Heraldry; size?: number }) {
  const clip = useId().replace(/:/g, '')
  const em = EMBLEMS[heraldry.emblem] ?? EMBLEMS.none
  const shield = 'M10 6H90V46C90 72 72 88 50 96C28 88 10 72 10 46Z'
  return (
    <svg className="coa-svg" width={size} height={size * 1.05} viewBox="0 0 100 105">
      <defs>
        <clipPath id={clip}>
          <path d={shield} />
        </clipPath>
        <linearGradient id={`${clip}-g`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Field h={heraldry} w={100} hgt={100} />
        <g transform="translate(22 18) scale(0.56)">{em.draw(heraldry.emblemColor, heraldry.colors[0])}</g>
        <rect width="100" height="100" fill={`url(#${clip}-g)`} />
      </g>
      <path d={shield} fill="none" stroke="#c9a45c" strokeWidth="3.5" />
      <path d={shield} fill="none" stroke="#2a1d0a" strokeWidth="1" transform="translate(50 51) scale(0.9) translate(-50 -51)" />
    </svg>
  )
}

export function HeraldryEditor({ value, onSave, onClose }: { value: Heraldry; onSave: (h: Heraldry) => void; onClose: () => void }) {
  const [h, setH] = useState<Heraldry>({ ...value, colors: [...value.colors, '#000000', '#000000', '#000000'].slice(0, 3) })
  const setColor = (i: number, c: string): void => setH({ ...h, colors: h.colors.map((x, j) => (j === i ? c : x)) })
  return (
    <Modal onClose={onClose}>
      <div className="heraldry-editor">
        <h2>Флаг и герб</h2>
        <div className="he-preview">
          <Flag heraldry={h} width={240} />
          <CoatOfArms heraldry={h} size={130} />
        </div>
        <div className="field-label">Рисунок поля</div>
        <div className="he-layouts">
          {LAYOUTS.map((l) => (
            <button key={l.value} className={h.layout === l.value ? 'active' : ''} onClick={() => setH({ ...h, layout: l.value })} title={l.label}>
              <Flag heraldry={{ ...h, layout: l.value, emblem: 'none' }} width={54} />
            </button>
          ))}
        </div>
        <div className="he-colors">
          {['Основной', 'Второй', 'Третий'].map((label, i) => (
            <label key={i} className="field color-field">
              <span className="field-label">{label} цвет</span>
              <input type="color" value={h.colors[i]} onChange={(e) => setColor(i, e.target.value)} />
            </label>
          ))}
          <label className="field color-field">
            <span className="field-label">Цвет эмблемы</span>
            <input type="color" value={h.emblemColor} onChange={(e) => setH({ ...h, emblemColor: e.target.value })} />
          </label>
        </div>
        <div className="field-label">Эмблема</div>
        <div className="he-emblems">
          {Object.entries(EMBLEMS).map(([key, em]) => (
            <button key={key} className={h.emblem === key ? 'active' : ''} onClick={() => setH({ ...h, emblem: key })} title={em.label}>
              <svg viewBox="0 0 100 100" width="34" height="34">
                {em.draw('#e8cd8e', '#171b22')}
              </svg>
            </button>
          ))}
        </div>
        <div className="row he-actions">
          <Button variant="primary" icon="shield" onClick={() => { onSave({ ...h }); onClose() }}>
            Сохранить
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </Modal>
  )
}
