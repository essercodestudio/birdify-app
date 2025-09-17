import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicyScreen: React.FC = () => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-gray-300">
        <h1 className="text-3xl font-bold text-white mb-4">Política de Privacidade</h1>
        <div className="space-y-4">
            <p>A sua privacidade é importante para nós. É política do Birdify respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar no site Birdify.</p>
            <h2 className="text-xl font-bold text-white pt-2">1. Que dados coletamos?</h2>
            <p>Coletamos informações pessoais que você nos fornece diretamente, como nome completo, e-mail e género, quando você se regista na nossa aplicação.</p>
            <h2 className="text-xl font-bold text-white pt-2">2. Como usamos os seus dados?</h2>
            <p>Usamos os seus dados para operar e manter a sua conta, para o identificar nos torneios de golfe e para comunicar consigo sobre os seus resultados e eventos.</p>
            <h2 className="text-xl font-bold text-white pt-2">3. Segurança dos dados</h2>
            <p>Empregamos medidas de segurança técnicas, como a encriptação de senhas e comunicação via HTTPS, para proteger os seus dados contra acesso, alteração ou destruição não autorizados.</p>
            <h2 className="text-xl font-bold text-white pt-2">4. Os seus direitos</h2>
            <p>Você tem o direito de aceder, corrigir ou apagar as suas informações pessoais a qualquer momento através do seu perfil na aplicação.</p>
            <p>O uso continuado de nosso site será considerado como aceitação de nossas práticas em torno de privacidade e informações pessoais. Se tiver alguma dúvida sobre como lidamos com dados do utilizador e informações pessoais, entre em contacto connosco.</p>
        </div>
        <Link to="/" className="text-green-400 hover:text-green-300 mt-6 inline-block">&larr; Voltar à página principal</Link>
    </div>
);
export default PrivacyPolicyScreen;