import React, { useState } from 'react';
import { AdminPlayer } from '../../data/mockDatabase';
import Button from '../Button';

interface ManagePlayersProps {
  players: AdminPlayer[];
  onCreatePlayer: (playerData: Omit<AdminPlayer, 'id'>) => void;
}

const ManagePlayers: React.FC<ManagePlayersProps> = ({ players, onCreatePlayer }) => {
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim() && cpf.trim() && email.trim() && password.trim()) {
      onCreatePlayer({ fullName, cpf, email });
      // Reset form fields
      setFullName('');
      setCpf('');
      setEmail('');
      setPassword('');
    } else {
      alert('Por favor, preencha todos os campos.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Player Section */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Cadastrar Novo Jogador</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1">Nome Completo</label>
              <input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
            </div>
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">CPF</label>
              <input id="cpf" type="text" value={cpf} onChange={e => setCpf(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
            </div>
          </div>
          <div className="text-right pt-2">
            <Button type="submit">Cadastrar Jogador</Button>
          </div>
        </form>
      </div>

      {/* Existing Players List */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Jogadores Cadastrados</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-600">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Nome Completo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">CPF</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-600">
              {players.map(player => (
                <tr key={player.id}>
                  <td className="px-4 py-3 font-medium">{player.fullName}</td>
                  <td className="px-4 py-3 text-gray-300">{player.cpf}</td>
                  <td className="px-4 py-3 text-gray-300">{player.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {players.length === 0 && <p className="text-center text-gray-400 py-4">Nenhum jogador cadastrado ainda.</p>}
        </div>
      </div>
    </div>
  );
};

export default ManagePlayers;