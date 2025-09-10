/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // adicione outras variáveis de ambiente que você venha a criar aqui
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}