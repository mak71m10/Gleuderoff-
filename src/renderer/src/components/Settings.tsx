import { useStore } from '../store'
import { yearLength } from '../calendar'
import { Button, DateField, NumberField, Section, TextField, assetUrl } from './ui'
import { Icon } from './Icon'

export function SettingsView() {
  const world = useStore((s) => s.world!)
  const mutate = useStore((s) => s.mutate)
  const cal = world.calendar
  const editCal = (fn: (c: typeof cal) => void): void =>
    mutate((w) => {
      fn(w.calendar as typeof cal)
    })

  const replaceImage = async (mapId: string, field: 'image' | 'reference'): Promise<void> => {
    const rel = await window.api.importImage('maps')
    if (!rel) return
    const img = new Image()
    img.src = assetUrl(rel)
    await img.decode()
    mutate((w) => {
      const m = w.maps.find((x) => x.id === mapId)
      if (!m) return
      m[field] = rel
      // для карт городов логический размер = размер картинки; у карты мира он постоянный, чтобы не сдвигались метки
      if (field === 'image' && m.kind !== 'world') {
        m.width = img.naturalWidth
        m.height = img.naturalHeight
      }
    })
  }

  return (
    <div className="page settings">
      <header className="page-head">
        <h1>Настройки мира</h1>
        <Button icon="folder" onClick={() => window.api.openWorldFolder()}>
          Открыть папку мира
        </Button>
      </header>

      <Section title="Календарь" icon="calendar">
        <div className="grid-2">
          <TextField label="Эра «после» (полностью)" value={cal.eraAfter} onChange={(v) => editCal((c) => (c.eraAfter = v))} />
          <TextField label="Сокращение" value={cal.eraAfterShort} onChange={(v) => editCal((c) => (c.eraAfterShort = v))} />
          <TextField label="Эра «до» (полностью)" value={cal.eraBefore} onChange={(v) => editCal((c) => (c.eraBefore = v))} />
          <TextField label="Сокращение" value={cal.eraBeforeShort} onChange={(v) => editCal((c) => (c.eraBeforeShort = v))} />
        </div>
        <div className="field-label">Месяцы (в году {yearLength(cal)} дней)</div>
        <div className="month-list">
          {cal.months.map((m, i) => (
            <div key={i} className="month-row">
              <span className="muted">{i + 1}.</span>
              <TextField value={m.name} onChange={(v) => editCal((c) => (c.months[i].name = v))} />
              <NumberField value={m.days} min={1} onChange={(v) => editCal((c) => (c.months[i].days = Math.max(1, v)))} />
              <span className="muted small">дней</span>
              {cal.months.length > 1 && (
                <button className="icon-btn" onClick={() => editCal((c) => c.months.splice(i, 1))}>
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          ))}
          <Button icon="plus" onClick={() => editCal((c) => c.months.push({ name: `Месяц ${c.months.length + 1}`, days: 30 }))}>
            Месяц
          </Button>
        </div>
        <TextField
          label="Дни недели (через запятую, можно оставить пустым)"
          value={cal.weekdays.join(', ')}
          onChange={(v) => editCal((c) => (c.weekdays = v.split(',').map((x) => x.trim()).filter(Boolean)))}
        />
        <div className="field-label">Эпохи (название и год начала)</div>
        <div className="month-list">
          {(cal.eras ?? []).map((e, i) => (
            <div key={i} className="month-row">
              <span className="muted">{i + 1}.</span>
              <TextField value={e.name} onChange={(v) => editCal((c) => (c.eras![i].name = v))} />
              <NumberField value={e.from} onChange={(v) => editCal((c) => (c.eras![i].from = v))} />
              <span className="muted small">год</span>
              <button className="icon-btn" onClick={() => editCal((c) => c.eras!.splice(i, 1))}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
          <Button icon="plus" onClick={() => editCal((c) => (c.eras = [...(c.eras ?? []), { name: 'Новая эпоха', from: 1 }]))}>
            Эпоха
          </Button>
        </div>
        <div className="grid-3">
          <DateField label="Настоящее время лора" value={cal.present} allowEmpty={false} onChange={(v) => v !== null && editCal((c) => (c.present = v))} />
          <NumberField label="Шкала с года (минус — до С.П.Д.)" value={cal.rangeFrom} onChange={(v) => editCal((c) => (c.rangeFrom = v || -1))} />
          <NumberField label="Шкала по год" value={cal.rangeTo} onChange={(v) => editCal((c) => (c.rangeTo = v || 1))} />
        </div>
        <p className="hint">
          Внимание: если поменять число дней в месяцах, уже заданные даты сдвинутся, потому что внутри они хранятся как номер дня.
          Лучше настроить календарь до того, как начнёте расставлять даты.
        </p>
      </Section>

      <Section title="Карты" icon="map">
        {world.maps.map((m) => (
          <div key={m.id} className="map-row">
            <img src={assetUrl(m.image)} alt="" />
            <div className="map-row-text">
              <TextField value={m.name} onChange={(v) => mutate((w) => void (w.maps.find((x) => x.id === m.id)!.name = v))} />
              <span className="muted small">
                {m.kind === 'world' ? 'Карта мира' : 'Карта места'} · {m.width}×{m.height}
              </span>
            </div>
            <Button icon="image" onClick={() => replaceImage(m.id, 'image')}>
              Заменить подложку
            </Button>
            <Button icon="layers" onClick={() => replaceImage(m.id, 'reference')}>
              Калька
            </Button>
          </div>
        ))}
        <p className="hint">У карты мира логический размер не меняется при замене картинки, поэтому метки и границы останутся на своих местах. Новая подложка должна быть в тех же пропорциях.</p>
      </Section>
    </div>
  )
}
