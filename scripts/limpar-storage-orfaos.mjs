/**
 * limpar-storage-orfaos.mjs
 *
 * Remove do bucket `product-images` os arquivos que nenhum produto referencia.
 *
 * POR QUE EXISTEM ORFAOS
 * O upload em src/pages/Inventory.tsx monta o nome como `${codigo}_${Date.now()}.ext`.
 * Trocar a foto de uma peca grava um arquivo novo e ate agora nunca apagava o anterior;
 * apagar um produto remove a linha e deixa a imagem para tras. Os dois casos viram lixo.
 *
 * SEGURANCA
 * - DRY-RUN por padrao. So apaga com --apply.
 * - Exige service_role e valida a chave (ver scripts/_cliente.mjs) — com a chave anon o
 *   RLS esconde os produtos fora do catalogo e as fotos deles pareceriam lixo.
 * - Aborta se a leitura dos produtos vier incompleta.
 * - Refaz o cruzamento na hora: nao ha lista fixa que possa envelhecer.
 * - Ignora arquivos com menos de 24h, que podem ser upload em andamento.
 *
 * Apagar por `DELETE FROM storage.objects` no SQL Editor NAO libera espaco: remove o
 * registro e deixa o arquivo no S3. Tem que ser pela API de storage, que e o que este
 * script usa.
 *
 * USO
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."      # painel: Settings > API
 *   node scripts/limpar-storage-orfaos.mjs            # so lista (dry-run)
 *   node scripts/limpar-storage-orfaos.mjs --apply    # apaga de verdade
 */

import { conectar, caminhosEmUso, listarBucket, BUCKET, mb } from './_cliente.mjs';

const APLICAR = process.argv.includes('--apply');
const IDADE_MINIMA_MS = 24 * 60 * 60 * 1000;

async function main() {
    const supabase = conectar();
    console.log(`Bucket: ${BUCKET}   modo: ${APLICAR ? 'APLICAR (vai apagar)' : 'dry-run (nao apaga nada)'}\n`);

    const arquivos = await listarBucket(supabase);
    console.log(`Arquivos no bucket: ${arquivos.length} (${mb(arquivos.reduce((s, a) => s + a.bytes, 0))})`);

    const { emUso, lidos } = await caminhosEmUso(supabase);
    console.log(`Produtos com imagem: ${lidos}   caminhos referenciados: ${emUso.size}`);

    const agora = Date.now();
    const orfaos = [];
    let recentesIgnorados = 0;

    for (const a of arquivos) {
        if (emUso.has(a.caminho)) continue;
        if (a.criadoEm && agora - new Date(a.criadoEm).getTime() < IDADE_MINIMA_MS) {
            recentesIgnorados++;
            continue;
        }
        orfaos.push(a);
    }

    // Backstop: se metade do bucket virou orfao, a leitura provavelmente falhou.
    // A defesa principal e a validacao da chave em _cliente.mjs; esta e a segunda linha.
    if (arquivos.length > 0 && orfaos.length > arquivos.length * 0.5) {
        console.error(`\nABORTADO: ${orfaos.length} de ${arquivos.length} arquivos apareceram como orfaos.`);
        console.error('Isso sugere falha ao carregar os produtos, nao lixo de verdade. Nada foi apagado.');
        process.exit(1);
    }

    console.log(`Orfaos: ${orfaos.length} (${mb(orfaos.reduce((s, a) => s + a.bytes, 0))})`);
    if (recentesIgnorados) console.log(`Ignorados por terem menos de 24h: ${recentesIgnorados}`);

    if (orfaos.length === 0) {
        console.log('\nNada a fazer.');
        return;
    }

    console.log('\n--- arquivos ---');
    for (const o of orfaos) console.log(`  ${o.caminho}  (${mb(o.bytes)})`);

    if (!APLICAR) {
        console.log(`\nDry-run. Para apagar de verdade:\n  node scripts/limpar-storage-orfaos.mjs --apply`);
        return;
    }

    console.log('\nApagando...');
    let apagados = 0;
    for (let i = 0; i < orfaos.length; i += 100) {
        const lote = orfaos.slice(i, i + 100).map((o) => o.caminho);
        const { error } = await supabase.storage.from(BUCKET).remove(lote);
        if (error) throw new Error(`Falha ao apagar lote: ${error.message}`);
        apagados += lote.length;
        console.log(`  ${apagados}/${orfaos.length}`);
    }
    console.log(`\nPronto: ${apagados} arquivos removidos, ${mb(orfaos.reduce((s, a) => s + a.bytes, 0))} liberados.`);
}

main().catch((e) => {
    console.error(`\nErro: ${e.message}`);
    process.exit(1);
});
