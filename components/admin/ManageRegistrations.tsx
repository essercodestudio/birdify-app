// components/admin/ManageRegistrations.tsx - VERSÃO UNIFICADA

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../Button';
import Spinner from '../Spinner';

// (As interfaces Registration e Props permanecem as mesmas)
interface Registration {
  id: number;
  fullName: string;
  club: string | null;
  categoryName: string;
  paymentStatus: 'pending' | 'confirmed';
  registrationDate: string;
}

interface ManageRegistrationsProps {
  tournament: any; // Recebe o objeto completo do torneio
  onBack: () => void;
}

const ManageRegistrations: React.FC<ManageRegistrationsProps> = ({ tournament, onBack }) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'settings'>('registrations');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para a aba de Configurações
  const [categories, setCategories] = useState<string[]>([]);
  const [currentCategory, setCurrentCategory] = useState('');
  const [bannerUrl, setBannerUrl] = useState(tournament.bannerImageUrl || '');
  const [paymentInstructions, setPaymentInstructions] = useState(tournament.paymentInstructions || '');

  // Busca as inscrições e categorias do torneio
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const regPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/registrations`);
      const catPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/categories`); // Precisaremos criar esta rota
      
      const [regResponse, catResponse] = await Promise.all([regPromise, catPromise]);
      
      setRegistrations(regResponse.data);
      setCategories(catResponse.data.map((c: any) => c.name));
    } catch (err) {
      console.error("Erro ao carregar dados do torneio", err);
    } finally {
      setLoading(false);
    }
  }, [tournament.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirmPayment = async (registrationId: number) => {
    // ... (esta função permanece igual)
  };
  
  // Funções para a aba de Configurações
  const handleAddCategory = () => {
    if (currentCategory.trim() && !categories.includes(currentCategory.trim())) {
      setCategories([...categories, currentCategory.trim()]);
      setCurrentCategory('');
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setCategories(categories.filter(cat => cat !== categoryToRemove));
  };
  
  const handleSaveChanges = async () => {
      try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}`, {
              bannerImageUrl: bannerUrl,
              paymentInstructions: paymentInstructions,
              categories: categories
          });
          alert('Configurações salvas com sucesso!');
      } catch (error) {
          alert('Falha ao salvar as configurações.');
      }
  };


  return (
    <div className="p-6 bg-gray-700/50 rounded-lg">
        <div className="flex items-center mb-6">
            <Button onClick={onBack} variant="secondary" size="sm" className="mr-4">&larr; Voltar</Button>
            <div>
                <h3 className="text-xl font-bold text-green-400">Gerenciar Torneio: {tournament.name}</h3>
            </div>
        </div>

        {/* Abas de Navegação Interna */}
        <div className="flex gap-2 border-b border-gray-600 mb-4">
            <button onClick={() => setActiveTab('registrations')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'registrations' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Inscrições</button>
            <button onClick={() => setActiveTab('settings')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'settings' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Configurações</button>
        </div>

        {loading ? <Spinner /> : (
            <div>
                {/* Conteúdo da Aba de Inscrições */}
                {activeTab === 'registrations' && (
                    <table className="min-w-full divide-y divide-gray-600">
                        {/* ... (código da tabela de inscrições que já tínhamos) ... */}
                    </table>
                )}

                {/* Conteúdo da Aba de Configurações */}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Categorias de Inscrição</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={currentCategory} onChange={(e) => setCurrentCategory(e.target.value)} placeholder="Nome da Categoria" className="flex-grow input"/>
                                <Button type="button" onClick={handleAddCategory}>Adicionar</Button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {categories.map(cat => (
                                    <span key={cat} className="tag">{cat} <button onClick={() => handleRemoveCategory(cat)}>&times;</button></span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">URL do Banner</label>
                            <input type="text" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className="w-full input" placeholder="https://exemplo.com/imagem.png"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Instruções de Pagamento</label>
                            <textarea value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} rows={5} className="w-full input" placeholder="Ex: PIX para..."></textarea>
                        </div>
                        <div className="text-right">
                            <Button onClick={handleSaveChanges}>Salvar Configurações</Button>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default ManageRegistrations;