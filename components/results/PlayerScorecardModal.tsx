import React from 'react';
import Button from '../Button';

const PlayerScorecardModal = ({ player, course, onClose }) => {
    if (!player || !course) return null;

    const scoresMap = player.scores.reduce((acc, score) => {
        acc[score.holeNumber] = score.strokes;
        return acc;
    }, {});

    const frontNineScores = course.holes.slice(0, 9).map(h => scoresMap[h.holeNumber] || '-');
    const backNineScores = course.holes.slice(9, 18).map(h => scoresMap[h.holeNumber] || '-');
    const frontNineTotal = frontNineScores.reduce((sum, score) => sum + (typeof score === 'number' ? score : 0), 0);
    const backNineTotal = backNineScores.reduce((sum, score) => sum + (typeof score === 'number' ? score : 0), 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">{player.fullName} - Scorecard</h2>
                    <Button onClick={onClose} variant="secondary">Fechar</Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-center">
                        <thead>
                            <tr className="bg-slate-700">
                                <th className="p-2 border border-slate-600">Buraco</th>
                                {course.holes.map(h => <th key={h.id} className="p-2 border border-slate-600 font-semibold">{h.holeNumber}</th>)}
                                <th className="p-2 border border-slate-600 font-bold">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-slate-800 font-bold text-emerald-400">
                                <td className="p-2 border border-slate-600">PAR</td>
                                {course.holes.map(h => <td key={h.id} className="p-2 border border-slate-600">{h.par}</td>)}
                                <td className="p-2 border border-slate-600">{course.holes.reduce((sum, h) => sum + h.par, 0)}</td>
                            </tr>
                            <tr className="bg-slate-900 font-bold text-white">
                                <td className="p-2 border border-slate-600 text-left">{player.fullName}</td>
                                {[...frontNineScores, ...backNineScores].map((score, index) => (
                                    <td key={index} className="p-2 border border-slate-600">{score}</td>
                                ))}
                                <td className="p-2 border border-slate-600">{player.totalStrokes}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                 <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    <div className="bg-slate-700 p-3 rounded-lg">
                        <p className="text-sm text-slate-400">1ª Volta</p>
                        <p className="text-2xl font-bold text-white">{frontNineTotal}</p>
                    </div>
                     <div className="bg-slate-700 p-3 rounded-lg">
                        <p className="text-sm text-slate-400">2ª Volta</p>
                        <p className="text-2xl font-bold text-white">{backNineTotal}</p>
                    </div>
                     <div className="bg-emerald-800 p-3 rounded-lg">
                        <p className="text-sm text-emerald-300">Score Final</p>
                        <p className="text-2xl font-bold text-white">{player.totalStrokes}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerScorecardModal;