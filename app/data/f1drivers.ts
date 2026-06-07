export type F1Driver = {
  number: string
  acronym: string
  fullName: string
  team: string
  teamColor: string
  flag: string
}

export const F1_DRIVERS: Record<string, F1Driver> = {
  '1':  { number: '1',  acronym: 'VER', fullName: 'Max Verstappen',       team: 'Red Bull',      teamColor: '3671C6', flag: '🇳🇱' },
  '4':  { number: '4',  acronym: 'NOR', fullName: 'Lando Norris',         team: 'McLaren',       teamColor: 'FF8000', flag: '🇬🇧' },
  '5':  { number: '5',  acronym: 'BOR', fullName: 'Gabriel Bortoleto',    team: 'Audi',          teamColor: 'C00000', flag: '🇧🇷' },
  '6':  { number: '6',  acronym: 'HAD', fullName: 'Isack Hadjar',         team: 'Red Bull',      teamColor: '3671C6', flag: '🇫🇷' },
  '10': { number: '10', acronym: 'GAS', fullName: 'Pierre Gasly',         team: 'Alpine',        teamColor: '0093CC', flag: '🇫🇷' },
  '11': { number: '11', acronym: 'PER', fullName: 'Sergio Pérez',         team: 'Cadillac',      teamColor: 'CC0000', flag: '🇲🇽' },
  '12': { number: '12', acronym: 'ANT', fullName: 'Kimi Antonelli',       team: 'Mercedes',      teamColor: '27F4D2', flag: '🇮🇹' },
  '14': { number: '14', acronym: 'ALO', fullName: 'Fernando Alonso',      team: 'Aston Martin',  teamColor: '229971', flag: '🇪🇸' },
  '16': { number: '16', acronym: 'LEC', fullName: 'Charles Leclerc',      team: 'Ferrari',       teamColor: 'E8002D', flag: '🇲🇨' },
  '18': { number: '18', acronym: 'STR', fullName: 'Lance Stroll',         team: 'Aston Martin',  teamColor: '229971', flag: '🇨🇦' },
  '22': { number: '22', acronym: 'TSU', fullName: 'Yuki Tsunoda',         team: 'Racing Bulls',  teamColor: '6692FF', flag: '🇯🇵' },
  '23': { number: '23', acronym: 'ALB', fullName: 'Alexander Albon',      team: 'Williams',      teamColor: '00A3E0', flag: '🇹🇭' },
  '27': { number: '27', acronym: 'HUL', fullName: 'Nico Hülkenberg',      team: 'Audi',          teamColor: 'C00000', flag: '🇩🇪' },
  '30': { number: '30', acronym: 'LAW', fullName: 'Liam Lawson',          team: 'Racing Bulls',  teamColor: '6692FF', flag: '🇳🇿' },
  '31': { number: '31', acronym: 'OCO', fullName: 'Esteban Ocon',         team: 'Haas',          teamColor: 'B6BABD', flag: '🇫🇷' },
  '38': { number: '38', acronym: 'LIN', fullName: 'Arvid Lindblad',       team: 'Racing Bulls',  teamColor: '6692FF', flag: '🇬🇧' },
  '41': { number: '41', acronym: 'LIN', fullName: 'Arvid Lindblad',       team: 'Racing Bulls',  teamColor: '6692FF', flag: '🇬🇧' },
  '43': { number: '43', acronym: 'COL', fullName: 'Franco Colapinto',     team: 'Alpine',        teamColor: '0093CC', flag: '🇦🇷' },
  '44': { number: '44', acronym: 'HAM', fullName: 'Lewis Hamilton',       team: 'Ferrari',       teamColor: 'E8002D', flag: '🇬🇧' },
  '55': { number: '55', acronym: 'SAI', fullName: 'Carlos Sainz',         team: 'Williams',      teamColor: '00A3E0', flag: '🇪🇸' },
  '63': { number: '63', acronym: 'RUS', fullName: 'George Russell',       team: 'Mercedes',      teamColor: '27F4D2', flag: '🇬🇧' },
  '77': { number: '77', acronym: 'BOT', fullName: 'Valtteri Bottas',      team: 'Cadillac',      teamColor: 'CC0000', flag: '🇫🇮' },
  '81': { number: '81', acronym: 'PIA', fullName: 'Oscar Piastri',        team: 'McLaren',       teamColor: 'FF8000', flag: '🇦🇺' },
  '87': { number: '87', acronym: 'BEA', fullName: 'Oliver Bearman',       team: 'Haas',          teamColor: 'B6BABD', flag: '🇬🇧' },
}