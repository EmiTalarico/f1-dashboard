'use client'

import { useState } from 'react'
import type { NewsItem } from './NewsFeed'

const SOURCE_COLORS: Record<string, string> = {
  Motorsport:   '#e10600',
  Autosport:    '#0057b8',
  PlanetF1:     '#00a550',
  Marca:        '#ff6600',
  'AS Motor':   '#cc0000',
  Racer:        '#f59e0b',
  'F1 Oficial': '#e10600',
  'F1 Latam':   '#e67e22',
  'Sport.es':   '#0057b8',
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
  const color = SOURCE_COLORS[source] ?? '#555'
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{
        background: color + '20',
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {source}
    </span>
  )
}

const CARD = {
  background: 'var(--f1-card-gradient)',
  border: '1px solid var(--f1-card-border)',
  boxShadow: 'var(--f1-card-shadow)',
} as const

export default function NewsClient({ news }: { news: NewsItem[] }) {
  const [query, setQuery] = useState('')
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const availableSources = [...new Set(news.map(n => n.source))]

  const filtered = news.filter(item => {
    const matchesQuery =
      query === '' ||
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
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--f1-muted)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </span>
        <input
          type="text"
          placeholder="Buscar noticias… ej: Colapinto, Ferrari, Spa"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm"
          style={{ ...CARD, color: 'var(--f1-text)', outline: 'none' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-60 transition-opacity"
            style={{ color: 'var(--f1-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setActiveSource(null)}
          className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-all duration-150"
          style={{
            background: activeSource === null ? 'var(--f1-red)' : 'rgba(255,255,255,0.06)',
            color: '#fff',
            border: `1px solid ${activeSource === null ? 'var(--f1-red)' : 'var(--f1-card-border)'}`,
            boxShadow: activeSource === null ? '0 0 12px rgba(225,6,0,0.25)' : 'none',
          }}
        >
          Todas
        </button>
        {availableSources.map(source => {
          const color = SOURCE_COLORS[source] ?? '#555'
          const isActive = activeSource === source
          return (
            <button
              key={source}
              onClick={() => setActiveSource(isActive ? null : source)}
              className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-all duration-150"
              style={{
                background: isActive ? color + '20' : 'rgba(255,255,255,0.06)',
                color: isActive ? color : 'var(--f1-muted)',
                border: `1px solid ${isActive ? color + '50' : 'var(--f1-card-border)'}`,
                boxShadow: isActive ? `0 0 12px ${color}20` : 'none',
              }}
            >
              {source}
            </button>
          )
        })}
      </div>

      {/* Sin resultados */}
      {filtered.length === 0 && (
        <div className="rounded-2xl px-5 py-16 text-center" style={CARD}>
          <p className="text-2xl mb-3">🔍</p>
          <p className="font-semibold mb-1">
            Sin resultados para <span style={{ color: 'var(--f1-red)' }}>"{query}"</span>
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--f1-muted)' }}>
            Probá con otro término o limpiá los filtros
          </p>
          <button
            onClick={() => { setQuery(''); setActiveSource(null) }}
            className="text-sm font-bold hover:opacity-70 transition-opacity"
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
          className="block rounded-2xl overflow-hidden mb-4 transition-all duration-200 hover:translate-y-[-2px]"
          style={{
            ...CARD,
            borderLeft: `4px solid ${SOURCE_COLORS[featured.source] ?? '#555'}`,
          }}
        >
          <div className="flex flex-col md:flex-row">
            {/* Imagen */}
            {featured.image && (
              <div className="md:w-72 shrink-0 overflow-hidden" style={{ maxHeight: 200 }}>
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="w-full h-full object-cover"
                  style={{ minHeight: 160 }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
            {/* Contenido */}
            <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <SourceBadge source={featured.source} />
                  <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                    {timeAgo(featured.pubDate)}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
                    style={{ background: 'rgba(225,6,0,0.12)', color: 'var(--f1-red)', border: '1px solid rgba(225,6,0,0.25)' }}
                  >
                    Destacada
                  </span>
                </div>
                <h3 className="text-xl font-bold leading-snug mb-2">{featured.title}</h3>
                {featured.description && (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--f1-muted)' }}>
                    {featured.description}
                  </p>
                )}
              </div>
              <div
                className="flex items-center gap-1 mt-4 text-xs font-medium"
                style={{ color: SOURCE_COLORS[featured.source] ?? 'var(--f1-muted)' }}
              >
                Leer en {featured.source}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M7 17L17 7M7 7h10v10"/>
                </svg>
              </div>
            </div>
          </div>
        </a>
      )}

      {/* Grilla */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rest.map((item, i) => {
            const isHovered = hoveredCard === i
            const sourceColor = SOURCE_COLORS[item.source] ?? '#555'
            return (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl overflow-hidden transition-all duration-150"
                style={{
                  ...CARD,
                  transform: isHovered ? 'translateY(-2px)' : 'none',
                  boxShadow: isHovered ? `0 8px 24px rgba(0,0,0,0.3)` : 'var(--f1-card-shadow)',
                  borderTop: `3px solid ${isHovered ? sourceColor : 'transparent'}`,
                }}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Imagen de la card */}
                {item.image && (
                  <div className="overflow-hidden" style={{ height: 140 }}>
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-300"
                      style={{ transform: isHovered ? 'scale(1.04)' : 'scale(1)' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none' }}
                    />
                  </div>
                )}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <SourceBadge source={item.source} />
                    <span className="text-xs" style={{ color: 'var(--f1-muted)' }}>
                      {timeAgo(item.pubDate)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{item.title}</p>
                </div>
              </a>
            )
          })}
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