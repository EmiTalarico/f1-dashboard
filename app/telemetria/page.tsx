'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL

const YEARS = [2026, 2025, 2024, 2023]
const SESSIONS = [
  { value: 'R',   label: 'Carrera' },
  { value: 'Q',   label: 'Clasificación' },
  { value: 'FP1', label: 'Práctica 1' },
  { value: 'FP2', label: 'Práctica 2' },
  { value: 'FP3', label: 'Práctica 3' },
]

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

type Telemetry = {
  driver: string
  lapTime: string
  telemetry: {
    distance: number[]
    speed: number[]
    throttle: number[]
    brake: boolean[]
    gear: number[]
    drs: number[]
  }
}

function formatTime(raw: string | null) {
  if (!raw) return '—'
  const match = raw.match(/(\d+):(\d+)\.(\d+)/)
  if (match) return `${match[1]}:${match[2]}.${match[3].slice(0, 3)}`
  const gap = raw.match(/00:00:0?(\d+\.\d+)/)
  if (gap) return `+${parseFloat(gap[1]).toFixed(3)}s`
  const hrs = raw.match(/01:(\d+):(\d+)/)
  if (hrs) return `${hrs[1]}:${hrs[2]}`
  return raw
}

export default function TelemetriaPage() {
  const [year, setYear] = useState(2025)
  const [round, setRound] = useState(1)
  const [session, setSession] = useState('R')
  const [maxRound, setMaxRound] = useState(22)

  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)
  const [sessionError, setSessionError] = useState('')

  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [loadingTelemetry, setLoadingTelemetry] = useState(false)

  // Load session results
  function loadSession() {
    setLoadingSession(true)
    setSessionError('')
    setSessionData(null)
    setSelectedDriver(null)
    setTelemetry(null)

    fetch(`${API}/session/${year}/${round}/${session}`)
      .then(r => r.json())
      .then(data => {
        if (data.detail) setSessionError(data.detail)
        else setSessionData(data)
      })
      .catch(() => setSessionError('Error al conectar con la API'))
      .finally(() => setLoadingSession(false))
  }

  // Load telemetry for selected driver
  useEffect(() => {
    if (!selectedDriver) return
    setLoadingTelemetry(true)
    setTelemetry(null)

    fetch(`${API}/telemetry/${year}/${round}/${selectedDriver}`)
      .then(r => r.json())
      .then(data => {
        if (!data.detail) setTelemetry(data)
      })
      .finally(() => setLoadingTelemetry(false))
  }, [selectedDriver])

  // Build chart data
  const chartData = telemetry
    ? telemetry.telemetry.distance.map((d, i) => ({
        dist: Math.round(d),
        speed: telemetry.telemetry.speed[i],
        throttle: telemetry.telemetry.throttle[i],
        brake: telemetry.telemetry.brake[i] ? 100 : 0,
        gear: telemetry.telemetry.gear[i] * 10,
        drs: telemetry.telemetry.drs[i] > 9 ? 100 : 0,
      }))
    : []

  return (
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Telemetría</span>
      </h1>
      <p className="mb-8" style={{ color: 'var(--f1-muted)' }}>
        Datos de sesión y telemetría de vuelta rápida
      </p>

      {/* Selectores */}
      <div className="rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-end" style={{ background: 'var(--f1-gray)' }}>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--f1-muted)' }}>Año</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-text)', border: 'none', outline: 'none' }}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--f1-muted)' }}>Ronda</label>
          <input
            type="number"
            min={1}
            max={maxRound}
            value={round}
            onChange={e => setRound(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm font-medium w-20"
            style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-text)', border: 'none', outline: 'none' }}
          />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--f1-muted)' }}>Sesión</label>
          <select
            value={session}
            onChange={e => setSession(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-text)', border: 'none', outline: 'none' }}
          >
            {SESSIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <button
          onClick={loadSession}
          disabled={loadingSession}
          className="px-5 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-80"
          style={{ background: 'var(--f1-red)', color: '#fff' }}
        >
          {loadingSession ? 'Cargando...' : 'Cargar sesión'}
        </button>
      </div>

      {/* Error */}
      {sessionError && (
        <div className="rounded-xl px-5 py-4 mb-6 text-sm" style={{ background: 'var(--f1-gray)', color: '#f87171' }}>
          ⚠️ {sessionError}
        </div>
      )}

      {/* Resultados de sesión */}
      {sessionData && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--f1-gray)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
            <h2 className="font-semibold">{sessionData.event} {sessionData.year} — {SESSIONS.find(s => s.value === session)?.label}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>Clickeá un piloto para ver su telemetría</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
            {sessionData.results.map(r => (
              <button
                key={r.driver}
                onClick={() => setSelectedDriver(r.driver === selectedDriver ? null : r.driver)}
                className="w-full flex items-center gap-4 px-5 py-3 text-left transition-opacity hover:opacity-80"
                style={{
                  background: selectedDriver === r.driver ? 'var(--f1-light-gray)' : 'transparent',
                  borderLeft: selectedDriver === r.driver ? `3px solid ${r.teamColor}` : '3px solid transparent',
                }}
              >
                <span className="w-6 text-sm font-bold text-right shrink-0" style={{ color: r.position === 1 ? 'var(--f1-red)' : 'var(--f1-muted)' }}>
                  {r.position ?? '—'}
                </span>
                <div
                  className="w-1 h-8 rounded-full shrink-0"
                  style={{ background: r.teamColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{r.fullName}</div>
                  <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.team}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono">{formatTime(r.time)}</div>
                  {r.points > 0 && <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.points} pts</div>}
                  {r.status !== 'Finished' && <div className="text-xs" style={{ color: '#f87171' }}>{r.status}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Telemetría */}
      {loadingTelemetry && (
        <div className="text-center py-12" style={{ color: 'var(--f1-muted)' }}>
          Cargando telemetría de {selectedDriver}... (puede tardar unos segundos)
        </div>
      )}

      {telemetry && chartData.length > 0 && (
        <div className="rounded-xl px-5 py-5" style={{ background: 'var(--f1-gray)' }}>
          <h3 className="font-semibold mb-1">Vuelta rápida — {telemetry.driver}</h3>
          <p className="text-xs mb-6" style={{ color: 'var(--f1-muted)' }}>
            Tiempo: {telemetry.lapTime}
          </p>

          {/* Velocidad */}
          <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--f1-muted)' }}>Velocidad (km/h)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#a0a0a0' }} tickFormatter={v => `${v}m`} />
              <YAxis tick={{ fontSize: 10, fill: '#a0a0a0' }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: 'none', fontSize: 12 }} />
              <Line type="monotone" dataKey="speed" stroke="#e10600" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>

          {/* Acelerador y freno */}
          <p className="text-xs font-semibold uppercase mt-6 mb-2" style={{ color: 'var(--f1-muted)' }}>Acelerador / Freno (%)</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#a0a0a0' }} tickFormatter={v => `${v}m`} />
              <YAxis tick={{ fontSize: 10, fill: '#a0a0a0' }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: 'none', fontSize: 12 }} />
              <Line type="monotone" dataKey="throttle" stroke="#22c55e" dot={false} strokeWidth={1.5} name="Acelerador" />
              <Line type="monotone" dataKey="brake" stroke="#f87171" dot={false} strokeWidth={1.5} name="Freno" />
            </LineChart>
          </ResponsiveContainer>

          {/* Marcha */}
          <p className="text-xs font-semibold uppercase mt-6 mb-2" style={{ color: 'var(--f1-muted)' }}>Marcha</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="dist" tick={{ fontSize: 10, fill: '#a0a0a0' }} tickFormatter={v => `${v}m`} />
              <YAxis tick={{ fontSize: 10, fill: '#a0a0a0' }} domain={[0, 80]} tickFormatter={v => String(v / 10)} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: 'none', fontSize: 12 }} formatter={(v: any) => [v / 10, 'Marcha']} />
              <Line type="stepAfter" dataKey="gear" stroke="#a855f7" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </main>
  )
}