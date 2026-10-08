import { describe, expect, it, vi } from 'vitest';
import { lerTudo } from './lerTudo';

const fonte = (total: number) => Array.from({ length: total }, (_, i) => ({ id: i }));

/** Simula o servidor: devolve a fatia pedida e a contagem total. */
const servidor = (total: number) =>
    vi.fn(async (de: number, ate: number) => ({
        data: fonte(total).slice(de, ate + 1),
        error: null,
        count: total,
    }));

describe('lerTudo', () => {
    it('0 linhas: devolve vazio', async () => {
        expect(await lerTudo(servidor(0))).toEqual([]);
    });

    it('1.000 exatas: página cheia, pede a seguinte (vazia) e confere', async () => {
        const montar = servidor(1000);
        const r = await lerTudo(montar);
        expect(r).toHaveLength(1000);
        expect(montar).toHaveBeenCalledTimes(2);
    });

    it('1.065: duas páginas, ordem preservada', async () => {
        const r = await lerTudo(servidor(1065));
        expect(r).toHaveLength(1065);
        expect(r.map((x) => x.id)).toEqual(fonte(1065).map((x) => x.id));
    });

    it('erro na 2ª página: lança', async () => {
        const montar = vi.fn(async (de: number) =>
            de === 0
                ? { data: fonte(1000), error: null, count: 1065 }
                : { data: null, error: { message: 'caiu' }, count: null },
        );
        await expect(lerTudo(montar)).rejects.toThrow('caiu');
    });

    it('contagem que não bate: lança', async () => {
        const montar = vi.fn(async () => ({ data: fonte(10), error: null, count: 12 }));
        await expect(lerTudo(montar)).rejects.toThrow('lidas 10 de 12');
    });

    it('count nulo: lança', async () => {
        const montar = vi.fn(async () => ({ data: fonte(3), error: null, count: null }));
        await expect(lerTudo(montar)).rejects.toThrow('count');
    });
});
