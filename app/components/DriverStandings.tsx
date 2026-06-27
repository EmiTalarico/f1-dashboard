const NATIONALITY_CODES: Record<string, string> = {
  British: 'gb', Dutch: 'nl', Monegasque: 'mc', Spanish: 'es',
  Australian: 'au', Mexican: 'mx', Finnish: 'fi', German: 'de',
  French: 'fr', Canadian: 'ca', Thai: 'th', Japanese: 'jp',
  Italian: 'it', Brazilian: 'br', Argentine: 'ar', American: 'us',
  Danish: 'dk', Chinese: 'cn', Austrian: 'at', 'New Zealander': 'nz',
  Belgian: 'be', Polish: 'pl', Russian: 'ru', Swedish: 'se',
}

const TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671C6', 'Ferrari': '#E8002D', 'Mercedes': '#27F4D2',
  'McLaren': '#FF8000', 'Aston Martin': '#229971', 'Alpine': '#0093CC',
  'Williams': '#64C4FF', 'Haas F1 Team': '#B6BABD', 'Racing Bulls': '#6692FF',
  'Kick Sauber': '#52E252', 'Audi': '#C00000', 'Cadillac': '#CC0000',
}

const PODIUM_CLASS: Record<string, string> = {
  '1': 'f1-badge-gold',
  '2': 'f1-badge-silver',
  '3': 'f1-badge-bronze',
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
    <div className="f1-card overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
        <div className="w-1 h-5 rounded-full" style={{ background: 'var(--f1-red)' }} />
        <h2 className="text-lg font-bold">Campeonato de Pilotos</h2>
      </div>
      {standings.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--f1-muted)' }}>
          Datos no disponibles momentáneamente
        </div>
      ) : (
        <div>
          {standings.map((d) => {
            const code = NATIONALITY_CODES[d.Driver.nationality]
            const teamColor = TEAM_COLORS[d.Constructors[0].name] ?? 'var(--f1-light-gray)'
            const pts = parseFloat(d.points)
            const diff = leaderPoints - pts
            const isLeader = d.position === '1'
            const podiumClass = PODIUM_CLASS[d.position]

            return (
              <div
                key={d.position}
                className="flex items-center px-6 py-3 gap-3 transition-colors duration-150 hover:bg-white/[0.03]"
                style={{
                  borderLeft: `3px solid ${teamColor}`,
                  borderBottom: '1px solid var(--f1-card-border)',
                }}
              >
                {/* Posición — badge de podio para top 3 */}
                {podiumClass ? (
                  <span
                    className={`${podiumClass} w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0`}
                  >
                    {d.position}
                  </span>
                ) : (
                  <span className="w-7 text-center font-mono text-sm shrink-0" style={{ color: 'var(--f1-muted)' }}>
                    {d.position}
                  </span>
                )}

                {code ? (
                  <img
                    src={`https://flagcdn.com/w40/${code}.png`}
                    alt={d.Driver.nationality}
                    className="w-6 h-4 object-cover rounded-sm shrink-0"
                    style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
                  />
                ) : (
                  <span className="w-6 shrink-0">🏁</span>
                )}

                <div className="flex-1 min-w-0">
                  <div>
                    <span className="font-medium" style={{ color: 'var(--f1-muted)' }}>{d.Driver.givenName} </span>
                    <span className="font-bold uppercase">{d.Driver.familyName}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: teamColor }}>
                    {d.Constructors[0].name}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div>
                    <span className="font-bold text-base">{d.points}</span>
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