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

function SeasonTab({ driver, teamColor }: { driver: DriverProfile; teamColor: string }) {
  const [results, setResults] = useState<RaceResult[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`https://api.jolpi.ca/ergast/f1/2026/drivers/${driver.id}/results/?format=json`)
      .then(r => r.json())
      .then(data => {
        const races = data?.MRData?.RaceTable?.Races ?? []
        const parsed: RaceResult[] = races.map((r: any) => {
          const res = r.Results[0]
          return {
            round: r.round,
            raceName: r.raceName,
            date: r.date,
            position: res.position,
            positionText: res.positionText,
            points: res.points,
            grid: res.grid,
            status: res.status,
            fastestLapRank: res.FastestLap?.rank ?? null,
            fastestLapTime: res.FastestLap?.Time?.time ?? null,
          }
        })
        setResults(parsed)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [driver.id])

  // Totales
  const totals = useMemo(() => {
    if (!results) return null
    const pts = results.reduce((acc, r) => acc + parseFloat(r.points || '0'), 0)
    const wins = results.filter(r => r.position === '1').length
    const podiums = results.filter(r => ['1','2','3'].includes(r.position)).length
    const fl = results.filter(r => r.fastestLapRank === '1').length
    return { pts, wins, podiums, fl }
  }, [results])

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
      {/* Resumen de temporada */}
      {totals && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatBox label="Puntos" value={totals.pts} color={teamColor} />
          <StatBox label="Victorias" value={totals.wins} color={totals.wins > 0 ? '#facc15' : undefined} />
          <StatBox label="Podios" value={totals.podiums} />
          <StatBox label="V. Rápidas" value={totals.fl} color={totals.fl > 0 ? '#a855f7' : undefined} />
        </div>
      )}

      {/* Tabla de resultados */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--f1-card-border)' }}>
        {/* Header */}
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

        {/* Filas */}
        {results.map((r, i) => {
          const { label, color } = positionLabel(r.position, r.positionText)
          const isFl = r.fastestLapRank === '1'
          const isLast = i === results.length - 1

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
                {isFl && (
                  <span className="ml-1.5 text-xs font-bold" style={{ color: '#a855f7' }} title="Vuelta rápida">⚡</span>
                )}
              </span>
              <span className="text-center font-black text-sm" style={{ color }}>{label}</span>
              <span className="text-center font-bold" style={{ color: teamColor }}>{r.points}</span>
              <span className="text-center text-xs" style={{ color: 'var(--f1-muted)' }}>{r.grid}</span>
            </div>
          )
        })}
      </div>

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

  // Reset tab al cambiar de piloto
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
        {/* Barra color */}
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

        {/* Tabs — solo si es activo */}
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
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t"
                    style={{ background: mainTeamColor }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Contenido por tab */}
        {tab === 'perfil' || !driver.active ? (
          <>
            {/* Stats carrera */}
            <div className="px-5 py-4" style={{ borderTop: driver.active ? 'none' : '1px solid var(--f1-card-border)' }}>
              <div className="grid grid-cols-5 gap-2">
                <StatBox label="Títulos" value={driver.championships} color={driver.championships > 0 ? '#facc15' : undefined} />
                <StatBox label="Victorias" value={driver.wins} color={mainTeamColor} />
                <StatBox label="Podios" value={driver.podiums} />
                <StatBox label="Poles" value={driver.poles} />
                <StatBox label="V. Rápidas" value={driver.fastestLaps} />
              </div>
            </div>

            {/* Bio */}
            <div className="px-5 pb-4" style={{ borderTop: '1px solid var(--f1-card-border)', paddingTop: 16 }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--f1-muted)' }}>{driver.bio}</p>
            </div>

            {/* Timeline escuderías */}
            <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--f1-card-border)', paddingTop: 16 }}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
                Escuderías
              </h3>
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
    new Set(DRIVERS_DB.map(d => d.lastName[0].toUpperCase())),
    []
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

      {/* Filtros */}
      <div
        className="rounded-2xl px-5 py-4 mb-6"
        style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)' }}
      >
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f1-muted)' }}>
            Apellido
          </div>
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
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-70"
                style={{ color: 'var(--f1-muted)' }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resultados */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-12 text-center text-sm"
          style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)', color: 'var(--f1-muted)' }}
        >
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

      {/* Modal */}
      {selectedDriver && (
        <DriverModal driver={selectedDriver} onClose={() => setSelectedDriver(null)} />
      )}
    </main>
  )
}