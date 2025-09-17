import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfUseScreen: React.FC = () => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-gray-300">
        <h1 className="text-3xl font-bold text-white mb-4">Termos de Uso</h1>
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white pt-2">1. Uso da Licença</h2>
            <p>É concedida permissão para usar a aplicação Birdify apenas para fins pessoais e relacionados com os torneios de golfe organizados. Esta é a concessão de uma licença, não uma transferência de título.</p>
            <h2 className="text-xl font-bold text-white pt-2">2. Responsabilidades do Utilizador</h2>
            <p>Você é responsável por manter a confidencialidade da sua senha e por todas as atividades que ocorram sob a sua conta. Você concorda em notificar-nos imediatamente sobre qualquer uso não autorizado da sua conta.</p>
             <h2 className="text-xl font-bold text-white pt-2">3. Limitações</h2>
            <p>Em nenhum caso o Birdify ou seus fornecedores serão responsáveis por quaisquer danos decorrentes do uso ou da incapacidade de usar os materiais no Birdify.</p>
        </div>
        <Link to="/" className="text-green-400 hover:text-green-300 mt-6 inline-block">&larr; Voltar à página principal</Link>
    </div>
);
export default TermsOfUseScreen;