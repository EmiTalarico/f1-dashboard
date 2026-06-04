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

const COUNTRY_FLAGS: Record<string, string> = {
  Australia: '🇦🇺', Bahrain: '🇧🇭', China: '🇨🇳', Japan: '🇯🇵',
  'Saudi Arabia': '🇸🇦', USA: '🇺🇸', 'United States': '🇺🇸', Italy: '🇮🇹',
  Monaco: '🇲🇨', Spain: '🇪🇸', Canada: '🇨🇦', Austria: '🇦🇹',
  UK: '🇬🇧', 'United Kingdom': '🇬🇧', Hungary: '🇭🇺', Belgium: '🇧🇪',
  Netherlands: '🇳🇱', Singapore: '🇸🇬', Azerbaijan: '🇦🇿', Mexico: '🇲🇽',
  Brazil: '🇧🇷', UAE: '🇦🇪', Qatar: '🇶🇦', Portugal: '🇵🇹',
}

async function getCalendar(): Promise<Race[]> {
  const [scheduleRes, resultsRes] = await Promise.all([
    fetch('https://api.jolpi.ca/ergast/f1/2026.json', { next: { revalidate: 3600 } }),
    fetch('https://api.jolpi.ca/ergast/f1/2026/results/1.json', { next: { revalidate: 3600 } }),
  ])

  const scheduleData = await scheduleRes.json()
  const resultsData = await resultsRes.json()

  const races: Race[] = scheduleData.MRData.RaceTable.Races
  const results: Race[] = resultsData.MRData.RaceTable.Races

  return races.map((race) => {
    const result = results.find((r) => r.round === race.round)
    return result ? { ...race, Results: result.Results } : race
  })
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split('-')
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`
}

export default async function RaceCalendar() {
  const races = await getCalendar()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const nextRaceIndex = races.findIndex((r) => {
    const d = new Date(r.date + 'T00:00:00')
    return d >= today
  })

  return (
    <div className="flex flex-col gap-2">
      {races.map((race, i) => {
        const raceDate = new Date(race.date + 'T00:00:00')
        const isPast = raceDate < today
        const isNext = i === nextRaceIndex
        const flag = COUNTRY_FLAGS[race.Circuit.Location.country] ?? '🏁'
        const winner = race.Results?.[0]

        return (
          <Link
            key={race.round}
            href={`/calendario/${race.round}`}
            className="flex items-center gap-4 px-5 py-4 rounded-xl transition-opacity hover:opacity-80"
            style={{
              background: isNext ? 'var(--f1-light-gray)' : 'var(--f1-gray)',
              opacity: isPast && !isNext ? 0.6 : 1,
              borderLeft: isNext ? '3px solid var(--f1-red)' : '3px solid transparent',
            }}
          >
            <span className="w-6 text-xs font-mono text-center shrink-0" style={{ color: 'var(--f1-muted)' }}>
              R{race.round}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">{flag}</span>
                <span className="font-semibold truncate">{race.raceName}</span>
                {isNext && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: 'var(--f1-red)', color: '#fff' }}>
                    PRÓXIMA
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--f1-muted)' }}>
                {race.Circuit.circuitName} — {race.Circuit.Location.locality}
              </div>
            </div>
            <div className="text-right shrink-0 flex items-center gap-2">
              {isPast && winner ? (
                <div className="text-right">
                  <div className="text-sm font-bold">
                    {winner.Driver.givenName[0]}. {winner.Driver.familyName}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                    {winner.Constructor.name}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-medium">{formatDate(race.date)}</div>
              )}
              <span style={{ color: 'var(--f1-muted)' }}>›</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}