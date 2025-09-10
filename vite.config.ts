// vite.config.ts - VERSÃO CORRIGIDA E SIMPLIFICADA

import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})