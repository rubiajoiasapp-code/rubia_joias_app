import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scoreBand, computeScore, maxGastoFromStats, type ClientStats } from './clientScore';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4, 10, 0, 0));
});

afterEach(() => {
    vi.useRealTimers();
});

const stats = (over: Partial<ClientStats> = {}): ClientStats => ({
    totalGasto: 0,
    numVendas: 0,
    ultimaCompraISO: null,
    ...over,
});

describe('scoreBand', () => {
    // Cada faixa é testada no valor exato da fronteira e um ponto abaixo. É onde erro de
    // `>` contra `>=` se esconde, e o rótulo aparece na tela ao lado do nome da cliente.
    it('respeita as fronteiras das faixas', () => {
        expect(scoreBand(100).label).toBe('Cliente VIP');
        expect(scoreBand(90).label).toBe('Cliente VIP');
        expect(scoreBand(89).label).toBe('Excelente');
        expect(scoreBand(75).label).toBe('Excelente');
        expect(scoreBand(74).label).toBe('Muito Bom');
        expect(scoreBand(60).label).toBe('Muito Bom');
        expect(scoreBand(59).label).toBe('Regular');
        expect(scoreBand(40).label).toBe('Regular');
        expect(scoreBand(39).label).toBe('Fraco');
        expect(scoreBand(20).label).toBe('Fraco');
        expect(scoreBand(19).label).toBe('Inativo');
        expect(scoreBand(0).label).toBe('Inativo');
    });
});

describe('computeScore', () => {
    it('o total é sempre a soma das quatro partes', () => {
        const r = computeScore(
            stats({ totalGasto: 500, numVendas: 5, ultimaCompraISO: '2026-08-20T10:00:00Z' }),
            'BOM',
            5000,
        );
        expect(r.total).toBe(r.monetario + r.frequencia + r.recencia + r.pontualidade);
    });

    it('cliente sem nada pontua zero em tudo, menos pontualidade', () => {
        const r = computeScore(stats(), 'NOVO', 1000);
        expect(r.monetario).toBe(0);
        expect(r.frequencia).toBe(0);
        expect(r.recencia).toBe(0);
        expect(r.pontualidade).toBe(12); // NOVO
        expect(r.total).toBe(12);
    });

    it('nunca passa de 100', () => {
        const r = computeScore(
            stats({ totalGasto: 10000, numVendas: 50, ultimaCompraISO: '2026-09-03T10:00:00Z' }),
            'EXCELENTE',
            10000,
        );
        expect(r.total).toBeLessThanOrEqual(100);
        expect(r.monetario).toBe(40); // o maior gastador leva o teto do monetário
    });

    it('pontualidade segue o tier, do melhor para o pior', () => {
        const p = (tier: Parameters<typeof computeScore>[1]) =>
            computeScore(stats(), tier, 1000).pontualidade;
        expect(p('EXCELENTE')).toBe(25);
        expect(p('BOM')).toBe(18);
        expect(p('NOVO')).toBe(12);
        expect(p('ATENCAO')).toBe(5);
        expect(p('CRITICO')).toBe(0);
    });

    it('frequência sobe por faixa e satura em 30', () => {
        const f = (n: number) => computeScore(stats({ numVendas: n }), 'NOVO', 1000).frequencia;
        expect(f(0)).toBe(0);
        expect(f(1)).toBe(8);
        expect(f(3)).toBe(15);
        expect(f(6)).toBe(22);
        expect(f(10)).toBe(27);
        expect(f(11)).toBe(30);
        expect(f(500)).toBe(30);
    });

    it('recência é um bônus pequeno e não zera quem sumiu', () => {
        const r = (iso: string | null) =>
            computeScore(stats({ ultimaCompraISO: iso }), 'NOVO', 1000).recencia;
        expect(r('2026-09-01T10:00:00Z')).toBe(5); // dias atrás
        expect(r('2026-06-01T10:00:00Z')).toBe(3); // ~3 meses
        expect(r('2026-01-01T10:00:00Z')).toBe(2); // ~8 meses
        expect(r('2024-01-01T10:00:00Z')).toBe(1); // anos — ainda 1, não 0
        expect(r(null)).toBe(0); // nunca comprou
    });

    it('gasto maior nunca pontua menos que gasto menor', () => {
        const m = (g: number) => computeScore(stats({ totalGasto: g }), 'NOVO', 5000).monetario;
        let anterior = -1;
        for (const gasto of [0, 10, 100, 500, 1000, 2500, 5000]) {
            const atual = m(gasto);
            expect(atual).toBeGreaterThanOrEqual(anterior);
            anterior = atual;
        }
    });

    it('sem histórico de gasto na loja, ninguém pontua no monetário', () => {
        expect(computeScore(stats({ totalGasto: 100 }), 'NOVO', 0).monetario).toBe(0);
    });
});

describe('maxGastoFromStats', () => {
    it('acha o maior gastador', () => {
        expect(
            maxGastoFromStats({
                a: stats({ totalGasto: 100 }),
                b: stats({ totalGasto: 900 }),
                c: stats({ totalGasto: 50 }),
            }),
        ).toBe(900);
    });

    it('devolve zero para loja sem vendas', () => {
        expect(maxGastoFromStats({})).toBe(0);
    });
});
