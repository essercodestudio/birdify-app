import { User, Tournament, Group, Score, LeaderboardPlayer, Course, Hole, Player } from '../types';
import { db as adminDb, AdminPlayer } from '../data/mockDatabase';

// --- MOCK DATABASE ---

const MOCK_PLAYERS: Player[] = [
    { id: 'p1', fullName: 'Jordan Spieth', handicapIndex: 2.1, email: 'scorer@pinehillscore.com', cpf: '111.222.333-44' },
    { id: 'p2', fullName: 'Scottie Scheffler', handicapIndex: 0.5, email: 'scottie@example.com', cpf: '222.333.444-55' },
    { id: 'p3', fullName: 'Rory McIlroy', handicapIndex: 1.2, email: 'rory@example.com', cpf: '333.444.555-66' },
    { id: 'p4', fullName: 'Jon Rahm', handicapIndex: 0.8, email: 'jon@example.com', cpf: '444.555.666-77' },
    { id: 'p5', fullName: 'Justin Thomas', handicapIndex: 3.4, email: 'justin@example.com', cpf: '555.666.777-88' },
    { id: 'p6', fullName: 'Collin Morikawa', handicapIndex: 1.5, email: 'collin@example.com', cpf: '666.777.888-99' },
];

const MOCK_ADMINS: User[] = [
    { id: 'a1', email: 'admin@pinehillscore.com', fullName: 'Admin User', role: 'admin', superAdmin: true },
];

const MOCK_USERS: User[] = [
    ...MOCK_ADMINS,
    { ...MOCK_PLAYERS.find(p => p.id === 'p1')!, role: 'player' },
];


const MOCK_COURSE_HOLES: Hole[] = [
    { holeNumber: 1, par: 4, strokeIndex: 7 }, { holeNumber: 2, par: 5, strokeIndex: 11 },
    { holeNumber: 3, par: 3, strokeIndex: 17 }, { holeNumber: 4, par: 4, strokeIndex: 1 },
    { holeNumber: 5, par: 4, strokeIndex: 13 }, { holeNumber: 6, par: 3, strokeIndex: 15 },
    { holeNumber: 7, par: 5, strokeIndex: 5 }, { holeNumber: 8, par: 4, strokeIndex: 3 },
    { holeNumber: 9, par: 4, strokeIndex: 9 }, { holeNumber: 10, par: 4, strokeIndex: 8 },
    { holeNumber: 11, par: 5, strokeIndex: 12 }, { holeNumber: 12, par: 3, strokeIndex: 18 },
    { holeNumber: 13, par: 4, strokeIndex: 2 }, { holeNumber: 14, par: 4, strokeIndex: 14 },
    { holeNumber: 15, par: 3, strokeIndex: 16 }, { holeNumber: 16, par: 5, strokeIndex: 6 },
    { holeNumber: 17, par: 4, strokeIndex: 4 }, { holeNumber: 18, par: 4, strokeIndex: 10 },
];

const MOCK_COURSE: Course = {
    id: 'c1', name: 'Pebble Beach', location: 'California, USA', holes: MOCK_COURSE_HOLES
};

const MOCK_TOURNAMENT: Tournament = {
    id: 't1', name: 'Pine Hill Open 2024', date: '2024-07-21', courseId: 'c1', rankingMode: 'NET', status: 'IN_PROGRESS'
};

const MOCK_SCORES: Score[] = [];

const MOCK_GROUPS: Group[] = [
    {
        id: 'g1', tournamentId: 't1', name: 'Aces', startHole: 1, accessCode: '12345', scorerPlayerId: 'p1', status: 'pending',
        players: [
            { ...MOCK_PLAYERS[0], courseHandicap: 2 },
            { ...MOCK_PLAYERS[1], courseHandicap: 1 },
            { ...MOCK_PLAYERS[2], courseHandicap: 1 },
            { ...MOCK_PLAYERS[3], courseHandicap: 1 },
        ],
        scores: MOCK_SCORES,
    },
];

// --- REALTIME SIMULATION ---
type EventType = 'leaderboard' | 'scorecard';
type Listener = (data: any) => void;
const listeners: Record<EventType, Listener[]> = {
    leaderboard: [],
    scorecard: [],
};

const subscribe = (event: EventType, listener: Listener) => {
    listeners[event].push(listener);
    // Return an unsubscribe function
    return () => {
        listeners[event] = listeners[event].filter(l => l !== listener);
    };
};

const broadcast = (event: EventType, data: any) => {
    listeners[event].forEach(listener => listener(data));
};


// --- MOCK API FUNCTIONS ---

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const auth = {
    login: async (email: string): Promise<{ user: User | null; error: string | null }> => {
        await delay(500);
        const user = MOCK_USERS.find(u => u.email === email);
        if (user) {
            return { user, error: null };
        }
        return { user: null, error: 'Credenciais inválidas' };
    },
    register: async (playerData: Omit<Player, 'id' | 'handicapIndex'>): Promise<{ user: User | null; error: string | null }> => {
        await delay(500);
        if (MOCK_USERS.find(u => u.email === playerData.email)) {
            return { user: null, error: 'Este e-mail já está em uso.' };
        }

        const newPlayer: Player = {
            ...playerData,
            id: `p${Date.now()}`,
            handicapIndex: 18.0, // Default handicap for new players
        };
        MOCK_PLAYERS.push(newPlayer);
        
        const newUser: User = { ...newPlayer, role: 'player' };
        MOCK_USERS.push(newUser);

        // Also add to the admin panel's mock DB for consistency
        const newAdminPlayer: AdminPlayer = {
            id: newPlayer.id,
            fullName: newPlayer.fullName,
            cpf: newPlayer.cpf,
            email: newPlayer.email,
        };
        adminDb.players.push(newAdminPlayer);
        
        return { user: newUser, error: null };
    }
};

// FIX: Corrected the return type for `error` from the literal `'string'` to the type `string`.
export const getTournamentLeaderboard = async (tournamentId: string): Promise<{ data: LeaderboardPlayer[]; error: string | null }> => {
    await delay(300);
    if (tournamentId !== MOCK_TOURNAMENT.id) {
        return { data: [], error: 'Torneio não encontrado' };
    }

    const allPlayersInTournament = MOCK_GROUPS
        .filter(g => g.tournamentId === tournamentId)
        .flatMap(g => g.players);

    const totalParUpTo18 = MOCK_COURSE.holes.reduce((sum, hole) => sum + hole.par, 0);

    const leaderboard: LeaderboardPlayer[] = allPlayersInTournament.map(player => {
        const playerScores = MOCK_SCORES.filter(s => s.playerId === player.id);
        const grossTotal = playerScores.reduce((sum, score) => sum + (score.strokes || 0), 0);
        const netTotal = grossTotal - player.courseHandicap;
        const playedHoles = MOCK_COURSE.holes.filter(h => playerScores.some(s => s.holeNumber === h.holeNumber && s.strokes !== null));
        const parForPlayedHoles = playedHoles.reduce((sum, hole) => sum + hole.par, 0);

        return {
            playerId: player.id,
            fullName: player.fullName,
            courseHandicap: player.courseHandicap,
            scores: playerScores,
            grossTotal,
            netTotal,
            toParGross: grossTotal - parForPlayedHoles,
            toParNet: netTotal - parForPlayedHoles, // This is a simplified net calc
            through: playedHoles.length,
        };
    });

    return { data: leaderboard, error: null };
};

export const getGroupForScorer = async (accessCode: string): Promise<{ data: { group: Group, course: Course } | null, error: string | null }> => {
    await delay(400);
    const group = MOCK_GROUPS.find(g => g.accessCode === accessCode);
    if (!group) {
        return { data: null, error: 'Código de acesso inválido' };
    }
    return { data: { group, course: MOCK_COURSE }, error: null };
};

export const getCourse = async (courseId: string): Promise<{ data: Course | null, error: string | null}> => {
    await delay(200);
    if(courseId === MOCK_COURSE.id) {
        // Return a deep copy to prevent mutation issues in mock DB
        return { data: JSON.parse(JSON.stringify(MOCK_COURSE)), error: null };
    }
    return { data: null, error: 'Campo não encontrado' };
}

export const updateCourseHoles = async (courseId: string, holes: Hole[]): Promise<{ success: boolean }> => {
    await delay(500);
    if(courseId === MOCK_COURSE.id) {
        MOCK_COURSE.holes = holes;
        return { success: true };
    }
    return { success: false };
}

export const updateScore = async (groupId: string, playerId: string, holeNumber: number, strokes: number): Promise<{ success: boolean }> => {
    await delay(200);
    const group = MOCK_GROUPS.find(g => g.id === groupId);
    if (!group) return { success: false };

    let score = MOCK_SCORES.find(s => s.playerId === playerId && s.holeNumber === holeNumber);
    if (score) {
        score.strokes = strokes;
    } else {
        MOCK_SCORES.push({ playerId, holeNumber, strokes });
    }

    // BROADCAST an update to all listeners
    const updatedLeaderboard = await getTournamentLeaderboard(group.tournamentId);
    broadcast('leaderboard', updatedLeaderboard.data);
    
    const updatedGroup = await getGroupForScorer(group.accessCode);
    broadcast('scorecard', updatedGroup.data);

    return { success: true };
};


export const realtime = {
    subscribeToLeaderboard: (tournamentId: string, callback: (payload: LeaderboardPlayer[]) => void) => {
        return subscribe('leaderboard', callback);
    },
    subscribeToScorecard: (accessCode: string, callback: (payload: { group: Group, course: Course }) => void) => {
        return subscribe('scorecard', callback);
    }
};