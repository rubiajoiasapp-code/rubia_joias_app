export function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

const hojeBR = () => new Date().toLocaleDateString('pt-BR');

/**
 * Eventos de pagamento gravados em `parcelas_venda.observacoes` pelo Crediário.
 *
 * São log INTERNO: registram quando entrou (ou saiu) dinheiro de uma parcela. Não podem
 * vazar para o recibo, que é o documento enviado à cliente pelo WhatsApp — ela não
 * precisa ver o histórico de estornos e correções da loja.
 *
 * Geradores e filtro moram juntos de propósito: separados, um muda sem o outro e o log
 * volta a vazar em silêncio.
 */
const EVENTO_PAGAMENTO = /^(Abatimento de R\$|Quitação manual de R\$|Estorno de R\$)/;

export const registroAbatimento = (valor: number) =>
    `Abatimento de R$ ${valor.toFixed(2)} em ${hojeBR()}`;

export const registroQuitacao = (valor: number) =>
    `Quitação manual de R$ ${valor.toFixed(2)} em ${hojeBR()}`;

export const registroEstorno = (valor: number) =>
    `Estorno de R$ ${valor.toFixed(2)} — parcela reaberta em ${hojeBR()}`;

/** Acrescenta uma linha ao histórico da parcela, preservando o que já estava lá. */
export function anexarObservacao(atual: string | null, linha: string): string {
    return atual ? `${atual}\n${linha}` : linha;
}

/**
 * O que da `observacoes` pode ser mostrado à cliente: notas de renegociação, entrada e
 * anotações manuais da dona. Tudo que for evento de pagamento fica de fora.
 */
export function notasParaCliente(observacoes: string | null): string | null {
    if (!observacoes) return null;
    const linhas = observacoes
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !EVENTO_PAGAMENTO.test(l));
    return linhas.length ? linhas.join('\n') : null;
}

export function formatCurrency(n: number): string {
    if (!Number.isFinite(n)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

export function todayLocalISO(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function nowLocalISO(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const tzOffset = -d.getTimezoneOffset();
    const sign = tzOffset >= 0 ? '+' : '-';
    const abs = Math.abs(tzOffset);
    const offHours = pad(Math.floor(abs / 60));
    const offMins = pad(abs % 60);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offHours}:${offMins}`;
}

export function splitInstallments(total: number, n: number): number[] {
    if (n <= 0) return [];
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / n);
    const remainder = cents - base * n;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
        const extra = i < remainder ? 1 : 0;
        out.push((base + extra) / 100);
    }
    return out;
}

export function normalizeCpf(raw: string): string {
    return (raw || '').replace(/\D/g, '');
}

export function normalizePhone(raw: string): string {
    return (raw || '').replace(/\D/g, '');
}

export function formatCpf(raw: string): string {
    const d = normalizeCpf(raw);
    if (d.length !== 11) return raw;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatPhone(raw: string): string {
    const d = normalizePhone(raw);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return raw;
}

export function isValidCpf(raw: string): boolean {
    const cpf = normalizeCpf(raw);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
    const calc = (slice: number) => {
        let sum = 0;
        for (let i = 0; i < slice; i++) sum += parseInt(cpf[i]) * (slice + 1 - i);
        const mod = (sum * 10) % 11;
        return mod === 10 ? 0 : mod;
    };
    return calc(9) === parseInt(cpf[9]) && calc(10) === parseInt(cpf[10]);
}

export function isValidPhone(raw: string): boolean {
    const d = normalizePhone(raw);
    return d.length >= 10 && d.length <= 15;
}
