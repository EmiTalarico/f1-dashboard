'use client'

import { useState, useEffect, useRef } from 'react'
import { F1_DRIVERS } from '../data/f1drivers'

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/live'

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
  Retired?: boolean
  Status?: number
  Tla?: string
  FullName?: string
  TeamName?: string
  TeamColour?: string
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
  Lap?: number
}

type TrackStatus = {
  Status?: string
  Message?: string
}

type LiveState = {
  connected: boolean
  session: SessionInfo
  timing: { [driverNum: string]: DriverTiming }
  tyres: { [driverNum: string]: TyreData }
  weather: Weather
  race_control: RaceControlMessage[]
  session_data: any
  track_status: TrackStatus
  timing_stats: any
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
  CHEQUERED: '#ffffff', CLEAR: '#00a550', BLUE: '#0057b8',
}

const SESSION_LABELS: Record<string, string> = {
  'Practice 1': '🟢 Práctica 1', 'Practice 2': '🟢 Práctica 2',
  'Practice 3': '🟢 Práctica 3', 'Qualifying': '🟡 Clasificación',
  'Sprint Qualifying': '🟡 Sprint Qualifying', 'Sprint Shootout': '🟡 Sprint Shootout',
  'Sprint': '🟠 Sprint', 'Race': '🏁 Carrera',
}

const TRACK_STATUS_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  '1': { label: 'Pista despejada', color: '#00a550', emoji: '🟢' },
  '2': { label: 'Bandera amarilla', color: '#ffd700', emoji: '🟡' },
  '3': { label: 'Bandera verde', color: '#00a550', emoji: '🟢' },
  '4': { label: 'Safety Car', color: '#ffd700', emoji: '🚗' },
  '5': { label: 'Bandera roja', color: '#e10600', emoji: '🔴' },
  '6': { label: 'Virtual SC', color: '#ffd700', emoji: '⚠️' },
  '7': { label: 'Virtual SC fin', color: '#ffd700', emoji: '⚠️' },
}

const SEGMENT_COLORS: Record<number, string> = {
  2048: '#ffd700', 2049: '#00a550', 2051: '#a855f7', 2052: '#a855f7',
  2064: '#888', 0: '#333',
}

// ── Calcular tiempo restante extrapolado ──
function useExtrapolatedClock(clock: any): string {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!clock?.Remaining) { setRemaining(''); return }

    // Si no está extrapolando, mostrar el valor directo
    if (!clock.Extrapolating) { setRemaining(clock.Remaining); return }

    const calcRemaining = () => {
      const [h, m, s] = clock.Remaining.split(':').map(Number)
      const totalSeconds = h * 3600 + m * 60 + s
      const refTime = new Date(clock.Utc).getTime()
      const elapsed = (Date.now() - refTime) / 1000
      const left = Math.max(0, totalSeconds - elapsed)
      const lh = Math.floor(left / 3600)
      const lm = Math.floor((left % 3600) / 60)
      const ls = Math.floor(left % 60)
      return `${lh > 0 ? lh + ':' : ''}${String(lm).padStart(2, '0')}:${String(ls).padStart(2, '0')}`
    }

    setRemaining(calcRemaining())
    const interval = setInterval(() => setRemaining(calcRemaining()), 1000)
    return () => clearInterval(interval)
  }, [clock])

  return remaining
}

// ── Merge profundo de sectores acumulando segmentos ──
function mergeTiming(prev: LiveState['timing'], next: LiveState['timing']): LiveState['timing'] {
  const merged = { ...prev }
  for (const [num, data] of Object.entries(next)) {
    if (!merged[num]) {
      merged[num] = { ...data }
      continue
    }
    const prevDriver = merged[num]
    const newDriver = { ...prevDriver, ...data }

    // Merge profundo de sectores — acumular segmentos
    if (data.Sectors) {
      newDriver.Sectors = { ...prevDriver.Sectors }
      for (const [sKey, sector] of Object.entries(data.Sectors)) {
        const prevSector = prevDriver.Sectors?.[sKey] ?? {}
        if (sector.Segments) {
          // Acumular segmentos sin borrar los anteriores
          const prevSegs = prevSector.Segments ?? {}
          newDriver.Sectors[sKey] = {
            ...prevSector,
            ...sector,
            Segments: { ...prevSegs, ...sector.Segments },
          }
        } else {
          newDriver.Sectors[sKey] = { ...prevSector, ...sector }
        }
      }
    }

    merged[num] = newDriver
  }
  return merged
}

function SectorTime({ sector }: {
  sector?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean; Segments?: { [k: string]: { Status: number } } }
}) {
  if (!sector) return <div className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>—</div>
  const color = sector.OverallFastest ? '#a855f7' : sector.PersonalFastest ? '#00a550' : 'inherit'
  const segments = sector.Segments
    ? Object.entries(sector.Segments)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([, v]) => v)
    : []
  return (
    <div>
      <div className="text-xs font-mono font-bold" style={{ color }}>{sector.Value || '—'}</div>
      {segments.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {segments.map((seg, i) => (
            <div key={i} className="h-1 rounded-sm flex-1"
              style={{ background: SEGMENT_COLORS[seg.Status] ?? '#333', minWidth: 3 }} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LiveTimingPage() {
  const [liveState, setLiveState] = useState<LiveState | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

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
              // Timing usa merge profundo para acumular sectores
              if (msg.topic === 'timing') next.timing = mergeTiming(prev.timing, msg.data)
              if (msg.topic === 'tyres') next.tyres = msg.data
              if (msg.topic === 'weather') next.weather = msg.data
              if (msg.topic === 'race_control') next.race_control = msg.data
              if (msg.topic === 'session') next.session = msg.data
              if (msg.topic === 'session_data') next.session_data = { ...prev.session_data, ...msg.data }
              if (msg.topic === 'track_status') next.track_status = msg.data
              if (msg.topic === 'timing_stats') next.timing_stats = msg.data
              return next
            })
          }
          setLastUpdate(new Date())
        } catch { }
      }
      ws.onclose = () => { setConnected(false); setTimeout(connect, 5000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  const clock = liveState?.session_data?.Clock
  const remainingTime = useExtrapolatedClock(clock)

  const sortedDrivers = liveState
    ? Object.entries(liveState.timing)
        .filter(([, d]) => d.GapToLeader !== undefined || d.Position !== undefined || d.IntervalToPositionAhead !== undefined)
        .map(([num, data]) => ({ num, data, tyre: liveState.tyres[num], info: F1_DRIVERS[num] }))
        .sort((a, b) => {
          const posA = parseInt(a.data.Position ?? '999')
          const posB = parseInt(b.data.Position ?? '999')
          if (posA !== posB) return posA - posB
          const gapA = a.data.GapToLeader ?? ''
          const gapB = b.data.GapToLeader ?? ''
          if (gapA === '' && gapB !== '') return -1
          if (gapB === '' && gapA !== '') return 1
          if (gapA.includes('L') && !gapB.includes('L')) return 1
          if (gapB.includes('L') && !gapA.includes('L')) return -1
          if (gapA.startsWith('LAP') && !gapB.startsWith('LAP')) return 1
          if (gapB.startsWith('LAP') && !gapA.startsWith('LAP')) return -1
          const numA = parseFloat(gapA.replace('+', '')) || 999
          const numB = parseFloat(gapB.replace('+', '')) || 999
          return numA - numB
        })
    : []

  function getCurrentTyre(tyre: TyreData | undefined) {
    if (!tyre?.Stints) return { compound: 'UNKNOWN', laps: 0, isNew: false }
    const stints = Object.values(tyre.Stints)
    const last = stints[stints.length - 1]
    return { compound: last?.Compound ?? 'UNKNOWN', laps: last?.TotalLaps ?? 0, isNew: last?.New === 'true' }
  }

  const sessionName = liveState?.session?.Name ?? ''
  const sessionLabel = SESSION_LABELS[sessionName] ?? sessionName
  const meetingName = liveState?.session?.Meeting?.Name ?? ''
  const hasData = sortedDrivers.length > 0
  const weather = liveState?.weather
  const trackStatusCode = liveState?.track_status?.Status ?? '1'
  const trackStatusInfo = TRACK_STATUS_INFO[trackStatusCode]
  const lapCount = liveState?.session_data?.LapCount
  const totalLaps = lapCount?.TotalLaps
  const currentLap = lapCount?.CurrentLap
  const isRace = sessionName === 'Race' || sessionName === 'Sprint'

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">
              <span style={{ color: 'var(--f1-red)' }}>🔴 Live</span> Timing
            </h1>
            <span className="text-sm font-bold px-3 py-1 rounded-full"
              style={{
                background: connected ? '#00a55022' : '#e1060022',
                color: connected ? '#00a550' : '#e10600',
                border: `1px solid ${connected ? '#00a550' : '#e10600'}`,
              }}>
              {connected ? '⬤ Conectado' : '◯ Reconectando...'}
            </span>
          </div>

          {meetingName && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>📍 {meetingName}</p>
              {sessionLabel && (
                <span className="text-sm font-bold px-3 py-0.5 rounded-full"
                  style={{ background: 'var(--f1-light-gray)' }}>
                  {sessionLabel}
                </span>
              )}
              {isRace && currentLap && totalLaps && (
                <span className="text-sm font-bold px-3 py-0.5 rounded-full"
                  style={{ background: 'var(--f1-red)', color: '#fff' }}>
                  Vuelta {currentLap} / {totalLaps}
                </span>
              )}
              {!isRace && remainingTime && (
                <span className="text-sm font-bold px-3 py-0.5 rounded-full"
                  style={{ background: '#ffd700', color: '#000' }}>
                  ⏱ {remainingTime}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {hasData && trackStatusInfo && (
            <span className="text-sm font-bold px-3 py-1 rounded-full"
              style={{ background: trackStatusInfo.color + '22', color: trackStatusInfo.color, border: `1px solid ${trackStatusInfo.color}` }}>
              {trackStatusInfo.emoji} {trackStatusInfo.label}
            </span>
          )}
          {lastUpdate && (
            <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>
              🔄 {lastUpdate.toLocaleTimeString('es-AR')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* Tabla */}
        <div className="xl:col-span-3">
          <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--f1-gray)' }}>
            <div
              className="hidden md:grid gap-2 px-4 py-2 text-xs font-semibold uppercase"
              style={{ color: 'var(--f1-muted)', borderBottom: '1px solid var(--f1-light-gray)', gridTemplateColumns: '36px 36px 150px 80px 90px 90px 110px 80px 80px 80px 32px' }}
            >
              <span>Pos</span><span>#</span><span>Piloto</span><span>Neum.</span>
              <span>Última V.</span><span>Mejor V.</span><span>Gap / Int.</span>
              <span>S1</span><span>S2</span><span>S3</span><span>Pit</span>
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
                  const teamColor = info?.teamColor ? `#${info.teamColor}` : (data.TeamColour ? `#${data.TeamColour}` : '#888')
                  const sectors = data.Sectors ?? {}
                  const lapColor = data.LastLapTime?.OverallFastest ? '#a855f7' : data.LastLapTime?.PersonalFastest ? '#00a550' : 'inherit'
                  const isRetired = data.Retired
                  const statusLabel = isRetired ? '❌ RET' : data.InPit ? '🔧 PIT' : data.PitOut ? '📤 OUT' : data.Stopped ? '🔴 STP' : null
                  const gap = pos === 1 ? 'Líder' : (data.GapToLeader ?? '—')
                  const interval = data.IntervalToPositionAhead?.Value
                  const acronym = info?.acronym ?? data.Tla ?? num
                  const team = info?.team ?? data.TeamName ?? '—'
                  const flag = info?.flag ?? ''

                  return (
                    <div key={num} style={{ opacity: isRetired ? 0.5 : 1 }}>
                      {/* Desktop */}
                      <div
                        className="hidden md:grid items-center gap-2 px-4 py-2 text-sm"
                        style={{
                          gridTemplateColumns: '36px 36px 150px 80px 90px 90px 110px 80px 80px 80px 32px',
                          borderLeft: `3px solid ${teamColor}`,
                          background: statusLabel && !isRetired ? '#ffffff08' : 'transparent',
                        }}
                      >
                        <span className="font-bold text-base" style={{ color: pos === 1 ? 'var(--f1-red)' : 'inherit' }}>{pos}</span>
                        <span className="text-xs font-bold" style={{ color: teamColor }}>{num}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            {flag && <span className="text-sm">{flag}</span>}
                            <span className="font-bold text-sm truncate">{acronym}</span>
                            {statusLabel && <span className="text-xs ml-1" style={{ color: 'var(--f1-muted)' }}>{statusLabel}</span>}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--f1-muted)' }}>{team}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{
                              background: TYRE_COLORS[compound],
                              color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff',
                              border: isNew ? '2px solid white' : 'none',
                            }}
                          >{TYRE_LABELS[compound]}</span>
                          <span className="text-xs font-mono">{laps > 0 ? laps : '—'}</span>
                        </div>
                        <span className="font-mono text-xs" style={{ color: lapColor }}>{data.LastLapTime?.Value ?? '—'}</span>
                        <span className="font-mono text-xs" style={{ color: 'var(--f1-muted)' }}>{data.BestLapTime?.Value ?? '—'}</span>
                        <div>
                          <div className="font-mono text-xs" style={{ color: pos === 1 ? '#00a550' : 'inherit' }}>{gap}</div>
                          {interval && pos !== 1 && (
                            <div className="font-mono text-xs" style={{ color: '#ffd700' }}>↑ {interval}</div>
                          )}
                        </div>
                        <SectorTime sector={sectors['0']} />
                        <SectorTime sector={sectors['1']} />
                        <SectorTime sector={sectors['2']} />
                        <span className="text-xs text-center font-bold" style={{ color: 'var(--f1-muted)' }}>
                          {data.NumberOfPitStops ? data.NumberOfPitStops : '—'}
                        </span>
                      </div>

                      {/* Mobile */}
                      <div className="md:hidden flex items-center gap-3 px-4 py-3"
                        style={{ borderLeft: `3px solid ${teamColor}` }}>
                        <span className="w-7 text-center font-bold text-sm shrink-0"
                          style={{ color: pos === 1 ? 'var(--f1-red)' : 'inherit' }}>{pos}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {flag && <span>{flag}</span>}
                            <span className="font-bold text-sm">{acronym}</span>
                            {statusLabel && <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{statusLabel}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
                              style={{ background: TYRE_COLORS[compound], color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff' }}>
                              {TYRE_LABELS[compound]}
                            </span>
                            <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>{laps > 0 ? `${laps}v` : '—'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold" style={{ color: lapColor }}>{data.LastLapTime?.Value ?? '—'}</div>
                          <div className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>{gap}</div>
                          {interval && pos !== 1 && (
                            <div className="text-xs font-mono" style={{ color: '#ffd700' }}>↑ {interval}</div>
                          )}
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
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>🌤 Condiciones</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Aire</p><p className="font-bold">{weather.AirTemp ?? '—'}°C</p></div>
                <div><p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Pista</p><p className="font-bold">{weather.TrackTemp ?? '—'}°C</p></div>
                <div><p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Humedad</p><p className="font-bold">{weather.Humidity ?? '—'}%</p></div>
                <div><p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Viento</p><p className="font-bold">{weather.WindSpeed ?? '—'} km/h</p></div>
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
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>📻 Race Control</h3>
              <div className="flex flex-col gap-2">
                {[...liveState.race_control].reverse().slice(0, 8).map((msg, i) => (
                  <div key={i} className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'var(--f1-light-gray)', borderLeft: `3px solid ${FLAG_COLORS[msg.Flag ?? ''] ?? '#888'}` }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {msg.Flag && <span className="font-semibold" style={{ color: FLAG_COLORS[msg.Flag] ?? '#fff' }}>{msg.Flag}</span>}
                      {msg.Lap && <span style={{ color: 'var(--f1-muted)' }}>Vuelta {msg.Lap}</span>}
                    </div>
                    <p style={{ color: 'var(--f1-muted)' }}>{msg.Message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasData && (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--f1-gray)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--f1-muted)' }}>Info</h3>
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