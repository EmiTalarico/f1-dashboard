import { XMLParser } from 'fast-xml-parser'
import NewsClient from './NewsClient'

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
  { url: 'https://as.com/rss/tags/formula_1.xml', source: 'AS Motor' },
  { url: 'https://racer.com/f1/feed', source: 'Racer' },
  { url: 'https://formula1.com/en/latest/all.xml', source: 'F1 Oficial' },
  { url: 'https://www.f1latam.com/rss/rss.php', source: 'F1 Latam' },
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
        return arr.slice(0, 10).map((item: any) => ({
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
    .slice(0, 40)
}

export default async function NewsFeed() {
  const news = await getNews()
  return <NewsClient news={news} />
}