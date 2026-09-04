/**
 * Backup do banco para arquivo local.
 *
 * POR QUE EXISTE
 * O plano gratuito da Supabase nao faz backup nenhum. O crediario inteiro — quem deve
 * quanto, quanto ja pagou, o que vence quando — existe em um lugar so. Um DELETE errado,
 * uma migration ruim ou o projeto pausado por inatividade e a informacao acaba. Rodar
 * este script e, hoje, a unica rede de seguranca do sistema.
 *
 * COMO RODAR
 *   SUPABASE_SERVICE_ROLE_KEY=<chave> npm run backup
 *
 * A chave service_role e obrigatoria e e validada pelo _cliente.mjs. A anon NAO serve:
 * com o RLS ligado ela le menos linhas e nao reclama — o backup sairia pela metade sem
 * nenhum aviso, que e a pior falha possivel para um backup.
 *
 * O QUE ENTRA
 * As nove tabelas do schema public, cada uma paginada e conferida contra a contagem que
 * o proprio servidor informou. Se faltar uma linha, o script aborta e nao grava nada.
 *
 * O QUE NAO ENTRA
 * As fotos do bucket product-images. Sao centenas de MB e mudam pouco; a copia local
 * delas e o backup-imagens/. Perder foto e chato, perder o crediario e fatal.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { conectar, RAIZ, kb } from './_cliente.mjs';

// Ordem de restauracao: uma tabela so aparece depois daquelas de que ela depende, para
// que um restore feito de cima para baixo nao esbarre em chave estrangeira.
const TABELAS = [
    'clientes',
    'fornecedores',
    'contas_pagar',
    'produtos',
    'vendas',
    'itens_venda',
    'parcelas_pagar',
    'parcelas_venda',
    'configuracoes_notificacoes',
];

// O PostgREST da Supabase devolve no maximo 1000 linhas por requisicao — pedir 5000 traz
// 1000 e nenhum aviso. Por isso a leitura e paginada, e por isso a conferencia contra o
// `count` do servidor nao e zelo excessivo: e o unico sinal de que a pagina seguinte
// existe. Se um dia o teto do servidor cair abaixo deste valor, o laco para cedo e a
// conferencia aborta — falha barulhenta em vez de backup pela metade.
const PAGINA = 1000;

/**
 * Le a tabela inteira, paginando. Aborta se chegar menos do que o servidor prometeu:
 * e melhor nao ter backup do que ter um backup incompleto em que se confia.
 */
async function lerTabela(supabase, tabela) {
    const linhas = [];
    let esperados = null;

    for (let de = 0; ; de += PAGINA) {
        const { data, error, count } = await supabase
            .from(tabela)
            .select('*', { count: 'exact' })
            .range(de, de + PAGINA - 1);

        if (error) throw new Error(`${tabela}: ${error.message}`);
        if (esperados === null) esperados = count ?? 0;
        if (!data || data.length === 0) break;

        linhas.push(...data);
        if (data.length < PAGINA) break;
    }

    if (esperados !== null && linhas.length !== esperados) {
        throw new Error(
            `${tabela}: leitura incompleta — o servidor informou ${esperados} linhas, mas ${linhas.length} chegaram.`
        );
    }
    return linhas;
}

/** Carimbo em horario de Brasilia. O servidor pensa em UTC; a loja, nao. */
function carimbo() {
    const agora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    return agora.replace(' ', '_').replaceAll(':', '-');
}

const main = async () => {
    const supabase = conectar();

    const dados = {};
    const contagem = {};

    for (const tabela of TABELAS) {
        process.stdout.write(`  ${tabela.padEnd(28)}`);
        const linhas = await lerTabela(supabase, tabela);
        dados[tabela] = linhas;
        contagem[tabela] = linhas.length;
        console.log(`${String(linhas.length).padStart(6)} linhas`);
    }

    const pasta = join(RAIZ, 'backups');
    mkdirSync(pasta, { recursive: true });

    const arquivo = join(pasta, `backup_${carimbo()}.json`);
    const conteudo = JSON.stringify(
        {
            gerado_em: new Date().toISOString(),
            fuso_referencia: 'America/Sao_Paulo',
            ordem_de_restauracao: TABELAS,
            contagem,
            dados,
        },
        null,
        2
    );

    writeFileSync(arquivo, conteudo, 'utf8');

    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    console.log(`\n${total} linhas em ${arquivo} (${kb(Buffer.byteLength(conteudo))})`);
    console.log('\nEste arquivo contem CPF e telefone de clientes. backups/ esta no');
    console.log('.gitignore de proposito — nao versione e nao mande por e-mail.');
};

main().catch((e) => {
    console.error(`\nAbortado: ${e.message}`);
    console.error('Nenhum arquivo foi gravado.');
    // exitCode em vez de process.exit(): com o cliente do Supabase ainda com conexao
    // aberta, sair de forma abrupta dispara uma assercao do libuv no Windows e o erro
    // de verdade some no meio do ruido.
    process.exitCode = 1;
});
