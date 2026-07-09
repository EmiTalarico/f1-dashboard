'use client'

import { useState, useEffect, useRef } from 'react'
import { F1_DRIVERS } from '../data/f1drivers'

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws/live'
const BASE_DELAY_MS = 10000

const NATIONALITY_CODES: Record<string, string> = {
  British: 'gb', Dutch: 'nl', Monegasque: 'mc', Spanish: 'es',
  Australian: 'au', Mexican: 'mx', Finnish: 'fi', German: 'de',
  French: 'fr', Canadian: 'ca', Thai: 'th', Japanese: 'jp',
  Italian: 'it', Brazilian: 'br', Argentine: 'ar', American: 'us',
  Danish: 'dk', Chinese: 'cn', Austrian: 'at', 'New Zealander': 'nz',
  Belgian: 'be', Polish: 'pl', Russian: 'ru', Swedish: 'se',
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
  Retired?: boolean
  Status?: number
  Tla?: string
  FullName?: string
  TeamName?: string
  TeamColour?: string
  CountryCode?: string
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
  INTERMEDIATE: '#00a550', WET: '#0057b8', UNKNOWN: '#555',
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
  'Practice 1': 'Práctica 1', 'Practice 2': 'Práctica 2',
  'Practice 3': 'Práctica 3', 'Qualifying': 'Clasificación',
  'Sprint Qualifying': 'Sprint Qualifying', 'Sprint Shootout': 'Sprint Shootout',
  'Sprint': 'Sprint', 'Race': 'Carrera',
}
const SESSION_COLORS: Record<string, string> = {
  'Practice 1': '#22c55e', 'Practice 2': '#22c55e', 'Practice 3': '#22c55e',
  'Qualifying': '#ffd700', 'Sprint Qualifying': '#ffd700', 'Sprint Shootout': '#ffd700',
  'Sprint': '#f97316', 'Race': '#e10600',
}
const TRACK_STATUS_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  '1': { label: 'Pista despejada', color: '#00a550', emoji: '🟢' },
  '2': { label: 'Bandera amarilla', color: '#ffd700', emoji: '🟡' },
  '3': { label: 'Bandera verde',    color: '#00a550', emoji: '🟢' },
  '4': { label: 'Safety Car',       color: '#ffd700', emoji: '🚗' },
  '5': { label: 'Bandera roja',     color: '#e10600', emoji: '🔴' },
  '6': { label: 'Virtual SC',       color: '#ffd700', emoji: '⚠️' },
  '7': { label: 'Virtual SC fin',   color: '#ffd700', emoji: '⚠️' },
}
const SEGMENT_COLORS: Record<number, string> = {
  2048: '#ffd700', 2049: '#00a550', 2051: '#a855f7', 2052: '#a855f7',
  2064: '#555', 0: '#2a2a2a',
}

function useExtrapolatedClock(clock: any): string {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    if (!clock?.Remaining) { setRemaining(''); return }
    if (!clock.Extrapolating) { setRemaining(clock.Remaining); return }
    const calc = () => {
      const [h, m, s] = clock.Remaining.split(':').map(Number)
      const total = h * 3600 + m * 60 + s
      const elapsed = (Date.now() - new Date(clock.Utc).getTime()) / 1000
      const left = Math.max(0, total - elapsed)
      const lh = Math.floor(left / 3600)
      const lm = Math.floor((left % 3600) / 60)
      const ls = Math.floor(left % 60)
      return `${lh > 0 ? lh + ':' : ''}${String(lm).padStart(2, '0')}:${String(ls).padStart(2, '0')}`
    }
    setRemaining(calc())
    const iv = setInterval(() => setRemaining(calc()), 1000)
    return () => clearInterval(iv)
  }, [clock])
  return remaining
}

function mergeTiming(prev: LiveState['timing'], next: LiveState['timing']): LiveState['timing'] {
  const merged = { ...prev }
  for (const [num, data] of Object.entries(next)) {
    if (!merged[num]) { merged[num] = { ...data }; continue }
    const prevDriver = merged[num]
    const newDriver = { ...prevDriver, ...data }
    if (data.Sectors) {
      newDriver.Sectors = { ...prevDriver.Sectors }
      for (const [sKey, sector] of Object.entries(data.Sectors)) {
        const prevSector = prevDriver.Sectors?.[sKey] ?? {}
        if (sector.Segments) {
          newDriver.Sectors[sKey] = {
            ...prevSector, ...sector,
            Segments: { ...prevSector.Segments, ...sector.Segments },
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

function DriverFlag({ countryCode, nationality }: { countryCode?: string; nationality?: string }) {
  const code = countryCode?.toLowerCase() ?? (nationality ? NATIONALITY_CODES[nationality] : null)
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/w20/${code}.png`}
      alt={nationality ?? code}
      className="w-4 h-3 object-cover rounded-sm shrink-0"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
    />
  )
}

function SectorTime({ sector }: {
  sector?: { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean; Segments?: { [k: string]: { Status: number } } }
}) {
  if (!sector) return <div className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>—</div>
  const color = sector.OverallFastest ? '#a855f7' : sector.PersonalFastest ? '#00a550' : 'var(--f1-muted)'
  const segments = sector.Segments
    ? Object.entries(sector.Segments).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([, v]) => v)
    : []
  return (
    <div>
      <div className="text-xs font-mono font-bold" style={{ color }}>{sector.Value || '—'}</div>
      {segments.length > 0 && (
        <div className="flex gap-px mt-1">
          {segments.map((seg, i) => (
            <div key={i} className="rounded-sm flex-1"
              style={{ background: SEGMENT_COLORS[seg.Status] ?? '#2a2a2a', height: 3, minWidth: 4 }} />
          ))}
        </div>
      )}
    </div>
  )
}

type BufferItem = { msg: any; releaseAt: number }

export default function LiveTimingPage() {
  const [liveState, setLiveState] = useState<LiveState | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [paused, setPaused] = useState(false)
  const [bufferCount, setBufferCount] = useState(0)
  const [delaySeconds, setDelaySeconds] = useState(BASE_DELAY_MS / 1000)

  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<{ timing: LiveState['timing'] | null; other: Partial<LiveState> }>({ timing: null, other: {} })
  const bufferRef = useRef<BufferItem[]>([])
  const extraDelayRef = useRef(0)
  const pausedRef = useRef(false)
  const pauseStartedAtRef = useRef<number | null>(null)
  const releaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function applyMessage(msg: any) {
    if (msg.topic === 'ping') return
    if (msg.topic === 'snapshot') {
      setLiveState(msg.data)
    } else if (msg.topic === 'timing') {
      pendingRef.current.timing = pendingRef.current.timing
        ? mergeTiming(pendingRef.current.timing, msg.data)
        : msg.data
    } else {
      const key = msg.topic === 'tyres' ? 'tyres'
        : msg.topic === 'weather' ? 'weather'
        : msg.topic === 'race_control' ? 'race_control'
        : msg.topic === 'session' ? 'session'
        : msg.topic === 'track_status' ? 'track_status'
        : msg.topic === 'timing_stats' ? 'timing_stats'
        : null
      if (msg.topic === 'session_data') {
        pendingRef.current.other.session_data = {
          ...(pendingRef.current.other.session_data ?? {}), ...msg.data,
        }
      } else if (key) {
        ;(pendingRef.current.other as any)[key] = msg.data
      }
    }
    setLastUpdate(new Date())
  }

  useEffect(() => {
    releaseTimerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        const now = Date.now()
        while (bufferRef.current.length > 0 && bufferRef.current[0].releaseAt <= now) {
          applyMessage(bufferRef.current.shift()!.msg)
        }
      }
      setBufferCount(bufferRef.current.length)
    }, 200)

    flushTimerRef.current = setInterval(() => {
      const pending = pendingRef.current
      if (!pending.timing && Object.keys(pending.other).length === 0) return
      setLiveState(prev => {
        if (!prev) return prev
        const next = { ...prev, ...pending.other }
        if (pending.timing) next.timing = mergeTiming(prev.timing, pending.timing)
        return next
      })
      pendingRef.current = { timing: null, other: {} }
    }, 200)

    return () => {
      if (releaseTimerRef.current) clearInterval(releaseTimerRef.current)
      if (flushTimerRef.current) clearInterval(flushTimerRef.current)
    }
  }, [])

  function togglePause() {
    setPaused(p => {
      const next = !p
      pausedRef.current = next
      if (next) {
        pauseStartedAtRef.current = Date.now()
      } else if (pauseStartedAtRef.current) {
        const pausedFor = Date.now() - pauseStartedAtRef.current
        extraDelayRef.current += pausedFor
        setDelaySeconds(Math.round((BASE_DELAY_MS + extraDelayRef.current) / 1000))
        pauseStartedAtRef.current = null
      }
      return next
    })
  }

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.topic === 'ping') return
          if (msg.topic === 'snapshot') { applyMessage(msg); return }
          const totalDelay = BASE_DELAY_MS + extraDelayRef.current
          bufferRef.current.push({ msg, releaseAt: Date.now() + totalDelay })
          setBufferCount(bufferRef.current.length)
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
  const sessionName = liveState?.session?.Name ?? ''
  const sessionLabel = SESSION_LABELS[sessionName] ?? sessionName
  const sessionColor = SESSION_COLORS[sessionName] ?? '#888'
  const meetingName = liveState?.session?.Meeting?.Name ?? ''
  const lapCount = liveState?.session_data?.LapCount
  const isRace = sessionName === 'Race' || sessionName === 'Sprint'
  const trackStatusCode = liveState?.track_status?.Status ?? '1'
  const trackStatusInfo = TRACK_STATUS_INFO[trackStatusCode]
  const weather = liveState?.weather

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
          const numA = parseFloat(gapA.replace('+', '')) || 999
          const numB = parseFloat(gapB.replace('+', '')) || 999
          return numA - numB
        })
    : []

  const hasData = sortedDrivers.length > 0

  function getCurrentTyre(tyre: TyreData | undefined) {
    if (!tyre?.Stints) return { compound: 'UNKNOWN', laps: 0, isNew: false }
    const stints = Object.values(tyre.Stints)
    const last = stints[stints.length - 1]
    return { compound: last?.Compound ?? 'UNKNOWN', laps: last?.TotalLaps ?? 0, isNew: last?.New === 'true' }
  }

  const CARD = {
    background: 'var(--f1-card-gradient)',
    border: '1px solid var(--f1-card-border)',
    boxShadow: 'var(--f1-card-shadow)',
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">

      {/* ── Header card ── */}
      <div
        className="rounded-2xl px-6 py-4 mb-6"
        style={{
          background: hasData
            ? `linear-gradient(135deg, ${sessionColor}12, rgba(0,0,0,0))`
            : 'var(--f1-card-gradient)',
          border: `1px solid ${hasData ? sessionColor + '30' : 'var(--f1-card-border)'}`,
          boxShadow: hasData ? `0 0 40px ${sessionColor}08` : 'var(--f1-card-shadow)',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Izquierda: título + info de sesión */}
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-black tracking-tight">
                <span style={{ color: 'var(--f1-red)' }}>LIVE</span>
                <span className="ml-2 font-light" style={{ color: 'var(--f1-muted)' }}>TIMING</span>
              </h1>

              {/* Estado de conexión */}
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: connected ? 'rgba(34,197,94,0.12)' : 'rgba(225,6,0,0.12)',
                  color: connected ? '#22c55e' : '#e10600',
                  border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'rgba(225,6,0,0.3)'}`,
                }}
              >
                {connected ? '⬤ Conectado' : '◯ Reconectando'}
              </span>

              {/* Sesión */}
              {sessionLabel && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: sessionColor + '18',
                    color: sessionColor,
                    border: `1px solid ${sessionColor}40`,
                  }}
                >
                  {sessionLabel}
                </span>
              )}
            </div>

            {/* Meeting + circuito */}
            {meetingName && (
              <p className="text-sm font-medium" style={{ color: 'var(--f1-muted)' }}>
                📍 {meetingName}
                {liveState?.session?.Meeting?.Circuit?.ShortName && (
                  <span className="ml-1">· {liveState.session.Meeting.Circuit.ShortName}</span>
                )}
              </p>
            )}
          </div>

          {/* Derecha: tiempo restante / vuelta + estado pista + controls */}
          <div className="flex flex-col items-end gap-2">
            {/* Tiempo restante o vuelta actual */}
            {hasData && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isRace && lapCount?.CurrentLap && lapCount?.TotalLaps && (
                  <div
                    className="text-sm font-black px-3 py-1.5 rounded-xl"
                    style={{ background: 'rgba(225,6,0,0.15)', color: '#e10600', border: '1px solid rgba(225,6,0,0.3)' }}
                  >
                    VUELTA {lapCount.CurrentLap} <span style={{ opacity: 0.6 }}>/ {lapCount.TotalLaps}</span>
                  </div>
                )}
                {!isRace && remainingTime && (
                  <div
                    className="text-sm font-black px-3 py-1.5 rounded-xl font-mono"
                    style={{ background: 'rgba(255,215,0,0.12)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}
                  >
                    ⏱ {remainingTime}
                  </div>
                )}
                {trackStatusInfo && (
                  <div
                    className="text-xs font-bold px-2.5 py-1.5 rounded-xl"
                    style={{
                      background: trackStatusInfo.color + '15',
                      color: trackStatusInfo.color,
                      border: `1px solid ${trackStatusInfo.color}35`,
                    }}
                  >
                    {trackStatusInfo.emoji} {trackStatusInfo.label}
                  </div>
                )}
              </div>
            )}

            {/* Controls + delay */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePause}
                className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-150 active:scale-95"
                style={{
                  background: paused ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.06)',
                  color: paused ? '#ffd700' : 'var(--f1-muted)',
                  border: `1px solid ${paused ? 'rgba(255,215,0,0.3)' : 'var(--f1-card-border)'}`,
                }}
              >
                {paused ? `⏸ Pausado +${bufferCount}` : '⏸ Pausar'}
              </button>
              <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>
                delay {delaySeconds}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layout principal ── */}
      <div className={hasData ? 'grid grid-cols-1 xl:grid-cols-4 gap-4' : ''}>

        {/* ── Tabla timing ── */}
        <div className={hasData ? 'xl:col-span-3' : ''}>
          <div className="rounded-2xl overflow-hidden" style={CARD}>

            {/* Header columnas */}
            <div
              className="hidden md:grid px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
              style={{
                color: 'var(--f1-muted)',
                borderBottom: '1px solid var(--f1-card-border)',
                gridTemplateColumns: '32px 36px 1fr 72px 90px 90px 110px 76px 76px 76px 28px',
                gap: '8px',
              }}
            >
              <span>Pos</span>
              <span>#</span>
              <span>Piloto</span>
              <span>Neum.</span>
              <span>Última</span>
              <span>Mejor</span>
              <span>Gap / Int.</span>
              <span>S1</span>
              <span>S2</span>
              <span>S3</span>
              <span>Pit</span>
            </div>

            {/* Sin sesión */}
            {!hasData ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="text-5xl">🏁</div>
                <div className="text-center">
                  <p className="font-bold text-lg mb-1">Sin sesión activa</p>
                  <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>
                    Los datos aparecerán automáticamente cuando empiece la sesión
                  </p>
                </div>
                {lastUpdate && (
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                    Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--f1-card-border)' }}>
                {sortedDrivers.map(({ num, data, tyre, info }, index) => {
                  const { compound, laps, isNew } = getCurrentTyre(tyre)
                  const pos = data.Position ? parseInt(data.Position) : (index + 1)
                  const teamColor = info?.teamColor ? `#${info.teamColor}` : (data.TeamColour ? `#${data.TeamColour}` : '#666')
                  const sectors = data.Sectors ?? {}
                  const lapColor = data.LastLapTime?.OverallFastest ? '#a855f7' : data.LastLapTime?.PersonalFastest ? '#22c55e' : 'inherit'
                  const isRetired = data.Retired
                  const statusLabel = isRetired ? 'RET' : data.InPit ? 'PIT' : data.PitOut ? 'OUT' : data.Stopped ? 'STP' : null
                  const statusColor = isRetired ? '#f87171' : data.InPit ? '#ffd700' : data.PitOut ? '#22c55e' : '#f87171'
                  const gap = pos === 1 ? 'LÍDER' : (data.GapToLeader ?? '—')
                  const interval = data.IntervalToPositionAhead?.Value
                  const acronym = info?.acronym ?? data.Tla ?? num
                  const team = info?.team ?? data.TeamName ?? '—'
                  const countryCode = data.CountryCode?.toLowerCase()

                  return (
                    <div
                      key={num}
                      style={{
                        opacity: isRetired ? 0.45 : 1,
                        background: pos <= 3 ? `${teamColor}06` : 'transparent',
                      }}
                    >
                      {/* Desktop */}
                      <div
                        className="hidden md:grid items-center px-5 py-2.5 text-sm transition-colors duration-100 hover:bg-white/[0.02]"
                        style={{
                          gridTemplateColumns: '32px 36px 1fr 72px 90px 90px 110px 76px 76px 76px 28px',
                          gap: '8px',
                          borderLeft: `3px solid ${teamColor}`,
                        }}
                      >
                        {/* Pos */}
                        <span
                          className="font-black text-sm"
                          style={{ color: pos === 1 ? 'var(--f1-red)' : pos <= 3 ? '#fff' : 'var(--f1-muted)' }}
                        >
                          {pos}
                        </span>

                        {/* Número */}
                        <span className="text-xs font-black" style={{ color: teamColor }}>
                          {num}
                        </span>

                        {/* Piloto */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <DriverFlag countryCode={countryCode} nationality={data.CountryCode} />
                            <span className="font-bold text-sm truncate">{acronym}</span>
                            {statusLabel && (
                              <span
                                className="text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{ background: statusColor + '20', color: statusColor }}
                              >
                                {statusLabel}
                              </span>
                            )}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--f1-muted)' }}>{team}</div>
                        </div>

                        {/* Neumático */}
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{
                              background: TYRE_COLORS[compound],
                              color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff',
                              boxShadow: isNew ? '0 0 0 2px #fff' : 'none',
                            }}
                          >
                            {TYRE_LABELS[compound]}
                          </div>
                          <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>
                            {laps > 0 ? laps : '—'}
                          </span>
                        </div>

                        {/* Última vuelta */}
                        <span className="font-mono text-xs font-bold" style={{ color: lapColor }}>
                          {data.LastLapTime?.Value ?? '—'}
                        </span>

                        {/* Mejor vuelta */}
                        <span className="font-mono text-xs" style={{ color: 'var(--f1-muted)' }}>
                          {data.BestLapTime?.Value ?? '—'}
                        </span>

                        {/* Gap / Interval */}
                        <div>
                          <div
                            className="font-mono text-xs font-bold"
                            style={{ color: pos === 1 ? '#22c55e' : 'inherit' }}
                          >
                            {gap}
                          </div>
                          {interval && pos !== 1 && (
                            <div className="font-mono text-xs" style={{ color: '#ffd700' }}>
                              ↑ {interval}
                            </div>
                          )}
                        </div>

                        {/* Sectores */}
                        <SectorTime sector={sectors['0']} />
                        <SectorTime sector={sectors['1']} />
                        <SectorTime sector={sectors['2']} />

                        {/* Pits */}
                        <span
                          className="text-xs text-center font-bold"
                          style={{ color: 'var(--f1-muted)' }}
                        >
                          {data.NumberOfPitStops ?? '—'}
                        </span>
                      </div>

                      {/* Mobile */}
                      <div
                        className="md:hidden flex items-center gap-3 px-4 py-3"
                        style={{ borderLeft: `3px solid ${teamColor}` }}
                      >
                        <span
                          className="w-6 text-center font-black text-sm shrink-0"
                          style={{ color: pos === 1 ? 'var(--f1-red)' : 'var(--f1-muted)' }}
                        >
                          {pos}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <DriverFlag countryCode={countryCode} />
                            <span className="font-bold text-sm">{acronym}</span>
                            {statusLabel && (
                              <span className="text-xs font-bold" style={{ color: statusColor }}>{statusLabel}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                              style={{ background: TYRE_COLORS[compound], color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff' }}
                            >
                              {TYRE_LABELS[compound]}
                            </div>
                            <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>
                              {laps > 0 ? `${laps}v` : '—'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold" style={{ color: lapColor }}>
                            {data.LastLapTime?.Value ?? '—'}
                          </div>
                          <div className="text-xs font-mono" style={{ color: pos === 1 ? '#22c55e' : 'var(--f1-muted)' }}>
                            {gap}
                          </div>
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

        {/* ── Panel lateral ── */}
        {hasData && (
          <div className="flex flex-col gap-4">

            {/* Condiciones */}
            {weather && Object.keys(weather).length > 0 && (
              <div className="rounded-2xl px-5 py-4" style={CARD}>
                <h3
                  className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: 'var(--f1-muted)' }}
                >
                  Condiciones
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Aire', value: weather.AirTemp ? `${weather.AirTemp}°C` : '—' },
                    { label: 'Pista', value: weather.TrackTemp ? `${weather.TrackTemp}°C` : '—' },
                    { label: 'Humedad', value: weather.Humidity ? `${weather.Humidity}%` : '—' },
                    { label: 'Viento', value: weather.WindSpeed ? `${weather.WindSpeed} km/h` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--f1-muted)' }}>{label}</p>
                      <p className="font-bold text-sm">{value}</p>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <p className="text-xs mb-0.5" style={{ color: 'var(--f1-muted)' }}>Lluvia</p>
                    <p className="font-bold text-sm" style={{ color: weather.Rainfall === '1' ? '#60a5fa' : 'inherit' }}>
                      {weather.Rainfall === '1' ? '🌧 Sí' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Race Control */}
            {liveState?.race_control && liveState.race_control.length > 0 && (
              <div className="rounded-2xl px-5 py-4" style={CARD}>
                <h3
                  className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: 'var(--f1-muted)' }}
                >
                  Race Control
                </h3>
                <div className="flex flex-col gap-2">
                  {[...liveState.race_control].reverse().slice(0, 8).map((msg, i) => (
                    <div
                      key={i}
                      className="text-xs px-3 py-2.5 rounded-xl"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderLeft: `3px solid ${FLAG_COLORS[msg.Flag ?? ''] ?? 'var(--f1-card-border)'}`,
                      }}
                    >
                      {(msg.Flag || msg.Lap) && (
                        <div className="flex items-center gap-2 mb-1">
                          {msg.Flag && (
                            <span className="font-bold text-xs" style={{ color: FLAG_COLORS[msg.Flag] ?? '#fff' }}>
                              {msg.Flag}
                            </span>
                          )}
                          {msg.Lap && (
                            <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                              V{msg.Lap}
                            </span>
                          )}
                        </div>
                      )}
                      <p style={{ color: 'var(--f1-muted)', lineHeight: 1.4 }}>{msg.Message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </main>
  )
}