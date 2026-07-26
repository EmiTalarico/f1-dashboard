'use client'

import { ReactNode } from 'react'
import { useSidebar } from './SidebarContext'
import Footer from './Footer'

export default function LayoutShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div className="pt-16 md:pt-0">
      {/* Desktop */}
      <div
        className="hidden md:block transition-[margin-left] duration-300"
        style={{ marginLeft: collapsed ? '76px' : '232px' }}
      >
        {children}
        <Footer />
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {children}
        <Footer />
      </div>
    </div>
  )
}