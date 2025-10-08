// src/components/admin/RegistrationFormSetup.tsx - VERSÃO COM CSS CORRIGIDO DIRETAMENTE

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../Button';
import Spinner from '../Spinner';

interface Question {
  id?: number;
  questionText: string;
  questionType: 'TEXT' | 'MULTIPLE_CHOICE' | 'NUMBER' | 'DATE';
  isRequired: boolean;
  options?: { id?: number; optionText: string }[];
}

interface RegistrationFormSetupProps {
  tournament: any;
}

const RegistrationFormSetup: React.FC<RegistrationFormSetupProps> = ({ tournament }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState<Question>({
    questionText: '',
    questionType: 'TEXT',
    isRequired: true,
    options: [{ optionText: '' }],
  });
  
  const inputStyle = "w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";


  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/questions`);
      setQuestions(response.data);
    } catch (error) {
      console.error("Erro ao buscar perguntas", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [tournament.id]);

  const handleInputChange = (field: keyof Question, value: any) => {
    setNewQuestion(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const updatedOptions = [...(newQuestion.options || [])];
    updatedOptions[index] = { optionText: value };
    handleInputChange('options', updatedOptions);
  };

  const addOption = () => {
    handleInputChange('options', [...(newQuestion.options || []), { optionText: '' }]);
  };
  
  const removeOption = (index: number) => {
    handleInputChange('options', newQuestion.options?.filter((_, i) => i !== index));
  };

  const handleAddQuestion = async () => {
    const payload = {
      ...newQuestion,
      options: newQuestion.questionType === 'MULTIPLE_CHOICE' 
        ? newQuestion.options?.map(opt => opt.optionText).filter(opt => opt.trim() !== '') 
        : [],
    };

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/questions`, payload);
      setNewQuestion({ questionText: '', questionType: 'TEXT', isRequired: true, options: [{ optionText: '' }] });
      fetchQuestions();
    } catch (error) {
      alert('Erro ao adicionar a pergunta.');
      console.error(error);
    }
  };
  
  const handleDeleteQuestion = async (questionId: number) => {
    if (window.confirm('Tem a certeza que quer apagar esta pergunta? Todas as respostas associadas serão perdidas.')) {
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/questions/${questionId}`);
            fetchQuestions();
        } catch (error) {
            alert('Erro ao apagar a pergunta.');
        }
    }
  };


  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <h4 className="font-bold text-lg mb-3 text-white">Adicionar Nova Pergunta</h4>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Texto da pergunta (ex: Qual o seu Nível?)"
            value={newQuestion.questionText}
            onChange={(e) => handleInputChange('questionText', e.target.value)}
            className={inputStyle}
          />
          <select value={newQuestion.questionType} onChange={(e) => handleInputChange('questionType', e.target.value)} className={inputStyle}>
            <option value="TEXT">Texto Livre</option>
            <option value="MULTIPLE_CHOICE">Múltipla Escolha</option>
            <option value="NUMBER">Número</option>
            <option value="DATE">Data</option>
          </select>
          
          {newQuestion.questionType === 'MULTIPLE_CHOICE' && (
            <div className="space-y-2 pl-4 border-l-2 border-gray-600">
              <label className="text-sm text-gray-400">Opções de Resposta:</label>
              {newQuestion.options?.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Opção ${index + 1}`}
                    value={opt.optionText}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className={inputStyle}
                  />
                  <Button type="button" size="sm" variant="danger" onClick={() => removeOption(index)} disabled={(newQuestion.options?.length || 0) <= 1}>-</Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="secondary" onClick={addOption}>Adicionar Opção</Button>
            </div>
          )}

          <div className="flex items-center">
            <input type="checkbox" id="isRequired" checked={newQuestion.isRequired} onChange={(e) => handleInputChange('isRequired', e.target.checked)} className="h-4 w-4 bg-gray-900 border-gray-600 text-green-600 focus:ring-green-500" />
            <label htmlFor="isRequired" className="ml-2 text-sm text-gray-300">Pergunta Obrigatória</label>
          </div>
          
          <Button onClick={handleAddQuestion} disabled={!newQuestion.questionText}>Adicionar Pergunta ao Formulário</Button>
        </div>
      </div>

      <div>
        <h4 className="font-bold text-lg mb-3 text-white">Perguntas Actuais do Formulário</h4>
        {loading ? <Spinner /> : (
          <div className="space-y-3">
            {questions.map(q => (
              <div key={q.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-start">
                <div>
                  <p className="font-semibold text-white">{q.questionText} {q.isRequired && <span className="text-red-400">*</span>}</p>
                  <p className="text-xs text-gray-400 uppercase">{q.questionType.replace('_', ' ')}</p>
                  {q.questionType === 'MULTIPLE_CHOICE' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {q.options?.map(opt => <span key={opt.id} className="text-xs bg-gray-800 px-2 py-1 rounded-full">{opt.optionText}</span>)}
                    </div>
                  )}
                </div>
                <Button variant="danger" size="sm" onClick={() => handleDeleteQuestion(q.id!)}>Apagar</Button>
              </div>
            ))}
            {questions.length === 0 && <p className="text-gray-500 text-center py-4">Nenhuma pergunta personalizada foi adicionada a este torneio ainda.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationFormSetup;