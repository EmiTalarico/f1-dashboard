import DriverStandings from './components/DriverStandings'

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>F1</span> Dashboard
      </h1>
      <p style={{ color: 'var(--f1-muted)' }} className="mb-8">
        Temporada 2026
      </p>
      <DriverStandings />
    </main>
  )
}