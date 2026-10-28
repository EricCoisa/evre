// APINEXT: universal API handle using fetch, connecting to Next.js API routes

// Server-side: aponta pro próprio Next; client-side: caminho relativo basta.
function resolveBaseUrl(): string {
    if (typeof window !== 'undefined') return '';
    return process.env.NEXT_INTERNAL_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

// Combina o AbortSignal do chamador (se houver) com um timeout próprio de 30s.
function buildSignal(callerSignal?: AbortSignal): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(30_000);
    return callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
}

function isJsonBody(response: Response): boolean {
    const contentType = response.headers.get('content-type');
    return !!contentType && contentType.includes('application/json') && response.status !== 204;
}

// Single request() centralises URL, credentials, timeout, and error — methods are thin wrappers
async function request<T>(
    method: string,
    url: string,
    init?: RequestInit,
): Promise<T | null> {
    const fullUrl = `${resolveBaseUrl()}/api${url}`;
    const signal = buildSignal(init?.signal ?? undefined);

    const response = await fetch(fullUrl, {
        method,
        credentials: 'include',
        ...init,
        signal,
    });

    if (!response.ok) {
        const errorData = isJsonBody(response) ? await response.json() : {};
        handleErrorNext(response, errorData, `${method} request failed`);
    }

    return isJsonBody(response) ? await response.json() : null;
}

export const APINEXT = {
    GET<T>(url: string, config?: RequestInit): Promise<T | null> {
        return request<T>('GET', url, config);
    },

    POST<T>(url: string, data?: unknown, config?: RequestInit): Promise<T> {
        return request<T>('POST', url, {
            ...config,
            headers: { 'Content-Type': 'application/json', ...(config?.headers || {}) },
            body: data !== undefined ? JSON.stringify(data) : undefined,
        }) as Promise<T>;
    },

    PATCH<T>(url: string, data?: unknown, config?: RequestInit): Promise<T> {
        return request<T>('PATCH', url, {
            ...config,
            headers: { 'Content-Type': 'application/json', ...(config?.headers || {}) },
            body: data !== undefined ? JSON.stringify(data) : undefined,
        }) as Promise<T>;
    },

    PUT<T>(url: string, data?: unknown, config?: RequestInit): Promise<T> {
        return request<T>('PUT', url, {
            ...config,
            headers: { 'Content-Type': 'application/json', ...(config?.headers || {}) },
            body: data !== undefined ? JSON.stringify(data) : undefined,
        }) as Promise<T>;
    },

    DELETE<T>(url: string, config?: RequestInit): Promise<T> {
        return request<T>('DELETE', url, config) as Promise<T>;
    },
};


export class ApiNextError extends Error {
    statusCode: number;
    details?: Record<string, unknown>;
    constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
    }
}

// As route handlers do Next respondem no mesmo envelope do backend: { message }.
function handleErrorNext(response: Response, errorData: Record<string, unknown>, fallback: string): never {
    const message = typeof errorData?.message === 'string' ? errorData.message : fallback;
    throw new ApiNextError(response.status, message, errorData);
}
