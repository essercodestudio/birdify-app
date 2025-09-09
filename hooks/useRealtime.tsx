
import { useEffect, useState, useCallback } from 'react';
import { LeaderboardPlayer, Group, Course } from '../types';
import { realtime } from '../services/supabaseMock';

export const useRealtimeLeaderboard = (tournamentId: string, initialData: LeaderboardPlayer[]) => {
    const [data, setData] = useState<LeaderboardPlayer[]>(initialData);

    useEffect(() => {
        const unsubscribe = realtime.subscribeToLeaderboard(tournamentId, (payload) => {
            setData(payload);
        });

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId]);

    return data;
};


export const useRealtimeScorecard = (accessCode: string, initialData: { group: Group, course: Course } | null) => {
    const [data, setData] = useState<{ group: Group, course: Course } | null>(initialData);
    
    useEffect(() => {
        if (!accessCode) return;
        
        const unsubscribe = realtime.subscribeToScorecard(accessCode, (payload) => {
            setData(payload);
        });

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessCode]);
    
    return data;
};
