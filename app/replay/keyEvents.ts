// Línea de tiempo de eventos clave de una sesión grabada (para navegar el replay).
//
// Todo se calcula una sola vez desde los eventos del archivo. Los tiempos `t` están en
// segundos desde el primer evento (la misma base que `currentTs` del replay).
//
// Qué es "clave": largada / inicio de cada Q, bandera a cuadros, neutralizaciones
// (Safety Car, VSC, bandera roja, amarillas dentro de la sesión), incidentes y penalizaciones
// de la dirección de carrera, abandonos y, opcionalmente, paradas en boxes.
// Se descarta a propósito el ruido: banderas azules, tiempos borrados por límites de pista, etc.

import type { PitStopsByDriver } from './pitStops'

export type KeyEventKind =
  | 'start' | 'finish' | 'part'
  | 'sc' | 'vsc' | 'red' | 'yellow'
  | 'incident' | 'penalty' | 'retired' | 'pit'

export type KeyEvent = {
  id: string
  t: number            // segundos desde el inicio de la grabación
  kind: KeyEventKind
  label: string
  detail?: string
  lap?: number         // vuelta (carrera)
  part?: string        // Q1/Q2/Q3 (qualy)
}

export type Band = { kind: 'sc' | 'vsc' | 'red'; start: number; end: number }

export type Timeline = {
  events: KeyEvent[]
  bands: Band[]
  /** lapStarts[n] = t en que empieza la vuelta n del líder (índice 0 sin uso) */
  lapStarts: number[]
  /** Inicio de cada parte de qualy (Q1, Q2, Q3) */
  parts: { label: string; t: number }[]
  raceStart: number | null
  raceFinish: number | null
}

type EventLike = { ts: number; topic: string; data?: unknown }
type Rec = Record<string, unknown>

type Options = {
  nameOf?: (num: string) => string
  pitStops?: PitStopsByDriver
  sessionType?: string
}

function asRec(v: unknown): Rec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null
}

const TRACK_KIND: Record<string, Band['kind'] | undefined> = { '4': 'sc', '5': 'red', '6': 'vsc', '7': 'vsc' }
const BAND_LABEL: Record<Band['kind'], string> = { sc: 'Safety Car', vsc: 'Virtual Safety Car', red: 'Bandera roja' }

export function lapAt(lapStarts: number[], t: number): number | undefined {
  let lap: number | undefined
  for (let n = 1; n < lapStarts.length; n++) {
    if (lapStarts[n] !== undefined && lapStarts[n] <= t) lap = n
  }
  return lap
}

export function partAt(parts: Timeline['parts'], t: number): string | undefined {
  let label: string | undefined
  for (const p of parts) if (p.t <= t) label = p.label
  return label
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

export function buildTimeline(events: EventLike[], opts: Options = {}): Timeline {
  const nameOf = opts.nameOf ?? ((n: string) => n)
  const isRace = /^(Race|Sprint)$/.test(opts.sessionType ?? '')
  const out: KeyEvent[] = []
  const bands: Band[] = []
  const lapStarts: number[] = [0]
  const parts: Timeline['parts'] = []
  if (events.length === 0) return { events: out, bands, lapStarts, parts, raceStart: null, raceFinish: null }

  const t0 = events[0].ts
  const tEnd = events[events.length - 1].ts - t0
  const rel = (e: EventLike) => e.ts - t0

  // 1) Estado de sesión: ventanas "en pista" (Started → Finished/Aborted) y partes de qualy
  const windows: [number, number][] = []
  let openStart: number | null = null
  let prevStatus = ''
  let raceStart: number | null = null
  const sprintQuali = (opts.sessionType ?? '').includes('Sprint')
  for (const e of events) {
    if (e.topic !== 'SessionStatus') continue
    const status = String(asRec(e.data)?.Status ?? '')
    const t = rel(e)
    if (status === 'Started') {
      openStart = t
      const resumed = prevStatus === 'Aborted'
      if (isRace) {
        if (!resumed && raceStart === null) { raceStart = t; out.push({ id: `start-${t}`, t, kind: 'start', label: 'Largada' }) }
        else if (resumed) out.push({ id: `resume-${t}`, t, kind: 'start', label: 'Reanudación de la carrera' })
      } else if (!resumed) {
        const label = `${sprintQuali ? 'SQ' : 'Q'}${parts.length + 1}`
        parts.push({ label, t })
        out.push({ id: `part-${t}`, t, kind: 'part', label: `Inicio de ${label}`, part: label })
      }
    } else if ((status === 'Finished' || status === 'Aborted' || status === 'Finalised') && openStart !== null) {
      windows.push([openStart, t]); openStart = null
    }
    prevStatus = status
  }
  if (openStart !== null) windows.push([openStart, tEnd])
  const inSession = (t: number) => windows.length === 0 || windows.some(([a, b]) => t >= a && t <= b)

  // 2) Índice de vueltas (líder)
  for (const e of events) {
    if (e.topic !== 'LapCount') continue
    const n = asRec(e.data)?.CurrentLap
    if (typeof n === 'number' && lapStarts[n] === undefined) lapStarts[n] = rel(e)
  }
  if (raceStart !== null && lapStarts.length > 1) lapStarts[1] = raceStart

  const lapFor = (t: number) => (isRace ? lapAt(lapStarts, t) : undefined)
  const partFor = (t: number) => (isRace ? undefined : partAt(parts, t))

  // 3) Neutralizaciones desde TrackStatus
  let open: { kind: Band['kind']; start: number } | null = null
  let lastYellow = -Infinity
  const closeBand = (end: number) => {
    if (!open) return
    bands.push({ kind: open.kind, start: open.start, end })
    out.push({
      id: `${open.kind}-${open.start}`, t: open.start, kind: open.kind, label: BAND_LABEL[open.kind],
      detail: `${raceStart !== null && open.start < raceStart ? 'antes de la largada · ' : ''}duró ${fmtDuration(end - open.start)}`,
      lap: lapFor(open.start), part: partFor(open.start),
    })
    open = null
  }
  for (const e of events) {
    if (e.topic !== 'TrackStatus') continue
    const status = String(asRec(e.data)?.Status ?? '')
    const t = rel(e)
    const kind = TRACK_KIND[status]
    if (kind) {
      if (open && (open as { kind: Band['kind'] }).kind !== kind) closeBand(t)
      if (!open) open = { kind, start: t }
    } else if (status === '1') {
      closeBand(t)
    } else if (status === '2' && !open && inSession(t) && t - lastYellow > 5) {
      lastYellow = t
      out.push({ id: `yellow-${t}`, t, kind: 'yellow', label: 'Bandera amarilla', lap: lapFor(t), part: partFor(t) })
    }
  }
  closeBand(tEnd)

  // 4) Mensajes de la dirección de carrera (solo lo relevante)
  const seen = new Set<string>()
  for (const e of events) {
    if (e.topic !== 'RaceControlMessages') continue
    const raw = asRec(e.data)?.Messages
    const list: unknown[] = Array.isArray(raw) ? raw : Object.values(asRec(raw) ?? {})
    for (const item of list) {
      const m = asRec(item)
      if (!m) continue
      const text = String(m.Message ?? '')
      const key = `${m.Utc ?? ''}|${text}`
      if (seen.has(key)) continue
      seen.add(key)
      const t = rel(e)
      const up = text.toUpperCase()
      const lap = typeof m.Lap === 'number' ? m.Lap : lapFor(t)
      const clean = text.replace(/^FIA STEWARDS:\s*/i, '')

      if (m.Category === 'Flag') {
        if (m.Flag === 'CHEQUERED') {
          if (isRace) out.push({ id: `finish-${t}`, t, kind: 'finish', label: 'Bandera a cuadros', lap })
          else out.push({ id: `finish-${t}`, t, kind: 'finish', label: `Fin de ${partFor(t) ?? 'la sesión'}`, part: partFor(t) })
        }
        continue
      }
      if (m.Category !== 'Other') continue
      if (/UNDER INVESTIGATION|WILL BE INVESTIGATED/.test(up) && !/NO FURTHER/.test(up)) {
        out.push({ id: `inc-${t}-${out.length}`, t, kind: 'incident', label: clean, lap, part: partFor(t) })
      } else if (/PENALTY/.test(up) && !/SERVED|NO FURTHER/.test(up)) {
        out.push({ id: `pen-${t}-${out.length}`, t, kind: 'penalty', label: clean, lap, part: partFor(t) })
      } else if (/\bNOTED\b/.test(up)) {
        out.push({ id: `inc-${t}-${out.length}`, t, kind: 'incident', label: clean, lap, part: partFor(t) })
      }
    }
  }

  // 5) Abandonos (primera vez que el piloto figura como Retired)
  const retired = new Set<string>()
  for (const e of events) {
    if (e.topic !== 'TimingData') continue
    const lines = asRec(asRec(e.data)?.Lines)
    if (!lines) continue
    for (const [num, raw] of Object.entries(lines)) {
      if (retired.has(num) || asRec(raw)?.Retired !== true) continue
      retired.add(num)
      const t = rel(e)
      out.push({ id: `ret-${num}`, t, kind: 'retired', label: `Abandono: ${nameOf(num)}`, lap: lapFor(t), part: partFor(t) })
    }
  }

  // 6) Paradas en boxes (el filtro de la UI decide si se muestran)
  for (const [num, stops] of Object.entries(opts.pitStops ?? {})) {
    for (const s of stops) {
      const t = s.inTs - t0
      out.push({
        id: `pit-${num}-${s.stop}`, t, kind: 'pit', label: `Parada ${s.stop}: ${nameOf(num)}`,
        detail: s.outTs === null ? 'abandono en boxes' : `${(s.outTs - s.inTs).toFixed(1)}s`, lap: s.lap,
      })
    }
  }

  out.sort((a, b) => a.t - b.t)
  const finish = out.find(e => e.kind === 'finish' && isRace)
  return { events: out, bands, lapStarts, parts, raceStart, raceFinish: finish ? finish.t : null }
}