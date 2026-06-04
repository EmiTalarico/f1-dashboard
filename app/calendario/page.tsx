import RaceCalendar from '../components/RaceCalendar'

export default function CalendarioPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Calendario</span>
      </h1>
      <p className="mb-8" style={{ color: 'var(--f1-muted)' }}>
        Temporada 2026 — {20} carreras
      </p>
      <RaceCalendar />
    </main>
  )
}