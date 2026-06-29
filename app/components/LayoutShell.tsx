'use client'

import { ReactNode } from 'react'
import { useSidebar } from './SidebarContext'

export default function LayoutShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div className="pt-16 md:pt-0">
      {/* Desktop: el margen sigue exactamente el ancho real del <aside> en Navbar.tsx
          (76px colapsado / 232px expandido) para que nunca quede un hueco ni se solape. */}
      <div
        className="hidden md:block transition-[margin-left] duration-300"
        style={{ marginLeft: collapsed ? '76px' : '232px' }}
      >
        {children}
      </div>
      <div className="md:hidden">
        {children}
      </div>
    </div>
  )
}