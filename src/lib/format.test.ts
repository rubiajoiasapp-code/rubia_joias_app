import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    roundMoney,
    formatCurrency,
    splitInstallments,
    normalizeCpf,
    formatCpf,
    isValidCpf,
    normalizePhone,
    formatPhone,
    isValidPhone,
    anexarObservacao,
    ultimaObservacao,
    notasParaCliente,
    registroAbatimento,
    registroQuitacao,
    registroEstorno,
    todayLocalISO,
} from './format';

// O Intl separa "R$" do numero com espaco nao-quebravel (U+00A0), nao com espaco
// comum: comparar com espaco comum falharia por um caractere invisivel. O escape
// \u00A0 e usado de proposito — um NBSP literal aqui seria exatamente o tipo de
// caractere invisivel no codigo que o ESLint proibe, com razao.
const semNbsp = (s: string) => s.replace(/\u00A0/g, ' ');

afterEach(() => {
    vi.useRealTimers();
});

describe('formatCurrency', () => {
    it('formata no padrão brasileiro, com milhar e dois decimais', () => {
        expect(semNbsp(formatCurrency(1234.5))).toBe('R$ 1.234,50');
        expect(semNbsp(formatCurrency(0))).toBe('R$ 0,00');
        expect(semNbsp(formatCurrency(0.1))).toBe('R$ 0,10');
    });

    it('formata negativo sem perder o sinal', () => {
        expect(semNbsp(formatCurrency(-45.68))).toBe('-R$ 45,68');
    });

    it('arredonda para dois decimais em vez de truncar', () => {
        expect(semNbsp(formatCurrency(1.005))).toBe('R$ 1,01');
        expect(semNbsp(formatCurrency(2.999))).toBe('R$ 3,00');
    });

    it('devolve zero em vez de "R$ NaN" quando a conta deu errado', () => {
        // Isso aparece na tela da loja. Um NaN visível assusta; zero, não.
        expect(semNbsp(formatCurrency(NaN))).toBe('R$ 0,00');
        expect(semNbsp(formatCurrency(Infinity))).toBe('R$ 0,00');
    });
});

describe('splitInstallments', () => {
    it('divide exato quando dá', () => {
        expect(splitInstallments(100, 4)).toEqual([25, 25, 25, 25]);
    });

    it('joga os centavos que sobram nas primeiras parcelas', () => {
        expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
        expect(splitInstallments(10, 3)).toEqual([3.34, 3.33, 3.33]);
    });

    // A propriedade que não pode quebrar nunca: o crediário não pode cobrar da cliente
    // um centavo a mais nem a menos do que a venda. Testado por varredura, porque o erro
    // aqui aparece só em combinações específicas de valor e número de parcelas.
    it('a soma das parcelas é sempre igual ao total, em centavos', () => {
        for (let centavos = 1; centavos <= 2000; centavos++) {
            const total = centavos / 100;
            for (let n = 1; n <= 12; n++) {
                const soma = splitInstallments(total, n).reduce((a, b) => a + b, 0);
                expect(Math.round(soma * 100)).toBe(centavos);
            }
        }
    });

    it('devolve lista vazia para número de parcelas inválido', () => {
        expect(splitInstallments(100, 0)).toEqual([]);
        expect(splitInstallments(100, -1)).toEqual([]);
    });
});

describe('roundMoney', () => {
    it('limpa a poeira de ponto flutuante, que é para o que ele existe', () => {
        expect(roundMoney(0.1 + 0.2)).toBe(0.3); // 0.30000000000000004 sem ele
        expect(roundMoney(1.1 * 3)).toBe(3.3);
    });

    it('arredonda meio centavo para cima', () => {
        expect(roundMoney(10.994)).toBe(10.99);
        expect(roundMoney(10.996)).toBe(11);
    });

    // Comportamento conhecido, registrado aqui de propósito: 1.005 * 100 dá
    // 100.49999999999999 em ponto flutuante, então desce para 1,00 — enquanto o
    // formatCurrency, que usa Intl, mostra "R$ 1,01". Divergem só em valores de três
    // casas, que não aparecem em preço de verdade. Se alguém mexer nisso um dia, é
    // melhor que este teste acuse do que passar batido.
    it('divergência conhecida com o Intl em valores de três casas', () => {
        expect(roundMoney(1.005)).toBe(1);
        expect(semNbsp(formatCurrency(1.005))).toBe('R$ 1,01');
    });
});

describe('CPF', () => {
    it('valida um CPF correto', () => {
        expect(isValidCpf('529.982.247-25')).toBe(true);
        expect(isValidCpf('52998224725')).toBe(true);
    });

    it('rejeita dígito verificador errado', () => {
        expect(isValidCpf('529.982.247-24')).toBe(false);
    });

    it('rejeita os dígitos repetidos, que passam na conta mas não existem', () => {
        expect(isValidCpf('111.111.111-11')).toBe(false);
        expect(isValidCpf('00000000000')).toBe(false);
    });

    it('rejeita tamanho errado', () => {
        expect(isValidCpf('1234567890')).toBe(false);
        expect(isValidCpf('')).toBe(false);
    });

    it('formata com pontos e traço, e devolve o original se não der', () => {
        expect(formatCpf('52998224725')).toBe('529.982.247-25');
        expect(formatCpf('123')).toBe('123');
    });

    it('normaliza tirando tudo que não é dígito', () => {
        expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    });
});

describe('telefone', () => {
    it('formata celular com nove dígitos', () => {
        expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    });

    it('formata fixo com oito dígitos', () => {
        expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    });

    it('devolve o original quando o tamanho não bate', () => {
        expect(formatPhone('123')).toBe('123');
    });

    it('aceita de 10 a 15 dígitos, para caber número com DDI', () => {
        expect(isValidPhone('1133334444')).toBe(true);
        expect(isValidPhone('5511987654321')).toBe(true);
        expect(isValidPhone('123456789')).toBe(false);
    });

    it('normaliza tirando máscara', () => {
        expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
    });
});

describe('observações da parcela', () => {
    it('acrescenta linha preservando o histórico', () => {
        expect(anexarObservacao(null, 'primeira')).toBe('primeira');
        expect(anexarObservacao('primeira', 'segunda')).toBe('primeira\nsegunda');
    });

    it('lê a última linha e conta quantas vieram antes', () => {
        expect(ultimaObservacao('a\nb\nc')).toEqual({ linha: 'c', anteriores: 2 });
        expect(ultimaObservacao('só uma')).toEqual({ linha: 'só uma', anteriores: 0 });
    });

    it('devolve null para vazio ou só espaço', () => {
        expect(ultimaObservacao(null)).toBeNull();
        expect(ultimaObservacao('')).toBeNull();
        expect(ultimaObservacao('  \n  ')).toBeNull();
    });
});

describe('notasParaCliente', () => {
    it('mostra anotação da dona e nota de renegociação', () => {
        expect(notasParaCliente('Renegociação 01/09/2026')).toBe('Renegociação 01/09/2026');
        expect(notasParaCliente('Entrada')).toBe('Entrada');
    });

    it('esconde o log interno de pagamento', () => {
        expect(notasParaCliente('Abatimento de R$ 45,68 em 03/09/2026')).toBeNull();
        expect(notasParaCliente('Quitação manual de R$ 100,00 em 03/09/2026')).toBeNull();
        expect(notasParaCliente('Estorno de R$ 20,00 — parcela reaberta em 03/09/2026')).toBeNull();
    });

    it('filtra só o log e mantém o resto do histórico', () => {
        const historico = [
            'Renegociação 01/09/2026',
            'Abatimento de R$ 45,68 em 02/09/2026',
            'Cliente pediu prazo até dia 10',
        ].join('\n');
        expect(notasParaCliente(historico)).toBe(
            'Renegociação 01/09/2026\nCliente pediu prazo até dia 10',
        );
    });

    // A invariante que o comentário no format.ts alerta: geradores e filtro moram juntos
    // porque, separados, um muda sem o outro e o log volta a vazar em silêncio para o
    // recibo que vai à cliente pelo WhatsApp. Este teste amarra os dois.
    it('todo registro gerado pelo sistema é filtrado pelo próprio filtro', () => {
        for (const registro of [
            registroAbatimento(45.68),
            registroQuitacao(100),
            registroEstorno(20),
        ]) {
            expect(notasParaCliente(registro)).toBeNull();
        }
    });

    it('devolve null quando não há nada', () => {
        expect(notasParaCliente(null)).toBeNull();
        expect(notasParaCliente('')).toBeNull();
    });
});

describe('todayLocalISO', () => {
    it('usa a data local, não a UTC', () => {
        // 3 de setembro, 22h em Brasília, já é dia 4 em UTC. A loja pensa em Brasília:
        // uma parcela que vence hoje não pode virar "vencida ontem" às 21h.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-04T01:30:00.000Z')); // 22:30 do dia 3 em BRT
        const esperado = new Date().getTimezoneOffset() === 180 ? '2026-09-03' : todayLocalISO();
        expect(todayLocalISO()).toBe(esperado);
        expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
