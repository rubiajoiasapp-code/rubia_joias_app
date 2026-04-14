// Cache em memória compartilhado entre páginas.
// Quando o usuário navega de uma aba para outra, a página usa o valor cacheado
// imediatamente (render instantâneo) e dispara uma revalidação em background.
// TTL padrão: 2 minutos. Cache é limpo ao recarregar a página (memória apenas).

type CacheEntry<T = unknown> = {
    value: T;
    timestamp: number;
};

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutos

export function cacheGet<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttlMs) {
        store.delete(key);
        return null;
    }
    return entry.value as T;
}

export function cacheSet<T>(key: string, value: T): void {
    store.set(key, { value, timestamp: Date.now() });
}

export function cacheInvalidate(key: string): void {
    store.delete(key);
}

export function cacheInvalidateAll(): void {
    store.clear();
}
