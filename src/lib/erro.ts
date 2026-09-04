/**
 * O que cai num `catch` em TypeScript é `unknown`, não `Error` — qualquer valor pode ser
 * lançado. Estas funções leem esse valor com segurança, para que as páginas não precisem
 * declarar `catch (e: any)` só para alcançar `e.message`.
 *
 * Ponto que justifica o duck typing: **erro do Supabase não é instância de `Error`**. Um
 * PostgrestError é um objeto simples `{ message, details, hint, code }`. Um
 * `e instanceof Error` descartaria justamente a mensagem que interessa mostrar à dona da
 * loja, e ela veria "erro desconhecido" no lugar de "duplicate key value".
 */

/** Mensagem legível de qualquer coisa lançável. */
export function mensagemDeErro(e: unknown, padrao = 'erro desconhecido'): string {
    if (typeof e === 'string' && e.trim()) return e.trim();

    if (e && typeof e === 'object') {
        const msg = (e as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim()) return msg.trim();
    }

    return padrao;
}

/**
 * Código do erro, quando existir. O Postgres identifica falha por código, não por texto:
 * `23503` é violação de chave estrangeira, e é assim que o Estoque distingue "produto já
 * vendido" de um erro qualquer. Comparar a mensagem quebraria com mudança de idioma ou
 * de versão do banco.
 */
export function codigoDeErro(e: unknown): string | null {
    if (e && typeof e === 'object') {
        const codigo = (e as { code?: unknown }).code;
        if (typeof codigo === 'string' && codigo) return codigo;
        if (typeof codigo === 'number') return String(codigo);
    }
    return null;
}
