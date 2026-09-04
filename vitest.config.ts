import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        // src/lib/supabase.ts lança na importação se faltar variável de ambiente, e
        // clientTier/clientScore o importam. Valores de mentira bastam: nenhum teste
        // chega a fazer requisição — o que se testa aqui é lógica pura. Definir aqui,
        // em vez de depender do .env, mantém o teste igual na sua máquina e no CI.
        env: {
            VITE_SUPABASE_URL: 'http://localhost:54321',
            VITE_SUPABASE_ANON_KEY: 'chave-de-teste',
        },
    },
});
