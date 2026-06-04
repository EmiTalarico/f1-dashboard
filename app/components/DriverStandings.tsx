type Driver = {
  position: string
  Driver: { givenName: string; familyName: string; nationality: string }
  Constructors: { name: string }[]
  points: string
  wins: string
}

async function getDriverStandings() {
  const res = await fetch(
     'https://api.jolpi.ca/ergast/f1/2025/driverStandings.json',
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  return data.MRData.StandingsTable.StandingsLists[0].DriverStandings as Driver[]
}

export default async function DriverStandings() {
  const standings = await getDriverStandings()

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
        <h2 className="text-lg font-semibold">Campeonato de Pilotos</h2>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
        {standings.map((d) => (
          <div key={d.position} className="flex items-center px-6 py-3 gap-4">
            <span className="w-6 text-right font-mono text-sm" style={{ color: 'var(--f1-muted)' }}>
              {d.position}
            </span>
            <div className="flex-1">
              <span className="font-semibold">{d.Driver.givenName} </span>
              <span className="font-bold uppercase">{d.Driver.familyName}</span>
              <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>
                {d.Constructors[0].name}
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold">{d.points}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--f1-muted)' }}>pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}