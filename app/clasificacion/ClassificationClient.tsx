'use client'

import { useState, useRef, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { DriverStanding, ConstructorStanding, RaceResult, RaceResultEntry } from './types'

const NATIONALITY_CODES: Record<string, string> = {
  British: 'gb', Dutch: 'nl', Monegasque: 'mc', Spanish: 'es',
  Australian: 'au', Mexican: 'mx', Finnish: 'fi', German: 'de',
  French: 'fr', Canadian: 'ca', Thai: 'th', Japanese: 'jp',
  Italian: 'it', Brazilian: 'br', Argentine: 'ar', American: 'us',
  Danish: 'dk', Chinese: 'cn', Austrian: 'at', 'New Zealander': 'nz',
}

const CARD = {
  background: 'var(--f1-card-gradient)',
  border: '1px solid var(--f1-card-border)',
  boxShadow: 'var(--f1-card-shadow)',
} as const

function isClassified(status: string): boolean {
  return (
    status === 'Finished' ||
    status === 'Lapped' ||
    status.startsWith('+') ||
    /^\+\d+ Lap/.test(status)
  )
}

function positionColor(pos: string | number) {
  const p = parseInt(String(pos))
  if (p === 1) return { bg: 'rgba(250,204,21,0.2)', color: '#facc15', text: 'P1' }
  if (p === 2) return { bg: 'rgba(148,163,184,0.2)', color: '#94a3b8', text: 'P2' }
  if (p === 3) return { bg: 'rgba(180,83,9,0.2)', color: '#b45309', text: 'P3' }
  if (p <= 10) return { bg: 'rgba(34,197,94,0.08)', color: '#22c55e', text: `P${p}` }
  return { bg: 'transparent', color: 'rgba(255,255,255,0.4)', text: `P${p}` }
}

type Props = {
  drivers: DriverStanding[]
  constructors: ConstructorStanding[]
  races: RaceResult[]
  teamColors: Record<string, string>
}

export default function ClasificacionClient({ drivers, constructors, races, teamColors }: Props) {
  const [tab, setTab] = useState<'pilotos' | 'constructores'>('pilotos')
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(
    new Set(drivers.slice(0, 10).map(d => d.Driver.driverId))
  )
  const [driverPickerOpen, setDriverPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setDriverPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Construir mapa driverId → driverId desde results (pueden diferir)
  // Usamos el driverId que viene en los resultados directamente
  // y buscamos por familyName como fallback
  const resultDriverIds = new Set<string>()
  races.forEach(race => race.Results?.forEach(r => resultDriverIds.add(r.Driver.driverId)))

  // Mapa: driverId de standings → driverId en results
  // Si standings dice "max_verstappen" y results dice "max_verstappen" → directo
  // Si standings dice "verstappen" y results dice "max_verstappen" → necesitamos el fallback
  const standingsToResultId: Record<string, string> = {}
  drivers.forEach(d => {
    if (resultDriverIds.has(d.Driver.driverId)) {
      standingsToResultId[d.Driver.driverId] = d.Driver.driverId
    } else {
      // Buscar por apellido en results
      for (const id of resultDriverIds) {
        if (id.includes(d.Driver.familyName.toLowerCase().replace(' ', '_'))) {
          standingsToResultId[d.Driver.driverId] = id
          break
        }
      }
      // Si no encontramos, usar el mismo
      if (!standingsToResultId[d.Driver.driverId]) {
        standingsToResultId[d.Driver.driverId] = d.Driver.driverId
      }
    }
  })

  // ── Gráfico pilotos ──────────────────────────────────────────────────────
  type ChartPoint = { round: string; name: string; [key: string]: string | number }
  const driverChartData: ChartPoint[] = []
  const cumulative: Record<string, number> = {}

  races.forEach(race => {
    const point: ChartPoint = {
      round: race.round,
      name: race.raceName.replace(' Grand Prix', '').replace(' GP', ''),
    }
    race.Results?.forEach((r: RaceResultEntry) => {
      cumulative[r.Driver.driverId] = (cumulative[r.Driver.driverId] ?? 0) + parseFloat(r.points ?? '0')
    })
    drivers.forEach(d => {
      const resultId = standingsToResultId[d.Driver.driverId] ?? d.Driver.driverId
      point[d.Driver.driverId] = cumulative[resultId] ?? 0
    })
    driverChartData.push(point)
  })

  // ── Gráfico constructores ────────────────────────────────────────────────
  const constructorChartData: ChartPoint[] = []
  const cumCon: Record<string, number> = {}

  races.forEach(race => {
    const point: ChartPoint = {
      round: race.round,
      name: race.raceName.replace(' Grand Prix', '').replace(' GP', ''),
    }
    race.Results?.forEach((r: RaceResultEntry) => {
      const name = r.Constructor.name
      cumCon[name] = (cumCon[name] ?? 0) + parseFloat(r.points ?? '0')
    })
    constructors.forEach(c => {
      point[c.Constructor.name] = cumCon[c.Constructor.name] ?? 0
    })
    constructorChartData.push(point)
  })

  const leader = tab === 'pilotos' ? drivers[0] : constructors[0]
  const leaderPoints = leader
    ? parseFloat(tab === 'pilotos'
        ? (leader as DriverStanding).points
        : (leader as ConstructorStanding).points)
    : 0

  const tooltipStyle = {
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: 11,
    borderRadius: 8,
  }

  function toggleDriver(id: string) {
    setSelectedDrivers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Clasificación</span>
      </h1>
      <p className="mb-6" style={{ color: 'var(--f1-muted)' }}>
        Temporada 2026 · {races.length} carreras disputadas
      </p>

      {/* Toggle */}
      <div className="flex gap-2 mb-6">
        {(['pilotos', 'constructores'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 rounded-full text-sm font-bold transition-all duration-150"
            style={{
              background: tab === t ? 'var(--f1-red)' : 'rgba(255,255,255,0.06)',
              color: tab === t ? '#fff' : 'var(--f1-muted)',
              border: `1px solid ${tab === t ? 'var(--f1-red)' : 'var(--f1-card-border)'}`,
              boxShadow: tab === t ? '0 0 12px rgba(225,6,0,0.25)' : 'none',
            }}
          >
            {t === 'pilotos' ? '🏎 Pilotos' : '🏭 Constructores'}
          </button>
        ))}
      </div>

      {/* Líder */}
      {leader && (
        <div
          className="rounded-2xl px-6 py-4 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(225,6,0,0.10), rgba(225,6,0,0.02))',
            border: '1px solid rgba(225,6,0,0.25)',
            boxShadow: '0 0 30px rgba(225,6,0,0.08)',
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--f1-red)' }}>
                🏆 Líder del campeonato
              </p>
              <h2 className="text-2xl font-black">
                {tab === 'pilotos'
                  ? `${(leader as DriverStanding).Driver.givenName} ${(leader as DriverStanding).Driver.familyName}`
                  : (leader as ConstructorStanding).Constructor.name}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--f1-muted)' }}>
                {tab === 'pilotos'
                  ? (leader as DriverStanding).Constructors[0].name
                  : `${(leader as ConstructorStanding).wins} victorias`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black" style={{ color: 'var(--f1-red)' }}>
                {tab === 'pilotos'
                  ? (leader as DriverStanding).points
                  : (leader as ConstructorStanding).points}
              </div>
              <div className="text-sm" style={{ color: 'var(--f1-muted)' }}>puntos</div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico */}
      {races.length > 0 && (
        <div className="rounded-2xl px-5 py-5 mb-6" style={CARD}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-bold">Evolución de puntos</h3>
            {tab === 'pilotos' && (
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={() => setSelectedDrivers(new Set(drivers.slice(0, 5).map(d => d.Driver.driverId)))}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}
                >Top 5</button>
                <button
                  onClick={() => setSelectedDrivers(new Set(drivers.slice(0, 10).map(d => d.Driver.driverId)))}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}
                >Top 10</button>
                <button
                  onClick={() => setSelectedDrivers(new Set(drivers.map(d => d.Driver.driverId)))}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}
                >Todos</button>
                <div className="relative" ref={pickerRef}>
                  <button
                    onClick={() => setDriverPickerOpen(o => !o)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{
                      background: driverPickerOpen ? 'rgba(225,6,0,0.15)' : 'rgba(255,255,255,0.06)',
                      color: driverPickerOpen ? 'var(--f1-red)' : 'var(--f1-muted)',
                      border: `1px solid ${driverPickerOpen ? 'rgba(225,6,0,0.3)' : 'var(--f1-card-border)'}`,
                    }}
                  >
                    Elegir pilotos ▾
                  </button>
                  {driverPickerOpen && (
                    <div
                      className="absolute right-0 mt-1 z-50 rounded-xl overflow-hidden"
                      style={{
                        background: '#1a1a1a',
                        border: '1px solid var(--f1-card-border)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                        width: 220,
                        maxHeight: 320,
                        overflowY: 'auto',
                      }}
                    >
                      {drivers.map(d => {
                        const isSelected = selectedDrivers.has(d.Driver.driverId)
                        const color = teamColors[d.Constructors[0].name] ?? '#888'
                        return (
                          <button
                            key={d.Driver.driverId}
                            onClick={() => toggleDriver(d.Driver.driverId)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                            style={{
                              background: isSelected ? `${color}18` : 'transparent',
                              color: isSelected ? '#fff' : 'var(--f1-muted)',
                            }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isSelected ? color : 'rgba(255,255,255,0.2)' }} />
                            <span className="font-medium">{d.Driver.familyName}</span>
                            <span className="ml-auto text-xs" style={{ color: 'var(--f1-muted)' }}>{d.points}p</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={tab === 'pilotos' ? driverChartData : constructorChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#a0a0a0' }} angle={-35} textAnchor="end" height={55} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#a0a0a0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`${v} pts`, name]} />
              {tab === 'pilotos'
                ? drivers.filter(d => selectedDrivers.has(d.Driver.driverId)).map(d => (
                    <Line
                      key={d.Driver.driverId}
                      type="monotone"
                      dataKey={d.Driver.driverId}
                      name={d.Driver.familyName}
                      stroke={teamColors[d.Constructors[0].name] ?? '#888'}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))
                : constructors.map(c => (
                    <Line
                      key={c.Constructor.constructorId}
                      type="monotone"
                      dataKey={c.Constructor.name}
                      name={c.Constructor.name}
                      stroke={teamColors[c.Constructor.name] ?? '#888'}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))
              }
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={CARD}>
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as any}>
          {/* Header */}
          <div
            className="flex items-center px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
            style={{ borderBottom: '1px solid var(--f1-card-border)', color: 'var(--f1-muted)', minWidth: 'max-content' }}
          >
            <span style={{ width: 36, flexShrink: 0 }}>Pos</span>
            <span style={{ width: 160, flexShrink: 0 }}>{tab === 'pilotos' ? 'Piloto' : 'Escudería'}</span>
            {races.map(r => (
              <span key={r.round} style={{ width: 44, flexShrink: 0, textAlign: 'center' }} title={r.raceName}>
                R{r.round}
              </span>
            ))}
            <span style={{ width: 60, flexShrink: 0, textAlign: 'right', marginLeft: 8 }}>Pts</span>
            <span style={{ width: 44, flexShrink: 0, textAlign: 'right' }}>Vic.</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--f1-card-border)' }}>
            {tab === 'pilotos'
              ? drivers.map(d => {
                  const teamColor = teamColors[d.Constructors[0].name] ?? '#666'
                  const code = NATIONALITY_CODES[d.Driver.nationality]
                  // El driverId en results puede ser diferente al de standings
                  const resultId = standingsToResultId[d.Driver.driverId] ?? d.Driver.driverId

                  return (
                    <div
                      key={d.Driver.driverId}
                      className="flex items-center px-5 py-2.5 hover:bg-white/[0.02] transition-colors"
                      style={{ borderLeft: `3px solid ${teamColor}`, minWidth: 'max-content' }}
                    >
                      <span style={{ width: 36, flexShrink: 0, fontWeight: 700, fontSize: 12, color: parseInt(d.position) <= 3 ? '#fff' : 'var(--f1-muted)' }}>
                        {d.position}
                      </span>
                      <div style={{ width: 160, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {code && <img src={`https://flagcdn.com/w20/${code}.png`} alt="" style={{ width: 16, height: 11, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{d.Driver.familyName}</div>
                          <div style={{ fontSize: 10, color: teamColor }}>{d.Constructors[0].name}</div>
                        </div>
                      </div>

                      {races.map(race => {
                        // Buscar por resultId (puede diferir del standings driverId)
                        const result = race.Results?.find((r: RaceResultEntry) => r.Driver.driverId === resultId)
                        if (!result) return (
                          <span key={race.round} style={{ width: 44, flexShrink: 0, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.1)' }}>—</span>
                        )
                        if (!isClassified(result.status)) return (
                          <span key={race.round} style={{ width: 44, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 700, color: result.status === 'Did not start' ? '#666' : '#f87171' }}
                            title={result.status}>{result.status === 'Did not start' ? 'DNS' : 'DNF'}</span>
                        )
                        const { bg, color, text } = positionColor(result.position)
                        return (
                          <span
                            key={race.round}
                            style={{ width: 44, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 700, background: bg, color, borderRadius: 4, padding: '1px 0' }}
                            title={`${race.raceName}: P${result.position} — ${result.points}pts — ${result.status}`}
                          >
                            {text}
                          </span>
                        )
                      })}

                      <span style={{ width: 60, flexShrink: 0, textAlign: 'right', fontWeight: 700, marginLeft: 8 }}>{d.points}</span>
                      <span style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 12, color: 'var(--f1-muted)' }}>{d.wins}</span>
                    </div>
                  )
                })
              : constructors.map(c => {
                  const teamColor = teamColors[c.Constructor.name] ?? '#666'
                  return (
                    <div
                      key={c.Constructor.constructorId}
                      className="flex items-center px-5 py-2.5 hover:bg-white/[0.02] transition-colors"
                      style={{ borderLeft: `3px solid ${teamColor}`, minWidth: 'max-content' }}
                    >
                      <span style={{ width: 36, flexShrink: 0, fontWeight: 700, fontSize: 12, color: parseInt(c.position) <= 3 ? '#fff' : 'var(--f1-muted)' }}>
                        {c.position}
                      </span>
                      <div style={{ width: 160, flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: teamColor }}>{c.Constructor.name}</div>
                      </div>

                      {races.map(race => {
                        const results = race.Results?.filter((r: RaceResultEntry) => r.Constructor.name === c.Constructor.name) ?? []
                        if (results.length === 0) return (
                          <span key={race.round} style={{ width: 44, flexShrink: 0, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.1)' }}>—</span>
                        )
                        const classified = results.filter((r: RaceResultEntry) => isClassified(r.status))
                        if (classified.length === 0) return (
                          <span key={race.round} style={{ width: 44, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#f87171' }}
                            title={results.map(r => r.status).join(', ')}>DNF</span>
                        )
                        const best = classified.reduce((a: RaceResultEntry, b: RaceResultEntry) => parseInt(a.position) < parseInt(b.position) ? a : b)
                        const { bg, color, text } = positionColor(best.position)
                        return (
                          <span
                            key={race.round}
                            style={{ width: 44, flexShrink: 0, textAlign: 'center', fontSize: 11, fontWeight: 700, background: bg, color, borderRadius: 4, padding: '1px 0' }}
                            title={`${race.raceName}: mejor P${best.position}`}
                          >
                            {text}
                          </span>
                        )
                      })}

                      <span style={{ width: 60, flexShrink: 0, textAlign: 'right', fontWeight: 700, marginLeft: 8 }}>{c.points}</span>
                      <span style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 12, color: 'var(--f1-muted)' }}>{c.wins}</span>
                    </div>
                  )
                })
            }
          </div>
        </div>
      </div>
    </main>
  )
}