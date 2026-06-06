import DriverStandings from './components/DriverStandings'
import ConstructorStandings from './components/ConstructorStandings'
import NextRace from './components/NextRace'

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <img
            src="/logo-horizontal.png"
            alt="F1Pasión"
            className="h-12 w-auto"
          />
      <p style={{ color: 'var(--f1-muted)' }} className="mb-8">
        Temporada 2026
      </p>
      <NextRace />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DriverStandings />
        <ConstructorStandings />
      </div>
    </main>
  )
}

/*<div className="px-3 mb-8">
          <img
            src="/logo-horizontal.png"
            alt="F1Pasión"
            className="h-12 w-auto"
          />
      </div> */