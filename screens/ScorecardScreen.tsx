// screens/ScorecardScreen.tsx - VERSÃO COMPLETA E CORRIGIDA

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import PlusIcon from '../components/icons/PlusIcon';
import MinusIcon from '../components/icons/MinusIcon';
import LeaderboardScreen from './LeaderboardScreen'; 
import PhotoIcon from '../components/icons/PhotoIcon';

interface ScorecardScreenProps { accessCode: string; onBack: () => void; isEditingMode?: boolean; }
interface PlayerData { id: number; fullName: string; teeColor: string; }
interface ScoreData { playerId: number; holeNumber: number; strokes: number; }
interface TeeData { id: number; holeId: number; color: string; yardage: number; }
interface HoleData { id: number; courseId: number; holeNumber: number; par: number; aerialImageUrl: string | null; tees: TeeData[]; }
interface ScorecardData {
    groupId: number;
    startHole: number;
    tournamentId: number;
    tournamentName: string;
    courseName: string;
    players: PlayerData[];
    scores: ScoreData[];
    holes: HoleData[];
    status: string;
}
const teeColorStyles: { [key: string]: string } = {
    Gold: 'border-yellow-400 text-yellow-400',
    Blue: 'border-blue-500 text-blue-500',
    White: 'border-white text-white',
    Red: 'border-red-500 text-red-500',
};

const ScorecardScreen: React.FC<ScorecardScreenProps> = ({ accessCode, onBack, isEditingMode = false }) => {
    const [data, setData] = useState<ScorecardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentHole, setCurrentHole] = useState(1);
    const [localScores, setLocalScores] = useState<Record<string, Record<number, number | null>>>({});
    const [highestPlayableHole, setHighestPlayableHole] = useState(1);
    const [view, setView] = useState<'SCORECARD' | 'LEADERBOARD' | 'SUMMARY'>('SCORECARD');
    const [isEditing, setIsEditing] = useState(isEditingMode);
    const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

    const isHoleComplete = (hole: number, scores: Record<string, Record<number, number | null>>, players: PlayerData[]): boolean => { 
        if (!players) return false;
        return players.every(player => {
            const score = scores[player.id]?.[hole];
            return typeof score === 'number' && score > 0;
        });
    };

    const fetchScorecardData = useCallback(async () => { 
        try {
            setLoading(true);
            const response = await axios.get<ScorecardData>(`http://localhost:3001/api/scorecard/${accessCode}`);
            const groupData = response.data;
            setData(groupData);
            setCurrentHole(groupData.startHole);
            const scoresMap: Record<string, Record<number, number | null>> = {};
            groupData.players.forEach(p => {
              scoresMap[p.id] = {};
            });
            groupData.scores.forEach(s => {
              if (scoresMap[s.playerId]) {
                scoresMap[s.playerId][s.holeNumber] = s.strokes;
              }
            });
            setLocalScores(scoresMap);

            if (isEditingMode || groupData.status === 'completed') {
                setIsEditing(true);
                setHighestPlayableHole(18);
                if (groupData.status === 'completed') setView('SUMMARY');
            } else {
                let lastCompletedHole = groupData.startHole - 1;
                for (let i = groupData.startHole; i <= 18; i++) {
                    if (isHoleComplete(i, scoresMap, groupData.players)) {
                        lastCompletedHole = i;
                    } else {
                        break;
                    }
                }
                setHighestPlayableHole(lastCompletedHole + 1);
            }
            setError(null);
          } catch (err: any) {
              setError('Não foi possível carregar os dados do scorecard.');
          } finally {
            setLoading(false);
          }
    }, [accessCode, isEditingMode]);

    useEffect(() => {
        fetchScorecardData();
    }, [fetchScorecardData]);

    const handleScoreChange = (playerId: number, hole: number, change: number) => { 
        const currentStrokes = localScores[playerId]?.[hole];
        let newStrokes;
        if (currentStrokes) {
            newStrokes = Math.max(1, currentStrokes + change);
        } else {
            newStrokes = change > 0 ? 1 : null;
        }
        if (newStrokes === null) return;
        const newLocalScores = JSON.parse(JSON.stringify(localScores));
        newLocalScores[playerId][hole] = newStrokes;
        setLocalScores(newLocalScores);
    };

    const handleConfirmHole = async () => { 
        if (!data || !isHoleComplete(currentHole, localScores, data.players)) {
            return alert("Preencha a pontuação de todos os jogadores para confirmar.");
        }
        const scoresToSubmit = data.players.map(player => ({
            playerId: player.id,
            strokes: localScores[player.id][currentHole]
        }));
        try {
            await axios.post('http://localhost:3001/api/scores/hole', {
                groupId: data.groupId,
                holeNumber: currentHole,
                scores: scoresToSubmit
            });
            if (currentHole === highestPlayableHole && currentHole < 18) {
                setHighestPlayableHole(currentHole + 1);
            }
            if (currentHole === 18) {
                setView('SUMMARY');
            } else {
                alert(`Pontuações do buraco ${currentHole} confirmadas e salvas!`);
            }
        } catch (error) {
            setError("Não foi possível salvar as pontuações.");
        }
    };
    
    const handleFinishRound = async () => {
        if (!data) return;
        const confirmationMessage = isEditing ? 'Tem a certeza de que quer salvar as alterações?' : 'Tem a certeza de que quer finalizar a rodada? Não será possível fazer mais alterações.';
        
        if(window.confirm(confirmationMessage)) {
            try {
                for(let i=1; i<=18; i++){
                    if(isHoleComplete(i, localScores, data.players)){
                        const scoresToSubmit = data.players.map(player => ({
                            playerId: player.id,
                            strokes: localScores[player.id][i]
                        }));
                        await axios.post('http://localhost:3001/api/scores/hole', {
                            groupId: data.groupId,
                            holeNumber: i,
                            scores: scoresToSubmit
                        });
                    }
                }
                if (!isEditing) {
                    await axios.post('http://localhost:3001/api/groups/finish', { groupId: data.groupId });
                }
                onBack();
            } catch (error) {
                alert('Não foi possível finalizar a rodada.');
            }
        }
    };

    const changeHole = (direction: number) => { 
        const newHole = currentHole + direction;
        if (isEditing) {
            if (newHole >= 1 && newHole <= 18) setCurrentHole(newHole);
        } else {
            if ((direction < 0 && newHole >= data!.startHole) || (direction > 0 && newHole <= highestPlayableHole && newHole <= 18)) {
              setCurrentHole(newHole);
            }
        }
    };

    const currentHoleInfo = useMemo(() => {
        return data?.holes.find(h => h.holeNumber === currentHole);
    }, [data, currentHole]);

    const totals = useMemo(() => {
        if (!data) return [];
        return data.players.map(player => {
            const totalStrokes = Object.values(localScores[player.id] || {}).reduce((sum: number, strokes: number | null) => sum + (strokes || 0), 0);
            return { ...player, total: totalStrokes };
        });
    }, [data, localScores]);

    if (loading) return <Spinner />;
    if (error) return <div className="text-red-400 text-center p-6 bg-red-900/50 rounded-lg">{error}</div>;
    if (!data) return <p className="text-gray-400 text-center">Nenhum dado disponível.</p>;

    if (view === 'LEADERBOARD') {
        return <LeaderboardScreen tournamentId={data.tournamentId.toString()} onBack={() => setView('SCORECARD')} />;
    }

    if (view === 'SUMMARY') {
        return (
            <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
                <h1 className="text-3xl font-bold text-white mb-2">Resumo da Rodada</h1>
                <p className="text-gray-400 mb-6">{data.tournamentName}</p>
                <div className="space-y-3">
                    {totals.map(player => (
                        <div key={player.id} className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                            <span className="font-bold text-white">{player.fullName}</span>
                            <span className="text-2xl font-bold text-green-400">{player.total}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                    <Button onClick={handleFinishRound} className="w-full">
                        {isEditing ? 'Confirmar Alterações' : 'Confirmar e Finalizar Rodada'}
                    </Button>
                    <Button onClick={() => { setIsEditing(true); setView('SCORECARD'); }} variant="secondary" className="w-full">
                        Alterar Marcação
                    </Button>
                </div>
            </div>
        );
    }

    const isHoleLocked = !isEditing && currentHole < highestPlayableHole;

    return (
        <>
            {modalImageUrl && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
                    onClick={() => setModalImageUrl(null)}
                >
                    <img src={`http://localhost:3001${modalImageUrl}`} alt={`Visão aérea do buraco ${currentHoleInfo?.holeNumber}`} className="max-w-[90%] max-h-[90%] object-contain rounded-lg"/>
                </div>
            )}
            <div className="bg-gray-800 p-4 rounded-lg shadow-xl flex flex-col h-[calc(100vh-10rem)]">
                <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                    <Button onClick={onBack} variant="secondary" size="sm">
                        <ChevronLeftIcon className="h-5 w-5 mr-1"/> Início
                    </Button>
                    <h2 className="text-xl font-bold text-center">{data.tournamentName}</h2>
                    <Button onClick={() => setView('LEADERBOARD')} size="sm">
                        Ver Leaderboard
                    </Button>
                </div>
                <div className="flex items-center justify-between p-4 my-4 bg-gray-900 rounded-lg">
                    <Button size="icon" onClick={() => changeHole(-1)} disabled={!isEditing && currentHole === data.startHole}>
                        <ChevronLeftIcon className="h-6 w-6"/>
                    </Button>
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">BURACO</p>
                        <p className="text-4xl font-bold text-white">{currentHoleInfo?.holeNumber}</p>
                        <div className="text-gray-400 flex items-center justify-center gap-x-4 mt-1">
                            <span className="font-bold">PAR {currentHoleInfo?.par}</span>
                            {currentHoleInfo?.aerialImageUrl && (
                                <button onClick={() => setModalImageUrl(currentHoleInfo.aerialImageUrl!)}>
                                    <PhotoIcon className="h-5 w-5 text-blue-400 hover:text-blue-300"/>
                                </button>
                            )}
                        </div>
                        {/* JARDAS RESTAURADAS */}
                        <div className="hidden sm:flex justify-center gap-x-3 items-center mt-1">
                            {currentHoleInfo?.tees.map(tee => (
                                <div key={tee.id} className="flex items-center gap-x-1">
                                    <div className={`w-2 h-2 rounded-full ${teeColorStyles[tee.color]?.replace('text-', 'bg-').split(' ')[0]}`}></div>
                                    <span className={`text-xs font-semibold ${teeColorStyles[tee.color]}`}>
                                        {tee.yardage}j
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Button size="icon" onClick={() => changeHole(1)} disabled={!isEditing && (currentHole === highestPlayableHole || currentHole === 18)}>
                        <ChevronRightIcon className="h-6 w-6"/>
                    </Button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                    {data.players.map(player => {
                        const score = localScores[player.id]?.[currentHole];
                        return (
                            <div key={player.id} className="grid grid-cols-3 items-center p-3 bg-gray-700 rounded-lg">
                                <div className="col-span-1">
                                    <p className="font-bold text-white truncate">{player.fullName}</p>
                                    <div className={`mt-1 text-xs font-bold border px-1.5 py-0.5 rounded-full inline-block ${teeColorStyles[player.teeColor]}`}>
                                        {player.teeColor}
                                    </div>
                                </div>
                                <div className="col-span-2 flex items-center justify-end space-x-2">
                                    <Button size="icon" variant="secondary" onClick={() => handleScoreChange(player.id, currentHole, -1)} disabled={!score || score === 1 || isHoleLocked}>
                                        <MinusIcon className="h-6 w-6"/>
                                    </Button>
                                    <span className="text-3xl font-bold w-12 text-center text-green-400">{score ?? '-'}</span>
                                    <Button size="icon" variant="secondary" onClick={() => handleScoreChange(player.id, currentHole, 1)} disabled={isHoleLocked}>
                                        <PlusIcon className="h-6 w-6"/>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-auto pt-4 border-t border-gray-700">
                    {isEditing ? (
                        <Button onClick={() => setView('SUMMARY')} className="w-full">Finalizar Alterações</Button>
                    ) : isHoleLocked ? (
                        <div className="text-center text-green-400 font-bold p-3 bg-green-900/50 rounded-lg">
                            Buraco {currentHole} já foi confirmado.
                        </div>
                    ) : (
                        <Button onClick={handleConfirmHole} className="w-full" disabled={!isHoleComplete(currentHole, localScores, data.players)}>
                           {currentHole === 18 ? "Confirmar Buraco 18 e Ver Resumo" : `Confirmar Pontuações do Buraco ${currentHole}`}
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
};

export default ScorecardScreen;