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

const COUNTRY_CODES: Record<string, string> = {
  Australia: 'au', Bahrain: 'bh', China: 'cn', Japan: 'jp',
  'Saudi Arabia': 'sa', USA: 'us', 'United States': 'us', Italy: 'it',
  Monaco: 'mc', Spain: 'es', Canada: 'ca', Austria: 'at',
  UK: 'gb', 'United Kingdom': 'gb', Hungary: 'hu', Belgium: 'be',
  Netherlands: 'nl', Singapore: 'sg', Azerbaijan: 'az', Mexico: 'mx',
  Brazil: 'br', UAE: 'ae', Qatar: 'qa', Portugal: 'pt',
}

function CountryFlag({ country }: { country: string }) {
  const code = COUNTRY_CODES[country]
  if (!code) return <span className="text-2xl">🏁</span>
  return (
    <img
      src={`https://flagcdn.com/w80/${code}.png`}
      alt={country}
      className="h-6 w-auto rounded-sm"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.15)' }}
    />
  )
}

async function getRaceResult(year: string, round: string): Promise<Race | null> {
  const res = await fetch(
    `https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`,
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  return data.MRData.RaceTable.Races[0] ?? null
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
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
        <div
          className="rounded-2xl px-5 py-10 text-center text-sm"
          style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)', color: 'var(--f1-muted)' }}
        >
          Resultado no disponible para esta carrera.
        </div>
      </main>
    )
  }

  const podium = race.Results.slice(0, 3)

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/resultados"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--f1-muted)' }}
      >
        ← Volver a resultados
      </Link>

      {/* Race header card */}
      <div
        className="rounded-2xl px-6 py-5 mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(225,6,0,0.10), rgba(225,6,0,0.02))',
          border: '1px solid rgba(225,6,0,0.25)',
          boxShadow: '0 0 30px rgba(225,6,0,0.08)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CountryFlag country={race.Circuit.Location.country} />
              <span className="f1-label" style={{ color: 'var(--f1-red)' }}>
                RONDA {round} · {year}
              </span>
            </div>
            <h1 className="text-2xl font-bold mb-1">{race.raceName}</h1>
            <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>
              {race.Circuit.circuitName} · {race.Circuit.Location.locality} · {formatDate(race.date)}
            </p>
          </div>
        </div>
      </div>

      {/* Podio destacado */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {podium.map((r) => {
          const colors: Record<string, string> = { '1': 'var(--f1-red)', '2': '#94a3b8', '3': '#b45309' }
          const medals: Record<string, string> = { '1': '🥇', '2': '🥈', '3': '🥉' }
          return (
            <div
              key={r.position}
              className="rounded-2xl px-4 py-4 text-center"
              style={{
                background: 'var(--f1-card-gradient)',
                border: `1px solid ${r.position === '1' ? 'rgba(225,6,0,0.30)' : 'var(--f1-card-border)'}`,
                boxShadow: r.position === '1' ? '0 0 20px rgba(225,6,0,0.10)' : 'var(--f1-card-shadow)',
              }}
            >
              <div className="text-2xl mb-1">{medals[r.position]}</div>
              <div className="font-bold text-sm leading-tight">
                {r.Driver.givenName[0]}. {r.Driver.familyName}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--f1-muted)' }}>
                {r.Constructor.name}
              </div>
              <div
                className="text-xs font-bold mt-2 px-2 py-0.5 rounded-full inline-block"
                style={{ background: 'rgba(255,255,255,0.06)', color: colors[r.position] }}
              >
                {r.points} pts
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabla completa */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--f1-card-gradient)', border: '1px solid var(--f1-card-border)' }}
      >
        {/* Header */}
        <div
          className="grid grid-cols-12 px-5 py-3 text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--f1-muted)', borderBottom: '1px solid var(--f1-card-border)' }}
        >
          <span className="col-span-1">Pos</span>
          <span className="col-span-5">Piloto</span>
          <span className="col-span-3">Escudería</span>
          <span className="col-span-2 text-right">Pts</span>
          <span className="col-span-1 text-right">⚡</span>
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--f1-card-border)' }}>
          {race.Results.map((r) => {
            const isFastest = r.FastestLap?.rank === '1'
            const dnf = r.status !== 'Finished' && !r.status.startsWith('+')
            const isTop3 = parseInt(r.position) <= 3
            return (
              <div
                key={r.position}
                className="grid grid-cols-12 items-center px-5 py-3 text-sm transition-colors"
                style={{
                  background: isTop3 ? 'rgba(255,255,255,0.015)' : 'transparent',
                }}
              >
                <span
                  className="col-span-1 font-bold"
                  style={{ color: r.position === '1' ? 'var(--f1-red)' : isTop3 ? 'inherit' : 'var(--f1-muted)' }}
                >
                  {r.position}
                </span>
                <div className="col-span-5">
                  <span className="font-semibold">
                    {r.Driver.givenName[0]}. {r.Driver.familyName}
                  </span>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>
                    {r.Driver.nationality}
                  </div>
                </div>
                <span className="col-span-3 text-xs" style={{ color: 'var(--f1-muted)' }}>
                  {r.Constructor.name}
                </span>
                <span className="col-span-2 text-right font-mono font-bold text-sm">
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