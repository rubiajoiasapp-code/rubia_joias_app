type Pagina<T> = {
    data: T[] | null;
    error: { message: string } | null;
    count: number | null;
};

const PAGINA = 1000;

/**
 * Lê TODAS as linhas de uma consulta, paginando.
 *
 * O Supabase devolve no máximo 1.000 linhas por requisição e não avisa quando corta;
 * `.limit(10000)` não passa desse teto. Tela com número menor sem aviso é pior que tela
 * com erro, então esta função lança se o que leu não bate com o que o servidor contou.
 *
 * O `montar(de, ate)` de quem chama precisa:
 *  - pedir `.select(colunas, { count: 'exact' })`;
 *  - aplicar `.range(de, ate)`;
 *  - terminar a ordenação com `.order('id')`. Sem desempate único, linhas duplicam ou
 *    somem entre uma página e outra.
 */
export async function lerTudo<T>(
    montar: (de: number, ate: number) => PromiseLike<Pagina<T>>,
): Promise<T[]> {
    const linhas: T[] = [];
    let esperado: number | null = null;

    for (let de = 0; ; de += PAGINA) {
        const { data, error, count } = await montar(de, de + PAGINA - 1);
        if (error) throw new Error(error.message);
        if (count === null) {
            throw new Error("Leitura sem contagem: faltou { count: 'exact' } no select.");
        }
        esperado = count;
        if (!data?.length) break;
        linhas.push(...data);
        if (data.length < PAGINA) break;
    }

    if (linhas.length !== esperado) {
        throw new Error(`Leitura incompleta: lidas ${linhas.length} de ${esperado}.`);
    }
    return linhas;
}
