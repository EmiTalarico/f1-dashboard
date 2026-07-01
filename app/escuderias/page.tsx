import Link from 'next/link'
import { TEAMS } from '../data/teams'

async function getConstructorStandings() {
  try {
    const res = await fetch(
      'https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json',
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
    return Object.fromEntries(
      standings.map((s: any) => [s.Constructor.constructorId, { position: s.position, points: s.points }])
    ) as Record<string, { position: string; points: string }>
  } catch {
    return {}
  }
}

export default async function EscuderiasPage() {
  const standings = await getConstructorStandings()

  const teamsWithStandings = TEAMS.map(team => ({
    ...team,
    standing: standings[team.constructorId] ?? null,
  })).sort((a, b) => {
    if (!a.standing) return 1
    if (!b.standing) return -1
    return parseInt(a.standing.position) - parseInt(b.standing.position)
  })

  return (
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Escuderías</span>
      </h1>
      <p className="mb-8" style={{ color: 'var(--f1-muted)' }}>
        Temporada 2026 — {TEAMS.length} equipos
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teamsWithStandings.map(team => (
          <Link
            key={team.constructorId}
            href={`/escuderias/${team.constructorId}`}
            className="block rounded-2xl overflow-hidden transition-all duration-200 hover:translate-y-[-2px]"
            style={{
              background: 'var(--f1-card-gradient)',
              border: '1px solid var(--f1-card-border)',
              boxShadow: 'var(--f1-card-shadow)',
            }}
          >
            {/* Color bar */}
            <div className="h-[3px]" style={{ background: team.color }} />

            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span>{team.flag}</span>
                    <h2 className="font-bold text-lg">{team.name}</h2>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--f1-muted)' }}>{team.fullName}</p>
                </div>
                {team.standing && (
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black" style={{ color: team.color }}>
                      P{team.standing.position}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                      {team.standing.points} pts
                    </div>
                  </div>
                )}
              </div>

              {/* Pilotos */}
              <div className="flex gap-2">
                {team.drivers.map(d => (
                  <div
                    key={d.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--f1-card-border)' }}
                  >
                    <span>{d.flag}</span>
                    <span className="font-medium">{d.name.split(' ').slice(-1)[0]}</span>
                    <span style={{ color: 'var(--f1-muted)' }}>#{d.number}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                  🔧 {team.powerUnit}
                </span>
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                  📍 {team.base}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}