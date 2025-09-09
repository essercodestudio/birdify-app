export interface Player {
  id: string;
  fullName: string;
  handicapIndex: number;
  cpf: string;
  email: string;
}

export interface Admin {
  id: string;
  email: string;
  fullName: string;
  superAdmin: boolean;
}

// FIX: Redefined `User` as a discriminated union to ensure type safety.
// This guarantees that any User has an `email` for authentication and a distinct `role`,
// which resolves the error when accessing `user.email` in the login logic.
export type User = (Player & { role: 'player' }) | (Admin & { role: 'admin' });

export interface Hole {
  holeNumber: number;
  par: number;
  strokeIndex?: number;
}

export interface Course {
  id: string;
  name: string;
  location: string;
  holes: Hole[];
}

export type RankingMode = 'NET' | 'GROSS';
export type TournamentStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  courseId: string;
  rankingMode: RankingMode;
  status: TournamentStatus;
}

export interface Score {
  playerId: string;
  holeNumber: number;
  strokes: number | null;
}

export interface GroupPlayer extends Player {
  courseHandicap: number;
}

export interface Group {
  id: string;
  tournamentId: string;
  name: string;
  startHole: number;
  accessCode: string;
  scorerPlayerId: string;
  players: GroupPlayer[];
  scores: Score[];
  status: 'pending' | 'submitted' | 'approved' | 'adjust_requested';
}

export interface LeaderboardPlayer {
    playerId: string;
    fullName: string;
    courseHandicap: number;
    scores: Score[];
    grossTotal: number;
    netTotal: number;
    toParGross: number;
    toParNet: number;
    through: number;
}