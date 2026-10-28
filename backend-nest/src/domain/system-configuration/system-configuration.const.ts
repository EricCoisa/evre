/** Cache Redis das leituras de SystemConfiguration por `labelKey`. */
export const CONFIG_CACHE_TTL = 300; // 5 min

/** Sentinela de chave inexistente: "provider não configurado" também é resposta cacheável. */
export const CONFIG_CACHE_MISS = '__missing__';

export const configCacheKey = (labelKey: string) => `sysconfig:${labelKey}`;
