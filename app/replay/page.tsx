'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { F1_DRIVERS } from '../data/f1drivers'

// ── Types ──────────────────────────────────────────────────────────────────
type SegmentData = { Status: number }

type SectorData = {
  Value?: string
  OverallFastest?: boolean
  PersonalFastest?: boolean
  Segments?: { [key: string]: SegmentData }
}

type SpeedData = {
  Value?: string
  OverallFastest?: boolean
  PersonalFastest?: boolean
  Status?: number
}

type DriverTiming = {
  Position?: string
  GapToLeader?: string
  IntervalToPositionAhead?: { Value: string }
  LastLapTime?: { Value: string; OverallFastest?: boolean; PersonalFastest?: boolean }
  BestLapTime?: { Value: string; Lap?: number }
  Speeds?: { I1?: SpeedData; I2?: SpeedData; FL?: SpeedData; ST?: SpeedData }
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

type ReplayState = {
  timing: { [num: string]: DriverTiming }
  tyres: { [num: string]: TyreData }
  weather: any
  race_control: any[]
  session_data: any
  track_status: any
  timing_stats: { [num: string]: DriverStats }
  session: any
}

type ReplayEvent = {
  ts: number
  topic: string
  data: any
}

type ReplayFile = {
  session: any
  total_events: number
  events: ReplayEvent[]
}

// ── Constants ──────────────────────────────────────────────────────────────
const TYRE_COLORS: Record<string, string> = {
  SOFT: '#e10600', MEDIUM: '#ffd700', HARD: '#ffffff',
  INTERMEDIATE: '#00a550', WET: '#0057b8', UNKNOWN: '#555',
}
const TYRE_LABELS: Record<string, string> = {
  SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?',
}
const SEGMENT_COLORS: Record<number, string> = {
  2048: '#ffd700', 2049: '#00a550', 2051: '#a855f7',
  2052: '#a855f7', 2064: '#444', 0: '#2a2a2a',
}
const FLAG_COLORS: Record<string, string> = {
  GREEN: '#00a550', YELLOW: '#ffd700', RED: '#e10600',
  SAFETY_CAR: '#ffd700', VIRTUAL_SAFETY_CAR: '#ffd700',
  CHEQUERED: '#ffffff', CLEAR: '#00a550', BLUE: '#0057b8',
}
const TRACK_STATUS_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  '1': { label: 'Pista despejada', color: '#00a550', emoji: '🟢' },
  '2': { label: 'Bandera amarilla', color: '#ffd700', emoji: '🟡' },
  '4': { label: 'Safety Car', color: '#ffd700', emoji: '🚗' },
  '5': { label: 'Bandera roja', color: '#e10600', emoji: '🔴' },
  '6': { label: 'Virtual SC', color: '#ffd700', emoji: '⚠️' },
}
const SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20]
const CARD = {
  background: 'var(--f1-card-gradient)',
  border: '1px solid var(--f1-card-border)',
  boxShadow: 'var(--f1-card-shadow)',
} as const

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function emptyState(): ReplayState {
  return {
    timing: {}, tyres: {}, weather: {}, race_control: [],
    session_data: {}, track_status: {}, timing_stats: {}, session: {},
  }
}

function normalizeSegments(raw: any): { [key: string]: SegmentData } {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw.map((value, index) => [String(index), value]).filter(([, value]) => value && typeof value === 'object')
    ) as { [key: string]: SegmentData }
  }
  if (typeof raw === 'object') return raw as { [key: string]: SegmentData }
  return {}
}

function mergeSectors(
  prev: { [key: string]: SectorData },
  next: { [key: string]: any }
): { [key: string]: SectorData } {
  const merged = { ...prev }

  for (const [sKey, rawSector] of Object.entries(next)) {
    if (!rawSector || typeof rawSector !== 'object') {
      delete merged[sKey]
      continue
    }

    const sector = rawSector as any
    const prevSector = merged[sKey] ?? {}
    const updated: SectorData = { ...prevSector }

    // A new sector update means the previous completed sector time is no longer
    // the current sector time. The feed will populate Value again when the
    // sector is completed.
    if (sector.Segments !== undefined) {
      updated.Segments = {
        ...(prevSector.Segments ?? {}),
        ...normalizeSegments(sector.Segments),
      }
      if (sector.Value === undefined) {
        delete updated.Value
        delete updated.OverallFastest
        delete updated.PersonalFastest
      }
    }

    if (sector.Value !== undefined) updated.Value = sector.Value || undefined
    if (sector.OverallFastest !== undefined) updated.OverallFastest = sector.OverallFastest
    if (sector.PersonalFastest !== undefined) updated.PersonalFastest = sector.PersonalFastest

    // Explicit reset/empty values from the feed must be honored. Never keep an
    // old mini-sector color just because the incoming status is 0.
    merged[sKey] = updated
  }

  return merged
}

function mergeSpeeds(
  prev: DriverTiming['Speeds'],
  next: any
): DriverTiming['Speeds'] | undefined {
  if (next === null) return undefined
  if (!next || typeof next !== 'object') return prev

  const merged = { ...(prev ?? {}) } as NonNullable<DriverTiming['Speeds']>
  for (const key of ['I1', 'I2', 'FL', 'ST'] as const) {
    if (next[key] === undefined) continue
    if (next[key] === null) {
      delete merged[key]
      continue
    }
    merged[key] = { ...(merged[key] ?? {}), ...next[key] }
  }
  return merged
}

function parseClock(value?: string): number | null {
  if (!value || !/^\d{2}:\d{2}:\d{2}$/.test(value)) return null
  const [h, m, s] = value.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

function applyEvent(state: ReplayState, topic: string, data: any, eventTs?: number): ReplayState {
  switch (topic) {
    case 'SessionInfo':
      return { ...state, session: data }

    case 'SessionData': {
      const nextSessionData = { ...state.session_data, ...data }
      const series = data?.Series
      if (series && typeof series === 'object') {
        const latest = Object.values(series).find((entry: any) => entry?.QualifyingPart !== undefined) as any
        if (latest?.QualifyingPart !== undefined) {
          nextSessionData.QualifyingPart = Number(latest.QualifyingPart)
          // Qualifying statistics are per Q1/Q2/Q3, not one continuous bucket.
          if (Number(latest.QualifyingPart) !== state.session_data.QualifyingPart) {
            const resetTiming = Object.fromEntries(
              Object.entries(state.timing).map(([num, driver]) => [num, {
                ...driver,
                Sectors: {},
                Speeds: undefined,
                LastLapTime: undefined,
                BestLapTime: undefined,
              }])
            )
            return {
              ...state,
              timing: resetTiming,
              session_data: nextSessionData,
              timing_stats: {},
            }
          }
        }
      }
      return { ...state, session_data: nextSessionData }
    }

    case 'SessionStatus':
      return { ...state, session_data: { ...state.session_data, Status: data } }

    case 'LapCount':
      return { ...state, session_data: { ...state.session_data, LapCount: data } }

    case 'ExtrapolatedClock':
      return {
        ...state,
        session_data: {
          ...state.session_data,
          Clock: data,
          ClockReplayTs: eventTs,
        },
      }

    case 'TrackStatus':
      return { ...state, track_status: data }

    case 'WeatherData':
      return { ...state, weather: data }

    case 'RaceControlMessages': {
      const messages = data.Messages ?? {}
      const newMsgs = [...state.race_control]
      const items = Array.isArray(messages) ? messages : Object.values(messages)
      for (const m of items) {
        if (typeof m === 'object' && !newMsgs.includes(m)) newMsgs.push(m)
      }
      return { ...state, race_control: newMsgs.slice(-20) }
    }

    case 'DriverList': {
      const newTiming = { ...state.timing }
      for (const [num, d] of Object.entries(data as Record<string, any>)) {
        if (typeof d !== 'object') continue
        if (!newTiming[num]) newTiming[num] = {}
        for (const field of ['RacingNumber', 'Tla', 'FullName', 'TeamName', 'TeamColour', 'CountryCode']) {
          if (d[field] !== undefined) newTiming[num][field as keyof DriverTiming] = d[field] as any
        }
        if (d.Line !== undefined) newTiming[num].Position = String(d.Line)
      }
      return { ...state, timing: newTiming }
    }

    case 'TimingData':
    case 'TimingDataF1': {
      const lines = data.Lines ?? {}
      if (typeof lines !== 'object' || Array.isArray(lines)) return state
      const newTiming = { ...state.timing }
      for (const [num, d] of Object.entries(lines as Record<string, any>)) {
        if (typeof d !== 'object') continue
        if (!newTiming[num]) newTiming[num] = {}
        const prev = newTiming[num]
        const updated = { ...prev }
        if (d.Line !== undefined) updated.Position = String(d.Line)
        if (d.Position !== undefined) updated.Position = String(d.Position)
        for (const [k, v] of Object.entries(d)) {
          if (k === 'Line' || k === 'Position') continue

          if (k === 'Sectors') {
            updated.Sectors = v === null ? {} : mergeSectors(prev.Sectors ?? {}, v as any)
            continue
          }

          if (k === 'Speeds') {
            updated.Speeds = mergeSpeeds(prev.Speeds, v)
            continue
          }

          // null is meaningful in this feed: it clears transient values such
          // as the current speeds/sectors instead of leaving stale data visible.
          (updated as any)[k] = v
        }
        newTiming[num] = updated
      }
      return { ...state, timing: newTiming }
    }

    case 'TimingAppData': {
      const lines = data.Lines ?? {}
      if (typeof lines !== 'object') return state
      const newTyres = { ...state.tyres }
      for (const [num, d] of Object.entries(lines as Record<string, any>)) {
        if (typeof d !== 'object') continue
        if (!newTyres[num]) newTyres[num] = {}
        if (d.Stints && typeof d.Stints === 'object') {
          if (!newTyres[num].Stints) newTyres[num].Stints = {}
          for (const [sk, sv] of Object.entries(d.Stints as Record<string, any>)) {
            if (!newTyres[num].Stints![sk]) newTyres[num].Stints![sk] = {}
            Object.assign(newTyres[num].Stints![sk], sv)
          }
        }
      }
      return { ...state, tyres: newTyres }
    }

    case 'TimingStats': {
      const lines = data.Lines ?? {}
      if (typeof lines !== 'object') return state
      const newStats = { ...state.timing_stats }
      for (const [num, d] of Object.entries(lines as Record<string, any>)) {
        if (typeof d !== 'object') continue
        const previous = newStats[num] ?? {}
        const next = { ...previous, ...d }

        if (d.PersonalBestLapTime?.Value === '') {
          if (previous.PersonalBestLapTime?.Value) next.PersonalBestLapTime = previous.PersonalBestLapTime
        }

        if (d.BestSectors) {
          next.BestSectors = {
            ...(previous.BestSectors ?? {}),
            ...Object.fromEntries(
              Object.entries(d.BestSectors).filter(([, value]: any) => value?.Value !== '')
            ),
          }
        }

        if (d.BestSpeeds) {
          next.BestSpeeds = {
            ...(previous.BestSpeeds ?? {}),
            ...Object.fromEntries(
              Object.entries(d.BestSpeeds).filter(([, value]: any) => value?.Value !== '')
            ),
          }
        }

        newStats[num] = next
      }
      return { ...state, timing_stats: newStats }
    }

    default:
      return state
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function MiniSectors({ sector }: { sector?: SectorData }) {
  if (!sector) return <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>—</span>
  const color = sector.OverallFastest ? '#a855f7' : sector.PersonalFastest ? '#00a550' : '#ffd700'
  const segments = sector.Segments
    ? Object.entries(sector.Segments).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([, v]) => v)
    : []
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-xs font-mono font-bold" style={{ color }}>{sector.Value || '—'}</span>
      {segments.length > 0 && (
        <div className="flex gap-px">
          {segments.map((seg, i) => (
            <div key={i} style={{ background: SEGMENT_COLORS[seg.Status] ?? '#2a2a2a', height: 5, minWidth: 5, flex: 1, borderRadius: 2 }} />
          ))}
        </div>
      )}
    </div>
  )
}

function DriverFlag({ countryCode }: { countryCode?: string }) {
  const code = countryCode?.toLowerCase()
  if (!code) return null
  return <img src={`https://flagcdn.com/w20/${code}.png`} alt={code} className="w-4 h-3 object-cover rounded-sm shrink-0" />
}

function getCurrentTyre(tyre: TyreData | undefined) {
  if (!tyre?.Stints) return { compound: 'UNKNOWN', laps: 0, isNew: false }
  const stints = Object.values(tyre.Stints)
  const last = stints[stints.length - 1]
  return { compound: last?.Compound ?? 'UNKNOWN', laps: last?.TotalLaps ?? 0, isNew: last?.New === 'true' }
}

function parseLapTime(value?: string): number | null {
  if (!value) return null
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

function formatSectorSum(seconds: number): string {
  return seconds.toFixed(3)
}

function getOfficialRemaining(
  sessionData: any,
  absoluteTs: number,
): number | null {
  const clock = sessionData?.Clock
  if (!clock) return null
  const base = parseClock(clock.Remaining)
  if (base === null) return null

  if (clock.Extrapolating && typeof sessionData.ClockReplayTs === 'number') {
    const elapsed = Math.max(0, absoluteTs - sessionData.ClockReplayTs)
    return Math.max(0, base - elapsed)
  }

  return base
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ReplayPage() {
  const [file, setFile] = useState<ReplayFile | null>(null)
  const [replayState, setReplayState] = useState<ReplayState>(emptyState())
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [currentTs, setCurrentTs] = useState(0)    // segundos desde el inicio
  const [duration, setDuration] = useState(0)       // segundos totales
  const [eventIdx, setEventIdx] = useState(0)       // índice del próximo evento a aplicar
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [favoriteDrivers, setFavoriteDrivers] = useState<string[]>([])
  const [positionFlash, setPositionFlash] = useState<Record<string, number>>({})

  const playingRef = useRef(false)
  const speedRef = useRef(5)
  const eventIdxRef = useRef(0)
  const currentTsRef = useRef(0)
  const stateRef = useRef<ReplayState>(emptyState())
  const eventsRef = useRef<ReplayEvent[]>([])
  const tsStartRef = useRef(0)
  const animRef = useRef<number | null>(null)
  const lastRafRef = useRef<number | null>(null)
  const previousPositionsRef = useRef<Record<string, number>>({})

  // ── Cargar archivo ────────────────────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setLoadError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data: ReplayFile = JSON.parse(ev.target?.result as string)
        if (!data.events || !Array.isArray(data.events)) throw new Error('Formato inválido')
        setFile(data)
        setReplayState(emptyState())
        stateRef.current = emptyState()
        eventsRef.current = data.events
        tsStartRef.current = data.events[0].ts
        const dur = data.events[data.events.length - 1].ts - data.events[0].ts
        setDuration(dur)
        setCurrentTs(0)
        currentTsRef.current = 0
        setEventIdx(0)
        eventIdxRef.current = 0
        setPlaying(false)
        playingRef.current = false
      } catch (err) {
        setLoadError('No se pudo leer el archivo. Asegurate de que sea un JSON de replay válido.')
      }
    }
    reader.readAsText(f)
  }

  // ── Loop de reproducción ──────────────────────────────────────────────────
  const tick = useCallback((now: number) => {
    if (!playingRef.current) return
    const last = lastRafRef.current ?? now
    const elapsed = (now - last) / 1000  // segundos reales transcurridos
    lastRafRef.current = now

    const advance = elapsed * speedRef.current  // segundos de sesión a avanzar
    const newTs = currentTsRef.current + advance
    currentTsRef.current = newTs
    setCurrentTs(newTs)

    // Aplicar todos los eventos hasta newTs
    const events = eventsRef.current
    const tsStart = tsStartRef.current
    let idx = eventIdxRef.current
    let state = stateRef.current

    while (idx < events.length && (events[idx].ts - tsStart) <= newTs) {
      state = applyEvent(state, events[idx].topic, events[idx].data, events[idx].ts)
      idx++
    }

    if (idx !== eventIdxRef.current) {
      eventIdxRef.current = idx
      stateRef.current = state
      setEventIdx(idx)
      setReplayState({ ...state })
    }

    // Llegamos al final
    if (newTs >= (eventsRef.current[eventsRef.current.length - 1]?.ts - tsStartRef.current)) {
      playingRef.current = false
      setPlaying(false)
      return
    }

    animRef.current = requestAnimationFrame(tick)
  }, [])

  function togglePlay() {
    if (!file) return
    const next = !playingRef.current
    playingRef.current = next
    setPlaying(next)
    if (next) {
      lastRafRef.current = null
      animRef.current = requestAnimationFrame(tick)
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }

  function handleSpeedChange(s: number) {
    speedRef.current = s
    setSpeed(s)
  }

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value)
    // Pausar si está reproduciendo
    if (playingRef.current) {
      playingRef.current = false
      setPlaying(false)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }

    // Recalcular estado desde el inicio hasta val
    const events = eventsRef.current
    const tsStart = tsStartRef.current
    let state = emptyState()
    let idx = 0
    while (idx < events.length && (events[idx].ts - tsStart) <= val) {
      state = applyEvent(state, events[idx].topic, events[idx].data, events[idx].ts)
      idx++
    }
    stateRef.current = state
    eventIdxRef.current = idx
    currentTsRef.current = val
    setCurrentTs(val)
    setEventIdx(idx)
    setReplayState({ ...state })
  }

  function skip(seconds: number) {
    const newVal = Math.max(0, Math.min(duration, currentTsRef.current + seconds))
    const fakeEvent = { target: { value: String(newVal) } } as React.ChangeEvent<HTMLInputElement>
    handleSlider(fakeEvent)
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('f1-replay-favorite-drivers')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setFavoriteDrivers(parsed.map(String))
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem('f1-replay-favorite-drivers', JSON.stringify(favoriteDrivers)) } catch {}
  }, [favoriteDrivers])

  function toggleFavorite(num: string) {
    setFavoriteDrivers(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num])
  }

  useEffect(() => {
    const previous = previousPositionsRef.current
    const next: Record<string, number> = {}
    const changedFavorites: string[] = []
    for (const { num, data } of sortedDrivers) {
      const pos = Number.parseInt(data.Position ?? '')
      if (!Number.isFinite(pos)) continue
      next[num] = pos
      if (playingRef.current && favoriteDrivers.includes(num) && previous[num] !== undefined && previous[num] !== pos) changedFavorites.push(num)
    }
    previousPositionsRef.current = next
    if (changedFavorites.length > 0) {
      setPositionFlash(prev => ({ ...prev, ...Object.fromEntries(changedFavorites.map(num => [num, Date.now()])) }))
      window.setTimeout(() => setPositionFlash(prev => {
        const updated = { ...prev }
        for (const num of changedFavorites) delete updated[num]
        return updated
      }), 900)
    }
  }, [replayState.timing, favoriteDrivers])

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  // ── Derived state ──────────────────────────────────────────────────────────
  const sortedDrivers = Object.entries(replayState.timing)
    .filter(([, d]) => d.Tla || d.FullName || d.Position)
    .map(([num, data]) => ({
      num, data,
      tyre: replayState.tyres[num],
      info: F1_DRIVERS[num],
      stats: replayState.timing_stats?.[num],
    }))
    .sort((a, b) => {
      const posA = parseInt(a.data.Position ?? '999')
      const posB = parseInt(b.data.Position ?? '999')
      return posA - posB
    })

  const hasData = sortedDrivers.length > 0
  const weather = replayState.weather
  const trackStatusCode = replayState.track_status?.Status ?? '1'
  const trackStatusInfo = TRACK_STATUS_INFO[trackStatusCode]
  const sessionName = replayState.session?.Name ?? file?.session?.name ?? ''
  const meetingName = replayState.session?.Meeting?.Name ?? file?.session?.meeting ?? ''
  const progress = duration > 0 ? (currentTs / duration) * 100 : 0
  const officialRemaining = getOfficialRemaining(
    replayState.session_data,
    tsStartRef.current + currentTs,
  )
  const qualifyingPart = replayState.session_data?.QualifyingPart as number | undefined
  const qualifyingLabel = qualifyingPart ? `Q${qualifyingPart}` : sessionName
  const eventsApplied = eventIdx
  const totalEvents = file?.total_events ?? 0

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style jsx global>{`
        @keyframes favoritePositionFlash {
          0% { background: rgba(255,215,0,0.28); box-shadow: inset 0 0 0 1px rgba(255,215,0,0.45), 0 0 22px rgba(255,215,0,0.16); }
          45% { background: rgba(255,215,0,0.12); box-shadow: inset 0 0 0 1px rgba(255,215,0,0.30), 0 0 14px rgba(255,215,0,0.10); }
          100% { background: transparent; box-shadow: none; }
        }
      `}</style>
      <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="rounded-2xl px-6 py-4 mb-6" style={CARD}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-black tracking-tight">
                <span style={{ color: 'var(--f1-red)' }}>REPLAY</span>
                <span className="ml-2 font-light" style={{ color: 'var(--f1-muted)' }}>SESSION</span>
              </h1>
              {sessionName && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(225,6,0,0.12)', color: '#e10600', border: '1px solid rgba(225,6,0,0.3)' }}>
                  {sessionName}
                </span>
              )}
              {trackStatusInfo && hasData && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: trackStatusInfo.color + '15', color: trackStatusInfo.color, border: `1px solid ${trackStatusInfo.color}35` }}>
                  {trackStatusInfo.emoji} {trackStatusInfo.label}
                </span>
              )}
            </div>
            {meetingName && <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>📍 {meetingName}</p>}
          </div>

          {/* Carga de archivo */}
          <label className="cursor-pointer">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 hover:opacity-80"
              style={{ background: 'rgba(225,6,0,0.12)', color: '#e10600', border: '1px solid rgba(225,6,0,0.3)' }}>
              📂 {file ? 'Cambiar archivo' : 'Cargar JSON'}
            </div>
            <input type="file" accept=".json" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {loadError && (
          <div className="mt-3 text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {loadError}
          </div>
        )}
      </div>

      {/* Sin archivo cargado */}
      {!file && (
        <div className="rounded-2xl px-6 py-24 text-center" style={CARD}>
          <div className="text-5xl mb-4">🎬</div>
          <p className="font-bold text-lg mb-2">Cargá un archivo de replay</p>
          <p className="text-sm mb-6" style={{ color: 'var(--f1-muted)' }}>
            Descargá el JSON desde{' '}
            <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.08)' }}>
              /history/&#123;session_key&#125;/export
            </code>{' '}
            y abrilo acá
          </p>
          <label className="cursor-pointer inline-block">
            <div className="px-6 py-3 rounded-xl font-bold text-sm" style={{ background: '#e10600', color: '#fff' }}>
              📂 Seleccionar archivo
            </div>
            <input type="file" accept=".json" onChange={handleFile} className="hidden" />
          </label>
        </div>
      )}

      {/* Controles de reproducción */}
      {file && (
        <div className="rounded-2xl px-6 py-4 mb-4" style={CARD}>
          {/* Slider */}
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration}
              step={1}
              value={currentTs}
              onChange={handleSlider}
              className="w-full"
              style={{ accentColor: '#e10600', height: 4, cursor: 'pointer' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--f1-muted)' }}>
              <span>{formatTime(currentTs)}</span>
              <span style={{ color: '#888' }}>{eventsApplied.toLocaleString()} / {totalEvents.toLocaleString()} eventos</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Skip atrás */}
            <button onClick={() => skip(-30)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}>
              ⏮ 30s
            </button>
            <button onClick={() => skip(-10)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}>
              ◀ 10s
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="px-6 py-2 rounded-xl text-sm font-black transition-all duration-150 active:scale-95"
              style={{ background: playing ? 'rgba(255,215,0,0.15)' : '#e10600', color: playing ? '#ffd700' : '#fff', border: playing ? '1px solid rgba(255,215,0,0.4)' : 'none', minWidth: 100 }}
            >
              {playing ? '⏸ Pausar' : '▶ Play'}
            </button>

            {/* Skip adelante */}
            <button onClick={() => skip(10)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}>
              10s ▶
            </button>
            <button onClick={() => skip(30)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}>
              30s ⏭
            </button>

            {/* Velocidad */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs mr-1" style={{ color: 'var(--f1-muted)' }}>Velocidad:</span>
              {SPEED_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: speed === s ? 'rgba(225,6,0,0.15)' : 'rgba(255,255,255,0.05)',
                    color: speed === s ? '#e10600' : 'var(--f1-muted)',
                    border: `1px solid ${speed === s ? 'rgba(225,6,0,0.4)' : 'var(--f1-card-border)'}`,
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Layout principal */}
      {file && (
        <div className={hasData ? 'grid grid-cols-1 xl:grid-cols-4 gap-4' : ''}>
          <div className={hasData ? 'xl:col-span-3' : ''}>
            <div className="rounded-2xl overflow-hidden" style={CARD}>

              {/* Favoritos */}
              <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--f1-card-border)', background: 'rgba(255,255,255,0.018)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--f1-muted)' }}>Favoritos</span>
                  {favoriteDrivers.length === 0 ? <span className="text-xs truncate" style={{ color: 'var(--f1-muted)' }}>Marcá una estrella ★ en los pilotos que quieras seguir.</span> : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {favoriteDrivers.map(num => {
                        const driver = sortedDrivers.find(d => d.num === num)
                        const acronym = driver?.info?.acronym ?? driver?.data.Tla ?? num
                        return <button key={num} onClick={() => setExpandedDriver(num)} className="text-[11px] font-black px-2 py-1 rounded-md transition-all hover:opacity-80" style={{ background: 'rgba(255,215,0,0.10)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.22)' }}>★ {acronym}</button>
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Header tabla */}
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
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="text-4xl">⏳</div>
                  <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>
                    {playing ? 'Cargando datos...' : 'Presioná Play o mové el slider para ver los datos'}
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--f1-card-border)' }}>
                  {sortedDrivers.map(({ num, data, tyre, info, stats }, index) => {
                    const { compound, laps, isNew } = getCurrentTyre(tyre)
                    const pos = data.Position ? parseInt(data.Position) : (index + 1)
                    const teamColor = info?.teamColor ? `#${info.teamColor}` : (data.TeamColour ? `#${data.TeamColour}` : '#666')
                    const sectors = data.Sectors ?? {}
                    const lapColor = data.LastLapTime?.OverallFastest ? '#a855f7' : data.LastLapTime?.PersonalFastest ? '#22c55e' : 'inherit'
                    const isRetired = data.Retired
                    const statusLabel = isRetired ? 'RET' : data.InPit ? 'PIT' : data.PitOut ? 'OUT' : null
                    const statusColor = isRetired ? '#f87171' : data.InPit ? '#ffd700' : '#22c55e'
                    const gap = pos === 1 ? 'LÍDER' : (data.GapToLeader ?? '—')
                    const interval = data.IntervalToPositionAhead?.Value
                    const acronym = info?.acronym ?? data.Tla ?? num
                    const team = info?.team ?? data.TeamName ?? '—'
                    const isExpanded = expandedDriver === num
                    const isFavorite = favoriteDrivers.includes(num)
                    const isPositionFlashing = Boolean(positionFlash[num])

                    return (
                      <div key={num} style={{ opacity: isRetired ? 0.45 : 1, animation: isPositionFlashing ? 'favoritePositionFlash 900ms ease' : undefined }}>
                        {/* Desktop */}
                        <div
                          className="hidden md:grid items-center px-5 py-2.5 text-sm cursor-pointer transition-colors duration-100"
                          style={{
                            gridTemplateColumns: '32px 36px 1fr 72px 90px 90px 100px 90px 90px 90px 28px',
                            gap: '8px',
                            borderLeft: `3px solid ${isFavorite ? '#ffd700' : teamColor}`,
                            background: isExpanded ? `${teamColor}10` : isFavorite ? 'rgba(255,215,0,0.055)' : pos <= 3 ? `${teamColor}06` : 'transparent',
                            boxShadow: isFavorite ? 'inset 0 0 0 1px rgba(255,215,0,0.08)' : 'none',
                          }}
                          onClick={() => setExpandedDriver(isExpanded ? null : num)}
                        >
                          <span className="font-black text-sm" style={{ color: pos === 1 ? 'var(--f1-red)' : pos <= 3 ? '#fff' : 'var(--f1-muted)' }}>
                            {pos}
                          </span>
                          <span className="text-xs font-black" style={{ color: teamColor }}>{num}</span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                              <button type="button" onClick={(event: React.MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); toggleFavorite(num) }} className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-xs transition-all hover:scale-110" style={{ color: isFavorite ? '#ffd700' : 'rgba(255,255,255,0.28)', background: isFavorite ? 'rgba(255,215,0,0.10)' : 'transparent' }} aria-label={isFavorite ? `Quitar ${acronym} de favoritos` : `Agregar ${acronym} a favoritos`}>
                                ★
                              </button>
                              <DriverFlag countryCode={data.CountryCode?.toLowerCase()} />
                              <span className="font-bold text-sm whitespace-nowrap shrink-0">{acronym}</span>
                              {statusLabel && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: statusColor + '20', color: statusColor }}>
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-xs truncate" style={{ color: 'var(--f1-muted)' }}>{team}</div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                              style={{ background: TYRE_COLORS[compound], color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff', boxShadow: isNew ? '0 0 0 2px #fff' : 'none' }}>
                              {TYRE_LABELS[compound]}
                            </div>
                            <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>{laps > 0 ? laps : '—'}</span>
                          </div>

                          <span className="font-mono text-xs font-bold" style={{ color: lapColor }}>{data.LastLapTime?.Value ?? '—'}</span>
                          <span className="font-mono text-xs" style={{ color: 'var(--f1-muted)' }}>{data.BestLapTime?.Value ?? '—'}</span>

                          <div>
                            <div className="font-mono text-xs font-bold" style={{ color: pos === 1 ? '#22c55e' : 'inherit' }}>{gap}</div>
                            {interval && pos !== 1 && <div className="font-mono text-xs" style={{ color: '#ffd700' }}>↑ {interval}</div>}
                          </div>

                          <MiniSectors sector={sectors['0']} />
                          <MiniSectors sector={sectors['1']} />
                          <MiniSectors sector={sectors['2']} />

                          <span className="text-xs text-center font-bold" style={{ color: 'var(--f1-muted)' }}>
                            {data.NumberOfPitStops ?? '—'}
                          </span>
                        </div>

                        {/* Panel expandido */}
                        {isExpanded && (
                          <div className="px-5 py-4 grid grid-cols-3 gap-4"
                            style={{ background: `${teamColor}08`, borderTop: `1px solid ${teamColor}20` }}>
                            {/* Sectores actuales */}
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>Sectores</p>
                              {['0', '1', '2'].map((sKey, idx) => {
                                const sector = sectors[sKey]
                                const segs = sector?.Segments
                                  ? Object.entries(sector.Segments).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([, v]) => v)
                                  : []
                                const color = sector?.OverallFastest ? '#a855f7' : sector?.PersonalFastest ? '#00a550' : '#ffd700'
                                return (
                                  <div key={sKey} className="mb-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold w-5" style={{ color: teamColor }}>S{idx + 1}</span>
                                      <span className="text-xs font-mono font-bold" style={{ color }}>{sector?.Value || '—'}</span>
                                    </div>
                                    {segs.length > 0 && (
                                      <div className="flex gap-px">
                                        {segs.map((seg, i) => (
                                          <div key={i} style={{ background: SEGMENT_COLORS[seg.Status] ?? '#2a2a2a', height: 7, minWidth: 6, flex: 1, borderRadius: 2 }} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              {(() => {
                                const s1 = parseLapTime(sectors['0']?.Value)
                                const s2 = parseLapTime(sectors['1']?.Value)
                                if (s1 === null || s2 === null) return null
                                return <div className="mt-3 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}><span className="text-xs font-bold" style={{ color: 'var(--f1-muted)' }}>S1 + S2</span><span className="text-sm font-mono font-black">{formatSectorSum(s1 + s2)}</span></div>
                              })()}
                            </div>
                            {/* Mejores sectores */}
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>Mejor sector sesión</p>
                              {['0', '1', '2'].map((sKey, idx) => {
                                const best = stats?.BestSectors?.[sKey]
                                return (
                                  <div key={sKey} className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold w-5" style={{ color: teamColor }}>S{idx + 1}</span>
                                    <span className="text-xs font-mono font-bold" style={{ color: best?.Position === 1 ? '#a855f7' : 'var(--f1-muted)' }}>
                                      {best?.Value ?? '—'}
                                    </span>
                                    {best?.Position && <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>P{best.Position}</span>}
                                  </div>
                                )
                              })}
                            </div>
                            {/* Velocidades */}
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>Velocidades</p>
                              {[
                                { k: 'ST', l: 'Speed trap' },
                                { k: 'I1', l: 'Trampa S1' },
                                { k: 'I2', l: 'Trampa S2' },
                              ].map(({ k, l }) => {
                                const current = data.Speeds?.[k as keyof NonNullable<DriverTiming['Speeds']>]
                                const best = stats?.BestSpeeds?.[k as keyof NonNullable<DriverStats['BestSpeeds']>]
                                const value = current?.Value || best?.Value
                                if (!value) return null
                                return (
                                  <div key={k} className="flex justify-between mb-1 text-xs">
                                    <span style={{ color: 'var(--f1-muted)' }}>{l}</span>
                                    <span className="font-mono font-bold">{value} km/h</span>
                                  </div>
                                )
                              })}
                              {(data.BestLapTime?.Value || stats?.PersonalBestLapTime?.Value) && (
                                <div className="flex justify-between mt-2 pt-2 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                  <span style={{ color: 'var(--f1-muted)' }}>Mejor vuelta</span>
                                  <span className="font-mono font-bold" style={{ color: '#00a550' }}>
                                    {data.BestLapTime?.Value || stats?.PersonalBestLapTime?.Value}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Mobile */}
                        <div
                          className="md:hidden flex items-center gap-3 px-4 py-3 cursor-pointer"
                          style={{ borderLeft: `3px solid ${teamColor}` }}
                          onClick={() => setExpandedDriver(isExpanded ? null : num)}
                        >
                          <span className="w-6 text-center font-black text-sm shrink-0" style={{ color: pos === 1 ? 'var(--f1-red)' : 'var(--f1-muted)' }}>{pos}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <button type="button" onClick={(event: React.MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); toggleFavorite(num) }} className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-xs" style={{ color: isFavorite ? '#ffd700' : 'rgba(255,255,255,0.28)' }} aria-label={isFavorite ? `Quitar ${acronym} de favoritos` : `Agregar ${acronym} a favoritos`}>
                                ★
                              </button>
                              <DriverFlag countryCode={data.CountryCode?.toLowerCase()} />
                              <span className="font-bold text-sm">{acronym}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                                style={{ background: TYRE_COLORS[compound], color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff' }}>
                                {TYRE_LABELS[compound]}
                              </div>
                              <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>{laps > 0 ? `${laps}v` : '—'}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-bold" style={{ color: lapColor }}>{data.LastLapTime?.Value ?? '—'}</div>
                            <div className="text-xs font-mono" style={{ color: pos === 1 ? '#22c55e' : 'var(--f1-muted)' }}>{gap}</div>
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
          {hasData && (
            <div className="flex flex-col gap-4">
              {/* Reloj oficial de clasificación */}
              <div className="rounded-2xl px-5 py-4" style={CARD}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--f1-muted)' }}>Tiempo oficial</h3>
                  {qualifyingLabel && (
                    <span className="text-xs font-black px-2 py-1 rounded-md" style={{ background: 'rgba(225,6,0,0.12)', color: '#e10600' }}>
                      {qualifyingLabel}
                    </span>
                  )}
                </div>
                <div className="text-3xl font-black font-mono" style={{ color: '#e10600' }}>
                  {officialRemaining !== null ? formatTime(officialRemaining) : '—'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--f1-muted)' }}>
                  {officialRemaining !== null ? 'restantes en la sesión' : 'esperando reloj oficial'}
                </div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: '#e10600' }} />
                </div>
                <div className="text-[10px] mt-1 text-right" style={{ color: 'var(--f1-muted)' }}>
                  Replay {formatTime(currentTs)} / {formatTime(duration)}
                </div>
              </div>

              {/* Condiciones */}
              {weather && Object.keys(weather).length > 0 && (
                <div className="rounded-2xl px-5 py-4" style={CARD}>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--f1-muted)' }}>Condiciones</h3>
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
              {replayState.race_control.length > 0 && (
                <div className="rounded-2xl px-5 py-4" style={CARD}>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--f1-muted)' }}>Race Control</h3>
                  <div className="flex flex-col gap-2">
                    {[...replayState.race_control].reverse().slice(0, 8).map((msg, i) => (
                      <div key={i} className="text-xs px-3 py-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${FLAG_COLORS[msg.Flag ?? ''] ?? 'var(--f1-card-border)'}` }}>
                        {msg.Flag && <span className="font-bold block mb-0.5" style={{ color: FLAG_COLORS[msg.Flag] ?? '#fff' }}>{msg.Flag}</span>}
                        <p style={{ color: 'var(--f1-muted)', lineHeight: 1.4 }}>{msg.Message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </main>
    </>
  )
}