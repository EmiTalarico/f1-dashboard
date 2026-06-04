import { XMLParser } from 'fast-xml-parser'

type NewsItem = {
  title: string
  link: string
  pubDate: string
  source: string
}

const FEEDS = [
  { url: 'https://www.motorsport.com/rss/f1/news/', source: 'Motorsport' },
  { url: 'https://www.autosport.com/rss/f1/news/', source: 'Autosport' },
  { url: 'https://www.planetf1.com/feed/', source: 'PlanetF1' },
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
        }))
      } catch {
        return []
      }
    })
  )

  return results
    .flat()
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 20)
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
}

export default async function NewsFeed() {
  const news = await getNews()

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--f1-gray)' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--f1-light-gray)' }}>
        <h2 className="text-lg font-semibold">Últimas Noticias</h2>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--f1-light-gray)' }}>
        {news.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col px-6 py-4 gap-1 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: SOURCE_COLORS[item.source], color: '#fff' }}
              >
                {item.source}
              </span>
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