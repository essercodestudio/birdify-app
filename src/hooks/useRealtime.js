import { useEffect, useState } from 'react';
import { realtime } from '../services/supabaseMock';

export const useRealtimeLeaderboard = (tournamentId, initialData) => {
    const [data, setData] = useState(initialData);

    useEffect(() => {
        // Atualiza o estado inicial quando ele mudar
        setData(initialData);
    }, [initialData]);

    useEffect(() => {
        if (!tournamentId) return;
        const unsubscribe = realtime.subscribeToLeaderboard(tournamentId, (payload) => {
            setData(payload);
        });

        return () => unsubscribe();
    }, [tournamentId]);

    return data;
};


export const useRealtimeScorecard = (accessCode, initialData) => {
    const [data, setData] = useState(initialData);
    
    useEffect(() => {
        // Atualiza o estado inicial quando ele mudar
        setData(initialData);
    }, [initialData]);

    useEffect(() => {
        if (!accessCode) return;
        
        const unsubscribe = realtime.subscribeToScorecard(accessCode, (payload) => {
            setData(payload);
        });

        return () => unsubscribe();
    }, [accessCode]);
    
    return data;
};