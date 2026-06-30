import Link from 'next/link'
import { CIRCUIT_DATA } from '../../data/circuits'
import CircuitImage from '../../components/CircuitImage'

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

const COUNTRY_CODES: Record<string, string> = {
  Australia: 'au', Bahrain: 'bh', China: 'cn', Japan: 'jp',
  'Saudi Arabia': 'sa', USA: 'us', 'United States': 'us', Italy: 'it',
  Monaco: 'mc', Spain: 'es', Canada: 'ca', Austria: 'at',
  UK: 'gb', 'United Kingdom': 'gb', Hungary: 'hu', Belgium: 'be',
  Netherlands: 'nl', Singapore: 'sg', Azerbaijan: 'az', Mexico: 'mx',
  Brazil: 'br', UAE: 'ae', Qatar: 'qa',
}

const TYPE_LABELS = {
  street: '🏙️ Urbano',
  permanent: '🏁 Permanente',
  'semi-permanent': '🔧 Semi-permanente',
}

function CountryFlag({ country }: { country: string }) {
  const code = COUNTRY_CODES[country]
  if (!code) return <span className="text-4xl shrink-0">🏁</span>
  return (
    <img
      src={`https://flagcdn.com/w80/${code}.png`}
      alt={country}
      className="w-14 h-10 object-cover rounded-md shrink-0"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.12)' }}
    />
  )
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

  const historyRes = await fetch(
    `https://api.jolpi.ca/ergast/f1/circuits/${circuitId}/results/1.json?limit=250&offset=0`,
    { next: { revalidate: 86400 } }
  )
  const historyData = await historyRes.json()
  const past: Race[] = historyData.MRData.RaceTable.Races.slice(0, 250).reverse()

  const result = pastData.MRData.RaceTable.Races[0]
  if (result) {
    return { current: { ...current, Results: result.Results }, past }
  }

  return { current, past }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--f1-card-border)' }}>
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] mt-0.5 font-semibold tracking-wide" style={{ color: 'var(--f1-muted)' }}>{label}</div>
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
  const today = new Date()
  const raceDate = new Date(current.date + 'T00:00:00')
  const isPast = raceDate < today

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <Link href="/calendario" className="text-sm mb-6 inline-block hover:opacity-70 transition-opacity" style={{ color: 'var(--f1-muted)' }}>
        ← Volver al calendario
      </Link>

      {/* Header */}
      <div className="f1-card px-6 py-5 mb-6 relative overflow-hidden">
        <div
          className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(225,6,0,0.12), transparent 70%)' }}
        />
        <div className="flex items-center gap-3 mb-1 relative">
          <CountryFlag country={current.Circuit.Location.country} />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{current.raceName}</h1>
            <p className="text-sm" style={{ color: 'var(--f1-muted)' }}>
              {current.Circuit.circuitName} · {current.Circuit.Location.locality}, {current.Circuit.Location.country}
            </p>
          </div>
        </div>
        {data && (
          <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full relative" style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-muted)' }}>
            {TYPE_LABELS[data.type]}
          </span>
        )}
      </div>

      {/* Trazado del circuito */}
      <div className="f1-card overflow-hidden mb-6 flex items-center justify-center p-6">
        <CircuitImage
          src={`/circuits/${circuitId}.avif`}
          alt={`Trazado ${current.Circuit.circuitName}`}
        />
      </div>

      {/* Stats grid */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="VUELTAS" value={String(data.laps)} />
          <StatCard label="LONGITUD" value={`${data.length} km`} />
          <StatCard label="CURVAS" value={String(data.corners)} />
          <StatCard label="ZONAS DRS" value={String(data.drsZones)} />
        </div>
      )}

      {/* Lap record */}
      {data && (
        <div className="f1-card px-6 py-5 mb-6 flex items-center justify-between">
          <div>
            <p className="f1-label mb-1" style={{ color: 'var(--f1-muted)' }}>Récord de vuelta</p>
            <p className="text-2xl font-black font-mono" style={{ color: 'var(--f1-red)' }}>{data.lapRecord}</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--f1-muted)' }}>
              {data.lapRecordDriver} {data.lapRecordYear > 0 ? `(${data.lapRecordYear})` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="f1-label mb-1" style={{ color: 'var(--f1-muted)' }}>Primer GP</p>
            <p className="text-2xl font-black">{data.firstGP}</p>
          </div>
        </div>
      )}

      {/* Description */}
      {data?.description && (
        <div className="f1-card px-6 py-5 mb-6">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--f1-muted)' }}>{data.description}</p>
        </div>
      )}

      {/* Famous corners */}
      {data?.famousCorners && data.famousCorners.length > 0 && (
        <div className="f1-card px-6 py-5 mb-6">
          <h3 className="f1-label mb-3" style={{ color: 'var(--f1-muted)' }}>
            Curvas icónicas
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.famousCorners.map(corner => (
              <span key={corner} className="text-sm font-medium px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.2)', color: 'var(--f1-text)' }}>
                {corner}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Race result if already happened */}
      {isPast && current.Results && current.Results.length > 0 && (
        <div className="f1-card overflow-hidden mb-6">
          <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
            <div className="w-1 h-5 rounded-full" style={{ background: 'var(--f1-red)' }} />
            <h3 className="text-sm font-bold">Resultado 2026</h3>
          </div>
          <div>
            {current.Results.slice(0, 3).map(r => (
              <div key={r.position} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-white/5"
                style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
                <span className="w-6 font-black text-sm" style={{ color: r.position === '1' ? 'var(--f1-red)' : 'var(--f1-muted)' }}>
                  {r.position}
                </span>
                <span className="flex-1 font-bold text-sm">
                  {r.Driver.givenName[0]}. {r.Driver.familyName}
                </span>
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>{r.Constructor.name}</span>
                {r.Time && <span className="text-xs font-mono" style={{ color: 'var(--f1-muted)' }}>{r.Time.time}</span>}
              </div>
            ))}
          </div>
          <div className="px-6 py-3">
            <Link href={`/resultados/2026/${round}`} className="text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--f1-red)' }}>
              Ver resultado completo →
            </Link>
          </div>
        </div>
      )}

      {/* Historical winners */}
      {past.length > 0 && (
        <div className="f1-card overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
            <div className="w-1 h-5 rounded-full" style={{ background: 'var(--f1-red)' }} />
            <h3 className="text-sm font-bold">Últimos ganadores</h3>
          </div>
          <div>
            {past.map(r => (
              <div key={r.round + r.date} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-white/5"
                style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
                <span className="w-10 text-sm font-bold" style={{ color: 'var(--f1-muted)' }}>
                  {new Date(r.date).getFullYear()}
                </span>
                <span className="flex-1 font-bold text-sm">
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