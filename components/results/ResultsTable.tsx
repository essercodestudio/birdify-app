import React from 'react';

const ResultsTable = ({ title, players, type = 'net', onPlayerClick }) => {
    // Ordena os jogadores com base no tipo de score, garantindo que valores nulos ou indefinidos sejam tratados
    const sortedPlayers = [...players].sort((a, b) => {
        const scoreA = type === 'gross' ? a.totalStrokes : a.netScore;
        const scoreB = type === 'gross' ? b.totalStrokes : b.netScore;
        return (scoreA ?? 999) - (scoreB ?? 999);
    });

    return (
        <div className="card overflow-x-auto">
            <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
            <table className="min-w-full text-sm text-center">
                <thead className="bg-slate-700">
                    <tr>
                        <th className="p-2 border border-slate-600">Pos</th>
                        <th className="p-2 border border-slate-600 text-left">Jogador</th>
                        <th className="p-2 border border-slate-600">Gross</th>
                        <th className="p-2 border border-slate-600">HCP</th>
                        <th className="p-2 border border-slate-600">Net</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedPlayers.map((player, index) => (
                        <tr key={player.playerId} className="bg-slate-800 hover:bg-slate-700">
                            <td className="p-2 border border-slate-600 font-bold">{index + 1}</td>
                            <td className="p-2 border border-slate-600 text-left">
                                <button onClick={() => onPlayerClick(player)} className="font-semibold text-white hover:text-emerald-400 transition-colors text-left w-full">
                                    {player.fullName}
                                </button>
                            </td>
                            <td className="p-2 border border-slate-600">{player.totalStrokes || '-'}</td>
                            <td className="p-2 border border-slate-600">{player.courseHandicap ?? '-'}</td>
                            <td className="p-2 border border-slate-600 font-bold text-emerald-400">{player.netScore ?? '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ResultsTable;