'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL
const CURRENT_YEAR = 2026
const MAX_DRIVERS = 4

const YEARS = [2026, 2025, 2024, 2023]
const SESSIONS = [
  { value: 'R',   label: 'Carrera' },
  { value: 'Q',   label: 'Clasificación' },
  { value: 'FP1', label: 'Práctica 1' },
  { value: 'FP2', label: 'Práctica 2' },
  { value: 'FP3', label: 'Práctica 3' },
]

// Paleta de colores alternativos para cuando dos pilotos del mismo equipo son seleccionados
const ALT_COLORS = ['#e10600', '#60a5fa', '#facc15', '#a78bfa']

type Race = { round: string; raceName: string; date: string }

type Result = {
  position: number | null
  driver: string
  fullName: string
  team: string
  teamColor: string
  time: string | null
  status: string
  points: number
}

type SessionData = {
  year: number
  round: number
  session: string
  event: string
  results: Result[]
}

type DriverTelemetry = {
  driver: string
  fullName: string
  teamColor: string
  displayColor: string
  lapTime: string
  data: {
    distance: number[]
    speed: number[]
    throttle: number[]
    brake: boolean[]
    gear: number[]
    drs: number[]
  }
}

// Parsea "0 days 00:01:25.065000" → "1:25.065"
// Parsea "0 days 00:00:08.481000" → "+8.481s"
// Parsea "0 days 01:42:06.304000" → "1:42:06"
function parsePandasTime(raw: string | null): string {
  if (!raw) return '—'

  const match = raw.match(/(\d+) days (\d+):(\d+):(\d+)\.?(\d*)/)
  if (!match) return raw

  const [, , hStr, mStr, sStr, msStr] = match
  const h = parseInt(hStr)
  const m = parseInt(mStr)
  const s = parseInt(sStr)
  const ms = msStr ? msStr.slice(0, 3).padEnd(3, '0') : '000'

  // Tiempo de carrera del ganador (horas > 0)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  // Gap (minutos = 0, segundos pequeños)
  if (m === 0) return `+${s}.${ms}s`

  // Tiempo de vuelta o gap > 1 minuto
  return `${m}:${String(s).padStart(2, '0')}.${ms}`
}

function stripGP(name: string) {
  return name.replace(/Grand Prix/gi, '').replace(/Gran Premio/gi, '').trim()
}

// Asigna colores a los pilotos seleccionados evitando repetir colores del mismo equipo
function assignDisplayColors(
  selectedDrivers: string[],
  sessionResults: Result[],
  telemetryMap: Record<string, DriverTelemetry>
): Record<string, string> {
  const colorMap: Record<string, string> = {}
  const usedColors = new Set<string>()

  selectedDrivers.forEach((driverId, idx) => {
    const result = sessionResults.find(r => r.driver === driverId)
    if (!result) return

    const teamColor = result.teamColor
    // Si el color del equipo no fue usado todavía, úsalo
    if (!usedColors.has(teamColor)) {
      colorMap[driverId] = teamColor
      usedColors.add(teamColor)
    } else {
      // Buscar un color alternativo que no esté en uso
      const alt = ALT_COLORS.find(c => !usedColors.has(c)) ?? ALT_COLORS[idx % ALT_COLORS.length]
      colorMap[driverId] = alt
      usedColors.add(alt)
    }
  })

  return colorMap
}

const CARD = {
  background: 'var(--f1-card-gradient)',
  border: '1px solid var(--f1-card-border)',
  boxShadow: 'var(--f1-card-shadow)',
} as const

function Dropdown({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string | number
  options: { value: string | number; label: string; muted?: boolean }[]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => String(o.value) === String(value))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--f1-muted)' }}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium min-w-[160px] justify-between"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: open ? '1px solid rgba(225,6,0,0.5)' : '1px solid var(--f1-card-border)',
          color: disabled ? 'var(--f1-muted)' : 'var(--f1-text)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <span style={{ color: 'var(--f1-muted)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 rounded-xl"
          style={{
            background: '#1a1a1a',
            border: '1px solid var(--f1-card-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            minWidth: '100%',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {options.map(o => {
            const isSelected = String(o.value) === String(value)
            return (
              <button
                key={o.value}
                type="button"
                disabled={o.muted}
                onClick={() => { if (!o.muted) { onChange(String(o.value)); setOpen(false) } }}
                className="w-full text-left px-4 py-2.5 text-sm"
                style={{
                  background: isSelected ? 'rgba(225,6,0,0.15)' : 'transparent',
                  color: o.muted ? 'rgba(255,255,255,0.2)' : isSelected ? '#fff' : 'var(--f1-muted)',
                  fontWeight: isSelected ? 700 : 400,
                  cursor: o.muted ? 'default' : 'pointer',
                }}
                onMouseEnter={e => { if (!isSelected && !o.muted) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(225,6,0,0.15)' : 'transparent' }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TelemetriaPage() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [races, setRaces] = useState<Race[]>([])
  const [round, setRound] = useState('')
  const [session, setSession] = useState('R')

  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)
  const [sessionError, setSessionError] = useState('')

  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  const [telemetryMap, setTelemetryMap] = useState<Record<string, DriverTelemetry>>({})
  const [loadingDrivers, setLoadingDrivers] = useState<Set<string>>(new Set())

  useEffect(() => {
    setRaces([])
    setRound('')
    setSessionData(null)
    setSelectedDrivers([])
    setTelemetryMap({})

    fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`)
      .then(r => r.json())
      .then(data => {
        const list: Race[] = data.MRData.RaceTable.Races
        setRaces(list)
        const today = new Date()
        const past = list.filter(r => new Date(r.date + 'T00:00:00') < today)
        if (past.length > 0) setRound(past[0].round)
        else if (list.length > 0) setRound(list[0].round)
      })
      .catch(() => {})
  }, [year])

  function loadSession() {
    setLoadingSession(true)
    setSessionError('')
    setSessionData(null)
    setSelectedDrivers([])
    setTelemetryMap({})

    fetch(`${API}/session/${year}/${round}/${session}`)
      .then(r => r.json())
      .then(data => {
        if (data.detail) setSessionError(data.detail)
        else setSessionData(data)
      })
      .catch(() => setSessionError('Error al conectar con la API'))
      .finally(() => setLoadingSession(false))
  }

  function toggleDriver(r: Result) {
    const isSelected = selectedDrivers.includes(r.driver)

    if (isSelected) {
      setSelectedDrivers(prev => prev.filter(d => d !== r.driver))
      setTelemetryMap(prev => {
        const next = { ...prev }
        delete next[r.driver]
        return next
      })
      return
    }

    if (selectedDrivers.length >= MAX_DRIVERS) return

    const newSelected = [...selectedDrivers, r.driver]
    setSelectedDrivers(newSelected)
    setLoadingDrivers(prev => new Set(prev).add(r.driver))

    fetch(`${API}/telemetry/${year}/${round}/${r.driver}?session=${session}`)
      .then(res => res.json())
      .then(data => {
        if (!data.detail) {
          setTelemetryMap(prev => {
            const next = {
              ...prev,
              [r.driver]: {
                driver: r.driver,
                fullName: r.fullName,
                teamColor: r.teamColor,
                displayColor: r.teamColor, // se recalcula abajo
                lapTime: parsePandasTime(data.lapTime),
                data: data.telemetry,
              },
            }
            return next
          })
        }
      })
      .finally(() => {
        setLoadingDrivers(prev => {
          const next = new Set(prev)
          next.delete(r.driver)
          return next
        })
      })
  }

  // Recalcular displayColors cuando cambia la selección
  const displayColors = sessionData
    ? assignDisplayColors(selectedDrivers, sessionData.results, telemetryMap)
    : {}

  const allTelemetry = selectedDrivers
    .filter(d => telemetryMap[d])
    .map(d => ({ ...telemetryMap[d], displayColor: displayColors[d] ?? telemetryMap[d].teamColor }))

  const chartData = allTelemetry.length > 0
    ? allTelemetry[0].data.distance.map((d, i) => {
        const point: Record<string, number> = { dist: Math.round(d) }
        allTelemetry.forEach(t => {
          point[`speed_${t.driver}`] = t.data.speed[i] ?? 0
          point[`throttle_${t.driver}`] = t.data.throttle[i] ?? 0
          point[`brake_${t.driver}`] = t.data.brake[i] ? 100 : 0
          point[`gear_${t.driver}`] = (t.data.gear[i] ?? 0) * 10
          point[`drs_${t.driver}`] = t.data.drs[i] > 9 ? 100 : 0
        })
        return point
      })
    : []

  const hasDRS = allTelemetry.some(t => t.data.drs.some(v => v > 9))

  const today = new Date()
  const raceOptions = races.map(r => ({
    value: r.round,
    label: stripGP(r.raceName),
    muted: new Date(r.date + 'T00:00:00') >= today,
  }))

  const hasCharts = allTelemetry.length > 0 && chartData.length > 0
  const isLoading = loadingDrivers.size > 0

  const tooltipStyle = {
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: 12,
    borderRadius: 8,
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Telemetría</span>
      </h1>
      <p className="mb-8" style={{ color: 'var(--f1-muted)' }}>
        Datos de sesión y telemetría de vuelta rápida
      </p>

      {/* Selectores */}
      <div className="rounded-2xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-end" style={CARD}>
        <Dropdown
          label="Año"
          value={year}
          options={YEARS.map(y => ({ value: y, label: String(y) }))}
          onChange={v => setYear(Number(v))}
        />
        <Dropdown
          label="Gran Premio"
          value={round}
          options={raceOptions.length > 0 ? raceOptions : [{ value: '', label: 'Cargando...' }]}
          onChange={v => setRound(v)}
          disabled={raceOptions.length === 0}
        />
        <Dropdown
          label="Sesión"
          value={session}
          options={SESSIONS.map(s => ({ value: s.value, label: s.label }))}
          onChange={v => setSession(v)}
        />
        <button
          onClick={loadSession}
          disabled={loadingSession || !round}
          className="px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 hover:opacity-85 active:scale-95"
          style={{
            background: 'var(--f1-red)',
            color: '#fff',
            boxShadow: '0 0 14px rgba(225,6,0,0.25)',
            opacity: !round ? 0.5 : 1,
          }}
        >
          {loadingSession ? 'Cargando...' : 'Cargar sesión'}
        </button>
      </div>

      {/* Error */}
      {sessionError && (
        <div
          className="rounded-2xl px-5 py-4 mb-6 text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
        >
          ⚠️ {sessionError}
        </div>
      )}

      {/* Resultados de sesión */}
      {sessionData && (
        <div className="rounded-2xl overflow-hidden mb-6" style={CARD}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
            <h2 className="font-bold">
              {sessionData.event} {sessionData.year}
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--f1-muted)' }}>
                — {SESSIONS.find(s => s.value === session)?.label}
              </span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>
              {selectedDrivers.length === 0
                ? 'Seleccioná un piloto para ver su telemetría'
                : `${selectedDrivers.length} de ${MAX_DRIVERS} pilotos seleccionados`}
            </p>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--f1-card-border)' }}>
            {sessionData.results.map(r => {
              const isSelected = selectedDrivers.includes(r.driver)
              const isLoadingThis = loadingDrivers.has(r.driver)
              const canAdd = selectedDrivers.length < MAX_DRIVERS && !isSelected
              const selectionIndex = selectedDrivers.indexOf(r.driver)
              const assignedColor = displayColors[r.driver] ?? r.teamColor

              return (
                <div
                  key={r.driver}
                  className="flex items-center gap-4 px-5 py-3 transition-all duration-150"
                  style={{
                    background: isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                    borderLeft: isSelected ? `3px solid ${assignedColor}` : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span
                    className="w-6 text-sm font-bold text-right shrink-0"
                    style={{ color: r.position === 1 ? 'var(--f1-red)' : 'var(--f1-muted)' }}
                  >
                    {r.position ?? '—'}
                  </span>

                  <div
                    className="rounded-full shrink-0 transition-all duration-150"
                    style={{
                      background: assignedColor,
                      width: isSelected ? '4px' : '3px',
                      height: '32px',
                      opacity: isSelected ? 1 : 0.4,
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: isSelected ? '#fff' : 'inherit' }}>
                      {r.fullName}
                      {isSelected && selectionIndex >= 0 && (
                        <span
                          className="ml-2 text-xs px-1.5 py-0.5 rounded font-bold"
                          style={{ background: assignedColor, color: '#fff' }}
                        >
                          #{selectionIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.team}</div>
                  </div>

                  <div className="text-right shrink-0 mr-3">
                    <div className="text-sm font-mono">{parsePandasTime(r.time)}</div>
                    {r.points > 0 && (
                      <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.points} pts</div>
                    )}
                    {r.status && r.status !== 'Finished' && (
                      <div className="text-xs" style={{ color: '#f87171' }}>{r.status}</div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleDriver(r)}
                    disabled={isLoadingThis || (!canAdd && !isSelected)}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-150"
                    style={{
                      background: isSelected ? 'rgba(248,113,113,0.15)' : canAdd ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid rgba(248,113,113,0.4)' : canAdd ? `1px solid ${r.teamColor}40` : '1px solid transparent',
                      color: isSelected ? '#f87171' : canAdd ? r.teamColor : 'rgba(255,255,255,0.2)',
                      cursor: (!canAdd && !isSelected) ? 'default' : 'pointer',
                    }}
                    title={isSelected ? 'Quitar' : canAdd ? 'Agregar' : 'Máximo 4 pilotos'}
                  >
                    {isLoadingThis ? '…' : isSelected ? '−' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Loading telemetría */}
      {isLoading && (
        <div className="rounded-2xl px-5 py-8 text-center text-sm mb-6" style={{ ...CARD, color: 'var(--f1-muted)' }}>
          <div className="animate-pulse">
            Cargando telemetría…
            <div className="text-xs mt-1">Puede tardar unos segundos</div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      {hasCharts && (
        <div className="rounded-2xl px-5 py-5" style={CARD}>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-4 mb-6 pb-4" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
            {allTelemetry.map(t => (
              <div key={t.driver} className="flex items-center gap-2">
                <div className="w-8 h-0.5 rounded-full" style={{ background: t.displayColor }} />
                <span className="text-sm font-semibold">{t.fullName}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)' }}>
                  {t.lapTime}
                </span>
              </div>
            ))}
          </div>

          {/* Velocidad */}
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--f1-muted)' }}>Velocidad (km/h)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#a0a0a0' }} tickFormatter={v => `${v}m`} />
              <YAxis tick={{ fontSize: 10, fill: '#a0a0a0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => {
                const key = String(name ?? '').replace('speed_', '')
                const t = allTelemetry.find(t => t.driver === key)
                return [v, t?.fullName ?? key]
              }} />
              {allTelemetry.map(t => (
                <Line key={t.driver} type="monotone" dataKey={`speed_${t.driver}`} stroke={t.displayColor} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Acelerador y freno */}
          <p className="text-xs font-bold uppercase tracking-wider mt-8 mb-3" style={{ color: 'var(--f1-muted)' }}>Acelerador / Freno (%)</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#a0a0a0' }} tickFormatter={v => `${v}m`} />
              <YAxis tick={{ fontSize: 10, fill: '#a0a0a0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => {
                const parts = String(name ?? '').split('_')
                const type = parts[0]
                const driverKey = parts.slice(1).join('_')
                const t = allTelemetry.find(t => t.driver === driverKey)
                return [v, `${t?.fullName ?? driverKey} (${type === 'throttle' ? 'Acelerador' : 'Freno'})`]
              }} />
              {allTelemetry.map(t => (
                <Fragment key={t.driver}>
                  <Line type="monotone" dataKey={`throttle_${t.driver}`} stroke={t.displayColor} dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey={`brake_${t.driver}`} stroke={t.displayColor} dot={false} strokeWidth={1.5} strokeDasharray="4 2" opacity={0.6} />
                </Fragment>
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Marcha */}
          <p className="text-xs font-bold uppercase tracking-wider mt-8 mb-3" style={{ color: 'var(--f1-muted)' }}>Marcha</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#a0a0a0' }} tickFormatter={v => `${v}m`} />
              <YAxis tick={{ fontSize: 10, fill: '#a0a0a0' }} domain={[0, 80]} tickFormatter={v => String(v / 10)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => {
                const key = String(name ?? '').replace('gear_', '')
                const t = allTelemetry.find(t => t.driver === key)
                return [v / 10, t?.fullName ?? key]
              }} />
              {allTelemetry.map(t => (
                <Line key={t.driver} type="stepAfter" dataKey={`gear_${t.driver}`} stroke={t.displayColor} dot={false} strokeWidth={1.5} />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* DRS — solo si hay datos */}
          {hasDRS && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider mt-8 mb-3" style={{ color: 'var(--f1-muted)' }}>DRS</p>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#a0a0a0' }} tickFormatter={v => `${v}m`} />
                  <YAxis tick={false} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => {
                    const key = String(name ?? '').replace('drs_', '')
                    const t = allTelemetry.find(t => t.driver === key)
                    return [v > 0 ? 'Abierto' : 'Cerrado', t?.fullName ?? key]
                  }} />
                  {allTelemetry.map(t => (
                    <Line key={t.driver} type="stepAfter" dataKey={`drs_${t.driver}`} stroke={t.displayColor} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </main>
  )
}