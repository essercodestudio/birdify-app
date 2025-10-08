// components/training/CreateTrainingModal.tsx - VERSÃO CORRIGIDA

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import Button from '../Button';
import { AuthContext } from '../../context/AuthContext';
import { AdminCourse } from '../../data/mockDatabase';

interface CreateTrainingModalProps {
  onClose: () => void;
  onTrainingCreated: (newTrainingData: any) => void;
}

const CreateTrainingModal: React.FC<CreateTrainingModalProps> = ({ onClose, onTrainingCreated }) => {
    const { user } = useContext(AuthContext);
    const [courses, setCourses] = useState<AdminCourse[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startHole, setStartHole] = useState('1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCourses = async () => {
            try {
                // --- ALTERAÇÃO PRINCIPAL AQUI ---
                // A chamada agora é feita para a rota pública, que não precisa de adminId
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/courses/public`);
                setCourses(response.data);
            } catch (err) {
                setError("Não foi possível carregar a lista de campos.");
            }
        };
        fetchCourses();
    }, []); // Não precisa mais depender do 'user'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourseId || !date || !startHole || !user) {
            setError("Por favor, preencha todos os campos.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/trainings`, {
                courseId: parseInt(selectedCourseId, 10),
                creatorId: user.id,
                date: date,
                startHole: parseInt(startHole, 10),
            });
            onTrainingCreated(response.data);
            onClose();
        } catch (err) {
            setError("Ocorreu um erro ao criar o treino.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg space-y-4">
                <h2 className="text-2xl font-bold text-white">Criar Novo Treino</h2>
                <div>
                    <label htmlFor="course" className="block text-sm font-medium text-gray-300 mb-1">Campo</label>
                    <select id="course" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md">
                        <option value="">-- Selecione um campo --</option>
                        {courses.map(course => (
                            <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">Data do Treino</label>
                        <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
                    </div>
                     <div>
                        <label htmlFor="startHole" className="block text-sm font-medium text-gray-300 mb-1">Buraco de Início</label>
                        <input id="startHole" type="number" value={startHole} onChange={(e) => setStartHole(e.target.value)} min="1" max="18" required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
                    </div>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" isLoading={isLoading}>Confirmar e Criar Treino</Button>
                </div>
            </form>
        </div>
    );
};

export default CreateTrainingModal;