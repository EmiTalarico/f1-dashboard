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

// ── Types ──────────────────────────────────────────────────────────────────
type SectorData = {
  Value?: string
  OverallFastest?: boolean
  PersonalFastest?: boolean
  Segments?: { [key: string]: { Status: number } }
}

type DriverTiming = {
  Position?: string
  GapToLeader?: string
  IntervalToPositionAhead?: { Value: string }
  LastLapTime?: { Value: string; OverallFastest?: boolean; PersonalFastest?: boolean }
  BestLapTime?: { Value: string; Lap?: number }
  Sectors?: { [key: string]: SectorData }
  NumberOfLaps?: number
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

type DriverStats = {
  PersonalBestLapTime?: { Value: string; Lap?: number; Position?: number }
  BestSectors?: { [key: string]: { Value: string; Position?: number } }
  BestSpeeds?: {
    I1?: { Value: string; Position?: number }
    I2?: { Value: string; Position?: number }
    FL?: { Value: string; Position?: number }
    ST?: { Value: string; Position?: number }
  }
}

type TyreData = {
  Stints?: { [key: string]: { Compound?: string; TotalLaps?: number; New?: string } }
}

type SessionInfo = {
  Meeting?: { Name: string; Circuit?: { ShortName: string } }
  Name?: string
}

type Weather = {
  AirTemp?: string; TrackTemp?: string
  Humidity?: string; WindSpeed?: string; Rainfall?: string
}

type RaceControlMessage = {
  Message?: string; Flag?: string; Lap?: number
}

type TrackStatus = { Status?: string }

type LiveState = {
  connected: boolean
  session: SessionInfo
  timing: { [num: string]: DriverTiming }
  tyres: { [num: string]: TyreData }
  weather: Weather
  race_control: RaceControlMessage[]
  session_data: any
  track_status: TrackStatus
  timing_stats: { [num: string]: DriverStats }
}

// Historial de tiempos de sector por piloto y sector
// { [driverNum]: { [sectorKey]: number[] } }  (tiempos en segundos)
type SectorHistory = { [driverNum: string]: { [sectorKey: string]: number[] } }

// ── Constants ──────────────────────────────────────────────────────────────
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
  'Practice 1': '#00aeff', 'Practice 2': '#0004ff', 'Practice 3': '#8000ff',
  'Qualifying': '#00c43e', 'Sprint Qualifying': '#73ff00', 'Sprint Shootout': '#ffd700',
  'Sprint': '#ffd700', 'Race': '#ff0800',
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

// Colores de segmentos según status del feed F1
const SEGMENT_COLORS: Record<number, string> = {
  2048: '#ffd700',  // amarillo — no mejoró tiempo personal
  2049: '#00a550',  // verde — mejor tiempo personal
  2051: '#a855f7',  // violeta — mejor tiempo absoluto
  2052: '#a855f7',  // violeta variante
  2064: '#444',     // gris — pit lane
  0:    '#2a2a2a',  // sin datos
}

const CARD = {
  background: 'var(--f1-card-gradient)',
  border: '1px solid var(--f1-card-border)',
  boxShadow: 'var(--f1-card-shadow)',
} as const

// ── Helpers ────────────────────────────────────────────────────────────────

// Convierte "1:23.456" o "23.456" a segundos
function sectorToSeconds(value: string): number | null {
  if (!value || value === '—') return null
  const parts = value.split(':')
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  }
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

// Determina el color del TIEMPO de sector basado en historial
// Violeta > Verde > Amarillo > Rojo
function getSectorTimeColor(
  sector: SectorData | undefined,
  driverNum: string,
  sectorKey: string,
  history: SectorHistory,
): string {
  if (!sector?.Value) return 'rgba(255,255,255,0.4)'

  // Overall fastest — violeta sin necesidad de calcular
  if (sector.OverallFastest) return '#a855f7'

  // Personal best — verde
  if (sector.PersonalFastest) return '#00a550'

  // Para amarillo/rojo necesitamos historial
  const driverHistory = history[driverNum]?.[sectorKey]
  if (!driverHistory || driverHistory.length < 2) {
    // Sin historial suficiente — amarillo por defecto
    return '#ffd700'
  }

  const current = sectorToSeconds(sector.Value)
  if (current === null) return '#ffd700'

  const worst = Math.max(...driverHistory)

  // Si el tiempo actual es el peor del historial — rojo
  if (current >= worst) return '#e10600'

  // No mejoró personal best pero tampoco es el peor — amarillo
  return '#ffd700'
}

// ── Hooks ──────────────────────────────────────────────────────────────────
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

// ── Merge functions ────────────────────────────────────────────────────────
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
          const prevSegs = prevSector.Segments ?? {}
          const mergedSegs: { [k: string]: { Status: number } } = { ...prevSegs }
          for (const [segKey, segVal] of Object.entries(sector.Segments)) {
            const prevStatus = prevSegs[segKey]?.Status ?? 0
            // Status 0 no sobreescribe un color ya pintado
            if (segVal.Status === 0 && prevStatus !== 0) continue
            mergedSegs[segKey] = segVal
          }
          newDriver.Sectors[sKey] = { ...prevSector, ...sector, Segments: mergedSegs }
        } else {
          newDriver.Sectors[sKey] = { ...prevSector, ...sector }
        }
      }
    }
    merged[num] = newDriver
  }
  return merged
}

function mergeTimingStats(
  prev: LiveState['timing_stats'],
  next: LiveState['timing_stats']
): LiveState['timing_stats'] {
  const merged = { ...prev }
  for (const [num, data] of Object.entries(next)) {
    merged[num] = { ...(merged[num] ?? {}), ...data }
    if (data.BestSectors) merged[num].BestSectors = { ...(merged[num].BestSectors ?? {}), ...data.BestSectors }
    if (data.BestSpeeds) merged[num].BestSpeeds = { ...(merged[num].BestSpeeds ?? {}), ...data.BestSpeeds }
  }
  return merged
}

// Actualiza el historial de tiempos de sector cuando llega un Value completo
function updateSectorHistory(
  prev: SectorHistory,
  driverNum: string,
  sectorKey: string,
  value: string,
): SectorHistory {
  const seconds = sectorToSeconds(value)
  if (seconds === null) return prev
  const driverHistory = prev[driverNum] ?? {}
  const sectorTimes = driverHistory[sectorKey] ?? []
  // Evitar duplicados consecutivos
  if (sectorTimes[sectorTimes.length - 1] === seconds) return prev
  return {
    ...prev,
    [driverNum]: {
      ...driverHistory,
      [sectorKey]: [...sectorTimes, seconds],
    },
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function DriverFlag({ countryCode }: { countryCode?: string }) {
  const code = countryCode?.toLowerCase()
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/w20/${code}.png`}
      alt={code}
      className="w-4 h-3 object-cover rounded-sm shrink-0"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
    />
  )
}

function MiniSectors({
  sector,
  driverNum,
  sectorKey,
  history,
}: {
  sector?: SectorData
  driverNum: string
  sectorKey: string
  history: SectorHistory
}) {
  if (!sector) return <div className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>—</div>

  const timeColor = getSectorTimeColor(sector, driverNum, sectorKey, history)
  const segments = sector.Segments
    ? Object.entries(sector.Segments)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([, v]) => v)
    : []

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-xs font-mono font-bold" style={{ color: timeColor }}>
        {sector.Value || '—'}
      </span>
      {segments.length > 0 && (
        <div className="flex gap-px">
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                background: SEGMENT_COLORS[seg.Status] ?? '#2a2a2a',
                height: 5,
                minWidth: 5,
                flex: 1,
                borderRadius: 2,
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExpandedDriverPanel({
  num,
  data,
  stats,
  teamColor,
  history,
}: {
  num: string
  data: DriverTiming
  stats?: DriverStats
  teamColor: string
  history: SectorHistory
}) {
  const sectors = data.Sectors ?? {}
  const bestSectors = stats?.BestSectors ?? {}
  const bestSpeeds = stats?.BestSpeeds

  const posColor = (pos?: number) =>
    !pos ? 'var(--f1-muted)' : pos === 1 ? '#a855f7' : pos <= 3 ? '#00a550' : 'rgba(255,255,255,0.6)'

  return (
    <div
      className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4"
      style={{ background: `${teamColor}08`, borderTop: `1px solid ${teamColor}20` }}
    >
      {/* Sectores actuales */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>
          Sectores (vuelta actual)
        </p>
        <div className="flex flex-col gap-2">
          {['0', '1', '2'].map((sKey, idx) => {
            const sector = sectors[sKey]
            const segs = sector?.Segments
              ? Object.entries(sector.Segments)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([, v]) => v)
              : []
            const timeColor = getSectorTimeColor(sector, num, sKey, history)
            return (
              <div key={sKey}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold w-5" style={{ color: teamColor }}>S{idx + 1}</span>
                  <span className="text-xs font-mono font-bold" style={{ color: timeColor }}>
                    {sector?.Value || '—'}
                  </span>
                  {sector?.OverallFastest && (
                    <span className="text-xs px-1.5 py-px rounded font-bold" style={{ background: '#a855f720', color: '#a855f7' }}>BEST</span>
                  )}
                  {sector?.PersonalFastest && !sector?.OverallFastest && (
                    <span className="text-xs px-1.5 py-px rounded font-bold" style={{ background: '#00a55020', color: '#00a550' }}>PB</span>
                  )}
                </div>
                {segs.length > 0 && (
                  <div className="flex gap-px">
                    {segs.map((seg, i) => (
                      <div
                        key={i}
                        style={{
                          background: SEGMENT_COLORS[seg.Status] ?? '#2a2a2a',
                          height: 7,
                          minWidth: 6,
                          flex: 1,
                          borderRadius: 2,
                          transition: 'background 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mejores sectores de sesión */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>
          Mejor sector (sesión)
        </p>
        <div className="flex flex-col gap-2">
          {['0', '1', '2'].map((sKey, idx) => {
            const best = bestSectors[sKey]
            return (
              <div key={sKey} className="flex items-center gap-2">
                <span className="text-xs font-bold w-5" style={{ color: teamColor }}>S{idx + 1}</span>
                <span className="text-xs font-mono font-bold" style={{ color: best ? posColor(best.Position) : 'var(--f1-muted)' }}>
                  {best?.Value ?? '—'}
                </span>
                {best?.Position && (
                  <span className="text-xs" style={{ color: posColor(best.Position) }}>P{best.Position}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Velocidades y datos extra */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>
          Velocidades & datos
        </p>
        <div className="flex flex-col gap-1.5 text-xs">
          {bestSpeeds?.ST && (
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--f1-muted)' }}>Speed trap</span>
              <span className="font-mono font-bold" style={{ color: posColor(bestSpeeds.ST.Position) }}>
                {bestSpeeds.ST.Value} km/h {bestSpeeds.ST.Position ? `P${bestSpeeds.ST.Position}` : ''}
              </span>
            </div>
          )}
          {bestSpeeds?.FL && (
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--f1-muted)' }}>Línea de meta</span>
              <span className="font-mono font-bold">{bestSpeeds.FL.Value} km/h</span>
            </div>
          )}
          {bestSpeeds?.I1 && (
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--f1-muted)' }}>Trampa S1</span>
              <span className="font-mono font-bold">{bestSpeeds.I1.Value} km/h</span>
            </div>
          )}
          {bestSpeeds?.I2 && (
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--f1-muted)' }}>Trampa S2</span>
              <span className="font-mono font-bold">{bestSpeeds.I2.Value} km/h</span>
            </div>
          )}
          {stats?.PersonalBestLapTime && (
            <div className="flex items-center justify-between mt-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--f1-muted)' }}>Mejor vuelta</span>
              <span className="font-mono font-bold" style={{ color: '#00a550' }}>
                {stats.PersonalBestLapTime.Value}
                {stats.PersonalBestLapTime.Lap && (
                  <span className="ml-1 font-normal" style={{ color: 'var(--f1-muted)' }}>V{stats.PersonalBestLapTime.Lap}</span>
                )}
              </span>
            </div>
          )}
          {data.NumberOfLaps !== undefined && (
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--f1-muted)' }}>Vueltas</span>
              <span className="font-mono font-bold">{data.NumberOfLaps}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Buffer type ────────────────────────────────────────────────────────────
type BufferItem = { msg: any; releaseAt: number }

// ── Main component ─────────────────────────────────────────────────────────
export default function LiveTimingPage() {
  const [liveState, setLiveState] = useState<LiveState | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [paused, setPaused] = useState(false)
  const [bufferCount, setBufferCount] = useState(0)
  const [delaySeconds, setDelaySeconds] = useState(BASE_DELAY_MS / 1000)
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null)
  const expandedDriverRef = useRef<string | null>(null)

  // Historial de tiempos de sector en memoria — persiste durante la sesión
  const sectorHistoryRef = useRef<SectorHistory>({})
  const [sectorHistory, setSectorHistory] = useState<SectorHistory>({})

  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<{
    timing: LiveState['timing'] | null
    timing_stats: LiveState['timing_stats'] | null
    other: Partial<LiveState>
  }>({ timing: null, timing_stats: null, other: {} })
  const bufferRef = useRef<BufferItem[]>([])
  const extraDelayRef = useRef(0)
  const pausedRef = useRef(false)
  const pauseStartedAtRef = useRef<number | null>(null)
  const releaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function toggleExpanded(num: string) {
    const next = expandedDriverRef.current === num ? null : num
    expandedDriverRef.current = next
    setExpandedDriver(next)
  }

  function applyMessage(msg: any) {
    if (msg.topic === 'ping') return
    if (msg.topic === 'snapshot') {
      setLiveState(msg.data)
      // Reset historial al recibir snapshot (nueva sesión)
      sectorHistoryRef.current = {}
      setSectorHistory({})
    } else if (msg.topic === 'timing') {
      pendingRef.current.timing = pendingRef.current.timing
        ? mergeTiming(pendingRef.current.timing, msg.data)
        : msg.data

      // Actualizar historial con tiempos de sector completados
      let historyUpdated = false
      for (const [driverNum, driverData] of Object.entries(msg.data as LiveState['timing'])) {
        if (!driverData.Sectors) continue
        for (const [sectorKey, sector] of Object.entries(driverData.Sectors)) {
          if (sector.Value && sector.Value !== '—') {
            const newHistory = updateSectorHistory(
              sectorHistoryRef.current,
              driverNum,
              sectorKey,
              sector.Value,
            )
            if (newHistory !== sectorHistoryRef.current) {
              sectorHistoryRef.current = newHistory
              historyUpdated = true
            }
          }
        }
      }
      if (historyUpdated) setSectorHistory({ ...sectorHistoryRef.current })

    } else if (msg.topic === 'timing_stats') {
      pendingRef.current.timing_stats = pendingRef.current.timing_stats
        ? mergeTimingStats(pendingRef.current.timing_stats, msg.data)
        : msg.data
    } else {
      const key = msg.topic === 'tyres' ? 'tyres'
        : msg.topic === 'weather' ? 'weather'
        : msg.topic === 'race_control' ? 'race_control'
        : msg.topic === 'session' ? 'session'
        : msg.topic === 'track_status' ? 'track_status'
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
      if (!pending.timing && !pending.timing_stats && Object.keys(pending.other).length === 0) return
      setLiveState(prev => {
        if (!prev) return prev
        const next = { ...prev, ...pending.other }
        if (pending.timing) next.timing = mergeTiming(prev.timing, pending.timing)
        if (pending.timing_stats) next.timing_stats = mergeTimingStats(prev.timing_stats ?? {}, pending.timing_stats)
        return next
      })
      pendingRef.current = { timing: null, timing_stats: null, other: {} }
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

  // ── Derived state ────────────────────────────────────────────────────────
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
        .map(([num, data]) => ({
          num, data,
          tyre: liveState.tyres[num],
          info: F1_DRIVERS[num],
          stats: liveState.timing_stats?.[num],
        }))
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
          return (parseFloat(gapA.replace('+', '')) || 999) - (parseFloat(gapB.replace('+', '')) || 999)
        })
    : []

  const hasData = sortedDrivers.length > 0

  function getCurrentTyre(tyre: TyreData | undefined) {
    if (!tyre?.Stints) return { compound: 'UNKNOWN', laps: 0, isNew: false }
    const stints = Object.values(tyre.Stints)
    const last = stints[stints.length - 1]
    return { compound: last?.Compound ?? 'UNKNOWN', laps: last?.TotalLaps ?? 0, isNew: last?.New === 'true' }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">

      {/* Header */}
      <div
        className="rounded-2xl px-6 py-4 mb-6"
        style={{
          background: hasData ? `linear-gradient(135deg, ${sessionColor}12, rgba(0,0,0,0))` : 'var(--f1-card-gradient)',
          border: `1px solid ${hasData ? sessionColor + '30' : 'var(--f1-card-border)'}`,
          boxShadow: hasData ? `0 0 40px ${sessionColor}08` : 'var(--f1-card-shadow)',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-black tracking-tight">
                <span style={{ color: 'var(--f1-red)' }}>LIVE</span>
                <span className="ml-2 font-light" style={{ color: 'var(--f1-muted)' }}>TIMING</span>
              </h1>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{
                background: connected ? 'rgba(34,197,94,0.12)' : 'rgba(225,6,0,0.12)',
                color: connected ? '#22c55e' : '#e10600',
                border: `1px solid ${connected ? 'rgba(34,197,94,0.3)' : 'rgba(225,6,0,0.3)'}`,
              }}>
                {connected ? '⬤ Conectado' : '◯ Reconectando'}
              </span>
              {sessionLabel && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{
                  background: sessionColor + '18', color: sessionColor,
                  border: `1px solid ${sessionColor}40`,
                }}>
                  {sessionLabel}
                </span>
              )}
            </div>
            {meetingName && (
              <p className="text-sm font-medium" style={{ color: 'var(--f1-muted)' }}>
                📍 {meetingName}
                {liveState?.session?.Meeting?.Circuit?.ShortName && (
                  <span className="ml-1">· {liveState.session.Meeting.Circuit.ShortName}</span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {hasData && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isRace && lapCount?.CurrentLap && lapCount?.TotalLaps && (
                  <div className="text-sm font-black px-3 py-1.5 rounded-xl" style={{ background: 'rgba(225,6,0,0.15)', color: '#e10600', border: '1px solid rgba(225,6,0,0.3)' }}>
                    VUELTA {lapCount.CurrentLap} <span style={{ opacity: 0.6 }}>/ {lapCount.TotalLaps}</span>
                  </div>
                )}
                {!isRace && remainingTime && (
                  <div className="text-sm font-black px-3 py-1.5 rounded-xl font-mono" style={{ background: 'rgba(255,215,0,0.12)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}>
                    ⏱ {remainingTime}
                  </div>
                )}
                {trackStatusInfo && (
                  <div className="text-xs font-bold px-2.5 py-1.5 rounded-xl" style={{
                    background: trackStatusInfo.color + '15', color: trackStatusInfo.color,
                    border: `1px solid ${trackStatusInfo.color}35`,
                  }}>
                    {trackStatusInfo.emoji} {trackStatusInfo.label}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              {hasData && (
                <div className="flex items-center gap-3 text-xs mr-2">
                  <span className="flex items-center gap-1"><span style={{ color: '#a855f7' }}>■</span> Mejor abs.</span>
                  <span className="flex items-center gap-1"><span style={{ color: '#00a550' }}>■</span> PB</span>
                  <span className="flex items-center gap-1"><span style={{ color: '#ffd700' }}>■</span> Normal</span>
                  <span className="flex items-center gap-1"><span style={{ color: '#e10600' }}>■</span> Peor</span>
                </div>
              )}
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
              <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>delay {delaySeconds}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className={hasData ? 'grid grid-cols-1 xl:grid-cols-4 gap-4' : ''}>

        {/* Tabla */}
        <div className={hasData ? 'xl:col-span-3' : ''}>
          <div className="rounded-2xl overflow-hidden" style={CARD}>

            <div
              className="hidden md:grid px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
              style={{
                color: 'var(--f1-muted)',
                borderBottom: '1px solid var(--f1-card-border)',
                gridTemplateColumns: '32px 36px 1fr 72px 90px 90px 100px 90px 90px 90px 28px',
                gap: '8px',
              }}
            >
              <span>Pos</span><span>#</span><span>Piloto</span><span>Neum.</span>
              <span>Última</span><span>Mejor</span><span>Gap / Int.</span>
              <span>S1</span><span>S2</span><span>S3</span><span>Pit</span>
            </div>

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
                {sortedDrivers.map(({ num, data, tyre, info, stats }, index) => {
                  const { compound, laps, isNew } = getCurrentTyre(tyre)
                  const pos = data.Position ? parseInt(data.Position) : (index + 1)
                  const teamColor = info?.teamColor ? `#${info.teamColor}` : (data.TeamColour ? `#${data.TeamColour}` : '#666')
                  const sectors = data.Sectors ?? {}
                  const lapColor = data.LastLapTime?.OverallFastest ? '#a855f7'
                    : data.LastLapTime?.PersonalFastest ? '#22c55e' : 'inherit'
                  const isRetired = data.Retired
                  const statusLabel = isRetired ? 'RET' : data.InPit ? 'PIT' : data.PitOut ? 'OUT' : data.Stopped ? 'STP' : null
                  const statusColor = isRetired ? '#f87171' : data.InPit ? '#ffd700' : data.PitOut ? '#22c55e' : '#f87171'
                  const gap = pos === 1 ? 'LÍDER' : (data.GapToLeader ?? '—')
                  const interval = data.IntervalToPositionAhead?.Value
                  const acronym = info?.acronym ?? data.Tla ?? num
                  const team = info?.team ?? data.TeamName ?? '—'
                  const isExpanded = expandedDriver === num

                  return (
                    <div key={num} style={{ opacity: isRetired ? 0.45 : 1 }}>
                      {/* Desktop row */}
                      <div
                        className="hidden md:grid items-center px-5 py-2.5 text-sm cursor-pointer transition-colors duration-100"
                        style={{
                          gridTemplateColumns: '32px 36px 1fr 72px 90px 90px 100px 90px 90px 90px 28px',
                          gap: '8px',
                          borderLeft: `3px solid ${teamColor}`,
                          background: isExpanded ? `${teamColor}10` : pos <= 3 ? `${teamColor}06` : 'transparent',
                        }}
                        onClick={() => toggleExpanded(num)}
                        onMouseEnter={e => {
                          if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                        }}
                        onMouseLeave={e => {
                          if (!isExpanded) (e.currentTarget as HTMLElement).style.background = pos <= 3 ? `${teamColor}06` : 'transparent'
                        }}
                      >
                        <span className="font-black text-sm" style={{ color: pos === 1 ? 'var(--f1-red)' : pos <= 3 ? '#fff' : 'var(--f1-muted)' }}>
                          {pos}
                        </span>
                        <span className="text-xs font-black" style={{ color: teamColor }}>{num}</span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <DriverFlag countryCode={data.CountryCode?.toLowerCase()} />
                            <span className="font-bold text-sm truncate">{acronym}</span>
                            {statusLabel && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: statusColor + '20', color: statusColor }}>
                                {statusLabel}
                              </span>
                            )}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--f1-muted)' }}>{team}</div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{
                            background: TYRE_COLORS[compound],
                            color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff',
                            boxShadow: isNew ? '0 0 0 2px #fff' : 'none',
                          }}>
                            {TYRE_LABELS[compound]}
                          </div>
                          <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>
                            {laps > 0 ? laps : '—'}
                          </span>
                        </div>

                        <span className="font-mono text-xs font-bold" style={{ color: lapColor }}>
                          {data.LastLapTime?.Value ?? '—'}
                        </span>
                        <span className="font-mono text-xs" style={{ color: 'var(--f1-muted)' }}>
                          {data.BestLapTime?.Value ?? '—'}
                        </span>

                        <div>
                          <div className="font-mono text-xs font-bold" style={{ color: pos === 1 ? '#22c55e' : 'inherit' }}>
                            {gap}
                          </div>
                          {interval && pos !== 1 && (
                            <div className="font-mono text-xs" style={{ color: '#ffd700' }}>↑ {interval}</div>
                          )}
                        </div>

                        <MiniSectors sector={sectors['0']} driverNum={num} sectorKey="0" history={sectorHistory} />
                        <MiniSectors sector={sectors['1']} driverNum={num} sectorKey="1" history={sectorHistory} />
                        <MiniSectors sector={sectors['2']} driverNum={num} sectorKey="2" history={sectorHistory} />

                        <span className="text-xs text-center font-bold" style={{ color: 'var(--f1-muted)' }}>
                          {data.NumberOfPitStops ?? '—'}
                        </span>
                      </div>

                      {/* Panel expandido desktop */}
                      {isExpanded && (
                        <ExpandedDriverPanel num={num} data={data} stats={stats} teamColor={teamColor} history={sectorHistory} />
                      )}

                      {/* Mobile */}
                      <div
                        className="md:hidden flex items-center gap-3 px-4 py-3 cursor-pointer"
                        style={{ borderLeft: `3px solid ${teamColor}` }}
                        onClick={() => toggleExpanded(num)}
                      >
                        <span className="w-6 text-center font-black text-sm shrink-0" style={{ color: pos === 1 ? 'var(--f1-red)' : 'var(--f1-muted)' }}>
                          {pos}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <DriverFlag countryCode={data.CountryCode?.toLowerCase()} />
                            <span className="font-bold text-sm">{acronym}</span>
                            {statusLabel && <span className="text-xs font-bold" style={{ color: statusColor }}>{statusLabel}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: TYRE_COLORS[compound], color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff' }}>
                              {TYRE_LABELS[compound]}
                            </div>
                            <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>{laps > 0 ? `${laps}v` : '—'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold" style={{ color: lapColor }}>{data.LastLapTime?.Value ?? '—'}</div>
                          <div className="text-xs font-mono" style={{ color: pos === 1 ? '#22c55e' : 'var(--f1-muted)' }}>{gap}</div>
                          {interval && pos !== 1 && <div className="text-xs font-mono" style={{ color: '#ffd700' }}>↑ {interval}</div>}
                        </div>
                      </div>

                      {/* Panel expandido mobile */}
                      {isExpanded && (
                        <div className="md:hidden">
                          <ExpandedDriverPanel num={num} data={data} stats={stats} teamColor={teamColor} history={sectorHistory} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral */}
        {hasData && (
          <div className="flex flex-col gap-4">
            {weather && Object.keys(weather).length > 0 && (
              <div className="rounded-2xl px-5 py-4" style={CARD}>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--f1-muted)' }}>
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

            {liveState?.race_control && liveState.race_control.length > 0 && (
              <div className="rounded-2xl px-5 py-4" style={CARD}>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--f1-muted)' }}>
                  Race Control
                </h3>
                <div className="flex flex-col gap-2">
                  {[...liveState.race_control].reverse().slice(0, 8).map((msg, i) => (
                    <div key={i} className="text-xs px-3 py-2.5 rounded-xl" style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderLeft: `3px solid ${FLAG_COLORS[msg.Flag ?? ''] ?? 'var(--f1-card-border)'}`,
                    }}>
                      {(msg.Flag || msg.Lap) && (
                        <div className="flex items-center gap-2 mb-1">
                          {msg.Flag && <span className="font-bold" style={{ color: FLAG_COLORS[msg.Flag] ?? '#fff' }}>{msg.Flag}</span>}
                          {msg.Lap && <span style={{ color: 'var(--f1-muted)' }}>V{msg.Lap}</span>}
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