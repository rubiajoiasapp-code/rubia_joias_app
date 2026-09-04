// Gera todos os arquivos de imagem da marca a partir das duas artes-fonte em brand/.
//
// Rode com: npm run icones
//
// Por que existe: as artes chegam como JPEG 1024x1024 com fundo preto chapado. O app
// precisa delas em PNG, com o fundo virando transparência (senão o logo aparece como um
// retângulo preto sobre qualquer fundo que não seja preto) e em meia dúzia de tamanhos.
// Fazer isso na mão, toda vez que a marca mudar, é receita para inconsistência.
//
// ENTRADA  brand/logo-lockup.jpg   selo + "Rúbia" + "JÓIAS & ACESSÓRIOS"
//          brand/logo-simbolo.jpg  só o monograma ЯL com a coroa (sem texto)
//
// SAÍDA    public/logo.png               512  lockup, transparente  (tela de login)
//          public/logo-simbolo.png       256  símbolo, transparente (recibo)
//          public/favicon-32.png          32  símbolo, transparente (aba do navegador)
//          public/favicon-16.png          16  símbolo, transparente
//          public/apple-touch-icon.png   180  símbolo, fundo preto opaco
//          public/icon-192.png           192  símbolo, fundo preto opaco (PWA)
//          public/icon-512.png           512  símbolo, fundo preto opaco (PWA)

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const ORIGEM = 'brand';
const DESTINO = 'public';

// Limiares de luminância que separam arte de fundo. O fundo das artes mede luma 0 (símbolo)
// e 22 (lockup); o dourado mais escuro que importa fica perto de 98. A faixa 26→60 mata o
// fundo e a sujeira de compressão JPEG sem comer o ouro escuro, e o trecho intermediário
// vira transparência parcial — é ele que suaviza a borda em vez de deixar serrilhado.
const LUMA_TRANSPARENTE = 26;
const LUMA_OPACA = 60;

const PRETO = { r: 0, g: 0, b: 0, alpha: 1 };
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Converte o fundo escuro em transparência e recorta a moldura vazia em volta da arte.
 * Devolve um PNG quadrado, com a arte centralizada e ocupando `ocupacao` da largura.
 */
async function prepararArte(caminho, { ocupacao = 0.92 } = {}) {
    const { data, info } = await sharp(caminho).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    const rgba = Buffer.alloc(width * height * 4);
    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let p = 0; p < width * height; p++) {
        const i = p * channels;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        let a = (luma - LUMA_TRANSPARENTE) / (LUMA_OPACA - LUMA_TRANSPARENTE);
        a = a < 0 ? 0 : a > 1 ? 1 : a;
        a = a * a * (3 - 2 * a); // smoothstep: transição macia nas bordas

        const o = p * 4;
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = Math.round(a * 255);

        // Caixa da arte de verdade. Alpha baixo é resíduo de compressão, não desenho.
        if (a > 0.25) {
            const x = p % width, y = (p / width) | 0;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX < 0) throw new Error(`${caminho}: nenhuma arte encontrada acima do limiar`);

    // Recorta na caixa da arte, mas em um quadrado — recortar apertado deformaria a arte
    // ao ser desenhada dentro de um contêiner quadrado.
    const larguraArte = maxX - minX + 1;
    const alturaArte = maxY - minY + 1;
    const lado = Math.max(larguraArte, alturaArte);
    const esquerda = Math.round(minX - (lado - larguraArte) / 2);
    const topo = Math.round(minY - (lado - alturaArte) / 2);

    const recortada = await sharp(rgba, { raw: { width, height, channels: 4 } })
        .extract({
            left: Math.max(0, esquerda),
            top: Math.max(0, topo),
            width: Math.min(lado, width - Math.max(0, esquerda)),
            height: Math.min(lado, height - Math.max(0, topo)),
        })
        .png()
        .toBuffer();

    // Redesenha num quadro de 1024 com a margem pedida.
    const interno = Math.round(1024 * ocupacao);
    const margem = Math.round((1024 - interno) / 2);

    return sharp({
        create: { width: 1024, height: 1024, channels: 4, background: TRANSPARENTE },
    })
        .composite([{ input: await sharp(recortada).resize(interno, interno, { fit: 'contain', background: TRANSPARENTE }).toBuffer(), top: margem, left: margem }])
        .png()
        .toBuffer();
}

async function salvar(buffer, nome, tamanho, { fundo = TRANSPARENTE } = {}) {
    const img = sharp(buffer).resize(tamanho, tamanho, { fit: 'contain', background: TRANSPARENTE });
    const final = fundo.alpha === 0 ? img : img.flatten({ background: fundo });
    await final.png({ compressionLevel: 9 }).toFile(`${DESTINO}/${nome}`);
    console.log(`  ${nome.padEnd(24)} ${tamanho}x${tamanho}`);
}

const main = async () => {
    await mkdir(DESTINO, { recursive: true });

    // 512 e não 1024: o login desenha no máximo ~256px, e 512 já cobre tela retina. O
    // dobro disso só custa dados móveis da usuária, que abre esta tela todo dia.
    console.log('Lockup (login):');
    const lockup = await prepararArte(`${ORIGEM}/logo-lockup.jpg`, { ocupacao: 0.96 });
    await salvar(lockup, 'logo.png', 512);

    // O símbolo vai para ícone de app. O Android recorta ícone em círculo, então a arte
    // fica em 80% do quadro — o que passa disso é cortado na tela inicial da usuária.
    console.log('Símbolo (ícones):');
    const simbolo = await prepararArte(`${ORIGEM}/logo-simbolo.jpg`, { ocupacao: 0.8 });

    await salvar(simbolo, 'logo-simbolo.png', 256);
    await salvar(simbolo, 'favicon-32.png', 32);
    await salvar(simbolo, 'favicon-16.png', 16);
    // iOS pinta transparência de preto e ignora arredondamento próprio: fundo sólido.
    await salvar(simbolo, 'apple-touch-icon.png', 180, { fundo: PRETO });
    await salvar(simbolo, 'icon-192.png', 192, { fundo: PRETO });
    await salvar(simbolo, 'icon-512.png', 512, { fundo: PRETO });

    console.log('\nPronto.');
};

main().catch((e) => {
    console.error('Falhou:', e.message);
    process.exit(1);
});
