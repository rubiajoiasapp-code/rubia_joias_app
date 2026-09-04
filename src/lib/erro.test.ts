import { describe, it, expect } from 'vitest';
import { mensagemDeErro, codigoDeErro } from './erro';

describe('mensagemDeErro', () => {
    it('lê a mensagem de um Error', () => {
        expect(mensagemDeErro(new Error('deu ruim'))).toBe('deu ruim');
        expect(mensagemDeErro(new TypeError('tipo errado'))).toBe('tipo errado');
    });

    // A razão de existir do duck typing: PostgrestError é objeto simples, não Error.
    // Um `instanceof Error` mandaria "erro desconhecido" para a tela no lugar disto.
    it('lê a mensagem de um erro do Supabase, que não é instância de Error', () => {
        const postgrest = {
            message: 'duplicate key value violates unique constraint',
            details: null,
            hint: null,
            code: '23505',
        };
        expect(postgrest instanceof Error).toBe(false);
        expect(mensagemDeErro(postgrest)).toBe('duplicate key value violates unique constraint');
    });

    it('aceita string lançada direto', () => {
        expect(mensagemDeErro('sem internet')).toBe('sem internet');
    });

    it('cai no padrão quando não há mensagem aproveitável', () => {
        expect(mensagemDeErro(null)).toBe('erro desconhecido');
        expect(mensagemDeErro(undefined)).toBe('erro desconhecido');
        expect(mensagemDeErro({})).toBe('erro desconhecido');
        expect(mensagemDeErro(42)).toBe('erro desconhecido');
        expect(mensagemDeErro({ message: '' })).toBe('erro desconhecido');
        expect(mensagemDeErro({ message: '   ' })).toBe('erro desconhecido');
        expect(mensagemDeErro({ message: 123 })).toBe('erro desconhecido');
    });

    it('aceita padrão sob medida', () => {
        expect(mensagemDeErro(null, 'tente novamente')).toBe('tente novamente');
    });

    it('tira espaço das pontas, que sujaria o balão de aviso', () => {
        expect(mensagemDeErro(new Error('  com espaço  '))).toBe('com espaço');
    });
});

describe('codigoDeErro', () => {
    it('lê o código do Postgres', () => {
        expect(codigoDeErro({ code: '23503', message: 'x' })).toBe('23503');
    });

    it('aceita código numérico', () => {
        expect(codigoDeErro({ code: 409 })).toBe('409');
    });

    it('devolve null quando não há código', () => {
        expect(codigoDeErro(new Error('x'))).toBeNull();
        expect(codigoDeErro(null)).toBeNull();
        expect(codigoDeErro('texto')).toBeNull();
        expect(codigoDeErro({ code: '' })).toBeNull();
    });
});
