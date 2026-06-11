'use client'

import { useState } from 'react'

type RaceResult = {
  position: string
  Driver: { givenName: string; familyName: string }
  Constructor: { name: string }
  Time?: { time: string }
  FastestLap?: { rank: string; Time: { time: string } }
}

type QualResult = {
  position: string
  Driver: { givenName: string; familyName: string }
  Constructor: { name: string }
  Q3?: string; Q2?: string; Q1?: string
}

type Race = {
  season: string
  round: string
  raceName: string
  date: string
  Circuit: { circuitName: string; Location: { locality: string; country: string } }
  Results?: RaceResult[]
  QualifyingResults?: QualResult[]
}

const TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671C6', 'Red Bull Racing': '#3671C6',
  'Ferrari': '#E8002D', 'Scuderia Ferrari': '#E8002D',
  'Mercedes': '#00D2BE', 'McLaren': '#FF8000',
  'Aston Martin': '#229971', 'Alpine': '#0093CC',
  'Williams': '#00A3E0', 'Haas': '#B6BABD',
  'Racing Bulls': '#6692FF', 'Sauber': '#C00000',
  'Renault': '#FFD700', 'Lotus': '#B5A239',
  'Brawn': '#B5A239', 'Force India': '#FF80C7',
  'default': '#e10600',
}

const COUNTRY_CODES: Record<string, string> = {
  Australia: 'au', Bahrain: 'bh', China: 'cn', Japan: 'jp',
  'Saudi Arabia': 'sa', USA: 'us', 'United States': 'us', Italy: 'it',
  Monaco: 'mc', Spain: 'es', Canada: 'ca', Austria: 'at',
  UK: 'gb', 'United Kingdom': 'gb', Hungary: 'hu', Belgium: 'be',
  Netherlands: 'nl', Singapore: 'sg', Azerbaijan: 'az', Mexico: 'mx',
  Brazil: 'br', UAE: 'ae', Qatar: 'qa', Germany: 'de',
  France: 'fr', Portugal: 'pt', Turkey: 'tr', Russia: 'ru',
}

function CountryFlag({ country }: { country: string }) {
  const code = COUNTRY_CODES[country]
  if (!code) return <span className="text-4xl">🏁</span>
  return (
    <img
      src={`https://flagcdn.com/w80/${code}.png`}
      alt={country}
      className="w-16 h-10 object-cover rounded"
    />
  )
}

function getTeamColor(teamName: string) {
  return TEAM_COLORS[teamName] ?? TEAM_COLORS['default']
}

function yearsAgo(season: string) {
  const diff = new Date().getFullYear() - parseInt(season)
  return diff === 1 ? 'hace 1 año' : `hace ${diff} años`
}

function RaceCard({ race }: { race: Race }) {
  const winner = race.Results?.[0]
  const p2 = race.Results?.[1]
  const p3 = race.Results?.[2]
  const pole = race.QualifyingResults?.[0]
  const fastestLap = race.Results?.find(r => r.FastestLap?.rank === '1')
  const flag = COUNTRY_CODES[race.Circuit.Location.country]
  const winnerColor = winner ? getTeamColor(winner.Constructor.name) : 'var(--f1-red)'
  const poleTime = pole?.Q3 ?? pole?.Q2 ?? pole?.Q1

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--f1-gray)', borderTop: `3px solid ${winnerColor}` }}>
      <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <CountryFlag country={race.Circuit.Location.country} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: winnerColor }}>
              {race.Circuit.Location.locality}, {race.Circuit.Location.country}
            </p>
            <h3 className="text-xl font-black leading-tight">{race.raceName}</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--f1-muted)' }}>{race.Circuit.circuitName}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-black" style={{ color: winnerColor }}>{race.season}</div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>{yearsAgo(race.season)}</p>
        </div>
      </div>

      <div className="mx-6 mb-4 h-px" style={{ background: 'var(--f1-light-gray)' }} />

      <div className="px-6 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {winner && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--f1-light-gray)' }}>
            <div className="text-2xl">🏆</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--f1-muted)' }}>Ganador</p>
              <p className="font-black text-sm truncate">{winner.Driver.givenName} {winner.Driver.familyName}</p>
              <p className="text-xs truncate" style={{ color: winnerColor }}>{winner.Constructor.name}</p>
              {winner.Time && <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--f1-muted)' }}>{winner.Time.time}</p>}
            </div>
          </div>
        )}
        {pole && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--f1-light-gray)' }}>
            <div className="text-2xl">⚡</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--f1-muted)' }}>Pole Position</p>
              <p className="font-black text-sm truncate">{pole.Driver.givenName} {pole.Driver.familyName}</p>
              <p className="text-xs truncate" style={{ color: getTeamColor(pole.Constructor.name) }}>{pole.Constructor.name}</p>
              {poleTime && <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--f1-muted)' }}>{poleTime}</p>}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--f1-light-gray)' }}>
          <div className="text-2xl">🥈</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--f1-muted)' }}>Podio</p>
            {p2 && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold truncate">2. {p2.Driver.givenName[0]}. {p2.Driver.familyName}</p>
                <p className="text-xs ml-2 shrink-0" style={{ color: getTeamColor(p2.Constructor.name) }}>{p2.Constructor.name}</p>
              </div>
            )}
            {p3 && (
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs font-bold truncate">3. {p3.Driver.givenName[0]}. {p3.Driver.familyName}</p>
                <p className="text-xs ml-2 shrink-0" style={{ color: getTeamColor(p3.Constructor.name) }}>{p3.Constructor.name}</p>
              </div>
            )}
            {fastestLap && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: '#ffffff15' }}>
                <p className="text-xs" style={{ color: '#a855f7' }}>
                  🟣 {fastestLap.Driver.familyName} · {fastestLap.FastestLap?.Time.time}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const STEP = 2

export default function OnThisDayClient({ races, dayMonth }: { races: Race[]; dayMonth: string }) {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(STEP)

  const shown = races.slice(0, visible)
  const hasMore = visible < races.length

  return (
    <div className="mb-6">
      {/* Header desplegable */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 py-3 hover:opacity-80 transition-opacity"
      >
        <div className="h-px flex-1" style={{ background: 'var(--f1-light-gray)' }} />
        <p className="text-xs font-bold uppercase tracking-widest px-3 flex items-center gap-2" style={{ color: 'var(--f1-red)' }}>
          📅 Un día como hoy · {dayMonth}
          <span style={{ color: 'var(--f1-muted)' }}>({races.length} {races.length === 1 ? 'carrera' : 'carreras'})</span>
          <span className="text-xs transition-transform duration-300" style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--f1-muted)' }}>▼</span>
        </p>
        <div className="h-px flex-1" style={{ background: 'var(--f1-light-gray)' }} />
      </button>

      {/* Contenido desplegable */}
      {open && (
        <div className="flex flex-col gap-4 mt-2">
          {shown.map(race => <RaceCard key={`${race.season}-${race.round}`} race={race} />)}

          {hasMore && (
            <button
              onClick={() => setVisible(v => v + STEP)}
              className="w-full py-3 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{ background: 'var(--f1-gray)', color: 'var(--f1-muted)', border: '1px dashed var(--f1-light-gray)' }}
            >
              Ver {Math.min(STEP, races.length - visible)} carrera{Math.min(STEP, races.length - visible) > 1 ? 's' : ''} más ↓
            </button>
          )}

          {!hasMore && races.length > STEP && (
            <button
              onClick={() => setVisible(STEP)}
              className="w-full py-3 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{ background: 'var(--f1-gray)', color: 'var(--f1-muted)', border: '1px dashed var(--f1-light-gray)' }}
            >
              Ver menos ↑
            </button>
          )}
        </div>
      )}
    </div>
  )
}