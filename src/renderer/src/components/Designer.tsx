import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { formatDate } from '../calendar'
import { GOOD, fmtMarks, type Good } from '../economy'
import { ARM, ARMS, KIT, PART, PARTS, SLOTS, STATS, companyPower, companyStats, type Company, type CompanyTemplate, type Mods, type Part, type Slot, type Stat, type StateMilitary } from '../military'
import { rearmCost, rearmDays } from '../orders'
import type { WorldState } from '../types'

// ---------- значки деталей ----------
const ICON: Record<string, string> = {
  club: '🪵', spear: '🔱', pike: '🔱', sword: '🗡', gladius: '🗡', axe: '🪓', daneaxe: '🪓', halberd: '⚔', glaive: '⚔', zweih: '⚔', mace: '🔨', flail: '⛓', scythe: '🌙',
  elfblade: '🗡', runeaxe: '🪓', sabre: '🗡', lance: '🔱', warlance: '🔱', javelin: '➶', shortbow: '🏹', longbow: '🏹', compbow: '🏹', elfbow: '🏹', sling: '🪨',
  xbow: '🎯', heavyxbow: '🎯', gnomexbow: '⚙', handgonne: '💥', arquebus: '💥', musket: '💥', blunder: '💥', rockets: '🎆', ballista: '🏹', trebuchet: '🪨',
  bombard: '🧨', culverin: '🧨', falconet: '🧨', firestaff: '🔥', wards: '✨',
  none: '👕', hide: '🐻', gambeson: '🧥', lamellar: '🦺', mail: '⛓', scale: '🐟', lorica: '🛡', brigandine: '🦺', halfplate: '🛡', plate: '🛡', gothic: '🛡',
  runeplate: '✨', elfmail: '🍃', barding: '🐎', robes: '👘', bark: '🌳',
  noshield: '✋', buckler: '🔘', round: '🛡', kite: '🛡', scutum: '🟥', pavise: '🧱', tower: '🧱', runeshield: '✨', wicker: '🧺',
  nomount: '🚶', pony: '🐴', steppe: '🐎', riding: '🐎', warhorse: '🐎', destrier: '🐎', camel: '🐪', wolf: '🐺', boar: '🐗', elk: '🫎', stag: '🦌', lizard: '🦎',
  levy: '🌾', trained: '🎖', veteran: '🏅', guard: '👑',
  loose: '⋯', close: '▦', shieldwall: '🧱', wedge: '🔺', testudo: '🐢', square: '⬛', tercio: '▩', phalanx: '🔱', manipular: '▤', skirmish: '✳', volley: '🎯',
  caracole: '🌀', charge: '➤', swarm: '🌀', wagenburg: '🛞', ambush: '🌿', boarding: '⚓', circle: '⭕',
  nobanner: '—', company: '🚩', house: '🏳', holy: '☀', legend: '📜', eagle: '🦅',
  light: '🎒', normal: '🛒', full: '🛻', wagons: '🛞', forager: '🌾', river: '🛶'
}
const SLOT_ICON: Record<Slot, string> = { weapon: '⚔', armor: '🛡', shield: '🛡', mount: '🐎', training: '🎖', formation: '▦', banner: '🚩', train: '🛒' }
const sign = (v: number): string => (v > 0 ? `+${v}` : `${v}`)
const statName = (k: string): string => STATS.find((s) => s.key === k)?.name.toLowerCase() ?? k

// ---------- рисунок воина ----------
const ARMOR_COLOR: Record<string, string> = { none: '#a8865e', hide: '#7a5532', gambeson: '#cdbb8c', lamellar: '#8a6a3a', mail: '#9aa0a6', scale: '#8f9466', lorica: '#b8903c', brigandine: '#6a4a3a', halfplate: '#b9bec6', plate: '#d2d6dc', gothic: '#e2e6ea', runeplate: '#8aa6c8', elfmail: '#9ac0a0', barding: '#9aa0a6', robes: '#5a3a6a', bark: '#6a5a3a' }
const MOUNT_COLOR: Record<string, string> = { pony: '#a07850', steppe: '#8a6038', riding: '#7a5028', warhorse: '#4a3020', destrier: '#2a1c14', camel: '#c8a068', wolf: '#7a7a80', boar: '#4a3428', elk: '#6a4a2a', stag: '#e8e4d8', lizard: '#5a7a4a' }
const HEAVY = new Set(['halfplate', 'plate', 'gothic', 'runeplate'])

export function Soldier({ t, c1, c2, size = 220 }: { t: CompanyTemplate; c1: string; c2: string; size?: number }) {
  const p = t.parts
  const mount = p.mount && p.mount !== 'nomount' ? p.mount : null
  const armor = p.armor ?? 'none', shield = p.shield ?? 'noshield', weapon = p.weapon ?? '', banner = p.banner ?? 'nobanner'
  const ac = ARMOR_COLOR[armor] ?? '#a8865e'
  const dy = mount ? -34 : 0 // всадник выше
  const steel = '#c8ccd2', wood = '#6a4424', dark = '#2a1c10'
  const W = weapon
  return (
    <svg viewBox="0 0 160 190" width={size} height={(size * 190) / 160} className="ds-soldier">
      <defs>
        <radialGradient id="ds-glow" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#f6dc8f" stopOpacity=".18" /><stop offset="1" stopColor="#f6dc8f" stopOpacity="0" /></radialGradient>
        <linearGradient id="ds-steel" x1="0" x2="1"><stop offset="0" stopColor="#8a9098" /><stop offset=".5" stopColor="#eef1f4" /><stop offset="1" stopColor="#8a9098" /></linearGradient>
      </defs>
      <circle cx="80" cy="90" r="80" fill="url(#ds-glow)" />
      <ellipse cx="80" cy="178" rx={mount ? 58 : 34} ry="7" fill="#000" opacity=".35" />
      {/* знамя за спиной */}
      {banner !== 'nobanner' && (
        <g>
          <line x1="112" y1={168 + dy} x2="112" y2={18 + dy} stroke={wood} strokeWidth="3" />
          {banner === 'eagle' ? (
            <g><path d={`M100 ${24 + dy} Q112 ${10 + dy} 124 ${24 + dy} Q118 ${20 + dy} 112 ${26 + dy} Q106 ${20 + dy} 100 ${24 + dy} Z`} fill="#d8b040" /><rect x="104" y={28 + dy} width="16" height="20" fill={c1} stroke="#d8b040" /></g>
          ) : (
            <path d={`M114 ${20 + dy} L146 ${24 + dy} L${banner === 'legend' ? 138 : 146} ${36 + dy} L146 ${48 + dy} L114 ${46 + dy} Z`} fill={c1} stroke={c2} strokeWidth="1.5" />
          )}
          {banner === 'holy' && <circle cx="130" cy={34 + dy} r="5" fill="#f6dc8f" />}
          {banner === 'house' && <path d={`M124 ${28 + dy} l6 6 l-6 6 l-6 -6 Z`} fill={c2} />}
        </g>
      )}
      {/* конь или зверь */}
      {mount && (
        <g fill={MOUNT_COLOR[mount] ?? '#6a4a2a'}>
          <ellipse cx="80" cy="132" rx="46" ry="18" />
          <rect x="44" y="140" width="7" height="32" rx="3" /><rect x="58" y="142" width="7" height="30" rx="3" /><rect x="96" y="142" width="7" height="30" rx="3" /><rect x="110" y="140" width="7" height="32" rx="3" />
          <path d={mount === 'camel' ? 'M118 128 Q132 96 140 92 L146 96 Q140 104 128 134 Z' : mount === 'lizard' ? 'M120 128 Q138 118 150 122 L150 128 Q136 130 122 138 Z' : 'M116 124 Q128 102 138 96 L148 102 Q140 112 128 134 Z'} />
          {mount === 'camel' && <ellipse cx="72" cy="112" rx="12" ry="9" />}
          {(mount === 'elk' || mount === 'stag') && <path d="M138 96 l-6 -14 m6 14 l6 -14 m-9 4 l-6 -4 m12 4 l6 -4" stroke={mount === 'stag' ? '#d8c890' : '#8a6a3a'} strokeWidth="2.5" fill="none" />}
          {mount === 'boar' && <path d="M146 104 l6 -3" stroke="#eee" strokeWidth="2" />}
          {mount !== 'lizard' && mount !== 'camel' && <path d="M36 128 Q26 140 30 156" stroke={MOUNT_COLOR[mount] ?? '#6a4a2a'} strokeWidth="5" fill="none" />}
          {armor === 'barding' || t.arm === 'heavycav' ? <path d="M40 124 Q80 112 122 124 L118 146 Q80 152 42 146 Z" fill={c1} opacity=".9" stroke={c2} strokeWidth="1.5" /> : <path d="M66 116 L94 116 L92 128 L68 128 Z" fill={c1} />}
        </g>
      )}
      <g transform={`translate(0 ${dy})`}>
        {/* ноги (у пеших) */}
        {!mount && (<>
          <rect x="68" y="130" width="10" height="42" rx="3" fill={HEAVY.has(armor) ? 'url(#ds-steel)' : '#5a4030'} />
          <rect x="82" y="130" width="10" height="42" rx="3" fill={HEAVY.has(armor) ? 'url(#ds-steel)' : '#5a4030'} />
        </>)}
        {/* туловище и доспех */}
        {armor === 'robes'
          ? <path d="M62 78 L98 78 L108 172 L52 172 Z" fill={ac} stroke={c2} strokeWidth="1.5" />
          : <path d="M62 78 Q80 72 98 78 L100 134 Q80 140 60 134 Z" fill={HEAVY.has(armor) ? 'url(#ds-steel)' : ac} stroke={dark} strokeWidth="1" />}
        {armor === 'mail' && <path d="M64 84 h32 M64 92 h32 M64 100 h32 M64 108 h32 M64 116 h32 M64 124 h32" stroke="#6a7078" strokeWidth="1" strokeDasharray="2 2" />}
        {armor === 'scale' && <path d="M64 88 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 M64 100 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 M64 112 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0" stroke="#5a6040" fill="none" />}
        {(armor === 'lamellar' || armor === 'lorica') && <path d="M62 90 h36 M62 102 h36 M62 114 h36" stroke="#6a4a1a" strokeWidth="2.5" />}
        {armor === 'brigandine' && [86, 98, 110, 122].map((y) => [68, 76, 84, 92].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#d8b040" />))}
        {armor === 'runeplate' && <path d="M74 92 l6 10 l6 -10 M72 112 h16" stroke="#7ad0ff" strokeWidth="2" />}
        {armor !== 'robes' && armor !== 'none' && <path d="M60 128 h40" stroke={c1} strokeWidth="5" />}
        {armor === 'none' && <path d="M62 96 h36 v20 h-36 Z" fill={c1} opacity=".85" />}
        {/* руки */}
        <path d="M62 82 Q48 96 52 116" stroke={HEAVY.has(armor) ? '#b9bec6' : ac} strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M98 82 Q114 92 112 112" stroke={HEAVY.has(armor) ? '#b9bec6' : ac} strokeWidth="9" strokeLinecap="round" fill="none" />
        {/* голова и шлем */}
        <circle cx="80" cy="62" r="13" fill="#e0b894" />
        {HEAVY.has(armor) ? <path d="M66 62 Q66 44 80 44 Q94 44 94 62 L94 70 L66 70 Z" fill="url(#ds-steel)" stroke={dark} /> :
          ['mail', 'scale', 'lamellar', 'brigandine'].includes(armor) ? <path d="M66 60 Q66 46 80 46 Q94 46 94 60 Z" fill="#9aa0a6" stroke={dark} /> :
          armor === 'lorica' ? <g><path d="M66 60 Q66 46 80 46 Q94 46 94 60 Z" fill="#c8a040" /><path d="M72 46 Q80 32 88 46" fill="#b02020" /></g> :
          armor === 'gambeson' ? <path d="M67 58 Q68 48 80 48 Q92 48 93 58 Z" fill="#cdbb8c" /> :
          armor === 'robes' ? <path d="M64 66 Q64 44 80 44 Q96 44 96 66 Q88 56 80 56 Q72 56 64 66 Z" fill={ac} /> :
          <path d="M68 56 Q70 48 80 48 Q90 48 92 56 Q86 52 80 52 Q74 52 68 56 Z" fill="#5a3a20" />}
        {HEAVY.has(armor) && <path d="M70 62 h20" stroke={dark} strokeWidth="2" />}
        {/* оружие в правой руке (справа на рисунке) */}
        <g stroke={wood} strokeWidth="3" strokeLinecap="round" fill="none">
          {['spear', 'pike', 'lance', 'warlance', 'halberd', 'glaive', 'scythe'].includes(W) && <line x1="112" y1={W === 'pike' ? 4 : 20} x2="112" y2="176" />}
          {['spear', 'pike', 'lance', 'warlance'].includes(W) && <path d={`M108 ${W === 'pike' ? 12 : 28} L112 ${W === 'pike' ? -2 : 12} L116 ${W === 'pike' ? 12 : 28} Z`} fill={steel} stroke="none" />}
          {W === 'halberd' && <path d="M112 26 l14 4 l-4 12 l-10 -4 Z M112 18 l0 -6" fill={steel} stroke={steel} />}
          {W === 'glaive' && <path d="M112 20 q14 6 6 26 l-6 -8 Z" fill={steel} stroke="none" />}
          {W === 'scythe' && <path d="M112 22 q20 -2 26 14 q-12 -8 -26 -6 Z" fill={steel} stroke="none" />}
          {['sword', 'gladius', 'elfblade', 'zweih', 'sabre'].includes(W) && <g><line x1="112" y1="112" x2="112" y2="118" /><path d={W === 'sabre' ? 'M112 112 Q126 80 118 54' : `M112 112 L112 ${W === 'zweih' ? 40 : W === 'gladius' ? 84 : 66}`} stroke={steel} strokeWidth={W === 'zweih' ? 5 : 4} /><line x1="104" y1="112" x2="120" y2="112" stroke="#d8b040" /></g>}
          {['axe', 'daneaxe', 'runeaxe', 'club'].includes(W) && <g><line x1="112" y1="118" x2="112" y2={W === 'daneaxe' ? 40 : 70} /><path d={`M112 ${W === 'daneaxe' ? 42 : 72} q16 -4 14 14 q-8 -4 -14 -2 Z`} fill={W === 'runeaxe' ? '#8ab0d8' : W === 'club' ? wood : steel} stroke="none" /></g>}
          {['mace', 'flail'].includes(W) && <g><line x1="112" y1="118" x2="112" y2="76" /><circle cx="112" cy={W === 'flail' ? 64 : 72} r="7" fill={steel} stroke={dark} /></g>}
          {['shortbow', 'longbow', 'compbow', 'elfbow'].includes(W) && <g><path d={W === 'compbow' ? 'M114 62 q12 10 4 24 q8 14 -4 24' : `M114 ${W === 'longbow' || W === 'elfbow' ? 40 : 60} Q134 ${W === 'longbow' || W === 'elfbow' ? 88 : 88} 114 ${W === 'longbow' || W === 'elfbow' ? 136 : 116}`} stroke={W === 'elfbow' ? '#d8c890' : wood} /><line x1="114" y1={W === 'longbow' || W === 'elfbow' ? 40 : 60} x2="114" y2={W === 'longbow' || W === 'elfbow' ? 136 : 116} stroke="#ddd" strokeWidth="1" /></g>}
          {['xbow', 'heavyxbow', 'gnomexbow'].includes(W) && <g><line x1="96" y1="104" x2="132" y2="96" stroke={wood} strokeWidth="5" /><path d="M128 84 q6 12 0 24" stroke={steel} strokeWidth="3" />{W === 'gnomexbow' && <circle cx="104" cy="104" r="4" fill="#c8a040" stroke="none" />}</g>}
          {['handgonne', 'arquebus', 'musket', 'blunder'].includes(W) && <g><line x1="94" y1="106" x2={W === 'musket' ? 146 : 136} y2="94" stroke={wood} strokeWidth="5" /><line x1="110" y1="102" x2={W === 'musket' ? 150 : 140} y2="94" stroke="#555" strokeWidth="3" />{W === 'blunder' && <circle cx="140" cy="93" r="4" fill="#555" stroke="none" />}</g>}
          {W === 'javelin' && <g>{[0, 6, 12].map((d) => <line key={d} x1={108 + d} y1="118" x2={116 + d} y2="44" stroke={wood} strokeWidth="2" />)}</g>}
          {W === 'sling' && <path d="M112 112 q8 -16 0 -30" stroke="#8a6a3a" strokeWidth="2" />}
          {W === 'firestaff' && <g><line x1="112" y1="176" x2="112" y2="40" /><circle cx="112" cy="36" r="7" fill="#ff8a2a" stroke="#ffd06a" /></g>}
          {W === 'wards' && <circle cx="80" cy="100" r="44" stroke="#7ad0ff" strokeWidth="1.5" strokeDasharray="4 4" />}
          {W === 'rockets' && <g><line x1="112" y1="120" x2="134" y2="40" stroke="#888" /><path d="M134 40 l-4 -8 l8 2 Z" fill="#ff8a2a" stroke="none" /></g>}
        </g>
        {/* щит в левой руке */}
        {shield !== 'noshield' && (
          shield === 'round' || shield === 'buckler' || shield === 'wicker' || shield === 'runeshield'
            ? <g><circle cx="50" cy="104" r={shield === 'buckler' ? 9 : 18} fill={shield === 'wicker' ? '#a8885a' : c1} stroke={shield === 'runeshield' ? '#7ad0ff' : '#d8b040'} strokeWidth="2.5" /><circle cx="50" cy="104" r="4" fill={steel} />{shield === 'round' && <path d="M32 104 h36" stroke={c2} strokeWidth="4" />}</g>
            : shield === 'kite' ? <g><path d="M34 84 Q50 78 66 84 Q66 116 50 134 Q34 116 34 84 Z" fill={c1} stroke="#d8b040" strokeWidth="2" /><path d="M50 82 V130" stroke={c2} strokeWidth="5" /></g>
            : <g><rect x={shield === 'tower' || shield === 'pavise' ? 28 : 32} y="80" width={shield === 'tower' || shield === 'pavise' ? 40 : 34} height={shield === 'tower' || shield === 'pavise' ? 70 : 60} rx="5" fill={c1} stroke="#d8b040" strokeWidth="2" /><path d={shield === 'scutum' ? 'M49 84 V136 M36 110 H62' : 'M30 114 H66'} stroke={c2} strokeWidth="4" /></g>
        )}
      </g>
      {/* осадные машины и пушки — рядом с расчётом */}
      {['ballista', 'trebuchet', 'bombard', 'culverin', 'falconet'].includes(W) && (
        <g transform="translate(6 132)">
          <circle cx="14" cy="34" r="9" fill="none" stroke={wood} strokeWidth="3" /><circle cx="44" cy="34" r="9" fill="none" stroke={wood} strokeWidth="3" />
          {W === 'trebuchet' ? <path d="M10 30 L48 30 M28 30 L28 -10 M14 -6 L46 4" stroke={wood} strokeWidth="3" /> : W === 'ballista' ? <path d="M8 22 L50 22 M14 8 Q30 30 46 8" stroke={wood} strokeWidth="3" fill="none" /> : <rect x="6" y="16" width="48" height="12" rx="5" fill="#4a4a4a" transform="rotate(-12 30 22)" />}
        </g>
      )}
    </svg>
  )
}

// ---------- паутина характеристик ----------
function Radar({ now, before, size = 230 }: { now: Required<Mods>; before?: Required<Mods>; size?: number }) {
  const n = STATS.length, R = 80, cx = 110, cy = 105
  const pt = (i: number, v: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * (R * v) / 20, cy + Math.sin(a) * (R * v) / 20] }
  const poly = (s: Required<Mods>): string => STATS.map((st, i) => pt(i, s[st.key]).join(',')).join(' ')
  return (
    <svg viewBox="0 0 220 215" width={size} height={(size * 215) / 220} className="ds-radar">
      {[5, 10, 15, 20].map((v) => <polygon key={v} points={STATS.map((_, i) => pt(i, v).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,.08)" />)}
      {STATS.map((_, i) => { const [x, y] = pt(i, 20); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,.08)" /> })}
      {before && <polygon points={poly(before)} fill="rgba(160,160,160,.12)" stroke="#9a9a9a" strokeDasharray="4 3" />}
      <polygon points={poly(now)} fill="rgba(216,176,64,.28)" stroke="#e8c060" strokeWidth="2" />
      {STATS.map((st, i) => { const [x, y] = pt(i, 24.5); const v = now[st.key], d = before ? v - before[st.key] : 0; return (
        <text key={st.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="ds-radar-label">
          {st.name} {v}{d ? <tspan fill={d > 0 ? '#9fd08a' : '#e08a6a'}> {sign(d)}</tspan> : null}
        </text>
      ) })}
    </svg>
  )
}

const modsChips = (m: Mods) => (Object.entries(m) as [Stat, number][]).filter(([, v]) => v).map(([k, v]) => <span key={k} className={`ds-mod ${v > 0 ? 'up' : 'down'}`}>{sign(v)} {statName(k)}</span>)

// ---------- конструктор ----------
export function Designer({ st, m, onOrders }: { st: WorldState; m: StateMilitary; onOrders: () => void }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const edit = (fn: (mm: StateMilitary) => void): void => mutate((w) => { const s = w.states.find((x) => x.id === st.id); if (s?.base.military) fn(s.base.military) })
  const [id, setId] = useState(m.templates[0]?.id ?? '')
  const saved = m.templates.find((t) => t.id === id)
  const [draft, setDraft] = useState<CompanyTemplate | null>(saved ? structuredClone(saved) : null)
  const [slot, setSlot] = useState<Slot | 'kit' | null>('weapon')
  const tech = (st.base.tech?.levels ?? {}) as Record<string, number>
  const her = st.base.heraldry?.colors ?? [st.base.color, '#d8c48a']
  const pickT = (tid: string): void => { setId(tid); const t = m.templates.find((x) => x.id === tid); setDraft(t ? structuredClone(t) : null) }
  const users = useMemo(() => m.companies.filter((c) => c.t === id).length, [m.companies, id])
  if (!draft) return <p className="ew-muted">Нет уставов.</p>
  const sample = (t: CompanyTemplate): Company => ({ id: 'sample', name: '', t: t.id, race: '', region: 'plain', quality: 'common', traits: [], cmd: { name: '', trait: '' }, men: ARM[t.arm]?.men ?? 120, xp: 0, colors: ['#000', '#fff'] })
  const now = companyStats(sample(draft), draft), before = saved ? companyStats(sample(saved), saved) : now
  const lockOf = (req?: Record<string, number>): string | null => { if (!req) return null; const miss = Object.entries(req).filter(([k, v]) => (tech[k] ?? 0) < v); return miss.length ? `нужно: ${miss.map(([k, v]) => `${({ powder: 'порох', gear: 'шестерня', magic: 'магия', sea: 'мореходство', print: 'печать', money: 'деньги', med: 'лекари', steam: 'пар' } as Record<string, string>)[k] ?? k} ${v}`).join(', ')}` : null }
  const fits = (s: Slot): Part[] => PARTS.filter((p) => p.slot === s && (!p.for || p.for.includes(draft.arm)))
  const changed = !!saved && JSON.stringify({ a: saved.arm, p: saved.parts, k: saved.kit, n: saved.name }) !== JSON.stringify({ a: draft.arm, p: draft.parts, k: draft.kit, n: draft.name })
  const gearChanged = !!saved && JSON.stringify({ a: saved.arm, p: saved.parts, k: saved.kit }) !== JSON.stringify({ a: draft.arm, p: draft.parts, k: draft.kit })
  const days = saved && gearChanged ? rearmDays(saved, draft) : 0
  const price = saved && gearChanged ? rearmCost(saved, draft, users) : 0
  const save = (): void => edit((mm) => { const i = mm.templates.findIndex((x) => x.id === draft.id); if (i >= 0) mm.templates[i] = structuredClone(draft); else mm.templates.push(structuredClone(draft)) })
  const rearm = (): void => {
    if (!saved) return
    edit((mm) => {
      const i = mm.templates.findIndex((x) => x.id === draft.id)
      mm.orders = [...(mm.orders ?? []), { id: `o${Date.now().toString(36)}`, kind: 'rearm', from: date, days, cost: price, template: draft.id, old: { arm: saved.arm, parts: structuredClone(saved.parts), kit: [...saved.kit], name: saved.name }, note: `${draft.name} (${users} рот)` }]
      mm.templates[i] = structuredClone(draft)
    })
    onOrders()
  }
  const copy = (): void => { const n = { ...structuredClone(draft), id: `${draft.id}-${Date.now().toString(36)}`, name: `${draft.name} (новый)`, unique: false }; edit((mm) => { mm.templates.push(n) }); setId(n.id); setDraft(n) }
  const setPart = (s: Slot, pid: string | undefined): void => setDraft({ ...draft, parts: { ...draft.parts, [s]: pid } })
  const curPart = (s: Slot): Part | undefined => (draft.parts[s] ? PART[draft.parts[s]!] : undefined)
  const arm = ARM[draft.arm]
  const slotTile = (s: Slot) => {
    if (!fits(s).length) return null
    const p = curPart(s)
    const was = saved?.parts[s] !== draft.parts[s]
    return (
      <button key={s} className={`ds-slot${slot === s ? ' sel' : ''}${was ? ' changed' : ''}`} onClick={() => setSlot(slot === s ? null : s)}>
        <span className="ds-slot-ico">{p ? ICON[p.id] ?? SLOT_ICON[s] : SLOT_ICON[s]}</span>
        <span className="ds-slot-text"><i>{SLOTS.find((x) => x.key === s)?.name}</i><b>{p?.name ?? '—'}</b></span>
      </button>
    )
  }

  return (
    <div className="ds">
      <div className="ds-list">
        {m.templates.map((t) => (
          <button key={t.id} className={t.id === id ? 'sel' : ''} onClick={() => pickT(t.id)}>
            <span>{ARM[t.arm]?.icon}</span><b>{t.name}</b>{t.unique && <i>своё</i>}
          </button>
        ))}
      </div>

      <div className="ds-main">
        <div className="ds-head">
          <input className="mil-name" value={draft.name} disabled={!master} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className="ed-select" value={draft.arm} disabled={!master} onChange={(e) => setDraft({ ...draft, arm: e.target.value })}>
            {ARMS.map((a) => { const l = lockOf(a.req); return <option key={a.key} value={a.key} disabled={!!l}>{a.icon} {a.name}{l ? ` (${l})` : ''}</option> })}
          </select>
        </div>
        <p className="ew-muted small">{arm?.from && `Люди: ${arm.from}. `}По уставу набрано рот: {users}.{draft.note ? ` ${draft.note}.` : ''}</p>

        <div className="ds-stage">
          <div className="ds-col">{(['weapon', 'training', 'formation', 'train'] as Slot[]).map(slotTile)}</div>
          <div className="ds-figure">
            <Soldier t={draft} c1={her[0] ?? st.base.color} c2={her[1] ?? '#d8c48a'} />
            <div className="ds-figure-cap">{arm?.icon} {arm?.name} · {ARM[draft.arm]?.men ?? 120} чел. в роте</div>
          </div>
          <div className="ds-col">{(['armor', 'shield', 'mount', 'banner'] as Slot[]).map(slotTile)}
            <button className={`ds-slot${slot === 'kit' ? ' sel' : ''}`} onClick={() => setSlot(slot === 'kit' ? null : 'kit')}>
              <span className="ds-slot-ico">🎒</span><span className="ds-slot-text"><i>Снаряжение и магия</i><b>{draft.kit.length ? `${draft.kit.length} предм.` : 'нет'}</b></span>
            </button>
          </div>
        </div>

        {slot && slot !== 'kit' && (
          <div className="ds-picker">
            {fits(slot).map((p) => {
              const l = lockOf(p.req), on = draft.parts[slot] === p.id
              return (
                <button key={p.id} className={`ds-card${on ? ' on' : ''}${l ? ' locked' : ''}`} disabled={!master || !!l} onClick={() => setPart(slot, p.id)} title={p.note ?? ''}>
                  <span className="ds-card-ico">{ICON[p.id] ?? SLOT_ICON[slot]}</span>
                  <b>{p.name}</b>
                  <span className="ds-mods">{modsChips(p.mods)}{!Object.values(p.mods).some(Boolean) && <span className="ds-mod">без изменений</span>}</span>
                  <i>{p.cost ? `${sign(p.cost)} мар.` : 'даром'}{l ? ` · ${l}` : ''}</i>
                </button>
              )
            })}
            {master && draft.parts[slot] && <button className="ds-card" onClick={() => setPart(slot, undefined)}><span className="ds-card-ico">✖</span><b>Снять</b></button>}
          </div>
        )}
        {slot === 'kit' && (
          <div className="ds-picker">
            {KIT.map((k) => {
              const l = lockOf(k.req), on = draft.kit.includes(k.id)
              return (
                <button key={k.id} className={`ds-card${on ? ' on' : ''}${l ? ' locked' : ''}${k.magic ? ' magic' : ''}`} disabled={!master || !!l} onClick={() => setDraft({ ...draft, kit: on ? draft.kit.filter((x) => x !== k.id) : [...draft.kit, k.id] })} title={k.note ?? ''}>
                  <span className="ds-card-ico">{k.magic ? '✦' : on ? '✔' : '＋'}</span>
                  <b>{k.name}</b>
                  <span className="ds-mods">{modsChips(k.mods)}</span>
                  <i>{k.cost ? `${sign(k.cost)} мар.` : 'даром'}{l ? ` · ${l}` : ''}</i>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="ds-side">
        <Radar now={now.stats} before={gearChanged ? before.stats : undefined} />
        <div className="ds-sum">
          <div><span>Сила роты</span><b>{companyPower(now.stats, arm?.men ?? 120)}</b>{gearChanged && <em>было {companyPower(before.stats, arm?.men ?? 120)}</em>}</div>
          <div><span>Содержание</span><b>{fmtMarks(now.cost)}</b>{gearChanged && now.cost !== before.cost && <em>было {fmtMarks(before.cost)}</em>}</div>
        </div>
        <div className="chip-list">{Object.entries(now.goods).filter(([, v]) => v! > 0.05).map(([g, v]) => <span key={g} className="chip">{GOOD[g as Good].icon} {v}</span>)}</div>
        {master && (
          <div className="ds-actions">
            {gearChanged && users > 0 ? (
              <>
                <button className="eco-open" onClick={rearm}>⚒ Перевооружить {users} рот</button>
                <p className="ew-muted small">{days} дн., ≈ {fmtMarks(price)}; в переучке до {formatDate(world.calendar, date + days)} — дисциплина −3. <button className="link-btn" onClick={save}>Исправить без переучки</button></p>
              </>
            ) : (
              <button className="eco-open" disabled={!changed && !!saved} onClick={save}>Сохранить устав</button>
            )}
            <button className="link-btn" onClick={copy}>Новый устав из этого</button>
            {changed && <button className="link-btn" onClick={() => saved && setDraft(structuredClone(saved))}>Вернуть как было</button>}
          </div>
        )}
        <p className="ew-muted small">Рота по уставу — с обычным снаряжением, без черт. Каждая настоящая рота ещё получает своё: народ, край набора, качество, черты и опыт.</p>
      </div>
    </div>
  )
}
