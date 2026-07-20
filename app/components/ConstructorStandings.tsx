const TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671C6', 'Ferrari': '#E8002D', 'Mercedes': '#27F4D2',
  'McLaren': '#FF8000', 'Aston Martin': '#229971', 'Alpine': '#0093CC',
  'Williams': '#64C4FF', 'Haas F1 Team': '#B6BABD', 'Racing Bulls': '#6692FF',
  'Kick Sauber': '#52E252', 'Audi': '#C00000', 'Cadillac': '#CC0000',
  'Red Bull Racing': '#3671C6', 'Haas': '#B6BABD',
}

const NATIONALITY_CODES: Record<string, string> = {
  British: 'gb', Dutch: 'nl', Monegasque: 'mc', Spanish: 'es',
  Australian: 'au', Mexican: 'mx', Finnish: 'fi', German: 'de',
  French: 'fr', Canadian: 'ca', Thai: 'th', Japanese: 'jp',
  Italian: 'it', Brazilian: 'br', Argentine: 'ar', American: 'us',
  Danish: 'dk', Chinese: 'cn', Austrian: 'at', 'New Zealander': 'nz',
  Belgian: 'be', Polish: 'pl', Russian: 'ru', Swedish: 'se',
}

const PODIUM_CLASS: Record<string, string> = {
  '1': 'f1-badge-gold',
  '2': 'f1-badge-silver',
  '3': 'f1-badge-bronze',
}

// Standings Austria 2026 — Round 8
const FALLBACK_CONSTRUCTORS = [
  { position: '1',  name: 'Mercedes',     nationality: 'German',  points: '358', wins: '8' },
  { position: '2',  name: 'Ferrari',      nationality: 'Italian', points: '285', wins: '2' },
  { position: '3',  name: 'McLaren',      nationality: 'British', points: '195', wins: '0' },
  { position: '4',  name: 'Red Bull Racing', nationality: 'Austrian', points: '151', wins: '0' },
  { position: '5',  name: 'Alpine',       nationality: 'French',  points: '61',  wins: '0' },
  { position: '6',  name: 'Racing Bulls', nationality: 'Italian', points: '61',  wins: '0' },
  { position: '7',  name: 'Haas',         nationality: 'American', points: '21', wins: '0' },
  { position: '8',  name: 'Williams',     nationality: 'British', points: '11',  wins: '0' },
  { position: '9',  name: 'Audi',         nationality: 'German',  points: '10',   wins: '0' },
  { position: '10', name: 'Aston Martin', nationality: 'British', points: '1',   wins: '0' },
  { position: '11', name: 'Cadillac',     nationality: 'American', points: '0',  wins: '0' },
]

type Constructor = {
  position: string
  Constructor: { name: string; nationality: string }
  points: string
  wins: string
}

async function getConstructorStandings(): Promise<{ data: Constructor[]; isFallback: boolean }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      'https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json',
      { next: { revalidate: 300 }, signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) throw new Error('not ok')
    const data = await res.json()
    const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
    if (standings.length === 0) throw new Error('empty')
    return { data: standings, isFallback: false }
  } catch {
    return {
      isFallback: true,
      data: FALLBACK_CONSTRUCTORS.map(c => ({
        position: c.position,
        Constructor: { name: c.name, nationality: c.nationality },
        points: c.points,
        wins: c.wins,
      })),
    }
  }
}

export default async function ConstructorStandings() {
  const { data: standings, isFallback } = await getConstructorStandings()
  const leaderPoints = standings.length > 0 ? parseFloat(standings[0].points) : 0

  return (
    <div className="f1-card overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: 'var(--f1-red)' }} />
          <h2 className="text-lg font-bold">Campeonato de Constructores</h2>
        </div>
        {isFallback && (
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--f1-muted)' }}>
            Austria · R8
          </span>
        )}
      </div>

      <div>
        {standings.map((c) => {
          const teamColor = TEAM_COLORS[c.Constructor.name] ?? 'var(--f1-light-gray)'
          const code = NATIONALITY_CODES[c.Constructor.nationality]
          const pts = parseFloat(c.points)
          const diff = leaderPoints - pts
          const isLeader = c.position === '1'
          const podiumClass = PODIUM_CLASS[c.position]

          return (
            <div
              key={c.position}
              className="flex items-center px-6 py-3 gap-3 transition-colors duration-150 hover:bg-white/5"
              style={{
                borderLeft: `3px solid ${teamColor}`,
                borderBottom: '1px solid var(--f1-card-border)',
              }}
            >
              {podiumClass ? (
                <span className={`${podiumClass} w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0`}>
                  {c.position}
                </span>
              ) : (
                <span className="w-7 text-center font-mono text-sm shrink-0" style={{ color: 'var(--f1-muted)' }}>
                  {c.position}
                </span>
              )}

              {code ? (
                <img
                  src={`https://flagcdn.com/w40/${code}.png`}
                  alt={c.Constructor.nationality}
                  className="w-6 h-4 object-cover rounded-sm shrink-0"
                  style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}
                />
              ) : (
                <span className="w-6 shrink-0">🏁</span>
              )}

              <div className="flex-1 min-w-0">
                <span className="font-bold" style={{ color: teamColor }}>{c.Constructor.name}</span>
                <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>
                  {c.Constructor.nationality}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div>
                  <span className="font-bold text-base">{c.points}</span>
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