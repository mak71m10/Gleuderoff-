import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type BeltData = NonNullable<Entry['base']['belt']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))

/**
 * «Терем Матерей» Креццаки: пятиярусный деревянный терем, на ярусах — Матери рода по старшинству (по годам), наверху — покрывало
 * Старшей Матери и красный Пояс с семью узлами. Ползунок 979–1010; переключатель «правда мастера» показывает, кто на самом деле за покрывалом.
 */
export function BeltView({ data, onOpen }: { data: BeltData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(1010)
  const [truth, setTruth] = useState(false)
  const [tab, setTab] = useState<'terem' | 'princes'>('terem')
  const eldest = data.eldest.find((e) => e.from <= year && (e.to === null || e.to > year))
  const prince = data.princes.find((p) => p.from <= year && (p.to === null || p.to > year))
  const knots = [...data.knotsByYear].reverse().find((k) => k.year <= year)?.left ?? data.knots
  // лестница: кто жив в этот год и старше шестидесяти; в «правде» Ядвига мертва с 1009.8, а Лаэс — по годам старше всех
  const alive = data.ladder.filter((m) => m.born <= year - 60 && !(truth && year >= 1009.8 && m.id === 'lore-kc-jadwiga') && !(m.id === 'lore-kc-laes' && year < 990))
  const guestOf = (m: { branch: string }) => /пришлая/.test(m.branch)
  // при Совете пришлая стоит последней (Лесной год не пройден); в «правде» — строго по годам
  const ordered = [...alive].sort((a, b) => (truth ? 0 : Number(guestOf(a)) - Number(guestOf(b))) || a.born - b.born)
  const byLaw = ordered[0]
  const tiers = ordered.slice(0, 7)
  const W = 420, H = 330
  return (
    <div className="blt">
      <div className="blt-head">
        <div>
          <small>Терем Матерей в {year} г.</small>
          <b>{prince ? `Князь ${prince.name}` : 'Пояс в Тереме'} · узлов {knots} из {data.knots}</b>
        </div>
        <div className={`blt-status ${truth && year >= 1009.8 ? 'hot' : year >= 1009.8 ? 'edge' : 'calm'}`}>
          {truth && year >= 1009.8 ? <>⚠ За покрывалом не Ядвига: по годам Старшая — {byLaw?.name}</> : year >= 1009.8 ? <>❗ Старшая Мать говорит только из-за покрывала</> : <>Старшая Мать — {eldest?.name.split(' ')[0] ?? '—'}</>}
        </div>
      </div>
      <div className="blt-tabs">
        {([['terem', 'Терем'], ['princes', 'Князья и Пояс']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        <label className="blt-truth"><input type="checkbox" checked={truth} onChange={(e) => setTruth(e.target.checked)} /> правда мастера</label>
      </div>

      {tab === 'terem' && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="blt-svg">
            <rect x="0" y="0" width={W} height={H} rx="8" className="blt-bg" />
            {/* шатёр и покрывало */}
            <path d={`M150 52 L210 8 L270 52z`} className="blt-roof" />
            <rect x="166" y="52" width="88" height="30" className={`blt-veil ${truth && year >= 1009.8 ? 'open' : ''}`} />
            <text x="210" y="71" textAnchor="middle" className="blt-vt">{truth && year >= 1009.8 ? 'Вера, сестра' : eldest ? eldest.name.split(' ')[0] : '—'}</text>
            {/* пояс с узлами */}
            <path d="M120 92 Q210 104 300 92" className="blt-belt" />
            {Array.from({ length: data.knots }, (_, i) => <circle key={i} cx={138 + i * 24} cy={95 + Math.sin((i / 6) * Math.PI) * 5} r="4.5" className={i < knots ? 'blt-knot' : 'blt-knot off'} />)}
            {tiers.map((m, i) => {
              const w = 140 + i * 34, x = 210 - w / 2, y = 112 + i * 30
              const age = Math.floor(year - m.born)
              const top = m === byLaw
              const guest = guestOf(m)
              return (
                <g key={m.id} className="blt-tier" onClick={() => onOpen(m.id)}>
                  <rect x={x} y={y} width={w} height="26" rx="3" className={`blt-floor ${top ? 'top' : ''} ${guest ? 'guest' : ''}`} />
                  <text x={x + 8} y={y + 17} className="blt-name">{i + 1}. {m.name}</text>
                  <text x={x + w - 8} y={y + 17} textAnchor="end" className="blt-age">{age} лет · {m.branch.split(' ')[0]}</text>
                </g>
              )
            })}
            {tiers.length === 0 && <text x="210" y="160" textAnchor="middle" className="blt-axis">Матерей старше шестидесяти ещё нет в записях</text>}
          </svg>
          <div className="blt-slider"><span>979</span><input type="range" min={979} max={1010} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1010</span></div>
          <ul className="blt-notes">{tiers.slice(0, 3).map((m) => <li key={m.id}><b>{m.name}</b> — {m.note}</li>)}</ul>
        </>
      )}

      {tab === 'princes' && (
        <div className="blt-list">
          {data.princes.map((p) => (
            <button key={p.id} className="blt-card" onClick={() => onOpen(p.id)}>
              <span className="blt-face">{img.get(p.id) ? <img src={assetUrl(img.get(p.id)!)} alt="" /> : p.name[0]}</span>
              <span><b>{p.name}</b><small>{Math.floor(p.from)}–{p.to ? Math.floor(p.to) : 'ныне'} · {p.end === 'belt' ? 'Пояс снят' : p.end === 'death' ? 'умер' : 'правит'}</small><small>{p.note}</small></span>
            </button>
          ))}
          {data.eldest.map((e) => (
            <button key={e.id} className="blt-card mother" onClick={() => onOpen(e.id)}>
              <span className="blt-face">{img.get(e.id) ? <img src={assetUrl(img.get(e.id)!)} alt="" /> : e.name[0]}</span>
              <span><b>{e.name}</b><small>Старшая Мать {Math.floor(e.from)}–{e.to ? Math.floor(e.to) : 'ныне'}</small><small>{e.note}</small></span>
            </button>
          ))}
        </div>
      )}
      <ul className="blt-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
