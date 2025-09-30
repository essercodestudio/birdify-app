// screens/PrivacyPolicyScreen.tsx

import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicyScreen: React.FC = () => (
    <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl text-gray-300 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-6">Última atualização: 24 de setembro de 2025</p>
        
        <div className="space-y-6 prose prose-invert max-w-none">
            <p>A sua privacidade é de extrema importância para o Birdify ("nós", "nosso"). Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos as suas informações pessoais quando você utiliza a nossa aplicação web (a "Plataforma"). Este documento foi elaborado em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/18).</p>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">1. Informações que Coletamos</h2>
            <p>Coletamos os seguintes tipos de informações:</p>
            <ul>
                <li><strong>Dados de Identificação Pessoal:</strong> Informações que você nos fornece voluntariamente ao criar uma conta, como seu nome completo, endereço de e-mail e género.</li>
                <li><strong>Dados de Uso da Plataforma:</strong> Informações sobre sua interação com a Plataforma, incluindo pontuações (scores) inseridas, torneios em que participa, grupos criados e handicaps de campo.</li>
                <li><strong>Informações Técnicas:</strong> Podemos coletar informações técnicas do seu dispositivo, como endereço IP, tipo de navegador e sistema operacional, para fins de segurança e análise.</li>
            </ul>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">2. Finalidade da Coleta de Dados</h2>
            <p>As suas informações são utilizadas para as seguintes finalidades:</p>
            <ul>
                <li><strong>Operação da Plataforma:</strong> Para criar e gerenciar sua conta, permitir a marcação de scores, gerar leaderboards e administrar torneios.</li>
                <li><strong>Comunicação:</strong> Para enviar comunicações importantes sobre a sua conta, torneios ou atualizações na Plataforma.</li>
                <li><strong>Segurança:</strong> Para proteger a Plataforma contra fraudes e garantir a segurança dos nossos utilizadores.</li>
                <li><strong>Melhoria Contínua:</strong> Para analisar dados de uso de forma anônima, a fim de entender como nossos utilizadores interagem com a Plataforma e como podemos melhorá-la.</li>
            </ul>
            
            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">3. Compartilhamento de Informações</h2>
            <p>Nós não vendemos, alugamos ou trocamos suas informações pessoais com terceiros. Suas informações podem ser compartilhadas nas seguintes circunstâncias:</p>
            <ul>
                <li><strong>Publicamente em Leaderboards:</strong> Seu nome e suas pontuações serão visíveis publicamente nos leaderboards dos torneios em que você participar.</li>
                <li><strong>Com Administradores de Torneios:</strong> Os administradores dos torneios nos quais você se inscreve terão acesso aos seus dados de inscrição e pontuação para fins de gestão do evento.</li>
                <li><strong>Por Obrigação Legal:</strong> Poderemos divulgar suas informações se formos obrigados por lei, intimação ou outro processo legal.</li>
            </ul>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">4. Segurança dos Seus Dados</h2>
            <p>Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações pessoais. As senhas são armazenadas de forma criptografada (hash), e toda a comunicação com nossos servidores é protegida por criptografia SSL/TLS.</p>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">5. Seus Direitos como Titular dos Dados</h2>
            <p>De acordo com a LGPD, você tem o direito de:</p>
            <ul>
                <li><strong>Confirmar</strong> a existência de tratamento dos seus dados.</li>
                <li><strong>Aceder</strong> aos seus dados a qualquer momento.</li>
                <li><strong>Corrigir</strong> dados incompletos, inexatos ou desatualizados.</li>
                <li><strong>Solicitar a eliminação</strong> dos seus dados pessoais, que será atendida, exceto nas hipóteses de conservação previstas em lei.</li>
            </ul>
            <p>Você pode exercer a maioria desses direitos diretamente através da sua página de perfil na Plataforma. Para outras solicitações, entre em contacto connosco.</p>

            <h2 className="text-xl font-bold text-white pt-4 border-t border-gray-700/50">6. Alterações a esta Política</h2>
            <p>Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre quaisquer alterações publicando a nova política nesta página. Recomendamos que você revise esta página periodicamente para quaisquer alterações.</p>
        </div>
        <div className="mt-8 pt-4 border-t border-gray-700">
             <Link to="/" className="text-green-400 hover:text-green-300 mt-6 inline-block">&larr; Voltar à página principal</Link>
        </div>
    </div>
);
export default PrivacyPolicyScreen;