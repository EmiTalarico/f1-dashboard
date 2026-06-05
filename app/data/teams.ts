export type Driver = {
  name: string
  number: number
  nationality: string
  flag: string
  dob: string
  podiums?: number
  championships?: number
  role: 'titular' | 'reserva'
}

export type TeamData = {
  name: string
  fullName: string
  constructorId: string
  color: string
  nationality: string
  flag: string
  base: string
  powerUnit: string
  technicalDirector: string
  teamPrincipal: string
  ceo?: string
  firstSeason: number
  championships: number
  description: string
  drivers: Driver[]
  reserveDrivers: string[]
}

export const TEAMS: TeamData[] = [
  {
    name: 'McLaren',
    fullName: 'McLaren Mastercard F1 Team',
    constructorId: 'mclaren',
    color: '#FF8000',
    nationality: 'British',
    flag: '🇬🇧',
    base: 'Woking, Reino Unido',
    powerUnit: 'Mercedes',
    technicalDirector: 'Peter Prodromou',
    teamPrincipal: 'Andrea Stella',
    ceo: 'Zak Brown',
    firstSeason: 1966,
    championships: 9,
    description: 'Campeón de constructores en 2024 y 2025, McLaren llega a 2026 como el equipo a batir. Con Norris y Piastri, tienen la dupla más joven y veloz de la parrilla.',
    drivers: [
      { name: 'Lando Norris', number: 4, nationality: 'Británico', flag: '🇬🇧', dob: '1999-11-13', championships: 1, podiums: 41, role: 'titular' },
      { name: 'Oscar Piastri', number: 81, nationality: 'Australiano', flag: '🇦🇺', dob: '2001-04-06', championships: 0, podiums: 18, role: 'titular' },
    ],
    reserveDrivers: ['Leonardo Fornaroli y Patricio O\'Ward'],
  },
  {
    name: 'Ferrari',
    fullName: 'Scuderia Ferrari HP',
    constructorId: 'ferrari',
    color: '#E8002D',
    nationality: 'Italian',
    flag: '🇮🇹',
    base: 'Maranello, Italia',
    powerUnit: 'Ferrari',
    technicalDirector: 'Loïc Serra',
    teamPrincipal: 'Frédéric Vasseur',
    ceo: 'John Elkann',
    firstSeason: 1950,
    championships: 16,
    description: 'El equipo más icónico de la Fórmula 1. Con Hamilton sumado a Leclerc, Ferrari busca romper una sequía de títulos que se extiende desde 2008. Los nuevos reglamentos de 2026 son su gran esperanza.',
    drivers: [
      { name: 'Charles Leclerc', number: 16, nationality: 'Monegasco', flag: '🇲🇨', dob: '1997-10-16', championships: 0, podiums: 45, role: 'titular' },
      { name: 'Lewis Hamilton', number: 44, nationality: 'Británico', flag: '🇬🇧', dob: '1985-01-07', championships: 7, podiums: 202, role: 'titular' },
    ],
    reserveDrivers: ['Antonio Giovinazzi'],
  },
  {
    name: 'Mercedes',
    fullName: 'Mercedes-AMG Petronas F1 Team',
    constructorId: 'mercedes',
    color: '#00D2BE',
    nationality: 'German',
    flag: '🇩🇪',
    base: 'Brackley, Reino Unido',
    powerUnit: 'Mercedes',
    technicalDirector: 'James Allison',
    teamPrincipal: 'Toto Wolff',
    ceo: 'Toto Wolff',
    firstSeason: 1954,
    championships: 8,
    description: 'La dinastía que dominó la F1 entre 2014 y 2021. Tras años de dificultades con los reglamentos de 2022, Mercedes confía en que los motores completamente nuevos de 2026 los devuelvan a la cima.',
    drivers: [
      { name: 'George Russell', number: 63, nationality: 'Británico', flag: '🇬🇧', dob: '1998-02-15', championships: 0, podiums: 22, role: 'titular' },
      { name: 'Kimi Antonelli', number: 12, nationality: 'Italiano', flag: '🇮🇹', dob: '2006-08-25', championships: 0, podiums: 3, role: 'titular' },
    ],
    reserveDrivers: ['Frederik Vesti'],
  },
  {
    name: 'Red Bull',
    fullName: 'Oracle Red Bull Racing',
    constructorId: 'red_bull',
    color: '#3671C6',
    nationality: 'Austrian',
    flag: '🇦🇹',
    base: 'Milton Keynes, Reino Unido',
    powerUnit: 'Red Bull Ford',
    technicalDirector: 'Pierre Waché',
    teamPrincipal: 'Laurent Mekies',
    ceo: 'Laurent Mekies',
    firstSeason: 2005,
    championships: 6,
    description: 'Cuatro títulos consecutivos con Verstappen entre 2021 y 2024. Red Bull tuvo un 2025 más difícil y ahora apuesta por Hadjar junto a Verstappen para recuperar el dominio bajo las nuevas regulaciones.',
    drivers: [
      { name: 'Max Verstappen', number: 1, nationality: 'Neerlandés', flag: '🇳🇱', dob: '1997-09-30', championships: 4, podiums: 112, role: 'titular' },
      { name: 'Isack Hadjar', number: 6, nationality: 'Francés', flag: '🇫🇷', dob: '2004-02-28', championships: 0, podiums: 1, role: 'titular' },
    ],
    reserveDrivers: ['Yuki Tsunoda'],
  },
  {
    name: 'Aston Martin',
    fullName: 'Aston Martin Aramco F1 Team',
    constructorId: 'aston_martin',
    color: '#229971',
    nationality: 'British',
    flag: '🇬🇧',
    base: 'Silverstone, Reino Unido',
    powerUnit: 'Honda',
    technicalDirector: 'Enrico Cardile',
    teamPrincipal: 'Adrian Newey',
    ceo: 'Lawrence Stroll',
    firstSeason: 2021,
    championships: 0,
    description: 'El proyecto de Lawrence Stroll sigue creciendo. Con la llegada de Adrian Newey como director técnico en 2025 y la continuidad de Alonso, el equipo apuesta fuerte por dar el salto definitivo en 2026.',
    drivers: [
      { name: 'Fernando Alonso', number: 14, nationality: 'Español', flag: '🇪🇸', dob: '1981-07-29', championships: 2, podiums: 106, role: 'titular' },
      { name: 'Lance Stroll', number: 18, nationality: 'Canadiense', flag: '🇨🇦', dob: '1998-10-29', championships: 0, podiums: 3, role: 'titular' },
    ],
    reserveDrivers: ['Jak Crawford'],
  },
  {
    name: 'Alpine',
    fullName: 'BWT Alpine F1 Team',
    constructorId: 'alpine',
    color: '#0093CC',
    nationality: 'French',
    flag: '🇫🇷',
    base: 'Enstone, Reino Unido',
    powerUnit: 'Mercedes',
    technicalDirector: 'David Sanchez',
    teamPrincipal: 'Steve Nielsen',
    ceo: 'Flavio Briatore',
    firstSeason: 1977,
    championships: 2,
    description: 'El equipo francés atraviesa una profunda reestructuración. La llegada de Franco Colapinto junto a Gasly aporta frescura y un nombre que genera expectativa, especialmente entre los aficionados latinoamericanos.',
    drivers: [
      { name: 'Pierre Gasly', number: 10, nationality: 'Francés', flag: '🇫🇷', dob: '1996-02-07', championships: 0, podiums: 4, role: 'titular' },
      { name: 'Franco Colapinto', number: 43, nationality: 'Argentino', flag: '🇦🇷', dob: '2003-05-27', championships: 0, podiums: 0, role: 'titular' },
    ],
    reserveDrivers: ['Paul Aron'],
  },
  {
    name: 'Haas',
    fullName: 'MoneyGram Haas F1 Team',
    constructorId: 'haas',
    color: '#B6BABD',
    nationality: 'American',
    flag: '🇺🇸',
    base: 'Kannapolis, Estados Unidos',
    powerUnit: 'Ferrari',
    technicalDirector: 'Andrea De Zordo',
    teamPrincipal: 'Ayao Komatsu',
    ceo: 'Gene Haas',
    firstSeason: 2016,
    championships: 0,
    description: 'El único equipo americano de la parrilla antes de Cadillac. Con Ocon y Bearman, Haas tiene una dupla con hambre de demostrar su valía. El equipo busca consolidarse en la zona de puntos.',
    drivers: [
      { name: 'Esteban Ocon', number: 31, nationality: 'Francés', flag: '🇫🇷', dob: '1996-09-17', championships: 0, podiums: 3, role: 'titular' },
      { name: 'Oliver Bearman', number: 87, nationality: 'Británico', flag: '🇬🇧', dob: '2005-05-08', championships: 0, podiums: 0, role: 'titular' },
    ],
    reserveDrivers: ['Jack Doohan y el piloto japonés Ryō Hirakawa'],
  },
  {
    name: 'Racing Bulls',
    fullName: 'Visa Cash App Racing Bulls F1 Team',
    constructorId: 'rb',
    color: '#6692FF',
    nationality: 'Italian',
    flag: '🇮🇹',
    base: 'Faenza, Italia',
    powerUnit: 'Red Bull Ford',
    technicalDirector: 'Dan Fallows',
    teamPrincipal: 'Alan Permane',
    firstSeason: 2006,
    championships: 0,
    description: 'La academia de Red Bull en la parrilla. Lawson busca consolidarse tras su debut en 2024, mientras que Lindblad, el único rookie de 2026, llega con enorme expectativa tras su dominio en categorías junior.',
    drivers: [
      { name: 'Liam Lawson', number: 30, nationality: 'Neozelandés', flag: '🇳🇿', dob: '2002-02-11', championships: 0, podiums: 0, role: 'titular' },
      { name: 'Arvid Lindblad', number: 5, nationality: 'Británico', flag: '🇬🇧', dob: '2007-06-17', championships: 0, podiums: 0, role: 'titular' },
    ],
    reserveDrivers: ['Ayumu Iwasa'],
  },
  {
    name: 'Williams',
    fullName: 'Williams Racing',
    constructorId: 'williams',
    color: '#00A3E0',
    nationality: 'British',
    flag: '🇬🇧',
    base: 'Grove, Reino Unido',
    powerUnit: 'Mercedes',
    technicalDirector: 'Pat Fry',
    teamPrincipal: 'James Vowles',
    firstSeason: 1977,
    championships: 9,
    description: 'Uno de los equipos más históricos de la F1. Bajo la dirección de Vowles, Williams está en plena reconstrucción. Sainz llega para liderar el proyecto con su experiencia y Albon continúa siendo una pieza clave.',
    drivers: [
      { name: 'Alexander Albon', number: 23, nationality: 'Tailandés', flag: '🇹🇭', dob: '1996-03-23', championships: 0, podiums: 2, role: 'titular' },
      { name: 'Carlos Sainz', number: 55, nationality: 'Español', flag: '🇪🇸', dob: '1994-09-01', championships: 0, podiums: 23, role: 'titular' },
    ],
    reserveDrivers: ['Luke Browning'],
  },
  {
    name: 'Audi',
    fullName: 'Audi F1 Team',
    constructorId: 'sauber',
    color: '#C00000',
    nationality: 'German',
    flag: '🇩🇪',
    base: 'Hinwil, Suiza',
    powerUnit: 'Audi',
    technicalDirector: 'James Key',
    teamPrincipal: 'Mattia Binotto',
    ceo: 'Mattia Binotto',
    firstSeason: 2026,
    championships: 0,
    description: 'El gigante alemán de Ingolstadt toma el control de la histórica estructura de Sauber. Con motor propio desde 2026, Audi entra con ambición a largo plazo. Hülkenberg y Bortoleto encabezan el proyecto.',
    drivers: [
      { name: 'Nico Hülkenberg', number: 27, nationality: 'Alemán', flag: '🇩🇪', dob: '1987-08-19', championships: 0, podiums: 0, role: 'titular' },
      { name: 'Gabriel Bortoleto', number: 5, nationality: 'Brasileño', flag: '🇧🇷', dob: '2004-10-14', championships: 0, podiums: 0, role: 'titular' },
    ],
    reserveDrivers: ['Freddie Slater'],
  },
  {
    name: 'Cadillac',
    fullName: 'Cadillac F1 Team',
    constructorId: 'cadillac',
    color: '#CC0000',
    nationality: 'American',
    flag: '🇺🇸',
    base: 'Concord, Estados Unidos',
    powerUnit: 'Ferrari',
    technicalDirector: 'Nick Chester',
    teamPrincipal: 'Graeme Lowdon',
    firstSeason: 2026,
    championships: 0,
    description: 'El undécimo equipo de la parrilla y el primero nuevo en más de una década. Cadillac llega con el respaldo de General Motors y una alineación de pilotos experimentados en Pérez y Bottas para su temporada debut.',
    drivers: [
      { name: 'Sergio Pérez', number: 11, nationality: 'Mexicano', flag: '🇲🇽', dob: '1990-01-26', championships: 0, podiums: 41, role: 'titular' },
      { name: 'Valtteri Bottas', number: 77, nationality: 'Finlandés', flag: '🇫🇮', dob: '1989-08-28', championships: 0, podiums: 67, role: 'titular' },
    ],
    reserveDrivers: ['Zhou Guanyu'],
  },
]