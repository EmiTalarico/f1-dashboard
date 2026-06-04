import RaceList from '../components/RaceList'

export default function ResultadosPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Resultados</span>
      </h1>
      <p className="mb-8" style={{ color: 'var(--f1-muted)' }}>
        Resultados por temporada
      </p>
      <RaceList />
    </main>
  )
}