import DriverStandings from './components/DriverStandings'
import ConstructorStandings from './components/ConstructorStandings'
import NextRace from './components/NextRace'
import NewsFeed from './components/NewsFeed'

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>F1</span> Dashboard
      </h1>
      <p style={{ color: 'var(--f1-muted)' }} className="mb-8">
        Temporada 2026
      </p>
      <NextRace />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <DriverStandings />
        <ConstructorStandings />
      </div>
      <NewsFeed />
    </main>
  )
}