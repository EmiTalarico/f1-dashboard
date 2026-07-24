export type DriverStanding = {
  position: string
  points: string
  wins: string
  Driver: { driverId: string; givenName: string; familyName: string; nationality: string }
  Constructors: { name: string; constructorId: string }[]
}

export type ConstructorStanding = {
  position: string
  points: string
  wins: string
  Constructor: { constructorId: string; name: string; nationality: string }
}

export type RaceResultEntry = {
  position: string
  points: string
  status: string
  Driver: { driverId: string; familyName: string; givenName: string }
  Constructor: { name: string; constructorId: string }
}

export type RaceResult = {
  round: string
  raceName: string
  date: string
  Results: RaceResultEntry[]
}