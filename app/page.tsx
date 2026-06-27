import DriverStandings from './components/DriverStandings'
import ConstructorStandings from './components/ConstructorStandings'
import NextRace from './components/NextRace'
import OnThisDay from './components/OnThisDay'

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">

      {/* Header con jerarquía: logo + línea de identidad + temporada */}
      <div className="flex items-center justify-between mb-8 pb-5" style={{ borderBottom: '1px solid var(--f1-card-border)' }}>
        <img
          src="/logo-horizontal.png"
          alt="F1Pasión"
          className="h-12 w-auto"
        />
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--f1-red)' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--f1-red)' }} />
          </span>
          <span className="f1-label" style={{ color: 'var(--f1-muted)' }}>
            Temporada 2026
          </span>
        </div>
      </div>

      <div className="animate-f1-fade-in">
        <NextRace />
      </div>

      <div className="animate-f1-fade-in" style={{ animationDelay: '0.1s' }}>
        <OnThisDay />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-f1-fade-in" style={{ animationDelay: '0.2s' }}>
        <DriverStandings />
        <ConstructorStandings />
      </div>
    </main>
  )
}