// screens/TermsOfUseScreen.tsx

import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfUseScreen: React.FC = () => (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl text-gray-300 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Termos e Condições de Uso</h1>
        <p className="text-sm text-gray-500 mb-6">Última atualização: 24 de setembro de 2025</p>

        <div className="space-y-6 prose prose-invert max-w-none">
            <p>Bem-vindo ao Birdify! Ao aceder e utilizar a nossa aplicação web (a "Plataforma"), você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso. Por favor, leia-os com atenção.</p>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta ou usar a Plataforma, você firma um acordo legalmente vinculativo com o Birdify e concorda com estes Termos de Uso e com a nossa <Link to="/privacy-policy" className="text-green-400 hover:underline">Política de Privacidade</Link>.</p>
            
            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">2. Descrição do Serviço</h2>
            <p>O Birdify é uma plataforma para gestão e marcação de pontuações de torneios de golfe. Os serviços incluem, mas não se limitam a, registro de jogadores, criação de grupos, marcação de scores em tempo real e visualização de leaderboards.</p>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">3. Responsabilidades do Utilizador</h2>
            <ul>
                <li><strong>Exatidão das Informações:</strong> Você concorda em fornecer informações verdadeiras, exatas e completas ao se registrar e em mantê-las atualizadas.</li>
                <li><strong>Segurança da Conta:</strong> Você é o único responsável por manter a confidencialidade da sua senha e por todas as atividades que ocorram na sua conta.</li>
                <li><strong>Conduta Apropriada:</strong> Você concorda em não usar a Plataforma para qualquer finalidade ilegal ou proibida por estes termos. A responsabilidade pela inserção correta das pontuações é do jogador designado como "marcador" do grupo.</li>
            </ul>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">4. Propriedade Intelectual</h2>
            <p>Todo o conteúdo presente na Plataforma, incluindo o design, textos, gráficos, logotipos e software, é propriedade exclusiva do Birdify e protegido por leis de direitos autorais e propriedade intelectual.</p>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">5. Limitação de Responsabilidade</h2>
            <p>A Plataforma é fornecida "como está". Em nenhuma circunstância o Birdify será responsável por quaisquer danos diretos, indiretos, incidentais ou consequenciais resultantes do uso ou da incapacidade de usar o serviço, incluindo a perda de dados ou interrupção de negócios. Não garantimos a precisão absoluta dos cálculos de pontuação, que dependem da correta inserção de dados pelos utilizadores.</p>
            
            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">6. Rescisão</h2>
            <p>Reservamo-nos o direito de suspender ou encerrar sua conta e o seu acesso à Plataforma, sem aviso prévio, por qualquer violação destes Termos de Uso.</p>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">7. Lei Aplicável</h2>
            <p>Estes termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil, e você se submete irrevogavelmente à jurisdição exclusiva dos tribunais nesse local.</p>
        </div>
        <div className="mt-8 pt-4 border-t border-gray-700">
            <Link to="/" className="text-green-400 hover:text-green-300 mt-6 inline-block">&larr; Voltar à página principal</Link>
        </div>
    </div>
);
export default TermsOfUseScreen;