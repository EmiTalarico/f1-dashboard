'use client'

import { useState } from 'react'

type NewsItem = {
  title: string
  link: string
  pubDate: string
  source: string
  description: string
}

const SOURCE_COLORS: Record<string, string> = {
  Motorsport: '#e10600',
  Autosport: '#0057b8',
  PlanetF1: '#00a550',
  Marca: '#ff6600',
  'AS Motor': '#cc0000',
  Racer: '#f59e0b',
  'F1 Oficial': '#1e90ff',
  'F1 Latam': '#e67e22',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `hace ${Math.floor(h / 24)}d`
  if (h >= 1) return `hace ${h}h`
  return `hace ${m}m`
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: SOURCE_COLORS[source] ?? '#444', color: '#fff' }}
    >
      {source}
    </span>
  )
}

export default function NewsClient({ news }: { news: NewsItem[] }) {
  const [query, setQuery] = useState('')
  const [activeSource, setActiveSource] = useState<string | null>(null)

  // Fuentes dinámicas desde las noticias que realmente llegaron
  const availableSources = [...new Set(news.map(n => n.source))]

  const filtered = news.filter(item => {
    const matchesQuery = query === '' ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
    const matchesSource = activeSource === null || item.source === activeSource
    return matchesQuery && matchesSource
  })

  const [featured, ...rest] = filtered

  return (
    <div>
      {/* Buscador */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--f1-muted)' }}>
          🔍
        </span>
        <input
          type="text"
          placeholder="Buscar noticias... ej: Colapinto, Ferrari, Monaco"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm"
          style={{
            background: 'var(--f1-gray)',
            color: 'var(--f1-text)',
            border: '1px solid var(--f1-light-gray)',
            outline: 'none',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm hover:opacity-70"
            style={{ color: 'var(--f1-muted)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filtro por fuente */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveSource(null)}
          className="text-xs font-bold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
          style={{
            background: activeSource === null ? 'var(--f1-red)' : 'var(--f1-light-gray)',
            color: '#fff',
          }}
        >
          Todas
        </button>
        {availableSources.map(source => (
          <button
            key={source}
            onClick={() => setActiveSource(activeSource === source ? null : source)}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: activeSource === source ? (SOURCE_COLORS[source] ?? '#444') : 'var(--f1-light-gray)',
              color: '#fff',
            }}
          >
            {source}
          </button>
        ))}
      </div>

      {/* Sin resultados */}
      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--f1-muted)' }}>
          <div className="text-3xl mb-3">🔍</div>
          <p>No se encontraron noticias para <strong>"{query}"</strong></p>
          <button
            onClick={() => { setQuery(''); setActiveSource(null) }}
            className="mt-4 text-sm hover:opacity-70"
            style={{ color: 'var(--f1-red)' }}
          >
            Limpiar búsqueda
          </button>
        </div>
      )}

      {/* Noticia destacada */}
      {featured && (
        <a
          href={featured.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl p-6 mb-4 hover:opacity-80 transition-opacity"
          style={{ background: 'var(--f1-gray)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <SourceBadge source={featured.source} />
            <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
              {timeAgo(featured.pubDate)}
            </span>
          </div>
          <h3 className="text-xl font-bold leading-snug mb-2">{featured.title}</h3>
          {featured.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--f1-muted)' }}>
              {featured.description}
            </p>
          )}
        </a>
      )}

      {/* Grilla */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rest.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl px-5 py-4 hover:opacity-80 transition-opacity"
              style={{ background: 'var(--f1-gray)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <SourceBadge source={item.source} />
                <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                  {timeAgo(item.pubDate)}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug">{item.title}</p>
            </a>
          ))}
        </div>
      )}

      {/* Contador */}
      {filtered.length > 0 && (
        <p className="text-xs text-center mt-6" style={{ color: 'var(--f1-muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'noticia' : 'noticias'}
          {query && ` para "${query}"`}
          {activeSource && ` de ${activeSource}`}
        </p>
      )}
    </div>
  )
}