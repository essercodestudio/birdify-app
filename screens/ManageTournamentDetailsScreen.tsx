// screens/ManageTournamentDetailsScreen.tsx - VERSÃO COM ABAS E FUNCIONALIDADES RESTAURADAS

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import RegistrationFormSetup from '../components/admin/RegistrationFormSetup'; // Importe o componente

interface ManageTournamentDetailsScreenProps {
  tournament: any;
  onBack: () => void;
}

const ManageTournamentDetailsScreen: React.FC<ManageTournamentDetailsScreenProps> = ({ tournament, onBack }) => {
  const [activeTab, setActiveTab] = useState<'registrations' | 'settings'>('registrations');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gera o link de inscrição completo
  const registrationLink = `${window.location.origin}/register/${tournament.id}`;

  const questionHeaders = useMemo(() => {
    if (!registrations || registrations.length === 0) return [];
    const questions = new Set<string>();
    registrations.forEach(reg => {
      reg.answers?.forEach((ans: any) => questions.add(ans.questionText));
    });
    return Array.from(questions).sort();
  }, [registrations]);

  const fetchRegistrations = useCallback(async () => {
    if (!tournament?.id) return;
    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/registrations-with-answers`);
      setRegistrations(response.data);
      setError(null);
    } catch (error: any) {
      setError('Erro ao carregar inscrições: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  }, [tournament.id]);

  useEffect(() => {
    if (activeTab === 'registrations') {
        fetchRegistrations();
    }
  }, [fetchRegistrations, activeTab]);
  
  const handleExport = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/tournaments/${tournament.id}/export-registrations`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inscritos_${tournament.name.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert('Erro ao exportar: ' + (error.response?.data?.error || error.message));
    }
  };

  const handlePaymentStatusToggle = async (registrationId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'confirmed' ? 'pending' : 'confirmed';
      await axios.patch(`${import.meta.env.VITE_API_URL}/api/registrations/${registrationId}/status`, { status: newStatus });
      // Atualiza a lista localmente para feedback instantâneo
      setRegistrations(prev => prev.map(reg => 
        reg.id === registrationId 
          ? { ...reg, paymentStatus: newStatus }
          : reg
      ));
    } catch (error) {
      alert('Erro ao atualizar status de pagamento');
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(registrationLink).then(() => {
      alert('Link de inscrição copiado!');
    });
  };

  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl space-y-6">
      <div className="flex justify-between items-center">
          <div>
              <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
              <p className="text-gray-400">Gestão de Torneio</p>
          </div>
          <Button onClick={onBack} variant="secondary">Voltar</Button>
      </div>

      <div className="flex gap-2 border-b border-gray-700">
          <button onClick={() => setActiveTab('registrations')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'registrations' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Inscrições</button>
          <button onClick={() => setActiveTab('settings')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'settings' ? 'border-b-2 border-green-400 text-white' : 'text-gray-400'}`}>Configurações</button>
      </div>

      {loading ? <Spinner /> : error ? <div className="text-red-400">{error}</div> : (
        <div>
          {activeTab === 'registrations' && (
            <div>
              <div className="flex justify-end mb-4">
                  <Button onClick={handleExport} disabled={registrations.length === 0}>Exportar Inscritos (Excel)</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-600">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Status Pag.</th>
                      {questionHeaders.map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-600">
                    {registrations.map(reg => (
                      <tr key={reg.id}>
                        <td className="px-4 py-3 font-medium text-white">{reg.fullName}</td>
                        <td className="px-4 py-3">
                           <button onClick={() => handlePaymentStatusToggle(reg.id, reg.paymentStatus)} 
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer 
                                ${reg.paymentStatus === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {reg.paymentStatus === 'confirmed' ? 'Confirmado' : 'Pendente'}
                            </button>
                        </td>
                        {questionHeaders.map(header => (
                          <td key={header} className="px-4 py-3 text-sm text-gray-300">
                            {reg.answers?.find((a: any) => a.questionText === header)?.answer || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
                <div>
                    <h3 className="text-lg font-bold text-green-400 mb-2">Link de Inscrição</h3>
                    <p className="text-sm text-gray-400 mb-2">Partilhe este link para que os jogadores se possam inscrever no torneio.</p>
                    <div className="flex gap-2 items-center">
                        <input type="text" readOnly value={registrationLink} className="input flex-grow bg-gray-900" />
                        <Button onClick={copyToClipboard}>Copiar Link</Button>
                    </div>
                </div>
                {/* O componente de setup do formulário é renderizado aqui */}
                <RegistrationFormSetup tournament={tournament} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManageTournamentDetailsScreen;