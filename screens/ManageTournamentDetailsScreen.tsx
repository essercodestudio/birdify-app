// screens/ManageTournamentDetailsScreen.tsx - NOVA TELA UNIFICADA

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import Spinner from '../components/Spinner';

interface ManageTournamentDetailsProps {
  tournament: any;
  onBack: () => void;
}

const ManageTournamentDetailsScreen: React.FC<ManageTournamentDetailsProps> = ({ tournament, onBack }) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'settings'>('registrations');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para a aba de Configurações
  const [categories, setCategories] = useState<any[]>([]);
  const [currentCategory, setCurrentCategory] = useState('');
  const [bannerUrl, setBannerUrl] = useState(tournament.bannerImageUrl || '');
  const [paymentInstructions, setPaymentInstructions] = useState(tournament.paymentInstructions || '');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const regPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/registrations`);
      const catPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/categories`);
      
      const [regResponse, catResponse] = await Promise.all([regPromise, catPromise]);
      
      setRegistrations(regResponse.data);
      setCategories(catResponse.data);
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
    if (window.confirm('Tem a certeza de que quer confirmar o pagamento para este jogador?')) {
        try {
            await axios.patch(`${import.meta.env.VITE_API_URL}/api/registrations/${registrationId}/confirm`);
            alert('Pagamento confirmado!');
            fetchData();
        } catch (error) {
            alert('Falha ao confirmar o pagamento.');
        }
    }
  };

  const handleAddCategory = () => {
    if (currentCategory.trim() && !categories.find(c => c.name === currentCategory.trim())) {
      setCategories([...categories, { id: `new_${Date.now()}`, name: currentCategory.trim() }]);
      setCurrentCategory('');
    }
  };

  const handleRemoveCategory = (id: any) => {
    setCategories(categories.filter(cat => cat.id !== id));
  };
  
  const handleSaveChanges = async () => {
      setIsSaving(true);
      try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}`, {
              bannerImageUrl: bannerUrl,
              paymentInstructions: paymentInstructions,
              categories: categories.map(c => c.name)
          });
          alert('Configurações salvas com sucesso!');
      } catch (error) {
          alert('Falha ao salvar as configurações.');
      } finally {
          setIsSaving(false);
      }
  };


  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
      <div className="flex items-center mb-4">
        <Button onClick={onBack} variant="secondary" size="sm" className="mr-4">&larr; Voltar</Button>
        <div>
          <h2 className="text-2xl font-bold text-white">Gerenciar Torneio: {tournament.name}</h2>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-600 mb-4">
        <button onClick={() => setActiveTab('registrations')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'registrations' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Inscrições</button>
        <button onClick={() => setActiveTab('settings')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'settings' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Configurações</button>
      </div>

      {loading ? <Spinner /> : (
        <div>
          {activeTab === 'registrations' && (
             <table className="min-w-full divide-y divide-gray-600">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Jogador</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Categoria</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Ação</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-600">
                    {registrations.length > 0 ? registrations.map(reg => (
                        <tr key={reg.id}>
                            <td className="px-4 py-3">
                                {reg.paymentStatus === 'confirmed' ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-300">Confirmado</span>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300">Pendente</span>
                                )}
                            </td>
                            <td className="px-4 py-3 font-medium">{reg.fullName}</td>
                            <td className="px-4 py-3 text-gray-300">{reg.categoryName}</td>
                            <td className="px-4 py-3 text-center">
                                {reg.paymentStatus === 'pending' && (
                                    <Button size="sm" onClick={() => handleConfirmPayment(reg.id)}>Confirmar Pag.</Button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={4} className="text-center text-gray-400 py-6">Nenhum jogador inscrito ainda.</td></tr>
                    )}
                </tbody>
            </table>
          )}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Categorias de Inscrição</label>
                  <div className="flex items-center gap-2">
                      <input type="text" value={currentCategory} onChange={(e) => setCurrentCategory(e.target.value)} placeholder="Nome da Categoria" className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
                      <Button type="button" onClick={handleAddCategory}>Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                      {categories.map(cat => (
                          <span key={cat.id} className="flex items-center bg-gray-900 text-sm font-medium px-3 py-1 rounded-full">{cat.name} <button type="button" onClick={() => handleRemoveCategory(cat.id)} className="ml-2 text-red-400 hover:text-red-300">&times;</button></span>
                      ))}
                  </div>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">URL do Banner</label>
                  <input type="text" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md" placeholder="https://exemplo.com/imagem.png"/>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Instruções de Pagamento</label>
                  <textarea value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md" placeholder="Ex: PIX para..."></textarea>
              </div>
              <div className="text-right">
                  <Button onClick={handleSaveChanges} isLoading={isSaving}>Salvar Configurações</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManageTournamentDetailsScreen;