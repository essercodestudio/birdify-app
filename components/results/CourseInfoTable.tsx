import React from 'react';

const CourseInfoTable = ({ course }) => {
    if (!course || !course.holes || course.holes.length === 0) {
        return <p>Informações do campo não disponíveis.</p>;
    }

    // Ordena os buracos para garantir que estão de 1 a 18
    const sortedHoles = [...course.holes].sort((a, b) => a.holeNumber - b.holeNumber);
    const allTees = Array.from(new Set(sortedHoles.flatMap(h => h.tees.map(t => t.color)))).sort();

    return (
        <div className="card overflow-x-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Informações do Campo: {course.courseName}</h2>
            <table className="min-w-full text-sm text-center">
                <thead>
                    <tr className="bg-slate-700">
                        <th className="p-2 border border-slate-600">Buraco</th>
                        {sortedHoles.map(h => <th key={h.id} className="p-2 border border-slate-600 font-semibold">{h.holeNumber}</th>)}
                    </tr>
                </thead>
                <tbody>
                    <tr className="bg-slate-800 font-bold text-emerald-400">
                        <td className="p-2 border border-slate-600">PAR</td>
                        {sortedHoles.map(h => <td key={h.id} className="p-2 border border-slate-600">{h.par}</td>)}
                    </tr>
                    {allTees.map(teeColor => (
                        <tr key={teeColor} style={{ color: teeColor.toLowerCase() }}>
                            <td className="p-2 border border-slate-600 font-semibold capitalize">{teeColor}</td>
                            {sortedHoles.map(h => {
                                const tee = h.tees.find(t => t.color === teeColor);
                                return <td key={h.id} className="p-2 border border-slate-600">{tee ? tee.yardage : '-'}</td>;
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CourseInfoTable;