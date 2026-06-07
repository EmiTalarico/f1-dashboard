'use client'

import { useState, useEffect, useRef } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/live'
const OF1 = 'https://api.openf1.org/v1'

type DriverInfo = {
  driver_number: number
  full_name: string
  name_acronym: string
  team_name: string
  team_colour: string
}

type DriverTiming = {
  Position?: string
  GapToLeader?: string
  IntervalToPositionAhead?: { Value: string }
  LastLapTime?: { Value: string; OverallFastest?: boolean; PersonalFastest?: boolean }
  BestLapTime?: { Value: string }
  Sectors?: {
    [key: string]: {
      Value?: string
      OverallFastest?: boolean
      PersonalFastest?: boolean
      Segments?: { [key: string]: { Status: number } }
    }
  }
  NumberOfPitStops?: number
  InPit?: boolean
  PitOut?: boolean
  Stopped?: boolean
  Status?: number
}

type TyreData = {
  Stints?: {
    [key: string]: {
      Compound?: string
      TotalLaps?: number
      New?: string
    }
  }
}

type SessionInfo = {
  Meeting?: { Name: string; Circuit?: { ShortName: string } }
  Name?: string
  Type?: string
}

type Weather = {
  AirTemp?: string
  TrackTemp?: string
  Humidity?: string
  WindSpeed?: string
  Rainfall?: string
}

type RaceControlMessage = {
  Message?: string
  Flag?: string
  Category?: string
  Utc?: string
}

type LiveState = {
  connected: boolean
  session: SessionInfo
  timing: { [driverNum: string]: DriverTiming }
  tyres: { [driverNum: string]: TyreData }
  weather: Weather
  race_control: RaceControlMessage[]
  session_data: any
}

const TYRE_COLORS: Record<string, string> = {
  SOFT: '#e10600', MEDIUM: '#ffd700', HARD: '#ffffff',
  INTERMEDIATE: '#00a550', WET: '#0057b8', UNKNOWN: '#888',
}

const TYRE_LABELS: Record<string, string> = {
  SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?',
}

const FLAG_COLORS: Record<string, string> = {
  GREEN: '#00a550', YELLOW: '#ffd700', RED: '#e10600',
  SAFETY_CAR: '#ffd700', VIRTUAL_SAFETY_CAR: '#ffd700',
  CHEQUERED: '#ffffff', CLEAR: '#00a550',
}

const SESSION_LABELS: Record<string, string> = {
  'Practice 1': '🟢 Práctica 1', 'Practice 2': '🟢 Práctica 2',
  'Practice 3': '🟢 Práctica 3', 'Qualifying': '🟡 Clasificación',
  'Sprint Qualifying': '🟡 Sprint Qualifying', 'Sprint Shootout': '🟡 Sprint Shootout',
  'Sprint': '🟠 Sprint', 'Race': '🏁 Carrera',
}

// Colores de sector: 2048=amarillo, 2049=verde, 2051=morado, 2064=pit
const SEGMENT_COLORS: Record<number, string> = {
  2048: '#ffd700', 2049: '#00a550', 2051: '#a855f7', 2052: '#a855f7',
  2064: '#888', 0: '#333',
}

function SectorTime({ sector, label }: {
  sector?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean; Segments?: { [k: string]: { Status: number } } }
  label: string
}) {
  if (!sector) return <div className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>—</div>

  const color = sector.OverallFastest ? '#a855f7'
    : sector.PersonalFastest ? '#00a550'
    : 'inherit'

  const segments = sector.Segments ? Object.values(sector.Segments) : []

  return (
    <div>
      <div className="text-xs font-mono font-bold" style={{ color }}>{sector.Value || '—'}</div>
      {segments.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {segments.map((seg, i) => (
            <div
              key={i}
              className="h-1 rounded-sm flex-1"
              style={{ background: SEGMENT_COLORS[seg.Status] ?? '#333', minWidth: 4 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LiveTimingPage() {
  const [liveState, setLiveState] = useState<LiveState | null>(null)
  const [drivers, setDrivers] = useState<Record<string, DriverInfo>>({})
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Cargar info de pilotos desde OpenF1
  useEffect(() => {
    fetch(`${OF1}/drivers?session_key=latest`)
      .then(r => r.json())
      .then((data: DriverInfo[]) => {
        const map: Record<string, DriverInfo> = {}
        data.forEach(d => { map[String(d.driver_number)] = d })
        setDrivers(map)
      })
      .catch(() => { })
  }, [])

  // WebSocket connection
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.topic === 'ping') return
          if (msg.topic === 'snapshot') {
            setLiveState(msg.data)
          } else {
            setLiveState(prev => {
              if (!prev) return prev
              const next = { ...prev }
              if (msg.topic === 'timing') next.timing = msg.data
              if (msg.topic === 'tyres') next.tyres = msg.data
              if (msg.topic === 'weather') next.weather = msg.data
              if (msg.topic === 'race_control') next.race_control = msg.data
              if (msg.topic === 'session') next.session = msg.data
              if (msg.topic === 'session_data') next.session_data = msg.data
              return next
            })
          }
          setLastUpdate(new Date())
        } catch { }
      }

      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 5000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  const sortedDrivers = liveState
  ? Object.entries(liveState.timing)
      .filter(([, d]) => d.GapToLeader || d.Position || d.IntervalToPositionAhead)
      .map(([num, data]) => ({ num, data, tyre: liveState.tyres[num], info: drivers[num] }))
      .sort((a, b) => {
        // Si tienen Position explícita la usamos
        const posA = parseInt(a.data.Position ?? '999')
        const posB = parseInt(b.data.Position ?? '999')
        if (posA !== posB) return posA - posB

        // Sino ordenamos por GapToLeader
        const gapA = a.data.GapToLeader ?? ''
        const gapB = b.data.GapToLeader ?? ''
        if (gapA === '' && gapB !== '') return -1
        if (gapB === '' && gapA !== '') return 1
        if (gapA.startsWith('LAP') || gapA.includes('L')) return 1
        if (gapB.startsWith('LAP') || gapB.includes('L')) return -1
        return parseFloat(gapA.replace('+', '')) - parseFloat(gapB.replace('+', ''))
      })
  : []

  function getCurrentTyre(tyre: TyreData | undefined) {
    if (!tyre?.Stints) return { compound: 'UNKNOWN', laps: 0, isNew: false }
    const stints = Object.values(tyre.Stints)
    const last = stints[stints.length - 1]
    return {
      compound: last?.Compound ?? 'UNKNOWN',
      laps: last?.TotalLaps ?? 0,
      isNew: last?.New === 'true',
    }
  }

  const sessionName = liveState?.session?.Name ?? ''
  const sessionLabel = SESSION_LABELS[sessionName] ?? sessionName
  const meetingName = liveState?.session?.Meeting?.Name ?? ''
  const hasData = sortedDrivers.length > 0
  const weather = liveState?.weather

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">
              <span style={{ color: 'var(--f1-red)' }}>🔴 Live</span> Timing
            </h1>
            <span
              className="text-sm font-bold px-3 py-1 rounded-full"
              style={{
                background: connected ? '#00a55022' : '#e1060022',
                color: connected ? '#00a550' : '#e10600',
                border: `1px solid ${connected ? '#00a550' : '#e10600'}`,
              }}
            >
              {connected ? '⬤ Conectado' : '◯ Reconectando...'}
            </span>
          </div>

          {meetingName && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>📍 {meetingName}</p>
              {sessionLabel && (
                <span className="text-sm font-bold px-3 py-0.5 rounded-full" style={{ background: 'var(--f1-light-gray)' }}>
                  {sessionLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {lastUpdate && (
          <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>
            🔄 {lastUpdate.toLocaleTimeString('es-AR')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* Tabla */}
        <div className="xl:col-span-3">
          <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--f1-gray)' }}>

            {/* Cabecera desktop */}
            <div
              className="hidden md:grid gap-2 px-4 py-2 text-xs font-semibold uppercase"
              style={{
                color: 'var(--f1-muted)',
                borderBottom: '1px solid var(--f1-light-gray)',
                gridTemplateColumns: '36px 36px 140px 80px 90px 90px 90px 80px 80px 80px 32px',
              }}
            >
              <span>Pos</span>
              <span>#</span>
              <span>Piloto</span>
              <span>Neum.</span>
              <span>Última V.</span>
              <span>Mejor V.</span>
              <span>Gap</span>
              <span>S1</span>
              <span>S2</span>
              <span>S3</span>
              <span>Pit</span>
            </div>

            {!hasData ? (
              <div className="text-center py-20" style={{ color: 'var(--f1-muted)' }}>
                <div className="text-4xl mb-4">🏁</div>
                <p className="font-semibold">Sin sesión activa</p>
                <p className="text-sm mt-1">Los datos aparecerán automáticamente cuando empiece la sesión</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
                {sortedDrivers.map(({ num, data, tyre, info }, index) => {
                  const { compound, laps, isNew } = getCurrentTyre(tyre)
                  const pos = data.Position ? parseInt(data.Position) : (index + 1)
                  const teamColor = info?.team_colour ? `#${info.team_colour}` : '#888'
                  const sectors = data.Sectors ?? {}
                  const lapColor = data.LastLapTime?.OverallFastest ? '#a855f7'
                    : data.LastLapTime?.PersonalFastest ? '#00a550'
                    : 'inherit'

                  const statusLabel = data.InPit ? '🔧 PIT'
                    : data.PitOut ? '📤 OUT'
                    : data.Stopped ? '🔴 STP'
                    : null

                  return (
                    <div key={num}>
                      {/* Desktop */}
                      <div
                        className="hidden md:grid items-center gap-2 px-4 py-2 text-sm"
                        style={{
                          gridTemplateColumns: '36px 36px 140px 80px 90px 90px 90px 80px 80px 80px 32px',
                          borderLeft: `3px solid ${teamColor}`,
                          background: statusLabel ? '#ffffff08' : 'transparent',
                        }}
                      >
                        <span className="font-bold" style={{ color: pos === 1 ? 'var(--f1-red)' : 'inherit' }}>
                          {data.Position}
                        </span>
                        <span className="text-xs font-bold" style={{ color: teamColor }}>{num}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">
                            {info?.name_acronym ?? num}
                            {statusLabel && <span className="ml-2 text-xs" style={{ color: 'var(--f1-muted)' }}>{statusLabel}</span>}
                          </div>
                          {info && (
                            <div className="text-xs truncate" style={{ color: 'var(--f1-muted)' }}>{info.team_name}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{
                              background: TYRE_COLORS[compound],
                              color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff',
                              border: isNew ? '2px solid white' : 'none',
                            }}
                          >
                            {TYRE_LABELS[compound]}
                          </span>
                          <span className="text-xs font-mono">{laps > 0 ? laps : '—'}</span>
                        </div>
                        <span className="font-mono text-xs" style={{ color: lapColor }}>
                          {data.LastLapTime?.Value ?? '—'}
                        </span>
                        <span className="font-mono text-xs" style={{ color: 'var(--f1-muted)' }}>
                          {data.BestLapTime?.Value ?? '—'}
                        </span>
                        <span className="font-mono text-xs" style={{ color: pos === 1 ? '#00a550' : 'inherit' }}>
                          {pos === 1 ? 'Líder' : (data.GapToLeader ?? '—')}
                        </span>
                        <SectorTime sector={sectors['0']} label="S1" />
                        <SectorTime sector={sectors['1']} label="S2" />
                        <SectorTime sector={sectors['2']} label="S3" />
                        <span className="text-xs text-center font-bold" style={{ color: 'var(--f1-muted)' }}>
                          {data.NumberOfPitStops ?? '—'}
                        </span>
                      </div>

                      {/* Mobile */}
                      <div
                        className="md:hidden flex items-center gap-3 px-4 py-3"
                        style={{ borderLeft: `3px solid ${teamColor}` }}
                      >
                        <span className="w-7 text-center font-bold text-sm shrink-0" style={{ color: pos === 1 ? 'var(--f1-red)' : 'inherit' }}>
                          {data.Position}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{info?.name_acronym ?? num}</span>
                            {statusLabel && <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{statusLabel}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
                              style={{
                                background: TYRE_COLORS[compound],
                                color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff',
                              }}
                            >
                              {TYRE_LABELS[compound]}
                            </span>
                            <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>
                              {laps > 0 ? `${laps}v` : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold" style={{ color: lapColor }}>
                            {data.LastLapTime?.Value ?? '—'}
                          </div>
                          <div className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>
                            {pos === 1 ? 'Líder' : (data.GapToLeader ?? '—')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="flex flex-col gap-4">

          {weather && Object.keys(weather).length > 0 && (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--f1-gray)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
                🌤 Condiciones
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Aire</p>
                  <p className="font-bold">{weather.AirTemp ?? '—'}°C</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Pista</p>
                  <p className="font-bold">{weather.TrackTemp ?? '—'}°C</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Humedad</p>
                  <p className="font-bold">{weather.Humidity ?? '—'}%</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Viento</p>
                  <p className="font-bold">{weather.WindSpeed ?? '—'} km/h</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Lluvia</p>
                  <p className="font-bold" style={{ color: weather.Rainfall === '1' ? '#60a5fa' : 'inherit' }}>
                    {weather.Rainfall === '1' ? '🌧 Sí' : 'Sin lluvia'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {liveState?.race_control && liveState.race_control.length > 0 && (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--f1-gray)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
                📻 Race Control
              </h3>
              <div className="flex flex-col gap-2">
                {liveState.race_control.slice(0, 5).map((msg, i) => (
                  <div
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: 'var(--f1-light-gray)',
                      borderLeft: `3px solid ${FLAG_COLORS[msg.Flag ?? ''] ?? '#888'}`,
                    }}
                  >
                    {msg.Flag && (
                      <p className="font-semibold mb-0.5" style={{ color: FLAG_COLORS[msg.Flag] ?? '#fff' }}>
                        {msg.Flag}
                      </p>
                    )}
                    <p style={{ color: 'var(--f1-muted)' }}>{msg.Message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasData && (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--f1-gray)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--f1-muted)' }}>
                Info
              </h3>
              <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>
                La página se actualiza automáticamente cuando empieza una sesión. No hace falta recargar.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}