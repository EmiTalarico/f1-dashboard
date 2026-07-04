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
  'Red Bull Racing': '#3671C6', 'Haas': '#B6BABD',
}

const PODIUM_CLASS: Record<string, string> = {
  '1': 'f1-badge-gold',
  '2': 'f1-badge-silver',
  '3': 'f1-badge-bronze',
}

// Standings Austria 2026 — Round 8
const FALLBACK_DRIVERS = [
  { position: '1',  givenName: 'Kimi',     familyName: 'Antonelli',  nationality: 'Italian',       team: 'Mercedes',     points: '179', wins: '5' },
  { position: '2',  givenName: 'George',   familyName: 'Russell',    nationality: 'British',       team: 'Mercedes',     points: '136', wins: '2' },
  { position: '3',  givenName: 'Lewis',    familyName: 'Hamilton',   nationality: 'British',       team: 'Ferrari',      points: '132', wins: '1' },
  { position: '5',  givenName: 'Lando',    familyName: 'Norris',     nationality: 'British',       team: 'McLaren',      points: '85',  wins: '0' },
  { position: '6',  givenName: 'Charles',  familyName: 'Leclerc',    nationality: 'Monegasque',    team: 'Ferrari',      points: '83',  wins: '0' },
  { position: '4',  givenName: 'Oscar',    familyName: 'Piastri',    nationality: 'Australian',    team: 'McLaren',      points: '82',  wins: '0' },
  { position: '7',  givenName: 'Max',      familyName: 'Verstappen', nationality: 'Dutch',         team: 'Red Bull Racing', points: '76', wins: '0' },
  { position: '8',  givenName: 'Isack',    familyName: 'Hadjar',     nationality: 'French',        team: 'Red Bull Racing', points: '42', wins: '0' },
  { position: '9',  givenName: 'Pierre',   familyName: 'Gasly',      nationality: 'French',        team: 'Alpine',       points: '41',  wins: '0' },
  { position: '10', givenName: 'Liam',     familyName: 'Lawson',     nationality: 'New Zealander', team: 'Racing Bulls', points: '31',  wins: '0' },
  { position: '11', givenName: 'Oliver',   familyName: 'Bearman',    nationality: 'British',       team: 'Haas',         points: '18',  wins: '0' },
  { position: '12', givenName: 'Franco',   familyName: 'Colapinto',  nationality: 'Argentine',     team: 'Alpine',       points: '16',  wins: '0' },
  { position: '13', givenName: 'Arvid',    familyName: 'Lindblad',   nationality: 'Swedish',       team: 'Racing Bulls', points: '14',  wins: '0' },
  { position: '14', givenName: 'Carlos',   familyName: 'Sainz',      nationality: 'Spanish',       team: 'Williams',     points: '6',   wins: '0' },
  { position: '15', givenName: 'Alexander',familyName: 'Albon',      nationality: 'Thai',          team: 'Williams',     points: '5',   wins: '0' },
  { position: '16', givenName: 'Esteban',  familyName: 'Ocon',       nationality: 'French',        team: 'Haas',         points: '3',   wins: '0' },
  { position: '17', givenName: 'Gabriel',  familyName: 'Bortoleto',  nationality: 'Brazilian',     team: 'Audi',         points: '2',   wins: '0' },
  { position: '18', givenName: 'Fernando', familyName: 'Alonso',     nationality: 'Spanish',       team: 'Aston Martin', points: '1',   wins: '0' },
  { position: '19', givenName: 'Nico',     familyName: 'Hulkenberg',  nationality: 'German',        team: 'Audi',         points: '0',   wins: '0' },
  { position: '20', givenName: 'Valtteri', familyName: 'Bottas',     nationality: 'Finnish',       team: 'Cadillac',     points: '0',   wins: '0' },
  { position: '21', givenName: 'Sergio',   familyName: 'Perez',      nationality: 'Mexican',       team: 'Cadillac',     points: '0',   wins: '0' },
  { position: '22', givenName: 'Lance',    familyName: 'Stroll',     nationality: 'Canadian',      team: 'Aston Martin', points: '0',   wins: '0' },
]

type Driver = {
  position: string
  Driver: { givenName: string; familyName: string; nationality: string }
  Constructors: { name: string }[]
  points: string
  wins: string
}

async function getDriverStandings(): Promise<{ data: Driver[]; isFallback: boolean }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      'https://api.jolpi.ca/ergast/f1/2026/driverStandings.json',
      { next: { revalidate: 300 }, signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) throw new Error('not ok')
    const data = await res.json()
    const standings = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
    if (standings.length === 0) throw new Error('empty')
    return { data: standings, isFallback: false }
  } catch {
    return {
      isFallback: true,
      data: FALLBACK_DRIVERS.map(d => ({
        position: d.position,
        Driver: { givenName: d.givenName, familyName: d.familyName, nationality: d.nationality },
        Constructors: [{ name: d.team }],
        points: d.points,
        wins: d.wins,
      })),
    }
  }
}

export default async function DriverStandings() {
  const { data: standings, isFallback } = await getDriverStandings()
  const leaderPoints = standings.length > 0 ? parseFloat(standings[0].points) : 0

  return (
    <div className="f1-card overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: 'var(--f1-red)' }} />
          <h2 className="text-lg font-bold">Campeonato de Pilotos</h2>
        </div>
        {isFallback && (
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)' }}>
            Austria · R8
          </span>
        )}
      </div>

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
              {podiumClass ? (
                <span className={`${podiumClass} w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0`}>
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
    </div>
  )
}