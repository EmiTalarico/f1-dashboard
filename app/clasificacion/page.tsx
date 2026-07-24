import ClassificationClient from './ClassificationClient'
import type { DriverStanding, ConstructorStanding, RaceResult } from './types'

const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#3671C6', 'Ferrari': '#E8002D', 'Mercedes': '#27F4D2',
  'McLaren': '#FF8000', 'Aston Martin': '#229971', 'Alpine F1 Team': '#0093CC',
  'Alpine': '#0093CC', 'Williams': '#64C4FF', 'Haas F1 Team': '#B6BABD',
  'Haas': '#B6BABD', 'RB F1 Team': '#6692FF', 'Racing Bulls': '#6692FF',
  'Kick Sauber': '#52E252', 'Audi': '#C00000', 'Cadillac': '#CC0000',
  'Red Bull': '#3671C6',
}

async function getDriverStandings(): Promise<DriverStanding[]> {
  try {
    const res = await fetch('https://api.jolpi.ca/ergast/f1/2026/driverStandings.json', { next: { revalidate: 300 } })
    const data = await res.json()
    return data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
  } catch { return [] }
}

async function getConstructorStandings(): Promise<ConstructorStanding[]> {
  try {
    const res = await fetch('https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json', { next: { revalidate: 300 } })
    const data = await res.json()
    return data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
  } catch { return [] }
}

async function getRaceResults(): Promise<RaceResult[]> {
  try {
    const calRes = await fetch('https://api.jolpi.ca/ergast/f1/2026.json', { next: { revalidate: 3600 } })
    const calData = await calRes.json()
    const calendar: RaceResult[] = calData.MRData?.RaceTable?.Races ?? []

    const now = new Date()
    const pastRounds = calendar
      .filter(race => new Date(race.date + 'T23:59:59Z') < now)
      .map(race => race.round)

    console.log('Past rounds to fetch:', pastRounds)

    const results: RaceResult[] = []
    for (const round of pastRounds) {
      try {
        const res = await fetch(
          `https://api.jolpi.ca/ergast/f1/2026/${round}/results.json?limit=40`,
          { next: { revalidate: 300 } }
        )
        const data = await res.json()
        const race = data.MRData?.RaceTable?.Races?.[0]
        console.log(`Round ${round}:`, race ? `${race.Results?.length} results` : 'FAILED')
        if (race) results.push(race)
      } catch (e) {
        console.log(`Round ${round}: ERROR`, e)
      }
    }

    return results.sort((a, b) => parseInt(a.round) - parseInt(b.round))
  } catch (e) {
    console.log('getRaceResults ERROR:', e)
    return []
  }
}

export default async function ClasificacionPage() {
  const [drivers, constructors, races] = await Promise.all([
    getDriverStandings(),
    getConstructorStandings(),
    getRaceResults(),
  ])

  return (
    <ClassificationClient
      drivers={drivers}
      constructors={constructors}
      races={races}
      teamColors={TEAM_COLORS}
    />
  )
}