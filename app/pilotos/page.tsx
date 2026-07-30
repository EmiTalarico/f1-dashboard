'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { DRIVERS_DB, ACTIVE_DRIVERS, ALL_NATIONALITIES, ALL_TEAMS, type DriverProfile } from '../data/driversDB'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function getAge(dob: string) {
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

function formatDate(dob: string) {
  const [y, m, d] = dob.split('-')
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

function StatusBadge({ status }: { status: DriverProfile['status'] }) {
  const map = {
    active:   { label: 'Activo',   bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
    retired:  { label: 'Retirado', bg: 'rgba(160,160,160,0.15)', color: '#a0a0a0' },
    deceased: { label: 'Fallecido', bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
  }
  const s = map[status]
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function TeamTimeline({ teams }: { teams: DriverProfile['teams'] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {teams.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
          <span className="font-medium">{t.team}</span>
          <span style={{ color: 'var(--f1-muted)' }}>
            {t.from} – {t.to === 'present' ? 'hoy' : t.to}
          </span>
        </div>
      ))}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--f1-card-border)' }}>
      <div className="text-lg font-black" style={{ color: color ?? 'inherit' }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>{label}</div>
    </div>
  )
}

function Dropdown({
  label, value, options, onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f1-muted)' }}>
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium min-w-[160px] justify-between"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: open ? '1px solid rgba(225,6,0,0.5)' : '1px solid var(--f1-card-border)',
          color: 'var(--f1-text)',
        }}
      >
        <span className="truncate">{selected?.label ?? 'Todas'}</span>
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
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {options.map(o => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm"
                style={{
                  background: isSelected ? 'rgba(225,6,0,0.15)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--f1-muted)',
                  fontWeight: isSelected ? 700 : 400,
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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

function DriverCard({ driver, onClick }: { driver: DriverProfile; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const mainTeamColor = driver.teams[driver.teams.length - 1]?.color ?? '#fff'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--f1-card-gradient)',
        border: `1px solid ${hovered ? mainTeamColor + '60' : 'var(--f1-card-border)'}`,
        boxShadow: hovered ? `0 4px 24px ${mainTeamColor}20` : 'var(--f1-card-shadow)',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div className="h-[3px]" style={{ background: mainTeamColor }} />
      <div className="flex gap-0">
        <div className="relative shrink-0" style={{ width: 100, height: 120, background: 'rgba(255,255,255,0.04)' }}>
          <img
            src={`/drivers/${driver.id}.webp`}
            alt={`${driver.firstName} ${driver.lastName}`}
            className="w-full h-full object-cover object-top"
            onError={e => {
              const el = e.currentTarget
              el.style.display = 'none'
              const parent = el.parentElement
              if (parent && !parent.querySelector('.initials')) {
                const div = document.createElement('div')
                div.className = 'initials'
                div.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:${mainTeamColor};opacity:0.4`
                div.textContent = driver.lastName[0]
                parent.appendChild(div)
              }
            }}
          />
        </div>
        <div className="flex-1 px-3 py-3 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1">
            <div>
              <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>{driver.firstName}</div>
              <div className="font-black text-base leading-tight uppercase">{driver.lastName}</div>
            </div>
            {driver.number && (
              <span className="text-lg font-black shrink-0" style={{ color: mainTeamColor, opacity: 0.7 }}>
                #{driver.number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <img src={`https://flagcdn.com/w20/${driver.countryCode}.png`} alt={driver.nationality} className="w-4 h-3 object-cover rounded-sm" />
            <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{driver.nationality}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {driver.championships > 0 && (
              <span className="text-xs font-bold" style={{ color: '#facc15' }}>🏆 {driver.championships}</span>
            )}
            <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{driver.wins} victorias</span>
          </div>
          <div className="mt-2 text-xs truncate" style={{ color: mainTeamColor }}>
            {driver.teams[driver.teams.length - 1]?.team}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Tipos para resultados de temporada ───────────────────────────────────────

type RaceResult = {
  round: string
  raceName: string
  date: string
  position: string
  positionText: string
  points: string
  grid: string
  status: string
  fastestLapRank: string | null
  fastestLapTime: string | null
}

function positionLabel(pos: string, posText: string) {
  if (posText === 'R') return { label: 'RET', color: '#f87171' }
  if (posText === 'D') return { label: 'DSQ', color: '#f87171' }
  if (posText === 'W') return { label: 'WD', color: '#a0a0a0' }
  if (posText === 'F') return { label: 'DNF', color: '#f87171' }
  const n = parseInt(pos)
  if (n === 1) return { label: '1°', color: '#facc15' }
  if (n === 2) return { label: '2°', color: '#d1d5db' }
  if (n === 3) return { label: '3°', color: '#cd7f32' }
  return { label: `${n}°`, color: 'inherit' }
}

function gpShortName(name: string) {
  return name
    .replace(' Grand Prix', '')
    .replace(' Gran Premio', '')
    .replace('Grand Prix of ', '')
    .trim()
}

async function fetchDriverResults(driverId: string): Promise<RaceResult[]> {
  const res = await fetch(`https://api.jolpi.ca/ergast/f1/2026/drivers/${driverId}/results/?format=json`)
  const data = await res.json()
  const races = data?.MRData?.RaceTable?.Races ?? []
  return races.map((r: any) => {
    const result = r.Results[0]
    return {
      round: r.round,
      raceName: r.raceName,
      date: r.date,
      position: result.position,
      positionText: result.positionText,
      points: result.points,
      grid: result.grid,
      status: result.status,
      fastestLapRank: result.FastestLap?.rank ?? null,
      fastestLapTime: result.FastestLap?.Time?.time ?? null,
    }
  })
}

function calcTotals(results: RaceResult[]) {
  return {
    pts: results.reduce((acc, r) => acc + parseFloat(r.points || '0'), 0),
    wins: results.filter(r => r.position === '1').length,
    podiums: results.filter(r => ['1', '2', '3'].includes(r.position)).length,
    fl: results.filter(r => r.fastestLapRank === '1').length,
  }
}

// ─── Selector de rival ────────────────────────────────────────────────────────

function RivalPicker({
  currentDriverId,
  rivalId,
  onSelect,
  onClear,
}: {
  currentDriverId: string
  rivalId: string | null
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = ACTIVE_DRIVERS.filter(d => d.id !== currentDriverId)
  const rival = rivalId ? options.find(d => d.id === rivalId) : null

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--f1-muted)' }}>
        Comparar con
      </span>

      <div className="relative flex-1" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium w-full justify-between"
          style={{
            background: rival ? 'rgba(255,255,255,0.06)' : 'rgba(225,6,0,0.08)',
            border: open
              ? '1px solid rgba(225,6,0,0.5)'
              : rival
              ? '1px solid var(--f1-card-border)'
              : '1px solid rgba(225,6,0,0.3)',
            color: rival ? 'var(--f1-text)' : 'var(--f1-red)',
          }}
        >
          <span className="truncate">
            {rival ? `${rival.firstName} ${rival.lastName}` : '+ Elegir piloto'}
          </span>
          <span style={{ color: 'var(--f1-muted)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div
            className="absolute z-50 mt-1 rounded-xl w-full"
            style={{
              background: '#1a1a1a',
              border: '1px solid var(--f1-card-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {options.map(d => {
              const color = d.teams[d.teams.length - 1]?.color ?? '#fff'
              const isSelected = d.id === rivalId
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { onSelect(d.id); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2"
                  style={{
                    background: isSelected ? 'rgba(225,6,0,0.15)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--f1-muted)',
                    fontWeight: isSelected ? 700 : 400,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span>{d.firstName} {d.lastName}</span>
                  {d.number && <span className="ml-auto text-xs font-black" style={{ color }}>{d.number}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {rival && (
        <button
          type="button"
          onClick={onClear}
          className="text-sm px-2 py-1.5 rounded-lg transition-opacity hover:opacity-60 shrink-0"
          style={{ color: 'var(--f1-muted)', border: '1px solid var(--f1-card-border)' }}
          title="Quitar comparación"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── SeasonTab ────────────────────────────────────────────────────────────────

function SeasonTab({ driver, teamColor }: { driver: DriverProfile; teamColor: string }) {
  const [results, setResults] = useState<RaceResult[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [rivalId, setRivalId] = useState<string | null>(null)
  const [rivalResults, setRivalResults] = useState<RaceResult[] | null>(null)
  const [rivalLoading, setRivalLoading] = useState(false)
  const [rivalError, setRivalError] = useState(false)

  const rivalDriver = rivalId ? ACTIVE_DRIVERS.find(d => d.id === rivalId) ?? null : null
  const rivalColor = rivalDriver?.teams[rivalDriver.teams.length - 1]?.color ?? '#fff'

  // Fetch piloto principal
  useEffect(() => {
    setLoading(true)
    setError(false)
    fetchDriverResults(driver.id)
      .then(setResults)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [driver.id])

  // Fetch rival cuando cambia
  useEffect(() => {
    if (!rivalId) { setRivalResults(null); return }
    setRivalLoading(true)
    setRivalError(false)
    fetchDriverResults(rivalId)
      .then(setRivalResults)
      .catch(() => setRivalError(true))
      .finally(() => setRivalLoading(false))
  }, [rivalId])

  // Reset rival al cambiar de piloto principal
  useEffect(() => { setRivalId(null); setRivalResults(null) }, [driver.id])

  const totals = useMemo(() => results ? calcTotals(results) : null, [results])
  const rivalTotals = useMemo(() => rivalResults ? calcTotals(rivalResults) : null, [rivalResults])

  // Mapa round → resultado rival para lookup rápido
  const rivalMap = useMemo(() => {
    if (!rivalResults) return {}
    return Object.fromEntries(rivalResults.map(r => [r.round, r]))
  }, [rivalResults])

  const comparing = !!rivalId && !!rivalResults && !rivalLoading

  if (loading) return (
    <div className="px-5 py-8 flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
      ))}
    </div>
  )

  if (error) return (
    <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--f1-muted)' }}>
      No se pudieron cargar los resultados. Intentá de nuevo más tarde.
    </div>
  )

  if (!results || results.length === 0) return (
    <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--f1-muted)' }}>
      Sin resultados disponibles para la temporada 2026.
    </div>
  )

  return (
    <div className="px-5 pb-5">
      {/* Selector de rival */}
      <RivalPicker
        currentDriverId={driver.id}
        rivalId={rivalId}
        onSelect={setRivalId}
        onClear={() => { setRivalId(null); setRivalResults(null) }}
      />

      {/* Resumen stats */}
      {comparing && rivalTotals && totals ? (
        // Vista comparativa: cabeceras + 4 stats lado a lado
        <div className="mb-4">
          {/* Mini cabeceras */}
          <div className="grid grid-cols-2 gap-2 mb-1.5 text-xs font-bold text-center">
            <div className="truncate px-1" style={{ color: teamColor }}>{driver.lastName.toUpperCase()}</div>
            <div className="truncate px-1" style={{ color: rivalColor }}>{rivalDriver!.lastName.toUpperCase()}</div>
          </div>
          {/* 4 pares de stats */}
          {[
            { label: 'Puntos',    a: totals.pts,     b: rivalTotals.pts,     colorA: teamColor, colorB: rivalColor },
            { label: 'Victorias', a: totals.wins,    b: rivalTotals.wins,    colorA: totals.wins > 0 ? '#facc15' : teamColor, colorB: rivalTotals.wins > 0 ? '#facc15' : rivalColor },
            { label: 'Podios',    a: totals.podiums, b: rivalTotals.podiums, colorA: undefined, colorB: undefined },
            { label: 'V. Rápidas', a: totals.fl,     b: rivalTotals.fl,      colorA: totals.fl > 0 ? '#a855f7' : undefined, colorB: rivalTotals.fl > 0 ? '#a855f7' : undefined },
          ].map(({ label, a, b, colorA, colorB }) => (
            <div key={label} className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${a > b ? teamColor + '60' : 'var(--f1-card-border)'}` }}>
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{label}</span>
                <span className="text-base font-black" style={{ color: colorA ?? 'inherit' }}>{a}</span>
              </div>
              <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${b > a ? rivalColor + '60' : 'var(--f1-card-border)'}` }}>
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{label}</span>
                <span className="text-base font-black" style={{ color: colorB ?? 'inherit' }}>{b}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Vista individual
        totals && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <StatBox label="Puntos" value={totals.pts} color={teamColor} />
            <StatBox label="Victorias" value={totals.wins} color={totals.wins > 0 ? '#facc15' : undefined} />
            <StatBox label="Podios" value={totals.podiums} />
            <StatBox label="V. Rápidas" value={totals.fl} color={totals.fl > 0 ? '#a855f7' : undefined} />
          </div>
        )
      )}

      {/* Spinner rival cargando */}
      {rivalId && rivalLoading && (
        <div className="flex flex-col gap-2 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          ))}
        </div>
      )}

      {rivalError && (
        <div className="text-xs mb-3 text-center" style={{ color: '#f87171' }}>
          No se pudieron cargar los resultados del rival.
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--f1-card-border)' }}>
        {/* Header */}
        {comparing ? (
          <div
            className="grid text-xs font-bold uppercase tracking-wider px-3 py-2 gap-2"
            style={{
              gridTemplateColumns: '2rem 1fr 1fr',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--f1-muted)',
              borderBottom: '1px solid var(--f1-card-border)',
            }}
          >
            <span>Rd</span>
            <span style={{ color: teamColor }}>{driver.acronym}</span>
            <span style={{ color: rivalColor }}>{rivalDriver!.acronym}</span>
          </div>
        ) : (
          <div
            className="grid text-xs font-bold uppercase tracking-wider px-3 py-2"
            style={{
              gridTemplateColumns: '2rem 1fr 2.5rem 3rem 2.5rem',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--f1-muted)',
              borderBottom: '1px solid var(--f1-card-border)',
            }}
          >
            <span>Rd</span>
            <span>Gran Premio</span>
            <span className="text-center">Pos</span>
            <span className="text-center">Pts</span>
            <span className="text-center">Sal</span>
          </div>
        )}

        {/* Filas */}
        {results.map((r, i) => {
          const { label, color } = positionLabel(r.position, r.positionText)
          const isFl = r.fastestLapRank === '1'
          const isLast = i === results.length - 1
          const rival = rivalMap[r.round]

          if (comparing) {
            const rLabel = rival ? positionLabel(rival.position, rival.positionText) : null
            const rIsFl = rival?.fastestLapRank === '1'
            // Quién ganó el duelo en esta carrera
            const aPos = parseInt(r.position)
            const bPos = rival ? parseInt(rival.position) : 99
            const aWins = !isNaN(aPos) && !isNaN(bPos) && aPos < bPos
            const bWins = !isNaN(aPos) && !isNaN(bPos) && bPos < aPos

            return (
              <div
                key={r.round}
                className="grid items-center px-3 py-2.5 text-sm gap-2"
                style={{
                  gridTemplateColumns: '2rem 1fr 1fr',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Ronda + nombre GP */}
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.round}</span>

                {/* Piloto A */}
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                  style={{
                    background: aWins ? `${teamColor}12` : 'transparent',
                    border: aWins ? `1px solid ${teamColor}30` : '1px solid transparent',
                  }}
                >
                  <span className="font-black text-sm w-8 shrink-0" style={{ color }}>{label}</span>
                  <span className="text-xs font-bold" style={{ color: teamColor }}>{r.points}p</span>
                  {isFl && <span className="text-xs" style={{ color: '#a855f7' }} title="Vuelta rápida">⚡</span>}
                </div>

                {/* Piloto B */}
                {rLabel ? (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{
                      background: bWins ? `${rivalColor}12` : 'transparent',
                      border: bWins ? `1px solid ${rivalColor}30` : '1px solid transparent',
                    }}
                  >
                    <span className="font-black text-sm w-8 shrink-0" style={{ color: rLabel.color }}>{rLabel.label}</span>
                    <span className="text-xs font-bold" style={{ color: rivalColor }}>{rival!.points}p</span>
                    {rIsFl && <span className="text-xs" style={{ color: '#a855f7' }} title="Vuelta rápida">⚡</span>}
                  </div>
                ) : (
                  <span className="text-xs px-2" style={{ color: 'var(--f1-muted)' }}>—</span>
                )}
              </div>
            )
          }

          // Vista individual
          return (
            <div
              key={r.round}
              className="grid items-center px-3 py-2.5 text-sm"
              style={{
                gridTemplateColumns: '2rem 1fr 2.5rem 3rem 2.5rem',
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.round}</span>
              <span className="truncate pr-2">
                {gpShortName(r.raceName)}
                {isFl && <span className="ml-1.5 text-xs font-bold" style={{ color: '#a855f7' }} title="Vuelta rápida">⚡</span>}
              </span>
              <span className="text-center font-black text-sm" style={{ color }}>{label}</span>
              <span className="text-center font-bold" style={{ color: teamColor }}>{r.points}</span>
              <span className="text-center text-xs" style={{ color: 'var(--f1-muted)' }}>{r.grid}</span>
            </div>
          )
        })}
      </div>

      {/* Marcador final en modo comparación */}
      {comparing && totals && rivalTotals && (() => {
        const races = results.length
        let aWins = 0, bWins = 0
        results.forEach(r => {
          const rv = rivalMap[r.round]
          if (!rv) return
          const aPos = parseInt(r.position)
          const bPos = parseInt(rv.position)
          if (!isNaN(aPos) && !isNaN(bPos)) {
            if (aPos < bPos) aWins++
            else if (bPos < aPos) bWins++
          }
        })
        return (
          <div
            className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between text-sm"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--f1-card-border)' }}
          >
            <span className="font-black" style={{ color: aWins >= bWins ? teamColor : 'var(--f1-muted)' }}>
              {driver.acronym} {aWins}
            </span>
            <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>duelos en {races} carreras</span>
            <span className="font-black" style={{ color: bWins >= aWins ? rivalColor : 'var(--f1-muted)' }}>
              {bWins} {rivalDriver!.acronym}
            </span>
          </div>
        )
      })()}

      <p className="text-xs mt-3 text-right" style={{ color: 'var(--f1-muted)', opacity: 0.5 }}>
        Fuente: Jolpi · Temporada 2026 · {results.length} carreras
      </p>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalTab = 'perfil' | 'temporada'

function DriverModal({ driver, onClose }: { driver: DriverProfile; onClose: () => void }) {
  const mainTeamColor = driver.teams[driver.teams.length - 1]?.color ?? '#fff'
  const [tab, setTab] = useState<ModalTab>('perfil')

  useEffect(() => { setTab('perfil') }, [driver.id])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: '#111', border: `1px solid ${mainTeamColor}40`, boxShadow: `0 0 60px ${mainTeamColor}15` }}
      >
        <div className="h-[3px] rounded-t-2xl" style={{ background: mainTeamColor }} />

        {/* Header */}
        <div className="flex gap-0 relative">
          <div className="shrink-0 relative" style={{ width: 160, height: 200, background: 'rgba(255,255,255,0.04)' }}>
            <img
              src={`/drivers/${driver.id}.webp`}
              alt={`${driver.firstName} ${driver.lastName}`}
              className="w-full h-full object-cover object-top"
              onError={e => {
                const el = e.currentTarget
                el.style.display = 'none'
                const parent = el.parentElement
                if (parent && !parent.querySelector('.initials')) {
                  const div = document.createElement('div')
                  div.className = 'initials'
                  div.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:900;color:${mainTeamColor};opacity:0.3`
                  div.textContent = driver.lastName[0]
                  parent.appendChild(div)
                }
              }}
            />
          </div>

          <div className="flex-1 px-5 py-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="text-sm" style={{ color: 'var(--f1-muted)' }}>{driver.firstName}</div>
                <h2 className="text-2xl font-black uppercase">{driver.lastName}</h2>
              </div>
              <button
                onClick={onClose}
                className="text-xl leading-none px-2 transition-opacity hover:opacity-60"
                style={{ color: 'var(--f1-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <img src={`https://flagcdn.com/w20/${driver.countryCode}.png`} alt={driver.nationality} className="w-5 h-3.5 object-cover rounded-sm" />
              <span className="text-sm">{driver.nationality}</span>
              <StatusBadge status={driver.status} />
              {driver.number && (
                <span className="text-sm font-black ml-1" style={{ color: mainTeamColor }}>#{driver.number}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div style={{ color: 'var(--f1-muted)' }}>Nacimiento</div>
              <div>{formatDate(driver.dob)} ({getAge(driver.dob)} años)</div>
              <div style={{ color: 'var(--f1-muted)' }}>Lugar</div>
              <div>{driver.birthPlace}</div>
              <div style={{ color: 'var(--f1-muted)' }}>Debut</div>
              <div>{driver.debutYear} — {driver.debutGP}</div>
              <div style={{ color: 'var(--f1-muted)' }}>Carreras</div>
              <div>{driver.racesEntered}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {driver.active && (
          <div
            className="flex px-5 gap-1"
            style={{ borderTop: '1px solid var(--f1-card-border)', borderBottom: '1px solid var(--f1-card-border)' }}
          >
            {(['perfil', 'temporada'] as ModalTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-150 relative"
                style={{ color: tab === t ? '#fff' : 'var(--f1-muted)' }}
              >
                {t === 'perfil' ? 'Perfil' : 'Temporada 2026'}
                {tab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t" style={{ background: mainTeamColor }} />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Contenido */}
        {tab === 'perfil' || !driver.active ? (
          <>
            <div className="px-5 py-4" style={{ borderTop: driver.active ? 'none' : '1px solid var(--f1-card-border)' }}>
              <div className="grid grid-cols-5 gap-2">
                <StatBox label="Títulos" value={driver.championships} color={driver.championships > 0 ? '#facc15' : undefined} />
                <StatBox label="Victorias" value={driver.wins} color={mainTeamColor} />
                <StatBox label="Podios" value={driver.podiums} />
                <StatBox label="Poles" value={driver.poles} />
                <StatBox label="V. Rápidas" value={driver.fastestLaps} />
              </div>
            </div>
            <div className="px-5 pb-4" style={{ borderTop: '1px solid var(--f1-card-border)', paddingTop: 16 }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--f1-muted)' }}>{driver.bio}</p>
            </div>
            <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--f1-card-border)', paddingTop: 16 }}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>Escuderías</h3>
              <TeamTimeline teams={driver.teams} />
            </div>
          </>
        ) : (
          <div className="pt-4">
            <SeasonTab driver={driver} teamColor={mainTeamColor} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PilotosPage() {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [selectedNationality, setSelectedNationality] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [onlyChampions, setOnlyChampions] = useState(false)
  const [onlyActive, setOnlyActive] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null)

  const filtered = useMemo(() => {
    return DRIVERS_DB.filter(d => {
      if (selectedLetter && !d.lastName.toUpperCase().startsWith(selectedLetter)) return false
      if (selectedNationality && d.nationality !== selectedNationality) return false
      if (selectedTeam && !d.teams.some(t => t.team === selectedTeam)) return false
      if (onlyChampions && d.championships === 0) return false
      if (onlyActive && !d.active) return false
      return true
    })
  }, [selectedLetter, selectedNationality, selectedTeam, onlyChampions, onlyActive])

  const activeLetters = useMemo(() =>
    new Set(DRIVERS_DB.map(d => d.lastName[0].toUpperCase())), []
  )

  function clearFilters() {
    setSelectedLetter(null)
    setSelectedNationality(null)
    setSelectedTeam(null)
    setOnlyChampions(false)
    setOnlyActive(false)
  }

  const hasFilters = selectedLetter || selectedNationality || selectedTeam || onlyChampions || onlyActive

  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Pilotos</span>
      </h1>
      <p className="mb-8" style={{ color: 'var(--f1-muted)' }}>
        Actuales e históricos — {DRIVERS_DB.length} pilotos
      </p>

      <div className="rounded-2xl px-5 py-4 mb-6" style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)' }}>
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>Apellido</div>
          <div className="flex flex-wrap gap-1">
            {LETTERS.map(l => {
              const available = activeLetters.has(l)
              const active = selectedLetter === l
              return (
                <button
                  key={l}
                  disabled={!available}
                  onClick={() => setSelectedLetter(active ? null : l)}
                  className="w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150"
                  style={{
                    background: active ? 'var(--f1-red)' : available ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: active ? '#fff' : available ? 'inherit' : 'rgba(255,255,255,0.15)',
                    border: active ? '1px solid var(--f1-red)' : '1px solid transparent',
                    cursor: available ? 'pointer' : 'default',
                  }}
                >
                  {l}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <Dropdown
            label="Nacionalidad"
            value={selectedNationality ?? ''}
            options={[{ value: '', label: 'Todas' }, ...ALL_NATIONALITIES.map(n => ({ value: n, label: n }))]}
            onChange={v => setSelectedNationality(v || null)}
          />
          <Dropdown
            label="Escudería"
            value={selectedTeam ?? ''}
            options={[{ value: '', label: 'Todas' }, ...ALL_TEAMS.map(t => ({ value: t, label: t }))]}
            onChange={v => setSelectedTeam(v || null)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOnlyChampions(v => !v)}
              className="px-3 py-2 rounded-lg text-sm font-bold transition-all duration-150"
              style={{
                background: onlyChampions ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${onlyChampions ? 'rgba(250,204,21,0.4)' : 'var(--f1-card-border)'}`,
                color: onlyChampions ? '#facc15' : 'var(--f1-muted)',
              }}
            >
              🏆 Campeones
            </button>
            <button
              onClick={() => setOnlyActive(v => !v)}
              className="px-3 py-2 rounded-lg text-sm font-bold transition-all duration-150"
              style={{
                background: onlyActive ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${onlyActive ? 'rgba(34,197,94,0.4)' : 'var(--f1-card-border)'}`,
                color: onlyActive ? '#22c55e' : 'var(--f1-muted)',
              }}
            >
              ● Activos
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--f1-muted)' }}>
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl px-5 py-12 text-center text-sm" style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)', color: 'var(--f1-muted)' }}>
          No hay pilotos que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <>
          <p className="text-xs mb-4" style={{ color: 'var(--f1-muted)' }}>
            {filtered.length} {filtered.length === 1 ? 'piloto' : 'pilotos'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(d => (
              <DriverCard key={d.id} driver={d} onClick={() => setSelectedDriver(d)} />
            ))}
          </div>
        </>
      )}

      {selectedDriver && (
        <DriverModal driver={selectedDriver} onClose={() => setSelectedDriver(null)} />
      )}
    </main>
  )
}