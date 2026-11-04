import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildCity, type CityPlace, type CityPlan, type CityWorld } from '../city3d'
import type { PersonInfo } from '../city3dLife'
import { useStore } from '../store'
import { assetUrl, loadPlan } from './ui'
import type { MapDef } from '../types'

export type View3D = 'orbit' | 'walk'
const DAY = 13, EVENING = 19.2, NIGHT = 23.6
const clock = (h: number): string => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

/** 3D-вид поселения поверх карты: облёт мышью и прогулка от первого лица. Здания выбираются кликом, как на плане. */
export function City3D({ mapDef, mode, setMode }: { mapDef: MapDef; mode: View3D; setMode: (m: View3D) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const arrow = useRef<HTMLDivElement>(null)
  const stick = useRef<HTMLDivElement>(null)
  const state = useRef({ mode, hour: DAY, flow: false, fly: false, tour: false, needShadow: true, stickX: 0, stickY: 0 })
  const worldRef = useRef<CityWorld | null>(null)
  const [hour, setHourState] = useState(DAY)
  const [flow, setFlow] = useState(false)
  const [tour, setTour] = useState(false)
  const [fly, setFly] = useState(false)
  const [clean, setClean] = useState(false)
  const [labels, setLabels] = useState(true)
  const [racesOn, setRacesOn] = useState(false)
  const [census, setCensus] = useState<CityWorld['census']>([])
  const [met, setMet] = useState<PersonInfo | null>(null)
  const world = useStore((s) => s.world!)
  const placesOf = (): CityPlace[] => useStore.getState().world!.places.filter((p) => p.mapId === mapDef.id).map((p) => ({ id: p.id, name: p.base.name, x: p.x, y: p.y, building: p.building ?? null }))
  // новая локация или новое имя сразу видны в 3D
  const placeKey = world.places.filter((p) => p.mapId === mapDef.id).map((p) => `${p.id}:${p.base.name}:${p.building ?? ''}`).join('|')
  useEffect(() => worldRef.current?.setPlaces(placesOf()), [placeKey])
  useEffect(() => worldRef.current?.setMarks(racesOn), [racesOn])
  const [status, setStatus] = useState<string | null>('Строю поселение…')
  const [mini, setMini] = useState<{ w: number; h: number } | null>(null)
  const mobile = window.matchMedia('(pointer: coarse)').matches

  const setHour = (h: number): void => {
    state.current.hour = h
    state.current.needShadow = true
    setHourState(h)
  }
  // панели карты (инструменты, слои) в 3D не действуют
  useEffect(() => {
    document.body.classList.add('city3d-open')
    return () => document.body.classList.remove('city3d-open')
  }, [])
  useEffect(() => {
    state.current.mode = mode
    window.dispatchEvent(new Event('city3d-mode'))
  }, [mode])
  useEffect(() => {
    state.current.flow = flow
    state.current.tour = tour
    state.current.fly = fly
  }, [flow, tour, fly])

  useEffect(() => worldRef.current?.setLabels(labels), [labels])

  useEffect(() => {
    if (!mapDef.plan || !host.current) return
    const el = host.current
    let alive = true
    let raf = 0
    let cleanup = (): void => undefined
    setStatus('Строю поселение…')
    loadPlan<CityPlan>(mapDef.plan)
      .then(async (plan) => {
        // дать интерфейсу показать надпись: большой город строится пару секунд
        await new Promise((r) => setTimeout(r, 40))
        if (!alive) return
        const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        renderer.shadowMap.autoUpdate = false
        renderer.outputColorSpace = THREE.SRGBColorSpace
        el.appendChild(renderer.domElement)
        const w = useStore.getState().world!
        // чьё поселение: состав жителей зависит от государства и культуры
        const prov = w.provinces?.find((p) => p.cityMapId === mapDef.id)
        const stateId = prov?.owners?.at(-1)?.[1] ?? w.places.find((p) => p.innerMapId === mapDef.id)?.base.stateId
        const city = buildCity(plan, mapDef.id, { mobile, maxTexture: renderer.capabilities.maxTextureSize, places: placesOf(), state: w.states.find((q) => q.id === stateId)?.base.name ?? '', culture: prov?.culture ?? 'imperial' })
        setCensus(city.census)
        worldRef.current = city
        setMini({ w: city.size[0], h: city.size[1] })
        const cam = new THREE.PerspectiveCamera(58, 1, 0.25, 12000)
        const r = city.radius
        const aim = new THREE.Vector3(city.center[0], city.heightAt(city.center[0], city.center[1]), city.center[1])
        cam.position.set(aim.x + r * 0.9, aim.y + Math.max(26, r * 0.62), aim.z + r * 1.15)
        const orbit = new OrbitControls(cam, renderer.domElement)
        orbit.target.copy(aim)
        orbit.enableDamping = true
        orbit.dampingFactor = 0.09
        orbit.maxPolarAngle = Math.PI * 0.49
        orbit.minDistance = 8
        orbit.maxDistance = Math.max(500, r * 5)
        orbit.screenSpacePanning = false
        orbit.update()

        // ---- прогулка ----
        const keys = new Set<string>()
        const walk = { yaw: 0, pitch: -0.05, vy: 0, y: 0 }
        const eye = 1.68
        const enterWalk = (): void => {
          const [x, z] = city.spawn()
          walk.y = city.heightAt(x, z)
          cam.position.set(x, walk.y + eye, z)
          // смотреть туда, где дальше всего видно: вдоль улицы, а не в стену
          let far = -1
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2
            let d = 1
            while (d < 90 && city.walkable(x + Math.sin(a) * d, z + Math.cos(a) * d)) d += 1
            if (d > far) { far = d; walk.yaw = a + Math.PI }
          }
          walk.pitch = -0.04
          state.current.needShadow = true
        }
        const leaveWalk = (): void => {
          const dir = new THREE.Vector3()
          cam.getWorldDirection(dir)
          const dist = Math.max(40, Math.min(r, 120))
          orbit.target.set(cam.position.x + dir.x * dist, city.heightAt(cam.position.x, cam.position.z), cam.position.z + dir.z * dist)
          cam.position.set(cam.position.x - dir.x * 30, Math.max(cam.position.y, orbit.target.y + 40), cam.position.z - dir.z * 30)
          cam.up.set(0, 1, 0)
          orbit.update()
          state.current.needShadow = true
        }
        let lastMode: View3D = 'orbit'
        const applyMode = (): void => {
          const m = state.current.mode
          if (m === lastMode) return
          lastMode = m
          orbit.enabled = m === 'orbit'
          if (m === 'walk') enterWalk()
          else leaveWalk()
        }
        window.addEventListener('city3d-mode', applyMode)
        applyMode()

        const isField = (t: EventTarget | null): boolean => t instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(t.tagName)
        const onKey = (e: KeyboardEvent): void => {
          if (isField(e.target)) return
          if (e.type === 'keydown') {
            keys.add(e.code)
            if (state.current.mode === 'walk' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
            if (e.code === 'KeyF' && state.current.mode === 'walk') setFly((v) => !v)
            if (e.code === 'Space' && state.current.mode === 'walk' && walk.vy === 0 && !state.current.fly) walk.vy = 4.6
          } else keys.delete(e.code)
        }
        window.addEventListener('keydown', onKey)
        window.addEventListener('keyup', onKey)

        // перетаскивание: в прогулке — взгляд; короткий клик — выбор здания
        const dom = renderer.domElement
        dom.addEventListener('pointerleave', () => { hovered = null })
        let down: { x: number; y: number; id: number; t: number } | null = null
        let moved = 0
        const onDown = (e: PointerEvent): void => {
          down = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() }
          moved = 0
          if (state.current.mode === 'walk') dom.setPointerCapture(e.pointerId)
        }
        const hoverRay = new THREE.Raycaster()
        let hovered: number | null = null
        const onMove = (e: PointerEvent): void => {
          // наведение: как на плане, здание подсвечивается ещё до клика
          if (!down && e.pointerType === 'mouse') {
            const b = dom.getBoundingClientRect()
            hoverRay.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), cam)
            hovered = city.pick(hoverRay.ray.origin, hoverRay.ray.direction)
            dom.style.cursor = hovered === null ? '' : 'pointer'
          }
          if (!down || down.id !== e.pointerId) return
          const dx = e.clientX - down.x, dy = e.clientY - down.y
          moved += Math.abs(dx) + Math.abs(dy)
          if (state.current.mode === 'walk') {
            walk.yaw -= dx * 0.0042
            walk.pitch = Math.max(-1.45, Math.min(1.45, walk.pitch - dy * 0.0042))
            down.x = e.clientX
            down.y = e.clientY
          }
        }
        const onUp = (e: PointerEvent): void => {
          if (!down || down.id !== e.pointerId) return
          const wasClick = moved < 6 && performance.now() - down.t < 450
          down = null
          if (!wasClick) return
          const b = dom.getBoundingClientRect()
          const ray = new THREE.Raycaster()
          ray.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), cam)
          const who = city.pickPerson(ray.ray.origin, ray.ray.direction)
          if (who) {
            setMet(who)
            return
          }
          setMet(null)
          const i = city.pick(ray.ray.origin, ray.ray.direction)
          const s = useStore.getState()
          if (i === null || s.tool.kind !== 'select') return
          const place = s.world!.places.find((p) => p.mapId === mapDef.id && p.building === i)
          s.select(place ? { type: 'place', id: place.id } : { type: 'building', id: `${mapDef.id}#${i}` })
        }
        dom.addEventListener('pointerdown', onDown)
        dom.addEventListener('pointermove', onMove)
        dom.addEventListener('pointerup', onUp)

        // метка выбранного здания
        const markGeo = new THREE.OctahedronGeometry(1.1)
        const markMat = new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false })
        const marker = new THREE.Mesh(markGeo, markMat)
        marker.visible = false
        city.scene.add(marker)

        const resize = (): void => {
          const w = el.clientWidth || 1, h = el.clientHeight || 1
          renderer.setSize(w, h)
          cam.aspect = w / h
          cam.updateProjectionMatrix()
        }
        const ro = new ResizeObserver(resize)
        ro.observe(el)
        resize()

        const focus = new THREE.Vector3()
        const lastShadow = new THREE.Vector3(1e9, 0, 0)
        let lastHourShadow = -1
        let lastT = performance.now()
        let uiTick = 0
        const dir = new THREE.Vector3()
        const frame = (now: number): void => {
          raf = requestAnimationFrame(frame)
          if (document.hidden) return
          const dt = Math.min(0.08, (now - lastT) / 1000)
          lastT = now
          const st = state.current
          if (st.flow) {
            st.hour = (st.hour + dt * 0.25) % 24
          }
          if (st.mode === 'orbit') {
            orbit.autoRotate = st.tour
            orbit.autoRotateSpeed = 0.7
            orbit.update()
          } else {
            const turn = dt * 1.5
            if (keys.has('ArrowLeft')) walk.yaw += turn
            if (keys.has('ArrowRight')) walk.yaw -= turn
            if (keys.has('ArrowUp')) walk.pitch = Math.min(1.45, walk.pitch + turn)
            if (keys.has('ArrowDown')) walk.pitch = Math.max(-1.45, walk.pitch - turn)
            let fw = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) - st.stickY
            let rt = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + st.stickX
            const len = Math.hypot(fw, rt)
            if (len > 1) { fw /= len; rt /= len }
            const fast = keys.has('ShiftLeft') || keys.has('ShiftRight')
            const speed = (st.fly ? (fast ? 60 : 24) : fast ? 8.5 : 4) * dt
            const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw)
            const mx = (-sy * fw + cy * rt) * speed, mz = (-cy * fw - sy * rt) * speed
            if (st.fly) {
              cam.position.x += mx
              cam.position.z += mz
              cam.position.y += ((keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0)) * speed
              cam.position.y = Math.max(city.heightAt(cam.position.x, cam.position.z) + 1, cam.position.y)
              walk.vy = 0
            } else {
              const pad = 0.35
              const free = (x: number, z: number): boolean => city.walkable(x + Math.sign(mx || 1) * pad, z) && city.walkable(x, z + Math.sign(mz || 1) * pad) && city.walkable(x, z)
              if (free(cam.position.x + mx, cam.position.z)) cam.position.x += mx
              if (free(cam.position.x, cam.position.z + mz)) cam.position.z += mz
              const g = Math.max(city.heightAt(cam.position.x, cam.position.z), city.deckAt(cam.position.x, cam.position.z) ?? -99)
              // приземлиться, если до этого летали
              if (walk.y > g + 0.01 || walk.vy !== 0) {
                walk.vy -= 12 * dt
                walk.y += walk.vy * dt
                if (walk.y <= g) { walk.y = g; walk.vy = 0 }
              } else walk.y = g
              if (cam.position.y - eye > g + 0.5 && walk.vy === 0 && walk.y === g) walk.y = g
              cam.position.y = walk.y + eye
            }
            if (st.fly) walk.y = cam.position.y - eye
            cam.rotation.order = 'YXZ'
            cam.rotation.set(walk.pitch, walk.yaw, 0)
          }
          // тень обновляется, только когда сдвинулось солнце или камера ушла от места: город статичен
          focus.copy(st.mode === 'orbit' ? orbit.target : cam.position)
          focus.y = st.mode === 'orbit' ? 99 : cam.position.y - city.heightAt(cam.position.x, cam.position.z) > 30 ? 99 : 0
          const hourMoved = Math.abs(st.hour - lastHourShadow) > 0.04
          const placeMoved = focus.distanceTo(lastShadow) > (st.mode === 'walk' ? 45 : 1e8)
          if (city.takeDirty()) st.needShadow = true
          if (st.needShadow || hourMoved || placeMoved) {
            city.setTime(st.hour, focus)
            lastHourShadow = st.hour
            lastShadow.copy(focus)
            st.needShadow = false
            renderer.shadowMap.needsUpdate = true
          }
          city.tick(dt, now / 1000, cam)
          // мини-карта и метка выбранного
          if (arrow.current) {
            cam.getWorldDirection(dir)
            const [w, h] = city.size
            arrow.current.style.left = `${Math.max(0, Math.min(100, (cam.position.x / w) * 100))}%`
            arrow.current.style.top = `${Math.max(0, Math.min(100, (cam.position.z / h) * 100))}%`
            arrow.current.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(dir.x, -dir.z)}rad)`
          }
          const sel = useStore.getState().selection
          let bi: number | null = null
          if (sel?.type === 'building' && sel.id.startsWith(`${mapDef.id}#`)) bi = Number(sel.id.split('#')[1])
          if (sel?.type === 'place') { const p = useStore.getState().world!.places.find((q) => q.id === sel.id); if (p?.mapId === mapDef.id && p.building != null) bi = p.building }
          const top = bi === null ? null : city.buildingTop(bi)
          city.setHighlight(hovered, bi)
          marker.visible = !!top
          if (top) {
            marker.position.set(top[0], top[1] + 3 + Math.sin(now / 400) * 0.4, top[2])
            marker.rotation.y = now / 700
          }
          if (st.flow && ++uiTick % 20 === 0) setHourState(st.hour)
          renderer.render(city.scene, cam)
        }
        city.setTime(state.current.hour, aim)
        city.setLabels(labels)
        setStatus(null)
        raf = requestAnimationFrame(frame)

        cleanup = () => {
          cancelAnimationFrame(raf)
          ro.disconnect()
          window.removeEventListener('city3d-mode', applyMode)
          window.removeEventListener('keydown', onKey)
          window.removeEventListener('keyup', onKey)
          dom.removeEventListener('pointerdown', onDown)
          dom.removeEventListener('pointermove', onMove)
          dom.removeEventListener('pointerup', onUp)
          orbit.dispose()
          markGeo.dispose()
          markMat.dispose()
          city.dispose()
          renderer.dispose()
          renderer.forceContextLoss()
          dom.remove()
          worldRef.current = null
        }
      })
      .catch((e) => setStatus(`Не удалось построить: ${e?.message ?? e}`))
    return () => {
      alive = false
      cleanup()
    }
  }, [mapDef.id, mapDef.plan])

  // виртуальный джойстик прогулки на телефоне
  const onStick = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId)
    const b = e.currentTarget.getBoundingClientRect()
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      state.current.stickX = state.current.stickY = 0
    } else if (e.buttons || e.pointerType === 'touch') {
      const x = ((e.clientX - b.left) / b.width) * 2 - 1, y = ((e.clientY - b.top) / b.height) * 2 - 1
      const l = Math.max(1, Math.hypot(x, y))
      state.current.stickX = x / l
      state.current.stickY = y / l
    }
    if (stick.current) stick.current.style.transform = `translate(${state.current.stickX * 26}px, ${state.current.stickY * 26}px)`
  }

  const phase = (h: number): string => (h >= 6 && h < 17.5 ? 'день' : h >= 17.5 && h < 21 ? 'вечер' : 'ночь')
  return (
    <div className="city3d">
      <div ref={host} className="city3d-canvas" />
      {status && <div className="city3d-status">{status}</div>}
      {!clean ? (
        <div className="city3d-bar">
          <div className="city3d-group">
            <button className={phase(hour) === 'день' ? 'on' : ''} onClick={() => setHour(DAY)}>День</button>
            <button className={phase(hour) === 'вечер' ? 'on' : ''} onClick={() => setHour(EVENING)}>Вечер</button>
            <button className={phase(hour) === 'ночь' ? 'on' : ''} onClick={() => setHour(NIGHT)}>Ночь</button>
          </div>
          <label className="city3d-clock">
            <span>{clock(hour)}</span>
            <input type="range" min={0} max={23.9} step={0.1} value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="Время суток" />
          </label>
          <button className={flow ? 'on' : ''} onClick={() => setFlow(!flow)}>{flow ? 'Пауза' : 'Время идёт'}</button>
          {mode === 'orbit' && <button className={tour ? 'on' : ''} onClick={() => setTour(!tour)}>Облёт</button>}
          {mode === 'walk' && <button className={fly ? 'on' : ''} onClick={() => setFly(!fly)}>{fly ? 'Приземлиться' : 'Полёт'}</button>}
          <button className={labels ? 'on' : ''} onClick={() => setLabels(!labels)}>Подписи</button>
          <button className={racesOn ? 'on' : ''} onClick={() => setRacesOn(!racesOn)}>Расы</button>
          <button onClick={() => setClean(true)}>Чистый вид</button>
        </div>
      ) : (
        <button className="city3d-unclean" onClick={() => setClean(false)}>Показать панель</button>
      )}
      {racesOn && !clean && (
        <div className="city3d-races">
          <b>Кто на улицах</b>
          {census.map((q) => (
            <div key={q.race.id}>
              <i style={{ background: q.race.mark }} />
              <span>{q.race.name}</span>
              <em>{q.count}</em>
            </div>
          ))}
          <small>Состав — черновик. Клик по жителю покажет, кто это.</small>
        </div>
      )}
      {met && (
        <div className="city3d-met" role="status">
          <i style={{ background: met.race.mark }} />
          <div>
            <b>{met.race.name}</b>
            <span>{met.role}</span>
            {(() => {
              const e = world.entries.find((q) => q.id === met.race.entry)
              const text = (e?.base as { summary?: string } | undefined)?.summary
              return text ? <p>{text}</p> : null
            })()}
          </div>
          <button aria-label="Закрыть" onClick={() => setMet(null)}>×</button>
        </div>
      )}
      {!clean && (
        <div className="city3d-hint">
          {mode === 'orbit'
            ? mobile ? 'Один палец — вращать, два — масштаб и сдвиг, касание — здание (можно сделать локацией) или житель' : 'Мышь — вращать, правая кнопка — сдвиг, колесо — масштаб, клик — здание (можно сделать локацией) или житель'
            : mobile ? 'Джойстик — идти, палец по экрану — взгляд' : fly ? 'WASD — лететь, Q/E — высота, Shift — быстрее, F — приземлиться' : 'WASD — идти, перетаскивание — взгляд, Shift — бежать, пробел — прыжок, F — полёт'}
        </div>
      )}
      {mini && !clean && (
        <button
          className="city3d-mini"
          style={{ aspectRatio: `${mini.w} / ${mini.h}` }}
          aria-label="Вернуться к обзору"
          title={mode === 'walk' ? 'Вернуться к обзору' : 'Пойти пешком'}
          onClick={() => setMode(mode === 'walk' ? 'orbit' : 'walk')}
        >
          <img src={assetUrl(mapDef.image)} alt="" />
          <div ref={arrow} className="city3d-arrow" />
        </button>
      )}
      {mode === 'walk' && mobile && (
        <div className="city3d-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick}>
          <div ref={stick} />
        </div>
      )}
    </div>
  )
}
