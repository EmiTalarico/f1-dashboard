import { XMLParser } from 'fast-xml-parser'

type NewsItem = {
  title: string
  link: string
  pubDate: string
  source: string
  description: string
}

const FEEDS = [
  { url: 'https://www.motorsport.com/rss/f1/news/', source: 'Motorsport' },
  { url: 'https://www.autosport.com/rss/f1/news/', source: 'Autosport' },
  { url: 'https://www.planetf1.com/feed/', source: 'PlanetF1' },
  { url: 'https://www.marca.com/rss/motor/formula1.xml', source: 'Marca' },
  { url: 'https://feeds.feedburner.com/f1aldía', source: 'F1 al día' },
]

async function getNews(): Promise<NewsItem[]> {
  const parser = new XMLParser()

  const results = await Promise.all(
    FEEDS.map(async ({ url, source }) => {
      try {
        const res = await fetch(url, { next: { revalidate: 1800 } })
        const xml = await res.text()
        const parsed = parser.parse(xml)
        const items = parsed.rss?.channel?.item ?? []
        const arr = Array.isArray(items) ? items : [items]
        return arr.slice(0, 8).map((item: any) => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          source,
          description: item.description
            ? String(item.description).replace(/<[^>]*>/g, '').slice(0, 120) + '...'
            : '',
        }))
      } catch {
        return []
      }
    })
  )

  return results
    .flat()
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 21)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `hace ${Math.floor(h / 24)}d`
  if (h >= 1) return `hace ${h}h`
  return `hace ${m}m`
}

const SOURCE_COLORS: Record<string, string> = {
  Motorsport: '#e10600',
  Autosport: '#0057b8',
  PlanetF1: '#00a550',
  Marca: '#ff6600',
  'F1 al día': '#8b5cf6',
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: SOURCE_COLORS[source] ?? '#444', color: '#fff' }}
    >
      {source}
    </span>
  )
}

export default async function NewsFeed() {
  const news = await getNews()
  const [featured, ...rest] = news

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Últimas Noticias</h2>

      {/* Noticia destacada */}
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

      {/* Grilla de noticias */}
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
    </div>
  )
}