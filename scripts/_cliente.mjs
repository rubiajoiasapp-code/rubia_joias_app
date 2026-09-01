/**
 * Cliente Supabase compartilhado pelos scripts de manutencao.
 *
 * Todo script daqui exige a chave service_role. O motivo nao e conveniencia: com o RLS
 * ligado, a chave anon so enxerga produtos com show_in_catalog = true (528 dos 795 com
 * imagem). Uma leitura com ela nao falha — ela volta INCOMPLETA, em silencio. Como esses
 * scripts decidem o que apagar comparando arquivos contra produtos, uma leitura parcial
 * classificaria fotos em uso como lixo. Por isso a chave e validada, nao so exigida.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BUCKET = 'product-images';

function lerEnv() {
    const env = {};
    try {
        for (const linha of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
            const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
            if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    } catch {
        // sem .env: usa as variaveis do processo
    }
    return env;
}

/** A chave e mesmo service_role? Chave de menor privilegio le menos e nao avisa. */
function ehServiceRole(k) {
    if (k.startsWith('sb_secret_')) return true; // formato novo de chave secreta
    const partes = k.split('.');
    if (partes.length !== 3) return false;
    try {
        return JSON.parse(Buffer.from(partes[1], 'base64url').toString()).role === 'service_role';
    } catch {
        return false;
    }
}

export function conectar() {
    const env = lerEnv();
    const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        console.error('Faltou VITE_SUPABASE_URL (.env ou variavel de ambiente).');
        process.exit(1);
    }
    if (!chave) {
        console.error('Faltou SUPABASE_SERVICE_ROLE_KEY.');
        console.error('A chave anon NAO serve: o RLS esconde dela os produtos fora do catalogo,');
        console.error('e as fotos deles seriam tratadas como lixo.');
        console.error('Pegue a service_role no painel da Supabase: Settings > API.');
        process.exit(1);
    }
    if (!ehServiceRole(chave)) {
        console.error('A chave em SUPABASE_SERVICE_ROLE_KEY nao e uma service_role.');
        console.error('Rodar com chave de menor privilegio corromperia o resultado. Abortado.');
        process.exit(1);
    }

    return createClient(url, chave, { auth: { persistSession: false } });
}

/**
 * Caminhos de storage referenciados por algum produto — a definicao de "em uso".
 * `produtos.image_url` e a unica coluna do schema public que aponta para storage.
 *
 * Aborta se a leitura vier incompleta: e melhor nao fazer nada do que decidir o que
 * apagar com metade da lista.
 */
export async function caminhosEmUso(supabase) {
    const emUso = new Set();
    let lidos = 0;
    let esperados = null;

    for (let de = 0; ; de += 1000) {
        const { data, error, count } = await supabase
            .from('produtos')
            .select('image_url', { count: 'exact' })
            .not('image_url', 'is', null)
            .range(de, de + 999);
        if (error) throw new Error(`Falha ao ler produtos: ${error.message}`);
        if (esperados === null) esperados = count;
        if (!data || data.length === 0) break;
        for (const { image_url } of data) {
            const m = image_url?.match(new RegExp(`/${BUCKET}/(.*)$`));
            if (m) emUso.add(decodeURIComponent(m[1]));
        }
        lidos += data.length;
        if (data.length < 1000) break;
    }

    if (esperados !== null && lidos !== esperados) {
        throw new Error(
            `Leitura incompleta: o servidor informou ${esperados} produtos com imagem, mas so ${lidos} chegaram.`
        );
    }
    return { emUso, lidos };
}

/** Lista o bucket inteiro, descendo nas pastas e paginando de 100 em 100. */
export async function listarBucket(supabase, prefixo = '') {
    const encontrados = [];
    let offset = 0;
    for (;;) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(prefixo, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw new Error(`Falha ao listar "${prefixo}": ${error.message}`);
        if (!data || data.length === 0) break;

        for (const item of data) {
            const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
            // Entrada sem id e pasta: desce nela.
            if (item.id === null) encontrados.push(...(await listarBucket(supabase, caminho)));
            else encontrados.push({ caminho, criadoEm: item.created_at, bytes: item.metadata?.size ?? 0 });
        }
        if (data.length < 100) break;
        offset += 100;
    }
    return encontrados;
}

export const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
export const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
