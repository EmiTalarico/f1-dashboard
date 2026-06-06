'use client'

import { useState, useEffect, useCallback } from 'react'

const BASE = 'https://api.openf1.org/v1'

// ─── Types ───────────────────────────────────────────────────────────────────

type Session = {
  session_key: number
  session_name: string
  session_type: string
  status: string
  date_start: string
  date_end: string
  meeting_key: number
  location: string
  country_name: string
}

type Driver = {
  driver_number: number
  full_name: string
  name_acronym: string
  team_name: string
  team_colour: string
  headshot_url: string
}

type Position = {
  driver_number: number
  position: number
  date: string
}

type Interval = {
  driver_number: number
  gap_to_leader: number | null
  interval: number | null
  date: string
}

type Stint = {
  driver_number: number
  compound: string
  tyre_age_at_start: number
  lap_start: number
  lap_end: number | null
}

type Lap = {
  driver_number: number
  lap_number: number
  lap_duration: number | null
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  is_pit_out_lap: boolean
  date_start: string
}

type Pit = {
  driver_number: number
  lap_number: number
  pit_duration: number | null
  stop_duration: number | null
}

type RaceControl = {
  date: string
  category: string
  flag: string
  message: string
  driver_number: number | null
}

type Weather = {
  date: string
  air_temperature: number
  track_temperature: number
  humidity: number
  wind_speed: number
  rainfall: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYRE_COLORS: Record<string, string> = {
  SOFT: '#e10600',
  MEDIUM: '#ffd700',
  HARD: '#ffffff',
  INTERMEDIATE: '#00a550',
  WET: '#0057b8',
  UNKNOWN: '#888',
}

const TYRE_LABELS: Record<string, string> = {
  SOFT: 'S',
  MEDIUM: 'M',
  HARD: 'H',
  INTERMEDIATE: 'I',
  WET: 'W',
  UNKNOWN: '?',
}

const FLAG_COLORS: Record<string, string> = {
  GREEN: '#00a550',
  YELLOW: '#ffd700',
  RED: '#e10600',
  SAFETY_CAR: '#ffd700',
  VIRTUAL_SAFETY_CAR: '#ffd700',
  CHEQUERED: '#ffffff',
  CLEAR: '#00a550',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : `${s}s`
}

function fmtGap(val: number | null): string {
  if (val === null || val === undefined) return '—'
  if (val === 0) return 'Líder'
  return `+${val.toFixed(3)}s`
}

function fmtInterval(val: number | null): string {
  if (val === null || val === undefined) return '—'
  return `+${val.toFixed(3)}s`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveTimingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [drivers, setDrivers] = useState<Record<number, Driver>>({})
  const [positions, setPositions] = useState<Record<number, Position>>({})
  const [intervals, setIntervals] = useState<Record<number, Interval>>({})
  const [stints, setStints] = useState<Record<number, Stint>>({})
  const [laps, setLaps] = useState<Record<number, Lap>>({})
  const [pits, setPits] = useState<Record<number, Pit[]>>({})
  const [raceControl, setRaceControl] = useState<RaceControl[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionActive, setSessionActive] = useState(false)

  // ── Fetch session info ──
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/sessions?session_key=latest`)
      const data: Session[] = await res.json()
      if (data.length > 0) {
        const s = data[0]
        setSession(s)
        const now = new Date()
        const start = new Date(s.date_start)
        const end = new Date(s.date_end)
        setSessionActive(now >= start && now <= end)
        return s
      }
    } catch { }
    return null
  }, [])

  // ── Fetch drivers (static, once per session) ──
  const fetchDrivers = useCallback(async (sessionKey: number) => {
    try {
      const res = await fetch(`${BASE}/drivers?session_key=${sessionKey}`)
      const data: Driver[] = await res.json()
      const map: Record<number, Driver> = {}
      data.forEach(d => { map[d.driver_number] = d })
      setDrivers(map)
    } catch { }
  }, [])

  // ── Fetch live data ──
  const fetchLiveData = useCallback(async (sessionKey: number) => {
    try {
      const [posRes, intRes, stintRes, lapRes, pitRes, rcRes, wxRes] = await Promise.all([
        fetch(`${BASE}/position?session_key=${sessionKey}`),
        fetch(`${BASE}/intervals?session_key=${sessionKey}`),
        fetch(`${BASE}/stints?session_key=${sessionKey}`),
        fetch(`${BASE}/laps?session_key=${sessionKey}`),
        fetch(`${BASE}/pit?session_key=${sessionKey}`),
        fetch(`${BASE}/race_control?session_key=${sessionKey}`),
        fetch(`${BASE}/weather?session_key=${sessionKey}`),
      ])

      const [posData, intData, stintData, lapData, pitData, rcData, wxData] = await Promise.all([
        posRes.json(), intRes.json(), stintRes.json(),
        lapRes.json(), pitRes.json(), rcRes.json(), wxRes.json(),
      ])

      // Latest position per driver
      const posMap: Record<number, Position> = {}
      ;(posData as Position[]).forEach(p => {
        if (!posMap[p.driver_number] || p.date > posMap[p.driver_number].date)
          posMap[p.driver_number] = p
      })
      setPositions(posMap)

      // Latest interval per driver
      const intMap: Record<number, Interval> = {}
      ;(intData as Interval[]).forEach(i => {
        if (!intMap[i.driver_number] || i.date > intMap[i.driver_number].date)
          intMap[i.driver_number] = i
      })
      setIntervals(intMap)

      // Current stint per driver (last one)
      const stintMap: Record<number, Stint> = {}
      ;(stintData as Stint[]).sort((a, b) => a.lap_start - b.lap_start).forEach(s => {
        stintMap[s.driver_number] = s
      })
      setStints(stintMap)

      // Latest lap per driver
      const lapMap: Record<number, Lap> = {}
      ;(lapData as Lap[]).forEach(l => {
        if (!lapMap[l.driver_number] || l.lap_number > lapMap[l.driver_number].lap_number)
          lapMap[l.driver_number] = l
      })
      setLaps(lapMap)

      // Pit count per driver
      const pitMap: Record<number, Pit[]> = {}
      ;(pitData as Pit[]).forEach(p => {
        if (!pitMap[p.driver_number]) pitMap[p.driver_number] = []
        pitMap[p.driver_number].push(p)
      })
      setPits(pitMap)

      // Race control — last 5 messages
      setRaceControl((rcData as RaceControl[]).slice(-5).reverse())

      // Latest weather
      if ((wxData as Weather[]).length > 0)
        setWeather((wxData as Weather[]).slice(-1)[0])

      setLastUpdate(new Date())
    } catch { }
  }, [])

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const s = await fetchSession()
      if (s) {
        await fetchDrivers(s.session_key)
        await fetchLiveData(s.session_key)
      }
      setLoading(false)
    }
    init()
  }, [fetchSession, fetchDrivers, fetchLiveData])

  // ── Polling every 5s ──
  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => {
      fetchLiveData(session.session_key)
    }, 5000)
    return () => clearInterval(interval)
  }, [session, fetchLiveData])

  // ── Build sorted driver list ──
  const sortedDrivers = Object.values(positions)
    .sort((a, b) => a.position - b.position)
    .map(p => ({
      position: p.position,
      driver: drivers[p.driver_number],
      interval: intervals[p.driver_number],
      stint: stints[p.driver_number],
      lap: laps[p.driver_number],
      pitCount: pits[p.driver_number]?.length ?? 0,
      driverNumber: p.driver_number,
    }))
    .filter(d => d.driver)

  // ── Tyre age calculation ──
  function tyreAge(d: typeof sortedDrivers[0]): number {
    if (!d.stint || !d.lap) return 0
    const currentLap = d.lap.lap_number
    return currentLap - d.stint.lap_start + (d.stint.tyre_age_at_start ?? 0)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          <span style={{ color: 'var(--f1-red)' }}>🔴 Live</span> Timing
        </h1>
        <div className="text-center py-24" style={{ color: 'var(--f1-muted)' }}>
          Desplegando DRS, intentando el sobrepaso!
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            <span style={{ color: 'var(--f1-red)' }}>🔴 Live</span> Timing
          </h1>
          {session && (
            <p className="text-sm mt-1" style={{ color: 'var(--f1-muted)' }}>
              {session.location} — {session.session_name}
              {sessionActive
                ? <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#00a550', color: '#fff' }}>EN VIVO</span>
                : <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-muted)' }}>SESIÓN FINALIZADA</span>
              }
            </p>
          )}
        </div>
        {lastUpdate && (
          <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>
            Actualizado: {lastUpdate.toLocaleTimeString('es-AR')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* ── Tabla principal ── */}
        <div className="xl:col-span-3">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>

            {/* Cabecera tabla */}
            <div
              className="grid gap-2 px-4 py-2 text-xs font-semibold uppercase"
              style={{
                color: 'var(--f1-muted)',
                borderBottom: '1px solid var(--f1-light-gray)',
                gridTemplateColumns: '32px 32px 1fr 80px 60px 80px 80px 80px 80px 32px',
              }}
            >
              <span>Pos</span>
              <span>#</span>
              <span>Piloto</span>
              <span>Neumático</span>
              <span>Edad</span>
              <span>Última V.</span>
              <span>Gap</span>
              <span>Intervalo</span>
              <span>S1/S2/S3</span>
              <span>Pit</span>
            </div>

            {/* Filas */}
            {sortedDrivers.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--f1-muted)' }}>
                {sessionActive ? 'Esperando datos...' : 'No hay sesión activa en este momento'}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
                {sortedDrivers.map(d => {
                  const compound = d.stint?.compound ?? 'UNKNOWN'
                  const age = tyreAge(d)
                  const teamColor = d.driver.team_colour
                    ? `#${d.driver.team_colour}`
                    : '#888'

                  return (
                    <div
                      key={d.driverNumber}
                      className="grid items-center gap-2 px-4 py-2.5 text-sm"
                      style={{
                        gridTemplateColumns: '32px 32px 1fr 90px 80px 80px 80px 80px 32px',
                        borderLeft: `3px solid ${teamColor}`,
                      }}
                    >
                      {/* Posición */}
                      <span className="font-bold text-base" style={{ color: d.position === 1 ? 'var(--f1-red)' : 'inherit' }}>
                        {d.position}
                      </span>

                      {/* Número */}
                      <span className="text-xs font-bold" style={{ color: teamColor }}>
                        {d.driverNumber}
                      </span>

                      {/* Piloto */}
                      <div>
                        <span className="font-bold">{d.driver.name_acronym}</span>
                        <span className="text-xs ml-1 hidden lg:inline" style={{ color: 'var(--f1-muted)' }}>
                          {d.driver.full_name}
                        </span>
                      </div>

                      {/* Neumático + Edad */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                          style={{
                            background: TYRE_COLORS[compound],
                            color: compound === 'HARD' || compound === 'MEDIUM' ? '#000' : '#fff',
                          }}
                        >
                          {TYRE_LABELS[compound]}
                        </span>
                        <span className="text-xs font-mono font-bold">
                          {age > 0 ? age : '—'}
                        </span>
                      </div>

                      {/* Última vuelta */}
                      <span className="font-mono text-xs">
                        {fmtTime(d.lap?.lap_duration ?? null)}
                      </span>

                      {/* Gap al líder */}
                      <span className="font-mono text-xs" style={{ color: d.position === 1 ? '#00a550' : 'inherit' }}>
                        {fmtGap(d.interval?.gap_to_leader ?? null)}
                      </span>

                      {/* Intervalo */}
                      <span className="font-mono text-xs" style={{ color: 'var(--f1-muted)' }}>
                        {d.position === 1 ? '—' : fmtInterval(d.interval?.interval ?? null)}
                      </span>

                      {/* Sectores */}
                      <div className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>
                        {d.lap ? (
                          <span>
                            {fmtTime(d.lap.duration_sector_1)}<br />
                            {fmtTime(d.lap.duration_sector_2)}<br />
                            {fmtTime(d.lap.duration_sector_3)}
                          </span>
                        ) : '—'}
                      </div>

                      {/* Pits */}
                      <span className="text-xs text-center font-bold" style={{ color: 'var(--f1-muted)' }}>
                        {d.pitCount > 0 ? d.pitCount : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel lateral ── */}
        <div className="flex flex-col gap-4">

          {/* Clima */}
          {weather && (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--f1-gray)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
                🌤 Condiciones
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Aire</p>
                  <p className="font-bold">{weather.air_temperature}°C</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Pista</p>
                  <p className="font-bold">{weather.track_temperature}°C</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Humedad</p>
                  <p className="font-bold">{weather.humidity}%</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Viento</p>
                  <p className="font-bold">{weather.wind_speed} km/h</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>Lluvia</p>
                  <p className="font-bold" style={{ color: weather.rainfall > 0 ? '#60a5fa' : 'inherit' }}>
                    {weather.rainfall > 0 ? `${weather.rainfall} mm` : 'Sin lluvia'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Race Control */}
          {raceControl.length > 0 && (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--f1-gray)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
                📻 Race Control
              </h3>
              <div className="flex flex-col gap-2">
                {raceControl.map((msg, i) => (
                  <div
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: 'var(--f1-light-gray)',
                      borderLeft: `3px solid ${FLAG_COLORS[msg.flag] ?? '#888'}`,
                    }}
                  >
                    <p className="font-semibold mb-0.5" style={{ color: FLAG_COLORS[msg.flag] ?? '#fff' }}>
                      {msg.flag ?? msg.category}
                    </p>
                    <p style={{ color: 'var(--f1-muted)' }}>{msg.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sin sesión activa */}
          {!sessionActive && session && (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--f1-gray)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--f1-muted)' }}>
                Última sesión
              </h3>
              <p className="text-sm font-bold">{session.session_name}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--f1-muted)' }}>
                {session.location}, {session.country_name}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--f1-muted)' }}>
                Los datos mostrados corresponden a la última sesión disponible.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}