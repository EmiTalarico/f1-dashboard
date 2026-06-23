'use client'

import { useState, useEffect } from 'react'

type SessionItem = { label: string; date: string; time: string }

function getNextPending(sessions: SessionItem[]): SessionItem | null {
  const now = Date.now()
  for (const s of sessions) {
    const t = new Date(`${s.date}T${s.time}`).getTime()
    if (t > now) return s
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
  const [next, setNext] = useState<SessionItem | null>(() => getNextPending(sessions))
  const [parts, setParts] = useState(() => next ? diffParts(new Date(`${next.date}T${next.time}`).getTime()) : null)

  useEffect(() => {
    const interval = setInterval(() => {
      const pending = getNextPending(sessions)
      setNext(pending)
      if (pending) {
        setParts(diffParts(new Date(`${pending.date}T${pending.time}`).getTime()))
      } else {
        setParts(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [sessions])

  if (!next || !parts) {
    return (
      <div className="text-sm font-semibold px-4 py-3 rounded-lg" style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-muted)' }}>
        Fin de semana completado
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest mb-2 text-right" style={{ color: 'var(--f1-red)' }}>
        Próxima sesión: {next.label}
      </p>
      <div className="flex gap-3">
        {[
          { value: parts.days, label: 'días' },
          { value: parts.hours, label: 'horas' },
          { value: parts.minutes, label: 'min' },
          { value: parts.seconds, label: 'seg' },
        ].map(({ value, label }) => (
          <div key={label} className="text-center rounded-lg px-3 py-2 min-w-[56px]"
            style={{ background: 'var(--f1-light-gray)' }}>
            <div className="text-xl font-bold tabular-nums">{String(value).padStart(2, '0')}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--f1-muted)' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}