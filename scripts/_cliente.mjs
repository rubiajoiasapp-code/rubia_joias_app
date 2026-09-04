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

function lerArquivoEnv(nome) {
    const env = {};
    try {
        for (const linha of readFileSync(join(RAIZ, nome), 'utf8').split('\n')) {
            const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
            if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    } catch {
        // arquivo ausente: segue com o que ja tem
    }
    return env;
}

function lerEnv() {
    return lerArquivoEnv('.env');
}

/**
 * A service_role sai daqui, e so daqui.
 *
 * Nao de `.env`: neste repositorio o `.env` esta VERSIONADO — uma service_role ali vai
 * para o GitHub no proximo commit, e ela ignora RLS por definicao. `.env.local` cai no
 * `*.local` do .gitignore.
 *
 * Existe tambem para nao depender de sintaxe de terminal: `VAR=valor comando` e Bash e
 * quebra no PowerShell, que e o terminal padrao desta maquina.
 */
function lerChaveLocal() {
    return lerArquivoEnv('.env.local').SUPABASE_SERVICE_ROLE_KEY;
}

/** Decodifica o payload de uma chave em formato JWT. Null para o formato sb_secret_. */
function payload(k) {
    const partes = k.split('.');
    if (partes.length !== 3) return null;
    try {
        return JSON.parse(Buffer.from(partes[1], 'base64url').toString());
    } catch {
        return null;
    }
}

/** A chave e mesmo service_role? Chave de menor privilegio le menos e nao avisa. */
function ehServiceRole(k) {
    if (k.startsWith('sb_secret_')) return true; // formato novo de chave secreta
    return payload(k)?.role === 'service_role';
}

/** O ref do projeto embutido na URL: https://<ref>.supabase.co */
function refDaUrl(url) {
    return url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? null;
}

export function conectar() {
    const env = lerEnv();
    const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
    // .env.local ganha da variavel de ambiente: a variavel e global da maquina e pode
    // ser de outro projeto, o arquivo e desta pasta.
    const chave = lerChaveLocal() || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        console.error('Faltou VITE_SUPABASE_URL (.env ou variavel de ambiente).');
        process.exit(1);
    }
    if (!chave) {
        console.error('Faltou a SUPABASE_SERVICE_ROLE_KEY.');
        console.error('');
        console.error('Crie um arquivo .env.local na raiz do projeto com uma linha:');
        console.error('  SUPABASE_SERVICE_ROLE_KEY=cole-a-chave-aqui');
        console.error('');
        console.error('A chave fica em Settings > API no painel da Supabase, como');
        console.error('"service_role" ou "secret". O .env.local nao vai para o git.');
        console.error('');
        console.error('A chave anon NAO serve: com o RLS ligado ela le menos linhas e');
        console.error('nao reclama — o resultado sairia incompleto sem nenhum aviso.');
        process.exit(1);
    }
    if (!ehServiceRole(chave)) {
        console.error('A chave em SUPABASE_SERVICE_ROLE_KEY nao e uma service_role.');
        console.error('Rodar com chave de menor privilegio corromperia o resultado. Abortado.');
        process.exit(1);
    }

    // A chave pertence a ESTE projeto? Uma service_role de outro projeto na variavel de
    // ambiente e cenario real quando se mantem mais de um sistema na mesma maquina — a
    // variavel e global, o .env e por pasta. No melhor caso o script so falha; no pior,
    // com a URL certa e a chave de outro banco, escreve no lugar errado com poder total.
    const refUrl = refDaUrl(url);
    const refChave = payload(chave)?.ref;
    if (refUrl && refChave && refUrl !== refChave) {
        console.error('A chave e de OUTRO projeto Supabase.');
        console.error(`  .env aponta para o projeto : ${refUrl}`);
        console.error(`  a chave pertence ao projeto: ${refChave}`);
        console.error('Abortado antes de tocar em qualquer dado.');
        console.error('Passe a chave certa na hora de rodar, em vez de deixar no ambiente:');
        console.error('  SUPABASE_SERVICE_ROLE_KEY=<chave> npm run backup');
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
