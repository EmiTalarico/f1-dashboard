// Paradas en boxes derivadas de los eventos grabados (TimingData + TimingAppData).
//
// El feed no manda "parada completa" como un dato: hay que reconstruirla.
//   - InPit: true  -> el piloto entra al pit lane
//   - InPit: false -> el piloto sale del pit lane
//   - NumberOfPitStops -> se incrementa en cada parada real
// Antes de la largada también hay entradas/salidas de pit lane (salida a la parrilla,
// "pit exit open"), pero esas NO traen NumberOfPitStops, así que se descartan.
//
// IMPORTANTE: el tiempo medido es el del PIT LANE completo (entrada -> salida),
// no el tiempo detenido en el box. El feed no publica el tiempo estático.

export type PitStop = {
  stop: number          // número de parada (1, 2, 3...)
  inTs: number          // ts absoluto (segundos) de entrada al pit lane
  outTs: number | null  // ts absoluto de salida; null si no salió en lo grabado
  lap: number           // vuelta de entrada (vueltas completadas + 1)
  from?: string         // compuesto que se saca
  to?: string           // compuesto que se pone
}

export type PitStopsByDriver = { [num: string]: PitStop[] }

type EventLike = { ts: number; topic: string; data?: unknown }
type Rec = Record<string, unknown>

function asRec(v: unknown): Rec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null
}

function stintCompounds(raw: unknown): { [idx: string]: string } {
  const out: { [idx: string]: string } = {}
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((s, i) => [String(i), s])
    : Object.entries(asRec(raw) ?? {})
  for (const [k, s] of entries) {
    const compound = asRec(s)?.Compound
    if (typeof compound === 'string' && compound) out[k] = compound
  }
  return out
}

export function buildPitStops(events: EventLike[]): PitStopsByDriver {
  const completedLaps: { [num: string]: number } = {}
  const open: { [num: string]: { inTs: number; lap: number; stop?: number } } = {}
  const compounds: { [num: string]: { [idx: string]: string } } = {}
  const result: PitStopsByDriver = {}

  const close = (num: string, outTs: number | null) => {
    const o = open[num]
    delete open[num]
    if (!o || o.stop === undefined) return // entrada a pit lane que no es una parada (pre-carrera)
    ;(result[num] ??= []).push({ stop: o.stop, inTs: o.inTs, outTs, lap: o.lap })
  }

  for (const e of events) {
    if (e.topic === 'TimingAppData') {
      const lines = asRec(asRec(e.data)?.Lines)
      if (!lines) continue
      for (const [num, raw] of Object.entries(lines)) {
        const d = asRec(raw)
        if (!d || d.Stints === undefined) continue
        compounds[num] = { ...(compounds[num] ?? {}), ...stintCompounds(d.Stints) }
      }
      continue
    }

    if (e.topic !== 'TimingData') continue // TimingDataF1 duplica lo mismo
    const lines = asRec(asRec(e.data)?.Lines)
    if (!lines) continue

    for (const [num, raw] of Object.entries(lines)) {
      const d = asRec(raw)
      if (!d) continue
      if (typeof d.NumberOfLaps === 'number') completedLaps[num] = d.NumberOfLaps
      if (d.InPit === true && !open[num]) open[num] = { inTs: e.ts, lap: (completedLaps[num] ?? 0) + 1 }
      if (typeof d.NumberOfPitStops === 'number' && open[num]) open[num].stop = d.NumberOfPitStops
      if (d.InPit === false && open[num]) close(num, e.ts)
    }
  }

  // Pilotos que quedaron en boxes al terminar lo grabado (abandono en pit lane)
  for (const num of Object.keys(open)) close(num, null)

  // Compuestos antes/después: la parada N pasa del stint N-1 al stint N
  for (const [num, stops] of Object.entries(result)) {
    const c = compounds[num] ?? {}
    for (const s of stops) {
      s.from = c[String(s.stop - 1)]
      s.to = c[String(s.stop)]
    }
    stops.sort((a, b) => a.inTs - b.inTs)
  }
  return result
}

/** Paradas ya iniciadas a `nowTs`, y la que está en curso (si el piloto está en pit lane). */
export function pitStateAt(stops: PitStop[] | undefined, nowTs: number) {
  const started = (stops ?? []).filter(s => s.inTs <= nowTs)
  const active = started.find(s => s.outTs === null || nowTs < s.outTs) ?? null
  const completed = started.filter(s => s !== active)
  return { active, completed }
}

/** Duración a `nowTs`: si la parada sigue en curso en el replay, cuenta hasta ahora (no hasta la salida futura). */
export function pitDuration(stop: PitStop, nowTs: number): number {
  return Math.max(0, Math.min(stop.outTs ?? nowTs, nowTs) - stop.inTs)
}