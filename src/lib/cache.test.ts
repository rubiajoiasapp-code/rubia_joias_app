import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidateAll } from './cache';

beforeEach(() => {
    cacheInvalidateAll(); // o store é módulo compartilhado: um teste não pode sujar o outro
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

const DOIS_MINUTOS = 2 * 60 * 1000;

describe('cache', () => {
    it('guarda e devolve o valor', () => {
        cacheSet('clientes', [{ nome: 'Maria' }]);
        expect(cacheGet('clientes')).toEqual([{ nome: 'Maria' }]);
    });

    it('devolve null para chave que nunca existiu', () => {
        expect(cacheGet('nao-existe')).toBeNull();
    });

    it('mantém o valor até o TTL de 2 minutos', () => {
        cacheSet('vendas', 42);
        vi.advanceTimersByTime(DOIS_MINUTOS - 1);
        expect(cacheGet('vendas')).toBe(42);
    });

    it('expira depois do TTL', () => {
        cacheSet('vendas', 42);
        vi.advanceTimersByTime(DOIS_MINUTOS + 1);
        expect(cacheGet('vendas')).toBeNull();
    });

    it('aceita TTL sob medida', () => {
        cacheSet('rapido', 1);
        vi.advanceTimersByTime(5000);
        expect(cacheGet('rapido', 10_000)).toBe(1);
        expect(cacheGet('rapido', 1000)).toBeNull();
    });

    it('invalida uma chave sem derrubar as outras', () => {
        cacheSet('a', 1);
        cacheSet('b', 2);
        cacheInvalidate('a');
        expect(cacheGet('a')).toBeNull();
        expect(cacheGet('b')).toBe(2);
    });

    it('invalida tudo de uma vez', () => {
        cacheSet('a', 1);
        cacheSet('b', 2);
        cacheInvalidateAll();
        expect(cacheGet('a')).toBeNull();
        expect(cacheGet('b')).toBeNull();
    });

    it('guardar de novo renova o relógio da entrada', () => {
        cacheSet('x', 'velho');
        vi.advanceTimersByTime(DOIS_MINUTOS - 1000);
        cacheSet('x', 'novo');
        vi.advanceTimersByTime(DOIS_MINUTOS - 1000);
        expect(cacheGet('x')).toBe('novo');
    });

    it('distingue valores falsy de ausência', () => {
        // Um total de R$ 0,00 ou uma lista vazia são respostas legítimas do banco. Se o
        // cache tratasse isso como "não tem", a tela buscaria de novo a cada visita.
        cacheSet('zero', 0);
        cacheSet('vazio', []);
        expect(cacheGet('zero')).toBe(0);
        expect(cacheGet('vazio')).toEqual([]);
    });
});
