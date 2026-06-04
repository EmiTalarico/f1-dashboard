import NewsFeed from '../components/NewsFeed'

export default function NoticiasPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span style={{ color: 'var(--f1-red)' }}>Noticias</span>
      </h1>
      <p className="mb-8" style={{ color: 'var(--f1-muted)' }}>
        Las últimas noticias de F1 de todo el mundo
      </p>
      <NewsFeed />
    </main>
  )
}