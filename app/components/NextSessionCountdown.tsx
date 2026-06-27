'use client'

import { useState, useEffect } from 'react'

type SessionItem = { label: string; date: string; time: string }

function getNextPending(sessions: SessionItem[]): SessionItem | null {
  const now = Date.now()
  for (const s of sessions) {
    const t = new Date(`${s.date}T${s.time}`).getTime()
    if (!isNaN(t) && t > now) return s
  }
  return null
}

function diffParts(targetMs: number) {
  const diff = targetMs - Date.now()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

export default function NextSessionCountdown({ sessions }: { sessions: SessionItem[] }) {
  // No calculamos nada dependiente de Date.now() antes de montar en el cliente,
  // para evitar mismatches de hidratación entre servidor y cliente.
  const [mounted, setMounted] = useState(false)
  const [next, setNext] = useState<SessionItem | null>(null)
  const [parts, setParts] = useState<ReturnType<typeof diffParts>>(null)

  useEffect(() => {
    setMounted(true)
    const pending = getNextPending(sessions)
    setNext(pending)
    setParts(pending ? diffParts(new Date(`${pending.date}T${pending.time}`).getTime()) : null)

    const interval = setInterval(() => {
      const p = getNextPending(sessions)
      setNext(p)
      setParts(p ? diffParts(new Date(`${p.date}T${p.time}`).getTime()) : null)
    }, 1000)
    return () => clearInterval(interval)
  }, [sessions])

  // Placeholder neutro mientras el cliente no montó — idéntico en servidor y cliente
  if (!mounted) {
    return (
      <div className="flex gap-2.5">
        {['DÍAS', 'HRS', 'MIN', 'SEG'].map((label) => (
          <div key={label} className="text-center rounded-xl px-3.5 py-2.5 min-w-[64px]"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--f1-card-border)' }}>
            <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--f1-muted)' }}>--</div>
            <div className="text-[10px] mt-1 font-bold tracking-wider" style={{ color: 'var(--f1-muted)' }}>{label}</div>
          </div>
        ))}
      </div>
    )
  }

  if (!next || !parts) {
    return (
      <div className="text-sm font-semibold px-5 py-4 rounded-xl f1-card" style={{ color: 'var(--f1-muted)' }}>
        🏁 Fin de semana completado
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-1.5 mb-2.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--f1-red)' }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--f1-red)' }} />
        </span>
        <p className="f1-label" style={{ color: 'var(--f1-red)' }}>
          {next.label}
        </p>
      </div>
      <div className="flex gap-2.5">
        {[
          { value: parts.days, label: 'DÍAS' },
          { value: parts.hours, label: 'HRS' },
          { value: parts.minutes, label: 'MIN' },
          { value: parts.seconds, label: 'SEG' },
        ].map(({ value, label }, i) => (
          <div key={label} className="relative text-center rounded-xl px-3.5 py-2.5 min-w-[64px] overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
              border: '1px solid var(--f1-card-border)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.25)',
            }}
          >
            {/* Línea de acento superior, más intensa en el último bloque (segundos) para dar sensación de "vivo" */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: i === 3 ? 'var(--f1-red)' : 'rgba(225,6,0,0.25)' }}
            />
            <div
              key={value}
              className="text-2xl font-black tabular-nums f1-tick"
              style={{
                color: i === 3 ? 'var(--f1-red)' : 'var(--f1-text)',
                fontFamily: 'var(--font-geist-mono), monospace',
              }}
            >
              {String(value).padStart(2, '0')}
            </div>
            <div className="text-[10px] mt-1 font-bold tracking-wider" style={{ color: 'var(--f1-muted)' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}