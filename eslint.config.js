import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Dívida conhecida, rebaixada de propósito para "aviso" em vez de "erro".
      //
      // São ~42 ocorrências. Cerca de metade é `catch (error: any)`, mecânica de
      // corrigir. A outra metade tipa linhas vindas do Supabase e props de gráfico
      // dentro de Credit.tsx, Dashboard.tsx e Historico.tsx — os arquivos maiores e
      // mais sensíveis do sistema, sem um único teste cobrindo. Trocar `any` por
      // tipos de verdade ali é uma boa ideia DEPOIS que existir teste, não antes.
      //
      // Como erro, isto deixaria o CI vermelho desde o primeiro dia, e CI que vive
      // vermelho ninguém olha. Como aviso, a contagem aparece em toda execução e
      // serve de placar para ir baixando.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // useAuth mora junto com o AuthProvider. Separar em outro arquivo mudaria o import
    // de toda página do sistema, e o único ganho seria o fast refresh do dev server —
    // não vale o risco no app em produção. Revisitar se o arquivo crescer.
    files: ['src/contexts/AuthContext.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
