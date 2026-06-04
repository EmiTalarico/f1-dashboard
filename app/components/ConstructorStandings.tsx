type Constructor = {
  position: string
  Constructor: { name: string; nationality: string }
  points: string
  wins: string
}

async function getConstructorStandings() {
  const res = await fetch(
    'https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json',
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  return data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings as Constructor[]
}

export default async function ConstructorStandings() {
  const standings = await getConstructorStandings()

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
        <h2 className="text-lg font-semibold">Campeonato de Constructores</h2>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
        {standings.map((c) => (
          <div key={c.position} className="flex items-center px-6 py-3 gap-4">
            <span className="w-6 text-right font-mono text-sm" style={{ color: 'var(--f1-muted)' }}>
              {c.position}
            </span>
            <div className="flex-1">
              <span className="font-bold">{c.Constructor.name}</span>
              <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>
                {c.Constructor.nationality}
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold">{c.points}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--f1-muted)' }}>pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}