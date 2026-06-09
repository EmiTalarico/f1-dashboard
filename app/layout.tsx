import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Navbar from './components/Navbar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'F1Pasión',
  description: 'Standings, noticias, telemetría y live timing de Formula 1',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Navbar />
        {/*
          Desktop: margen izquierdo para el sidebar (220px expandido, 60px colapsado)
          Mobile: padding top para el header fijo
        */}
        <div className="md:ml-[220px] pt-16 md:pt-0">
          {children}
        </div>
      </body>
    </html>
  )
}