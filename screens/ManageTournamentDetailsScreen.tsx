// screens/ManageTournamentDetailsScreen.tsx - VERSÃO COMPLETA E CORRIGIDA

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import RegistrationFormSetup from '../components/admin/RegistrationFormSetup';

interface ManageTournamentDetailsProps {
  tournament: any;
  onBack: () => void;
}

const ManageTournamentDetailsScreen: React.FC<ManageTournamentDetailsProps> = ({ tournament, onBack }) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'settings'>('registrations');
  
  // Estados para a aba de Inscrições
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);

  // Estados para a aba de Configurações
  const [bannerUrl, setBannerUrl] = useState(tournament.bannerImageUrl || '');
  const [paymentInstructions, setPaymentInstructions] = useState(tournament.paymentInstructions || '');
  const [isSaving, setIsSaving] = useState(false);

  // Função para buscar os inscritos com as suas respostas
  const fetchRegistrations = useCallback(async () => {
    setLoadingRegistrations(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/registrations-with-answers`);
      setRegistrations(response.data);
    } catch (err) {
      console.error("Erro ao carregar inscrições:", err);
    } finally {
      setLoadingRegistrations(false);
    }
  }, [tournament.id]);

  useEffect(() => {
    if (activeTab === 'registrations') {
      fetchRegistrations();
    }
  }, [activeTab, fetchRegistrations]);

  const handleConfirmPayment = async (registrationId: number) => {
    if (window.confirm('Tem a certeza de que quer confirmar o pagamento para este jogador?')) {
        try {
            await axios.patch(`${import.meta.env.VITE_API_URL}/api/registrations/${registrationId}/confirm`);
            alert('Pagamento confirmado!');
            fetchRegistrations(); // Re-busca os dados para atualizar o status
        } catch (error) {
            alert('Falha ao confirmar o pagamento.');
        }
    }
  };
  
  const handleSaveChanges = async () => {
      setIsSaving(true);
      try {
          await axios.put(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}`, {
              bannerImageUrl: bannerUrl,
              paymentInstructions: paymentInstructions,
          });
          alert('Configurações salvas com sucesso!');
      } catch (error) {
          alert('Falha ao salvar as configurações.');
      } finally {
          setIsSaving(false);
      }
  };

  const handleExport = async () => {
    try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/export-registrations`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Inscricoes_Torneio.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        alert('Erro ao gerar o relatório de inscrições.');
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
            <Button onClick={onBack} variant="secondary" size="sm" className="mr-4">&larr; Voltar</Button>
            <div>
              <h2 className="text-2xl font-bold text-white">Gerenciar Torneio: {tournament.name}</h2>
            </div>
        </div>
        {activeTab === 'registrations' && (
            <Button onClick={handleExport} disabled={registrations.length === 0}>Exportar Inscritos</Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-600 mb-4">
        <button onClick={() => setActiveTab('registrations')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'registrations' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Inscrições</button>
        <button onClick={() => setActiveTab('settings')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'settings' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Configurações</button>
      </div>

      <div>
        {activeTab === 'registrations' && (
           loadingRegistrations ? <Spinner /> : (
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-600">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Jogador</th>
                            {registrations[0]?.answers.map((ans: any, index: number) => (
                                <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">{ans.questionText}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-600">
                        {registrations.length > 0 ? registrations.map((reg: any) => (
                            <tr key={reg.id}>
                                <td className="px-4 py-3 align-top">
                                    <button onClick={() => handleConfirmPayment(reg.id)} className="cursor-pointer">
                                        {reg.paymentStatus === 'confirmed' ? (
                                            <span title="Pagamento Confirmado" className="text-2xl">✅</span>
                                        ) : (
                                            <span title="Pagamento Pendente" className="text-2xl">❌</span>
                                        )}
                                    </button>
                                </td>
                                <td className="px-4 py-3 align-top font-medium">{reg.fullName}</td>
                                {reg.answers.map((ans: any, index: number) => (
                                    <td key={index} className="px-4 py-3 align-top text-gray-300">{ans.answerText}</td>
                                ))}
                            </tr>
                        )) : (
                            <tr><td colSpan={10} className="text-center text-gray-400 py-6">Nenhum jogador inscrito ainda.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
           )
        )}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <RegistrationFormSetup tournament={tournament} />
            
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-4">
              <h4 className="font-bold text-lg mb-3 text-white">Outras Configurações</h4>
              
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Link Exclusivo de Inscrição</label>
                  <input 
                    type="text" 
                    readOnly 
                    value={`${window.location.origin}/register/${tournament.id}`} 
                    className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-300 rounded-md cursor-pointer"
                    onClick={(e) => {
                        (e.target as HTMLInputElement).select();
                        navigator.clipboard.writeText((e.target as HTMLInputElement).value);
                        alert('Link copiado para a área de transferência!');
                    }}
                  />
                   <p className="text-xs text-gray-500 mt-1">Clique no link para copiar.</p>
              </div>
              
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">URL do Banner</label>
                  <input type="text" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="https://exemplo.com/imagem.png"/>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Instruções de Pagamento</label>
                  <textarea value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Ex: PIX para..."></textarea>
              </div>
              <div className="text-right">
                  <Button onClick={handleSaveChanges} isLoading={isSaving}>Salvar Outras Configurações</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ManageTournamentDetailsScreen;