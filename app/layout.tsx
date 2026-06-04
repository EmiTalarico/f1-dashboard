import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from './components/Navbar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'F1 Dashboard',
  description: 'Standings, noticias y live timing de Formula 1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Navbar />
        {/* En desktop desplazamos el contenido para que no quede debajo del sidebar */}
        <div className="md:ml-56 pb-20 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  )
}