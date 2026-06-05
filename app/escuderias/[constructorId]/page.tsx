import Link from 'next/link'
import { TEAMS } from '../../data/teams'
import { notFound } from 'next/navigation'

async function getConstructorData(constructorId: string) {
  const [standingsRes, racesRes] = await Promise.all([
    fetch(`https://api.jolpi.ca/ergast/f1/2026/constructorStandings.json`, { next: { revalidate: 3600 } }),
    fetch(`https://api.jolpi.ca/ergast/f1/2026/constructors/${constructorId}/results.json?limit=10`, { next: { revalidate: 3600 } }),
  ])

  const standingsData = await standingsRes.json()
  const racesData = await racesRes.json()

  const allStandings = standingsData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []
  const standing = allStandings.find((s: any) => s.Constructor.constructorId === constructorId) ?? null
  const races = racesData.MRData.RaceTable.Races ?? []

  return { standing, races }
}

async function getChampionships(constructorId: string) {
  try {
    const res = await fetch(
      `https://api.jolpi.ca/ergast/f1/constructors/${constructorId}/constructorStandings/1.json?limit=100`,
      { next: { revalidate: 86400 } }
    )
    const data = await res.json()
    return (data.MRData.StandingsTable.StandingsLists ?? []).map((s: any) => s.season).reverse()
  } catch {
    return []
  }
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg px-4 py-3 text-center" style={{ background: 'var(--f1-light-gray)' }}>
      <div className="text-xl font-bold" style={{ color: color ?? 'inherit' }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>{label}</div>
    </div>
  )
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ constructorId: string }>
}) {
  const { constructorId } = await params
  const team = TEAMS.find(t => t.constructorId === constructorId)
  if (!team) notFound()

  const { standing, races } = await getConstructorData(constructorId)
  const championshipYears = await getChampionships(constructorId)

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <Link href="/escuderias" className="text-sm mb-6 inline-block hover:opacity-70 transition-opacity" style={{ color: 'var(--f1-muted)' }}>
        ← Volver a escuderías
      </Link>

      {/* Header */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--f1-gray)' }}>
        <div className="h-2" style={{ background: team.color }} />
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">{team.flag}</span>
                <h1 className="text-2xl font-black">{team.name}</h1>
              </div>
              <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>{team.fullName}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--f1-muted)' }}>📍 {team.base}</p>
            </div>
            {standing && (
              <div className="text-right shrink-0">
                <div className="text-4xl font-black" style={{ color: team.color }}>P{standing.position}</div>
                <div className="text-sm" style={{ color: 'var(--f1-muted)' }}>{standing.points} pts</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Primer año" value={String(team.firstSeason)} />
        <StatCard label="Campeonatos" value={String(team.championships)} color={team.color} />
        <StatCard label="Motor" value={team.powerUnit} />
      </div>

      {/* Descripción */}
      <div className="rounded-xl px-5 py-4 mb-6" style={{ background: 'var(--f1-gray)' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--f1-muted)' }}>{team.description}</p>
      </div>

      {/* Dirección */}
      <div className="rounded-xl px-5 py-4 mb-6" style={{ background: 'var(--f1-gray)' }}>
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
          Dirección
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--f1-muted)' }}>Team Principal</p>
            <p className="font-semibold text-sm">{team.teamPrincipal}</p>
          </div>
          {team.ceo && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--f1-muted)' }}>CEO</p>
              <p className="font-semibold text-sm">{team.ceo}</p>
            </div>
          )}
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--f1-muted)' }}>Director Técnico</p>
            <p className="font-semibold text-sm">{team.technicalDirector}</p>
          </div>
        </div>
      </div>

      {/* Pilotos */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--f1-gray)' }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--f1-muted)' }}>
            Pilotos 2026
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
          {team.drivers.map(d => (
            <div key={d.name} className="flex items-center gap-4 px-5 py-4">
              <div
                className="text-xl font-black w-12 text-center shrink-0"
                style={{ color: team.color }}
              >
                #{d.number}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{d.flag}</span>
                  <span className="font-bold">{d.name}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>{d.nationality}</p>
              </div>
              <div className="text-right text-xs" style={{ color: 'var(--f1-muted)' }}>
                {d.championships ? (
                  <div>🏆 {d.championships} {d.championships === 1 ? 'título' : 'títulos'}</div>
                ) : null}
                {d.podiums ? <div>🥇 {d.podiums} podios</div> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pilotos reserva */}
      {team.reserveDrivers.length > 0 && (
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: 'var(--f1-gray)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
            Pilotos de reserva
          </h3>
          <div className="flex flex-wrap gap-2">
            {team.reserveDrivers.map(name => (
              <span key={name} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--f1-light-gray)' }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Años campeón */}
      {championshipYears.length > 0 && (
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: 'var(--f1-gray)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
            Años campeón de constructores
          </h3>
          <div className="flex flex-wrap gap-2">
            {championshipYears.map((year: string) => (
              <span
                key={year}
                className="text-sm font-bold px-3 py-1.5 rounded-lg"
                style={{ background: team.color, color: '#fff' }}
              >
                {year}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Últimas carreras */}
      {races.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--f1-muted)' }}>
              Resultados 2026
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
            {races.map((race: any) => {
              const teamResults = race.Results?.filter((r: any) =>
                r.Constructor.constructorId === constructorId
              ) ?? []
              return (
                <div key={race.round} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{race.raceName}</span>
                    <Link
                      href={`/resultados/2026/${race.round}`}
                      className="text-xs hover:opacity-70"
                      style={{ color: team.color }}
                    >
                      Ver completo →
                    </Link>
                  </div>
                  <div className="flex gap-4">
                    {teamResults.map((r: any) => (
                      <div key={r.Driver.driverId} className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                        <span className="font-bold" style={{ color: r.position === '1' ? team.color : 'inherit' }}>
                          P{r.position}
                        </span>
                        {' '}{r.Driver.familyName} · {r.points} pts
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}