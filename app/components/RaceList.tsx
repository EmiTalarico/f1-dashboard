'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Race = {
  round: string
  raceName: string
  date: string
  Circuit: {
    circuitName: string
    Location: { locality: string; country: string }
  }
  Results?: { Driver: { givenName: string; familyName: string }; Constructor: { name: string } }[]
}

const COUNTRY_CODES: Record<string, string> = {
  Australia: 'au', Bahrain: 'bh', China: 'cn', Japan: 'jp',
  'Saudi Arabia': 'sa', USA: 'us', 'United States': 'us', Italy: 'it',
  Monaco: 'mc', Spain: 'es', Canada: 'ca', Austria: 'at',
  UK: 'gb', 'United Kingdom': 'gb', Hungary: 'hu', Belgium: 'be',
  Netherlands: 'nl', Singapore: 'sg', Azerbaijan: 'az', Mexico: 'mx',
  Brazil: 'br', UAE: 'ae', Qatar: 'qa', Portugal: 'pt',
  France: 'fr', Germany: 'de', Russia: 'ru', Turkey: 'tr',
}

function CountryFlag({ country }: { country: string }) {
  const code = COUNTRY_CODES[country]
  if (!code) return <span className="text-lg shrink-0">🏁</span>
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={country}
      className="w-7 h-5 object-cover rounded-sm shrink-0"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
    />
  )
}

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020]

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split('-')
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`
}

export default function RaceList() {
  const [year, setYear] = useState(2026)
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)
  const [pressing, setPressing] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`).then(r => r.json()),
      fetch(`https://api.jolpi.ca/ergast/f1/${year}/results/1.json`).then(r => r.json()),
    ]).then(([scheduleData, resultsData]) => {
      const schedule: Race[] = scheduleData.MRData.RaceTable.Races
      const results: Race[] = resultsData.MRData.RaceTable.Races
      const merged = schedule.map((race) => {
        const result = results.find((r) => r.round === race.round)
        return result ? { ...race, Results: result.Results } : race
      })
      setRaces(merged)
      setLoading(false)
    })
  }, [year])

  const today = new Date()
  const disputed = races.filter(r => new Date(r.date + 'T00:00:00') < today)

  return (
    <div>
      {/* Filtro de año */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {YEARS.map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            onMouseEnter={e => {
              if (year !== y) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(225,6,0,0.5)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 14px rgba(225,6,0,0.18)'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)'
              }
            }}
            onMouseLeave={e => {
              if (year !== y) {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--f1-card-border)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--f1-muted)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              }
            }}
            onMouseDown={() => setPressing(y)}
            onMouseUp={() => setPressing(null)}
            className="px-4 py-1.5 rounded-full text-sm font-bold tracking-wide"
            style={{
              background: year === y ? 'var(--f1-red)' : 'var(--f1-card-gradient)',
              border: `1px solid ${year === y ? 'var(--f1-red)' : 'var(--f1-card-border)'}`,
              color: year === y ? '#fff' : 'var(--f1-muted)',
              boxShadow: year === y ? '0 0 16px rgba(225,6,0,0.35)' : 'none',
              transform: pressing === y ? 'scale(0.93)' : year === y ? 'scale(1)' : undefined,
              transition: 'transform 120ms ease, box-shadow 200ms ease, border-color 200ms ease, color 200ms ease',
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Lista de carreras */}
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-2xl animate-pulse"
              style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)' }}
            />
          ))}
        </div>
      ) : disputed.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-10 text-center text-sm"
          style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)', color: 'var(--f1-muted)' }}
        >
          No hay carreras disputadas aún en {year}.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {disputed.map((race) => {
            const winner = race.Results?.[0]
            return (
              <Link
                key={race.round}
                href={`/resultados/${year}/${race.round}`}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 hover:translate-x-1"
                style={{
                  background: 'var(--f1-card-gradient)',
                  border: '1px solid var(--f1-card-border)',
                  boxShadow: 'var(--f1-card-shadow)',
                }}
              >
                <span
                  className="w-7 text-xs font-mono font-bold text-center shrink-0 px-1.5 py-1 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--f1-muted)' }}
                >
                  {race.round}
                </span>

                <CountryFlag country={race.Circuit.Location.country} />

                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{race.raceName}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--f1-muted)' }}>
                    {race.Circuit.circuitName} — {race.Circuit.Location.locality}
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  {winner ? (
                    <div className="text-right">
                      <div className="text-sm font-bold">
                        🏆 {winner.Driver.givenName[0]}. {winner.Driver.familyName}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                        {winner.Constructor.name}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-bold" style={{ color: 'var(--f1-muted)' }}>
                      {formatDate(race.date)}
                    </div>
                  )}
                  <span style={{ color: 'var(--f1-muted)' }}>›</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}