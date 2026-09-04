import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyClient, tierRank, TIER_INFO, type ParcelaForTier } from './clientTier';

// Toda classificação depende de "hoje". Sem relógio fixo, um teste que passa em setembro
// quebra em outubro sozinho.
const HOJE = '2026-09-04';

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4, 10, 0, 0)); // 4/set/2026, 10h, horário local
});

afterEach(() => {
    vi.useRealTimers();
});

/** Parcela em aberto (nada pago) com o vencimento pedido. */
function emAberto(vencimento: string, valor = 100): ParcelaForTier {
    return {
        pago: false,
        data_vencimento: vencimento,
        data_pagamento: null,
        valor_parcela: valor,
        saldo_devedor: valor,
    };
}

/** Parcela quitada, paga na data informada. */
function paga(vencimento: string, pagamento: string, valor = 100): ParcelaForTier {
    return {
        pago: true,
        data_vencimento: vencimento,
        data_pagamento: pagamento,
        valor_parcela: valor,
        saldo_devedor: 0,
    };
}

describe('classifyClient — sem histórico', () => {
    it('cliente sem nenhuma parcela é NOVO', () => {
        expect(classifyClient([])).toBe('NOVO');
    });
});

describe('classifyClient — atraso', () => {
    it('parcela que vence HOJE não está atrasada', () => {
        // O Crediário compara as datas como texto ISO e considera esta parcela em dia.
        // Se a classificação discordar, a mesma parcela aparece "em dia" numa tela e
        // rebaixa a cliente na outra.
        expect(classifyClient([emAberto(HOJE)])).not.toBe('ATENCAO');
        expect(classifyClient([emAberto(HOJE)])).not.toBe('CRITICO');
    });

    it('parcela que vence amanhã não está atrasada', () => {
        expect(classifyClient([emAberto('2026-09-05')])).not.toBe('ATENCAO');
    });

    it('atraso de 1 dia já é ATENCAO', () => {
        expect(classifyClient([emAberto('2026-09-03')])).toBe('ATENCAO');
    });

    it('atraso de até 30 dias é ATENCAO', () => {
        expect(classifyClient([emAberto('2026-08-25')])).toBe('ATENCAO'); // 10 dias
        expect(classifyClient([emAberto('2026-08-05')])).toBe('ATENCAO'); // 30 dias
    });

    it('atraso de mais de 30 dias é CRITICO', () => {
        expect(classifyClient([emAberto('2026-08-04')])).toBe('CRITICO'); // 31 dias
        expect(classifyClient([emAberto('2026-07-21')])).toBe('CRITICO'); // 45 dias
    });

    it('vale o maior atraso entre as parcelas em aberto', () => {
        expect(classifyClient([emAberto('2026-09-03'), emAberto('2026-07-21')])).toBe('CRITICO');
    });

    it('parcela já quitada não conta como atraso, mesmo vencida', () => {
        expect(classifyClient([paga('2026-07-21', '2026-07-20')])).toBe('EXCELENTE');
    });
});

describe('classifyClient — alívio por pagamento parcial', () => {
    it('quem pagou 70% do vencido cai um nível: CRITICO vira ATENCAO', () => {
        const parcial: ParcelaForTier = {
            pago: false,
            data_vencimento: '2026-07-21', // 45 dias
            data_pagamento: null,
            valor_parcela: 100,
            saldo_devedor: 30, // pagou 70
        };
        expect(classifyClient([parcial])).toBe('ATENCAO');
    });

    it('quem pagou menos de 70% continua CRITICO', () => {
        const parcial: ParcelaForTier = {
            pago: false,
            data_vencimento: '2026-07-21',
            data_pagamento: null,
            valor_parcela: 100,
            saldo_devedor: 31, // pagou 69
        };
        expect(classifyClient([parcial])).toBe('CRITICO');
    });

    it('devendo pouco e sem pagar nada, o tempo é que manda', () => {
        // Não existe piso por valor de propósito: R$ 100 parados há 101 dias é CRITICO,
        // por menor que seja a quantia.
        expect(classifyClient([emAberto('2026-05-26', 100)])).toBe('CRITICO');
    });

    it('com alívio e atraso curto, quem decide é o histórico de pagamento', () => {
        const parcial: ParcelaForTier = {
            pago: false,
            data_vencimento: '2026-08-25', // 10 dias
            data_pagamento: null,
            valor_parcela: 100,
            saldo_devedor: 10, // pagou 90
        };
        expect(classifyClient([parcial])).toBe('EXCELENTE');
        expect(classifyClient([parcial, paga('2026-06-10', '2026-06-20')])).toBe('BOM');
    });
});

describe('classifyClient — histórico de pagamento', () => {
    it('nunca atrasou é EXCELENTE', () => {
        expect(
            classifyClient([paga('2026-06-10', '2026-06-10'), paga('2026-07-10', '2026-07-09')]),
        ).toBe('EXCELENTE');
    });

    it('atrasou alguma vez é BOM', () => {
        expect(classifyClient([paga('2026-06-10', '2026-06-15')])).toBe('BOM');
    });

    it('as três últimas em dia recuperam para EXCELENTE', () => {
        expect(
            classifyClient([
                paga('2026-01-10', '2026-02-20'), // atrasou lá atrás
                paga('2026-06-10', '2026-06-10'),
                paga('2026-07-10', '2026-07-10'),
                paga('2026-08-10', '2026-08-10'),
            ]),
        ).toBe('EXCELENTE');
    });

    it('só duas em dia depois do atraso ainda é BOM', () => {
        expect(
            classifyClient([
                paga('2026-01-10', '2026-02-20'),
                paga('2026-07-10', '2026-07-10'),
                paga('2026-08-10', '2026-08-10'),
            ]),
        ).toBe('BOM');
    });

    it('a recuperação olha as três MAIS RECENTES, não as três primeiras', () => {
        expect(
            classifyClient([
                paga('2026-06-10', '2026-06-10'),
                paga('2026-07-10', '2026-07-10'),
                paga('2026-08-10', '2026-08-25'), // a última atrasou
            ]),
        ).toBe('BOM');
    });

    it('parcela paga sem data de pagamento é ignorada no histórico', () => {
        const semData: ParcelaForTier = {
            pago: true,
            data_vencimento: '2026-06-10',
            data_pagamento: null,
            valor_parcela: 100,
            saldo_devedor: 0,
        };
        expect(classifyClient([semData])).toBe('EXCELENTE');
    });
});

describe('tierRank', () => {
    it('ordena do melhor para o pior, para a lista de clientes', () => {
        const ordem = (['CRITICO', 'EXCELENTE', 'ATENCAO', 'NOVO', 'BOM'] as const)
            .slice()
            .sort((a, b) => tierRank(a) - tierRank(b));
        expect(ordem).toEqual(['EXCELENTE', 'BOM', 'NOVO', 'ATENCAO', 'CRITICO']);
    });

    it('todo tier tem rótulo e cor definidos', () => {
        for (const tier of ['EXCELENTE', 'BOM', 'NOVO', 'ATENCAO', 'CRITICO'] as const) {
            expect(TIER_INFO[tier].label).toBeTruthy();
            expect(TIER_INFO[tier].bgClass).toMatch(/^bg-/);
        }
    });
});
