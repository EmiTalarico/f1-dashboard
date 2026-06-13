const NATIONALITY_CODES: Record<string, string> = {
  British: 'gb', Dutch: 'nl', Monegasque: 'mc', Spanish: 'es',
  Australian: 'au', Mexican: 'mx', Finnish: 'fi', German: 'de',
  French: 'fr', Canadian: 'ca', Thai: 'th', Japanese: 'jp',
  Italian: 'it', Brazilian: 'br', Argentine: 'ar', American: 'us',
  Danish: 'dk', Chinese: 'cn', Austrian: 'at', 'New Zealander': 'nz',
  Belgian: 'be', Polish: 'pl', Russian: 'ru', Swedish: 'se',
}

type Driver = {
  position: string
  Driver: { givenName: string; familyName: string; nationality: string }
  Constructors: { name: string }[]
  points: string
  wins: string
}

async function getDriverStandings(): Promise<Driver[]> {
  try {
    const res = await fetch(
      'https://api.jolpi.ca/ergast/f1/2026/driverStandings.json',
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
  } catch {
    return []
  }
}

export default async function DriverStandings() {
  const standings = await getDriverStandings()
  const leaderPoints = standings.length > 0 ? parseFloat(standings[0].points) : 0

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
        <h2 className="text-lg font-semibold">Campeonato de Pilotos</h2>
      </div>
      {standings.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--f1-muted)' }}>
          Datos no disponibles momentáneamente
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
          {standings.map((d) => {
            const code = NATIONALITY_CODES[d.Driver.nationality]
            const pts = parseFloat(d.points)
            const diff = leaderPoints - pts
            const isLeader = d.position === '1'

            return (
              <div key={d.position} className="flex items-center px-6 py-3 gap-3">
                <span className="w-6 text-right font-mono text-sm shrink-0" style={{ color: isLeader ? 'var(--f1-red)' : 'var(--f1-muted)' }}>
                  {d.position}
                </span>
                {code ? (
                  <img
                    src={`https://flagcdn.com/w40/${code}.png`}
                    alt={d.Driver.nationality}
                    className="w-6 h-4 object-cover rounded-sm shrink-0"
                  />
                ) : (
                  <span className="w-6 shrink-0">🏁</span>
                )}
                <div className="flex-1 min-w-0">
                  <div>
                    <span className="font-semibold">{d.Driver.givenName} </span>
                    <span className="font-bold uppercase">{d.Driver.familyName}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>
                    {d.Constructors[0].name}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div>
                    <span className="font-bold">{d.points}</span>
                    <span className="text-xs ml-1" style={{ color: 'var(--f1-muted)' }}>pts</span>
                  </div>
                  <div className="text-xs font-mono" style={{ color: isLeader ? '#00a550' : 'var(--f1-muted)' }}>
                    {isLeader ? 'Líder' : `-${diff}`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}