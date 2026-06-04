import Link from 'next/link'
import { CIRCUIT_DATA } from '../../data/circuits'

type Race = {
  raceName: string
  round: string
  date: string
  Circuit: {
    circuitId: string
    circuitName: string
    url: string
    Location: { locality: string; country: string; lat: string; long: string }
  }
  Results?: {
    position: string
    Driver: { givenName: string; familyName: string }
    Constructor: { name: string }
    Time?: { time: string }
  }[]
}

const COUNTRY_FLAGS: Record<string, string> = {
  Australia: '🇦🇺', Bahrain: '🇧🇭', China: '🇨🇳', Japan: '🇯🇵',
  'Saudi Arabia': '🇸🇦', USA: '🇺🇸', 'United States': '🇺🇸', Italy: '🇮🇹',
  Monaco: '🇲🇨', Spain: '🇪🇸', Canada: '🇨🇦', Austria: '🇦🇹',
  UK: '🇬🇧', 'United Kingdom': '🇬🇧', Hungary: '🇭🇺', Belgium: '🇧🇪',
  Netherlands: '🇳🇱', Singapore: '🇸🇬', Azerbaijan: '🇦🇿', Mexico: '🇲🇽',
  Brazil: '🇧🇷', UAE: '🇦🇪', Qatar: '🇶🇦',
}

const TYPE_LABELS = {
  street: '🏙️ Urbano',
  permanent: '🏁 Permanente',
  'semi-permanent': '🔧 Semi-permanente',
}

async function getRaceData(round: string): Promise<{ current: Race | null; past: Race[] }> {
  const [currentRes, pastRes] = await Promise.all([
    fetch(`https://api.jolpi.ca/ergast/f1/2026/${round}.json`, { next: { revalidate: 3600 } }),
    fetch(`https://api.jolpi.ca/ergast/f1/2026/${round}/results.json`, { next: { revalidate: 3600 } }),
  ])

  const currentData = await currentRes.json()
  const pastData = await pastRes.json()

  const current: Race | null = currentData.MRData.RaceTable.Races[0] ?? null
  if (!current) return { current: null, past: [] }

  const circuitId = current.Circuit.circuitId

  // Get last 5 winners at this circuit across all seasons
  const historyRes = await fetch(
    `https://api.jolpi.ca/ergast/f1/circuits/${circuitId}/results/1.json?limit=250&offset=0`,
    { next: { revalidate: 86400 } }
  )
  const historyData = await historyRes.json()
  const past: Race[] = historyData.MRData.RaceTable.Races.slice(0, 250).reverse()

  // Merge current race result if available
  const result = pastData.MRData.RaceTable.Races[0]
  if (result) {
    return { current: { ...current, Results: result.Results }, past }
  }

  return { current, past }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-4 py-3 text-center" style={{ background: 'var(--f1-light-gray)' }}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>{label}</div>
    </div>
  )
}

export default async function CircuitDetailPage({
  params,
}: {
  params: Promise<{ round: string }>
}) {
  const { round } = await params
  const { current, past } = await getRaceData(round)

  if (!current) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
        <Link href="/calendario" className="text-sm mb-6 inline-block hover:opacity-70" style={{ color: 'var(--f1-muted)' }}>
          ← Volver al calendario
        </Link>
        <p style={{ color: 'var(--f1-muted)' }}>Carrera no encontrada.</p>
      </main>
    )
  }

  const circuitId = current.Circuit.circuitId
  const data = CIRCUIT_DATA[circuitId]
  const flag = COUNTRY_FLAGS[current.Circuit.Location.country] ?? '🏁'
  const today = new Date()
  const raceDate = new Date(current.date + 'T00:00:00')
  const isPast = raceDate < today

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <Link href="/calendario" className="text-sm mb-6 inline-block hover:opacity-70 transition-opacity" style={{ color: 'var(--f1-muted)' }}>
        ← Volver al calendario
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-4xl">{flag}</span>
          <div>
            <h1 className="text-2xl font-bold">{current.raceName}</h1>
            <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>
              {current.Circuit.circuitName} · {current.Circuit.Location.locality}, {current.Circuit.Location.country}
            </p>
          </div>
        </div>
        {data && (
          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-muted)' }}>
            {TYPE_LABELS[data.type]}
          </span>
        )}
      </div>

      {/* Stats grid */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Vueltas" value={String(data.laps)} />
          <StatCard label="Longitud" value={`${data.length} km`} />
          <StatCard label="Curvas" value={String(data.corners)} />
          <StatCard label="Zonas DRS" value={String(data.drsZones)} />
        </div>
      )}

      {/* Lap record */}
      {data && (
        <div className="rounded-xl px-5 py-4 mb-6 flex items-center justify-between" style={{ background: 'var(--f1-gray)' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--f1-muted)' }}>Récord de vuelta</p>
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--f1-red)' }}>{data.lapRecord}</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--f1-muted)' }}>
              {data.lapRecordDriver} {data.lapRecordYear > 0 ? `(${data.lapRecordYear})` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--f1-muted)' }}>Primer GP</p>
            <p className="text-2xl font-bold">{data.firstGP}</p>
          </div>
        </div>
      )}

      {/* Description */}
      {data?.description && (
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: 'var(--f1-gray)' }}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--f1-muted)' }}>{data.description}</p>
        </div>
      )}

      {/* Famous corners */}
      {data?.famousCorners && data.famousCorners.length > 0 && (
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: 'var(--f1-gray)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--f1-muted)' }}>
            Curvas icónicas
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.famousCorners.map(corner => (
              <span key={corner} className="text-sm px-3 py-1 rounded-full" style={{ background: 'var(--f1-light-gray)' }}>
                {corner}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Race result if already happened */}
      {isPast && current.Results && current.Results.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--f1-gray)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--f1-muted)' }}>
              Resultado 2026
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
            {current.Results.slice(0, 3).map(r => (
              <div key={r.position} className="flex items-center gap-4 px-5 py-3">
                <span className="w-5 font-bold text-sm" style={{ color: r.position === '1' ? 'var(--f1-red)' : 'var(--f1-muted)' }}>
                  {r.position}
                </span>
                <span className="flex-1 font-semibold text-sm">
                  {r.Driver.givenName[0]}. {r.Driver.familyName}
                </span>
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.Constructor.name}</span>
                {r.Time && <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>{r.Time.time}</span>}
              </div>
            ))}
          </div>
          <div className="px-5 py-2">
            <Link href={`/resultados/2026/${round}`} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--f1-red)' }}>
              Ver resultado completo →
            </Link>
          </div>
        </div>
      )}

      {/* Historical winners */}
      {past.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--f1-muted)' }}>
              Últimos ganadores
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
            {past.map(r => (
              <div key={r.round + r.date} className="flex items-center gap-4 px-5 py-3">
                <span className="w-10 text-sm font-bold" style={{ color: 'var(--f1-muted)' }}>
                  {new Date(r.date).getFullYear()}
                </span>
                <span className="flex-1 font-semibold text-sm">
                  {r.Results?.[0]?.Driver.givenName[0]}. {r.Results?.[0]?.Driver.familyName}
                </span>
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                  {r.Results?.[0]?.Constructor.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}