// Publica uma Edge Function usando o token guardado em .env.local.
//
// POR QUE EXISTE
// O CLI da Supabase guarda UM login por maquina, e esta maquina atende dois sistemas com
// contas diferentes. Sem token explicito, `functions deploy` acerta a conta errada e
// devolve 403 "your account does not have the necessary privileges" — que parece falta de
// permissao no projeto, mas e conta trocada.
//
// A alternativa era `$env:SUPABASE_ACCESS_TOKEN = "..."` antes de cada comando, que vale
// so naquela janela do terminal e se perde na proxima. Aqui o token sai do .env.local,
// que e por pasta e nao vai para o git.
//
// COMO USAR
//   npm run deploy:funcao assistente
//   npm run deploy:funcao send-whatsapp-reminder
//
// Precisa de uma linha no .env.local:
//   SUPABASE_ACCESS_TOKEN=sbp_...
// gerado em https://supabase.com/dashboard/account/tokens, LOGADO NA CONTA DONA DO
// PROJETO desta pasta.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function lerEnvLocal() {
    try {
        const env = {};
        for (const linha of readFileSync(join(RAIZ, '.env.local'), 'utf8').split('\n')) {
            const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
            if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
        return env;
    } catch {
        return {};
    }
}

/** Ref do projeto desta pasta, tirado da URL do .env — a mesma que o app usa. */
function refDoProjeto() {
    try {
        const env = readFileSync(join(RAIZ, '.env'), 'utf8');
        return env.match(/VITE_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
    } catch {
        return null;
    }
}

const funcao = process.argv[2];
if (!funcao) {
    console.error('Falta o nome da função.');
    console.error('  npm run deploy:funcao assistente');
    process.exit(1);
}

const env = lerEnvLocal();

// .env.local ganha da variavel de ambiente, e a ordem importa: esta maquina tem um
// SUPABASE_ACCESS_TOKEN fixo, do OUTRO projeto. Ele nao da erro claro — devolve 403
// dizendo falta de privilegio, que parece problema de permissao e e conta trocada.
const token = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
const daMaquina = !env.SUPABASE_ACCESS_TOKEN && !!process.env.SUPABASE_ACCESS_TOKEN;

if (daMaquina) {
    console.warn('AVISO: usando o SUPABASE_ACCESS_TOKEN do ambiente da máquina.');
    console.warn('Essa variável é global e pode ser de outro projeto. Se der 403 falando');
    console.warn('em privilégio, é isso: ponha o token certo no .env.local desta pasta.\n');
}

if (!token) {
    console.error('Falta a SUPABASE_ACCESS_TOKEN.');
    console.error('');
    console.error('Acrescente uma linha ao .env.local (que não vai para o git):');
    console.error('  SUPABASE_ACCESS_TOKEN=sbp_...');
    console.error('');
    console.error('Gere em https://supabase.com/dashboard/account/tokens, logado na conta');
    console.error('dona deste projeto. Conta errada dá 403 dizendo falta de privilégio.');
    process.exit(1);
}

if (!token.startsWith('sbp_')) {
    console.error('O valor de SUPABASE_ACCESS_TOKEN não parece um token pessoal (esperado: sbp_...).');
    process.exit(1);
}

const ref = refDoProjeto();
console.log(`Publicando "${funcao}"${ref ? ` no projeto ${ref}` : ''}...\n`);

const r = spawnSync(
    'npx',
    ['supabase', 'functions', 'deploy', funcao, ...(ref ? ['--project-ref', ref] : [])],
    { stdio: 'inherit', env: { ...process.env, SUPABASE_ACCESS_TOKEN: token }, shell: true },
);

if (r.status !== 0) {
    console.error('\nFalhou. Se a mensagem falar em privilégio, o token é de outra conta:');
    console.error('confira em qual conta o projeto aparece e gere o token por lá.');
}
process.exit(r.status ?? 1);
