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
    // `@typescript-eslint/no-explicit-any` fica como ERRO, que é o padrão do preset.
    // Foi rebaixado a aviso por um tempo, enquanto existiam 42 ocorrências herdadas;
    // todas foram tipadas e a exceção saiu junto. Para ler erro dentro de `catch`, use
    // `mensagemDeErro`/`codigoDeErro` de src/lib/erro.ts em vez de `catch (e: any)`.
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
