import Link from 'next/link'

type Race = {
  round: string
  raceName: string
  date: string
  time?: string
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

async function getCalendar(): Promise<Race[]> {
  try {
    const [scheduleRes, resultsRes] = await Promise.all([
      fetch('https://api.jolpi.ca/ergast/f1/2026.json', { next: { revalidate: 3600 } }),
      fetch('https://api.jolpi.ca/ergast/f1/2026/results/1.json', { next: { revalidate: 3600 } }),
    ])

    if (!scheduleRes.ok) return []

    const scheduleData = await scheduleRes.json()
    const races: Race[] = scheduleData.MRData.RaceTable.Races ?? []

    if (!resultsRes.ok) return races

    const resultsData = await resultsRes.json()
    const results: Race[] = resultsData.MRData.RaceTable.Races ?? []

    return races.map((race) => {
      const result = results.find((r) => r.round === race.round)
      return result ? { ...race, Results: result.Results } : race
    })
  } catch {
    return []
  }
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split('-')
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`
}

export default async function RaceCalendar() {
  const races = await getCalendar()

  if (races.length === 0) {
    return (
      <div className="f1-card px-5 py-8 text-center text-sm" style={{ color: 'var(--f1-muted)' }}>
        Calendario no disponible momentáneamente
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nextRaceIndex = races.findIndex((r) => {
    const d = new Date(r.date + 'T00:00:00')
    return d >= today
  })

  return (
    <div className="flex flex-col gap-2.5">
      {races.map((race, i) => {
        const raceDate = new Date(race.date + 'T00:00:00')
        const isPast = raceDate < today
        const isNext = i === nextRaceIndex
        const winner = race.Results?.[0]

        return (
          <Link
            key={race.round}
            href={`/calendario/${race.round}`}
            className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 hover:translate-x-1"
            style={{
              background: isNext
                ? 'linear-gradient(135deg, rgba(225,6,0,0.10), rgba(225,6,0,0.02))'
                : 'var(--f1-card-gradient)',
              border: `1px solid ${isNext ? 'rgba(225,6,0,0.35)' : 'var(--f1-card-border)'}`,
              boxShadow: isNext ? '0 0 20px rgba(225,6,0,0.10)' : 'var(--f1-card-shadow)',
              opacity: isPast && !isNext ? 0.55 : 1,
            }}
          >
            <span className="w-7 text-xs font-mono font-bold text-center shrink-0 px-1.5 py-1 rounded-md"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--f1-muted)' }}>
              {race.round}
            </span>

            <CountryFlag country={race.Circuit.Location.country} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold truncate">{race.raceName}</span>
                {isNext && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 tracking-wide"
                    style={{ background: 'var(--f1-red)', color: '#fff' }}>
                    PRÓXIMA
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--f1-muted)' }}>
                {race.Circuit.circuitName} — {race.Circuit.Location.locality}
              </div>
            </div>

            <div className="text-right shrink-0 flex items-center gap-3">
              {isPast && winner ? (
                <div className="text-right">
                  <div className="text-sm font-bold">
                    🏆 {winner.Driver.givenName[0]}. {winner.Driver.familyName}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                    {winner.Constructor.name}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-bold" style={{ color: isNext ? 'var(--f1-red)' : 'inherit' }}>
                  {formatDate(race.date)}
                </div>
              )}
              <span style={{ color: 'var(--f1-muted)' }}>›</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}