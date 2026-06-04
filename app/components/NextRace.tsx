async function getNextRace() {
  const res = await fetch(
    'https://api.jolpi.ca/ergast/f1/2026/next.json',
    { next: { revalidate: 3600 } }
  )
  const data = await res.json()
  return data.MRData.RaceTable.Races[0]
}

function getTimeLeft(date: string, time: string) {
  const raceDate = new Date(`${date}T${time}`)
  const now = new Date()
  const diff = raceDate.getTime() - now.getTime()

  if (diff <= 0) return null

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { days, hours, minutes }
}

export default async function NextRace() {
  const race = await getNextRace()

  if (!race) return null

  const timeLeft = getTimeLeft(race.date, race.time)

  return (
    <div className="rounded-xl px-6 py-5 mb-6" style={{ background: 'var(--f1-gray)' }}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--f1-red)' }}>
            Próxima carrera
          </p>
          <h2 className="text-xl font-bold">{race.raceName}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--f1-muted)' }}>
            {race.Circuit.circuitName} — {race.Circuit.Location.locality}, {race.Circuit.Location.country}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--f1-muted)' }}>
            {new Date(`${race.date}T${race.time}`).toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>

        {timeLeft && (
          <div className="flex gap-4">
            {[
              { value: timeLeft.days, label: 'días' },
              { value: timeLeft.hours, label: 'horas' },
              { value: timeLeft.minutes, label: 'min' },
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
    </div>
  )
}