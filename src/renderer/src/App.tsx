import logoUrl from './assets/logo.webp'
import { useEffect, useState } from 'react'
import { useStore, type View } from './store'
import { KINDS, KIND_ORDER } from './constants'
import { MapView } from './components/MapView'
import { MapToolbar, LayersPanel, MapModeBar } from './components/MapControls'
import { Inspector } from './components/Inspector'
import { Timeline } from './components/Timeline'
import { StateCard } from './components/StateCard'
import { CodexView, StatesView } from './components/Codex'
import { SettingsView } from './components/Settings'
import { Icon, type IconName } from './components/Icon'

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'map', label: 'Карта', icon: 'map' },
  { view: 'states', label: 'Государства', icon: 'crown' },
  ...KIND_ORDER.map((k) => ({ view: k as View, label: KINDS[k].plural, icon: KINDS[k].icon }))
]

export default function App() {
  const world = useStore((s) => s.world)
  const load = useStore((s) => s.load)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const saveState = useStore((s) => s.saveState)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const masterMode = useStore((s) => s.masterMode)
  const setMasterMode = useStore((s) => s.setMasterMode)
  // на телефоне меню выезжает сбоку по кнопке
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (e.ctrlKey && e.code === 'KeyZ') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
      if (e.ctrlKey && e.code === 'KeyY') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!world) return <div className="splash">Gleuderoff</div>

  return (
    <div className={`app ${masterMode ? '' : 'player-mode'} ${navOpen ? 'nav-open' : ''}`}>
      <button className="nav-burger" onClick={() => setNavOpen(!navOpen)} aria-label="Меню">
        <span />
        <span />
        <span />
      </button>
      <div className="nav-backdrop" onClick={() => setNavOpen(false)} />
      <nav className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="" />
          <span className="brand-name">Gleuderoff</span>
        </div>
        <div className="nav-items">
          {NAV.map((n) => (
            <button
              key={n.view}
              className={`nav-item ${view === n.view ? 'active' : ''}`}
              title={n.label}
              onClick={() => {
                setView(n.view)
                setNavOpen(false)
              }}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </button>
          ))}
        </div>
        <div className="nav-bottom">
          <button className={`master-toggle ${masterMode ? 'on' : ''}`} onClick={() => setMasterMode(!masterMode)} title="В режиме игрока тайное знание мастера скрыто">
            <Icon name="eye" size={16} />
            {masterMode ? 'Режим мастера' : 'Режим игрока'}
          </button>
          <div className="undo-row">
            <button onClick={undo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
              <Icon name="undo" size={16} />
            </button>
            <button onClick={redo} disabled={!canRedo} title="Повторить (Ctrl+Y)">
              <Icon name="redo" size={16} />
            </button>
            <span className={`save-state ${saveState}`}>
              {{ saved: 'Сохранено', dirty: 'Есть правки', saving: 'Сохраняю…', error: 'Ошибка сохранения' }[saveState]}
            </span>
          </div>
          <button
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setView('settings')
              setNavOpen(false)
            }}
          >
            <Icon name="gear" />
            <span>Настройки</span>
          </button>
        </div>
      </nav>
      <main className="main">
        <div className="main-view">
          {view === 'map' && (
            <>
              <MapView />
              <MapToolbar />
              <MapModeBar />
              <LayersPanel />
              <Inspector />
            </>
          )}
          {view === 'states' && <StatesView />}
          {view === 'settings' && <SettingsView />}
          {view in KINDS && <CodexView key={view} kind={view as keyof typeof KINDS} />}
        </div>
        <Timeline />
      </main>
      <StateCard />
    </div>
  )
}
