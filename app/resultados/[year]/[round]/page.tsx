import Link from 'next/link'

type Result = {
  position: string
  points: string
  Driver: { givenName: string; familyName: string; nationality: string }
  Constructor: { name: string }
  Time?: { time: string }
  status: string
  FastestLap?: { rank: string; Time: { time: string } }
}

type Race = {
  raceName: string
  date: string
  Circuit: { circuitName: string; Location: { locality: string; country: string } }
  Results: Result[]
}

async function getRaceResult(year: string, round: string): Promise<Race | null> {
  const res = await fetch(
    `https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`,
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  return data.MRData.RaceTable.Races[0] ?? null
}

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ year: string; round: string }>
}) {
  const { year, round } = await params
  const race = await getRaceResult(year, round)

  if (!race) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
        <p style={{ color: 'var(--f1-muted)' }}>Resultado no disponible.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <Link
        href="/resultados"
        className="text-sm mb-6 inline-block hover:opacity-70 transition-opacity"
        style={{ color: 'var(--f1-muted)' }}
      >
        ← Volver a resultados
      </Link>

      <h1 className="text-2xl font-bold mb-1">{race.raceName}</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--f1-muted)' }}>
        {race.Circuit.circuitName} · {race.Circuit.Location.locality} · {year}
      </p>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>
        {/* Header */}
        <div
          className="grid grid-cols-12 px-5 py-3 text-xs font-semibold uppercase"
          style={{ color: 'var(--f1-muted)', borderBottom: '1px solid var(--f1-light-gray)' }}
        >
          <span className="col-span-1">Pos</span>
          <span className="col-span-5">Piloto</span>
          <span className="col-span-3">Escudería</span>
          <span className="col-span-2 text-right">Puntos</span>
          <span className="col-span-1 text-right">⚡</span>
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
          {race.Results.map((r) => {
            const isFastest = r.FastestLap?.rank === '1'
            const dnf = r.status !== 'Finished' && !r.status.startsWith('+')
            return (
              <div
                key={r.position}
                className="grid grid-cols-12 items-center px-5 py-3 text-sm"
              >
                <span
                  className="col-span-1 font-bold"
                  style={{ color: r.position === '1' ? 'var(--f1-red)' : 'inherit' }}
                >
                  {r.position}
                </span>
                <div className="col-span-5">
                  <span className="font-semibold">{r.Driver.givenName[0]}. {r.Driver.familyName}</span>
                  <div className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.Driver.nationality}</div>
                </div>
                <span className="col-span-3 text-xs" style={{ color: 'var(--f1-muted)' }}>
                  {r.Constructor.name}
                </span>
                <span className="col-span-2 text-right font-mono font-bold">
                  {r.points !== '0' ? r.points : <span style={{ color: 'var(--f1-muted)' }}>—</span>}
                </span>
                <span className="col-span-1 text-right text-xs">
                  {isFastest ? (
                    <span style={{ color: '#a855f7' }} title={`Vuelta rápida: ${r.FastestLap?.Time.time}`}>⚡</span>
                  ) : dnf ? (
                    <span style={{ color: 'var(--f1-muted)' }} title={r.status}>DNF</span>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}