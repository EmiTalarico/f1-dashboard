'use client'

import { CSSProperties, ReactNode } from 'react'
import { useSidebar } from './SidebarContext'
import Footer from './Footer'

// Antes se renderizaba {children} dos veces (una copia para desktop y otra para mobile, ocultas con
// CSS). Las dos copias quedaban montadas: cada página corría doble (p. ej. el live abría dos
// WebSockets). Ahora hay UNA sola copia y el margen del sidebar solo se aplica desde `md`.
export default function LayoutShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div className="pt-16 md:pt-0">
      <div
        className="transition-[margin-left] duration-300 md:ml-[var(--sidebar-width)]"
        style={{ '--sidebar-width': collapsed ? '76px' : '232px' } as CSSProperties}
      >
        {children}
        <Footer />
      </div>
    </div>
  )
}