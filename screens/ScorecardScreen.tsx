import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import PlusIcon from '../components/icons/PlusIcon';
import MinusIcon from '../components/icons/MinusIcon';
import LeaderboardScreen from './LeaderboardScreen';
import PhotoIcon from '../components/icons/PhotoIcon';

// Interface atualizada para incluir a nova prop
interface ScorecardScreenProps { 
    accessCode: string; 
    onBack: () => void;
    type: 'tournament' | 'training';
    onFinishTraining?: () => void; // Prop opcional para o redirecionamento
}

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

const generateHoleSequence = (startHole: number): number[] => {
    const sequence: number[] = [];
    for (let i = 0; i < 18; i++) {
        const holeNumber = ((startHole - 1 + i) % 18) + 1;
        sequence.push(holeNumber);
    }
    return sequence;
};

// Adicionada a nova prop onFinishTraining
const ScorecardScreen: React.FC<ScorecardScreenProps> = ({ accessCode: initialAccessCode, onBack, type, onFinishTraining }) => {
    const { user } = useContext(AuthContext);
    const [accessCode, setAccessCode] = useState(initialAccessCode);
    const [data, setData] = useState<ScorecardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [holeSequence, setHoleSequence] = useState<number[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [highestAllowedStep, setHighestAllowedStep] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [localScores, setLocalScores] = useState<Record<string, Record<number, number | null>>>({});
    const [view, setView] = useState<'SCORECARD' | 'LEADERBOARD' | 'SUMMARY'>('SCORECARD');
    const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
    
    useEffect(() => {
        const persistedAccessCode = localStorage.getItem('activeAccessCode');
        if (persistedAccessCode) {
            setAccessCode(persistedAccessCode);
        }
    }, []);
    
    const isHoleComplete = (holeNum: number, scores: Record<string, Record<number, number | null>>, players: PlayerData[]): boolean => {
        if (!players || players.length === 0) return false;
        return players.every(player => {
            const score = scores[player.id]?.[holeNum];
            return typeof score === 'number' && score > 0;
        });
    };

    const fetchScorecardData = useCallback(async () => { 
        if (!accessCode || !user) return;
        
        try {
            setLoading(true);
            
            const url = type === 'tournament'
                ? `${import.meta.env.VITE_API_URL}/api/scorecard/${accessCode}?playerId=${user.id}`
                : `${import.meta.env.VITE_API_URL}/api/trainings/scorecard/${accessCode}?playerId=${user.id}`;
            
            const response = await axios.get<ScorecardData>(url);
            const groupData = response.data;
            setData(groupData);

            const sequence = generateHoleSequence(groupData.startHole);
            setHoleSequence(sequence);

            const scoresMap: Record<string, Record<number, number | null>> = {};
            groupData.players.forEach(p => { scoresMap[p.id] = {}; });
            groupData.scores.forEach(s => { if (scoresMap[s.playerId]) { scoresMap[s.playerId][s.holeNumber] = s.strokes; } });
            setLocalScores(scoresMap);
            
            let lastCompletedStep = -1;
            for (let i = 0; i < sequence.length; i++) {
                if (isHoleComplete(sequence[i], scoresMap, groupData.players)) {
                    lastCompletedStep = i;
                } else {
                    break;
                }
            }
            const currentPlayableStep = Math.min(lastCompletedStep + 1, 17);
            setCurrentStep(currentPlayableStep);
            setHighestAllowedStep(currentPlayableStep);

            if (groupData.status === 'completed') {
                setView('SUMMARY');
                setIsEditing(true);
            }
            setError(null);
          } catch (err: any) {
              setError('Não foi possível carregar os dados do scorecard.');
              localStorage.removeItem('activeAccessCode');
          } finally {
            setLoading(false);
          }
    }, [accessCode, user, type]);

    useEffect(() => {
        fetchScorecardData();
    }, [fetchScorecardData]);

    const handleScoreChange = (playerId: number, hole: number, change: number) => { 
        const newLocalScores = JSON.parse(JSON.stringify(localScores));
        const currentStrokes = newLocalScores[playerId]?.[hole] || 0;
        newLocalScores[playerId][hole] = Math.max(1, currentStrokes + change);
        setLocalScores(newLocalScores);
    };

    const handleConfirmHole = async () => { 
        const currentHoleNumber = holeSequence[currentStep];
        if (!data || !isHoleComplete(currentHoleNumber, localScores, data.players)) {
            return alert("Preencha a pontuação de todos os jogadores para confirmar.");
        }

        const scoresToSubmit = data.players.map(player => ({
            playerId: player.id,
            strokes: localScores[player.id][currentHoleNumber]
        }));
        
        const endpoint = type === 'tournament' ? 'scores' : 'training_scores';
        
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/${endpoint}/hole`, {
                groupId: data.groupId,
                holeNumber: currentHoleNumber,
                scores: scoresToSubmit
            });
            
            if (currentStep < 17) {
                const nextStep = currentStep + 1;
                setCurrentStep(nextStep);
                setHighestAllowedStep(nextStep);
            } else {
                setView('SUMMARY');
            }
        } catch (error) {
            setError("Não foi possível salvar as pontuações.");
        }
    };
    
    // FUNÇÃO CORRIGIDA
    const handleFinishRound = async () => {
        if (!data) return;
        const confirmationMessage = isEditing 
            ? 'Tem a certeza de que quer salvar as alterações?' 
            : 'Tem a certeza de que quer finalizar a rodada? Não será possível fazer mais alterações.';
        
        if(window.confirm(confirmationMessage)) {
            try {
                const scoreEndpoint = type === 'tournament' ? 'scores' : 'training_scores';
                if (isEditing) {
                    for (const holeNum of holeSequence) {
                         if (isHoleComplete(holeNum, localScores, data.players)) {
                             const scoresToSubmit = data.players.map(player => ({
                                 playerId: player.id,
                                 strokes: localScores[player.id][holeNum]
                             }));
                              await axios.post(`${import.meta.env.VITE_API_URL}/api/${scoreEndpoint}/hole`, {
                                 groupId: data.groupId,
                                 holeNumber: holeNum,
                                 scores: scoresToSubmit
                              });
                         }
                    }
                }
                
                if (!isEditing) {
                    const finishEndpoint = type === 'tournament' ? 'groups' : 'trainings';
                    await axios.post(`${import.meta.env.VITE_API_URL}/api/${finishEndpoint}/finish`, { groupId: data.groupId });
                }
                localStorage.removeItem('activeAccessCode');

                // <<-- AQUI ESTÁ A LÓGICA DE REDIRECIONAMENTO -->>
                if (type === 'training' && onFinishTraining) {
                    onFinishTraining(); // Chama a nova função para ir para o histórico
                } else {
                    onBack(); // Mantém o comportamento padrão para torneios
                }

            } catch (error) {
                alert('Não foi possível finalizar a rodada.');
            }
        }
    };

    const changeHole = (direction: number) => { 
        const newStep = currentStep + direction;
        if (isEditing && newStep >= 0 && newStep < 18) {
            setCurrentStep(newStep);
        } else if (!isEditing && newStep >= 0 && newStep <= highestAllowedStep) {
            setCurrentStep(newStep);
        }
    };

    const currentHoleNumber = holeSequence[currentStep];
    const currentHoleInfo = useMemo(() => data?.holes.find(h => h.holeNumber === currentHoleNumber), [data, currentHoleNumber]);
    const totals = useMemo(() => {
        if (!data) return [];
        return data.players.map(player => {
            const totalStrokes = holeSequence.reduce((sum, holeNum) => sum + (localScores[player.id]?.[holeNum] || 0), 0);
            return { ...player, total: totalStrokes };
        });
    }, [data, localScores, holeSequence]);

    if (loading) return <Spinner />;
    if (error) return <div className="text-red-400 text-center p-6 bg-red-900/50 rounded-lg">{error}</div>;
    if (!data) return <p className="text-gray-400 text-center">A carregar dados do grupo...</p>;

    if (view === 'LEADERBOARD' && type === 'tournament') {
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
                        {isEditing ? 'Confirmar Alterações e Sair' : 'Confirmar e Finalizar Rodada'}
                    </Button>
                    <Button onClick={() => { setIsEditing(true); setView('SCORECARD'); }} variant="secondary" className="w-full">
                        Alterar Marcação
                    </Button>
                </div>
            </div>
        );
    }
    
    const isHoleLocked = !isEditing && currentStep < highestAllowedStep;

    return (
        <>
            {modalImageUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setModalImageUrl(null)}>
                    <img src={`${import.meta.env.VITE_API_URL}${modalImageUrl}`} alt={`Visão aérea do buraco ${currentHoleInfo?.holeNumber}`} className="max-w-[90%] max-h-[90%] object-contain rounded-lg"/>
                </div>
            )}
            <div className="bg-gray-800 p-4 rounded-lg shadow-xl flex flex-col h-[calc(100vh-10rem)]">
                <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                    <Button onClick={onBack} variant="secondary" size="sm"><ChevronLeftIcon className="h-5 w-5 mr-1"/> Início</Button>
                    <h2 className="text-xl font-bold text-center">{data.tournamentName}</h2>
                    {type === 'tournament' && (
                        <Button onClick={() => setView('LEADERBOARD')} size="sm">Ver Leaderboard</Button>
                    )}
                </div>
                <div className="flex items-center justify-between p-4 my-4 bg-gray-900 rounded-lg">
                    <Button size="icon" onClick={() => changeHole(-1)} disabled={currentStep === 0}><ChevronLeftIcon className="h-6 w-6"/></Button>
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">BURACO</p>
                        <p className="text-4xl font-bold text-white">{currentHoleNumber}</p>
                        <div className="text-gray-400 flex items-center justify-center gap-x-4 mt-1">
                            <span className="font-bold">PAR {currentHoleInfo?.par}</span>
                            {currentHoleInfo?.aerialImageUrl && (
                                <button onClick={() => setModalImageUrl(currentHoleInfo.aerialImageUrl!)}><PhotoIcon className="h-5 w-5 text-blue-400 hover:text-blue-300"/></button>
                            )}
                        </div>
                    </div>
                    <Button size="icon" onClick={() => changeHole(1)} disabled={!isEditing && currentStep >= highestAllowedStep}><ChevronRightIcon className="h-6 w-6"/></Button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                    {data.players.map(player => {
                        const score = localScores[player.id]?.[currentHoleNumber];
                        return (
                            <div key={player.id} className="grid grid-cols-3 items-center p-3 bg-gray-700 rounded-lg">
                                <div className="col-span-1">
                                    <p className="font-bold text-white truncate">{player.fullName}</p>
                                </div>
                                <div className="col-span-2 flex items-center justify-end space-x-2">
                                    <Button size="icon" variant="secondary" onClick={() => handleScoreChange(player.id, currentHoleNumber, -1)} disabled={!score || score === 1 || isHoleLocked}>
                                        <MinusIcon className="h-6 w-6"/>
                                    </Button>
                                    <span className="text-3xl font-bold w-12 text-center text-green-400">{score ?? '-'}</span>
                                    <Button size="icon" variant="secondary" onClick={() => handleScoreChange(player.id, currentHoleNumber, 1)} disabled={isHoleLocked}>
                                        <PlusIcon className="h-6 w-6"/>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-auto pt-4 border-t border-gray-700">
                    {isEditing ? (
                        <Button onClick={() => setView('SUMMARY')} className="w-full">Ver Resumo e Finalizar</Button>
                    ) : isHoleLocked ? (
                        <div className="text-center text-green-400 font-bold p-3 bg-green-900/50 rounded-lg">
                            Buraco {currentHoleNumber} já foi confirmado.
                        </div>
                    ) : (
                        <Button onClick={handleConfirmHole} className="w-full" disabled={!isHoleComplete(currentHoleNumber, localScores, data.players)}>
                           {currentStep === 17 ? "Confirmar Buraco Final e Ver Resumo" : `Confirmar Pontuações do Buraco ${currentHoleNumber}`}
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
};

export default ScorecardScreen;