import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import Button from '../Button';
import Spinner from '../Spinner';

interface Course {
    id: number;
    name: string;
}

interface CreateTrainingModalProps {
    onClose: () => void;
    onTrainingCreated: (newTrainingData: any) => void;
}

const CreateTrainingModal: React.FC<CreateTrainingModalProps> = ({ onClose, onTrainingCreated }) => {
    const { user } = useContext(AuthContext);
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startHole, setStartHole] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/courses/public`);
                setCourses(response.data);
            } catch (error) {
                console.error("Erro ao buscar campos", error);
                setError("Não foi possível carregar a lista de campos.");
            }
        };
        fetchCourses();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourse || !date || !user) {
            setError("Por favor, preencha todos os campos.");
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/trainings`, {
                courseId: parseInt(selectedCourse),
                creatorId: user.id,
                date: date,
                startHole: startHole
            });
            onTrainingCreated(response.data);
        } catch (error) {
            console.error('Erro ao criar treino:', error);
            setError("Ocorreu um erro ao criar o treino.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md m-4">
                <h2 className="text-2xl font-bold text-white mb-6">Criar Novo Treino</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="course" className="block text-sm font-medium text-gray-300 mb-1">Campo</label>
                        <select 
                            id="course" 
                            value={selectedCourse} 
                            onChange={(e) => setSelectedCourse(e.target.value)} 
                            className="input w-full" 
                            required
                            style={{ colorScheme: 'dark' }} // <-- CORREÇÃO APLICADA AQUI
                        >
                            <option value="" disabled>Selecione um campo</option>
                            {courses.map(course => (
                                <option key={course.id} value={course.id}>{course.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">Data</label>
                            <input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className="input w-full"
                                style={{ colorScheme: 'dark' }} 
                            />
                        </div>
                        <div>
                            <label htmlFor="startHole" className="block text-sm font-medium text-gray-300 mb-1">Buraco de Início</label>
                            <input 
                                type="number" 
                                id="startHole" 
                                value={startHole} 
                                onChange={(e) => setStartHole(parseInt(e.target.value))} 
                                min="1" max="18" 
                                className="input w-full" 
                                required 
                                style={{ colorScheme: 'dark' }} // <-- CORREÇÃO APLICADA AQUI
                            />
                        </div>
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex justify-end gap-4 pt-4 border-t border-gray-700 mt-6">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
                        <Button type="submit" isLoading={loading}>
                            Criar Treino
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTrainingModal;