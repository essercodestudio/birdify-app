// Define types that match the relational structure for the admin panel
export interface AdminTee {
  id: string;
  holeId: string;
  color: 'Azul' | 'Branco' | 'Vermelho' | 'Dourado';
  yardage: number;
}
export interface AdminCourse {
  id: string;
  name: string;
  location: string;
  aerialImageUrl?: string;
}

export interface AdminHole {
  id: string;
  courseId: string;
  holeNumber: number;
  par: number;
  strokeIndex: number;
}

export interface AdminTournament {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  courseId: string;
}

export interface AdminPlayer {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
}

export interface AdminGroup {
  id: string;
  tournamentId: string;
  startHole: number;
  accessCode: string;
}

export interface AdminGroupPlayer {
  id: string; // unique ID for this relationship
  groupId: string;
  playerId: string;
  isResponsible: boolean;
  teeId?: string;
}


const initialCourses: AdminCourse[] = [
  { id: 'c1', name: 'Pebble Beach', location: 'California, USA', aerialImageUrl: 'https://images.unsplash.com/photo-1595759904285-5a55d81756a3?q=80&w=2070&auto=format&fit=crop' },
  { id: 'c2', name: 'St Andrews Links', location: 'St Andrews, Scotland' },
];

const initialHoles: AdminHole[] = [
  // Holes for Pebble Beach (c1)
  { id: 'h1', courseId: 'c1', holeNumber: 1, par: 4, strokeIndex: 7 },
  { id: 'h2', courseId: 'c1', holeNumber: 2, par: 5, strokeIndex: 11 },
  { id: 'h3', courseId: 'c1', holeNumber: 3, par: 3, strokeIndex: 17 },
  { id: 'h4', courseId: 'c1', holeNumber: 4, par: 4, strokeIndex: 1 },
  { id: 'h5', courseId: 'c1', holeNumber: 5, par: 4, strokeIndex: 13 },
  { id: 'h6', courseId: 'c1', holeNumber: 6, par: 3, strokeIndex: 15 },
  { id: 'h7', courseId: 'c1', holeNumber: 7, par: 5, strokeIndex: 5 },
  { id: 'h8', courseId: 'c1', holeNumber: 8, par: 4, strokeIndex: 3 },
  { id: 'h9', courseId: 'c1', holeNumber: 9, par: 4, strokeIndex: 9 },
  { id: 'h10', courseId: 'c1', holeNumber: 10, par: 4, strokeIndex: 8 },
  { id: 'h11', courseId: 'c1', holeNumber: 11, par: 5, strokeIndex: 12 },
  { id: 'h12', courseId: 'c1', holeNumber: 12, par: 3, strokeIndex: 18 },
  { id: 'h13', courseId: 'c1', holeNumber: 13, par: 4, strokeIndex: 2 },
  { id: 'h14', courseId: 'c1', holeNumber: 14, par: 4, strokeIndex: 14 },
  { id: 'h15', courseId: 'c1', holeNumber: 15, par: 3, strokeIndex: 16 },
  { id: 'h16', courseId: 'c1', holeNumber: 16, par: 5, strokeIndex: 6 },
  { id: 'h17', courseId: 'c1', holeNumber: 17, par: 4, strokeIndex: 4 },
  { id: 'h18', courseId: 'c1', holeNumber: 18, par: 4, strokeIndex: 10 },
];

const initialTees: AdminTee[] = [
    { id: 't1', holeId: 'h1', color: 'Azul', yardage: 377 },
    { id: 't2', holeId: 'h1', color: 'Branco', yardage: 360 },
    { id: 't3', holeId: 'h1', color: 'Vermelho', yardage: 330 },
    { id: 't8', holeId: 'h1', color: 'Dourado', yardage: 310 },
    { id: 't4', holeId: 'h2', color: 'Azul', yardage: 511 },
    { id: 't5', holeId: 'h2', color: 'Branco', yardage: 480 },
    { id: 't6', holeId: 'h7', color: 'Azul', yardage: 109 },
    { id: 't7', holeId: 'h7', color: 'Branco', yardage: 95 },
];

const initialTournaments: AdminTournament[] = [
  { id: 't1', name: 'Pine Hill Open 2024', date: '2024-07-21', courseId: 'c1' },
  { id: 't2', name: 'The Grand Invitational', date: '2024-08-15', courseId: 'c2' },
];

const initialPlayers: AdminPlayer[] = [
    { id: 'p1', fullName: 'Jordan Spieth', cpf: '111.222.333-44', email: 'jordan@example.com' },
    { id: 'p2', fullName: 'Scottie Scheffler', cpf: '222.333.444-55', email: 'scottie@example.com' },
    { id: 'p3', fullName: 'Rory McIlroy', cpf: '333.444.555-66', email: 'rory@example.com' },
    { id: 'p4', fullName: 'Jon Rahm', cpf: '444.555.666-77', email: 'jon@example.com' },
    { id: 'p5', fullName: 'Justin Thomas', cpf: '555.666.777-88', email: 'justin@example.com' },
    { id: 'p6', fullName: 'Collin Morikawa', cpf: '666.777.888-99', email: 'collin@example.com' },
    { id: 'p7', fullName: 'Dustin Johnson', cpf: '777.888.999-00', email: 'dustin@example.com' },
    { id: 'p8', fullName: 'Brooks Koepka', cpf: '888.999.000-11', email: 'brooks@example.com' },
];

const initialGroups: AdminGroup[] = [];
const initialGroupPlayers: AdminGroupPlayer[] = [];


export const db = {
  courses: initialCourses,
  holes: initialHoles,
  tees: initialTees,
  tournaments: initialTournaments,
  players: initialPlayers,
  groups: initialGroups,
  groupPlayers: initialGroupPlayers,
};