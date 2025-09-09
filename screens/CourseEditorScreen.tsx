import React, { useState, useEffect } from 'react';
import { getCourse, updateCourseHoles } from '../services/supabaseMock';
import { Course, Hole } from '../types';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';

interface CourseEditorScreenProps {
  courseId: string;
  onBack: () => void;
}

const CourseEditorScreen: React.FC<CourseEditorScreenProps> = ({ courseId, onBack }) => {
  const [course, setCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourseData = async () => {
      setLoading(true);
      const { data, error: apiError } = await getCourse(courseId);
      if (apiError) {
        setError(apiError);
      } else if (data) {
        setCourse(data);
        setHoles(data.holes);
      }
      setLoading(false);
    };
    fetchCourseData();
  }, [courseId]);

  const handleHoleChange = (holeNumber: number, field: 'par' | 'strokeIndex', value: string) => {
    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue) && value !== '') return;

    setHoles(prevHoles =>
      prevHoles.map(hole =>
        hole.holeNumber === holeNumber
          ? { ...hole, [field]: value === '' ? undefined : numericValue }
          : hole
      )
    );
  };
  
  const handleSaveChanges = async () => {
    setSaving(true);
    setError(null);
    const { success } = await updateCourseHoles(courseId, holes);
    if (success) {
      onBack();
    } else {
      setError('Falha ao salvar as alterações.');
    }
    setSaving(false);
  };


  if (loading) return <Spinner />;
  if (error && !saving) return <p className="text-red-400 text-center">{error}</p>;
  if (!course) return <p className="text-gray-400 text-center">Campo não encontrado.</p>;

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
      <div className="flex items-center mb-6">
        <Button onClick={onBack} variant="secondary" size="icon" className="mr-4">
          <ChevronLeftIcon className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">Editar Campo: {course.name}</h1>
          <p className="text-gray-400">Ajuste os valores de Par e Stroke Index para cada buraco.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Buraco</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Par</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Stroke Index</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {holes.sort((a,b) => a.holeNumber - b.holeNumber).map(hole => (
                <tr key={hole.holeNumber}>
                  <td className="px-4 py-2 font-bold text-white">{hole.holeNumber}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      value={hole.par}
                      onChange={(e) => handleHoleChange(hole.holeNumber, 'par', e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1" 
                      max="18"
                      value={hole.strokeIndex || ''}
                      onChange={(e) => handleHoleChange(hole.holeNumber, 'strokeIndex', e.target.value)}
                      placeholder="N/D"
                      className="w-20 px-2 py-1 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 text-right">
            {error && <p className="text-sm text-red-400 text-center mb-2">{error}</p>}
            <Button type="submit" isLoading={saving}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseEditorScreen;
