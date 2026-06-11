import OnThisDayClient from './OnThisDayClient'

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

async function getOnThisDay(): Promise<Race[]> {
  try {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const currentYear = today.getFullYear()
    const years = Array.from({ length: 30 }, (_, i) => currentYear - 1 - i)

    const raceMatches = (await Promise.all(
      years.map(async (year) => {
        try {
          const res = await fetch(
            `https://api.jolpi.ca/ergast/f1/${year}/results/1.json`,
            { next: { revalidate: 86400 } }
          )
          const data = await res.json()
          return (data.MRData.RaceTable.Races as Race[]).filter(r => {
            const [, m, d] = r.date.split('-')
            return m === month && d === day
          })
        } catch { return [] }
      })
    )).flat().sort((a, b) => parseInt(b.season) - parseInt(a.season))

    if (raceMatches.length === 0) return []

    return await Promise.all(
  raceMatches.map(async (race) => {
    try {
      const [qualRes, detailRes] = await Promise.all([
        fetch(`https://api.jolpi.ca/ergast/f1/${race.season}/${race.round}/qualifying.json`, { next: { revalidate: 86400 } }),
        fetch(`https://api.jolpi.ca/ergast/f1/${race.season}/${race.round}/results.json`, { next: { revalidate: 86400 } }),
      ])
      const qualData = await qualRes.json()
      const detailData = await detailRes.json()
      const detailRace = detailData.MRData.RaceTable.Races[0]
      const qualRace = qualData.MRData.RaceTable.Races[0]
      return {
        season: race.season,
        round: race.round,
        raceName: race.raceName,
        date: race.date,
        Circuit: race.Circuit,
        Results: detailRace?.Results?.slice(0, 3) ?? [],
        QualifyingResults: qualRace?.QualifyingResults?.slice(0, 1) ?? [],
      }
    } catch { return race }
  })
)
  } catch { return [] }
}

export default async function OnThisDay() {
  const races = await getOnThisDay()
  if (races.length === 0) return null

  const today = new Date()
  const dayMonth = today.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })

  return <OnThisDayClient races={races} dayMonth={dayMonth} />
}