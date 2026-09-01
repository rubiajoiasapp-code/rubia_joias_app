/**
 * comprimir-imagens.mjs
 *
 * Reduz o peso das fotos de produto no bucket `product-images`.
 *
 * O DIAGNOSTICO
 * As fotos sobem direto da camera do celular, em 4000x2252. Medido no acervo real:
 * 342 arquivos acima de 1 MB somam 574 MB — 90% do espaco usado. Os outros 453 somam
 * 62 MB e ja estao num tamanho saudavel (mediana 213 KB). Entao o alvo sao os pesados.
 * Em amostra de 6 arquivos reais, 1600px de lado maior com JPEG q82 reduziu 94% sem
 * perda visivel de detalhe (letras, zirconias e elos da corrente intactos).
 *
 * POR QUE E SEGURO PARA A PRODUCAO
 * - Sobrescreve no MESMO caminho. `produtos.image_url` nao muda; o banco nao e tocado.
 * - Antes de sobrescrever, grava o original em backup-imagens/. Se o backup falhar,
 *   o arquivo e pulado — nunca se sobrescreve sem copia.
 * - `--restore` devolve tudo a partir desse backup.
 * - So mexe em arquivos EM USO e acima do limite; nao decide o que apagar (isso e do
 *   limpar-storage-orfaos.mjs).
 * - Pula qualquer arquivo cuja compressao economize menos que o minimo: sem churn.
 *
 * USO
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."      # painel: Settings > API
 *   node scripts/comprimir-imagens.mjs                  # dry-run + amostras locais
 *   node scripts/comprimir-imagens.mjs --apply          # comprime de verdade
 *   node scripts/comprimir-imagens.mjs --restore        # desfaz, a partir do backup
 *
 * Opcoes: --min-bytes=1000000  --max-dim=1600  --quality=82  --sample=8
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { conectar, caminhosEmUso, listarBucket, RAIZ, BUCKET, mb, kb } from './_cliente.mjs';

const arg = (nome, padrao) => {
    const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
    return a ? Number(a.split('=')[1]) : padrao;
};
const APLICAR = process.argv.includes('--apply');
const RESTAURAR = process.argv.includes('--restore');
const MIN_BYTES = arg('min-bytes', 1_000_000);
const MAX_DIM = arg('max-dim', 1600);
const QUALIDADE = arg('quality', 82);
const AMOSTRA = arg('sample', 8);
const ECONOMIA_MINIMA = 0.25; // abaixo disso nao compensa reescrever o arquivo

const DIR_BACKUP = join(RAIZ, 'backup-imagens');
const DIR_AMOSTRA = join(RAIZ, 'amostras-compressao');

const comprimir = (buf) =>
    sharp(buf)
        .rotate() // aplica a orientacao do EXIF antes de redimensionar
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: QUALIDADE, mozjpeg: true })
        .toBuffer();

async function baixar(supabase, caminho) {
    const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
    if (error) throw new Error(`download falhou: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
}

async function enviar(supabase, caminho, buf) {
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, buf, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600',
    });
    if (error) throw new Error(`upload falhou: ${error.message}`);
}

/** Percorre backup-imagens/ e devolve os caminhos relativos ao bucket. */
function listarBackup(dir = DIR_BACKUP, base = DIR_BACKUP) {
    if (!existsSync(dir)) return [];
    const saida = [];
    for (const nome of readdirSync(dir)) {
        const completo = join(dir, nome);
        if (statSync(completo).isDirectory()) saida.push(...listarBackup(completo, base));
        else saida.push(completo.slice(base.length + 1).split('\\').join('/'));
    }
    return saida;
}

async function restaurar(supabase) {
    const arquivos = listarBackup();
    if (arquivos.length === 0) {
        console.error(`Nada em ${DIR_BACKUP}. Sem backup nao ha o que restaurar.`);
        process.exit(1);
    }
    console.log(`Restaurando ${arquivos.length} arquivos a partir de backup-imagens/...\n`);
    let ok = 0;
    for (const caminho of arquivos) {
        try {
            await enviar(supabase, caminho, readFileSync(join(DIR_BACKUP, caminho)));
            ok++;
            if (ok % 25 === 0) console.log(`  ${ok}/${arquivos.length}`);
        } catch (e) {
            console.error(`  FALHOU ${caminho}: ${e.message}`);
        }
    }
    console.log(`\nRestaurados ${ok} de ${arquivos.length}.`);
}

async function main() {
    const supabase = conectar();

    if (RESTAURAR) return restaurar(supabase);

    console.log(`Bucket: ${BUCKET}`);
    console.log(`Modo: ${APLICAR ? 'APLICAR (sobrescreve no bucket)' : 'dry-run (nao envia nada)'}`);
    console.log(`Alvo: arquivos em uso acima de ${mb(MIN_BYTES)} | max ${MAX_DIM}px | qualidade ${QUALIDADE}\n`);

    const { emUso, lidos } = await caminhosEmUso(supabase);
    console.log(`Produtos com imagem: ${lidos}`);

    const arquivos = await listarBucket(supabase);
    const candidatos = arquivos
        .filter((a) => emUso.has(a.caminho) && a.bytes > MIN_BYTES)
        .sort((x, y) => y.bytes - x.bytes);

    const totalAntes = candidatos.reduce((s, a) => s + a.bytes, 0);
    console.log(`Arquivos no bucket: ${arquivos.length}   em uso: ${emUso.size}`);
    console.log(`Candidatos (em uso e > ${mb(MIN_BYTES)}): ${candidatos.length} (${mb(totalAntes)})\n`);

    if (candidatos.length === 0) {
        console.log('Nada a comprimir.');
        return;
    }

    const alvos = APLICAR ? candidatos : candidatos.slice(0, AMOSTRA);
    if (!APLICAR) {
        mkdirSync(DIR_AMOSTRA, { recursive: true });
        console.log(`Dry-run: processando ${alvos.length} de ${candidatos.length} para medir.`);
        console.log(`As amostras (original e comprimida) vao para amostras-compressao/ para voce conferir.\n`);
    }

    let somaAntes = 0;
    let somaDepois = 0;
    let processados = 0;
    let pulados = 0;
    const falhas = [];

    for (const a of alvos) {
        try {
            const original = await baixar(supabase, a.caminho);
            const menor = await comprimir(original);
            const economia = 1 - menor.length / original.length;

            if (economia < ECONOMIA_MINIMA) {
                pulados++;
                continue;
            }

            if (APLICAR) {
                // Backup ANTES de sobrescrever. Falhou o backup, nao mexe no arquivo.
                const destino = join(DIR_BACKUP, a.caminho);
                mkdirSync(dirname(destino), { recursive: true });
                writeFileSync(destino, original);
                if (statSync(destino).size !== original.length) {
                    throw new Error('backup gravado com tamanho diferente do original');
                }
                await enviar(supabase, a.caminho, menor);
            } else {
                const nome = a.caminho.split('/').pop().replace(/\.jpe?g$/i, '');
                writeFileSync(join(DIR_AMOSTRA, `${nome}_ORIGINAL.jpg`), original);
                writeFileSync(join(DIR_AMOSTRA, `${nome}_COMPRIMIDO.jpg`), menor);
            }

            somaAntes += original.length;
            somaDepois += menor.length;
            processados++;

            const pct = (economia * 100).toFixed(0);
            console.log(
                `  ${a.caminho.split('/').pop().padEnd(30)} ${kb(original.length).padStart(9)} -> ${kb(menor.length).padStart(8)}  (-${pct}%)`
            );
        } catch (e) {
            falhas.push(`${a.caminho}: ${e.message}`);
            console.error(`  FALHOU ${a.caminho}: ${e.message}`);
        }
    }

    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Processados: ${processados}   pulados (economia < ${ECONOMIA_MINIMA * 100}%): ${pulados}   falhas: ${falhas.length}`);
    if (processados > 0) {
        const taxa = 1 - somaDepois / somaAntes;
        console.log(`Neste lote: ${mb(somaAntes)} -> ${mb(somaDepois)}  (-${(taxa * 100).toFixed(1)}%)`);
        if (!APLICAR) {
            const projetado = totalAntes * (1 - taxa);
            console.log(`\nProjecao para os ${candidatos.length} candidatos:`);
            console.log(`  ${mb(totalAntes)} -> ~${mb(projetado)}   economia ~${mb(totalAntes - projetado)}`);
            console.log(`\nConfira as imagens em amostras-compressao/ e, se aprovar:`);
            console.log(`  node scripts/comprimir-imagens.mjs --apply`);
        } else {
            console.log(`Originais preservados em backup-imagens/ (${mb(somaAntes)}).`);
            console.log(`Para desfazer: node scripts/comprimir-imagens.mjs --restore`);
        }
    }
    if (falhas.length) {
        console.log(`\nArquivos que falharam (seguem intactos no bucket):`);
        for (const f of falhas) console.log(`  ${f}`);
    }
}

main().catch((e) => {
    console.error(`\nErro: ${e.message}`);
    process.exit(1);
});
