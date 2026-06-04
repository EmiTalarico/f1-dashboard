type Session = { date: string; time: string }

type Race = {
  raceName: string
  date: string
  time: string
  Circuit: {
    circuitName: string
    Location: { locality: string; country: string; lat: string; long: string }
  }
  FirstPractice?: Session
  SecondPractice?: Session
  ThirdPractice?: Session
  Qualifying?: Session
  Sprint?: Session
  SprintQualifying?: Session
  SprintShootout?: Session
}

type WeatherBySession = Record<string, {
  temp: number
  rain: number
  wind: number
  code: number
} | null>

const TIMEZONES: { label: string; flag: string; tz: string }[] = [
  { label: 'Argentina', flag: '🇦🇷', tz: 'America/Argentina/Buenos_Aires' },
  { label: 'España',    flag: '🇪🇸', tz: 'Europe/Madrid'                  },
  { label: 'UK',        flag: '🇬🇧', tz: 'Europe/London'                  },
  { label: 'USA Este',  flag: '🇺🇸', tz: 'America/New_York'               },
  { label: 'Japón',     flag: '🇯🇵', tz: 'Asia/Tokyo'                     },
]

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
  45: '🌫', 48: '🌫', 51: '🌦', 53: '🌦', 55: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧', 71: '🌨', 73: '🌨',
  75: '🌨', 80: '🌦', 81: '🌧', 82: '⛈', 95: '⛈',
}

async function getNextRace(): Promise<Race | null> {
  const res = await fetch(
    'https://api.jolpi.ca/ergast/f1/2026/next.json',
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  return data.MRData.RaceTable.Races[0] ?? null
}

async function getWeather(
  lat: string,
  lon: string,
  sessions: { label: string; session: Session }[]
): Promise<WeatherBySession> {
  try {
    // Collect all unique dates needed
    const dates = [...new Set(sessions.map(s => s.session.date))].sort()
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    // Check if within 16-day forecast window
    const diffDays = (new Date(startDate).getTime() - Date.now()) / 86400000
    if (diffDays > 15) return {}

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,windspeed_10m,weathercode&start_date=${startDate}&end_date=${endDate}&timezone=UTC`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    const data = await res.json()

    const hourly = data.hourly
    const result: WeatherBySession = {}

    for (const { label, session } of sessions) {
      const sessionUTC = new Date(`${session.date}T${session.time}`)
      const targetHour = `${session.date}T${String(sessionUTC.getUTCHours()).padStart(2, '0')}:00`
      const idx = hourly.time.indexOf(targetHour)
      if (idx === -1) { result[label] = null; continue }
      result[label] = {
        temp: Math.round(hourly.temperature_2m[idx]),
        rain: hourly.precipitation_probability[idx],
        wind: Math.round(hourly.windspeed_10m[idx]),
        code: hourly.weathercode[idx],
      }
    }
    return result
  } catch {
    return {}
  }
}

function getTimeLeft(date: string, time: string) {
  const raceDate = new Date(`${date}T${time}`)
  const diff = raceDate.getTime() - Date.now()
  if (diff <= 0) return null
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  }
}

function formatInTZ(date: string, time: string, tz: string) {
  return new Date(`${date}T${time}`).toLocaleString('es-AR', {
    timeZone: tz, weekday: 'short', day: 'numeric',
    month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function WeatherBadge({ w }: { w: { temp: number; rain: number; wind: number; code: number } | null }) {
  if (!w) return null
  const icon = WMO_ICONS[w.code] ?? '🌡'
  return (
    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
      <span>{icon} <strong>{w.temp}°C</strong></span>
      <span style={{ color: 'var(--f1-muted)' }}>💨 {w.wind} km/h</span>
      <span style={{ color: w.rain > 50 ? '#60a5fa' : 'var(--f1-muted)' }}>
        🌧 {w.rain}% lluvia
      </span>
    </div>
  )
}

function SessionRow({ label, session, weather, isMain = false }: {
  label: string
  session: Session
  weather: WeatherBySession
  isMain?: boolean
}) {
  return (
    <div
      className="rounded-lg px-4 py-3 mb-2"
      style={{ background: isMain ? 'var(--f1-light-gray)' : 'var(--f1-gray)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: isMain ? 'var(--f1-red)' : 'var(--f1-light-gray)', color: '#fff' }}
        >
          {label}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {TIMEZONES.map(({ label: tzLabel, flag, tz }) => (
          <div key={tz} className="flex items-center gap-2 text-xs">
            <span>{flag}</span>
            <span style={{ color: 'var(--f1-muted)' }}>{tzLabel}:</span>
            <span className="font-medium">{formatInTZ(session.date, session.time, tz)}</span>
          </div>
        ))}
      </div>
      <WeatherBadge w={weather[label] ?? null} />
    </div>
  )
}

export default async function NextRace() {
  const race = await getNextRace()
  if (!race) return null

  const timeLeft = getTimeLeft(race.date, race.time)
  const isSprintWeekend = !!(race.Sprint || race.SprintQualifying || race.SprintShootout)

  const sessions: { label: string; session: Session; isMain?: boolean }[] = [
    race.FirstPractice    && { label: 'Práctica 1',        session: race.FirstPractice },
    race.SecondPractice   && { label: isSprintWeekend ? 'Sprint Qualy' : 'Práctica 2', session: race.SecondPractice },
    race.ThirdPractice    && { label: 'Práctica 3',        session: race.ThirdPractice },
    race.SprintQualifying && { label: 'Sprint Qualifying', session: race.SprintQualifying },
    race.SprintShootout   && { label: 'Sprint Shootout',   session: race.SprintShootout },
    race.Sprint           && { label: 'Sprint',            session: race.Sprint },
    race.Qualifying       && { label: 'Clasificación',     session: race.Qualifying },
    { label: 'Carrera', session: { date: race.date, time: race.time }, isMain: true },
  ].filter(Boolean) as { label: string; session: Session; isMain?: boolean }[]

  const weather = await getWeather(
    race.Circuit.Location.lat,
    race.Circuit.Location.long,
    sessions
  )

  return (
    <div className="rounded-xl px-6 py-5 mb-6" style={{ background: 'var(--f1-gray)' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--f1-red)' }}>
            Próxima carrera
          </p>
          <h2 className="text-xl font-bold">{race.raceName}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--f1-muted)' }}>
            {race.Circuit.circuitName} — {race.Circuit.Location.locality}, {race.Circuit.Location.country}
          </p>
          {isSprintWeekend && (
            <span className="inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#f59e0b', color: '#000' }}>
              🏃 Fin de semana Sprint
            </span>
          )}
        </div>
        {timeLeft && (
          <div className="flex gap-4">
            {[
              { value: timeLeft.days,    label: 'días'  },
              { value: timeLeft.hours,   label: 'horas' },
              { value: timeLeft.minutes, label: 'min'   },
            ].map(({ value, label }) => (
              <div key={label} className="text-center rounded-lg px-4 py-3 min-w-[64px]"
                style={{ background: 'var(--f1-light-gray)' }}>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--f1-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sesiones */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--f1-muted)' }}>
          HORARIOS DEL FIN DE SEMANA
        </h3>
        {sessions.map(({ label, session, isMain }) => (
          <SessionRow key={label} label={label} session={session} weather={weather} isMain={!!isMain} />
        ))}
      </div>
    </div>
  )
}