import { XMLParser } from 'fast-xml-parser'
import NewsClient from './NewsClient'

export type NewsItem = {
  title: string
  link: string
  pubDate: string
  source: string
  description: string
  image?: string
}

const FEEDS = [
  { url: 'https://www.motorsport.com/rss/f1/news/',          source: 'Motorsport' },
  { url: 'https://www.autosport.com/rss/f1/news/',           source: 'Autosport'  },
  { url: 'https://www.planetf1.com/feed/',                   source: 'PlanetF1'   },
  { url: 'https://www.marca.com/rss/motor/formula1.xml',     source: 'Marca'      },
  { url: 'https://as.com/rss/tags/formula_1.xml',            source: 'AS Motor'   },
  { url: 'https://racer.com/f1/feed',                        source: 'Racer'      },
  { url: 'https://formula1.com/en/latest/all.xml',           source: 'F1 Oficial' },
  { url: 'https://www.f1latam.com/rss/rss.php',              source: 'F1 Latam'   },
  { url: 'https://www.sport.es/es/rss/formula-1/rss.xml',    source: 'Sport.es'   },
]

function extractImage(item: any): string | undefined {
  // <enclosure url="..." type="image/..."> — Motorsport, PlanetF1, etc.
  if (item.enclosure) {
    const enc = item.enclosure
    const url = enc['@_url'] ?? enc.url ?? (typeof enc === 'string' ? enc : undefined)
    if (url && typeof url === 'string') return url
  }

  // <media:content url="..."> — Sport.es, Autosport, etc.
  const mediaContent = item['media:content'] ?? item['media:thumbnail']
  if (mediaContent) {
    const url = mediaContent['@_url'] ?? mediaContent.url
    if (url && typeof url === 'string') return url
  }

  // <image> directa
  if (item.image && typeof item.image === 'string') return item.image

  return undefined
}

async function getNews(): Promise<NewsItem[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,       // necesario para leer @_url de enclosure y media:content
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
  })

  const results = await Promise.all(
    FEEDS.map(async ({ url, source }) => {
      try {
        const res = await fetch(url, {
          next: { revalidate: 1800 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; F1Pasion/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
        })
        if (!res.ok) return []
        const xml = await res.text()
        const parsed = parser.parse(xml)
        const items = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? []
        const arr = Array.isArray(items) ? items : [items]

        return arr.slice(0, 10).map((item: any) => ({
          title: typeof item.title === 'object' ? item.title['#text'] ?? '' : String(item.title ?? ''),
          link: item.link?.['@_href'] ?? item.link ?? '',
          pubDate: item.pubDate ?? item.published ?? item.updated ?? '',
          source,
          description: item.description
            ? String(item.description).replace(/<[^>]*>/g, '').slice(0, 140) + '…'
            : item.summary
              ? String(item.summary).replace(/<[^>]*>/g, '').slice(0, 140) + '…'
              : '',
          image: extractImage(item),
        }))
      } catch {
        return []
      }
    })
  )

  return results
    .flat()
    .filter(item => item.title && item.link)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 50)
}

export default async function NewsFeed() {
  const news = await getNews()
  return <NewsClient news={news} />
}