// Neutralizaciones (Safety Car, VSC, bandera roja) a partir del historial de TrackStatus
// que guarda el backend. Mismo criterio que la timeline del replay (app/replay/keyEvents.ts):
//   4 = SC, 5 = roja, 6/7 = VSC (7 = "VSC ending"), 1 = pista libre cierra la neutralización.

export type TrackChange = { ts: number; status: string; lap?: number | null }

export type NeutralizationKind = 'sc' | 'vsc' | 'red'

export type Neutralization = {
  kind: NeutralizationKind
  startTs: number
  endTs: number | null   // null = sigue en curso a `nowTs`
  lap?: number           // vuelta del líder cuando empezó
  beforeStart: boolean   // ocurrió antes de la largada / inicio de la sesión
}

const KIND_BY_STATUS: Record<string, NeutralizationKind | undefined> = { '4': 'sc', '5': 'red', '6': 'vsc', '7': 'vsc' }

export const NEUTRALIZATION_LABEL: Record<NeutralizationKind, string> = {
  sc: 'Safety Car',
  vsc: 'Virtual Safety Car',
  red: 'Bandera roja',
}

export const NEUTRALIZATION_COLOR: Record<NeutralizationKind, string> = {
  sc: '#f59e0b',
  vsc: '#eab308',
  red: '#e10600',
}

/**
 * Neutralizaciones iniciadas hasta `nowTs`, en orden cronológico.
 * Los cambios posteriores a `nowTs` se ignoran, así el resultado respeta el delay/pausa del live.
 */
export function buildNeutralizations(
  history: TrackChange[] | undefined,
  nowTs: number,
  raceStartTs?: number | null,
): Neutralization[] {
  const out: Neutralization[] = []
  let open: Neutralization | null = null

  for (const change of history ?? []) {
    if (change.ts > nowTs) break
    const kind = KIND_BY_STATUS[String(change.status)]
    if (kind) {
      if (open && open.kind !== kind) { open.endTs = change.ts; open = null }
      if (!open) {
        open = {
          kind,
          startTs: change.ts,
          endTs: null,
          lap: typeof change.lap === 'number' ? change.lap : undefined,
          beforeStart: raceStartTs != null && change.ts < raceStartTs,
        }
        out.push(open)
      }
    } else if (open && String(change.status) === '1') {
      // Solo "pista libre" cierra la neutralización (igual que en el replay); una amarilla no
      open.endTs = change.ts
      open = null
    }
  }
  return out
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`
}