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

const COUNTRY_FLAGS: Record<string, string> = {
  Australia: '🇦🇺', Bahrain: '🇧🇭', China: '🇨🇳', Japan: '🇯🇵',
  'Saudi Arabia': '🇸🇦', USA: '🇺🇸', 'United States': '🇺🇸', Italy: '🇮🇹',
  Monaco: '🇲🇨', Spain: '🇪🇸', Canada: '🇨🇦', Austria: '🇦🇹',
  UK: '🇬🇧', 'United Kingdom': '🇬🇧', Hungary: '🇭🇺', Belgium: '🇧🇪',
  Netherlands: '🇳🇱', Singapore: '🇸🇬', Azerbaijan: '🇦🇿', Mexico: '🇲🇽',
  Brazil: '🇧🇷', UAE: '🇦🇪', Qatar: '🇶🇦', Portugal: '🇵🇹',
  France: '🇫🇷', Germany: '🇩🇪', Russia: '🇷🇺', Turkey: '🇹🇷',
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
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{
              background: year === y ? 'var(--f1-red)' : 'var(--f1-gray)',
              color: year === y ? '#fff' : 'var(--f1-muted)',
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Lista de carreras */}
      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--f1-muted)' }}>
          Cargando carreras...
        </div>
      ) : disputed.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--f1-muted)' }}>
          No hay carreras disputadas aún en {year}.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {disputed.map((race) => {
            const flag = COUNTRY_FLAGS[race.Circuit.Location.country] ?? '🏁'
            const winner = race.Results?.[0]
            return (
              <Link
                key={race.round}
                href={`/resultados/${year}/${race.round}`}
                className="flex items-center gap-4 px-5 py-4 rounded-xl hover:opacity-80 transition-opacity"
                style={{ background: 'var(--f1-gray)' }}
              >
                <span className="w-6 text-xs font-mono text-center shrink-0" style={{ color: 'var(--f1-muted)' }}>
                  R{race.round}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{flag}</span>
                    <span className="font-semibold truncate">{race.raceName}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>
                    {race.Circuit.circuitName} · {formatDate(race.date)}
                  </div>
                </div>
                {winner && (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">
                      {winner.Driver.givenName[0]}. {winner.Driver.familyName}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                      {winner.Constructor.name}
                    </div>
                  </div>
                )}
                <span style={{ color: 'var(--f1-muted)' }}>›</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}